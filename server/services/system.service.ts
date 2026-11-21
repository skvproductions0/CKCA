import path from 'path';
import fs from 'fs';
import { getDatabasePath, getPrismaClient } from '../database/client';
import { createAuditLog, verifyPassword } from './auth.service';

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  dailyBackupEnabled: boolean;
  dailyBackupTime: string;
  backupRetentionDays: number;
  lastDailyBackupAt: string | null;
}

export interface ActiveSessionRecord {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  schoolId: string | null;
  schoolName: string;
  schoolCode: string;
  device: string;
  ipAddress: string;
  loginTime: string;
  lastActiveAt: string;
  expiresAt: string;
  isIdle: boolean;
}

export interface BackupFileInfo {
  filename: string;
  filePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  isAutomatic: boolean;
}

export interface GlobalAuditFilters {
  schoolId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ==================== SYSTEM CONFIGURATION ====================

export async function getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
  const db = getPrismaClient();
  try {
    const config = await db.systemConfig.findUnique({ where: { key } });
    return config ? config.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  const db = getPrismaClient();
  await db.systemConfig.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: { key, value },
  });
}

export async function isMaintenanceModeActive(): Promise<boolean> {
  const val = await getSystemConfig('maintenance_mode', 'false');
  return val.trim().toLowerCase() === 'true';
}

export async function getMaintenanceMessage(): Promise<string> {
  return getSystemConfig(
    'maintenance_message',
    'The system is currently undergoing scheduled maintenance. Please try again shortly.'
  );
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const [
    mMode,
    mMsg,
    bEnabled,
    bTime,
    bRetention,
    bLast,
  ] = await Promise.all([
    getSystemConfig('maintenance_mode', 'false'),
    getSystemConfig(
      'maintenance_message',
      'The system is currently undergoing scheduled maintenance. Please try again shortly.'
    ),
    getSystemConfig('daily_backup_enabled', 'true'),
    getSystemConfig('daily_backup_time', '02:00'),
    getSystemConfig('backup_retention_days', '30'),
    getSystemConfig('last_daily_backup_at', ''),
  ]);

  return {
    maintenanceMode: mMode.trim().toLowerCase() === 'true',
    maintenanceMessage: mMsg,
    dailyBackupEnabled: bEnabled.trim().toLowerCase() === 'true',
    dailyBackupTime: bTime || '02:00',
    backupRetentionDays: parseInt(bRetention, 10) || 30,
    lastDailyBackupAt: bLast || null,
  };
}

export async function updateSystemSettings(
  data: Partial<SystemSettings>,
  creatorUserId: string
): Promise<SystemSettings> {
  const updates: Array<Promise<void>> = [];

  if (typeof data.maintenanceMode === 'boolean') {
    updates.push(setSystemConfig('maintenance_mode', String(data.maintenanceMode)));
  }
  if (typeof data.maintenanceMessage === 'string') {
    updates.push(setSystemConfig('maintenance_message', data.maintenanceMessage.trim()));
  }
  if (typeof data.dailyBackupEnabled === 'boolean') {
    updates.push(setSystemConfig('daily_backup_enabled', String(data.dailyBackupEnabled)));
  }
  if (typeof data.dailyBackupTime === 'string') {
    updates.push(setSystemConfig('daily_backup_time', data.dailyBackupTime.trim()));
  }
  if (typeof data.backupRetentionDays === 'number') {
    updates.push(setSystemConfig('backup_retention_days', String(data.backupRetentionDays)));
  }

  await Promise.all(updates);

  await createAuditLog(
    creatorUserId,
    'SYSTEM_SETTINGS_UPDATED',
    'SystemConfig',
    undefined,
    `Updated system settings: Maintenance Mode=${data.maintenanceMode}, Daily Backups=${data.dailyBackupEnabled}`
  );

  return getSystemSettings();
}

// ==================== LIVE ACTIVE SESSIONS ====================

