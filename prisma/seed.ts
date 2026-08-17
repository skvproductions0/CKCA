import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // School Settings
  await prisma.schoolSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      schoolName: "CK CAREER ACADEMY",
      address: "123 Education Lane, Knowledge City, State - 110001",
      phone: "+91 98765 43210",
      email: "info@abcschool.edu",
      website: "www.abcschool.edu",
      principalName: "Dr. Rajesh Sharma",
      registrationNumber: "REG-2020-001",
      receiptFooter: "This is a computer generated receipt.",
      reportCardFooter:
        "Promotion is subject to satisfactory performance and attendance.",
    },
  });

  // Grading Rules
  const gradingExists = await prisma.gradingRule.count();
  if (gradingExists === 0) {
    await prisma.gradingRule.createMany({
      data: [
        { grade: "A+", minPercent: 90, maxPercent: 100, sortOrder: 1 },
        { grade: "A", minPercent: 80, maxPercent: 89.99, sortOrder: 2 },
        { grade: "B+", minPercent: 70, maxPercent: 79.99, sortOrder: 3 },
        { grade: "B", minPercent: 60, maxPercent: 69.99, sortOrder: 4 },
        { grade: "C", minPercent: 50, maxPercent: 59.99, sortOrder: 5 },
        { grade: "D", minPercent: 40, maxPercent: 49.99, sortOrder: 6 },
        { grade: "F", minPercent: 0, maxPercent: 39.99, sortOrder: 7 },
      ],
    });
  }

  // Fee Categories
  const feeCatExists = await prisma.feeCategory.count();
  if (feeCatExists === 0) {
    await prisma.feeCategory.createMany({
      data: [
        { name: "Admission Fee", sortOrder: 1 },
        { name: "Tuition Fee", sortOrder: 2 },
        { name: "Annual Fee", sortOrder: 3 },
        { name: "Examination Fee", sortOrder: 4 },
        { name: "Transport Fee", sortOrder: 5 },
        { name: "Computer Fee", sortOrder: 6 },
        { name: "Library Fee", sortOrder: 7 },
        { name: "Sports Fee", sortOrder: 8 },
        { name: "Other Fee", sortOrder: 9 },
      ],
    });
  }

  // Users
  const passwordHash = await bcrypt.hash("admin123", 12);
  const users = [
    {
      username: "admin",
      email: "admin@school.edu",
      fullName: "Super Admin",
      role: "SUPER_ADMIN" as const,
    },
    {
      username: "principal",
      email: "principal@school.edu",
      fullName: "Dr. Rajesh Sharma",
      role: "PRINCIPAL" as const,
    },
    {
      username: "accountant",
      email: "accountant@school.edu",
      fullName: "Priya Mehta",
      role: "ACCOUNTANT" as const,
    },
    {
      username: "teacher1",
      email: "teacher1@school.edu",
      fullName: "Amit Kumar",
      role: "TEACHER" as const,
    },
    {
      username: "reception",
      email: "reception@school.edu",
      fullName: "Sunita Devi",
      role: "RECEPTIONIST" as const,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  // Academic Years
  const ay2025 = await prisma.academicYear.upsert({
    where: { name: "2025-26" },
    update: {},
    create: {
      name: "2025-26",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isCurrent: true,
    },
  });

  await prisma.academicYear.upsert({
    where: { name: "2026-27" },
    update: {},
    create: {
      name: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isCurrent: false,
    },
  });

  // Classes
  const classData = [
    { name: "8", numericOrder: 8 },
    { name: "9", numericOrder: 9 },
    { name: "10", numericOrder: 10 },
  ];

  const classes: Record<string, string> = {};
  for (const c of classData) {
    const cls = await prisma.class.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    classes[c.name] = cls.id;
  }

  // Teachers
  const teacherData = [
    {
      employeeId: "EMP-0001",
      name: "Amit Kumar",
      qualification: "M.Sc, B.Ed",
      subject: "Mathematics",
      phone: "9876543210",
      status: "ACTIVE" as const,
    },
    {
      employeeId: "EMP-0002",
      name: "Neha Singh",
      qualification: "M.A, B.Ed",
      subject: "English",
      phone: "9876543211",
      status: "ACTIVE" as const,
    },
    {
      employeeId: "EMP-0003",
      name: "Rajesh Verma",
      qualification: "M.Sc, B.Ed",
      subject: "Science",
      phone: "9876543212",
      status: "ACTIVE" as const,
    },
    {
      employeeId: "EMP-0004",
      name: "Pooja Sharma",
      qualification: "M.A, B.Ed",
      subject: "Hindi",
      phone: "9876543213",
      status: "ACTIVE" as const,
    },
    {
      employeeId: "EMP-0005",
      name: "Vikram Patel",
      qualification: "M.Com, B.Ed",
      subject: "Social Science",
      phone: "9876543214",
      status: "ACTIVE" as const,
    },
  ];

  const teachers: string[] = [];
  for (const t of teacherData) {
    const teacher = await prisma.teacher.upsert({
      where: { employeeId: t.employeeId },
      update: {},
      create: { ...t, isDemo: true, joiningDate: new Date("2020-06-01") },
    });
    teachers.push(teacher.id);
  }

  // Sections
  const sections: Record<string, string> = {};
  for (const className of ["8", "9", "10"]) {
    for (const secName of ["A", "B", "C"]) {
      const key = `${className}-${secName}`;
      const existing = await prisma.section.findFirst({
        where: { classId: classes[className], name: secName },
      });
      if (existing) {
        sections[key] = existing.id;
      } else {
        const sec = await prisma.section.create({
          data: {
            name: secName,
            classId: classes[className],
            classTeacherId:
              teachers[Math.floor(Math.random() * teachers.length)],
          },
        });
        sections[key] = sec.id;
      }
    }
  }

  // Subjects
  const subjectList = [
    { name: "Hindi", code: "HIN" },
    { name: "English", code: "ENG" },
    { name: "Mathematics", code: "MAT" },
    { name: "Science", code: "SCI" },
    { name: "Social Science", code: "SST" },
    { name: "Computer", code: "COM" },
  ];

  for (const className of ["8", "9", "10"]) {
    for (let i = 0; i < subjectList.length; i++) {
      const sub = subjectList[i];
      await prisma.subject.upsert({
        where: {
          classId_code: { classId: classes[className], code: sub.code },
        },
        update: {},
        create: {
          name: sub.name,
          code: sub.code,
          classId: classes[className],
          maxMarks: 100,
          passingMarks: 40,
          teacherId: teachers[i % teachers.length],
          isDemo: true,
        },
      });
    }
  }

  // Fee Structures
  const feeCategories = await prisma.feeCategory.findMany();
  const tuitionFee = feeCategories.find((f) => f.name === "Tuition Fee")!;
  const transportFee = feeCategories.find((f) => f.name === "Transport Fee")!;
  const examFee = feeCategories.find((f) => f.name === "Examination Fee")!;
  const annualFee = feeCategories.find((f) => f.name === "Annual Fee")!;

  for (const className of ["8", "9", "10"]) {
    const baseAmount =
      className === "10" ? 3000000 : className === "9" ? 2500000 : 2000000;
    const existing = await prisma.feeStructure.findFirst({
      where: { classId: classes[className], academicYearId: ay2025.id },
    });
    if (!existing) {
      await prisma.feeStructure.create({
        data: {
          name: `Class ${className} Fee Structure`,
          academicYearId: ay2025.id,
          classId: classes[className],
          totalPaise: baseAmount,
          isDemo: true,
          items: {
            create: [
              {
                feeCategoryId: tuitionFee.id,
                amountPaise: Math.round(baseAmount * 0.5),
              },
              {
                feeCategoryId: transportFee.id,
                amountPaise: Math.round(baseAmount * 0.27),
              },
              {
                feeCategoryId: examFee.id,
                amountPaise: Math.round(baseAmount * 0.07),
              },
              {
                feeCategoryId: annualFee.id,
                amountPaise: Math.round(baseAmount * 0.16),
              },
            ],
          },
        },
      });
    }
  }

  // Students
  const firstNames = [
    "Rahul",
    "Priya",
    "Aman",
    "Mohit",
    "Ananya",
    "Karan",
    "Sneha",
    "Arjun",
    "Divya",
    "Rohan",
    "Kavya",
    "Aditya",
    "Isha",
    "Vivek",
    "Meera",
    "Sanjay",
    "Pooja",
    "Nikhil",
    "Ritu",
    "Deepak",
  ];
  const lastNames = [
    "Kumar",
    "Singh",
    "Verma",
    "Sharma",
    "Patel",
    "Gupta",
    "Yadav",
    "Mishra",
    "Joshi",
    "Reddy",
  ];

  const studentIds: string[] = [];
  let counter = 0;
  for (const className of ["8", "9", "10"]) {
    for (const secName of ["A", "B"]) {
      for (let i = 0; i < 3; i++) {
        counter++;
        const fname = firstNames[(counter - 1) % firstNames.length];
        const lname = lastNames[(counter - 1) % lastNames.length];
        const admissionNumber = `ADM-2025-${String(counter).padStart(4, "0")}`;
        const studentId = `STU-2025-${String(counter).padStart(4, "0")}`;

        const existing = await prisma.student.findUnique({
          where: { admissionNumber },
        });
        if (existing) {
          studentIds.push(existing.id);
          continue;
        }

        const student = await prisma.student.create({
          data: {
            studentId,
            admissionNumber,
            name: `${fname} ${lname}`,
            fatherName: `Mr. ${lname} Senior`,
            motherName: `Mrs. ${lname}`,
            dateOfBirth: new Date(
              2008 + parseInt(className) - 10,
              Math.floor(Math.random() * 12),
              Math.floor(Math.random() * 28) + 1,
            ),
            gender: counter % 2 === 0 ? "MALE" : "FEMALE",
            bloodGroup: ["A+", "B+", "O+", "AB+"][counter % 4],
            phone: `98${String(counter).padStart(8, "0")}`,
            address: `${counter} Student Colony, Knowledge City`,
            city: "Knowledge City",
            state: "State",
            pincode: "110001",
            classId: classes[className],
            sectionId: sections[`${className}-${secName}`],
            rollNumber: String(i + 1),
            admissionDate: new Date("2025-04-15"),
            academicYearId: ay2025.id,
            status: "ACTIVE",
            isDemo: true,
          },
        });
        studentIds.push(student.id);

        // Student Fee
        const feeStructure = await prisma.feeStructure.findFirst({
          where: { classId: classes[className], academicYearId: ay2025.id },
        });
        const totalPaise = feeStructure?.totalPaise || 2000000;
        const paidPaise = Math.round(totalPaise * (0.3 + Math.random() * 0.5));

        await prisma.studentFee.create({
          data: {
            studentId: student.id,
            feeStructureId: feeStructure?.id,
            academicYearId: ay2025.id,
            totalPaise,
            paidPaise,
            isDemo: true,
          },
        });
      }
    }
  }

  // Fee Payments
  const year = 2025;
  await prisma.receiptCounter.upsert({
    where: { year },
    update: { counter: 20 },
    create: { year, counter: 20 },
  });

  for (let i = 0; i < 10; i++) {
    const receiptNumber = `REC-2025-${String(i + 1).padStart(5, "0")}`;
    const existing = await prisma.feePayment.findUnique({
      where: { receiptNumber },
    });
    if (existing) continue;

    const studentId = studentIds[i % studentIds.length];
    const amount = [500000, 300000, 250000, 150000, 100000][i % 5];

    await prisma.feePayment.create({
      data: {
        receiptNumber,
        studentId,
        academicYearId: ay2025.id,
        feeCategoryId: tuitionFee.id,
        amountPaise: amount,
        paymentDate: new Date(2025, 5 + (i % 6), (i % 28) + 1),
        paymentMethod: ["CASH", "UPI", "BANK_TRANSFER"][i % 3] as
          | "CASH"
          | "UPI"
          | "BANK_TRANSFER",
        previousDuePaise: amount + 100000,
        currentDuePaise: 100000,
        isDemo: true,
      },
    });
  }

  // Exams
  const exam = await prisma.exam.upsert({
    where: { id: "demo-exam-1" },
    update: {},
    create: {
      id: "demo-exam-1",
      name: "Half Yearly Examination",
      academicYearId: ay2025.id,
      classId: classes["10"],
      sectionId: sections["10-A"],
      startDate: new Date("2025-09-15"),
      endDate: new Date("2025-09-25"),
      isDemo: true,
    },
  });

  // Results for class 10 students
  const class10Students = await prisma.student.findMany({
    where: { classId: classes["10"], status: "ACTIVE" },
    take: 6,
  });
  const class10Subjects = await prisma.subject.findMany({
    where: { classId: classes["10"] },
  });

  for (const student of class10Students) {
    for (const subject of class10Subjects) {
      const marks = 40 + Math.floor(Math.random() * 55);
      const existing = await prisma.result.findUnique({
        where: {
          studentId_examId_subjectId: {
            studentId: student.id,
            examId: exam.id,
            subjectId: subject.id,
          },
        },
      });
      if (!existing) {
        await prisma.result.create({
          data: {
            studentId: student.id,
            examId: exam.id,
            subjectId: subject.id,
            academicYearId: ay2025.id,
            marksObtained: marks,
            maxMarks: 100,
            percentage: marks,
            grade:
              marks >= 90
                ? "A+"
                : marks >= 80
                  ? "A"
                  : marks >= 70
                    ? "B+"
                    : marks >= 60
                      ? "B"
                      : marks >= 50
                        ? "C"
                        : marks >= 40
                          ? "D"
                          : "F",
            isDemo: true,
          },
        });
      }
    }
  }

  // Attendance (last 30 days for section 10-A)
  const section10A = sections["10-A"];
  const sectionStudents = await prisma.student.findMany({
    where: { sectionId: section10A, status: "ACTIVE" },
  });

  for (let d = 0; d < 20; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    if (date.getDay() === 0) continue;

    for (const student of sectionStudents) {
      const status =
        Math.random() > 0.1
          ? "PRESENT"
          : Math.random() > 0.5
            ? "ABSENT"
            : "LEAVE";
      await prisma.attendance.upsert({
        where: {
          studentId_date: {
            studentId: student.id,
            date: new Date(date.toDateString()),
          },
        },
        update: {},
        create: {
          studentId: student.id,
          sectionId: section10A,
          academicYearId: ay2025.id,
          date: new Date(date.toDateString()),
          status: status as "PRESENT" | "ABSENT" | "LEAVE",
          isDemo: true,
        },
      });
    }
  }

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        title: "Fee Overdue",
        message: "5 students have pending fees for this month.",
        type: "FEE_OVERDUE",
      },
      {
        title: "Low Attendance Alert",
        message: "3 students have attendance below 75%.",
        type: "LOW_ATTENDANCE",
      },
      {
        title: "Upcoming Exam",
        message: "Half Yearly Examination starts on 15 Sep 2025.",
        type: "EXAM",
      },
      {
        title: "Backup Reminder",
        message: "Weekly database backup is due.",
        type: "BACKUP",
      },
    ],
  });

  console.log("✅ Database seeded successfully!");
  console.log("");
  console.log("Demo Login Credentials:");
  console.log("  Admin:      admin / admin123");
  console.log("  Principal:  principal / admin123");
  console.log("  Accountant: accountant / admin123");
  console.log("  Teacher:    teacher1 / admin123");
  console.log("  Reception:  reception / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
