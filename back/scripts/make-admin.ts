import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Скрипт для назначения пользователя администратором
 *
 * Использование:
 *   npx ts-node scripts/make-admin.ts <username|email|userId>
 *
 * Примеры:
 *   npx ts-node scripts/make-admin.ts user@example.com
 *   npx ts-node scripts/make-admin.ts username123
 *   npx ts-node scripts/make-admin.ts USER1234
 */
async function makeAdmin(identifier: string) {
  try {
    // Ищем пользователя по email, username или userId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
          { userId: identifier },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        userId: true,
        role: true,
      },
    });

    if (!user) {
      console.error(`❌ Пользователь не найден: ${identifier}`);
      console.log("\nПопробуйте найти пользователя по:");
      console.log("  - Email");
      console.log("  - Username");
      console.log("  - UserId");
      process.exit(1);
    }

    if (user.role === "admin") {
      console.log(`✅ Пользователь уже является администратором:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email || "не указан"}`);
      console.log(`   UserId: ${user.userId || "не указан"}`);
      process.exit(0);
    }

    // Обновляем роль на admin
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
      select: {
        id: true,
        username: true,
        email: true,
        userId: true,
        role: true,
      },
    });

    console.log(`✅ Пользователь успешно назначен администратором:`);
    console.log(`   ID: ${updatedUser.id}`);
    console.log(`   Username: ${updatedUser.username}`);
    console.log(`   Email: ${updatedUser.email || "не указан"}`);
    console.log(`   UserId: ${updatedUser.userId || "не указан"}`);
    console.log(`   Роль: ${updatedUser.role}`);
  } catch (error) {
    console.error("❌ Ошибка при назначении администратора:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем аргумент из командной строки
const identifier = process.argv[2];

if (!identifier) {
  console.error("❌ Укажите email, username или userId пользователя");
  console.log("\nИспользование:");
  console.log("  npx ts-node scripts/make-admin.ts <username|email|userId>");
  console.log("\nПримеры:");
  console.log("  npx ts-node scripts/make-admin.ts user@example.com");
  console.log("  npx ts-node scripts/make-admin.ts username123");
  console.log("  npx ts-node scripts/make-admin.ts USER1234");
  process.exit(1);
}

makeAdmin(identifier);
