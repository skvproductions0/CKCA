import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import { getErrorMessage } from '../utils/helpers';
import { checkSchoolLimits, getEffectiveSchoolFeatures } from './feature.service';

export async function getSchoolSettings(schoolId?: string) {
  const db = getPrismaClient();
  let settings = schoolId
    ? await db.schoolSetting.findFirst({ where: { schoolId } })
    : await db.schoolSetting.findFirst();

  if (!settings && schoolId) {
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (school) {
      settings = await db.schoolSetting.create({
        data: {
          schoolId,
          schoolName: school.name,
          address: school.address,
          phone: school.phone,
          email: school.email,
          website: school.website,
          principalName: school.principalName,
          logoPath: school.logoPath,
        },
      });
    }
  }

  if (!settings) {
    settings = await db.schoolSetting.findFirst();
  }

  if (settings && (schoolId || settings.schoolId)) {
    const targetSchoolId = schoolId || settings.schoolId;
    if (targetSchoolId) {
      const school = await db.school.findUnique({ where: { id: targetSchoolId } });
      if (school) {
        let featureDetails: any = null;
        try {
          featureDetails = await getEffectiveSchoolFeatures(targetSchoolId);
        } catch {}
        return {
          ...settings,
          schoolName: school.name || settings.schoolName,
          schoolCode: school.code,
          primaryColor: school.primaryColor,
          secondaryColor: school.secondaryColor,
          logoPath: school.logoPath || settings.logoPath,
          faviconPath: school.faviconPath,
          signaturePath: school.signaturePath,
          stampPath: school.stampPath,
          board: school.board,
          affiliationNumber: school.affiliationNumber,
          plan: school.plan || 'PREMIUM',
          features: featureDetails?.features || {},
          maxStudents: school.maxStudents,
          maxStaff: school.maxStaff,
          licenseExpiresAt: school.licenseExpiresAt,
          licenseWarning: featureDetails?.licenseWarning || null,
        };
      }
    }
  }

  return settings;
}

export async function updateSchoolSettings(data: Record<string, unknown>, userId: string, schoolId?: string) {
  const db = getPrismaClient();
  const existing = schoolId
    ? await db.schoolSetting.findFirst({ where: { schoolId } })
    : await db.schoolSetting.findFirst();

  if (!existing) throw new Error('School settings not found.');

  type SchoolSettingUpdateInput = Parameters<typeof db.schoolSetting.update>[0]['data'];
  const payload = data as SchoolSettingUpdateInput;
  const settings = await db.schoolSetting.update({
    where: { id: existing.id },
    data: payload,
  });

  const targetSchoolId = schoolId || existing.schoolId;
  if (targetSchoolId) {
    const schoolUpdates: Record<string, any> = {};
    if (data.schoolName) schoolUpdates.name = data.schoolName as string;
    if (data.address !== undefined) schoolUpdates.address = data.address as string;
    if (data.phone !== undefined) schoolUpdates.phone = data.phone as string;
    if (data.email !== undefined) schoolUpdates.email = data.email as string;
    if (data.website !== undefined) schoolUpdates.website = data.website as string;
    if (data.principalName !== undefined) schoolUpdates.principalName = data.principalName as string;
    if (data.logoPath !== undefined) schoolUpdates.logoPath = data.logoPath as string;
    if (data.primaryColor !== undefined) schoolUpdates.primaryColor = data.primaryColor as string;
    if (data.secondaryColor !== undefined) schoolUpdates.secondaryColor = data.secondaryColor as string;

    if (Object.keys(schoolUpdates).length > 0) {
      await db.school.update({
        where: { id: targetSchoolId },
        data: schoolUpdates,
      });
    }
  }

  await createAuditLog(userId, 'SETTINGS_UPDATED', 'SchoolSetting', settings.id, 'School settings updated', targetSchoolId);
  return settings;
}

export async function getUsers(schoolId?: string) {
  const db = getPrismaClient();
  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      role: { not: 'CREATOR' },
      ...(schoolId ? { schoolId } : {}),
    },
    select: {
      id: true, username: true, email: true, fullName: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
      schoolId: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return users;
}

