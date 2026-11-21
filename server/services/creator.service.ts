import path from 'path';
import { getPrismaClient } from '../database/client';
import { createAuditLog, verifyPassword, hashPassword } from './auth.service';
import { saveFile } from './file.service';

export async function enterSchool(creatorUserId: string, schoolIdentifier: string) {
  const db = getPrismaClient();

  const school = await db.school.findFirst({
    where: {
      OR: [{ id: schoolIdentifier }, { code: schoolIdentifier.toUpperCase() }],
      deletedAt: null,
    },
  }) || await db.school.findFirst({ where: { deletedAt: null } });

  const schoolId = school?.id || 'school_ckca_default';
  const schoolName = school?.name || 'CK CAREER ACADEMY';

  await createAuditLog(
    creatorUserId,
    'CREATOR_ENTER_SCHOOL',
    'School',
    schoolId,
    `Creator entered school "${schoolName}" (${schoolId}) in view/manage mode`,
    schoolId
  );

  return {
    schoolId,
    schoolName,
    code: school?.code || 'CKCA01',
    enteredAt: new Date().toISOString(),
  };
}

export async function exitSchool(creatorUserId: string, schoolId?: string | null) {
  await createAuditLog(
    creatorUserId,
    'CREATOR_EXIT_SCHOOL',
    'School',
    schoolId || 'school_ckca_default',
    'Creator exited school view/manage mode and returned to Creator Panel',
    schoolId
  );

  return { success: true };
}

export async function getCreatorDashboardStats() {
  const db = getPrismaClient();

  const [
    totalSchools,
    activeSchools,
    suspendedSchools,
    userCount,
    studentCount,
    teacherCount,
    schoolsList,
    recentAuditLogs,
  ] = await Promise.all([
    db.school.count({ where: { deletedAt: null } }),
    db.school.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    db.school.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, role: { not: 'CREATOR' } } }),
    db.student.count({ where: { deletedAt: null } }),
    db.teacher.count({ where: { deletedAt: null } }),
    db.school.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { students: true, teachers: true, users: true },
        },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        user: {
          select: { username: true, fullName: true, role: true },
        },
      },
    }),
  ]);

  return {
    totalSchools: totalSchools || 1,
    activeSchools: activeSchools || 1,
    suspendedSchools,
    totalUsers: userCount,
    totalStudents: studentCount,
    totalTeachers: teacherCount,
    schools: schoolsList.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      shortCode: s.shortCode,
      status: s.status,
      principalName: s.principalName || 'Principal',
      phone: s.phone || '',
      email: s.email || '',
      studentCount: s._count.students,
      teacherCount: s._count.teachers,
      staffCount: s._count.users,
    })),
    recentActivity: recentAuditLogs,
  };
}

