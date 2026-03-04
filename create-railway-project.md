# 🚀 Создание проекта на Railway и получение ссылки на сайт

## ⚡ Быстрая инструкция (5 минут)

### Шаг 1: Создание проекта
1. Откройте https://railway.app
2. Войдите через GitHub (если еще не авторизованы)
3. Нажмите **"New Project"**
4. Выберите **"Deploy from GitHub repo"**
5. Выберите репозиторий `madebymoloday-sudo/seee1`
6. Railway автоматически начнет сканировать проект

### Шаг 2: Добавление PostgreSQL базы данных
1. В проекте нажмите **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway автоматически создаст базу данных и переменную `DATABASE_URL`

### Шаг 3: Создание Backend сервиса
1. Нажмите **"New Service"** → **"GitHub Repo"**
2. Выберите репозиторий `seee1`
3. В появившемся окне настроек:
   - **Name**: `backend` (или оставьте автоматическое имя)
   - **Root Directory**: `back` ⚠️ **ВАЖНО!**
   - **Build Command**: (оставьте пустым)
   - **Start Command**: (оставьте пустым)
4. Railway автоматически обнаружит Dockerfile и начнет сборку

### Шаг 4: Настройка переменных окружения Backend
1. Откройте настройки Backend сервиса → **"Variables"**
2. Добавьте следующие переменные:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=ваш-секретный-ключ-минимум-32-символа
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=ваш-другой-секретный-ключ-минимум-32-символа
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
OPENAI_API_KEY=ваш-openai-api-ключ
```

**Примечание**: 
- `${{Postgres.DATABASE_URL}}` - автоматически подставится из PostgreSQL сервиса
- `${{Frontend.RAILWAY_PUBLIC_DOMAIN}}` - подставится после создания Frontend сервиса
- `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` - подставится автоматически

### Шаг 5: Создание Frontend сервиса
1. Нажмите **"New Service"** → **"GitHub Repo"**
2. Выберите репозиторий `seee1`
3. В настройках:
   - **Name**: `frontend` (или оставьте автоматическое имя)
   - **Root Directory**: `front` ⚠️ **ВАЖНО!**
   - **Build Command**: (оставьте пустым)
   - **Start Command**: (оставьте пустым)
4. Railway автоматически обнаружит Dockerfile и начнет сборку

### Шаг 6: Настройка переменных окружения Frontend
1. Откройте настройки Frontend сервиса → **"Variables"**
2. Добавьте следующие переменные:

```env
API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
VITE_SOCKET_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

**Примечание**: `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` автоматически подставится из Backend сервиса

### Шаг 7: Получение ссылки на сайт 🎉
1. Откройте настройки **Frontend** сервиса
2. Перейдите в **"Settings"** → **"Networking"**
3. Нажмите **"Generate Domain"**
4. Скопируйте URL (например: `https://seee-frontend-production.up.railway.app`)

**Это и есть ссылка на ваш сайт!**

### Шаг 8: Обновление переменных окружения
После получения URL Frontend, обновите переменную в Backend:
1. Откройте Backend сервис → **"Variables"**
2. Обновите `FRONTEND_URL` на реальный URL Frontend (если не использовали `${{Frontend.RAILWAY_PUBLIC_DOMAIN}}`)

---

## 🔑 Генерация секретных ключей

Для `JWT_SECRET` и `JWT_REFRESH_SECRET` используйте:

**В терминале:**
```bash
openssl rand -base64 32
```

**Или онлайн генератор:**
- https://randomkeygen.com/
- Выберите "CodeIgniter Encryption Keys" или "Fort Knox Passwords"

---

## ✅ Проверка деплоя

1. Откройте Frontend URL в браузере
2. Проверьте логи в Railway Dashboard:
   - **Backend**: Откройте сервис → **"Deployments"** → выберите последний деплой → **"View Logs"**
   - **Frontend**: Откройте сервис → **"Deployments"** → выберите последний деплой → **"View Logs"**

---

## 🐛 Troubleshooting

### Backend не запускается
- Проверьте логи деплоя
- Убедитесь, что все переменные окружения установлены
- Проверьте, что `Root Directory` установлен в `back`

### Frontend не подключается к Backend
- Убедитесь, что `API_URL` в Frontend указывает на правильный Backend URL
- Проверьте, что Backend сервис запущен (зеленый индикатор)
- Проверьте логи Backend на наличие ошибок CORS

### Проблемы с базой данных
- Убедитесь, что PostgreSQL сервис создан
- Проверьте, что `DATABASE_URL` правильно установлен в Backend
- Проверьте логи Backend на наличие ошибок миграций Prisma

---

## 📞 Поддержка

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
