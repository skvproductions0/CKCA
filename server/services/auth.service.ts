import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../database/client';
import { checkSchoolLimits } from './feature.service';
import { isMaintenanceModeActive, getMaintenanceMessage } from './system.service';

export type Role = 'CREATOR' | 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'TEACHER' | 'RECEPTIONIST';

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function login(
  username: string,
  password: string,
  schoolCode?: string,
  clientMetadata?: { device?: string; ipAddress?: string }
) {
  const db = getPrismaClient();

  // First, check if logging in as CREATOR (Creator logs in without a school code)
  const creatorUser = await db.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      role: 'CREATOR',
      isActive: true,
      deletedAt: null,
    },
  });

  let user = creatorUser;
  let activeSchool: any = null;

  if (!user) {
    // Non-Creator login: Check global system maintenance mode
    const inMaintenance = await isMaintenanceModeActive();
    if (inMaintenance) {
      const msg = await getMaintenanceMessage();
      throw new Error(msg || 'System is currently undergoing scheduled maintenance. Please try again shortly.');
    }

    // Non-Creator login: school code is mandatory
    if (!schoolCode || !schoolCode.trim()) {
      throw new Error('Please enter your School Code to sign in.');
    }

    const school = await db.school.findFirst({
      where: {
        code: schoolCode.trim().toUpperCase(),
        deletedAt: null,
      },
    });

    if (!school) {
      throw new Error(`School with code "${schoolCode}" not found.`);
    }

    if (school.status === 'SUSPENDED') {
      throw new Error('This school account has been suspended. Please contact your system administrator.');
    }

    if (school.status === 'ARCHIVED') {
      throw new Error('This school account has been archived.');
    }

    if (school.maintenanceMode) {
      throw new Error(school.maintenanceMessage || 'School is currently under maintenance. Please try again later.');
    }

    let licenseWarning: string | null = null;
    if (school.licenseExpiresAt) {
      const msRemaining = new Date(school.licenseExpiresAt).getTime() - Date.now();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        throw new Error(
          `School licence has expired on ${new Date(school.licenseExpiresAt).toLocaleDateString(
            'en-IN'
          )}. Please contact system administrator.`
        );
      }
      if (daysRemaining <= 30) {
        licenseWarning = `School licence will expire in ${daysRemaining} day(s) on ${new Date(
          school.licenseExpiresAt
        ).toLocaleDateString('en-IN')}. Please renew your licence promptly.`;
      }
    }

    activeSchool = { ...school, licenseWarning };

    // Look up user within this school
    user = await db.user.findFirst({
      where: {
        schoolId: school.id,
        OR: [{ username }, { email: username }],
        deletedAt: null,
      },
      include: { school: true },
    });

    if (!user) {
      throw new Error('Invalid username or password for this school.');
    }

    if (!user.isActive || user.isLocked) {
      throw new Error(
        user.lockReason
          ? `Account is locked: ${user.lockReason}`
          : 'Your account has been locked or deactivated. Please contact your system administrator.'
      );
    }
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid username or password.');
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
      device: clientMetadata?.device || 'Desktop Client (Windows)',
      ipAddress: clientMetadata?.ipAddress || '127.0.0.1',
      lastActiveAt: new Date(),
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createAuditLog(
    user.id,
    'LOGIN',
    'User',
    user.id,
    `User ${user.username} logged in${activeSchool ? ` to ${activeSchool.name}` : ' (Creator Portal)'}`,
    user.schoolId
  );

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token, expiresAt, school: activeSchool };
}

export async function logout(token: string) {
  const db = getPrismaClient();
  const session = await db.session.findUnique({ where: { token } });
  if (session) {
    await createAuditLog(session.userId, 'LOGOUT', 'User', session.userId, 'User logged out');
    await db.session.delete({ where: { token } });
  }
}

export async function validateSession(token: string) {
  const db = getPrismaClient();
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: { school: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await db.session.delete({ where: { token } });
    return null;
  }

  if (!session.user.isActive || session.user.isLocked || session.user.deletedAt) {
    return null;
  }

  // If system maintenance mode is active, non-Creator sessions are invalidated
  if (session.user.role !== 'CREATOR') {
    const inMaintenance = await isMaintenanceModeActive();
    if (inMaintenance) {
      return null;
    }
    // If user's school is suspended or archived, invalidate session
    if (session.user.school && session.user.school.status !== 'ACTIVE') {
      return null;
    }
    // If user's school licence has expired, block non-creator session
    if (session.user.school?.licenseExpiresAt && new Date(session.user.school.licenseExpiresAt) < new Date()) {
      return null;
    }
  }

  // Update last active time (non-blocking)
  db.session.update({
    where: { token },
    data: { lastActiveAt: new Date() },
  }).catch(() => {});

  const { passwordHash: _, ...safeUser } = session.user;
  return safeUser;
}

export async function updateUserPassword(userId: string, newPassword: string) {
  const db = getPrismaClient();
  const passwordHash = await hashPassword(newPassword);
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      forcePasswordChange: false,
    },
  });
  await createAuditLog(userId, 'PASSWORD_CHANGED', 'User', userId, 'User updated their password');
  return { success: true };
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
  schoolId?: string | null;
}) {
  if (data.role === 'CREATOR') {
    throw new Error('Creator account cannot be created from the UI.');
  }
  if (data.schoolId) {
    await checkSchoolLimits(data.schoolId, 'STAFF');
  }
  const db = getPrismaClient();
  const passwordHash = await hashPassword(data.password);
  const user = await db.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
      schoolId: data.schoolId || null,
    },
  });
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function createAuditLog(
  userId: string | null | undefined,
  action: string,
  entity?: string,
  entityId?: string,
  details?: string,
  schoolId?: string | null
) {
  try {
    const db = getPrismaClient();
    let validUserId: string | null = null;
    let resolvedSchoolId: string | null = schoolId || null;
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        validUserId = user.id;
        if (!resolvedSchoolId && user.schoolId) {
          resolvedSchoolId = user.schoolId;
        }
      }
    }
    await db.auditLog.create({
      data: {
        userId: validUserId,
        action,
        entity,
        entityId,
        details,
        schoolId: resolvedSchoolId,
      },
    });
  } catch {
    // Non-blocking audit log failure
  }
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  CREATOR: ['*'],
  SUPER_ADMIN: ['*'],
  PRINCIPAL: [
    'dashboard', 'students', 'admissions', 'classes', 'teachers', 'subjects',
    'attendance', 'exams', 'results', 'reports', 'notifications', 'settings.limited',
  ],
  ACCOUNTANT: [
    'students.view', 'fees', 'payments', 'reports.fees', 'receipts',
  ],
  TEACHER: [
    'students.view', 'attendance', 'results', 'classes.view',
  ],
  RECEPTIONIST: [
    'students', 'admissions', 'fees.view', 'students.search',
  ],
};

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role as Role] || [];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const module = permission.split('.')[0];
  return perms.some(p => p === module || p.startsWith(module + '.'));
}