export interface SchoolFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getSchools(filters: SchoolFilters = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {};

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { name: { contains: term } },
      { code: { contains: term } },
      { shortCode: { contains: term } },
      { city: { contains: term } },
      { principalName: { contains: term } },
    ];
  }

  const [schools, total] = await Promise.all([
    db.school.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            users: true,
          },
        },
      },
    }),
    db.school.count({ where }),
  ]);

  // Count Super Admins per school
  const schoolIds = schools.map((s) => s.id);
  const superAdminCounts = await db.user.groupBy({
    by: ['schoolId'],
    where: {
      schoolId: { in: schoolIds },
      role: 'SUPER_ADMIN',
      deletedAt: null,
    },
    _count: { id: true },
  });

  const superAdminMap = new Map(
    superAdminCounts.map((c) => [c.schoolId, c._count.id])
  );

  const formattedSchools = schools.map((s) => ({
    ...s,
    studentCount: s._count.students,
    teacherCount: s._count.teachers,
    staffCount: s._count.users,
    superAdminCount: superAdminMap.get(s.id) || 0,
  }));

  return {
    schools: formattedSchools,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSchoolById(id: string) {
  const db = getPrismaClient();
  const school = await db.school.findUnique({
    where: { id },
    include: {
      schoolSettings: true,
      academicYears: {
        orderBy: { startDate: 'desc' },
      },
      _count: {
        select: {
          students: true,
          teachers: true,
          users: true,
          classes: true,
        },
      },
    },
  });

  if (!school) {
    throw new Error(`School with ID "${id}" not found.`);
  }

  const superAdminCount = await db.user.count({
    where: { schoolId: id, role: 'SUPER_ADMIN', deletedAt: null },
  });

  return {
    ...school,
    studentCount: school._count.students,
    teacherCount: school._count.teachers,
    staffCount: school._count.users,
    classCount: school._count.classes,
    superAdminCount,
  };
}

export async function createSchool(data: Record<string, any>, creatorUserId: string) {
  const db = getPrismaClient();

  const name = (data.name as string)?.trim();
  const code = (data.code as string)?.trim().toUpperCase();
  const shortCode = ((data.shortCode as string)?.trim() || code.substring(0, 4)).toUpperCase();

  if (!name) throw new Error('School Name is required.');
  if (!code) throw new Error('School Code is required.');
  if (!/^[A-Z0-9_-]{2,10}$/.test(code)) {
    throw new Error('School Code must be 2-10 alphanumeric characters (uppercase letters and numbers).');
  }

  const existing = await db.school.findFirst({
    where: { code },
  });
  if (existing) {
    throw new Error(`A school with code "${code}" already exists.`);
  }

  const primaryColor = data.primaryColor || '#2563eb';
  const secondaryColor = data.secondaryColor || '#1e40af';

  const school = await db.school.create({
    data: {
      name,
      shortCode,
      code,
      status: (data.status as string) || 'ACTIVE',
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      board: data.board || 'CBSE',
      affiliationNumber: data.affiliationNumber || null,
      principalName: data.principalName || null,
      logoPath: data.logoPath || null,
      faviconPath: data.faviconPath || null,
      signaturePath: data.signaturePath || null,
      stampPath: data.stampPath || null,
      primaryColor,
      secondaryColor,
      reportHeader: data.reportHeader || null,
      reportFooter: data.reportFooter || null,
      maxStudents: Number(data.maxStudents) || 1000,
      maxStaff: Number(data.maxStaff) || 100,
      licenseExpiresAt: data.licenseExpiresAt ? new Date(data.licenseExpiresAt) : null,
      maintenanceMode: Boolean(data.maintenanceMode),
      maintenanceMessage: data.maintenanceMessage || null,
    },
  });

  // Automatically create a linked default SchoolSetting
  await db.schoolSetting.create({
    data: {
      schoolId: school.id,
      schoolName: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
      website: school.website,
      principalName: school.principalName,
      registrationNumber: school.affiliationNumber,
      receiptFooter: school.reportFooter || 'Thank you for your payment.',
      reportCardFooter: school.reportFooter || 'Best wishes from CK Career Academy.',
      logoPath: school.logoPath,
      currencySymbol: '₹',
      enableRanking: true,
    },
  });

  // Automatically create initial Academic Year (e.g. 2026-2027)
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  await db.academicYear.create({
    data: {
      schoolId: school.id,
      name: `${currentYear}-${nextYear}`,
      startDate: new Date(`${currentYear}-04-01`),
      endDate: new Date(`${nextYear}-03-31`),
      isCurrent: true,
    },
  });

  await createAuditLog(
    creatorUserId,
    'SCHOOL_CREATED',
    'School',
    school.id,
    `Created new school "${school.name}" with code "${school.code}"`,
    school.id
  );

  return school;
}

export async function updateSchool(id: string, data: Record<string, any>, creatorUserId: string) {
  const db = getPrismaClient();

  const target = await db.school.findUnique({ where: { id } });
  if (!target) throw new Error('School not found.');

  const updateData: Record<string, any> = {};

  if (data.name !== undefined) updateData.name = (data.name as string).trim();
  if (data.shortCode !== undefined) updateData.shortCode = (data.shortCode as string).trim().toUpperCase();

  if (data.code !== undefined) {
    const newCode = (data.code as string).trim().toUpperCase();
    if (newCode !== target.code) {
      const codeExists = await db.school.findFirst({ where: { code: newCode } });
      if (codeExists) throw new Error(`School Code "${newCode}" is already in use.`);
      updateData.code = newCode;
    }
  }

  if (data.status !== undefined) updateData.status = data.status;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.pincode !== undefined) updateData.pincode = data.pincode;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.website !== undefined) updateData.website = data.website;
  if (data.board !== undefined) updateData.board = data.board;
  if (data.affiliationNumber !== undefined) updateData.affiliationNumber = data.affiliationNumber;
  if (data.principalName !== undefined) updateData.principalName = data.principalName;
  if (data.logoPath !== undefined) updateData.logoPath = data.logoPath;
  if (data.faviconPath !== undefined) updateData.faviconPath = data.faviconPath;
  if (data.signaturePath !== undefined) updateData.signaturePath = data.signaturePath;
  if (data.stampPath !== undefined) updateData.stampPath = data.stampPath;
  if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
  if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;
  if (data.reportHeader !== undefined) updateData.reportHeader = data.reportHeader;
  if (data.reportFooter !== undefined) updateData.reportFooter = data.reportFooter;
  if (data.maxStudents !== undefined) updateData.maxStudents = Number(data.maxStudents);
  if (data.maxStaff !== undefined) updateData.maxStaff = Number(data.maxStaff);
  if (data.licenseExpiresAt !== undefined) {
    updateData.licenseExpiresAt = data.licenseExpiresAt ? new Date(data.licenseExpiresAt) : null;
  }
  if (data.maintenanceMode !== undefined) updateData.maintenanceMode = Boolean(data.maintenanceMode);
  if (data.maintenanceMessage !== undefined) updateData.maintenanceMessage = data.maintenanceMessage;

  const updatedSchool = await db.school.update({
    where: { id },
    data: updateData,
  });

  // Sync with SchoolSetting
  const existingSetting = await db.schoolSetting.findFirst({ where: { schoolId: id } });
  if (existingSetting) {
    const settingSync: Record<string, any> = {};
    if (updateData.name) settingSync.schoolName = updateData.name;
    if (updateData.address !== undefined) settingSync.address = updateData.address;
    if (updateData.phone !== undefined) settingSync.phone = updateData.phone;
    if (updateData.email !== undefined) settingSync.email = updateData.email;
    if (updateData.website !== undefined) settingSync.website = updateData.website;
    if (updateData.principalName !== undefined) settingSync.principalName = updateData.principalName;
    if (updateData.logoPath !== undefined) settingSync.logoPath = updateData.logoPath;
    if (updateData.reportFooter !== undefined) settingSync.receiptFooter = updateData.reportFooter;

    if (Object.keys(settingSync).length > 0) {
      await db.schoolSetting.update({
        where: { id: existingSetting.id },
        data: settingSync,
      });
    }
  }

  await createAuditLog(
    creatorUserId,
    'SCHOOL_UPDATED',
    'School',
    id,
    `Updated school "${updatedSchool.name}" details and branding`,
    id
  );

  return updatedSchool;
}

