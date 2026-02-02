# 🤖 SEEE - Архитектура мышления

Веб-приложение для диалога с AI-психологом, работающим по специальному алгоритму.

## 🏗️ Архитектура

Проект разделен на два независимых сервиса:

- **Backend** (`/back`) - NestJS API сервер с PostgreSQL
- **Frontend** (`/front`) - React приложение с Vite

## 🚀 Быстрый старт

### Локальная разработка

```bash
# Запуск всех сервисов через Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Frontend будет доступен на http://localhost:5171
# Backend API будет доступен на http://localhost:3000
```

Подробнее: [README.DEV.md](./README.DEV.md)

## 🌐 Деплой на Railway

### Автоматический деплой

1. Откройте [Railway Dashboard](https://railway.app)
2. Создайте новый проект и подключите репозиторий `madebymoloday-sudo/seee1`
3. Добавьте два сервиса:
   - **Backend**: Root Directory = `back`
   - **Frontend**: Root Directory = `front`
4. Добавьте PostgreSQL базу данных
5. Настройте переменные окружения (см. [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md))

Railway автоматически предоставит публичные URL для каждого сервиса:
- **Frontend URL**: `https://your-frontend-service.railway.app`
- **Backend URL**: `https://your-backend-service.railway.app`

Подробная инструкция: [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)

## 📋 Основные функции

- 💬 Диалог с AI-психологом
- 🗺️ Карта "Карта не территория"
- 📊 Личный кабинет с MLM системой
- 📝 Журнал сессий
- 💭 Интересные мысли
- 🔒 Обнаружение суицидальных мыслей

## 🔧 Технологии

### Backend
- NestJS
- PostgreSQL + Prisma
- OpenAI GPT API
- Socket.IO
- JWT Authentication

### Frontend
- React 18+ с TypeScript
- Vite
- MobX для state management
- SWR для data fetching
- Tailwind CSS
- React Router

## 📄 Документация

- [README.DEV.md](./README.DEV.md) - Разработка локально
- [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) - Деплой на Railway
- [migrate/](./migrate/) - Документация по миграции и архитектуре

## 🔗 Ссылки

- **GitHub**: https://github.com/madebymoloday-sudo/seee1
- **Railway Dashboard**: https://railway.app

## 📝 Лицензия

UNLICENSED
