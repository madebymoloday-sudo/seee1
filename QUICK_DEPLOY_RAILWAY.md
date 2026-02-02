# ⚡ Быстрый деплой на Railway

## 🎯 Вариант 1: Через Railway Dashboard (Самый простой)

### Шаг 1: Авторизация
1. Откройте https://railway.app
2. Войдите через GitHub

### Шаг 2: Создание проекта
1. Нажмите **"New Project"**
2. Выберите **"Deploy from GitHub repo"**
3. Выберите репозиторий `madebymoloday-sudo/seee1`

### Шаг 3: Добавление PostgreSQL
1. В проекте нажмите **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway автоматически создаст переменную `DATABASE_URL`

### Шаг 4: Деплой Backend
1. Нажмите **"New Service"** → **"GitHub Repo"**
2. Выберите репозиторий `seee1`
3. В настройках сервиса:
   - **Name**: `backend`
   - **Root Directory**: `back`
   - **Build Command**: (оставить пустым)
   - **Start Command**: (оставить пустым)

4. **Переменные окружения** (Settings → Variables):
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=ваш-секретный-ключ-для-jwt
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_SECRET=ваш-секретный-ключ-для-refresh
   JWT_REFRESH_EXPIRES_IN=7d
   FRONTEND_URL=${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
   OPENAI_API_KEY=ваш-openai-api-ключ
   ```

5. Railway автоматически начнет деплой

### Шаг 5: Деплой Frontend
1. Нажмите **"New Service"** → **"GitHub Repo"**
2. Выберите репозиторий `seee1`
3. В настройках сервиса:
   - **Name**: `frontend`
   - **Root Directory**: `front`
   - **Build Command**: (оставить пустым)
   - **Start Command**: (оставить пустым)

4. **Переменные окружения**:
   ```env
   API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
   VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
   VITE_SOCKET_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
   ```

5. Railway автоматически начнет деплой

### Шаг 6: Получение URL
1. Откройте настройки **Frontend** сервиса
2. Перейдите в **"Settings"** → **"Networking"**
3. Нажмите **"Generate Domain"**
4. Скопируйте URL (например: `https://seee-frontend.railway.app`)

**Это и есть ссылка на ваш сайт! 🎉**

---

## 🚀 Вариант 2: Через Railway CLI

### Шаг 1: Авторизация
```bash
railway login
```

### Шаг 2: Запуск скрипта деплоя
```bash
cd "/Users/pavelgulo/Desktop/курсор/Seee 1"
./deploy-railway.sh
```

Или вручную:

```bash
# Инициализация проекта
railway init

# Добавление PostgreSQL
railway add postgresql

# Деплой Backend
cd back
railway up --service backend

# Деплой Frontend
cd ../front
railway up --service frontend

# Получение URL
railway domain --service frontend
```

---

## 🔑 Генерация секретных ключей

Для `JWT_SECRET` и `JWT_REFRESH_SECRET` используйте:

```bash
# В терминале
openssl rand -base64 32
```

Или онлайн генератор: https://randomkeygen.com/

---

## ✅ Проверка деплоя

1. Откройте Frontend URL в браузере
2. Проверьте, что страница загружается
3. Проверьте логи в Railway Dashboard:
   - **Backend**: Settings → Deployments → View Logs
   - **Frontend**: Settings → Deployments → View Logs

---

## 🐛 Troubleshooting

### Backend не запускается
- Проверьте логи в Railway Dashboard
- Убедитесь, что все переменные окружения установлены
- Проверьте, что PostgreSQL база данных создана

### Frontend не подключается к Backend
- Убедитесь, что `API_URL` в Frontend указывает на правильный Backend URL
- Проверьте CORS настройки в Backend
- Убедитесь, что Backend сервис запущен

### Проблемы с базой данных
- Проверьте, что `DATABASE_URL` правильно установлен
- Проверьте логи Backend на наличие ошибок миграций Prisma

---

## 📞 Поддержка

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
