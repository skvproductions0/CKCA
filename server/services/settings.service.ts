import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import { getErrorMessage } from '../utils/helpers';

export async function getSchoolSettings() {
  const db = getPrismaClient();
  return db.schoolSetting.findFirst();
}

export async function updateSchoolSettings(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  const existing = await db.schoolSetting.findFirst();
  if (!existing) throw new Error('School settings not found.');

  type SchoolSettingUpdateInput = Parameters<typeof db.schoolSetting.update>[0]['data'];
  const payload = data as SchoolSettingUpdateInput;
  const settings = await db.schoolSetting.update({
    where: { id: existing.id },
    data: payload,
  });
  await createAuditLog(userId, 'SETTINGS_UPDATED', 'SchoolSetting', settings.id, 'School settings updated');
  return settings;
}

export async function getUsers() {
  const db = getPrismaClient();
  const users = await db.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true, username: true, email: true, fullName: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return users;
}

export async function updateUser(id: string, data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  type UserUpdateInput = Parameters<typeof db.user.update>[0]['data'];
  const payload = data as UserUpdateInput;
  const user = await db.user.update({
    where: { id },
    data: payload,
    select: {
      id: true, username: true, email: true, fullName: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
  await createAuditLog(userId, 'USER_UPDATED', 'User', id, `Updated user: ${user.username}`);
  return user;
}

export async function getAuditLogs(filters: { page?: number; limit?: number; action?: string } = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const where = filters.action ? { action: { contains: filters.action } } : {};

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getNotifications(userId?: string) {
  const db = getPrismaClient();
  return db.notification.findMany({
    where: userId ? { OR: [{ userId }, { userId: null }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationRead(id: string) {
  const db = getPrismaClient();
  return db.notification.update({ where: { id }, data: { isRead: true } });
}

export async function createNotification(data: {
  title: string;
  message: string;
  type?: string;
  userId?: string;
  link?: string;
}) {
  const db = getPrismaClient();
  return db.notification.create({
    data: {
      title: data.title,
      message: data.message,
      type: (data.type || 'INFO') as 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR',
      userId: data.userId,
      link: data.link,
    },
  });
}

export async function getAdmissions(filters: { status?: string; academicYearId?: string; page?: number; limit?: number } = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;

  const [admissions, total] = await Promise.all([
    db.admission.findMany({
      where,
      include: { academicYear: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.admission.count({ where }),
  ]);

  return { admissions, total, page, totalPages: Math.ceil(total / limit) };
}

export async function createAdmission(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    const year = new Date().getFullYear();
    let counter = await db.admissionCounter.findUnique({ where: { year } });
    if (!counter) {
      counter = await db.admissionCounter.create({ data: { year, counter: 0 } });
    }
    const newCounter = counter.counter + 1;
    await db.admissionCounter.update({ where: { year }, data: { counter: newCounter } });

    const admissionNumber = `ADM-${year}-${String(newCounter).padStart(4, '0')}`;

    type AdmissionCreateInput = Parameters<typeof db.admission.create>[0]['data'];
    // build create data and use `student.connect` when studentId provided
    const raw = data as Record<string, any>;
    const createData: Record<string, any> = { ...raw, admissionNumber };
    if (raw.studentId) {
      createData.studentId = raw.studentId;
    }

    const admission = await db.admission.create({
      data: createData as Parameters<typeof db.admission.create>[0]['data'],
    });

    await createNotification({
      title: 'New Admission',
      message: `New admission application: ${admission.name}`,
      type: 'ADMISSION',
    });

    await createAuditLog(userId, 'ADMISSION_CREATED', 'Admission', admission.id, admission.name);
    return admission;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function createAdmissionWizard(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();

  const payload = data as Record<string, unknown>;
  const details = (payload.details as Record<string, unknown>) || {};
  const parent = (payload.parent as Record<string, unknown>) || {};
  const academic = (payload.academic as Record<string, unknown>) || {};
  const documents = (payload.documents as Array<Record<string, unknown>>) || [];
  const fee = (payload.fee as Record<string, unknown>) || {};
  const files = (payload.files as Array<Record<string, unknown>>) || [];
  const draft = Boolean(payload.draft);

  const year = new Date().getFullYear();
  let counter = await db.admissionCounter.findUnique({ where: { year } });
  if (!counter) {
    counter = await db.admissionCounter.create({ data: { year, counter: 0 } });
  }
  const newCounter = counter.counter + 1;
  await db.admissionCounter.update({ where: { year }, data: { counter: newCounter } });

  const admissionNumber = `ADM-${year}-${String(newCounter).padStart(4, '0')}`;

  // Validate and sanitize foreign keys
  let academicYearId = (typeof academic.academicYearId === 'string' && academic.academicYearId.trim()) ? academic.academicYearId.trim() : null;
  if (academicYearId) {
    const exists = await db.academicYear.findUnique({ where: { id: academicYearId } });
    if (!exists) academicYearId = null;
  }
  if (!academicYearId) {
    const fallbackYear = (await db.academicYear.findFirst({ where: { isCurrent: true } })) || (await db.academicYear.findFirst());
    if (fallbackYear) {
      academicYearId = fallbackYear.id;
    } else {
      throw new Error('No Academic Year found. Please configure an Academic Year first.');
    }
  }

  let classId = (typeof academic.classId === 'string' && academic.classId.trim()) ? academic.classId.trim() : null;
  if (classId) {
    const exists = await db.class.findUnique({ where: { id: classId } });
    if (!exists) classId = null;
  }

  let sectionId = (typeof academic.sectionId === 'string' && academic.sectionId.trim()) ? academic.sectionId.trim() : null;
  if (sectionId) {
    const exists = await db.section.findUnique({ where: { id: sectionId } });
    if (!exists) sectionId = null;
  }

  let feeCategoryId = (fee && typeof fee.feeCategoryId === 'string' && fee.feeCategoryId.trim()) ? fee.feeCategoryId.trim() : null;
  if (feeCategoryId) {
    const exists = await db.feeCategory.findUnique({ where: { id: feeCategoryId } });
    if (!exists) feeCategoryId = null;
  }

  const admissionData = {
    academicYearId,
    admissionNumber,
    name: details.fullName as string,
    fatherName: (parent.fatherName as string) || null,
    fatherMobile: (parent.fatherMobile as string) || null,
    fatherOccupation: (parent.fatherOccupation as string) || null,
    fatherEmail: (parent.fatherEmail as string) || null,
    motherName: (parent.motherName as string) || null,
    motherMobile: (parent.motherMobile as string) || null,
    motherOccupation: (parent.motherOccupation as string) || null,
    motherEmail: (parent.motherEmail as string) || null,
    guardianName: (parent.guardianName as string) || null,
    guardianMobile: (parent.guardianMobile as string) || null,
    guardianEmail: (parent.guardianEmail as string) || null,
    guardianRelation: (parent.guardianRelation as string) || null,
    dateOfBirth: details.dateOfBirth ? new Date(details.dateOfBirth as string) : null,
    gender: (details.gender as string) || null,
    bloodGroup: (details.bloodGroup as string) || null,
    aadhaarNumber: (details.aadhaarNumber as string) || null,
    phone: (parent.fatherMobile as string) || (parent.motherMobile as string) || (parent.guardianMobile as string) || null,
    email: (parent.fatherEmail as string) || (parent.motherEmail as string) || (parent.guardianEmail as string) || null,
    address: (parent.address as string) || null,
    city: (parent.city as string) || null,
    state: (parent.state as string) || null,
    pincode: (parent.pincode as string) || null,
    previousSchool: (details.previousSchool as string) || null,
    previousClass: (academic.previousClass as string) || null,
    tcNumber: (academic.tcNumber as string) || null,
    classId,
    sectionId,
    rollNumber: (academic.rollNumber as string) || null,
    admissionDate: academic.admissionDate ? new Date(academic.admissionDate as string) : new Date(),
    status: draft ? 'PENDING' : ((academic.admissionStatus as string) || 'ENROLLED'),
    metadata: JSON.stringify({ documents, fee, files }),
    photoPath: (details.photoPath as string) || null,
    remarks: (payload.remarks as string) || null,
  };

  const result = await db.$transaction(async (tx) => {
    let studentId: string | undefined;

    if (!draft) {
      console.log('[WIZARD] Creating student with:', {
        classId, sectionId, academicYearId,
        name: details.fullName,
        admissionNumber,
      });
      const student = await tx.student.create({
        data: {
          studentId: `STU-${year}-${String(newCounter).padStart(4, '0')}`,
          admissionNumber,
          name: details.fullName as string,
          fatherName: (parent.fatherName as string) || null,
          fatherMobile: (parent.fatherMobile as string) || null,
          fatherOccupation: (parent.fatherOccupation as string) || null,
          fatherEmail: (parent.fatherEmail as string) || null,
          motherName: (parent.motherName as string) || null,
          motherMobile: (parent.motherMobile as string) || null,
          motherOccupation: (parent.motherOccupation as string) || null,
          motherEmail: (parent.motherEmail as string) || null,
          guardianName: (parent.guardianName as string) || null,
          guardianMobile: (parent.guardianMobile as string) || null,
          guardianEmail: (parent.guardianEmail as string) || null,
          guardianRelation: (parent.guardianRelation as string) || null,
          dateOfBirth: details.dateOfBirth ? new Date(details.dateOfBirth as string) : null,
          gender: (details.gender as string) || null,
          bloodGroup: (details.bloodGroup as string) || null,
          aadhaarNumber: (details.aadhaarNumber as string) || null,
          phone: (parent.fatherMobile as string) || (parent.motherMobile as string) || (parent.guardianMobile as string) || null,
          email: (parent.fatherEmail as string) || (parent.motherEmail as string) || (parent.guardianEmail as string) || null,
          address: (parent.address as string) || null,
          city: (parent.city as string) || null,
          state: (parent.state as string) || null,
          pincode: (parent.pincode as string) || null,
          classId: classId || null,
          sectionId: sectionId || null,
          rollNumber: (academic.rollNumber as string) || null,
          admissionDate: academic.admissionDate ? new Date(academic.admissionDate as string) : new Date(),
          academicYearId: academicYearId || null,
          photoPath: (details.photoPath as string) || null,
          previousSchool: (details.previousSchool as string) || null,
          previousClass: (academic.previousClass as string) || null,
          tcNumber: (academic.tcNumber as string) || null,
          status: 'ACTIVE',
        },
      });
      studentId = student.id;
    }

    const admissionCreateData: Record<string, any> = {
      ...(admissionData as Parameters<typeof tx.admission.create>[0]['data']),
    };
    if (studentId) {
      admissionCreateData.studentId = studentId;
    }

    const admission = await tx.admission.create({
      data: admissionCreateData as Parameters<typeof tx.admission.create>[0]['data'],
    });

    if (!draft && details.photoPath) {
      await tx.document.create({
        data: {
          studentId: studentId as string,
          name: 'Student Photo',
          type: 'PHOTO',
          filePath: details.photoPath as string,
          fileSize: 0,
          mimeType: 'image/jpeg',
        },
      });
    }

    for (const doc of documents) {
      const pathValue = doc.filePath as string | undefined;
      if (!pathValue || draft) continue;
      await tx.document.create({
        data: {
          studentId: studentId as string,
          name: (doc.name as string) || 'Document',
          type: (doc.type as string) || 'OTHER',
          filePath: pathValue,
          fileSize: Number(doc.fileSize || 0),
          mimeType: (doc.mimeType as string) || 'application/octet-stream',
        },
      });
    }

    if (!draft && fee && Number(fee.amount) > 0 && studentId) {
      const feeAmountPaise = Math.round(Number(fee.amount) * 100);
      const discountPaise = Math.round(Number(fee.discount) * 100);
      const paidPaise = Math.round(Number(fee.paidAmount) * 100);
      const totalPaise = Math.max(0, feeAmountPaise - discountPaise);
      const balancePaise = Math.max(0, totalPaise - paidPaise);

      await tx.studentFee.create({
        data: {
          studentId: studentId as string,
          academicYearId,
          totalPaise,
          paidPaise,
          discountPaise,
        },
      });

      if (paidPaise > 0) {
        let validCollectedById: string | null = null;
        if (userId) {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (user) validCollectedById = user.id;
        }

        let validFeeCategoryId: string | null = null;
        if (feeCategoryId) {
          const cat = await tx.feeCategory.findUnique({ where: { id: feeCategoryId } });
          if (cat) validFeeCategoryId = cat.id;
        }

        await tx.feePayment.create({
          data: {
            receiptNumber: `RCPT-${year}-${String(newCounter).padStart(4, '0')}`,
            studentId: studentId as string,
            academicYearId,
            feeCategoryId: validFeeCategoryId,
            amountPaise: paidPaise,
            paymentDate: new Date(),
            paymentMethod: (fee.paymentMethod as string) || 'CASH',
            previousDuePaise: 0,
            currentDuePaise: balancePaise,
            remarks: (fee.paymentReference as string) || null,
            collectedById: validCollectedById,
            status: 'COMPLETED',
          },
        });
      }
    }

    return admission;
  });

  await createAuditLog(userId, draft ? 'ADMISSION_DRAFT_CREATED' : 'ADMISSION_CREATED', 'Admission', result.id, result.name);
  return result;
}

export async function saveAdmissionDraft(data: Record<string, unknown>, userId: string) {
  return createAdmissionWizard({ ...data, draft: true }, userId);
}

export async function approveAdmission(id: string, userId: string) {
  const db = getPrismaClient();
  const admission = await db.admission.findUnique({ where: { id } });
  if (!admission) throw new Error('Admission not found.');

  const year = new Date().getFullYear();
  let counter = await db.admissionCounter.findUnique({ where: { year } });
  if (!counter) {
    counter = await db.admissionCounter.create({ data: { year, counter: 0 } });
  }
  const newCounter = counter.counter + 1;
  await db.admissionCounter.update({ where: { year }, data: { counter: newCounter } });

  const cleanClassId = (admission.classId && admission.classId.trim()) ? admission.classId.trim() : null;
  let finalClassId: string | null = null;
  if (cleanClassId) {
    const exists = await db.class.findUnique({ where: { id: cleanClassId } });
    if (exists) finalClassId = exists.id;
  }

  const cleanSectionId = (admission.sectionId && admission.sectionId.trim()) ? admission.sectionId.trim() : null;
  let finalSectionId: string | null = null;
  if (cleanSectionId) {
    const exists = await db.section.findUnique({ where: { id: cleanSectionId } });
    if (exists) finalSectionId = exists.id;
  }

  const cleanAcademicYearId = (admission.academicYearId && admission.academicYearId.trim()) ? admission.academicYearId.trim() : null;
  let finalAcademicYearId: string | null = null;
  if (cleanAcademicYearId) {
    const exists = await db.academicYear.findUnique({ where: { id: cleanAcademicYearId } });
    if (exists) finalAcademicYearId = exists.id;
  }
  if (!finalAcademicYearId) {
    const fallback = (await db.academicYear.findFirst({ where: { isCurrent: true } })) || (await db.academicYear.findFirst());
    finalAcademicYearId = fallback?.id || null;
  }

  const student = await db.student.create({
    data: {
      studentId: `STU-${year}-${String(newCounter).padStart(4, '0')}`,
      admissionNumber: admission.admissionNumber,
      name: admission.name,
      fatherName: admission.fatherName || null,
      fatherMobile: admission.fatherMobile || null,
      fatherOccupation: admission.fatherOccupation || null,
      fatherEmail: admission.fatherEmail || null,
      motherName: admission.motherName || null,
      motherMobile: admission.motherMobile || null,
      motherOccupation: admission.motherOccupation || null,
      motherEmail: admission.motherEmail || null,
      guardianName: admission.guardianName || null,
      guardianMobile: admission.guardianMobile || null,
      guardianEmail: admission.guardianEmail || null,
      guardianRelation: admission.guardianRelation || null,
      dateOfBirth: admission.dateOfBirth,
      gender: admission.gender || null,
      bloodGroup: admission.bloodGroup || null,
      aadhaarNumber: admission.aadhaarNumber || null,
      phone: admission.phone || null,
      email: admission.email || null,
      address: admission.address || null,
      city: admission.city || null,
      state: admission.state || null,
      pincode: admission.pincode || null,
      previousSchool: admission.previousSchool || null,
      previousClass: admission.previousClass || null,
      tcNumber: admission.tcNumber || null,
      rollNumber: admission.rollNumber || null,
      classId: finalClassId,
      sectionId: finalSectionId,
      academicYearId: finalAcademicYearId,
      admissionDate: admission.admissionDate,
      photoPath: admission.photoPath || null,
      remarks: admission.remarks || null,
      status: 'ACTIVE',
    },
  });

  await db.admission.update({
    where: { id },
    data: {
      status: 'ENROLLED',
      studentId: student.id,
      classId: finalClassId,
      sectionId: finalSectionId,
      academicYearId: finalAcademicYearId || admission.academicYearId,
    },
  });

  await createAuditLog(userId, 'ADMISSION_APPROVED', 'Admission', id, `Enrolled: ${student.name}`);
  return student;
}
