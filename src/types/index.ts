export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'CREATOR' | 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'TEACHER' | 'RECEPTIONIST';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  schoolId?: string | null;
  school?: {
    id: string;
    name: string;
    code: string;
    status: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoPath?: string;
  } | null;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  category: 'Core Academic' | 'Administration' | 'Finance' | 'Examinations & Grading' | 'System';
  description: string;
  defaultEnabled: boolean;
  navPath: string;
  permission: string;
  ipcPrefixes: string[];
}

export interface PlanPreset {
  id: 'BASIC' | 'STANDARD' | 'PREMIUM';
  name: string;
  badge: string;
  description: string;
  maxStudents: number;
  maxStaff: number;
  features: string[];
}

export interface AcademicSessionRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isActive: boolean;
  isClosed: boolean;
  isReadOnly: boolean;
  studentCount: number;
  examCount: number;
  paymentCount: number;
  schoolId?: string | null;
}

export interface RolloverStudentPreview {
  studentId: string;
  name: string;
  admissionNumber: string;
  currentClassId: string | null;
  currentClassName: string;
  nextClassId: string | null;
  nextClassName: string;
  action: 'PROMOTE' | 'RETAIN' | 'GRADUATE';
  pendingDuePaise: number;
}

export interface RolloverPreviewResult {
  sourceSession: { id: string; name: string };
  targetSession: { id: string; name: string };
  totalStudents: number;
  toPromoteCount: number;
  toGraduateCount: number;
  totalPendingDuesPaise: number;
  classSummaries: { fromClass: string; toClass: string; count: number }[];
  students: RolloverStudentPreview[];
}

export interface SuperAdminRecord {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  lockReason?: string | null;
  forcePasswordChange: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  schoolId?: string | null;
  school?: {
    id: string;
    name: string;
    code: string;
    status: string;
  } | null;
  activeSessionsCount?: number;
  recentActivity?: Array<{
    id: string;
    action: string;
    details?: string | null;
    createdAt: string;
  }>;
}

export interface SchoolRecord {
  id: string;
  name: string;
  shortCode: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  board?: string | null;
  affiliationNumber?: string | null;
  principalName?: string | null;
  logoPath?: string | null;
  faviconPath?: string | null;
  signaturePath?: string | null;
  stampPath?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  reportHeader?: string | null;
  reportFooter?: string | null;
  maxStudents?: number;
  maxStaff?: number;
  licenseExpiresAt?: string | null;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  studentCount?: number;
  teacherCount?: number;
  staffCount?: number;
  superAdminCount?: number;
  classCount?: number;
}

