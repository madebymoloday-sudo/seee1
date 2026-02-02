# 🚀 ПОШАГОВАЯ ИНСТРУКЦИЯ: Создание Backend и Frontend на Railway

## ✅ Что у вас уже есть:
- ✅ Проект создан на Railway
- ✅ Один сервис `seee1` задеплоен

## 🎯 ЧТО НУЖНО СДЕЛАТЬ:

### Создать ДВА сервиса:
1. **Backend** - API сервер (NestJS)
2. **Frontend** - Веб-интерфейс (React)

---

## 📋 ШАГ 1: Создание Backend сервиса

### Вариант A: Переименовать существующий сервис `seee1` в `backend`

1. **Откройте Railway Dashboard**
   - https://railway.app
   - Выберите проект `sunny-expression`

2. **Откройте существующий сервис `seee1`**
   - Нажмите на сервис в левой панели

3. **Переименуйте сервис:**
   - Нажмите вкладку **"Settings"**
   - Найдите поле **"Service Name"** или **"Name"**
   - Измените `seee1` на `backend`
   - Нажмите **"Save"** или **"Update"**

4. **Проверьте Root Directory:**
   - В тех же настройках найдите **"Root Directory"** или **"Source"**
   - Должно быть указано: `back`
   - Если пусто или указано что-то другое - установите: `back`
   - Сохраните

### Вариант B: Создать новый Backend сервис (если хотите оставить `seee1` как есть)

1. **В проекте нажмите кнопку "New"**
   - В левой панели проекта найдите кнопку **"New"** или **"+"**

2. **Выберите "Service" или "GitHub Repo"**
   - Нажмите **"Service"** → **"GitHub Repo"**
   - Или просто **"GitHub Repo"**

3. **Выберите репозиторий:**
   - В списке репозиториев найдите `madebymoloday-sudo/seee1`
   - Нажмите на него

4. **Настройте сервис:**
   - Railway откроет окно настроек
   - **Service Name**: введите `backend`
   - **Root Directory**: введите `back` ⚠️ **ОЧЕНЬ ВАЖНО!**
   - **Build Command**: оставьте пустым
   - **Start Command**: оставьте пустым
   - Нажмите **"Deploy"** или **"Save"**

5. **Дождитесь деплоя:**
   - Railway начнет сборку и деплой
   - Дождитесь зеленого индикатора "Deployment successful"
   - Это может занять 3-5 минут

---

## 📋 ШАГ 2: Создание Frontend сервиса

1. **В проекте нажмите кнопку "New"**
   - В левой панели проекта найдите кнопку **"New"** или **"+"**

2. **Выберите "Service" или "GitHub Repo"**
   - Нажмите **"Service"** → **"GitHub Repo"**
   - Или просто **"GitHub Repo"**

3. **Выберите репозиторий:**
   - В списке репозиториев найдите `madebymoloday-sudo/seee1`
   - Нажмите на него

4. **Настройте сервис:**
   - Railway откроет окно настроек
   - **Service Name**: введите `frontend`
   - **Root Directory**: введите `front` ⚠️ **КРИТИЧЕСКИ ВАЖНО!**
   - **Build Command**: оставьте пустым
   - **Start Command**: оставьте пустым
   - Нажмите **"Deploy"** или **"Save"**

5. **Дождитесь деплоя:**
   - Railway начнет сборку и деплой
   - Дождитесь зеленого индикатора "Deployment successful"
   - Это может занять 5-10 минут (Frontend собирается дольше)

---

## 📋 ШАГ 3: Добавление PostgreSQL базы данных

1. **В проекте нажмите кнопку "New"**
   - В левой панели проекта

2. **Выберите "Database"**
   - Нажмите **"Database"** → **"Add PostgreSQL"**
   - Или **"New"** → **"Database"** → **"PostgreSQL"**

3. **Дождитесь создания:**
   - Railway автоматически создаст базу данных
   - Это займет 1-2 минуты

---

## 📋 ШАГ 4: Настройка переменных окружения Backend

1. **Откройте Backend сервис**
   - Нажмите на сервис `backend` в левой панели

2. **Перейдите во вкладку "Variables"**
   - В верхней части страницы нажмите вкладку **"Variables"**

