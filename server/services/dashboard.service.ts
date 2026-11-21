import { getPrismaClient } from '../database/client';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export async function getDashboardStats(academicYearId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const schoolFilter = schoolId ? { schoolId } : {};
  const studentWhere: Record<string, unknown> = {
    status: 'ACTIVE',
    deletedAt: null,
    ...schoolFilter,
  };
  if (academicYearId) {
    studentWhere.OR = [
      { academicYearId },
      { academicYearId: null },
    ];
  }
  const yearFilter = academicYearId ? { academicYearId } : {};
  const baseFilter = { ...yearFilter, ...schoolFilter };

  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    todayAttendance,
    todayPayments,
    monthlyPayments,
    pendingFees,
    totalAdmissions,
    recentPayments,
    recentAdmissions,
    recentResults,
    monthlyFeeData,
    attendanceData,
    classDistribution,
    examPerformance,
  ] = await Promise.all([
    db.student.count({ where: studentWhere }),
    db.teacher.count({ where: { status: 'ACTIVE', deletedAt: null, ...schoolFilter } }),
    db.class.count({ where: { isActive: true, deletedAt: null, ...schoolFilter } }),
    getTodayAttendanceStats(dayStart, dayEnd, academicYearId, schoolId),
    db.feePayment.aggregate({
      where: { paymentDate: { gte: dayStart, lte: dayEnd }, status: 'COMPLETED', ...baseFilter },
      _sum: { amountPaise: true },
    }),
    db.feePayment.aggregate({
      where: { paymentDate: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', ...baseFilter },
      _sum: { amountPaise: true },
    }),
    db.studentFee.aggregate({
      where: {
        ...baseFilter,
        student: { status: 'ACTIVE', deletedAt: null },
      },
      _sum: { totalPaise: true, paidPaise: true },
    }),
    db.admission.count({ where: baseFilter }),
    db.feePayment.findMany({
      where: { status: 'COMPLETED', ...baseFilter },
      include: { student: { select: { name: true, admissionNumber: true } } },
      orderBy: { paymentDate: 'desc' },
      take: 5,
    }),
    db.admission.findMany({
      where: baseFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.result.findMany({
      where: {
        ...baseFilter,
        ...(academicYearId ? { exam: { academicYearId } } : {}),
      },
      include: {
        student: { select: { name: true } },
        exam: { select: { name: true } },
        subject: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    getMonthlyFeeChart(academicYearId, schoolId),
    getAttendanceChart(academicYearId, schoolId),
    getClassDistribution(academicYearId, schoolId),
    getExamPerformance(academicYearId, schoolId),
  ]);

  const pendingPaise = Math.max(
    0,
    (pendingFees._sum.totalPaise || 0) - (pendingFees._sum.paidPaise || 0)
  );

  return {
    stats: {
      totalStudents,
      totalTeachers,
      totalClasses,
      todayAttendancePercent: todayAttendance.percent,
      todayCollectionPaise: todayPayments._sum.amountPaise || 0,
      monthlyCollectionPaise: monthlyPayments._sum.amountPaise || 0,
      pendingFeesPaise: pendingPaise,
      totalAdmissions,
    },
    recentActivity: {
      payments: recentPayments,
      admissions: recentAdmissions,
      results: recentResults,
    },
    charts: {
      monthlyFees: monthlyFeeData,
      attendance: attendanceData,
      classDistribution,
      examPerformance,
    },
  };
}

async function getTodayAttendanceStats(dayStart: Date, dayEnd: Date, academicYearId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const where: Record<string, unknown> = {
    date: { gte: dayStart, lte: dayEnd },
    ...(academicYearId ? { academicYearId } : {}),
    ...(schoolId ? { schoolId } : {}),
  };
  const total = await db.attendance.count({ where });
  const present = await db.attendance.count({ where: { ...where, status: 'PRESENT' } });
  return { total, present, percent: total > 0 ? Math.round((present / total) * 1000) / 10 : 0 };
}

async function getMonthlyFeeChart(academicYearId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = new Date().getFullYear();
  const data = [];

  for (let i = 0; i < 12; i++) {
    const start = new Date(year, i, 1);
    const end = new Date(year, i + 1, 0, 23, 59, 59);
    const result = await db.feePayment.aggregate({
      where: {
        paymentDate: { gte: start, lte: end },
        status: 'COMPLETED',
        ...(academicYearId ? { academicYearId } : {}),
        ...(schoolId ? { schoolId } : {}),
      },
      _sum: { amountPaise: true },
    });
    data.push({ month: months[i], amount: (result._sum.amountPaise || 0) / 100 });
  }
  return data;
}

async function getAttendanceChart(academicYearId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const now = new Date();
  const data = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const where: Record<string, unknown> = {
      date: { gte: start, lte: end },
      ...(academicYearId ? { academicYearId } : {}),
      ...(schoolId ? { schoolId } : {}),
    };
    const total = await db.attendance.count({ where });
    const present = await db.attendance.count({ where: { ...where, status: 'PRESENT' } });
    data.push({
      month: monthNames[d.getMonth()],
      present: total > 0 ? Math.round((present / total) * 100) : 0,
    });
  }
  return data;
}

async function getClassDistribution(academicYearId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const classes = await db.class.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(schoolId ? { schoolId } : {}),
    },
    orderBy: { numericOrder: 'asc' },
  });

  const data = await Promise.all(
    classes.map(async (cls) => {
      const studentWhere: Record<string, unknown> = {
        classId: cls.id,
        status: 'ACTIVE',
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
      };
      if (academicYearId) {
        studentWhere.OR = [
          { academicYearId },
          { academicYearId: null },
        ];
      }
      const count = await db.student.count({ where: studentWhere });
      return { name: cls.name, students: count };
    })
  );
  return data.filter(d => d.students > 0);
}

async function getExamPerformance(academicYearId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const exams = await db.exam.findMany({
    where: {
      ...(academicYearId ? { academicYearId } : {}),
      ...(schoolId ? { schoolId } : {}),
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const data = await Promise.all(
    exams.map(async (exam) => {
      const results = await db.result.findMany({
        where: { examId: exam.id, ...(schoolId ? { schoolId } : {}) },
      });
      const avg = results.length > 0
        ? results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length
        : 0;
      return { name: exam.name, average: Math.round(avg * 10) / 10 };
    })
  );
  return data;
}
