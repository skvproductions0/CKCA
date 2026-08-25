import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import { calculateGrade, calculatePercentage, getErrorMessage } from '../utils/helpers';

export async function getClasses() {
  const db = getPrismaClient();
  return db.class.findMany({
    where: { deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null },
        include: { classTeacher: true, _count: { select: { students: true } } },
      },
      _count: { select: { students: true } },
    },
    orderBy: { numericOrder: 'asc' },
  });
}

export async function createClass(name: string, numericOrder: number, userId: string) {
  const db = getPrismaClient();
  try {
    const cls = await db.class.create({ data: { name, numericOrder } });
    await createAuditLog(userId, 'CLASS_CREATED', 'Class', cls.id, name);
    return cls;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateClass(id: string, data: { name?: string; numericOrder?: number; isActive?: boolean }, userId: string) {
  const db = getPrismaClient();
  const cls = await db.class.update({ where: { id }, data });
  await createAuditLog(userId, 'CLASS_UPDATED', 'Class', id, cls.name);
  return cls;
}

export async function deleteClass(id: string, userId: string) {
  const db = getPrismaClient();
  const cls = await db.class.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await createAuditLog(userId, 'CLASS_DELETED', 'Class', id, cls.name);
  return cls;
}

export async function createSection(classId: string, name: string, classTeacherId?: string, userId?: string) {
  const db = getPrismaClient();
  try {
    const section = await db.section.create({
      data: { classId, name, classTeacherId },
      include: { classTeacher: true },
    });
    if (userId) await createAuditLog(userId, 'SECTION_CREATED', 'Section', section.id, name);
    return section;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateSection(id: string, data: { name?: string; classTeacherId?: string; isActive?: boolean }, userId: string) {
  const db = getPrismaClient();
  const section = await db.section.update({ where: { id }, data, include: { classTeacher: true } });
  await createAuditLog(userId, 'SECTION_UPDATED', 'Section', id, section.name);
  return section;
}

export async function deleteSection(id: string, userId: string) {
  const db = getPrismaClient();
  const section = await db.section.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await createAuditLog(userId, 'SECTION_DELETED', 'Section', id, section.name);
  return section;
}

export async function getAcademicYears() {
  const db = getPrismaClient();
  return db.academicYear.findMany({ orderBy: { startDate: 'desc' } });
}

export async function getCurrentAcademicYear() {
  const db = getPrismaClient();
  return db.academicYear.findFirst({ where: { isCurrent: true } });
}

export async function setCurrentAcademicYear(id: string, userId: string) {
  const db = getPrismaClient();
  await db.academicYear.updateMany({ data: { isCurrent: false } });
  const year = await db.academicYear.update({ where: { id }, data: { isCurrent: true } });
  await createAuditLog(userId, 'ACADEMIC_YEAR_SET', 'AcademicYear', id, year.name);
  return year;
}

export async function createAcademicYear(data: { name: string; startDate: Date | string; endDate: Date | string; isCurrent?: boolean }, userId: string) {
  const db = getPrismaClient();
  if (data.isCurrent) {
    await db.academicYear.updateMany({ data: { isCurrent: false } });
  }
  const year = await db.academicYear.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isCurrent: Boolean(data.isCurrent),
    },
  });
  await createAuditLog(userId, 'ACADEMIC_YEAR_CREATED', 'AcademicYear', year.id, year.name);
  return year;
}

export async function getTeachers(filters: { search?: string; status?: string; page?: number; limit?: number } = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { employeeId: { contains: filters.search } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search } },
    ];
  }
  if (filters.status) where.status = filters.status;

  const [teachers, total] = await Promise.all([
    db.teacher.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    db.teacher.count({ where }),
  ]);

  return { teachers, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getTeacherById(id: string) {
  const db = getPrismaClient();
  const teacher = await db.teacher.findUnique({
    where: { id },
    include: { sections: { include: { class: true } }, subjects: true, documents: true },
  });
  if (!teacher) throw new Error('Teacher not found.');
  return teacher;
}

export async function createTeacher(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    const allTeachers = await db.teacher.findMany({ select: { employeeId: true } });
    let maxNum = 0;
    for (const t of allTeachers) {
      const match = t.employeeId?.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const employeeId = `EMP-${String(maxNum + 1).padStart(4, '0')}`;

    const cleanData: Parameters<typeof db.teacher.create>[0]['data'] = {
      employeeId,
      name: String(data.name || '').trim(),
      gender: data.gender ? String(data.gender) : null,
      phone: data.phone ? String(data.phone).trim() : null,
      email: data.email ? String(data.email).trim() : null,
      qualification: data.qualification ? String(data.qualification).trim() : null,
      subject: data.subject ? String(data.subject).trim() : null,
      fatherName: data.fatherName ? String(data.fatherName).trim() : null,
      motherName: data.motherName ? String(data.motherName).trim() : null,
      emergencyContact: data.emergencyContact ? String(data.emergencyContact).trim() : null,
      bloodGroup: data.bloodGroup ? String(data.bloodGroup) : null,
      aadhaarNumber: data.aadhaarNumber ? String(data.aadhaarNumber).trim() : null,
      panNumber: data.panNumber ? String(data.panNumber).trim() : null,
      address: data.address ? String(data.address).trim() : null,
      city: data.city ? String(data.city).trim() : null,
      state: data.state ? String(data.state).trim() : null,
      pincode: data.pincode ? String(data.pincode).trim() : null,
      experience: data.experience ? String(data.experience).trim() : null,
      maritalStatus: data.maritalStatus ? String(data.maritalStatus) : null,
      photoPath: data.photoPath ? String(data.photoPath) : null,
      salaryPaise: typeof data.salaryPaise === 'number' ? data.salaryPaise : 0,
      status: data.status ? String(data.status) : 'ACTIVE',
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth as string | Date) : null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate as string | Date) : null,
    };

    const teacher = await db.teacher.create({
      data: cleanData,
    });

    if (Array.isArray(data.documents)) {
      for (const doc of data.documents as Array<{ name: string; type: string; filePath: string; fileSize?: number; mimeType?: string }>) {
        if (doc.filePath) {
          await db.document.create({
            data: {
              teacherId: teacher.id,
              name: doc.name || 'Document',
              type: doc.type || 'OTHER',
              filePath: doc.filePath,
              fileSize: doc.fileSize || 0,
              mimeType: doc.mimeType || 'application/octet-stream',
            },
          });
        }
      }
    }

    await createAuditLog(userId, 'TEACHER_CREATED', 'Teacher', teacher.id, teacher.name);
    return teacher;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateTeacher(id: string, data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    const cleanData: Parameters<typeof db.teacher.update>[0]['data'] = {};
    if (data.name !== undefined) cleanData.name = String(data.name).trim();
    if (data.gender !== undefined) cleanData.gender = data.gender ? String(data.gender) : null;
    if (data.phone !== undefined) cleanData.phone = data.phone ? String(data.phone).trim() : null;
    if (data.email !== undefined) cleanData.email = data.email ? String(data.email).trim() : null;
    if (data.qualification !== undefined) cleanData.qualification = data.qualification ? String(data.qualification).trim() : null;
    if (data.subject !== undefined) cleanData.subject = data.subject ? String(data.subject).trim() : null;
    if (data.fatherName !== undefined) cleanData.fatherName = data.fatherName ? String(data.fatherName).trim() : null;
    if (data.motherName !== undefined) cleanData.motherName = data.motherName ? String(data.motherName).trim() : null;
    if (data.emergencyContact !== undefined) cleanData.emergencyContact = data.emergencyContact ? String(data.emergencyContact).trim() : null;
    if (data.bloodGroup !== undefined) cleanData.bloodGroup = data.bloodGroup ? String(data.bloodGroup) : null;
    if (data.aadhaarNumber !== undefined) cleanData.aadhaarNumber = data.aadhaarNumber ? String(data.aadhaarNumber).trim() : null;
    if (data.panNumber !== undefined) cleanData.panNumber = data.panNumber ? String(data.panNumber).trim() : null;
    if (data.address !== undefined) cleanData.address = data.address ? String(data.address).trim() : null;
    if (data.city !== undefined) cleanData.city = data.city ? String(data.city).trim() : null;
    if (data.state !== undefined) cleanData.state = data.state ? String(data.state).trim() : null;
    if (data.pincode !== undefined) cleanData.pincode = data.pincode ? String(data.pincode).trim() : null;
    if (data.experience !== undefined) cleanData.experience = data.experience ? String(data.experience).trim() : null;
    if (data.maritalStatus !== undefined) cleanData.maritalStatus = data.maritalStatus ? String(data.maritalStatus) : null;
    if (data.photoPath !== undefined) cleanData.photoPath = data.photoPath ? String(data.photoPath) : null;
    if (data.salaryPaise !== undefined) cleanData.salaryPaise = typeof data.salaryPaise === 'number' ? data.salaryPaise : 0;
    if (data.status !== undefined) cleanData.status = String(data.status);
    if (data.dateOfBirth !== undefined) {
      cleanData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth as string | Date) : null;
    }
    if (data.joiningDate !== undefined) {
      cleanData.joiningDate = data.joiningDate ? new Date(data.joiningDate as string | Date) : null;
    }

    const teacher = await db.teacher.update({
      where: { id },
      data: cleanData,
    });

    if (Array.isArray(data.documents)) {
      // Delete existing teacher documents and re-insert
      await db.document.deleteMany({ where: { teacherId: id } });
      for (const doc of data.documents as Array<{ name: string; type: string; filePath: string; fileSize?: number; mimeType?: string }>) {
        if (doc.filePath) {
          await db.document.create({
            data: {
              teacherId: id,
              name: doc.name || 'Document',
              type: doc.type || 'OTHER',
              filePath: doc.filePath,
              fileSize: doc.fileSize || 0,
              mimeType: doc.mimeType || 'application/octet-stream',
            },
          });
        }
      }
    }

    await createAuditLog(userId, 'TEACHER_UPDATED', 'Teacher', id, teacher.name);
    return teacher;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteTeacher(id: string, userId: string) {
  return archiveTeacher(id, userId);
}

export async function archiveTeacher(id: string, userId: string) {
  const db = getPrismaClient();
  try {
    const teacher = await db.teacher.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await createAuditLog(userId, 'TEACHER_ARCHIVED', 'Teacher', id, teacher.name);
    return teacher;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getDeletedTeachers(filters: { search?: string; page?: number; limit?: number } = {}) {
  const db = getPrismaClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: { not: null } };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { employeeId: { contains: filters.search } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search } },
      { subject: { contains: filters.search } },
    ];
  }

  const [teachers, total] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.teacher.count({ where }),
  ]);

  return { teachers, total, page, totalPages: Math.ceil(total / limit) };
}

