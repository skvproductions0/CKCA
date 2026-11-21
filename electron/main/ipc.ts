import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { login, logout, validateSession, createUser, hasPermission } from '../../server/services/auth.service';
import { getDashboardStats } from '../../server/services/dashboard.service';
import * as studentService from '../../server/services/student.service';
import * as feeService from '../../server/services/fee.service';
import * as attendanceService from '../../server/services/attendance.service';
import * as academicService from '../../server/services/academic.service';
import * as settingsService from '../../server/services/settings.service';
import * as fileService from '../../server/services/file.service';
import * as creatorService from '../../server/services/creator.service';
import * as featureService from '../../server/services/feature.service';
import * as sessionService from '../../server/services/session.service';
import * as systemService from '../../server/services/system.service';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

interface SessionData {
  token: string;
  userId: string;
  role: string;
  schoolId?: string | null;
  impersonatedSchoolId?: string | null;
}

const sessions = new Map<number, SessionData>();

function getSession(event: IpcMainInvokeEvent): SessionData | undefined {
  return sessions.get(event.sender.id);
}

function getEffectiveSchoolId(event: IpcMainInvokeEvent): string | undefined {
  const session = getSession(event);
  if (!session) return undefined;
  if (session.role === 'CREATOR') {
    return session.impersonatedSchoolId || undefined;
  }
  return session.schoolId || undefined;
}

function requireAuth(event: IpcMainInvokeEvent, permission?: string) {
  const session = getSession(event);
  if (!session) throw new Error('Not authenticated. Please login.');
  if (permission && !hasPermission(session.role, permission)) {
    throw new Error('You do not have permission to perform this action.');
  }
  return session;
}

function requireCreator(event: IpcMainInvokeEvent) {
  const session = requireAuth(event);
  if (session.role !== 'CREATOR') {
    throw new Error('Access denied. Creator role required.');
  }
  return session;
}

function handle(channel: string, handler: IpcHandler, permission?: string) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (channel !== 'auth:login' && channel !== 'auth:validate') {
        const session = requireAuth(event, permission);
        const mappedFeature = featureService.CHANNEL_FEATURE_MAP[channel];
        if (mappedFeature && session.role !== 'CREATOR') {
          const effectiveSchoolId = getEffectiveSchoolId(event);
          if (effectiveSchoolId) {
            await featureService.assertFeatureEnabled(effectiveSchoolId, mappedFeature);
          }
        }
      }
      const result = await handler(event, ...args);
      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      return { success: false, error: message };
    }
  });
}

