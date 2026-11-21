import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

async function migrateMultiSchool() {
  console.log('🚀 Starting Multi-School Database Migration...\n');

  // Verify DB path
  const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }

  // Backup current DB
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `backup-before-migration-${Date.now()}.db`);
  fs.copyFileSync(dbPath, backupFile);
  console.log(`📦 Safety backup created at: ${backupFile}`);

  const prisma = new PrismaClient();
  await prisma.$connect();

  // 1. Create School table if it does not exist
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "School" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "shortCode" TEXT NOT NULL DEFAULT 'CKCA',
      "code" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "address" TEXT,
      "city" TEXT,
      "state" TEXT,
      "pincode" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "website" TEXT,
      "board" TEXT DEFAULT 'CBSE',
      "affiliationNumber" TEXT,
      "principalName" TEXT,
      "logoPath" TEXT,
      "faviconPath" TEXT,
      "signaturePath" TEXT,
      "stampPath" TEXT,
      "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
      "secondaryColor" TEXT NOT NULL DEFAULT '#1e40af',
      "reportHeader" TEXT,
      "reportFooter" TEXT,
      "maxStudents" INTEGER NOT NULL DEFAULT 1000,
      "maxStaff" INTEGER NOT NULL DEFAULT 100,
      "licenseExpiresAt" DATETIME,
      "maintenanceMode" BOOLEAN NOT NULL DEFAULT 0,
      "maintenanceMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt" DATETIME
    );
  `);
  console.log('✅ "School" table created or verified.');

  // 2. Fetch existing SchoolSetting to populate default school
  const existingSettings: Array<any> = await prisma.$queryRawUnsafe(`SELECT * FROM "SchoolSetting" LIMIT 1;`);
  const setting = existingSettings[0] || {};

  const defaultSchoolId = 'school_ckca_default';
  const defaultSchoolName = setting.schoolName || 'CK CAREER ACADEMY';
  const defaultPrincipal = setting.principalName || 'Dr. Rajesh Sharma';
  const defaultPhone = setting.phone || '+91 98765 43210';
  const defaultEmail = setting.email || 'info@ckcareeracademy.edu';
  const defaultAddress = setting.address || '123 Education Lane, Knowledge City, State - 110001';
  const defaultWebsite = setting.website || 'www.ckcareeracademy.edu';

  await prisma.$executeRawUnsafe(`
    INSERT INTO "School" (
      "id", "name", "shortCode", "code", "status", "address", "phone", "email", "website", "principalName"
    ) VALUES (
      '${defaultSchoolId}', '${defaultSchoolName}', 'CKCA', 'CKCA01', 'ACTIVE',
      '${defaultAddress}', '${defaultPhone}', '${defaultEmail}', '${defaultWebsite}', '${defaultPrincipal}'
    )
    ON CONFLICT("code") DO NOTHING;
  `);
  console.log(`✅ Default school "${defaultSchoolName}" (Code: CKCA01, ID: ${defaultSchoolId}) confirmed.`);

  // 3. Add schoolId to all school-owned tables
  const tables = [
    'User',
    'SchoolSetting',
    'GradingRule',
    'FeeCategory',
    'AcademicYear',
    'Class',
    'Section',
    'Teacher',
    'Student',
    'Admission',
    'Subject',
    'FeeStructure',
    'StudentFee',
    'FeePayment',
    'Attendance',
    'Exam',
    'Result',
    'Document',
    'Notification',
    'AuditLog',
    'ReceiptCounter',
    'AdmissionCounter',
  ];

  for (const table of tables) {
    const tableInfo: Array<{ name: string }> = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}");`);
    const hasSchoolId = tableInfo.some((col) => col.name === 'schoolId');

    if (!hasSchoolId) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "schoolId" TEXT;`);
      console.log(`   + Added "schoolId" column to "${table}"`);
    }

    // Assign existing data to the default school
    if (table === 'User') {
      // Creator has NO schoolId (sits above all schools)
      await prisma.$executeRawUnsafe(`
        UPDATE "User"
        SET "schoolId" = '${defaultSchoolId}'
        WHERE "role" != 'CREATOR' AND ("schoolId" IS NULL OR "schoolId" = '');
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE "${table}"
        SET "schoolId" = '${defaultSchoolId}'
        WHERE "schoolId" IS NULL OR "schoolId" = '';
      `);
    }

    // Verify count
    const count: Array<{ count: number }> = await prisma.$queryRawUnsafe(
      `SELECT count(*) as count FROM "${table}" WHERE "schoolId" = '${defaultSchoolId}';`
    );
    console.log(`   ✓ "${table}": ${count[0].count} records linked to ${defaultSchoolName}`);
  }

  // Create index on schoolId for fast queries
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_${table}_schoolId" ON "${table}"("schoolId");
      `);
    } catch {
      // index already exists or non-fatal
    }
  }

  await prisma.$disconnect();
  console.log('\n🎉 Multi-school database migration successfully completed!');
}

migrateMultiSchool().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
