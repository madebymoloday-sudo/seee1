# Ссылка для восстановления пароля

## Для аккаунта Skorpio_tanya@mail.ru

### Способ 1: через БД (локально)

1. В `back/.env` задайте `DATABASE_URL` — строка подключения к PostgreSQL (из Railway: Database → Connect → Public URL).
2. Опционально: `FRONTEND_URL=https://front-production-4a7e.up.railway.app` (по умолчанию уже этот URL).
3. Выполните:

```bash
cd back && node scripts/generate-reset-link.js Skorpio_tanya@mail.ru
```

В консоль выведется готовая ссылка (действительна 60 мин).

---

### Способ 2: через Support API (без доступа к БД)

Нужны URL бэкенда и ключ (значение `TELEGRAM_LOGIN_BOT_TOKEN` с прод-сервера).

```bash
cd back
API_URL=https://back-production-c25c.up.railway.app SUPPORT_KEY=<ваш_токен_бота> node scripts/support-password-reset-link.js Skorpio_tanya@mail.ru
```

Подставьте вместо `<ваш_токен_бота>` значение переменной `TELEGRAM_LOGIN_BOT_TOKEN` из переменных окружения бэкенда в Railway.

В консоль выведется `Reset link:` и ссылка.
