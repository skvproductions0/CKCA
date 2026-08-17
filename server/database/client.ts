import { PrismaClient } from "@prisma/client";
import path from "path";
import { app } from "electron";
import fs from "fs";

let prisma: PrismaClient | null = null;

export function getDatabasePath(): string {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return path.join(process.cwd(), "prisma", "dev.db");
  }

  const isWindows = process.platform === "win32";
  const baseDir = isWindows && process.env.ProgramData
    ? path.join(process.env.ProgramData, "SchoolManagement")
    : path.join(app.getPath("userData"), "database");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, "school.db");
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const dbPath = getDatabasePath();
    const dbUrl = `file:${dbPath}`;
    prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });
  }
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = getPrismaClient();
  await db.$connect();

  const settingsCount = await db.schoolSetting.count();
  if (settingsCount === 0) {
    await db.schoolSetting.create({
      data: {
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
  }

  const gradingCount = await db.gradingRule.count();
  if (gradingCount === 0) {
    await db.gradingRule.createMany({
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

  const feeCategoryCount = await db.feeCategory.count();
  if (feeCategoryCount === 0) {
    await db.feeCategory.createMany({
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
}