export async function getActiveSessions(filters?: {
  schoolId?: string;
  search?: string;
}): Promise<ActiveSessionRecord[]> {
  const db = getPrismaClient();
  const now = new Date();

  const sessions = await db.session.findMany({
    where: {
      expiresAt: { gt: now },
      user: {
        deletedAt: null,
        ...(filters?.schoolId ? { schoolId: filters.schoolId } : {}),
      },
    },
    include: {
      user: {
        include: {
          school: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 mins
  const searchLower = filters?.search?.toLowerCase().trim();

  const records: ActiveSessionRecord[] = [];

  for (const s of sessions) {
    const username = s.user.username;
    const fullName = s.user.fullName;
    const schoolName = s.user.school?.name || (s.user.role === 'CREATOR' ? 'Creator Portal' : 'Unassigned');
    const schoolCode = s.user.school?.code || (s.user.role === 'CREATOR' ? 'ROOT' : '-');

    if (searchLower) {
      const match =
        username.toLowerCase().includes(searchLower) ||
        fullName.toLowerCase().includes(searchLower) ||
        schoolName.toLowerCase().includes(searchLower) ||
        schoolCode.toLowerCase().includes(searchLower) ||
        (s.ipAddress && s.ipAddress.toLowerCase().includes(searchLower)) ||
        (s.device && s.device.toLowerCase().includes(searchLower));

      if (!match) continue;
    }

    const lastActiveTime = s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : new Date(s.createdAt).getTime();
    const isIdle = now.getTime() - lastActiveTime > IDLE_THRESHOLD_MS;

    records.push({
      id: s.id,
      userId: s.userId,
      username,
      fullName,
      role: s.user.role,
      schoolId: s.user.schoolId,
      schoolName,
      schoolCode,
      device: s.device || 'Desktop Client (Windows)',
      ipAddress: s.ipAddress || '127.0.0.1',
      loginTime: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt ? s.lastActiveAt.toISOString() : s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isIdle,
    });
  }

  return records;
}

export async function touchSessionActivity(token: string): Promise<void> {
  const db = getPrismaClient();
  try {
    await db.session.update({
      where: { token },
      data: { lastActiveAt: new Date() },
    });
  } catch {
    // Non-blocking
  }
}

export async function forceLogoutSession(
  sessionId: string,
  creatorUserId: string
): Promise<{ success: boolean }> {
  const db = getPrismaClient();

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    throw new Error('Session not found or already terminated.');
  }

  await db.session.delete({ where: { id: sessionId } });

  await createAuditLog(
    creatorUserId,
    'USER_FORCE_LOGOUT',
    'Session',
    sessionId,
    `Force terminated active session for user "${session.user.username}"`,
    session.user.schoolId
  );

  return { success: true };
}

export async function forceLogoutUser(
  userId: string,
  creatorUserId: string
): Promise<{ success: boolean; count: number }> {
  const db = getPrismaClient();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  const res = await db.session.deleteMany({
    where: { userId },
  });

  await createAuditLog(
    creatorUserId,
    'USER_FORCE_LOGOUT',
    'User',
    userId,
    `Force logged out all sessions (${res.count}) for user "${user.username}"`,
    user.schoolId
  );

  return { success: true, count: res.count };
}

export async function forceLogoutSchool(
  schoolId: string,
  creatorUserId: string
): Promise<{ success: boolean; count: number }> {
  const db = getPrismaClient();

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error('School not found.');

  const users = await db.user.findMany({
    where: { schoolId },
    select: { id: true },
  });

  const userIds = users.map((u) => u.id);
  let count = 0;

  if (userIds.length > 0) {
    const res = await db.session.deleteMany({
      where: { userId: { in: userIds } },
    });
    count = res.count;
  }

  await createAuditLog(
    creatorUserId,
    'SCHOOL_FORCE_LOGOUT',
    'School',
    schoolId,
    `Force logged out all active sessions (${count}) across school "${school.name}" (${school.code})`,
    schoolId
  );

  return { success: true, count };
}

// ==================== GLOBAL AUDIT LOGS ====================

export async function getGlobalAuditLogs(filters: GlobalAuditFilters = {}): Promise<{
  logs: Array<{
    id: string;
    action: string;
    entity?: string | null;
    entityId?: string | null;
    details?: string | null;
    createdAt: string;
    schoolName: string;
    schoolCode: string;
    username: string;
    fullName: string;
    role: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> {
  const db = getPrismaClient();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(200, Math.max(1, filters.limit || 50));
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {};

  if (filters.schoolId && filters.schoolId !== 'ALL') {
    where.schoolId = filters.schoolId;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.action && filters.action !== 'ALL') {
    where.action = filters.action;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { details: { contains: term } },
      { action: { contains: term } },
      { entity: { contains: term } },
      { user: { username: { contains: term } } },
      { user: { fullName: { contains: term } } },
    ];
  }

  const [total, rawLogs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        school: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, username: true, fullName: true, role: true } },
      },
    }),
  ]);

  const logs = rawLogs.map((l) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    details: l.details,
    createdAt: l.createdAt.toISOString(),
    schoolName: l.school?.name || (l.user?.role === 'CREATOR' ? 'Creator Portal' : 'Global'),
    schoolCode: l.school?.code || (l.user?.role === 'CREATOR' ? 'ROOT' : '-'),
    username: l.user?.username || 'System',
    fullName: l.user?.fullName || 'System Automated',
    role: l.user?.role || 'SYSTEM',
  }));

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// ==================== DATABASE BACKUP & RESTORE ====================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getBackupsDirectory(): string {
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  const dir = getBackupsDirectory();
  const files = fs.readdirSync(dir);

  const backupFiles: BackupFileInfo[] = [];

  for (const file of files) {
    if (!file.endsWith('.db')) continue;
    const fullPath = path.join(dir, file);
    try {
      const stats = fs.statSync(fullPath);
      backupFiles.push({
        filename: file,
        filePath: fullPath,
        sizeBytes: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: stats.mtime.toISOString(),
        isAutomatic: file.includes('scheduled') || file.includes('auto'),
      });
    } catch {
      // Ignore unreadable file
    }
  }

  // Sort descending by modified date
  return backupFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createCreatorBackup(
  label: string = 'manual',
  creatorUserId?: string
): Promise<{ backupPath: string; filename: string; sizeBytes: number; sizeFormatted: string }> {
  const dbPath = getDatabasePath();
  const backupDir = getBackupsDirectory();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `backup-${safeLabel}-${timestamp}.db`;
  const backupPath = path.join(backupDir, filename);

  fs.copyFileSync(dbPath, backupPath);
  const stats = fs.statSync(backupPath);

  if (creatorUserId) {
    await createAuditLog(
      creatorUserId,
      'BACKUP_CREATED',
      'Database',
      undefined,
      `Created database backup "${filename}" (${formatBytes(stats.size)})`
    );
  }

  return {
    backupPath,
    filename,
    sizeBytes: stats.size,
    sizeFormatted: formatBytes(stats.size),
  };
}

