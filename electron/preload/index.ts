import { contextBridge, ipcRenderer } from 'electron';

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    validate: (token: string) => ipcRenderer.invoke('auth:validate', token),
    createUser: (data: unknown) => ipcRenderer.invoke('auth:createUser', data),
  },

  dashboard: {
    getStats: (academicYearId?: string) => ipcRenderer.invoke('dashboard:stats', academicYearId),
  },

  students: {
    list: (filters?: unknown) => ipcRenderer.invoke('students:list', filters),
    get: (id: string) => ipcRenderer.invoke('students:get', id),
    create: (data: unknown) => ipcRenderer.invoke('students:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('students:update', id, data),
    archive: (id: string) => ipcRenderer.invoke('students:archive', id),
    getAttendance: (id: string, yearId?: string) => ipcRenderer.invoke('students:attendance', id, yearId),
  },

  classes: {
    list: () => ipcRenderer.invoke('classes:list'),
    create: (name: string, order: number) => ipcRenderer.invoke('classes:create', name, order),
    update: (id: string, data: unknown) => ipcRenderer.invoke('classes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('classes:delete', id),
  },

  sections: {
    create: (classId: string, name: string, teacherId?: string) =>
      ipcRenderer.invoke('sections:create', classId, name, teacherId),
    update: (id: string, data: unknown) => ipcRenderer.invoke('sections:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('sections:delete', id),
  },

  academicYears: {
    list: () => ipcRenderer.invoke('academicYears:list'),
    current: () => ipcRenderer.invoke('academicYears:current'),
    setCurrent: (id: string) => ipcRenderer.invoke('academicYears:setCurrent', id),
    create: (data: unknown) => ipcRenderer.invoke('academicYears:create', data),
  },

  teachers: {
    list: (filters?: unknown) => ipcRenderer.invoke('teachers:list', filters),
    get: (id: string) => ipcRenderer.invoke('teachers:get', id),
    create: (data: unknown) => ipcRenderer.invoke('teachers:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('teachers:update', id, data),
  },

  subjects: {
    list: (classId?: string) => ipcRenderer.invoke('subjects:list', classId),
    create: (data: unknown) => ipcRenderer.invoke('subjects:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('subjects:update', id, data),
  },

  exams: {
    list: (yearId?: string, classId?: string) => ipcRenderer.invoke('exams:list', yearId, classId),
    create: (data: unknown) => ipcRenderer.invoke('exams:create', data),
  },

  results: {
    getEntry: (examId: string, subjectId: string, sectionId?: string) =>
      ipcRenderer.invoke('results:entry', examId, subjectId, sectionId),
    save: (data: unknown) => ipcRenderer.invoke('results:save', data),
    getStudent: (studentId: string, examId?: string) =>
      ipcRenderer.invoke('results:student', studentId, examId),
    getRankings: (examId: string, sectionId?: string) =>
      ipcRenderer.invoke('results:rankings', examId, sectionId),
  },

  grading: {
    list: () => ipcRenderer.invoke('grading:list'),
    update: (rules: unknown) => ipcRenderer.invoke('grading:update', rules),
  },

  fees: {
    getCategories: () => ipcRenderer.invoke('fees:categories'),
    getStructures: (yearId?: string) => ipcRenderer.invoke('fees:structures', yearId),
    createStructure: (data: unknown) => ipcRenderer.invoke('fees:structures:create', data),
    getStudentFees: (studentId: string, yearId?: string) =>
      ipcRenderer.invoke('fees:student', studentId, yearId),
    recordPayment: (data: unknown) => ipcRenderer.invoke('fees:payment', data),
    getPayments: (filters?: unknown) => ipcRenderer.invoke('fees:payments', filters),
    getPayment: (id: string) => ipcRenderer.invoke('fees:payment:get', id),
    cancelPayment: (id: string) => ipcRenderer.invoke('fees:payment:cancel', id),
    getReports: (type: string, yearId?: string) => ipcRenderer.invoke('fees:reports', type, yearId),
  },

  attendance: {
    get: (sectionId: string, date: string, yearId: string) =>
      ipcRenderer.invoke('attendance:get', sectionId, date, yearId),
    save: (data: unknown) => ipcRenderer.invoke('attendance:save', data),
    getReport: (type: string, filters?: unknown) => ipcRenderer.invoke('attendance:report', type, filters),
    getDaily: (date: string, yearId?: string) => ipcRenderer.invoke('attendance:daily', date, yearId),
  },

  admissions: {
    list: (filters?: unknown) => ipcRenderer.invoke('admissions:list', filters),
    create: (data: unknown) => ipcRenderer.invoke('admissions:create', data),
    wizard: (data: unknown) => ipcRenderer.invoke('admissions:wizard', data),
    draft: (data: unknown) => ipcRenderer.invoke('admissions:draft', data),
    approve: (id: string) => ipcRenderer.invoke('admissions:approve', id),
  },

  settings: {
    getSchool: () => ipcRenderer.invoke('settings:school'),
    updateSchool: (data: unknown) => ipcRenderer.invoke('settings:school:update', data),
    getUsers: () => ipcRenderer.invoke('settings:users'),
    updateUser: (id: string, data: unknown) => ipcRenderer.invoke('settings:users:update', id, data),
  },

  audit: {
    list: (filters?: unknown) => ipcRenderer.invoke('audit:list', filters),
  },

  notifications: {
    list: () => ipcRenderer.invoke('notifications:list'),
    markRead: (id: string) => ipcRenderer.invoke('notifications:read', id),
  },

  backup: {
    create: (customPath?: string) => ipcRenderer.invoke('backup:create', customPath),
    restore: (path: string) => ipcRenderer.invoke('backup:restore', path),
    selectFile: () => ipcRenderer.invoke('backup:select'),
    selectLocation: () => ipcRenderer.invoke('backup:selectLocation'),
  },

  files: {
    save: (buffer: ArrayBuffer, filename: string, subfolder: string) =>
      ipcRenderer.invoke('files:save', buffer, filename, subfolder),
    select: (filters?: unknown) => ipcRenderer.invoke('files:select', filters),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ApiType = typeof api;
