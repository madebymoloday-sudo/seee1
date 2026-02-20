/**
 * Генерация ссылки на восстановление пароля по email.
 * Использует БД напрямую (Prisma). Не требует API / support key.
 *
 * Usage:
 *   cd back && node scripts/generate-reset-link.js <email>
 *
 * Env: DATABASE_URL (обязательно), FRONTEND_URL (по умолчанию https://front-production-4a7e.up.railway.app)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/generate-reset-link.js <email>');
  process.exit(1);
}

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://front-production-4a7e.up.railway.app').replace(/\/+$/, '');
const expiresMinutes = 60;

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new Error('Пользователь с таким email не найден');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });
    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
    console.log(resetLink);
    console.error('Ссылка действительна', expiresMinutes, 'мин.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
