import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';

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

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  {
    id: 'students',
    name: 'Student Information System',
    category: 'Core Academic',
    description: 'Student directory, profiles, categories, roll numbers, and personal details.',
    defaultEnabled: true,
    navPath: '/students',
    permission: 'students',
    ipcPrefixes: ['students:'],
  },
  {
    id: 'admissions',
    name: 'Admissions & Enrollment',
    category: 'Administration',
    description: 'Online application forms, admission wizard, document verification, and approvals.',
    defaultEnabled: true,
    navPath: '/admissions',
    permission: 'admissions',
    ipcPrefixes: ['admissions:'],
  },
  {
    id: 'classes',
    name: 'Classes & Sections',
    category: 'Core Academic',
    description: 'Grade levels, section allocations, class teacher assignments, and rosters.',
    defaultEnabled: true,
    navPath: '/classes',
    permission: 'classes',
    ipcPrefixes: ['classes:', 'sections:'],
  },
  {
    id: 'teachers',
    name: 'Teachers & Staff Directory',
    category: 'Administration',
    description: 'Staff profiles, employee IDs, department assignments, and qualifications.',
    defaultEnabled: true,
    navPath: '/teachers',
    permission: 'teachers',
    ipcPrefixes: ['teachers:'],
  },
  {
    id: 'subjects',
    name: 'Subjects & Curriculum',
    category: 'Core Academic',
    description: 'Subject syllabus, class subject allocations, credit hours, and curriculum tracking.',
    defaultEnabled: true,
    navPath: '/subjects',
    permission: 'subjects',
    ipcPrefixes: ['subjects:'],
  },
  {
    id: 'fees',
    name: 'Fee Structure & Setup',
    category: 'Finance',
    description: 'Class fee structures, fee categories, concession schemes, and due schedules.',
    defaultEnabled: true,
    navPath: '/fees',
    permission: 'fees',
    ipcPrefixes: ['fees:structures', 'fees:categories', 'fees:student'],
  },
  {
    id: 'payments',
    name: 'Fee Collection & Receipts',
    category: 'Finance',
    description: 'Point-of-sale fee collection, computerized receipts, payment methods, and ledger.',
    defaultEnabled: true,
    navPath: '/payments',
    permission: 'payments',
    ipcPrefixes: ['fees:payment', 'fees:payments'],
  },
  {
    id: 'attendance',
    name: 'Attendance Tracking',
    category: 'Core Academic',
    description: 'Daily student and staff attendance registers, monthly percentages, and absence logs.',
    defaultEnabled: true,
    navPath: '/attendance',
    permission: 'attendance',
    ipcPrefixes: ['attendance:'],
  },
  {
    id: 'examinations',
    name: 'Examinations & Grading',
    category: 'Examinations & Grading',
    description: 'Exam scheduling, term exams, grading scales (A+-F), and max mark configuration.',
    defaultEnabled: true,
    navPath: '/examinations',
    permission: 'exams',
    ipcPrefixes: ['exams:', 'grading:'],
  },
  {
    id: 'results',
    name: 'Results & Marksheets',
    category: 'Examinations & Grading',
    description: 'Marks entry by subject, class rankings, grade calculations, and printable report cards.',
    defaultEnabled: true,
    navPath: '/results',
    permission: 'results',
    ipcPrefixes: ['results:'],
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    category: 'Administration',
    description: 'Consolidated school analytics, financial fee reports, and academic summaries.',
    defaultEnabled: true,
    navPath: '/reports',
    permission: 'reports',
    ipcPrefixes: ['fees:reports'],
  },
  {
    id: 'notifications',
    name: 'Notice Board & Alerts',
    category: 'Administration',
    description: 'School broadcasts, internal notices, news bulletin, and system alert badges.',
    defaultEnabled: true,
    navPath: '/notifications',
    permission: 'notifications',
    ipcPrefixes: ['notifications:'],
  },
  {
    id: 'backup',
    name: 'Backup & Restore',
    category: 'System',
    description: 'Database snapshot export, file storage backup, and recovery utilities.',
    defaultEnabled: true,
    navPath: '/backup',
    permission: '*',
    ipcPrefixes: ['backup:'],
  },
];