export async function restoreCreatorBackup(
  backupPath: string,
  creatorPassword: string,
  creatorUserId: string
): Promise<{ success: boolean; message: string; safetyBackupPath: string }> {
  const db = getPrismaClient();

  // SECURITY RULE 8: Re-verify Creator password before dangerous restore action
  const creatorUser = await db.user.findUnique({ where: { id: creatorUserId } });
  if (!creatorUser || creatorUser.role !== 'CREATOR') {
    throw new Error('Unauthorized. Creator root credentials required.');
  }

  const validPassword = await verifyPassword(creatorPassword, creatorUser.passwordHash);
  if (!validPassword) {
    throw new Error('Invalid Creator password. Authorization rejected.');
  }

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file does not exist on disk: ${backupPath}`);
  }

  const dbPath = getDatabasePath();

  // 1. Create an emergency safety backup snapshot of current state before overwrite
  const safetyBackup = await createCreatorBackup('pre-restore-safety', creatorUserId);

  // 2. Overwrite database with target backup
  fs.copyFileSync(backupPath, dbPath);

  // 3. Log restore operation
  await createAuditLog(
    creatorUserId,
    'DATABASE_RESTORED',
    'Database',
    undefined,
    `Database restored from "${path.basename(backupPath)}". Emergency safety snapshot saved at "${safetyBackup.filename}".`
  );

  return {
    success: true,
    message: `Database successfully restored from ${path.basename(backupPath)}.`,
    safetyBackupPath: safetyBackup.backupPath,
  };
}

export async function checkAndRunScheduledDailyBackup(): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    if (!settings.dailyBackupEnabled) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    if (settings.lastDailyBackupAt === todayStr) {
      return false; // Already ran today
    }

    // Run scheduled backup
    await createCreatorBackup('scheduled-daily');
    await setSystemConfig('last_daily_backup_at', todayStr);

    // Retention cleanup
    if (settings.backupRetentionDays > 0) {
      const allBackups = await listBackups();
      const cutoff = Date.now() - settings.backupRetentionDays * 24 * 60 * 60 * 1000;
      for (const b of allBackups) {
        if (b.isAutomatic && new Date(b.createdAt).getTime() < cutoff) {
          try {
            fs.unlinkSync(b.filePath);
          } catch {
            // Ignore
          }
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Scheduled backup error:', err);
    return false;
  }
}

// ==================== ENHANCED CREATOR STATS ====================

export async function getEnhancedCreatorStats() {
  const db = getPrismaClient();
  const now = new Date();

  const [
    totalSchools,
    activeSchools,
    suspendedSchools,
    archivedSchools,
    totalUsers,
    totalStudents,
    activeSessionsCount,
    allSchools,
    recentAuditLogs,
    systemSettings,
  ] = await Promise.all([
    db.school.count({ where: { deletedAt: null } }),
    db.school.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    db.school.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
    db.school.count({ where: { status: 'ARCHIVED' } }),
    db.user.count({ where: { deletedAt: null, role: { not: 'CREATOR' } } }),
    db.student.count({ where: { deletedAt: null } }),
    db.session.count({ where: { expiresAt: { gt: now } } }),
    db.school.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        plan: true,
        licenseExpiresAt: true,
        _count: {
          select: { students: true, users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        school: { select: { name: true, code: true } },
        user: { select: { username: true, fullName: true, role: true } },
      },
    }),
    getSystemSettings(),
  ]);

  // Find schools expiring within 30 days
  const expiringSchools = allSchools
    .filter((s) => s.licenseExpiresAt !== null)
    .map((s) => {
      const exp = new Date(s.licenseExpiresAt!);
      const msRemaining = exp.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        status: s.status,
        plan: s.plan || 'CUSTOM',
        licenseExpiresAt: exp.toISOString(),
        daysRemaining,
        isExpired: daysRemaining < 0,
      };
    })
    .filter((s) => s.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    totalSchools,
    activeSchools,
    suspendedSchools,
    archivedSchools,
    totalUsers,
    totalStudents,
    activeSessionsCount,
    expiringSchools,
    maintenanceMode: systemSettings.maintenanceMode,
    maintenanceMessage: systemSettings.maintenanceMessage,
    schools: allSchools.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      status: s.status,
      plan: s.plan || 'CUSTOM',
      studentCount: s._count.students,
      staffCount: s._count.users,
    })),
    recentActivity: recentAuditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
      schoolName: l.school?.name || (l.user?.role === 'CREATOR' ? 'Creator Console' : 'Global'),
      schoolCode: l.school?.code || '-',
      username: l.user?.username || 'System',
      fullName: l.user?.fullName || 'System',
      role: l.user?.role || 'SYSTEM',
    })),
  };
}
