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
  role: 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'TEACHER' | 'RECEPTIONIST';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
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
  status: string;
  isDemo?: boolean;
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

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<ApiResponse>;
      auth: {
        login: (username: string, password: string) => Promise<ApiResponse<{ user: User; token: string; expiresAt: string }>>;
        logout: () => Promise<ApiResponse>;
        validate: (token: string) => Promise<ApiResponse<User>>;
        createUser: (data: unknown) => Promise<ApiResponse>;
      };
      dashboard: { getStats: (academicYearId?: string) => Promise<ApiResponse> };
      students: {
        list: (filters?: unknown) => Promise<ApiResponse>;
        get: (id: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
        archive: (id: string) => Promise<ApiResponse>;
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
        current: () => Promise<ApiResponse>;
        setCurrent: (id: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
      };
      teachers: {
        list: (filters?: unknown) => Promise<ApiResponse>;
        get: (id: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
      };
      subjects: {
        list: (classId?: string) => Promise<ApiResponse>;
        create: (data: unknown) => Promise<ApiResponse>;
        update: (id: string, data: unknown) => Promise<ApiResponse>;
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
        save: (buffer: ArrayBuffer, filename: string, subfolder: string) => Promise<ApiResponse>;
        select: (filters?: unknown) => Promise<ApiResponse>;
      };
    };
  }
}

export {};