export async function updateUser(id: string, data: Record<string, unknown>, userId: string, schoolId?: string) {
  const db = getPrismaClient();

  const targetUser = await db.user.findUnique({ where: { id } });
  if (!targetUser) throw new Error('User not found.');

  // Multi-school protection: Ensure user belongs to this school
  if (schoolId && targetUser.schoolId && targetUser.schoolId !== schoolId) {
    throw new Error('Access denied. You cannot modify users from another school.');
  }

  // Creator account cannot be edited, deleted, or locked by any other user
  if (targetUser.role === 'CREATOR') {
    if (userId !== id) {
      throw new Error('Creator account cannot be edited, locked, or deleted by any other user.');
    }
    if (data.isActive === false) {
      throw new Error('Creator account cannot be deactivated or locked.');
    }
  }

  if (data.role === 'CREATOR' && targetUser.role !== 'CREATOR') {
    throw new Error('Creator role cannot be assigned through user management.');
  }

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

export async function getAuditLogs(filters: { page?: number; limit?: number; action?: string; schoolId?: string } = {}, schoolId?: string) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const targetSchoolId = schoolId || filters.schoolId;
  const where: Record<string, any> = {};
  if (targetSchoolId) where.schoolId = targetSchoolId;
  if (filters.action) where.action = { contains: filters.action };

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

export async function getNotifications(userId?: string, schoolId?: string) {
  const db = getPrismaClient();
  const where: Record<string, any> = {};
  if (userId) {
    where.OR = [{ userId }, { userId: null }];
  }
  if (schoolId) {
    where.schoolId = schoolId;
  }
  return db.notification.findMany({
    where,
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
  schoolId?: string;
}) {
  const db = getPrismaClient();
  return db.notification.create({
    data: {
      title: data.title,
      message: data.message,
      type: (data.type || 'INFO') as 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR',
      userId: data.userId,
      link: data.link,
      schoolId: data.schoolId || null,
    },
  });
}

export async function getAdmissions(filters: { status?: string; academicYearId?: string; page?: number; limit?: number; schoolId?: string } = {}, schoolId?: string) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const targetSchoolId = schoolId || filters.schoolId;
  const where: Record<string, unknown> = {};
  if (targetSchoolId) where.schoolId = targetSchoolId;
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

export async function createAdmission(data: Record<string, unknown>, userId: string, schoolId?: string) {
  const db = getPrismaClient();
  try {
    const targetSchoolId = schoolId || (data.schoolId as string) || null;
    if (targetSchoolId) {
      await checkSchoolLimits(targetSchoolId, 'STUDENT');
    }
    const year = new Date().getFullYear();
    let counter = await db.admissionCounter.findFirst({
      where: { year, ...(targetSchoolId ? { schoolId: targetSchoolId } : {}) },
    });
    if (!counter) {
      counter = await db.admissionCounter.create({ data: { year, counter: 0, schoolId: targetSchoolId } });
    }
    const newCounter = counter.counter + 1;
    await db.admissionCounter.update({ where: { id: counter.id }, data: { counter: newCounter } });

    const admissionNumber = `ADM-${year}-${String(newCounter).padStart(4, '0')}`;

    // build create data and use `student.connect` when studentId provided
    const raw = data as Record<string, any>;
    let academicYearId = raw.academicYearId;
    if (!academicYearId) {
      const fallbackYear = (await db.academicYear.findFirst({
        where: {
          isCurrent: true,
          ...(targetSchoolId ? { schoolId: targetSchoolId } : {}),
        },
      })) || (await db.academicYear.findFirst({
        where: targetSchoolId ? { schoolId: targetSchoolId } : {},
      }));
      academicYearId = fallbackYear?.id;
    }

    const createData: Record<string, any> = {
      ...raw,
      admissionNumber,
      schoolId: targetSchoolId,
      ...(academicYearId ? { academicYearId } : {}),
    };
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
      schoolId: targetSchoolId || undefined,
    });

    await createAuditLog(userId, 'ADMISSION_CREATED', 'Admission', admission.id, admission.name, targetSchoolId);
    return admission;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function createAdmissionWizard(data: Record<string, unknown>, userId: string, schoolId?: string) {
  const db = getPrismaClient();

  const payload = data as Record<string, unknown>;
  const targetSchoolId = schoolId || (payload.schoolId as string) || null;
  if (targetSchoolId) {
    await checkSchoolLimits(targetSchoolId, 'STUDENT');
  }
  const details = (payload.details as Record<string, unknown>) || {};
  const parent = (payload.parent as Record<string, unknown>) || {};
  const academic = (payload.academic as Record<string, unknown>) || {};
  const documents = (payload.documents as Array<Record<string, unknown>>) || [];
  const fee = (payload.fee as Record<string, unknown>) || {};
  const files = (payload.files as Array<Record<string, unknown>>) || [];
  const draft = Boolean(payload.draft);

  const year = new Date().getFullYear();
  let counter = await db.admissionCounter.findFirst({
    where: { year, ...(targetSchoolId ? { schoolId: targetSchoolId } : {}) },
  });
  if (!counter) {
    counter = await db.admissionCounter.create({ data: { year, counter: 0, schoolId: targetSchoolId } });
  }
  const newCounter = counter.counter + 1;
  await db.admissionCounter.update({ where: { id: counter.id }, data: { counter: newCounter } });

  const admissionNumber = `ADM-${year}-${String(newCounter).padStart(4, '0')}`;

  // Validate and sanitize foreign keys
  let academicYearId = (typeof academic.academicYearId === 'string' && academic.academicYearId.trim()) ? academic.academicYearId.trim() : null;
  if (academicYearId) {
    const exists = await db.academicYear.findUnique({ where: { id: academicYearId } });
    if (!exists) academicYearId = null;
  }
  if (!academicYearId) {
    const fallbackYear = (await db.academicYear.findFirst({
      where: {
        isCurrent: true,
        ...(targetSchoolId ? { schoolId: targetSchoolId } : {}),
      },
    })) || (await db.academicYear.findFirst({
      where: targetSchoolId ? { schoolId: targetSchoolId } : {},
    }));
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
    schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
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
            schoolId: targetSchoolId,
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

  await createAuditLog(userId, draft ? 'ADMISSION_DRAFT_CREATED' : 'ADMISSION_CREATED', 'Admission', result.id, result.name, targetSchoolId);
  return result;
}

export async function saveAdmissionDraft(data: Record<string, unknown>, userId: string, schoolId?: string) {
  return createAdmissionWizard({ ...data, draft: true }, userId, schoolId);
}

export async function approveAdmission(id: string, userId: string, schoolId?: string) {
  const db = getPrismaClient();
  const admission = await db.admission.findUnique({ where: { id } });
  if (!admission) throw new Error('Admission not found.');
  if (schoolId && admission.schoolId && admission.schoolId !== schoolId) {
    throw new Error('Access denied. Admission belongs to another school.');
  }

  const targetSchoolId = schoolId || admission.schoolId || null;
  if (targetSchoolId) {
    await checkSchoolLimits(targetSchoolId, 'STUDENT');
  }

  const year = new Date().getFullYear();
  let counter = await db.admissionCounter.findFirst({
    where: { year, ...(targetSchoolId ? { schoolId: targetSchoolId } : {}) },
  });
  if (!counter) {
    counter = await db.admissionCounter.create({ data: { year, counter: 0, schoolId: targetSchoolId } });
  }
  const newCounter = counter.counter + 1;
  await db.admissionCounter.update({ where: { id: counter.id }, data: { counter: newCounter } });

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
    const fallback = (await db.academicYear.findFirst({
      where: {
        isCurrent: true,
        ...(targetSchoolId ? { schoolId: targetSchoolId } : {}),
      },
    })) || (await db.academicYear.findFirst({
      where: targetSchoolId ? { schoolId: targetSchoolId } : {},
    }));
    finalAcademicYearId = fallback?.id || null;
  }

  const student = await db.student.create({
    data: {
      schoolId: targetSchoolId,
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

  await createAuditLog(userId, 'ADMISSION_APPROVED', 'Admission', id, `Enrolled: ${student.name}`, targetSchoolId);
  return student;
}
