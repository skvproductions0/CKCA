import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import { recordPayment } from './fee.service';
import {
  generateAdmissionNumber,
  generateStudentId,
  rupeesToPaise,
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
  if (filters.status && (filters.status as string) !== 'ALL') {
    where.status = filters.status;
  } else {
    where.status = { not: 'ARCHIVED' };
  }

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

    const raw = { ...data };

    // Extract fee payment info before student creation
    const initialPayment = raw.initialPayment as {
      collectFee?: boolean;
      feeCategoryId?: string;
      totalAmount?: number;
      paidAmount?: number;
      paymentMethod?: string;
      paymentDate?: string;
      remarks?: string;
    } | undefined;
    delete raw.initialPayment;

    // Extract documents before passing to Prisma (not a Student field)
    const documents = Array.isArray(raw.documents) ? (raw.documents as Array<Record<string, unknown>>) : [];
    delete raw.documents;

    let classId = (typeof raw.classId === 'string' && raw.classId.trim()) ? raw.classId.trim() : null;
    if (classId) {
      const exists = await db.class.findUnique({ where: { id: classId } });
      if (!exists) classId = null;
    }

    let sectionId = (typeof raw.sectionId === 'string' && raw.sectionId.trim()) ? raw.sectionId.trim() : null;
    if (sectionId) {
      const exists = await db.section.findUnique({ where: { id: sectionId } });
      if (!exists) sectionId = null;
    }

    let academicYearId = (typeof raw.academicYearId === 'string' && raw.academicYearId.trim()) ? raw.academicYearId.trim() : null;
    if (academicYearId) {
      const exists = await db.academicYear.findUnique({ where: { id: academicYearId } });
      if (!exists) academicYearId = null;
    }
    if (!academicYearId) {
      const fallback = (await db.academicYear.findFirst({ where: { isCurrent: true } })) || (await db.academicYear.findFirst());
      academicYearId = fallback?.id || null;
    }

    raw.classId = classId;
    raw.sectionId = sectionId;
    raw.academicYearId = academicYearId;

    type StudentCreateInput = Parameters<typeof db.student.create>[0]['data'];
    const student = await db.student.create({
      data: {
        ...(raw as StudentCreateInput),
        studentId,
        admissionNumber,
      },
      include: { class: true, section: true, academicYear: true },
    });

    // Save documents if any
    if (documents.length > 0) {
      for (const doc of documents) {
        const pathValue = doc.filePath as string | undefined;
        if (!pathValue) continue;
        await db.document.create({
          data: {
            studentId: student.id,
            name: (doc.name as string) || 'Document',
            type: (doc.type as string) || 'OTHER',
            filePath: pathValue,
            fileSize: Number(doc.fileSize || 0),
            mimeType: (doc.mimeType as string) || 'application/octet-stream',
          },
        });
      }
    }

    // Create student fee record if academic year is set
    if (student.academicYearId) {
      const overrideTotalPaise = initialPayment?.totalAmount && initialPayment.totalAmount > 0
        ? rupeesToPaise(initialPayment.totalAmount)
        : undefined;

      await createStudentFeeRecord(
        student.id,
        student.academicYearId,
        student.classId || undefined,
        overrideTotalPaise
      );

      // Record initial payment if collected
      if (initialPayment?.paidAmount && initialPayment.paidAmount > 0) {
        try {
          await recordPayment({
            studentId: student.id,
            academicYearId: student.academicYearId,
            amountPaise: rupeesToPaise(initialPayment.paidAmount),
            paymentDate: initialPayment.paymentDate ? new Date(initialPayment.paymentDate) : new Date(),
            paymentMethod: initialPayment.paymentMethod || 'CASH',
            feeCategoryId: initialPayment.feeCategoryId || undefined,
            remarks: initialPayment.remarks || 'Admission fee payment',
            collectedById: userId,
          });
        } catch (paymentErr) {
          console.error('Initial payment recording notice:', paymentErr);
        }
      }
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
    const raw = { ...data };
    const documents = Array.isArray(raw.documents) ? (raw.documents as Array<Record<string, unknown>>) : null;
    delete raw.documents; // Remove so it doesn't pollute Prisma update data

    // Sanitize foreign keys
    let classId: string | null = null;
    if (typeof raw.classId === 'string' && raw.classId.trim()) {
      const exists = await db.class.findUnique({ where: { id: raw.classId.trim() } });
      if (exists) classId = exists.id;
    }

    let sectionId: string | null = null;
    if (typeof raw.sectionId === 'string' && raw.sectionId.trim()) {
      const exists = await db.section.findUnique({ where: { id: raw.sectionId.trim() } });
      if (exists) sectionId = exists.id;
    }

    let academicYearId: string | null = null;
    if (typeof raw.academicYearId === 'string' && raw.academicYearId.trim()) {
      const exists = await db.academicYear.findUnique({ where: { id: raw.academicYearId.trim() } });
      if (exists) academicYearId = exists.id;
    }

    // Sanitize dates
    let dateOfBirth: Date | null = null;
    if (raw.dateOfBirth) {
      const d = new Date(raw.dateOfBirth as string);
      if (!isNaN(d.getTime())) dateOfBirth = d;
    }

    let admissionDate: Date | null = null;
    if (raw.admissionDate) {
      const d = new Date(raw.admissionDate as string);
      if (!isNaN(d.getTime())) admissionDate = d;
    }

    const cleanData: Record<string, unknown> = {
      name: typeof raw.name === 'string' ? raw.name.trim() : undefined,
      fatherName: (raw.fatherName as string) || null,
      fatherMobile: (raw.fatherMobile as string) || null,
      fatherOccupation: (raw.fatherOccupation as string) || null,
      fatherEmail: (raw.fatherEmail as string) || null,
      motherName: (raw.motherName as string) || null,
      motherMobile: (raw.motherMobile as string) || null,
      motherOccupation: (raw.motherOccupation as string) || null,
      motherEmail: (raw.motherEmail as string) || null,
      guardianName: (raw.guardianName as string) || null,
      guardianMobile: (raw.guardianMobile as string) || null,
      guardianEmail: (raw.guardianEmail as string) || null,
      guardianRelation: (raw.guardianRelation as string) || null,
      gender: (raw.gender as string) || null,
      bloodGroup: (raw.bloodGroup as string) || null,
      aadhaarNumber: (raw.aadhaarNumber as string) || null,
      phone: (raw.phone as string) || null,
      email: (raw.email as string) || null,
      address: (raw.address as string) || null,
      city: (raw.city as string) || null,
      state: (raw.state as string) || null,
      pincode: (raw.pincode as string) || null,
      rollNumber: (raw.rollNumber as string) || null,
      emergencyContact: (raw.emergencyContact as string) || null,
      previousSchool: (raw.previousSchool as string) || null,
      previousClass: (raw.previousClass as string) || null,
      tcNumber: (raw.tcNumber as string) || null,
      remarks: (raw.remarks as string) || null,
      photoPath: (raw.photoPath as string) || null,
      status: (raw.status as string) || 'ACTIVE',
      classId,
      sectionId,
      academicYearId,
      dateOfBirth,
      admissionDate,
    };

    // Remove undefined values
    Object.keys(cleanData).forEach((key) => {
      if (cleanData[key] === undefined) {
        delete cleanData[key];
      }
    });

    const student = await db.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: cleanData as Parameters<typeof tx.student.update>[0]['data'],
        include: { class: true, section: true, academicYear: true, documents: true },
      });

      if (documents) {
        // Sync documents
        await tx.document.deleteMany({ where: { studentId: id } });
        for (const doc of documents) {
          const pathValue = doc.filePath as string | undefined;
          if (!pathValue) continue;
          await tx.document.create({
            data: {
              studentId: id,
              name: (doc.name as string) || 'Document',
              type: (doc.type as string) || 'OTHER',
              filePath: pathValue,
              fileSize: Number(doc.fileSize || 0),
              mimeType: (doc.mimeType as string) || 'application/octet-stream',
            },
          });
        }
      }

      return updated;
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
  await createAuditLog(userId, 'STUDENT_ARCHIVED', 'Student', id, `Moved student to Recycle Bin: ${student.name}`);
  return student;
}