export async function suspendSchool(id: string, reason: string | undefined, creatorUserId: string) {
  const db = getPrismaClient();
  const school = await db.school.findUnique({ where: { id } });
  if (!school) throw new Error('School not found.');

  const updated = await db.school.update({
    where: { id },
    data: { status: 'SUSPENDED' },
  });

  // Invalidate active sessions for all users of this school
  const schoolUsers = await db.user.findMany({
    where: { schoolId: id },
    select: { id: true },
  });
  const userIds = schoolUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await db.session.deleteMany({
      where: { userId: { in: userIds } },
    });
  }

  await createAuditLog(
    creatorUserId,
    'SCHOOL_SUSPENDED',
    'School',
    id,
    `Suspended school "${school.name}". Reason: ${reason || 'Administrative action'}`,
    id
  );

  return updated;
}

export async function reactivateSchool(id: string, creatorUserId: string) {
  const db = getPrismaClient();
  const school = await db.school.findUnique({ where: { id } });
  if (!school) throw new Error('School not found.');

  const updated = await db.school.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });

  await createAuditLog(
    creatorUserId,
    'SCHOOL_REACTIVATED',
    'School',
    id,
    `Reactivated school "${school.name}" to ACTIVE status`,
    id
  );

  return updated;
}

export async function archiveSchool(id: string, creatorPassword: string, creatorUserId: string) {
  const db = getPrismaClient();

  // SECURITY RULE: Re-verify Creator password before dangerous action
  const creatorUser = await db.user.findUnique({ where: { id: creatorUserId } });
  if (!creatorUser || creatorUser.role !== 'CREATOR') {
    throw new Error('Unauthorized. Creator credentials required.');
  }

  const validPassword = await verifyPassword(creatorPassword, creatorUser.passwordHash);
  if (!validPassword) {
    throw new Error('Invalid Creator password. Authorization rejected.');
  }

  const school = await db.school.findUnique({ where: { id } });
  if (!school) throw new Error('School not found.');

  if (school.code === 'CKCA01') {
    throw new Error('Default system school CKCA01 cannot be archived.');
  }

  const updated = await db.school.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      deletedAt: new Date(),
    },
  });

  // Invalidate all active sessions for this school
  const schoolUsers = await db.user.findMany({
    where: { schoolId: id },
    select: { id: true },
  });
  const userIds = schoolUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await db.session.deleteMany({
      where: { userId: { in: userIds } },
    });
  }

  await createAuditLog(
    creatorUserId,
    'SCHOOL_ARCHIVED',
    'School',
    id,
    `Archived school "${school.name}" (${school.code})`,
    id
  );

  return updated;
}

