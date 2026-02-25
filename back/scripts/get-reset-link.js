#!/usr/bin/env node
/**
 * Генерация ссылки восстановления пароля и вывод ТОЛЬКО ссылки в stdout (первая строка).
 * Чтобы ассистент мог прислать ссылку в чат: в back/.env должны быть заданы:
 *   Вариант А: DATABASE_URL=postgresql://...  (из Railway → Database → Connect)
 *   Вариант Б: API_URL=https://ваш-бэкенд.railway.app  и  TELEGRAM_LOGIN_BOT_TOKEN=токен_бота
 *
 * Запуск: node scripts/get-reset-link.js <email>
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Использование: node scripts/get-reset-link.js <email>");
  process.exit(1);
}

const FRONTEND_URL = (process.env.FRONTEND_URL || "https://front-production-4a7e.up.railway.app").replace(/\/+$/, "");
const API_URL = (process.env.API_URL || "").replace(/\/+$/, "");
const SUPPORT_KEY = process.env.SUPPORT_KEY || process.env.TELEGRAM_LOGIN_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

async function viaSupportApi() {
  if (!API_URL || !SUPPORT_KEY) return null;
  const url = API_URL + "/api/v1/auth/support/password-reset-link";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-support-key": SUPPORT_KEY },
    body: JSON.stringify({ email, expiresInMinutes: 60 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const d = await res.json();
  return d.resetLink || null;
}

async function viaDb() {
  if (!DATABASE_URL) return null;
  const { PrismaClient } = require("@prisma/client");
  const crypto = require("crypto");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) throw new Error("Пользователь с таким email не найден");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });
    return `${FRONTEND_URL}/reset-password?token=${token}`;
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  try {
    let link = null;
    try {
      link = await viaSupportApi();
    } catch (_) {}
    if (!link) link = await viaDb();
    if (link) {
      console.log(link);
      return;
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  console.error(
    "Добавь в back/.env один из вариантов:\n" +
      "  А) DATABASE_URL=postgresql://... (из Railway → Database → Connect)\n" +
      "  Б) API_URL=https://твой-бэкенд.railway.app и TELEGRAM_LOGIN_BOT_TOKEN=токен_бота"
  );
  process.exit(1);
})();
