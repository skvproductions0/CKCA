import { getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';
import { getErrorMessage } from '../utils/helpers';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export async function getAttendanceForClass(
  sectionId: string,
  date: Date,
  academicYearId: string
) {
  const db = getPrismaClient();
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { class: true },
  });
  if (!section) throw new Error('Section not found.');

  const dayStart = startOfDay(date);
  const students = await db.student.findMany({
    where: {
      sectionId,
      academicYearId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    orderBy: { rollNumber: 'asc' },
  });

  const attendance = await db.attendance.findMany({
    where: {
      sectionId,
      date: dayStart,
      academicYearId,
    },
  });

  const attendanceMap = new Map(attendance.map(a => [a.studentId, a]));

  return {
    section,
    date: dayStart,
    records: students.map(student => ({
      student,
      attendance: attendanceMap.get(student.id) || null,
    })),
  };
}

export async function saveAttendance(
  data: {
    sectionId: string;
    academicYearId: string;
    date: Date;
    records: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LEAVE'; remarks?: string }[];
  },
  userId: string
) {
  const db = getPrismaClient();
  const dayStart = startOfDay(data.date);

  try {
    const results = await db.$transaction(
      data.records.map(record =>
        db.attendance.upsert({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date: dayStart,
            },
          },
          create: {
            studentId: record.studentId,
            sectionId: data.sectionId,
            academicYearId: data.academicYearId,
            date: dayStart,
            status: record.status,
            remarks: record.remarks,
          },
          update: {
            status: record.status,
            remarks: record.remarks,
          },
        })
      )
    );

    await createAuditLog(
      userId,
      'ATTENDANCE_SAVED',
      'Attendance',
      data.sectionId,
      `Saved attendance for ${data.records.length} students on ${dayStart.toISOString().split('T')[0]}`
    );

    return results;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAttendanceReport(type: string, filters: {
  studentId?: string;
  sectionId?: string;
  classId?: string;
  academicYearId?: string;
  month?: number;
  year?: number;
  threshold?: number;
}) {
  const db = getPrismaClient();
  const yearFilter = filters.academicYearId ? { academicYearId: filters.academicYearId } : {};

  switch (type) {
    case 'student': {
      if (!filters.studentId) throw new Error('Student ID required.');
      const where = { studentId: filters.studentId, ...yearFilter };
      const [total, present, absent, leave] = await Promise.all([
        db.attendance.count({ where }),
        db.attendance.count({ where: { ...where, status: 'PRESENT' } }),
        db.attendance.count({ where: { ...where, status: 'ABSENT' } }),
        db.attendance.count({ where: { ...where, status: 'LEAVE' } }),
      ]);
      const student = await db.student.findUnique({
        where: { id: filters.studentId },
        include: { class: true, section: true },
      });
      return {
        student,
        workingDays: total,
        present,
        absent,
        leave,
        percentage: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
      };
    }
    case 'monthly': {
      const year = filters.year || new Date().getFullYear();
      const month = (filters.month || new Date().getMonth() + 1) - 1;
      const start = startOfMonth(new Date(year, month));
      const end = endOfMonth(new Date(year, month));
      const where = {
        date: { gte: start, lte: end },
        ...yearFilter,
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      };
      const records = await db.attendance.findMany({
        where,
        include: { student: { include: { class: true, section: true } } },
      });

      const studentMap = new Map<string, { present: number; absent: number; leave: number; student: typeof records[0]['student'] }>();
      for (const r of records) {
        const existing = studentMap.get(r.studentId) || { present: 0, absent: 0, leave: 0, student: r.student };
        if (r.status === 'PRESENT') existing.present++;
        else if (r.status === 'ABSENT') existing.absent++;
        else existing.leave++;
        studentMap.set(r.studentId, existing);
      }

      return Array.from(studentMap.values()).map(v => ({
        student: v.student,
        present: v.present,
        absent: v.absent,
        leave: v.leave,
        total: v.present + v.absent + v.leave,
        percentage: (v.present + v.absent + v.leave) > 0
          ? Math.round((v.present / (v.present + v.absent + v.leave)) * 10000) / 100
          : 0,
      }));
    }
    case 'class': {
      if (!filters.sectionId) throw new Error('Section ID required.');
      const students = await db.student.findMany({
        where: { sectionId: filters.sectionId, status: 'ACTIVE', ...yearFilter },
      });
      const reports = await Promise.all(
        students.map(async (student) => {
          const where = { studentId: student.id, ...yearFilter };
          const [total, present] = await Promise.all([
            db.attendance.count({ where }),
            db.attendance.count({ where: { ...where, status: 'PRESENT' } }),
          ]);
          return {
            student,
            workingDays: total,
            present,
            absent: total - present,
            percentage: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
          };
        })
      );
      return reports;
    }
    case 'low': {
      const threshold = filters.threshold || 75;
      const students = await db.student.findMany({
        where: { status: 'ACTIVE', deletedAt: null, ...yearFilter },
        include: { class: true, section: true },
      });
      const lowAttendance = [];
      for (const student of students) {
        const where = { studentId: student.id, ...yearFilter };
        const [total, present] = await Promise.all([
          db.attendance.count({ where }),
          db.attendance.count({ where: { ...where, status: 'PRESENT' } }),
        ]);
        const pct = total > 0 ? (present / total) * 100 : 0;
        if (pct < threshold && total > 0) {
          lowAttendance.push({ student, workingDays: total, present, percentage: Math.round(pct * 100) / 100 });
        }
      }
      return lowAttendance.sort((a, b) => a.percentage - b.percentage);
    }
    default:
      throw new Error('Invalid report type.');
  }
}

export async function getDailyAttendance(date: Date, academicYearId?: string) {
  const db = getPrismaClient();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const where = {
    date: { gte: dayStart, lte: dayEnd },
    ...(academicYearId ? { academicYearId } : {}),
  };

  const records = await db.attendance.findMany({
    where,
    include: {
      student: { include: { class: true, section: true } },
      section: { include: { class: true } },
    },
  });

  const total = records.length;
  const present = records.filter(r => r.status === 'PRESENT').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  const leave = records.filter(r => r.status === 'LEAVE').length;

  return { records, total, present, absent, leave, percentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0 };
}