export const PLAN_PRESETS: Record<'BASIC' | 'STANDARD' | 'PREMIUM', PlanPreset> = {
  BASIC: {
    id: 'BASIC',
    name: 'Basic Plan',
    badge: 'Essential',
    description: 'Core school attendance and student record-keeping without fees or exams.',
    maxStudents: 300,
    maxStaff: 25,
    features: ['students', 'classes', 'teachers', 'attendance', 'notifications'],
  },
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard Plan',
    badge: 'Popular',
    description: 'Comprehensive academic suite including admissions, exams, marksheets, and reports.',
    maxStudents: 1000,
    maxStaff: 100,
    features: [
      'students',
      'admissions',
      'classes',
      'teachers',
      'subjects',
      'attendance',
      'examinations',
      'results',
      'notifications',
      'reports',
    ],
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium Plan',
    badge: 'Complete Suite',
    description: 'All 13 modules enabled including advanced fee collection, receipts, and backups.',
    maxStudents: 5000,
    maxStaff: 500,
    features: FEATURE_REGISTRY.map((f) => f.id),
  },
};

export const CHANNEL_FEATURE_MAP: Record<string, string> = {
  // Students
  'students:list': 'students',
  'students:get': 'students',
  'students:create': 'students',
  'students:update': 'students',
  'students:archive': 'students',
  'students:attendance': 'students',

  // Admissions
  'admissions:list': 'admissions',
  'admissions:create': 'admissions',
  'admissions:wizard': 'admissions',
  'admissions:draft': 'admissions',
  'admissions:approve': 'admissions',

  // Classes & Sections
  'classes:list': 'classes',
  'classes:create': 'classes',
  'classes:update': 'classes',
  'classes:delete': 'classes',
  'sections:create': 'classes',
  'sections:update': 'classes',
  'sections:delete': 'classes',

  // Teachers
  'teachers:list': 'teachers',
  'teachers:get': 'teachers',
  'teachers:create': 'teachers',
  'teachers:update': 'teachers',

  // Subjects
  'subjects:list': 'subjects',
  'subjects:create': 'subjects',
  'subjects:update': 'subjects',

  // Fees
  'fees:categories': 'fees',
  'fees:structures': 'fees',
  'fees:structures:create': 'fees',
  'fees:student': 'fees',

  // Payments
  'fees:payment': 'payments',
  'fees:payments': 'payments',
  'fees:payment:get': 'payments',
  'fees:payment:cancel': 'payments',

  // Attendance
  'attendance:get': 'attendance',
  'attendance:save': 'attendance',
  'attendance:report': 'attendance',
  'attendance:daily': 'attendance',

  // Examinations & Grading
  'exams:list': 'examinations',
  'exams:create': 'examinations',
  'grading:list': 'examinations',
  'grading:update': 'examinations',

  // Results
  'results:entry': 'results',
  'results:save': 'results',
  'results:student': 'results',
  'results:rankings': 'results',

  // Reports
  'fees:reports': 'reports',

  // Notifications
  'notifications:list': 'notifications',
  'notifications:read': 'notifications',

  // Backup
  'backup:create': 'backup',
  'backup:restore': 'backup',
  'backup:select': 'backup',
  'backup:selectLocation': 'backup',
};

// In-memory cache for ultra-fast feature resolution (TTL: 5 seconds)
interface FeatureCacheEntry {
  features: Record<string, boolean>;
  timestamp: number;
}
const featureCache = new Map<string, FeatureCacheEntry>();
const CACHE_TTL_MS = 5000;

export function invalidateFeatureCache(schoolId?: string) {
  if (schoolId) {
    featureCache.delete(schoolId);
  } else {
    featureCache.clear();
  }
}

export function getFeatureRegistry() {
  return FEATURE_REGISTRY;
}

export function getPlanPresets() {
  return Object.values(PLAN_PRESETS);
}