3. **Добавьте переменные:**
   - Нажмите кнопку **"New Variable"** или **"Add Variable"**
   - Добавляйте по одной переменной:

   ```
   NODE_ENV = production
   ```

   ```
   PORT = 3000
   ```

   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```
   *(Railway автоматически подставит значение из PostgreSQL сервиса)*

   ```
   JWT_SECRET = [сгенерируйте случайную строку]
   ```
   *Для генерации: откройте терминал и выполните `openssl rand -base64 32`*

   ```
   JWT_EXPIRES_IN = 15m
   ```

   ```
   JWT_REFRESH_SECRET = [сгенерируйте другую случайную строку]
   ```

   ```
   JWT_REFRESH_EXPIRES_IN = 7d
   ```

   ```
   FRONTEND_URL = ${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
   ```
   *(Railway автоматически подставит URL Frontend после его создания)*

   ```
   OPENAI_API_KEY = [ваш OpenAI API ключ]
   ```

---

## 📋 ШАГ 5: Настройка переменных окружения Frontend

1. **Откройте Frontend сервис**
   - Нажмите на сервис `frontend` в левой панели

2. **Перейдите во вкладку "Variables"**
   - В верхней части страницы нажмите вкладку **"Variables"**

3. **Добавьте переменные:**
   - Нажмите кнопку **"New Variable"** или **"Add Variable"**

   ```
   API_URL = ${{Backend.RAILWAY_PUBLIC_DOMAIN}}
   ```
   *(Railway автоматически подставит URL Backend сервиса)*

   ```
   VITE_API_URL = ${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
   ```

   ```
   VITE_SOCKET_URL = ${{Backend.RAILWAY_PUBLIC_DOMAIN}}
   ```

---

## 📋 ШАГ 6: Получение ссылки на сайт

1. **Откройте Frontend сервис**
   - Нажмите на сервис `frontend` в левой панели

2. **Перейдите в Settings → Networking**
   - Нажмите вкладку **"Settings"**
   - Прокрутите вниз до раздела **"Networking"**

3. **Сгенерируйте домен:**
   - Нажмите кнопку **"Generate Domain"**
   - Или включите переключатель **"Public"** в положение **"ON"**

4. **Скопируйте URL:**
   - Появится URL вида: `https://frontend-production-xxxxx.up.railway.app`
   - **Это и есть ссылка на ваш сайт!** 🎉

5. **Или добавьте кастомный домен:**
   - Если хотите использовать `seee.com`
   - В разделе Networking найдите **"Custom Domain"**
   - Введите `seee.com`
   - Railway автоматически настроит SSL сертификат (займет 5-10 минут)

---

## ✅ Чек-лист выполнения

- [ ] Backend сервис создан с Root Directory = `back`
- [ ] Frontend сервис создан с Root Directory = `front`
- [ ] PostgreSQL база данных добавлена
- [ ] Все переменные окружения Backend настроены
- [ ] Все переменные окружения Frontend настроены
- [ ] Оба сервиса показывают "Deployment successful"
- [ ] Frontend сервис имеет публичный домен
- [ ] Сайт открывается в браузере

---

## 🐛 Если что-то не работает

### Backend не запускается:
- Проверьте логи: Backend → Deployments → последний деплой → View Logs
- Убедитесь, что Root Directory = `back`
- Проверьте все переменные окружения

### Frontend не запускается:
- Проверьте логи: Frontend → Deployments → последний деплой → View Logs
- Убедитесь, что Root Directory = `front` (не `back`!)
- Проверьте переменные окружения

### Сайт показывает ошибку:
- Убедитесь, что домен привязан к **Frontend** сервису, а не к Backend
- Проверьте, что оба сервиса запущены (зеленые индикаторы)
- Подождите 5-10 минут после создания домена для настройки SSL

---

## 🎯 Краткая памятка

1. **New** → **Service** → **GitHub Repo** → выберите `seee1`
2. **Name**: `backend`, **Root Directory**: `back` → Deploy
3. **New** → **Service** → **GitHub Repo** → выберите `seee1`
4. **Name**: `frontend`, **Root Directory**: `front` → Deploy
5. **New** → **Database** → **PostgreSQL**
6. Настройте переменные окружения для обоих сервисов
7. Frontend → Settings → Networking → Generate Domain
8. Скопируйте URL - это ваш сайт!