export async function uploadSchoolAsset(
  schoolId: string,
  assetType: 'logo' | 'favicon' | 'signature' | 'stamp',
  fileBase64: string,
  filename: string,
  creatorUserId: string
) {
  const db = getPrismaClient();

  const validTypes = ['logo', 'favicon', 'signature', 'stamp'];
  if (!validTypes.includes(assetType)) {
    throw new Error(`Invalid asset type "${assetType}". Allowed: ${validTypes.join(', ')}`);
  }

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error('School not found.');

  // Validate extension
  const ext = path.extname(filename).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'];
  if (!allowedExts.includes(ext)) {
    throw new Error(`Invalid file type "${ext}". Allowed: PNG, JPG, JPEG, WEBP, SVG, ICO`);
  }

  // Parse base64
  let cleanBase64 = fileBase64;
  if (cleanBase64.includes(';base64,')) {
    cleanBase64 = cleanBase64.split(';base64,')[1];
  }
  const buffer = Buffer.from(cleanBase64, 'base64');

  // Max 2MB size limit
  const maxBytes = 2 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size of 2 MB.`);
  }

  const savedPath = await saveFile(buffer, filename, 'branding');

  const updateData: Record<string, string> = {};
  if (assetType === 'logo') {
    updateData.logoPath = savedPath;
    await db.schoolSetting.updateMany({
      where: { schoolId },
      data: { logoPath: savedPath },
    });
  } else if (assetType === 'favicon') {
    updateData.faviconPath = savedPath;
  } else if (assetType === 'signature') {
    updateData.signaturePath = savedPath;
  } else if (assetType === 'stamp') {
    updateData.stampPath = savedPath;
  }

  await db.school.update({
    where: { id: schoolId },
    data: updateData,
  });

  await createAuditLog(
    creatorUserId,
    'SCHOOL_ASSET_UPLOADED',
    'School',
    schoolId,
    `Uploaded ${assetType} (${filename}) for school "${school.name}"`,
    schoolId
  );

  return {
    success: true,
    assetType,
    path: savedPath,
  };
}

export interface SuperAdminFilters {
  schoolId?: string;
  search?: string;
  status?: 'ALL' | 'ACTIVE' | 'LOCKED';
  page?: number;
  limit?: number;
}

export async function getSuperAdmins(filters: SuperAdminFilters = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {
    role: 'SUPER_ADMIN',
    deletedAt: null,
  };

  if (filters.schoolId && filters.schoolId !== 'ALL') {
    where.schoolId = filters.schoolId;
  }

  if (filters.status === 'ACTIVE') {
    where.isActive = true;
    where.isLocked = false;
  } else if (filters.status === 'LOCKED') {
    where.OR = [{ isLocked: true }, { isActive: false }];
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { username: { contains: term } },
      { fullName: { contains: term } },
      { email: { contains: term } },
      { school: { name: { contains: term } } },
      { school: { code: { contains: term } } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        school: {
          select: { id: true, name: true, code: true, status: true },
        },
        _count: {
          select: { sessions: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, action: true, details: true, createdAt: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const safeUsers = users.map(({ passwordHash: _, ...u }) => ({
    ...u,
    activeSessionsCount: u._count.sessions,
    recentActivity: u.auditLogs,
  }));

  return {
    superAdmins: safeUsers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createSuperAdmin(
  data: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    schoolId: string;
    forcePasswordChange?: boolean;
  },
  creatorUserId: string
) {
  const db = getPrismaClient();

  const username = data.username.trim().toLowerCase();
  const email = data.email.trim().toLowerCase();
  const fullName = data.fullName.trim();

  if (!username) throw new Error('Username is required.');
  if (!email) throw new Error('Email is required.');
  if (!fullName) throw new Error('Full Name is required.');
  if (!data.password || data.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const school = await db.school.findUnique({ where: { id: data.schoolId } });
  if (!school) throw new Error('Target school not found.');

  const existingUsername = await db.user.findUnique({ where: { username } });
  if (existingUsername) throw new Error(`Username "${username}" is already taken.`);

  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) throw new Error(`Email "${email}" is already registered.`);

  const passwordHash = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      username,
      email,
      fullName,
      passwordHash,
      role: 'SUPER_ADMIN',
      schoolId: school.id,
      isActive: true,
      isLocked: false,
      forcePasswordChange: Boolean(data.forcePasswordChange),
    },
    include: {
      school: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  await createAuditLog(
    creatorUserId,
    'SUPER_ADMIN_CREATED',
    'User',
    user.id,
    `Created Super Admin "${user.username}" for school "${school.name}" (${school.code})`,
    school.id
  );

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function resetSuperAdminPassword(
  userId: string,
  newPassword: string,
  forceChangeOnNextLogin: boolean,
  creatorUserId: string
) {
  const db = getPrismaClient();

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { school: true },
  });
  if (!user) throw new Error('Super Admin user not found.');

  if (user.role === 'CREATOR' && user.id !== creatorUserId) {
    throw new Error('Creator password cannot be reset through this method.');
  }

  const passwordHash = await hashPassword(newPassword);

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      forcePasswordChange: forceChangeOnNextLogin,
    },
  });

  // Force logout on all active sessions
  await db.session.deleteMany({
    where: { userId },
  });

  await createAuditLog(
    creatorUserId,
    'SUPER_ADMIN_PASSWORD_RESET',
    'User',
    userId,
    `Reset password for Super Admin "${user.username}" (force change: ${forceChangeOnNextLogin})`,
    user.schoolId
  );

  return { success: true };
}

export async function toggleLockSuperAdmin(
  userId: string,
  lock: boolean,
  reason: string | undefined,
  creatorUserId: string
) {
  const db = getPrismaClient();

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { school: true },
  });
  if (!user) throw new Error('User not found.');

  if (user.role === 'CREATOR') {
    throw new Error('Creator accounts cannot be locked.');
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      isLocked: lock,
      isActive: !lock,
      lockReason: lock ? (reason || 'Locked by Creator') : null,
    },
  });

  if (lock) {
    // Force logout on all active sessions immediately
    await db.session.deleteMany({
      where: { userId },
    });
  }

  await createAuditLog(
    creatorUserId,
    lock ? 'SUPER_ADMIN_LOCKED' : 'SUPER_ADMIN_UNLOCKED',
    'User',
    userId,
    `${lock ? 'Locked' : 'Unlocked'} Super Admin "${user.username}". Reason: ${reason || 'N/A'}`,
    user.schoolId
  );

  const { passwordHash: _, ...safeUser } = updated;
  return safeUser;
}

export async function forceLogoutSuperAdmin(userId: string, creatorUserId: string) {
  const db = getPrismaClient();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  const res = await db.session.deleteMany({
    where: { userId },
  });

  await createAuditLog(
    creatorUserId,
    'SUPER_ADMIN_FORCE_LOGOUT',
    'User',
    userId,
    `Forced logout for Super Admin "${user.username}" (${res.count} active sessions terminated)`,
    user.schoolId
  );

  return { success: true, terminatedSessions: res.count };
}

export async function reassignSuperAdminSchool(
  userId: string,
  newSchoolId: string,
  creatorUserId: string
) {
  const db = getPrismaClient();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  if (user.role === 'CREATOR') {
    throw new Error('Creator accounts cannot be assigned to a school.');
  }

  const newSchool = await db.school.findUnique({ where: { id: newSchoolId } });
  if (!newSchool) throw new Error('Target school not found.');

  const updated = await db.user.update({
    where: { id: userId },
    data: { schoolId: newSchool.id },
    include: {
      school: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  // Invalidate current sessions so user reconnects to the new school
  await db.session.deleteMany({
    where: { userId },
  });

  await createAuditLog(
    creatorUserId,
    'SUPER_ADMIN_SCHOOL_REASSIGNED',
    'User',
    userId,
    `Reassigned Super Admin "${user.username}" to school "${newSchool.name}" (${newSchool.code})`,
    newSchool.id
  );

  const { passwordHash: _, ...safeUser } = updated;
  return safeUser;
}

export async function getSuperAdminActivity(userId: string, limit: number = 20) {
  const db = getPrismaClient();
  const logs = await db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return logs;
}
