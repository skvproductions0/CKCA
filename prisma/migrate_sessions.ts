import { getPrismaClient } from '../server/database/client';

export async function runSessionsMigration() {
  console.log('🔄 Running Academic Session & Rollover Migration...');
  const db = getPrismaClient();

  try {
    // 1. Check StudentFee for previousDuePaise
    const feeCols: any[] = await db.$queryRawUnsafe('PRAGMA table_info("StudentFee")');
    const hasPreviousDue = feeCols.some((c) => c.name === 'previousDuePaise');
    if (!hasPreviousDue) {
      console.log('Adding "previousDuePaise" to "StudentFee" table...');
      await db.$executeRawUnsafe('ALTER TABLE "StudentFee" ADD COLUMN "previousDuePaise" INTEGER NOT NULL DEFAULT 0');
    } else {
      console.log('"previousDuePaise" already exists in "StudentFee".');
    }

    // 2. Check AcademicYear for isClosed
    const yearCols: any[] = await db.$queryRawUnsafe('PRAGMA table_info("AcademicYear")');
    const hasIsClosed = yearCols.some((c) => c.name === 'isClosed');
    if (!hasIsClosed) {
      console.log('Adding "isClosed" to "AcademicYear" table...');
      await db.$executeRawUnsafe('ALTER TABLE "AcademicYear" ADD COLUMN "isClosed" BOOLEAN NOT NULL DEFAULT 0');
    } else {
      console.log('"isClosed" already exists in "AcademicYear".');
    }

    // 3. Ensure exactly one active session per school
    const schools: any[] = await db.$queryRawUnsafe('SELECT id, name FROM "School"');
    for (const school of schools) {
      const activeYears: any[] = await db.$queryRawUnsafe(
        `SELECT id, name FROM "AcademicYear" WHERE "schoolId" = '${school.id}' AND "isCurrent" = 1 ORDER BY "startDate" DESC`
      );
      if (activeYears.length > 1) {
        console.log(`Fixing multiple active sessions for ${school.name}: keeping ${activeYears[0].name} active.`);
        for (let i = 1; i < activeYears.length; i++) {
          await db.$executeRawUnsafe(
            `UPDATE "AcademicYear" SET "isCurrent" = 0, "isClosed" = 1 WHERE "id" = '${activeYears[i].id}'`
          );
        }
      } else if (activeYears.length === 0) {
        // Find latest year and make it current
        const latestYears: any[] = await db.$queryRawUnsafe(
          `SELECT id, name FROM "AcademicYear" WHERE "schoolId" = '${school.id}' ORDER BY "startDate" DESC LIMIT 1`
        );
        if (latestYears.length > 0) {
          console.log(`Setting latest year ${latestYears[0].name} as current for ${school.name}.`);
          await db.$executeRawUnsafe(
            `UPDATE "AcademicYear" SET "isCurrent" = 1 WHERE "id" = '${latestYears[0].id}'`
          );
        }
      }
    }

    console.log('✅ Sessions migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Sessions migration failed:', error);
    process.exit(1);
  }
}

runSessionsMigration();
