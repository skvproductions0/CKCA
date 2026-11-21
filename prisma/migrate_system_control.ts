import { getPrismaClient } from '../server/database/client';

async function migrateSystemControl() {
  console.log('🔄 Running migration: System Control (Sessions & SystemConfig)...');
  const db = getPrismaClient();

  try {
    // 1. Check Session table columns
    const sessionCols: Array<{ name: string }> = await db.$queryRawUnsafe(
      'PRAGMA table_info("Session");'
    );
    const existingColNames = new Set(sessionCols.map((c) => c.name));

    if (!existingColNames.has('device')) {
      console.log('  Adding device column to Session table...');
      await db.$executeRawUnsafe('ALTER TABLE "Session" ADD COLUMN "device" TEXT;');
    } else {
      console.log('  device column already exists on Session.');
    }

    if (!existingColNames.has('ipAddress')) {
      console.log('  Adding ipAddress column to Session table...');
      await db.$executeRawUnsafe('ALTER TABLE "Session" ADD COLUMN "ipAddress" TEXT;');
    } else {
      console.log('  ipAddress column already exists on Session.');
    }

    if (!existingColNames.has('lastActiveAt')) {
      console.log('  Adding lastActiveAt column to Session table...');
      await db.$executeRawUnsafe(
        'ALTER TABLE "Session" ADD COLUMN "lastActiveAt" DATETIME;'
      );
      await db.$executeRawUnsafe(
        'UPDATE "Session" SET "lastActiveAt" = CURRENT_TIMESTAMP WHERE "lastActiveAt" IS NULL;'
      );
    } else {
      console.log('  lastActiveAt column already exists on Session.');
    }

    // 2. Create SystemConfig table
    console.log('  Ensuring SystemConfig table exists...');
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemConfig" (
        "key" TEXT NOT NULL PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Seed default system configurations
    const defaults = [
      { key: 'maintenance_mode', value: 'false' },
      {
        key: 'maintenance_message',
        value: 'The system is currently undergoing scheduled maintenance. Please try again shortly.',
      },
      { key: 'daily_backup_enabled', value: 'true' },
      { key: 'daily_backup_time', value: '02:00' },
      { key: 'backup_retention_days', value: '30' },
      { key: 'last_daily_backup_at', value: '' },
    ];

    for (const d of defaults) {
      await db.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "SystemConfig" ("key", "value", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP);`,
        d.key,
        d.value
      );
    }

    console.log('✅ System Control migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

migrateSystemControl();
