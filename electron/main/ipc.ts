import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { login, logout, validateSession, createUser, hasPermission } from '../../server/services/auth.service';
import { getDashboardStats } from '../../server/services/dashboard.service';
import * as studentService from '../../server/services/student.service';
import * as feeService from '../../server/services/fee.service';
import * as attendanceService from '../../server/services/attendance.service';
import * as academicService from '../../server/services/academic.service';
import * as settingsService from '../../server/services/settings.service';
import * as fileService from '../../server/services/file.service';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const sessions = new Map<number, { token: string; userId: string; role: string }>();

function getSession(event: IpcMainInvokeEvent) {
  return sessions.get(event.sender.id);
}

function requireAuth(event: IpcMainInvokeEvent, permission?: string) {
  const session = getSession(event);
  if (!session) throw new Error('Not authenticated. Please login.');
  if (permission && !hasPermission(session.role, permission)) {
    throw new Error('You do not have permission to perform this action.');
  }
  return session;
}

function handle(channel: string, handler: IpcHandler, permission?: string) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (channel !== 'auth:login' && channel !== 'auth:validate') {
        requireAuth(event, permission);
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
  handle('auth:login', async (event, username: unknown, password: unknown) => {
    const result = await login(username as string, password as string);
    sessions.set(event.sender.id, { token: result.token, userId: result.user.id, role: result.user.role });
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
      sessions.set(event.sender.id, {
        token: token as string,
        userId: user.id,
        role: user.role,
      });
    }
    return user;
  });

  handle('auth:createUser', async (event, data: unknown) => {
    requireAuth(event, '*');
    return createUser(data as Parameters<typeof createUser>[0]);
  });

  // Dashboard
  handle('dashboard:stats', async (_event, academicYearId?: unknown) => {
    return getDashboardStats(academicYearId as string | undefined);
  });

  // Students
  handle('students:list', async (_event, filters?: unknown) => studentService.getStudents(filters as Parameters<typeof studentService.getStudents>[0]), 'students');
  handle('students:get', async (_event, id: unknown) => studentService.getStudentById(id as string), 'students.view');
  handle('students:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.createStudent(data as Parameters<typeof studentService.createStudent>[0], session.userId);
  });
  handle('students:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.updateStudent(id as string, data as Parameters<typeof studentService.updateStudent>[1], session.userId);
  });
  handle('students:archive', async (event, id: unknown) => {
    const session = requireAuth(event, 'students');
    return studentService.archiveStudent(id as string, session.userId);
  });
  handle('students:attendance', async (_event, id: unknown, yearId?: unknown) =>
    studentService.getStudentAttendanceSummary(id as string, yearId as string | undefined), 'students.view');

  // Classes & Academic
  handle('classes:list', async () => academicService.getClasses(), 'classes');
  handle('classes:create', async (event, name: unknown, order: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.createClass(name as string, order as number, session.userId);
  });
  handle('classes:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.updateClass(id as string, data as Parameters<typeof academicService.updateClass>[1], session.userId);
  });
  handle('classes:delete', async (event, id: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.deleteClass(id as string, session.userId);
  });
  handle('sections:create', async (event, classId: unknown, name: unknown, teacherId?: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.createSection(classId as string, name as string, teacherId as string | undefined, session.userId);
  });
  handle('sections:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.updateSection(id as string, data as Parameters<typeof academicService.updateSection>[1], session.userId);
  });
  handle('sections:delete', async (event, id: unknown) => {
    const session = requireAuth(event, 'classes');
    return academicService.deleteSection(id as string, session.userId);
  });
  handle('academicYears:list', async () => academicService.getAcademicYears());
  handle('academicYears:current', async () => academicService.getCurrentAcademicYear());
  handle('academicYears:setCurrent', async (event, id: unknown) => {
    const session = requireAuth(event, '*');
    return academicService.setCurrentAcademicYear(id as string, session.userId);
  });
  handle('academicYears:create', async (event, data: unknown) => {
    const session = requireAuth(event, '*');
    return academicService.createAcademicYear(data as Parameters<typeof academicService.createAcademicYear>[0], session.userId);
  });

  // Teachers
  handle('teachers:list', async (_event, filters?: unknown) => academicService.getTeachers(filters as Parameters<typeof academicService.getTeachers>[0]), 'teachers');
  handle('teachers:get', async (_event, id: unknown) => academicService.getTeacherById(id as string), 'teachers');
  handle('teachers:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.createTeacher(data as Record<string, unknown>, session.userId);
  });
  handle('teachers:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'teachers');
    return academicService.updateTeacher(id as string, data as Record<string, unknown>, session.userId);
  });

  // Subjects
  handle('subjects:list', async (_event, classId?: unknown) => academicService.getSubjects(classId as string | undefined), 'subjects');
  handle('subjects:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'subjects');
    return academicService.createSubject(data as Record<string, unknown>, session.userId);
  });
  handle('subjects:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, 'subjects');
    return academicService.updateSubject(id as string, data as Record<string, unknown>, session.userId);
  });

  // Exams & Results
  handle('exams:list', async (_event, yearId?: unknown, classId?: unknown) =>
    academicService.getExams(yearId as string | undefined, classId as string | undefined), 'exams');
  handle('exams:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'exams');
    return academicService.createExam(data as Record<string, unknown>, session.userId);
  });
  handle('results:entry', async (_event, examId: unknown, subjectId: unknown, sectionId?: unknown) =>
    academicService.getResultsForEntry(examId as string, subjectId as string, sectionId as string | undefined), 'results');
  handle('results:save', async (event, data: unknown) => {
    const session = requireAuth(event, 'results');
    return academicService.saveResults(data as Parameters<typeof academicService.saveResults>[0], session.userId);
  });
  handle('results:student', async (_event, studentId: unknown, examId?: unknown) =>
    academicService.getStudentResults(studentId as string, examId as string | undefined), 'results');
  handle('results:rankings', async (_event, examId: unknown, sectionId?: unknown) =>
    academicService.getClassRankings(examId as string, sectionId as string | undefined), 'results');
  handle('grading:list', async () => academicService.getGradingRules());
  handle('grading:update', async (event, rules: unknown) => {
    const session = requireAuth(event, '*');
    return academicService.updateGradingRules(rules as Parameters<typeof academicService.updateGradingRules>[0], session.userId);
  });

  // Fees
  handle('fees:categories', async () => feeService.getFeeCategories(), 'fees');
  handle('fees:structures', async (_event, yearId?: unknown) => feeService.getFeeStructures(yearId as string | undefined), 'fees');
  handle('fees:structures:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'fees');
    return feeService.createFeeStructure(data as Parameters<typeof feeService.createFeeStructure>[0], session.userId);
  });
  handle('fees:student', async (_event, studentId: unknown, yearId?: unknown) =>
    feeService.getStudentFees(studentId as string, yearId as string | undefined), 'fees');
  handle('fees:payment', async (event, data: unknown) => {
    const session = requireAuth(event, 'payments');
    return feeService.recordPayment({ ...(data as object), collectedById: session.userId } as Parameters<typeof feeService.recordPayment>[0]);
  });
  handle('fees:payments', async (_event, filters?: unknown) => feeService.getPayments(filters as Parameters<typeof feeService.getPayments>[0]), 'payments');
  handle('fees:payment:get', async (_event, id: unknown) => feeService.getPaymentById(id as string), 'payments');
  handle('fees:payment:cancel', async (event, id: unknown) => {
    const session = requireAuth(event, 'payments');
    return feeService.cancelPayment(id as string, session.userId);
  });
  handle('fees:reports', async (_event, type: unknown, yearId?: unknown) =>
    feeService.getFeeReports(type as string, yearId as string | undefined), 'reports.fees');

  // Attendance
  handle('attendance:get', async (_event, sectionId: unknown, date: unknown, yearId: unknown) =>
    attendanceService.getAttendanceForClass(sectionId as string, new Date(date as string), yearId as string), 'attendance');
  handle('attendance:save', async (event, data: unknown) => {
    const session = requireAuth(event, 'attendance');
    return attendanceService.saveAttendance(data as Parameters<typeof attendanceService.saveAttendance>[0], session.userId);
  });
  handle('attendance:report', async (_event, type: unknown, filters?: unknown) =>
    attendanceService.getAttendanceReport(type as string, filters as Parameters<typeof attendanceService.getAttendanceReport>[1]), 'attendance');
  handle('attendance:daily', async (_event, date: unknown, yearId?: unknown) =>
    attendanceService.getDailyAttendance(new Date(date as string), yearId as string | undefined), 'attendance');

  // Admissions
  handle('admissions:list', async (_event, filters?: unknown) => settingsService.getAdmissions(filters as Parameters<typeof settingsService.getAdmissions>[0]), 'admissions');
  handle('admissions:create', async (event, data: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.createAdmission(data as Record<string, unknown>, session.userId);
  });
  handle('admissions:wizard', async (event, data: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.createAdmissionWizard(data as Record<string, unknown>, session.userId);
  });
  handle('admissions:draft', async (event, data: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.saveAdmissionDraft(data as Record<string, unknown>, session.userId);
  });
  handle('admissions:approve', async (event, id: unknown) => {
    const session = requireAuth(event, 'admissions');
    return settingsService.approveAdmission(id as string, session.userId);
  });

  // Settings
  handle('settings:school', async () => settingsService.getSchoolSettings());
  handle('settings:school:update', async (event, data: unknown) => {
    const session = requireAuth(event, '*');
    return settingsService.updateSchoolSettings(data as Record<string, unknown>, session.userId);
  });
  handle('settings:users', async (event) => {
    requireAuth(event, '*');
    return settingsService.getUsers();
  });
  handle('settings:users:update', async (event, id: unknown, data: unknown) => {
    const session = requireAuth(event, '*');
    return settingsService.updateUser(id as string, data as Record<string, unknown>, session.userId);
  });
  handle('audit:list', async (event, filters?: unknown) => {
    requireAuth(event, '*');
    return settingsService.getAuditLogs(filters as Parameters<typeof settingsService.getAuditLogs>[0]);
  });

  // Notifications
  handle('notifications:list', async (event) => {
    const session = getSession(event);
    return settingsService.getNotifications(session?.userId);
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
}

export function cleanupSession(webContentsId: number): void {
  sessions.delete(webContentsId);
}
