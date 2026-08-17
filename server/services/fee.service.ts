import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import {
  generateReceiptNumber,
  rupeesToPaise,
  calculateGrade,
  calculatePercentage,
  getErrorMessage,
} from '../utils/helpers';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export async function getFeeCategories() {
  const db = getPrismaClient();
  return db.feeCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
}

export async function getFeeStructures(academicYearId?: string) {
  const db = getPrismaClient();
  return db.feeStructure.findMany({
    where: { isActive: true, ...(academicYearId ? { academicYearId } : {}) },
    include: {
      class: true,
      items: { include: { feeCategory: true } },
      academicYear: true,
    },
  });
}

export async function createFeeStructure(data: {
  name: string;
  academicYearId: string;
  classId?: string;
  items: { feeCategoryId: string; amountPaise: number }[];
}, userId: string) {
  const db = getPrismaClient();
  const totalPaise = data.items.reduce((sum, item) => sum + item.amountPaise, 0);

  const structure = await db.feeStructure.create({
    data: {
      name: data.name,
      academicYearId: data.academicYearId,
      classId: data.classId,
      totalPaise,
      items: {
        create: data.items,
      },
    },
    include: { items: { include: { feeCategory: true } }, class: true },
  });

  await createAuditLog(userId, 'FEE_STRUCTURE_CREATED', 'FeeStructure', structure.id, data.name);
  return structure;
}

export async function getStudentFees(studentId: string, academicYearId?: string) {
  const db = getPrismaClient();
  return db.studentFee.findMany({
    where: {
      studentId,
      ...(academicYearId ? { academicYearId } : {}),
    },
    include: {
      feeStructure: { include: { items: { include: { feeCategory: true } } } },
      academicYear: true,
    },
  });
}

