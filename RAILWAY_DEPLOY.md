# 🚂 Деплой на Railway

Инструкция по развертыванию приложения SEEE на Railway.

## 📋 Структура проекта

Проект состоит из двух сервисов:
- **Backend** (`/back`) - NestJS API сервер
- **Frontend** (`/front`) - React приложение

## 🚀 Вариант 1: Деплой через Railway UI (Рекомендуется)

### Шаг 1: Создание проекта на Railway

1. Откройте [Railway Dashboard](https://railway.app)
2. Нажмите **"New Project"**
3. Выберите **"Deploy from GitHub repo"**
4. Выберите репозиторий `madebymoloday-sudo/seee1`

### Шаг 2: Настройка Backend сервиса

1. В проекте Railway нажмите **"New Service"**
2. Выберите **"GitHub Repo"** и укажите `seee1`
3. В настройках сервиса:
   - **Root Directory**: `back`
   - **Build Command**: (оставить пустым, используется Dockerfile)
   - **Start Command**: (оставить пустым, используется Dockerfile CMD)

4. **Переменные окружения** (Environment Variables):
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
   JWT_REFRESH_EXPIRES_IN=7d
   FRONTEND_URL=${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
   OPENAI_API_KEY=your-openai-api-key
   ```

5. **Добавьте PostgreSQL базу данных**:
   - В проекте Railway нажмите **"New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway автоматически создаст переменную `DATABASE_URL`

### Шаг 3: Настройка Frontend сервиса

1. В проекте Railway нажмите **"New Service"**
2. Выберите **"GitHub Repo"** и укажите `seee1`
3. В настройках сервиса:
   - **Root Directory**: `front`
   - **Build Command**: (оставить пустым, используется Dockerfile)
   - **Start Command**: (оставить пустым, используется Dockerfile CMD)

4. **Переменные окружения**:
   ```env
   API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
   VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
   VITE_SOCKET_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
   ```

5. **Настройте публичный домен**:
   - В настройках Frontend сервиса перейдите в **"Settings"** → **"Networking"**
   - Нажмите **"Generate Domain"** или используйте свой кастомный домен

### Шаг 4: Настройка зависимостей

1. В настройках Frontend сервиса добавьте зависимость от Backend:
   - **Settings** → **Dependencies** → **Add Dependency** → выберите Backend сервис

2. В настройках Backend сервиса добавьте зависимость от PostgreSQL:
   - **Settings** → **Dependencies** → **Add Dependency** → выберите PostgreSQL

## 🔧 Вариант 2: Деплой через Railway CLI

### Установка Railway CLI

```bash
npm i -g @railway/cli
```

### Авторизация

```bash
railway login
```

### Инициализация проекта

```bash
cd "/Users/pavelgulo/Desktop/курсор/Seee 1"
railway init
```

### Деплой Backend

```bash
cd back
railway up --service backend
```

### Деплой Frontend

```bash
cd front
railway up --service frontend
```

## 📝 Важные переменные окружения

### Backend

- `DATABASE_URL` - автоматически создается Railway при добавлении PostgreSQL
- `JWT_SECRET` - секретный ключ для JWT токенов (сгенерируйте случайную строку)
- `JWT_REFRESH_SECRET` - секретный ключ для refresh токенов
- `FRONTEND_URL` - URL фронтенда (используйте `${{Frontend.RAILWAY_PUBLIC_DOMAIN}}`)
- `OPENAI_API_KEY` - ваш API ключ OpenAI

### Frontend

- `API_URL` - URL бэкенда (используйте `${{Backend.RAILWAY_PUBLIC_DOMAIN}}`)
- `VITE_API_URL` - полный URL API (используйте `${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1`)
- `VITE_SOCKET_URL` - URL для WebSocket соединений

## 🔗 Получение URL приложения

После деплоя Railway предоставит публичный URL для каждого сервиса:

- **Frontend URL**: `https://your-frontend-service.railway.app`
- **Backend URL**: `https://your-backend-service.railway.app`

Эти URL можно найти в настройках каждого сервиса в разделе **"Networking"**.

## 🔄 Автоматический деплой

Railway автоматически деплоит изменения при каждом push в ветку `main` репозитория.

## 🐛 Troubleshooting

### Backend не запускается

1. Проверьте логи: `railway logs --service backend`
2. Убедитесь, что все переменные окружения установлены
3. Проверьте, что PostgreSQL база данных создана и подключена

### Frontend не подключается к Backend

1. Убедитесь, что `API_URL` в Frontend указывает на правильный Backend URL
2. Проверьте CORS настройки в Backend (должен разрешать запросы с Frontend домена)
3. Проверьте, что Backend сервис запущен и доступен

### Проблемы с базой данных

1. Убедитесь, что миграции Prisma применены (они применяются автоматически при старте)
2. Проверьте `DATABASE_URL` в переменных окружения Backend
3. В логах Backend должны быть сообщения о применении миграций

## 📚 Дополнительные ресурсы

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
