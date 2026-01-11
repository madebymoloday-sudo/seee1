# 🔍 Проверка endpoints

## ✅ Это нормально!

Backend API (`back-production-cc01.up.railway.app`) **НЕ отвечает** на корневой путь `/` - это правильно!

Backend API отвечает только на специфичные endpoints, например:
- `/api/v1/*` - API endpoints
- `/api/docs` - Swagger документация
- `/api-json` - JSON schema

---

## 🎯 Что проверить:

### 1. Проверьте Swagger документацию Backend:

Откройте в браузере:
```
https://back-production-cc01.up.railway.app/api/docs
```

Должна открыться Swagger документация со всеми доступными endpoints.

---

### 2. Проверьте Frontend домен:

В Railway Dashboard:
- **Frontend сервис → Settings → Networking**
- Найдите **"Public Domain"** или **"Generate Domain"**
- Это будет URL вашего Frontend (например: `front-production-xxxx.up.railway.app`)

**Frontend** - это то, что нужно открывать в браузере для работы с сайтом!

---

### 3. Проверьте переменные окружения:

**Frontend сервис → Variables:**
- `API_URL` должен указывать на Backend: `https://back-production-cc01.up.railway.app`
- `VITE_API_URL` должен быть: `https://back-production-cc01.up.railway.app/api/v1`

---

## 📝 Правильные URLs:

### Backend (API):
- Swagger: `https://back-production-cc01.up.railway.app/api/docs`
- API: `https://back-production-cc01.up.railway.app/api/v1/*`

### Frontend (сайт):
- Главная: `https://[ваш-frontend-домен].up.railway.app`
- Логин: `https://[ваш-frontend-домен].up.railway.app/login`

---

## ⚠️ ВАЖНО:

**Backend** - это API сервер, он не показывает веб-страницы!
**Frontend** - это веб-сайт, который нужно открывать в браузере!