export interface Student {
  id: string;
  studentId: string;
  admissionNumber: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  classId?: string;
  sectionId?: string;
  rollNumber?: string;
  admissionDate?: string;
  academicYearId?: string;
  photoPath?: string;
  emergencyContact?: string;
  previousSchool?: string;
  remarks?: string;
  fatherMobile?: string;
  motherMobile?: string;
  aadhaarNumber?: string;
  status: string;
  isDemo?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  academicYear?: { id: string; name: string };
  pendingFeePaise?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
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

export interface SystemSettingsData {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  dailyBackupEnabled: boolean;
  dailyBackupTime: string;
  backupRetentionDays: number;
  lastDailyBackupAt: string | null;
}

export interface GlobalAuditRecord {
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
}

export interface BackupFileInfo {
  filename: string;
  filePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  isAutomatic: boolean;
}

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<ApiResponse>;
      auth: {
        login: (username: string, password: string, schoolCode?: string) => Promise<ApiResponse<{ user: User; token: string; expiresAt: string; school?: any }>>;
        logout: () => Promise<ApiResponse>;
        validate: (token: string) => Promise<ApiResponse<User>>;
        createUser: (data: unknown) => Promise<ApiResponse>;
      };
      creator: {
        enterSchool: (schoolId: string) => Promise<ApiResponse<{ schoolId: string; schoolName: string; enteredAt: string }>>;
        exitSchool: () => Promise<ApiResponse<{ success: boolean }>>;
        getSessionState: () => Promise<ApiResponse<{ role: string | null; impersonatedSchoolId: string | null }>>;
        stats: () => Promise<ApiResponse<any>>;
        schools: {
          list: (filters?: unknown) => Promise<ApiResponse<{ schools: SchoolRecord[]; total: number; page: number; totalPages: number }>>;
          get: (id: string) => Promise<ApiResponse<SchoolRecord>>;
          create: (data: unknown) => Promise<ApiResponse<SchoolRecord>>;
          update: (id: string, data: unknown) => Promise<ApiResponse<SchoolRecord>>;
          suspend: (id: string, reason?: string) => Promise<ApiResponse<SchoolRecord>>;
          reactivate: (id: string) => Promise<ApiResponse<SchoolRecord>>;
          archive: (id: string, password: string) => Promise<ApiResponse<SchoolRecord>>;
          uploadAsset: (schoolId: string, assetType: string, fileBase64: string, filename: string) => Promise<ApiResponse<{ success: boolean; assetType: string; path: string }>>;
        };
        superAdmins: {
          list: (filters?: unknown) => Promise<ApiResponse<{ superAdmins: SuperAdminRecord[]; total: number; page: number; totalPages: number }>>;
          create: (data: unknown) => Promise<ApiResponse<SuperAdminRecord>>;
          resetPassword: (userId: string, newPassword: string, forceChange: boolean) => Promise<ApiResponse<{ success: boolean }>>;
          toggleLock: (userId: string, lock: boolean, reason?: string) => Promise<ApiResponse<SuperAdminRecord>>;
          forceLogout: (userId: string) => Promise<ApiResponse<{ success: boolean; terminatedSessions: number }>>;
          reassignSchool: (userId: string, newSchoolId: string) => Promise<ApiResponse<SuperAdminRecord>>;
          activity: (userId: string, limit?: number) => Promise<ApiResponse<any[]>>;
        };
        features: {
          get: (schoolId: string) => Promise<ApiResponse<{
            schoolId: string;
            schoolName: string;
            schoolCode: string;
            plan: string;
            maxStudents: number;
            maxStaff: number;
            licenseExpiresAt: string | null;
            licenseWarning: string | null;
            studentCount: number;
            staffCount: number;
            features: Record<string, boolean>;
            registry: FeatureDefinition[];
            presets: PlanPreset[];
          }>>;
          toggle: (schoolId: string, featureId: string, isEnabled: boolean) => Promise<ApiResponse<{ success: boolean; featureId: string; isEnabled: boolean; plan: string }>>;
          applyPlan: (schoolId: string, planId: string, updateLimits: boolean) => Promise<ApiResponse<any>>;
          updateLimits: (schoolId: string, limits: { maxStudents?: number; maxStaff?: number; licenseExpiresAt?: string | null }) => Promise<ApiResponse<any>>;
          registry: () => Promise<ApiResponse<FeatureDefinition[]>>;
          presets: () => Promise<ApiResponse<PlanPreset[]>>;
        };
        sessions: {
          list: (schoolId: string) => Promise<ApiResponse<AcademicSessionRecord[]>>;
          create: (schoolId: string, data: unknown) => Promise<ApiResponse<any>>;
          setActive: (id: string, schoolId: string) => Promise<ApiResponse<any>>;
          previewRollover: (sourceId: string, targetId: string, schoolId: string) => Promise<ApiResponse<RolloverPreviewResult>>;
          executeRollover: (options: unknown, schoolId: string) => Promise<ApiResponse<any>>;
        };
        system: {
          getSettings: () => Promise<ApiResponse<SystemSettingsData>>;
          updateSettings: (data: unknown) => Promise<ApiResponse<SystemSettingsData>>;
        };
        activeUsers: {
          list: (filters?: unknown) => Promise<ApiResponse<ActiveSessionRecord[]>>;
          forceLogoutSession: (sessionId: string) => Promise<ApiResponse<{ success: boolean }>>;
          forceLogoutUser: (userId: string) => Promise<ApiResponse<{ success: boolean; count: number }>>;
          forceLogoutSchool: (schoolId: string) => Promise<ApiResponse<{ success: boolean; count: number }>>;
        };
        audit: {
          list: (filters?: unknown) => Promise<ApiResponse<{ logs: GlobalAuditRecord[]; total: number; page: number; totalPages: number }>>;
        };
        backup: {
          list: () => Promise<ApiResponse<BackupFileInfo[]>>;
          create: (label?: string) => Promise<ApiResponse<{ backupPath: string; filename: string; sizeBytes: number; sizeFormatted: string }>>;
          restore: (filePath: string, password: string) => Promise<ApiResponse<{ success: boolean; message: string; safetyBackupPath: string }>>;
        };
        enhancedStats: () => Promise<ApiResponse<any>>;
      };
      dashboard: { getStats: (academicYearId?: string) => Promise<ApiResponse> };
      students: {
        list: (filters?: unknown) => Promise<ApiResponse>;
        listDeleted: (filters?: unknown) => Promise<ApiResponse>;
        get: (id: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
        archive: (id: string) => Promise<ApiResponse>;
        restore: (id: string) => Promise<ApiResponse>;
        permanentDelete: (id: string) => Promise<ApiResponse>;
        emptyRecycleBin: () => Promise<ApiResponse<{ count: number }>>;
        getAttendance: (id: string, yearId?: string) => Promise<ApiResponse>;
      };
      classes: {
        list: () => Promise<ApiResponse>;
        create: (name: string, order: number) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
        delete: (id: string) => Promise<ApiResponse>;
      };
      sections: {
        create: (classId: string, name: string, teacherId?: string) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
        delete: (id: string) => Promise<ApiResponse>;
      };
      academicYears: {
        list: () => Promise<ApiResponse>;
        listWithStats: () => Promise<ApiResponse<AcademicSessionRecord[]>>;
        current: () => Promise<ApiResponse>;
        setCurrent: (id: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        previewRollover: (sourceId: string, targetId: string) => Promise<ApiResponse<RolloverPreviewResult>>;
        executeRollover: (options: unknown) => Promise<ApiResponse<any>>;
      };
      teachers: {
        list: (filters?: unknown) => Promise<ApiResponse>;
        listDeleted: (filters?: unknown) => Promise<ApiResponse>;
        get: (id: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
        delete: (id: string) => Promise<ApiResponse>;
        archive: (id: string) => Promise<ApiResponse>;
        restore: (id: string) => Promise<ApiResponse>;
        permanentDelete: (id: string) => Promise<ApiResponse>;
        emptyRecycleBin: () => Promise<ApiResponse>;
      };
      subjects: {
        list: (classId?: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
        delete: (id: string) => Promise<ApiResponse>;
      };
      exams: {
        list: (yearId?: string, classId?: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
      };
      results: {
        getEntry: (examId: string, subjectId: string, sectionId?: string) => Promise<ApiResponse>;
        save: (data: unknown) => Promise<ApiResponse>;
        getStudent: (studentId: string, examId?: string) => Promise<ApiResponse>;
        getRankings: (examId: string, sectionId?: string) => Promise<ApiResponse>;
      };
      grading: {
        list: () => Promise<ApiResponse>;
        update: (rules: unknown) => Promise<ApiResponse>;
      };
      fees: {
        getCategories: () => Promise<ApiResponse>;
        getStructures: (yearId?: string) => Promise<ApiResponse>;
        createStructure: (data: unknown) => Promise<ApiResponse>;
        getStudentFees: (studentId: string, yearId?: string) => Promise<ApiResponse>;
        recordPayment: (data: unknown) => Promise<ApiResponse>;
        getPayments: (filters?: unknown) => Promise<ApiResponse>;
        getPayment: (id: string) => Promise<ApiResponse>;
        cancelPayment: (id: string) => Promise<ApiResponse>;
        getReports: (type: string, yearId?: string) => Promise<ApiResponse>;
      };
      attendance: {
        get: (sectionId: string, date: string, yearId: string) => Promise<ApiResponse>;
        save: (data: unknown) => Promise<ApiResponse>;
        getReport: (type: string, filters?: unknown) => Promise<ApiResponse>;
        getDaily: (date: string, yearId?: string) => Promise<ApiResponse>;
      };
      admissions: {
        list: (filters?: unknown) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        wizard: (data: unknown) => Promise<ApiResponse>;
        draft: (data: unknown) => Promise<ApiResponse>;
        approve: (id: string) => Promise<ApiResponse>;
      };
      settings: {
        getSchool: () => Promise<ApiResponse>;
        updateSchool: (data: unknown) => Promise<ApiResponse>;
        getUsers: () => Promise<ApiResponse>;
        updateUser: (id: string, data: unknown) => Promise<ApiResponse>;
      };
      audit: { list: (filters?: unknown) => Promise<ApiResponse> };
      notifications: {
        list: () => Promise<ApiResponse>;
        markRead: (id: string) => Promise<ApiResponse>;
      };
      backup: {
        create: (customPath?: string) => Promise<ApiResponse<string>>;
        restore: (path: string) => Promise<ApiResponse>;
        selectFile: () => Promise<ApiResponse<string | null>>;
        selectLocation: () => Promise<ApiResponse<string | null>>;
      };
      files: {
        save: (buffer: ArrayBuffer, filename: string, subfolder: string) => Promise<ApiResponse<string>>;
        select: (filters?: unknown) => Promise<ApiResponse<string | null>>;
        copyToUploads: (srcPath: string, subfolder: string) => Promise<ApiResponse<string>>;
        getUploadsPath: () => Promise<ApiResponse<string>>;
        open: (filePath: string) => Promise<ApiResponse<string>>;
        readDataUrl: (filePath: string) => Promise<ApiResponse<string>>;
      };
    };
  }
}

export {};
