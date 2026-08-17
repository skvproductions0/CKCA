import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import {
  generateAdmissionNumber,
  generateStudentId,
  getErrorMessage,
} from '../utils/helpers';

type Gender = 'MALE' | 'FEMALE' | 'OTHER';
type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'ARCHIVED';

interface StudentFilters {
  search?: string;
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
  gender?: Gender;
  status?: StudentStatus;
  feeStatus?: 'paid' | 'partial' | 'pending';
  page?: number;
  limit?: number;
}

export async function getStudents(filters: StudentFilters = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { admissionNumber: { contains: filters.search } },
      { studentId: { contains: filters.search } },
      { fatherName: { contains: filters.search } },
      { phone: { contains: filters.search } },
      { rollNumber: { contains: filters.search } },
    ];
  }
  if (filters.classId) where.classId = filters.classId;
  if (filters.sectionId) where.sectionId = filters.sectionId;
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters.gender) where.gender = filters.gender;
  if (filters.status) where.status = filters.status;
  else where.status = 'ACTIVE';

  const [students, total] = await Promise.all([
    db.student.findMany({
      where,
      include: {
        class: true,
        section: true,
        academicYear: true,
        studentFees: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.student.count({ where }),
  ]);

  let filteredStudents = students;
  if (filters.feeStatus) {
    filteredStudents = students.filter(s => {
      const fee = s.studentFees[0];
      if (!fee) return filters.feeStatus === 'pending';
      const pending = fee.totalPaise - fee.paidPaise;
      if (filters.feeStatus === 'paid') return pending <= 0;
      if (filters.feeStatus === 'partial') return pending > 0 && fee.paidPaise > 0;
      return pending > 0;
    });
  }

  return {
    students: filteredStudents.map(s => ({
      ...s,
      pendingFeePaise: s.studentFees[0]
        ? s.studentFees[0].totalPaise - s.studentFees[0].paidPaise
        : 0,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getStudentById(id: string) {
  const db = getPrismaClient();
  const student = await db.student.findUnique({
    where: { id },
    include: {
      class: true,
      section: true,
      academicYear: true,
      studentFees: { include: { feeStructure: { include: { items: { include: { feeCategory: true } } } } } },
      feePayments: { orderBy: { paymentDate: 'desc' }, include: { feeCategory: true, collectedBy: { select: { fullName: true } } } },
      attendances: { orderBy: { date: 'desc' }, take: 30 },
      results: { include: { exam: true, subject: true }, orderBy: { createdAt: 'desc' } },
      documents: true,
    },
  });
  if (!student) throw new Error('Student not found.');
  return student;
}

export async function createStudent(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    const year = new Date().getFullYear();
    let counter = await db.admissionCounter.findUnique({ where: { year } });
    if (!counter) {
      counter = await db.admissionCounter.create({ data: { year, counter: 0 } });
    }
    const newCounter = counter.counter + 1;
    await db.admissionCounter.update({ where: { year }, data: { counter: newCounter } });

    const admissionNumber = generateAdmissionNumber(year, newCounter);
    const studentId = generateStudentId(year, newCounter);

    type StudentCreateInput = Parameters<typeof db.student.create>[0]['data'];
    const student = await db.student.create({
      data: {
        ...(data as StudentCreateInput),
        studentId,
        admissionNumber,
      },
      include: { class: true, section: true, academicYear: true },
    });

    // Create student fee record if academic year is set
    if (student.academicYearId) {
      await createStudentFeeRecord(student.id, student.academicYearId, student.classId || undefined);
    }

    await createAuditLog(userId, 'STUDENT_CREATED', 'Student', student.id, `Created student: ${student.name}`);
    return student;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateStudent(id: string, data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    type StudentUpdateInput = Parameters<typeof db.student.update>[0]['data'];
    const student = await db.student.update({
      where: { id },
      data: data as StudentUpdateInput,
      include: { class: true, section: true, academicYear: true },
    });
    await createAuditLog(userId, 'STUDENT_UPDATED', 'Student', id, `Updated student: ${student.name}`);
    return student;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function archiveStudent(id: string, userId: string) {
  const db = getPrismaClient();
  const student = await db.student.update({
    where: { id },
    data: { status: 'ARCHIVED', deletedAt: new Date() },
  });
  await createAuditLog(userId, 'STUDENT_ARCHIVED', 'Student', id, `Archived student: ${student.name}`);
  return student;
}

async function createStudentFeeRecord(studentId: string, academicYearId: string, classId?: string) {
  const db = getPrismaClient();
  let totalPaise = 0;

  if (classId) {
    const feeStructure = await db.feeStructure.findFirst({
      where: { classId, academicYearId, isActive: true },
      include: { items: true },
    });
    if (feeStructure) {
      totalPaise = feeStructure.items.reduce((sum, item) => sum + item.amountPaise, 0);
      await db.studentFee.create({
        data: {
          studentId,
          feeStructureId: feeStructure.id,
          academicYearId,
          totalPaise,
          paidPaise: 0,
        },
      });
      return;
    }
  }

  await db.studentFee.create({
    data: { studentId, academicYearId, totalPaise: 0, paidPaise: 0 },
  });
}

export async function getStudentAttendanceSummary(studentId: string, academicYearId?: string) {
  const db = getPrismaClient();
  const where: Record<string, unknown> = { studentId };
  if (academicYearId) (where as Record<string, unknown>).academicYearId = academicYearId;

  const [total, present, absent, leave] = await Promise.all([
    db.attendance.count({ where }),
    db.attendance.count({ where: { ...where, status: 'PRESENT' } }),
    db.attendance.count({ where: { ...where, status: 'ABSENT' } }),
    db.attendance.count({ where: { ...where, status: 'LEAVE' } }),
  ]);

  return {
    workingDays: total,
    present,
    absent,
    leave,
    percentage: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
  };
}
