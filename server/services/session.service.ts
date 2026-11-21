import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';

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

export async function getSessionsWithStats(schoolId?: string) {
  const db = getPrismaClient();
  const sessions = await db.academicYear.findMany({
    where: { ...(schoolId ? { schoolId } : {}) },
    include: {
      _count: {
        select: {
          students: true,
          exams: true,
          attendances: true,
          feePayments: true,
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  return sessions.map((s) => ({
    ...s,
    studentCount: s._count.students,
    examCount: s._count.exams,
    paymentCount: s._count.feePayments,
    isReadOnly: !s.isCurrent || s.isClosed,
  }));
}

export async function createAcademicSession(
  data: {
    name: string;
    startDate: string | Date;
    endDate: string | Date;
    isCurrent?: boolean;
    schoolId?: string;
  },
  userId: string,
  targetSchoolId?: string
) {
  const db = getPrismaClient();
  const schoolId = targetSchoolId || data.schoolId || null;

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  if (start >= end) {
    throw new Error('Start date must be earlier than end date.');
  }

  // Check if session name already exists for this school
  const existing = await db.academicYear.findFirst({
    where: {
      name: data.name.trim(),
      ...(schoolId ? { schoolId } : {}),
    },
  });

  if (existing) {
    throw new Error(`An academic session named "${data.name}" already exists for this school.`);
  }

  if (data.isCurrent) {
    // Exactly one active session per school
    await db.academicYear.updateMany({
      where: { ...(schoolId ? { schoolId } : {}) },
      data: { isCurrent: false, isClosed: true },
    });
  }

  const session = await db.academicYear.create({
    data: {
      name: data.name.trim(),
      startDate: start,
      endDate: end,
      isCurrent: Boolean(data.isCurrent),
      isClosed: false,
      schoolId,
    },
  });

  await createAuditLog(
    userId,
    'ACADEMIC_SESSION_CREATED',
    'AcademicYear',
    session.id,
    `Created session "${session.name}" (${start.toISOString().split('T')[0]} to ${
      end.toISOString().split('T')[0]
    })${data.isCurrent ? ' and set as ACTIVE' : ''}`,
    schoolId
  );

  return session;
}

export async function setActiveAcademicSession(id: string, userId: string, targetSchoolId?: string) {
  const db = getPrismaClient();

  const targetSession = await db.academicYear.findUnique({ where: { id } });
  if (!targetSession) {
    throw new Error(`Academic session "${id}" not found.`);
  }

  if (targetSchoolId && targetSession.schoolId && targetSession.schoolId !== targetSchoolId) {
    throw new Error('Access denied. Academic session belongs to another school.');
  }

  const schoolId = targetSchoolId || targetSession.schoolId || null;

  // Set all other sessions for this school as inactive & closed (read-only)
  await db.academicYear.updateMany({
    where: { ...(schoolId ? { schoolId } : {}) },
    data: { isCurrent: false, isClosed: true },
  });

  // Activate targeted session
  const activeSession = await db.academicYear.update({
    where: { id },
    data: { isCurrent: true, isClosed: false },
  });

  await createAuditLog(
    userId,
    'ACADEMIC_SESSION_ACTIVATED',
    'AcademicYear',
    activeSession.id,
    `Set academic session "${activeSession.name}" as ACTIVE. Historical sessions set to read-only.`,
    schoolId
  );

  return activeSession;
}

export async function assertSessionWritable(academicYearId?: string): Promise<void> {
  if (!academicYearId) return;
  const db = getPrismaClient();
  const session = await db.academicYear.findUnique({ where: { id: academicYearId } });
  if (session && (session.isClosed || !session.isCurrent)) {
    throw new Error(
      `Historical academic session "${session.name}" is closed and read-only. Data modifications are only permitted in the active session.`
    );
  }
}

export async function previewSessionRollover(
  sourceSessionId: string,
  targetSessionId: string,
  schoolId?: string
): Promise<RolloverPreviewResult> {
  const db = getPrismaClient();

  const [sourceSession, targetSession] = await Promise.all([
    db.academicYear.findUnique({ where: { id: sourceSessionId } }),
    db.academicYear.findUnique({ where: { id: targetSessionId } }),
  ]);

  if (!sourceSession) throw new Error('Source academic session not found.');
  if (!targetSession) throw new Error('Target academic session not found.');
  if (sourceSession.id === targetSession.id) {
    throw new Error('Source and target academic sessions must be different.');
  }

  if (schoolId) {
    if (sourceSession.schoolId && sourceSession.schoolId !== schoolId) {
      throw new Error('Access denied. Source academic session belongs to another school.');
    }
    if (targetSession.schoolId && targetSession.schoolId !== schoolId) {
      throw new Error('Access denied. Target academic session belongs to another school.');
    }
  }

  const effectiveSchoolId = schoolId || sourceSession.schoolId || undefined;

  // Load all classes ordered by numericOrder
  const classes = await db.class.findMany({
    where: { ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}) },
    orderBy: { numericOrder: 'asc' },
  });

  const classMap = new Map<string, (typeof classes)[0]>();
  classes.forEach((c) => classMap.set(c.id, c));

  // Load all active/enrolled students in source session
  const students = await db.student.findMany({
    where: {
      status: { in: ['ACTIVE', 'ENROLLED'] },
      OR: [{ academicYearId: sourceSessionId }, { academicYearId: null }],
      ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
    },
    include: {
      class: true,
      studentFees: {
        where: { academicYearId: sourceSessionId },
      },
    },
    orderBy: [{ classId: 'asc' }, { name: 'asc' }],
  });

  const studentPreviews: RolloverStudentPreview[] = [];
  const classSummaryMap = new Map<string, { fromClass: string; toClass: string; count: number }>();
  let totalPendingDuesPaise = 0;
  let toPromoteCount = 0;
  let toGraduateCount = 0;

  for (const student of students) {
    const currentClass = student.classId ? classMap.get(student.classId) : null;
    let nextClass: (typeof classes)[0] | null = null;
    let action: 'PROMOTE' | 'GRADUATE' = 'PROMOTE';

    if (currentClass) {
      // Find class with the next numericOrder
      const nextClasses = classes.filter((c) => c.numericOrder > currentClass.numericOrder);
      if (nextClasses.length > 0) {
        nextClass = nextClasses[0];
      } else {
        // Highest class in school -> Graduate
        action = 'GRADUATE';
      }
    }

    if (action === 'PROMOTE') {
      toPromoteCount++;
    } else {
      toGraduateCount++;
    }

    // Calculate pending dues in source session
    let pendingDue = 0;
    if (student.studentFees && student.studentFees.length > 0) {
      const sf = student.studentFees[0];
      const prev = sf.previousDuePaise || 0;
      pendingDue = Math.max(0, sf.totalPaise + prev - sf.paidPaise - sf.discountPaise);
    }
    totalPendingDuesPaise += pendingDue;

    const fromClassName = currentClass?.name ? `Class ${currentClass.name}` : 'Unassigned';
    const toClassName =
      action === 'GRADUATE' ? 'Graduated (Alumni)' : nextClass?.name ? `Class ${nextClass.name}` : 'Graduated';

    // Summary key
    const summaryKey = `${fromClassName}->${toClassName}`;
    const existingSummary = classSummaryMap.get(summaryKey);
    if (existingSummary) {
      existingSummary.count++;
    } else {
      classSummaryMap.set(summaryKey, {
        fromClass: fromClassName,
        toClass: toClassName,
        count: 1,
      });
    }

    studentPreviews.push({
      studentId: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      currentClassId: currentClass?.id || null,
      currentClassName: fromClassName,
      nextClassId: nextClass?.id || null,
      nextClassName: toClassName,
      action,
      pendingDuePaise: pendingDue,
    });
  }

  return {
    sourceSession: { id: sourceSession.id, name: sourceSession.name },
    targetSession: { id: targetSession.id, name: targetSession.name },
    totalStudents: students.length,
    toPromoteCount,
    toGraduateCount,
    totalPendingDuesPaise,
    classSummaries: Array.from(classSummaryMap.values()),
    students: studentPreviews,
  };
}

export async function executeSessionRollover(
  options: {
    sourceSessionId: string;
    targetSessionId: string;
    carryForwardDues: boolean;
    setActive: boolean;
    studentOverrides?: Record<string, 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'SKIP'>;
  },
  userId: string,
  schoolId?: string
) {
  const db = getPrismaClient();

  const preview = await previewSessionRollover(options.sourceSessionId, options.targetSessionId, schoolId);

  const overrides = options.studentOverrides || {};
  let promoted = 0;
  let retained = 0;
  let graduated = 0;
  let skipped = 0;
  let duesCarriedForwardPaise = 0;

  for (const item of preview.students) {
    const action = overrides[item.studentId] || item.action;

    if (action === 'SKIP') {
      skipped++;
      continue;
    }

    if (action === 'GRADUATE') {
      await db.student.update({
        where: { id: item.studentId },
        data: {
          status: 'GRADUATED',
          academicYearId: options.targetSessionId,
        },
      });
      graduated++;
    } else if (action === 'PROMOTE') {
      await db.student.update({
        where: { id: item.studentId },
        data: {
          classId: item.nextClassId,
          academicYearId: options.targetSessionId,
          // Clear section assignment so class teacher can assign new sections
          sectionId: null,
        },
      });
      promoted++;
    } else if (action === 'RETAIN') {
      await db.student.update({
        where: { id: item.studentId },
        data: {
          academicYearId: options.targetSessionId,
          sectionId: null,
        },
      });
      retained++;
    }

    // Carry forward pending fee dues as opening balance in target session
    if (options.carryForwardDues && item.pendingDuePaise > 0) {
      await db.studentFee.upsert({
        where: {
          studentId_academicYearId: {
            studentId: item.studentId,
            academicYearId: options.targetSessionId,
          },
        },
        update: {
          previousDuePaise: item.pendingDuePaise,
        },
        create: {
          studentId: item.studentId,
          academicYearId: options.targetSessionId,
          previousDuePaise: item.pendingDuePaise,
          totalPaise: 0,
          paidPaise: 0,
          schoolId: schoolId || undefined,
        },
      });
      duesCarriedForwardPaise += item.pendingDuePaise;
    }
  }

  if (options.setActive) {
    await setActiveAcademicSession(options.targetSessionId, userId, schoolId);
  }

  await createAuditLog(
    userId,
    'SESSION_ROLLOVER_EXECUTED',
    'AcademicYear',
    options.targetSessionId,
    `Rolled over session "${preview.sourceSession.name}" -> "${preview.targetSession.name}". Promoted: ${promoted}, Retained: ${retained}, Graduated: ${graduated}, Carried forward dues: ₹${(
      duesCarriedForwardPaise / 100
    ).toLocaleString('en-IN')}`,
    schoolId
  );

  return {
    success: true,
    sourceSession: preview.sourceSession,
    targetSession: preview.targetSession,
    promoted,
    retained,
    graduated,
    skipped,
    totalProcessed: promoted + retained + graduated,
    duesCarriedForwardPaise,
    isActiveNow: options.setActive,
  };
}