export async function recordPayment(data: {
  studentId: string;
  academicYearId: string;
  amountPaise: number;
  paymentDate: Date;
  paymentMethod: string;
  feeCategoryId?: string;
  remarks?: string;
  collectedById: string;
}) {
  const db = getPrismaClient();
  try {
    const year = new Date().getFullYear();
    let counter = await db.receiptCounter.findUnique({ where: { year } });
    if (!counter) {
      counter = await db.receiptCounter.create({ data: { year, counter: 0 } });
    }
    const newCounter = counter.counter + 1;
    await db.receiptCounter.update({ where: { year }, data: { counter: newCounter } });

    const receiptNumber = generateReceiptNumber(year, newCounter);

    const studentFee = await db.studentFee.findFirst({
      where: { studentId: data.studentId, academicYearId: data.academicYearId },
    });

    const previousDue = studentFee
      ? studentFee.totalPaise - studentFee.paidPaise
      : 0;

    const payment = await db.feePayment.create({
      data: {
        receiptNumber,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        amountPaise: data.amountPaise,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod as 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER',
        feeCategoryId: data.feeCategoryId,
        previousDuePaise: previousDue,
        currentDuePaise: Math.max(0, previousDue - data.amountPaise),
        remarks: data.remarks,
        collectedById: data.collectedById,
      },
      include: {
        student: { include: { class: true, section: true } },
        feeCategory: true,
        collectedBy: { select: { fullName: true } },
      },
    });

    if (studentFee) {
      const newPaid = studentFee.paidPaise + data.amountPaise;
      await db.studentFee.update({
        where: { id: studentFee.id },
        data: { paidPaise: newPaid },
      });
    }

    await createAuditLog(
      data.collectedById,
      'FEE_PAYMENT',
      'FeePayment',
      payment.id,
      `Payment of ₹${data.amountPaise / 100} for ${payment.student.name}`
    );

    return payment;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getPayments(filters: {
  search?: string;
  academicYearId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
} = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { status: 'COMPLETED' };
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters.startDate || filters.endDate) {
    where.paymentDate = {};
    if (filters.startDate) (where.paymentDate as Record<string, Date>).gte = filters.startDate;
    if (filters.endDate) (where.paymentDate as Record<string, Date>).lte = filters.endDate;
  }
  if (filters.search) {
    where.OR = [
      { receiptNumber: { contains: filters.search } },
      { student: { name: { contains: filters.search } } },
    ];
  }

  const [payments, total] = await Promise.all([
    db.feePayment.findMany({
      where,
      include: {
        student: { include: { class: true, section: true } },
        feeCategory: true,
        collectedBy: { select: { fullName: true } },
      },
      orderBy: { paymentDate: 'desc' },
      skip,
      take: limit,
    }),
    db.feePayment.count({ where }),
  ]);

  return { payments, total, page, totalPages: Math.ceil(total / limit) };
}

export async function cancelPayment(paymentId: string, userId: string) {
  const db = getPrismaClient();
  const payment = await db.feePayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('Payment not found.');
  if (payment.status !== 'COMPLETED') throw new Error('Payment is already cancelled.');

  await db.feePayment.update({
    where: { id: paymentId },
    data: { status: 'CANCELLED' },
  });

  const studentFee = await db.studentFee.findFirst({
    where: { studentId: payment.studentId, academicYearId: payment.academicYearId },
  });
  if (studentFee) {
    await db.studentFee.update({
      where: { id: studentFee.id },
      data: { paidPaise: Math.max(0, studentFee.paidPaise - payment.amountPaise) },
    });
  }

  await createAuditLog(userId, 'FEE_PAYMENT_CANCELLED', 'FeePayment', paymentId, `Cancelled payment ${payment.receiptNumber}`);
  return payment;
}

export async function getFeeReports(type: string, academicYearId?: string) {
  const db = getPrismaClient();
  const today = new Date();
  const yearFilter = academicYearId ? { academicYearId } : {};

  switch (type) {
    case 'daily': {
      const start = startOfDay(today);
      const end = endOfDay(today);
      const payments = await db.feePayment.findMany({
        where: { paymentDate: { gte: start, lte: end }, status: 'COMPLETED', ...yearFilter },
        include: { student: { include: { class: true, section: true } }, feeCategory: true },
      });
      const total = payments.reduce((sum, p) => sum + p.amountPaise, 0);
      return { payments, totalPaise: total, date: today };
    }
    case 'monthly': {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      const result = await db.feePayment.aggregate({
        where: { paymentDate: { gte: start, lte: end }, status: 'COMPLETED', ...yearFilter },
        _sum: { amountPaise: true },
        _count: true,
      });
      return { totalPaise: result._sum.amountPaise || 0, count: result._count, month: today.getMonth() + 1 };
    }
    case 'yearly': {
      const start = startOfYear(today);
      const end = endOfYear(today);
      const result = await db.feePayment.aggregate({
        where: { paymentDate: { gte: start, lte: end }, status: 'COMPLETED', ...yearFilter },
        _sum: { amountPaise: true },
        _count: true,
      });
      return { totalPaise: result._sum.amountPaise || 0, count: result._count, year: today.getFullYear() };
    }
    case 'pending': {
      const studentFees = await db.studentFee.findMany({
        where: yearFilter,
        include: {
          student: { include: { class: true, section: true } },
        },
      });
      return studentFees
        .filter(sf => sf.totalPaise - sf.paidPaise > 0)
        .map(sf => ({
          student: sf.student,
          totalPaise: sf.totalPaise,
          paidPaise: sf.paidPaise,
          pendingPaise: sf.totalPaise - sf.paidPaise,
        }));
    }
    case 'classwise': {
      const classes = await db.class.findMany({ where: { isActive: true } });
      const data = await Promise.all(
        classes.map(async (cls) => {
          const students = await db.student.findMany({
            where: { classId: cls.id, status: 'ACTIVE', ...yearFilter },
          });
          const studentIds = students.map(s => s.id);
          const fees = await db.studentFee.findMany({
            where: { studentId: { in: studentIds }, ...yearFilter },
          });
          const total = fees.reduce((s: number, f: { totalPaise: number }) => s + f.totalPaise, 0);
          const collected = fees.reduce((s: number, f: { paidPaise: number }) => s + f.paidPaise, 0);
          return { class: cls.name, totalPaise: total, collectedPaise: collected, pendingPaise: total - collected };
        })
      );
      return data;
    }
    default:
      throw new Error('Invalid report type.');
  }
}

export async function getPaymentById(id: string) {
  const db = getPrismaClient();
  const payment = await db.feePayment.findUnique({
    where: { id },
    include: {
      student: { include: { class: true, section: true } },
      feeCategory: true,
      collectedBy: { select: { fullName: true } },
      academicYear: true,
    },
  });
  if (!payment) throw new Error('Payment not found.');
  return payment;
}
