import { getPrismaClient } from '../server/database/client';

async function migrateUserColumns() {
  console.log('🔄 Checking User table for Super Admin management columns...');
  const db = getPrismaClient();

  const cols: any[] = await db.$queryRawUnsafe('PRAGMA table_info("User")');
  const existingColNames = new Set(cols.map((c) => c.name));

  if (!existingColNames.has('forcePasswordChange')) {
    console.log('Adding "forcePasswordChange" column...');
    await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "forcePasswordChange" BOOLEAN NOT NULL DEFAULT 0');
  }

  if (!existingColNames.has('isLocked')) {
    console.log('Adding "isLocked" column...');
    await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT 0');
  }

  if (!existingColNames.has('lockReason')) {
    console.log('Adding "lockReason" column...');
    await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "lockReason" TEXT');
  }

  console.log('✅ User table columns up to date.');
  process.exit(0);
}

migrateUserColumns().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
