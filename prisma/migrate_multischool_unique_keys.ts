import { getPrismaClient } from '../server/database/client';

async function migrateMultiSchoolUniqueKeys() {
  console.log('🔄 Updating multi-school tenant unique constraints...');
  const db = getPrismaClient();

  const dropAndCreate = async (dropIdx: string, createSql: string) => {
    try {
      await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "${dropIdx}"`);
      await db.$executeRawUnsafe(createSql);
      console.log(`Updated index: ${dropIdx}`);
    } catch (err) {
      console.warn(`Notice for ${dropIdx}:`, err);
    }
  };

  // AcademicYear
  await dropAndCreate(
    'AcademicYear_name_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "AcademicYear_schoolId_name_key" ON "AcademicYear"("schoolId", "name")'
  );

  // Class
  await dropAndCreate(
    'Class_name_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Class_schoolId_name_key" ON "Class"("schoolId", "name")'
  );

  // Teacher employeeId
  await dropAndCreate(
    'Teacher_employeeId_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Teacher_schoolId_employeeId_key" ON "Teacher"("schoolId", "employeeId")'
  );

  // Student studentId & admissionNumber
  await dropAndCreate(
    'Student_studentId_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_studentId_key" ON "Student"("schoolId", "studentId")'
  );
  await dropAndCreate(
    'Student_admissionNumber_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber")'
  );

  // Admission admissionNumber
  await dropAndCreate(
    'Admission_admissionNumber_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Admission_schoolId_admissionNumber_key" ON "Admission"("schoolId", "admissionNumber")'
  );

  // ReceiptCounter & AdmissionCounter
  await dropAndCreate(
    'ReceiptCounter_year_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ReceiptCounter_schoolId_year_key" ON "ReceiptCounter"("schoolId", "year")'
  );
  await dropAndCreate(
    'AdmissionCounter_year_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "AdmissionCounter_schoolId_year_key" ON "AdmissionCounter"("schoolId", "year")'
  );

  console.log('✅ Multi-school tenant unique constraints updated successfully.');
  process.exit(0);
}

migrateMultiSchoolUniqueKeys().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
