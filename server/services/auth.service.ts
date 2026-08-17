import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../database/client';

export type Role = 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'TEACHER' | 'RECEPTIONIST';

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function login(username: string, password: string) {
  const db = getPrismaClient();
  const user = await db.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      isActive: true,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new Error('Invalid username or password.');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid username or password.');
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createAuditLog(user.id, 'LOGIN', 'User', user.id, `User ${user.username} logged in`);

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token, expiresAt };
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
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await db.session.delete({ where: { token } });
    return null;
  }

  if (!session.user.isActive || session.user.deletedAt) {
    return null;
  }

  const { passwordHash: _, ...safeUser } = session.user;
  return safeUser;
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
}) {
  const db = getPrismaClient();
  const passwordHash = await hashPassword(data.password);
  const user = await db.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
    },
  });
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function createAuditLog(
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  details?: string
) {
  const db = getPrismaClient();
  await db.auditLog.create({
    data: { userId, action, entity, entityId, details },
  });
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
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
