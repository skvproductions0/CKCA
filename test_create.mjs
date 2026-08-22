import { PrismaClient } from '@prisma/client';

const p = new PrismaClient({
  datasources: { db: { url: 'file:C:/Users/shubh/Desktop/ck/CKCA/prisma/dev.db' } }
});

try {
  // Test what happens when Electron runs wizard (with cwd = c:\Users\shubh\Desktop\ck)
  // The admissionCounter is checked first
  const year = 2026;
  let counter = await p.admissionCounter.findUnique({ where: { year } });
  console.log('Counter:', counter);

  const student = await p.student.create({
    data: {
      name: 'TestElectron',
      studentId: 'STU-ELEC-001',
      admissionNumber: 'ADM-ELEC-001',
      classId: '76292140-1ef4-4f83-8c04-cfd59ff266c2', // Class 9
      academicYearId: 'fae3c610-e7a4-48b5-bd75-dda83b38c729', // 2025-26
    }
  });
  console.log('Student created OK:', student.id);
} catch (e) {
  console.error('FAIL:', e.message);
} finally {
  await p.$disconnect();
}