export async function getEffectiveSchoolFeatures(schoolId: string) {
  const db = getPrismaClient();

  const school = await db.school.findUnique({
    where: { id: schoolId },
    include: { features: true },
  });

  if (!school) {
    throw new Error(`School with ID "${schoolId}" not found.`);
  }

  const featuresMap: Record<string, boolean> = {};
  for (const feat of FEATURE_REGISTRY) {
    const existing = school.features.find((f) => f.featureId === feat.id);
    featuresMap[feat.id] = existing ? existing.isEnabled : feat.defaultEnabled;
  }

  // Count active students and staff
  const [studentCount, staffCount] = await Promise.all([
    db.student.count({
      where: {
        schoolId,
        status: { in: ['ACTIVE', 'ENROLLED'] },
      },
    }),
    db.user.count({
      where: {
        schoolId,
        isActive: true,
        role: { not: 'CREATOR' },
      },
    }),
  ]);

  let licenseWarning: string | null = null;
  if (school.licenseExpiresAt) {
    const msRemaining = new Date(school.licenseExpiresAt).getTime() - Date.now();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    if (daysRemaining > 0 && daysRemaining <= 30) {
      licenseWarning = `School licence will expire in ${daysRemaining} day(s) on ${new Date(
        school.licenseExpiresAt
      ).toLocaleDateString('en-IN')}. Please contact administration to renew.`;
    }
  }

  // Cache features
  featureCache.set(schoolId, {
    features: { ...featuresMap },
    timestamp: Date.now(),
  });

  return {
    schoolId: school.id,
    schoolName: school.name,
    schoolCode: school.code,
    plan: school.plan || 'PREMIUM',
    maxStudents: school.maxStudents || 1000,
    maxStaff: school.maxStaff || 100,
    licenseExpiresAt: school.licenseExpiresAt,
    licenseWarning,
    studentCount,
    staffCount,
    features: featuresMap,
    registry: FEATURE_REGISTRY,
    presets: Object.values(PLAN_PRESETS),
  };
}

export async function isFeatureEnabled(schoolId: string, featureId: string): Promise<boolean> {
  const cached = featureCache.get(schoolId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (featureId in cached.features) {
      return cached.features[featureId];
    }
  }

  const db = getPrismaClient();
  const feat = await db.schoolFeature.findUnique({
    where: {
      schoolId_featureId: {
        schoolId,
        featureId,
      },
    },
  });

  if (feat) {
    if (cached) cached.features[featureId] = feat.isEnabled;
    return feat.isEnabled;
  }

  const def = FEATURE_REGISTRY.find((f) => f.id === featureId);
  return def ? def.defaultEnabled : true;
}

export async function assertFeatureEnabled(schoolId: string, featureId: string): Promise<void> {
  const enabled = await isFeatureEnabled(schoolId, featureId);
  if (!enabled) {
    const def = FEATURE_REGISTRY.find((f) => f.id === featureId);
    const name = def ? def.name : featureId;
    throw new Error(`403: Feature "${name}" is not enabled for this school.`);
  }
}

export async function updateSchoolFeature(
  schoolId: string,
  featureId: string,
  isEnabled: boolean,
  creatorUserId: string
) {
  const db = getPrismaClient();

  const def = FEATURE_REGISTRY.find((f) => f.id === featureId);
  if (!def) {
    throw new Error(`Unknown feature ID "${featureId}".`);
  }

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new Error(`School "${schoolId}" not found.`);
  }

  const updatedFeature = await db.schoolFeature.upsert({
    where: {
      schoolId_featureId: { schoolId, featureId },
    },
    update: { isEnabled },
    create: {
      schoolId,
      featureId,
      isEnabled,
    },
  });

  // If features diverge from known presets, mark plan as CUSTOM
  await db.school.update({
    where: { id: schoolId },
    data: { plan: 'CUSTOM' },
  });

  invalidateFeatureCache(schoolId);

  await createAuditLog(
    creatorUserId,
    'FEATURE_TOGGLED',
    'SchoolFeature',
    updatedFeature.id,
    `${school.name}: Toggled feature "${def.name}" to ${isEnabled ? 'ON' : 'OFF'}`,
    schoolId
  );

  return { success: true, featureId, isEnabled, plan: 'CUSTOM' };
}

