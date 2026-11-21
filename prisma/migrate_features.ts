import { getPrismaClient } from '../server/database/client';

export const ALL_FEATURE_IDS = [
  'students',
  'admissions',
  'classes',
  'teachers',
  'subjects',
  'fees',
  'payments',
  'attendance',
  'examinations',
  'results',
  'reports',
  'notifications',
  'backup',
];

export async function runMigration() {
  console.log('🔄 Running Feature Toggles & SchoolFeature Migration...');
  const db = getPrismaClient();

  try {
    // 1. Check if 'plan' column exists in 'School'
    const schoolColumns: any[] = await db.$queryRawUnsafe('PRAGMA table_info("School")');
    const hasPlan = schoolColumns.some((col) => col.name === 'plan');
    if (!hasPlan) {
      console.log('Adding "plan" column to "School" table...');
      await db.$executeRawUnsafe(`ALTER TABLE "School" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'PREMIUM'`);
    } else {
      console.log('"plan" column already exists in "School".');
    }

    // 2. Create 'SchoolFeature' table if not exists
    console.log('Creating "SchoolFeature" table...');
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SchoolFeature" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "schoolId" TEXT NOT NULL,
        "featureId" TEXT NOT NULL,
        "isEnabled" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SchoolFeature_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "SchoolFeature_schoolId_featureId_key" ON "SchoolFeature"("schoolId", "featureId")
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SchoolFeature_schoolId_idx" ON "SchoolFeature"("schoolId")
    `);

    // 3. Populate default features for all existing schools
    const schools: any[] = await db.$queryRawUnsafe('SELECT id, code FROM "School"');
    console.log(`Found ${schools.length} schools to verify/seed features.`);

    for (const school of schools) {
      for (const featId of ALL_FEATURE_IDS) {
        const featureUuid = `feat_${school.code.toLowerCase()}_${featId}`;
        await db.$executeRawUnsafe(`
          INSERT OR IGNORE INTO "SchoolFeature" ("id", "schoolId", "featureId", "isEnabled", "createdAt", "updatedAt")
          VALUES ('${featureUuid}', '${school.id}', '${featId}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
      }
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
