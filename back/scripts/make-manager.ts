import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function makeManager(identifier: string, seatsLimitRaw?: string) {
  const seatsLimit = Math.max(1, Math.floor(Number(seatsLimitRaw || 20)));

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
          { userId: identifier },
          { fullName: identifier },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        userId: true,
        fullName: true,
        accountType: true,
        teamInviteCode: true,
      },
    });

    if (!user) {
      console.error(`❌ Пользователь не найден: ${identifier}`);
      process.exit(1);
    }

    const teamInviteCode =
      user.teamInviteCode || `TEAM${randomBytes(4).toString("hex").toUpperCase()}`;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        accountType: "MANAGER",
        teamSeatsLimit: seatsLimit,
        teamInviteCode,
      },
      select: {
        id: true,
        username: true,
        email: true,
        userId: true,
        fullName: true,
        accountType: true,
        teamSeatsLimit: true,
        teamInviteCode: true,
      },
    });

    console.log("✅ Пользователь переведен в статус основателя:");
    console.log(`   ID: ${updated.id}`);
    console.log(`   Username: ${updated.username}`);
    console.log(`   Email: ${updated.email || "не указан"}`);
    console.log(`   UserId: ${updated.userId || "не указан"}`);
    console.log(`   FullName: ${updated.fullName || "не указан"}`);
    console.log(`   AccountType: ${updated.accountType}`);
    console.log(`   TeamSeatsLimit: ${updated.teamSeatsLimit}`);
    console.log(`   TeamInviteCode: ${updated.teamInviteCode}`);
  } catch (error) {
    console.error("❌ Ошибка при назначении статуса основателя:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const identifier = process.argv[2];
const seatsLimit = process.argv[3];

if (!identifier) {
  console.error("❌ Укажите email, username, userId или fullName пользователя");
  console.log("\nИспользование:");
  console.log("  npx ts-node scripts/make-manager.ts <identifier> [teamSeatsLimit]");
  process.exit(1);
}

makeManager(identifier, seatsLimit);
