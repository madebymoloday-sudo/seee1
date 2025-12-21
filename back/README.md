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
│   ├── subscription/        # Подписка
│   └── integrations/        # Внешние интеграции
├── prisma/
│   ├── schema.prisma        # Схема БД
│   └── migrations/          # Миграции
└── test/                    # Тесты
```

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