export function registerIpcHandlers(): void {
  // Auth
  handle('auth:login', async (event, username: unknown, password: unknown, schoolCode?: unknown) => {
    const result = await login(username as string, password as string, schoolCode as string | undefined);
    sessions.set(event.sender.id, {
      token: result.token,
      userId: result.user.id,
      role: result.user.role,
      schoolId: result.user.schoolId || (result as any).school?.id || null,
      impersonatedSchoolId: null,
    });
    return result;
  });

  handle('auth:logout', async (event) => {
    const session = getSession(event);
    if (session) {
      await logout(session.token);
      sessions.delete(event.sender.id);
    }
    return true;
  });

  handle('auth:validate', async (event, token: unknown) => {
    const user = await validateSession(token as string);
    if (user) {
      const existing = sessions.get(event.sender.id);
      sessions.set(event.sender.id, {
        token: token as string,
        userId: user.id,
        role: user.role,
        schoolId: user.schoolId || null,
        impersonatedSchoolId: existing?.impersonatedSchoolId || null,
      });
    } else {
      sessions.delete(event.sender.id);
    }
    return user;
  });

  handle('auth:createUser', async (event, data: unknown) => {
    const session = requireAuth(event, '*');
    const effectiveSchoolId = getEffectiveSchoolId(event);
    const schoolId = session.role === 'CREATOR' ? ((data as any)?.schoolId || effectiveSchoolId) : effectiveSchoolId;
    const payload = { ...(data as object), schoolId };
    return createUser(payload as Parameters<typeof createUser>[0]);
  });

  // Creator
  handle('creator:enterSchool', async (event, schoolId: unknown) => {
    const session = requireCreator(event);
    const targetId = (schoolId as string) || 'default';
    const result = await creatorService.enterSchool(session.userId, targetId);
    session.impersonatedSchoolId = result.schoolId;
    return result;
  });

  handle('creator:exitSchool', async (event) => {
    const session = requireCreator(event);
    const result = await creatorService.exitSchool(session.userId, session.impersonatedSchoolId);
    session.impersonatedSchoolId = null;
    return result;
  });

  handle('creator:getSessionState', async (event) => {
    const session = getSession(event);
    if (!session) return { role: null, impersonatedSchoolId: null };
    return {
      role: session.role,
      impersonatedSchoolId: session.impersonatedSchoolId || null,
    };
  });

  handle('creator:stats', async (event) => {
    requireCreator(event);
    return creatorService.getCreatorDashboardStats();
  });

  handle('creator:schools:list', async (event, filters?: unknown) => {
    requireCreator(event);
    return creatorService.getSchools(filters as Parameters<typeof creatorService.getSchools>[0]);
  });

  handle('creator:schools:get', async (event, id: unknown) => {
    requireCreator(event);
    return creatorService.getSchoolById(id as string);
  });

  handle('creator:schools:create', async (event, data: unknown) => {
    const session = requireCreator(event);
    return creatorService.createSchool(data as Record<string, any>, session.userId);
  });

  handle('creator:schools:update', async (event, id: unknown, data: unknown) => {
    const session = requireCreator(event);
    return creatorService.updateSchool(id as string, data as Record<string, any>, session.userId);
  });

  handle('creator:schools:suspend', async (event, id: unknown, reason?: unknown) => {
    const session = requireCreator(event);
    return creatorService.suspendSchool(id as string, reason as string | undefined, session.userId);
  });

  handle('creator:schools:reactivate', async (event, id: unknown) => {
    const session = requireCreator(event);
    return creatorService.reactivateSchool(id as string, session.userId);
  });

  handle('creator:schools:archive', async (event, id: unknown, password: unknown) => {
    const session = requireCreator(event);
    return creatorService.archiveSchool(id as string, password as string, session.userId);
  });

  handle('creator:schools:uploadAsset', async (event, schoolId: unknown, assetType: unknown, fileBase64: unknown, filename: unknown) => {
    const session = requireCreator(event);
    return creatorService.uploadSchoolAsset(
      schoolId as string,
      assetType as 'logo' | 'favicon' | 'signature' | 'stamp',
      fileBase64 as string,
      filename as string,
      session.userId
    );
  });

  // Super Admins Management
  handle('creator:superAdmins:list', async (event, filters?: unknown) => {
    requireCreator(event);
    return creatorService.getSuperAdmins(filters as Parameters<typeof creatorService.getSuperAdmins>[0]);
  });

  handle('creator:superAdmins:create', async (event, data: unknown) => {
    const session = requireCreator(event);
    return creatorService.createSuperAdmin(data as Parameters<typeof creatorService.createSuperAdmin>[0], session.userId);
  });

  handle('creator:superAdmins:resetPassword', async (event, userId: unknown, newPassword: unknown, forceChange: unknown) => {
    const session = requireCreator(event);
    return creatorService.resetSuperAdminPassword(userId as string, newPassword as string, Boolean(forceChange), session.userId);
  });

  handle('creator:superAdmins:toggleLock', async (event, userId: unknown, lock: unknown, reason?: unknown) => {
    const session = requireCreator(event);
    return creatorService.toggleLockSuperAdmin(userId as string, Boolean(lock), reason as string | undefined, session.userId);
  });

  handle('creator:superAdmins:forceLogout', async (event, userId: unknown) => {
    const session = requireCreator(event);
    return creatorService.forceLogoutSuperAdmin(userId as string, session.userId);
  });

  handle('creator:superAdmins:reassignSchool', async (event, userId: unknown, newSchoolId: unknown) => {
    const session = requireCreator(event);
    return creatorService.reassignSuperAdminSchool(userId as string, newSchoolId as string, session.userId);
  });

  handle('creator:superAdmins:activity', async (event, userId: unknown, limit?: unknown) => {
    requireCreator(event);
    return creatorService.getSuperAdminActivity(userId as string, limit as number | undefined);
  });

  // Feature Toggles & Plans Management
  handle('creator:features:get', async (event, schoolId: unknown) => {
    requireCreator(event);
    return featureService.getEffectiveSchoolFeatures(schoolId as string);
  });

  handle('creator:features:toggle', async (event, schoolId: unknown, featureId: unknown, isEnabled: unknown) => {
    const session = requireCreator(event);
    return featureService.updateSchoolFeature(
      schoolId as string,
      featureId as string,
      Boolean(isEnabled),
      session.userId
    );
  });

  handle('creator:features:applyPlan', async (event, schoolId: unknown, planId: unknown, updateLimits: unknown) => {
    const session = requireCreator(event);
    return featureService.applyPlanPreset(
      schoolId as string,
      planId as any,
      Boolean(updateLimits),
      session.userId
    );
  });

  handle('creator:features:updateLimits', async (event, schoolId: unknown, limits: unknown) => {
    const session = requireCreator(event);
    return featureService.updateSchoolLimits(schoolId as string, limits as any, session.userId);
  });

  handle('creator:features:registry', async (event) => {
    requireCreator(event);
    return featureService.getFeatureRegistry();
  });

  handle('creator:features:presets', async (event) => {
    requireCreator(event);
    return featureService.getPlanPresets();
  });

  // Creator Academic Sessions Management
  handle('creator:sessions:list', async (event, schoolId: unknown) => {
    requireCreator(event);
    return sessionService.getSessionsWithStats(schoolId as string);
  });

  handle('creator:sessions:create', async (event, schoolId: unknown, data: unknown) => {
    const session = requireCreator(event);
    return sessionService.createAcademicSession(
      { ...(data as any), schoolId: schoolId as string },
      session.userId,
      schoolId as string
    );
  });

  handle('creator:sessions:setActive', async (event, id: unknown, schoolId: unknown) => {
    const session = requireCreator(event);
    return sessionService.setActiveAcademicSession(id as string, session.userId, schoolId as string);
  });

  handle('creator:sessions:rollover:preview', async (event, sourceId: unknown, targetId: unknown, schoolId: unknown) => {
    requireCreator(event);
    return sessionService.previewSessionRollover(sourceId as string, targetId as string, schoolId as string);
  });

  handle('creator:sessions:rollover:execute', async (event, options: unknown, schoolId: unknown) => {
    const session = requireCreator(event);
    return sessionService.executeSessionRollover(options as any, session.userId, schoolId as string);
  });

  // System Control Centre: Settings & Maintenance
  handle('creator:system:settings:get', async (event) => {
    requireCreator(event);
    return systemService.getSystemSettings();
  });

  handle('creator:system:settings:update', async (event, data: unknown) => {
    const session = requireCreator(event);
    return systemService.updateSystemSettings(data as Partial<systemService.SystemSettings>, session.userId);
  });

  // System Control Centre: Live Active Users
  handle('creator:activeUsers:list', async (event, filters?: unknown) => {
    requireCreator(event);
    return systemService.getActiveSessions(filters as { schoolId?: string; search?: string });
  });

  handle('creator:activeUsers:forceLogoutSession', async (event, sessionId: unknown) => {
    const session = requireCreator(event);
    return systemService.forceLogoutSession(sessionId as string, session.userId);
  });

  handle('creator:activeUsers:forceLogoutUser', async (event, userId: unknown) => {
    const session = requireCreator(event);
    return systemService.forceLogoutUser(userId as string, session.userId);
  });

  handle('creator:activeUsers:forceLogoutSchool', async (event, schoolId: unknown) => {
    const session = requireCreator(event);
    return systemService.forceLogoutSchool(schoolId as string, session.userId);
  });

  // System Control Centre: Global Audit Logs
  handle('creator:audit:list', async (event, filters?: unknown) => {
    requireCreator(event);
    return systemService.getGlobalAuditLogs(filters as systemService.GlobalAuditFilters);
  });

  // System Control Centre: Database Backup & Restore
  handle('creator:backup:list', async (event) => {
    requireCreator(event);
    return systemService.listBackups();
  });

  handle('creator:backup:create', async (event, label?: unknown) => {
    const session = requireCreator(event);
    return systemService.createCreatorBackup((label as string) || 'manual', session.userId);
  });

  handle('creator:backup:restore', async (event, backupPath: unknown, creatorPassword: unknown) => {
    const session = requireCreator(event);
    return systemService.restoreCreatorBackup(backupPath as string, creatorPassword as string, session.userId);
  });

  // Enhanced Creator Dashboard Stats
  handle('creator:stats:enhanced', async (event) => {
    requireCreator(event);
    return systemService.getEnhancedCreatorStats();
  });

  // Dashboard
  handle('dashboard:stats', async (event, academicYearId?: unknown) => {
    return getDashboardStats(academicYearId as string | undefined, getEffectiveSchoolId(event));
  });

  // Students
  handle('students:list', async (event, filters?: unknown) =>
    studentService.getStudents(filters as Parameters<typeof studentService.getStudents>[0], getEffectiveSchoolId(event)), 'students');
  handle('students:get', async (event, id: unknown) =>
    studentService.getStudentById(id as string, getEffectiveSchoolId(event)), 'students.view');
  handle('students:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.createStudent(data as Parameters<typeof studentService.createStudent>[0], session.userId, getEffectiveSchoolId(event));
  });
  handle('students:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.updateStudent(id as string, data as Parameters<typeof studentService.updateStudent>[1], session.userId, getEffectiveSchoolId(event));
  });
  handle('students:archive', async (event, id: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.archiveStudent(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('students:listDeleted', async (event, filters?: unknown) => {
    return studentService.getDeletedStudents(filters as Parameters<typeof studentService.getDeletedStudents>[0], getEffectiveSchoolId(event));
  }, 'students');
  handle('students:restore', async (event, id: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.restoreStudent(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('students:permanentDelete', async (event, id: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.permanentDeleteStudent(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('students:emptyRecycleBin', async (event) => {
    const session = requireAuth(event, 'students');
    return studentService.emptyRecycleBin(session.userId, getEffectiveSchoolId(event));
  });
  handle('students:attendance', async (event, id: unknown, yearId?: unknown) =>
    studentService.getStudentAttendanceSummary(id as string, yearId as string | undefined, getEffectiveSchoolId(event)), 'students.view');

  // Classes & Academic
  handle('classes:list', async (event) => academicService.getClasses(getEffectiveSchoolId(event)), 'classes');
  handle('classes:create', async (event, name: unknown, order: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.createClass(name as string, order as number, session.userId, getEffectiveSchoolId(event));
  });
  handle('classes:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.updateClass(id as string, data as Parameters<typeof academicService.updateClass>[1], session.userId, getEffectiveSchoolId(event));
  });
  handle('classes:delete', async (event, id: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.deleteClass(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('sections:create', async (event, classId: unknown, name: unknown, teacherId?: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.createSection(classId as string, name as string, teacherId as string | undefined, session.userId, getEffectiveSchoolId(event));
  });
  handle('sections:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.updateSection(id as string, data as Parameters<typeof academicService.updateSection>[1], session.userId, getEffectiveSchoolId(event));
  });
  handle('sections:delete', async (event, id: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.deleteSection(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('academicYears:list', async (event) => academicService.getAcademicYears(getEffectiveSchoolId(event)));
  handle('academicYears:listWithStats', async (event) => sessionService.getSessionsWithStats(getEffectiveSchoolId(event)));
  handle('academicYears:current', async (event) => academicService.getCurrentAcademicYear(getEffectiveSchoolId(event)));
  handle('academicYears:setCurrent', async (event, id: unknown) => {
    const session = requireAuth(event);
    return sessionService.setActiveAcademicSession(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('academicYears:create', async (event, data: unknown) => {
    const session = requireAuth(event);
    return sessionService.createAcademicSession(data as any, session.userId, getEffectiveSchoolId(event));
  });
  handle('academicYears:rollover:preview', async (event, sourceId: unknown, targetId: unknown) => {
    requireAuth(event);
    return sessionService.previewSessionRollover(sourceId as string, targetId as string, getEffectiveSchoolId(event));
  });
  handle('academicYears:rollover:execute', async (event, options: unknown) => {
    const session = requireAuth(event);
    return sessionService.executeSessionRollover(options as any, session.userId, getEffectiveSchoolId(event));
  });

  // Teachers
  handle('teachers:list', async (event, filters?: unknown) =>
    academicService.getTeachers(filters as Parameters<typeof academicService.getTeachers>[0], getEffectiveSchoolId(event)), 'teachers');
  handle('teachers:listDeleted', async (event, filters?: unknown) =>
    academicService.getDeletedTeachers(filters as Parameters<typeof academicService.getDeletedTeachers>[0], getEffectiveSchoolId(event)), 'teachers');
  handle('teachers:get', async (event, id: unknown) =>
    academicService.getTeacherById(id as string, getEffectiveSchoolId(event)), 'teachers');
  handle('teachers:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.createTeacher(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('teachers:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.updateTeacher(id as string, data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('teachers:delete', async (event, id: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.archiveTeacher(id as string, session.userId);
  });
  handle('teachers:archive', async (event, id: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.archiveTeacher(id as string, session.userId);
  });
  handle('teachers:restore', async (event, id: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.restoreTeacher(id as string, session.userId);
  });
  handle('teachers:permanentDelete', async (event, id: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.permanentDeleteTeacher(id as string, session.userId);
  });
  handle('teachers:emptyRecycleBin', async (event) => {
    const session = requireAuth(event, 'teachers');
    return academicService.emptyTeacherRecycleBin(session.userId);
  });

  // Subjects
  handle('subjects:list', async (event, classId?: unknown) =>
    academicService.getSubjects(classId as string | undefined, getEffectiveSchoolId(event)), 'subjects');
  handle('subjects:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'subjects');
    return academicService.createSubject(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('subjects:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'subjects');
    return academicService.updateSubject(id as string, data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('subjects:delete', async (event, id: unknown) => {
    const session = requireAuth(event, 'subjects');
    return academicService.deleteSubject(id as string, session.userId);
  });

  // Exams & Results
  handle('exams:list', async (event, yearId?: unknown, classId?: unknown) =>
    academicService.getExams(yearId as string | undefined, classId as string | undefined, getEffectiveSchoolId(event)), 'exams');
  handle('exams:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'exams');
    return academicService.createExam(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('results:entry', async (event, examId: unknown, subjectId: unknown, sectionId?: unknown) =>
    academicService.getResultsForEntry(examId as string, subjectId as string, sectionId as string | undefined, getEffectiveSchoolId(event)), 'results');
  handle('results:save', async (event, data: unknown) => {
    const session = requireAuth(event, 'results');
    return academicService.saveResults(data as Parameters<typeof academicService.saveResults>[0], session.userId, getEffectiveSchoolId(event));
  });
  handle('results:student', async (event, studentId: unknown, examId?: unknown) =>
    academicService.getStudentResults(studentId as string, examId as string | undefined, getEffectiveSchoolId(event)), 'results');
  handle('results:rankings', async (event, examId: unknown, sectionId?: unknown) =>
    academicService.getClassRankings(examId as string, sectionId as string | undefined, getEffectiveSchoolId(event)), 'results');
  handle('grading:list', async (event) => academicService.getGradingRules(getEffectiveSchoolId(event)));
  handle('grading:update', async (event, rules: unknown) => {
    const session = requireAuth(event, '*');
    return academicService.updateGradingRules(rules as Parameters<typeof academicService.updateGradingRules>[0], session.userId, getEffectiveSchoolId(event));
  });

  // Fees
  handle('fees:categories', async (event) => feeService.getFeeCategories(getEffectiveSchoolId(event)), 'fees');
  handle('fees:structures', async (event, yearId?: unknown) =>
    feeService.getFeeStructures(yearId as string | undefined, getEffectiveSchoolId(event)), 'fees');
  handle('fees:structures:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'fees');
    return feeService.createFeeStructure(data as Parameters<typeof feeService.createFeeStructure>[0], session.userId, getEffectiveSchoolId(event));
  });
  handle('fees:student', async (event, studentId: unknown, yearId?: unknown) =>
    feeService.getStudentFees(studentId as string, yearId as string | undefined, getEffectiveSchoolId(event)), 'fees');
  handle('fees:payment', async (event, data: unknown) => {
    const session = requireAuth(event, 'payments');
    return feeService.recordPayment({ ...(data as object), collectedById: session.userId } as Parameters<typeof feeService.recordPayment>[0], getEffectiveSchoolId(event));
  });
  handle('fees:payments', async (event, filters?: unknown) =>
    feeService.getPayments(filters as Parameters<typeof feeService.getPayments>[0], getEffectiveSchoolId(event)), 'payments');
  handle('fees:payment:get', async (event, id: unknown) =>
    feeService.getPaymentById(id as string, getEffectiveSchoolId(event)), 'payments');
  handle('fees:payment:cancel', async (event, id: unknown) => {
    const session = requireAuth(event, 'payments');
    return feeService.cancelPayment(id as string, session.userId, getEffectiveSchoolId(event));
  });
  handle('fees:reports', async (event, type: unknown, yearId?: unknown) =>
    feeService.getFeeReports(type as string, yearId as string | undefined, getEffectiveSchoolId(event)), 'reports.fees');

  // Attendance
  handle('attendance:get', async (event, sectionId: unknown, date: unknown, yearId: unknown) =>
    attendanceService.getAttendanceForClass(sectionId as string, new Date(date as string), yearId as string, getEffectiveSchoolId(event)), 'attendance');
  handle('attendance:save', async (event, data: unknown) => {
    const session = requireAuth(event, 'attendance');
    return attendanceService.saveAttendance(data as Parameters<typeof attendanceService.saveAttendance>[0], session.userId, getEffectiveSchoolId(event));
  });
  handle('attendance:report', async (event, type: unknown, filters?: unknown) =>
    attendanceService.getAttendanceReport(type as string, filters as Parameters<typeof attendanceService.getAttendanceReport>[1], getEffectiveSchoolId(event)), 'attendance');
  handle('attendance:daily', async (event, date: unknown, yearId?: unknown) =>
    attendanceService.getDailyAttendance(new Date(date as string), yearId as string | undefined, getEffectiveSchoolId(event)), 'attendance');

  // Admissions
  handle('admissions:list', async (event, filters?: unknown) =>
    settingsService.getAdmissions(filters as Parameters<typeof settingsService.getAdmissions>[0], getEffectiveSchoolId(event)), 'admissions');
  handle('admissions:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.createAdmission(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('admissions:wizard', async (event, data: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.createAdmissionWizard(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('admissions:draft', async (event, data: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.saveAdmissionDraft(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('admissions:approve', async (event, id: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.approveAdmission(id as string, session.userId, getEffectiveSchoolId(event));
  });

  // Settings
  handle('settings:school', async (event) => settingsService.getSchoolSettings(getEffectiveSchoolId(event)));
  handle('settings:school:update', async (event, data: unknown) => {
    const session = requireAuth(event, '*');
    return settingsService.updateSchoolSettings(data as Record<string, unknown>, session.userId, getEffectiveSchoolId(event));
  });
  handle('settings:users', async (event) => {
    requireAuth(event, '*');
    return settingsService.getUsers(getEffectiveSchoolId(event));
  });
  handle('settings:users:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, '*');
    return settingsService.updateUser(
      id as string,
      data as Record<string, unknown>,
      session.userId,
      getEffectiveSchoolId(event)
    );
  });
  handle('audit:list', async (event, filters?: unknown) => {
    requireAuth(event, '*');
    return settingsService.getAuditLogs(filters as Parameters<typeof settingsService.getAuditLogs>[0], getEffectiveSchoolId(event));
  });

  // Notifications
  handle('notifications:list', async (event) => {
    const session = getSession(event);
    return settingsService.getNotifications(session?.userId, getEffectiveSchoolId(event));
  });
  handle('notifications:read', async (_event, id: unknown) => settingsService.markNotificationRead(id as string));

  // Backup & Files
  handle('backup:create', async (event, customPath?: unknown) => {
    requireAuth(event, '*');
    return fileService.createBackup(customPath as string | undefined);
  });
  handle('backup:restore', async (event, path: unknown) => {
    requireAuth(event, '*');
    await fileService.restoreBackup(path as string);
    return true;
  });
  handle('backup:select', async (event) => {
    requireAuth(event, '*');
    return fileService.selectBackupFile();
  });
  handle('backup:selectLocation', async (event) => {
    requireAuth(event, '*');
    return fileService.selectBackupLocation();
  });
  handle('files:save', async (_event, buffer: unknown, filename: unknown, subfolder: unknown) =>
    fileService.saveFile(Buffer.from(buffer as ArrayBuffer), filename as string, subfolder as string));
  handle('files:select', async (_event, filters?: unknown) =>
    fileService.selectFile(filters as Parameters<typeof fileService.selectFile>[0]));
  handle('files:copyToUploads', async (_event, srcPath: unknown, subfolder: unknown) =>
    fileService.copyFileToUploads(srcPath as string, (subfolder as string) || 'documents'));
  handle('files:getUploadsPath', async () => fileService.getUploadsPath());
  handle('files:open', async (_event, filePath: unknown) =>
    fileService.openFile(filePath as string));
  handle('files:readDataUrl', async (_event, filePath: unknown) =>
    fileService.readFileAsDataUrl(filePath as string));
}

export function cleanupSession(webContentsId: number): void {
  sessions.delete(webContentsId);
}