export async function getDeletedStudents(filters: { search?: string; classId?: string; page?: number; limit?: number } = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    OR: [
      { deletedAt: { not: null } },
      { status: 'ARCHIVED' },
    ],
  };

  const andConditions: Record<string, unknown>[] = [];

  if (filters.search) {
    andConditions.push({
      OR: [
        { name: { contains: filters.search } },
        { admissionNumber: { contains: filters.search } },
        { studentId: { contains: filters.search } },
        { fatherName: { contains: filters.search } },
        { phone: { contains: filters.search } },
      ],
    });
  }

  if (filters.classId) {
    andConditions.push({ classId: filters.classId });
  }

  const queryWhere = andConditions.length > 0 ? { ...where, AND: andConditions } : where;

  const [students, total] = await Promise.all([
    db.student.findMany({
      where: queryWhere,
      include: {
        class: true,
        section: true,
        academicYear: true,
      },
      orderBy: { deletedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.student.count({ where: queryWhere }),
  ]);

  return {
    students,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function restoreStudent(id: string, userId: string) {
  const db = getPrismaClient();
  const student = await db.student.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      deletedAt: null,
    },
    include: { class: true, section: true },
  });
  await createAuditLog(userId, 'STUDENT_RESTORED', 'Student', id, `Restored student: ${student.name} from Recycle Bin`);
  return student;
}

export async function permanentDeleteStudent(id: string, userId: string) {
  const db = getPrismaClient();
  const student = await db.student.findUnique({ where: { id } });
  if (!student) throw new Error('Student not found');

  await db.$transaction(async (tx) => {
    await tx.admission.updateMany({ where: { studentId: id }, data: { studentId: null } });
    await tx.document.deleteMany({ where: { studentId: id } });
    await tx.result.deleteMany({ where: { studentId: id } });
    await tx.attendance.deleteMany({ where: { studentId: id } });
    await tx.feePayment.deleteMany({ where: { studentId: id } });
    await tx.studentFee.deleteMany({ where: { studentId: id } });
    await tx.student.delete({ where: { id } });
  });

  await createAuditLog(userId, 'STUDENT_DELETED_PERMANENTLY', 'Student', id, `Permanently deleted student: ${student.name}`);
  return { success: true, id };
}

export async function emptyRecycleBin(userId: string) {
  const db = getPrismaClient();
  const deletedStudents = await db.student.findMany({
    where: {
      OR: [
        { deletedAt: { not: null } },
        { status: 'ARCHIVED' },
      ],
    },
    select: { id: true, name: true },
  });

  if (deletedStudents.length === 0) {
    return { count: 0 };
  }

  const ids = deletedStudents.map(s => s.id);

  await db.$transaction(async (tx) => {
    await tx.admission.updateMany({ where: { studentId: { in: ids } }, data: { studentId: null } });
    await tx.document.deleteMany({ where: { studentId: { in: ids } } });
    await tx.result.deleteMany({ where: { studentId: { in: ids } } });
    await tx.attendance.deleteMany({ where: { studentId: { in: ids } } });
    await tx.feePayment.deleteMany({ where: { studentId: { in: ids } } });
    await tx.studentFee.deleteMany({ where: { studentId: { in: ids } } });
    await tx.student.deleteMany({ where: { id: { in: ids } } });
  });

  await createAuditLog(userId, 'RECYCLE_BIN_EMPTIED', 'Student', 'ALL', `Emptied Recycle Bin (${deletedStudents.length} students permanently deleted)`);
  return { count: deletedStudents.length };
}

async function createStudentFeeRecord(
  studentId: string,
  academicYearId: string,
  classId?: string,
  overrideTotalPaise?: number
) {
  try {
    const db = getPrismaClient();
    const existingFee = await db.studentFee.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
    });
    if (existingFee) return;

    let totalPaise = overrideTotalPaise ?? 0;
    let feeStructureId: string | undefined = undefined;

    if (classId) {
      const feeStructure = await db.feeStructure.findFirst({
        where: { classId, academicYearId, isActive: true },
        include: { items: true },
      });
      if (feeStructure) {
        if (overrideTotalPaise === undefined) {
          totalPaise = feeStructure.items.reduce((sum, item) => sum + item.amountPaise, 0);
        }
        feeStructureId = feeStructure.id;
      }
    }

    await db.studentFee.create({
      data: {
        studentId,
        feeStructureId,
        academicYearId,
        totalPaise,
        paidPaise: 0,
      },
    });
  } catch (err) {
    console.error('Non-blocking student fee creation notice:', err);
  }
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