export async function restoreTeacher(id: string, userId: string) {
  const db = getPrismaClient();
  try {
    const teacher = await db.teacher.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' },
    });
    await createAuditLog(userId, 'TEACHER_RESTORED', 'Teacher', id, teacher.name);
    return teacher;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function permanentDeleteTeacher(id: string, userId: string) {
  const db = getPrismaClient();
  try {
    const teacher = await db.teacher.findUnique({ where: { id } });
    if (!teacher) throw new Error('Teacher not found');

    // Delete associated documents first
    await db.document.deleteMany({ where: { teacherId: id } });

    // Permanent delete
    await db.teacher.delete({ where: { id } });

    await createAuditLog(userId, 'TEACHER_PERMANENTLY_DELETED', 'Teacher', id, teacher.name);
    return true;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function emptyTeacherRecycleBin(userId: string) {
  const db = getPrismaClient();
  try {
    const deletedTeachers = await db.teacher.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true },
    });

    const teacherIds = deletedTeachers.map((t) => t.id);
    if (teacherIds.length > 0) {
      await db.document.deleteMany({ where: { teacherId: { in: teacherIds } } });
      await db.teacher.deleteMany({ where: { id: { in: teacherIds } } });
    }

    await createAuditLog(userId, 'TEACHER_RECYCLE_BIN_EMPTIED', 'Teacher', 'all', `${teacherIds.length} teachers permanently deleted`);
    return { count: teacherIds.length };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getSubjects(classId?: string) {
  const db = getPrismaClient();
  return db.subject.findMany({
    where: { deletedAt: null, ...(classId ? { classId } : {}) },
    include: { class: true, teacher: true },
    orderBy: { name: 'asc' },
  });
}

export async function createSubject(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    const subject = await db.subject.create({
      data: data as Parameters<typeof db.subject.create>[0]['data'],
      include: { class: true, teacher: true },
    });
    await createAuditLog(userId, 'SUBJECT_CREATED', 'Subject', subject.id, subject.name);
    return subject;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateSubject(id: string, data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  const subject = await db.subject.update({
    where: { id },
    data: data as Parameters<typeof db.subject.update>[0]['data'],
    include: { class: true, teacher: true },
  });
  await createAuditLog(userId, 'SUBJECT_UPDATED', 'Subject', id, subject.name);
  return subject;
}

export async function deleteSubject(id: string, userId: string) {
  const db = getPrismaClient();
  const subject = await db.subject.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await createAuditLog(userId, 'SUBJECT_DELETED', 'Subject', id, subject.name);
  return subject;
}

export async function getExams(academicYearId?: string, classId?: string) {
  const db = getPrismaClient();
  return db.exam.findMany({
    where: {
      ...(academicYearId ? { academicYearId } : {}),
      ...(classId ? { classId } : {}),
    },
    include: { class: true, section: true, academicYear: true },
    orderBy: { startDate: 'desc' },
  });
}

export async function createExam(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  const exam = await db.exam.create({
    data: data as Parameters<typeof db.exam.create>[0]['data'],
    include: { class: true, academicYear: true },
  });
  await createAuditLog(userId, 'EXAM_CREATED', 'Exam', exam.id, exam.name);
  return exam;
}

export async function getResultsForEntry(examId: string, subjectId: string, sectionId?: string) {
  const db = getPrismaClient();
  const exam = await db.exam.findUnique({ where: { id: examId }, include: { class: true } });
  if (!exam) throw new Error('Exam not found.');

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new Error('Subject not found.');

  const students = await db.student.findMany({
    where: {
      classId: exam.classId,
      ...(sectionId ? { sectionId } : {}),
      status: 'ACTIVE',
      academicYearId: exam.academicYearId,
    },
    orderBy: { rollNumber: 'asc' },
  });

  const existingResults = await db.result.findMany({
    where: { examId, subjectId },
  });
  const resultMap = new Map(existingResults.map(r => [r.studentId, r]));

  return {
    exam,
    subject,
    records: students.map(student => ({
      student,
      result: resultMap.get(student.id) || null,
    })),
  };
}

export async function saveResults(
  data: {
    examId: string;
    subjectId: string;
    academicYearId: string;
    records: { studentId: string; marksObtained: number }[];
  },
  userId: string
) {
  const db = getPrismaClient();
  const subject = await db.subject.findUnique({ where: { id: data.subjectId } });
  if (!subject) throw new Error('Subject not found.');

  const gradingRules = await db.gradingRule.findMany({ orderBy: { sortOrder: 'asc' } });

  for (const record of data.records) {
    if (record.marksObtained > subject.maxMarks) {
      throw new Error(`Marks cannot exceed maximum marks (${subject.maxMarks}).`);
    }
    if (record.marksObtained < 0) {
      throw new Error('Marks cannot be negative.');
    }
  }

  try {
    const results = await db.$transaction(
      data.records.map(record => {
        const percentage = calculatePercentage(record.marksObtained, subject.maxMarks);
        const grade = calculateGrade(percentage, gradingRules);
        return db.result.upsert({
          where: {
            studentId_examId_subjectId: {
              studentId: record.studentId,
              examId: data.examId,
              subjectId: data.subjectId,
            },
          },
          create: {
            studentId: record.studentId,
            examId: data.examId,
            subjectId: data.subjectId,
            academicYearId: data.academicYearId,
            marksObtained: record.marksObtained,
            maxMarks: subject.maxMarks,
            percentage,
            grade,
          },
          update: {
            marksObtained: record.marksObtained,
            maxMarks: subject.maxMarks,
            percentage,
            grade,
          },
        });
      })
    );

    await createAuditLog(userId, 'RESULTS_SAVED', 'Result', data.examId, `Saved ${results.length} results`);
    return results;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getStudentResults(studentId: string, examId?: string) {
  const db = getPrismaClient();
  const results = await db.result.findMany({
    where: {
      studentId,
      ...(examId ? { examId } : {}),
    },
    include: { exam: true, subject: true },
    orderBy: { createdAt: 'desc' },
  });

  if (examId) {
    const totalObtained = results.reduce((s, r) => s + r.marksObtained, 0);
    const totalMax = results.reduce((s, r) => s + r.maxMarks, 0);
    const percentage = calculatePercentage(totalObtained, totalMax);
    const gradingRules = await db.gradingRule.findMany();
    const grade = calculateGrade(percentage, gradingRules);
    const passed = results.every(r => r.marksObtained >= (r.subject?.passingMarks || 40));

    return { results, summary: { totalObtained, totalMax, percentage, grade, result: passed ? 'PASS' : 'FAIL' } };
  }

  return { results };
}

export async function getClassRankings(examId: string, sectionId?: string) {
  const db = getPrismaClient();
  const settings = await db.schoolSetting.findFirst();
  if (settings && !settings.enableRanking) return [];

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new Error('Exam not found.');

  const students = await db.student.findMany({
    where: {
      classId: exam.classId,
      ...(sectionId ? { sectionId } : {}),
      status: 'ACTIVE',
      academicYearId: exam.academicYearId,
    },
  });

  const rankings = await Promise.all(
    students.map(async (student) => {
      const results = await db.result.findMany({ where: { studentId: student.id, examId } });
      const totalObtained = results.reduce((s, r) => s + r.marksObtained, 0);
      const totalMax = results.reduce((s, r) => s + r.maxMarks, 0);
      const percentage = calculatePercentage(totalObtained, totalMax);
      return { student, totalObtained, totalMax, percentage };
    })
  );

  return rankings
    .filter(r => r.totalMax > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getGradingRules() {
  const db = getPrismaClient();
  return db.gradingRule.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function updateGradingRules(rules: { id?: string; grade: string; minPercent: number; maxPercent: number; sortOrder: number }[], userId: string) {
  const db = getPrismaClient();
  await db.gradingRule.deleteMany();
  const created = await db.gradingRule.createMany({ data: rules });
  await createAuditLog(userId, 'GRADING_UPDATED', 'GradingRule', undefined, 'Grading rules updated');
  return created;
}
