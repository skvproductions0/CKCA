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

export async function createAcademicYear(data: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean }, userId: string) {
  const db = getPrismaClient();
  if (data.isCurrent) {
    await db.academicYear.updateMany({ data: { isCurrent: false } });
  }
  const year = await db.academicYear.create({ data });
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
    include: { sections: { include: { class: true } }, subjects: true },
  });
  if (!teacher) throw new Error('Teacher not found.');
  return teacher;
}

export async function createTeacher(data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  try {
    const count = await db.teacher.count();
    const employeeId = `EMP-${String(count + 1).padStart(4, '0')}`;
    const teacher = await db.teacher.create({
      data: { ...data, employeeId } as Parameters<typeof db.teacher.create>[0]['data'],
    });
    await createAuditLog(userId, 'TEACHER_CREATED', 'Teacher', teacher.id, teacher.name);
    return teacher;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateTeacher(id: string, data: Record<string, unknown>, userId: string) {
  const db = getPrismaClient();
  const teacher = await db.teacher.update({
    where: { id },
    data: data as Parameters<typeof db.teacher.update>[0]['data'],
  });
  await createAuditLog(userId, 'TEACHER_UPDATED', 'Teacher', id, teacher.name);
  return teacher;
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