export async function applyPlanPreset(
  schoolId: string,
  planId: 'BASIC' | 'STANDARD' | 'PREMIUM',
  updateLimits: boolean,
  creatorUserId: string
) {
  const db = getPrismaClient();
  const preset = PLAN_PRESETS[planId];
  if (!preset) {
    throw new Error(`Invalid plan preset "${planId}".`);
  }

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new Error(`School "${schoolId}" not found.`);
  }

  const enabledSet = new Set(preset.features);

  // Apply all features in a transaction
  for (const feat of FEATURE_REGISTRY) {
    const isEnabled = enabledSet.has(feat.id);
    await db.schoolFeature.upsert({
      where: {
        schoolId_featureId: { schoolId, featureId: feat.id },
      },
      update: { isEnabled },
      create: {
        schoolId,
        featureId: feat.id,
        isEnabled,
      },
    });
  }

  const updateData: Record<string, any> = { plan: planId };
  if (updateLimits) {
    updateData.maxStudents = preset.maxStudents;
    updateData.maxStaff = preset.maxStaff;
  }

  await db.school.update({
    where: { id: schoolId },
    data: updateData,
  });

  invalidateFeatureCache(schoolId);

  await createAuditLog(
    creatorUserId,
    'PLAN_APPLIED',
    'School',
    schoolId,
    `${school.name}: Applied plan preset "${preset.name}" (${preset.features.length} modules enabled, update limits: ${updateLimits})`,
    schoolId
  );

  return getEffectiveSchoolFeatures(schoolId);
}

export async function updateSchoolLimits(
  schoolId: string,
  limits: { maxStudents?: number; maxStaff?: number; licenseExpiresAt?: string | null },
  creatorUserId: string
) {
  const db = getPrismaClient();

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new Error(`School "${schoolId}" not found.`);
  }

  const updateData: Record<string, any> = {};
  if (typeof limits.maxStudents === 'number' && limits.maxStudents > 0) {
    updateData.maxStudents = limits.maxStudents;
  }
  if (typeof limits.maxStaff === 'number' && limits.maxStaff > 0) {
    updateData.maxStaff = limits.maxStaff;
  }
  if (limits.licenseExpiresAt !== undefined) {
    updateData.licenseExpiresAt = limits.licenseExpiresAt ? new Date(limits.licenseExpiresAt) : null;
  }

  const updatedSchool = await db.school.update({
    where: { id: schoolId },
    data: updateData,
  });

  invalidateFeatureCache(schoolId);

  await createAuditLog(
    creatorUserId,
    'SCHOOL_LIMITS_UPDATED',
    'School',
    schoolId,
    `${school.name}: Updated limits (maxStudents: ${updatedSchool.maxStudents}, maxStaff: ${updatedSchool.maxStaff}, expiry: ${updatedSchool.licenseExpiresAt?.toISOString() || 'None'})`,
    schoolId
  );

  return getEffectiveSchoolFeatures(schoolId);
}

export async function checkSchoolLimits(schoolId: string, type: 'STUDENT' | 'STAFF'): Promise<void> {
  const db = getPrismaClient();
  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) return;

  if (type === 'STUDENT') {
    const count = await db.student.count({
      where: {
        schoolId,
        status: { in: ['ACTIVE', 'ENROLLED'] },
      },
    });
    if (count >= school.maxStudents) {
      throw new Error(
        `Student enrollment limit reached for this school (${count}/${school.maxStudents}). Upgrade your school plan to enroll more students.`
      );
    }
  } else if (type === 'STAFF') {
    const count = await db.user.count({
      where: {
        schoolId,
        isActive: true,
        role: { not: 'CREATOR' },
      },
    });
    if (count >= school.maxStaff) {
      throw new Error(
        `Staff user limit reached for this school (${count}/${school.maxStaff}). Upgrade your school plan to add more staff users.`
      );
    }
  }
}
