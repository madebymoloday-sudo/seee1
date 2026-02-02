# 🎯 ФИНАЛЬНЫЕ ШАГИ: Создание сервисов через веб-интерфейс

## ✅ Что уже готово:

1. ✅ Railway CLI установлен и авторизован
2. ✅ Проект "sunny-expression" связан с обеими папками (back/ и front/)
3. ✅ Конфигурационные файлы `railway.toml` созданы
4. ✅ Все изменения отправлены в GitHub

## 🚀 Создание сервисов через Railway Dashboard:

### Шаг 1: Откройте Railway Dashboard

1. Перейдите на https://railway.app
2. Войдите в проект **"sunny-expression"**

### Шаг 2: Создайте Backend сервис

1. В проекте нажмите **"New"** → **"Service"** → **"GitHub Repo"**
2. Выберите репозиторий `madebymoloday-sudo/seee1`
3. Railway автоматически начнет сканировать проект
4. **ВАЖНО**: Railway должен автоматически определить структуру благодаря файлу `back/railway.toml`
5. Если Railway не определил автоматически:
   - В настройках сервиса найдите **"Source"** или **"Build"**
   - Установите **"Root Directory"** = `back`
6. Назовите сервис: `backend` (или оставьте автоматическое имя)
7. Railway начнет деплой автоматически

### Шаг 3: Создайте Frontend сервис

1. В проекте нажмите **"New"** → **"Service"** → **"GitHub Repo"**
2. Выберите тот же репозиторий `madebymoloday-sudo/seee1`
3. Railway автоматически начнет сканировать проект
4. **ВАЖНО**: Railway должен автоматически определить структуру благодаря файлу `front/railway.toml`
5. Если Railway не определил автоматически:
   - В настройках сервиса найдите **"Source"** или **"Build"**
   - Установите **"Root Directory"** = `front`
6. Назовите сервис: `frontend` (или оставьте автоматическое имя)
7. Railway начнет деплой автоматически

### Шаг 4: Добавьте PostgreSQL (если еще нет)

1. В проекте нажмите **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway автоматически создаст базу данных

### Шаг 5: Настройте переменные окружения

#### Backend сервис → Variables:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=[сгенерируйте: openssl rand -base64 32]
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=[сгенерируйте другую строку]
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
OPENAI_API_KEY=[ваш ключ]
```

#### Frontend сервис → Variables:

```
API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
VITE_SOCKET_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

### Шаг 6: Получите URL сайта

1. Откройте **Frontend** сервис
2. Перейдите в **Settings** → **Networking**
3. Нажмите **"Generate Domain"**
4. Скопируйте URL (например: `https://frontend-production-xxxxx.up.railway.app`)
5. **Это и есть ссылка на ваш сайт!** 🎉

---

## 🔍 Проверка деплоя:

После создания сервисов проверьте:

1. **Статус деплоя:**
   - Оба сервиса должны показывать "Deployment successful" (зеленый индикатор)

2. **Логи (если что-то не работает):**
   - Backend → Deployments → последний деплой → View Logs
   - Frontend → Deployments → последний деплой → View Logs

3. **Проверка URL:**
   - Откройте URL Frontend в браузере
   - Сайт должен загрузиться

---

## 📝 Примечания:

- Файлы `railway.toml` в папках `back/` и `front/` должны помочь Railway автоматически определить правильную структуру
- Если Railway не определяет автоматически, вручную установите Root Directory в настройках сервиса
- Деплой может занять 5-10 минут для каждого сервиса

---

## ✅ Готово!

После выполнения этих шагов у вас будет:
- ✅ Backend сервис на Railway
- ✅ Frontend сервис на Railway
- ✅ PostgreSQL база данных
- ✅ Публичный URL сайта
