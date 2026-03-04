# SEEE Backend

Backend для системы AI-психолога SEEE на NestJS.

## Требования

- Node.js 18+
- Docker и Docker Compose
- PostgreSQL (через Docker)

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск базы данных

```bash
docker-compose up -d
```

Это запустит PostgreSQL на порту 5432.

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните необходимые значения:

```bash
cp .env.example .env
```

**Telegram-бот (@SeeeAppBot):** в `.env` (локально) или в переменных окружения сервера (Railway → проект back → Variables) обязательно должен быть задан `TELEGRAM_LOGIN_BOT_TOKEN` — токен от @BotFather. Без него бот не запустится. Кнопка «Пройти тест» и сценарий теста появятся в боте только после того, как обновлённый бэкенд будет задеплоен и перезапущен (см. раздел «Деплой» ниже).

### 4. Настройка Prisma

```bash
# Генерация Prisma Client
npm run prisma:generate

# Создание миграций
npm run prisma:migrate
```

### 5. Запуск приложения

```bash
# Development режим
npm run start:dev

# Production режим
npm run build
npm run start:prod
```

Приложение будет доступно на `http://localhost:3000`

## Docker Compose

### Запуск базы данных

```bash
docker-compose up -d
```

### Остановка базы данных

```bash
docker-compose down
```

### Просмотр логов

```bash
docker-compose logs -f postgres
```

### Очистка данных (⚠️ удалит все данные)

```bash
docker-compose down -v
```

## Prisma

### Генерация Prisma Client

```bash
npm run prisma:generate
```

### Создание миграции

```bash
npm run prisma:migrate
```

### Prisma Studio (GUI для БД)

```bash
npm run prisma:studio
```

## API Документация

После запуска приложения, Swagger документация доступна по адресу:

- Swagger UI: `http://localhost:3000/api/docs`
- JSON схема: `http://localhost:3000/api-json`

## Структура проекта

```
back/
├── src/
│   ├── main.ts              # Точка входа
│   ├── app.module.ts        # Корневой модуль
│   ├── prisma/              # Prisma сервис
│   ├── config/              # Конфигурация
│   ├── common/              # Общие утилиты
│   ├── auth/                # Аутентификация
│   ├── sessions/            # Сессии
│   ├── messages/            # Сообщения
│   ├── event-map/           # Нейрокарта
│   ├── psychologist/        # AI психолог
│   ├── websocket/           # Socket.IO
│   └── integrations/        # Внешние интеграции
├── prisma/
│   ├── schema.prisma        # Схема БД
│   └── migrations/          # Миграции
└── test/                    # Тесты
```

## Деплой (Railway): чтобы в боте @SeeeAppBot появилась кнопка «Пройти тест»

Код с кнопкой «Пройти тест» и тестом личности уже в этом репозитории (`src/telegram-bot/`). Бот в Telegram показывает то, что запущено на сервере. Чтобы кнопка появилась:

1. **Закоммитьте и запушьте** все изменения в папке `back/` в тот репозиторий, с которого деплоится Railway.
2. **Railway → ваш проект бэкенда → Variables.** Убедитесь, что задана переменная **`TELEGRAM_LOGIN_BOT_TOKEN`** (токен бота от @BotFather). Без неё бот не работает.
3. **Сделайте Redeploy** бэкенда (или дождитесь автодеплоя после push). После успешного деплоя бот начнёт работать с новым кодом и покажет три кнопки: «Запускаемся», «Пройти тест», «Личный кабинет».

Файл теста: в корне `back/` должен лежать `telegram_test_prompt.json` (скопируйте из корня проекта при необходимости).

## Переменные окружения

См. `.env.example` для полного списка переменных окружения.

## Тестирование

```bash
# Unit тесты
npm run test

# E2E тесты
npm run test:e2e

# Coverage
npm run test:cov
```

