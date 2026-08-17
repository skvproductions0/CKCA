import { getPrismaClient } from '../database/client';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export async function getDashboardStats(academicYearId?: string) {
  const db = getPrismaClient();
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const yearFilter = academicYearId ? { academicYearId } : {};

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
    db.student.count({ where: { status: 'ACTIVE', deletedAt: null, ...yearFilter } }),
    db.teacher.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    db.class.count({ where: { isActive: true, deletedAt: null } }),
    getTodayAttendanceStats(dayStart, dayEnd, academicYearId),
    db.feePayment.aggregate({
      where: { paymentDate: { gte: dayStart, lte: dayEnd }, status: 'COMPLETED', ...yearFilter },
      _sum: { amountPaise: true },
    }),
    db.feePayment.aggregate({
      where: { paymentDate: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED', ...yearFilter },
      _sum: { amountPaise: true },
    }),
    db.studentFee.aggregate({
      where: yearFilter,
      _sum: { totalPaise: true, paidPaise: true },
    }),
    db.admission.count({ where: { ...yearFilter } }),
    db.feePayment.findMany({
      where: { status: 'COMPLETED', ...yearFilter },
      include: { student: { select: { name: true, admissionNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.admission.findMany({
      where: yearFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.result.findMany({
      where: yearFilter,
      include: {
        student: { select: { name: true } },
        exam: { select: { name: true } },
        subject: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    getMonthlyFeeChart(academicYearId),
    getAttendanceChart(academicYearId),
    getClassDistribution(academicYearId),
    getExamPerformance(academicYearId),
  ]);

  const pendingPaise = (pendingFees._sum.totalPaise || 0) - (pendingFees._sum.paidPaise || 0);

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

async function getTodayAttendanceStats(dayStart: Date, dayEnd: Date, academicYearId?: string) {
  const db = getPrismaClient();
  const where = {
    date: { gte: dayStart, lte: dayEnd },
    ...(academicYearId ? { academicYearId } : {}),
  };
  const total = await db.attendance.count({ where });
  const present = await db.attendance.count({ where: { ...where, status: 'PRESENT' } });
  return { total, present, percent: total > 0 ? Math.round((present / total) * 1000) / 10 : 0 };
}

async function getMonthlyFeeChart(academicYearId?: string) {
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
      },
      _sum: { amountPaise: true },
    });
    data.push({ month: months[i], amount: (result._sum.amountPaise || 0) / 100 });
  }
  return data;
}

async function getAttendanceChart(academicYearId?: string) {
  const db = getPrismaClient();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const year = new Date().getFullYear();
  const data = [];

  for (let i = 0; i < 6; i++) {
    const start = new Date(year, i, 1);
    const end = new Date(year, i + 1, 0, 23, 59, 59);
    const where = {
      date: { gte: start, lte: end },
      ...(academicYearId ? { academicYearId } : {}),
    };
    const total = await db.attendance.count({ where });
    const present = await db.attendance.count({ where: { ...where, status: 'PRESENT' } });
    data.push({
      month: months[i],
      present: total > 0 ? Math.round((present / total) * 100) : 0,
    });
  }
  return data;
}

async function getClassDistribution(academicYearId?: string) {
  const db = getPrismaClient();
  const classes = await db.class.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { numericOrder: 'asc' },
  });

  const data = await Promise.all(
    classes.map(async (cls) => {
      const count = await db.student.count({
        where: {
          classId: cls.id,
          status: 'ACTIVE',
          deletedAt: null,
          ...(academicYearId ? { academicYearId } : {}),
        },
      });
      return { name: cls.name, students: count };
    })
  );
  return data.filter(d => d.students > 0);
}

async function getExamPerformance(academicYearId?: string) {
  const db = getPrismaClient();
  const exams = await db.exam.findMany({
    where: { ...(academicYearId ? { academicYearId } : {}) },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const data = await Promise.all(
    exams.map(async (exam) => {
      const results = await db.result.findMany({ where: { examId: exam.id } });
      const avg = results.length > 0
        ? results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length
        : 0;
      return { name: exam.name, average: Math.round(avg * 10) / 10 };
    })
  );
  return data;
}
