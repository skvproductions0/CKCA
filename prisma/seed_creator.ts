import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("👑 Seeding Creator account...");

  const passwordHash = await bcrypt.hash("Creator@2026!", 12);

  const creator = await prisma.user.upsert({
    where: { username: "creator" },
    update: {
      role: "CREATOR",
      isActive: true,
      deletedAt: null,
    },
    create: {
      username: "creator",
      email: "creator@ckcareeracademy.com",
      passwordHash,
      fullName: "System Creator & Owner",
      role: "CREATOR",
      isActive: true,
    },
  });

  console.log(`✅ Creator account ready:`);
  console.log(`   Username: ${creator.username}`);
  console.log(`   Email:    ${creator.email}`);
  console.log(`   Role:     ${creator.role}`);
  console.log(`   Password: Creator@2026!`);
}

main()
  .catch((e) => {
    console.error("❌ Failed to seed Creator account:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
