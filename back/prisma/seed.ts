import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

/**
 * Массив администраторов для создания
 * Легко добавлять новых админов - просто добавьте объект в массив
 */
const admins = [
  {
    email: "effectcor@gmail.com",
    password: "testtest",
    username: "effectcor",
    fullName: "Effectcor Admin",
  },
  {
    email: "gulopavel@gmail.com",
    password: "testtest",
    username: "gulopavel",
    fullName: "Gulopavel Admin",
  },
  // Добавьте новых администраторов здесь:
  // {
  //   email: "newadmin@example.com",
  //   password: "password123",
  //   username: "newadmin",
  //   fullName: "New Admin",
  // },
];

async function main() {
  console.log("🌱 Начинаем seed администраторов...\n");

  for (const adminData of admins) {
    try {
      // Проверяем, существует ли пользователь
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: adminData.email }, { username: adminData.username }],
        },
      });

      if (existingUser) {
        // Если пользователь существует, обновляем его роль на admin
        if (existingUser.role !== "admin") {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: "admin" },
          });
          console.log(
            `✅ Пользователь ${adminData.email} обновлен до администратора`
          );
        } else {
          console.log(
            `ℹ️  Пользователь ${adminData.email} уже является администратором`
          );
        }
        continue;
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(adminData.password, 12);

      // Генерируем userId (первые 8 символов hex в верхнем регистре)
      const userId = randomBytes(4).toString("hex").toUpperCase();

      // Создаем администратора
      const admin = await prisma.user.create({
        data: {
          email: adminData.email,
          username: adminData.username,
          passwordHash: hashedPassword,
          fullName: adminData.fullName,
          userId,
          role: "admin",
        },
      });

      // Создаем начальный баланс
      await prisma.balance.create({
        data: {
          userId: admin.id,
          amount: 0,
        },
      });

      console.log(`✅ Администратор создан: ${adminData.email}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   UserId: ${admin.userId}`);
      console.log(`   ID: ${admin.id}\n`);
    } catch (error) {
      console.error(`❌ Ошибка при создании администратора ${adminData.email}:`, error);
    }
  }

  console.log("✨ Seed администраторов завершен!");
}

main()
  .catch((e) => {
    console.error("❌ Ошибка при выполнении seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

