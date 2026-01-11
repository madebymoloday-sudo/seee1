#!/bin/bash

# Скрипт для деплоя на Railway
# Использование: ./deploy-railway.sh

set -e

echo "🚂 Деплой SEEE на Railway"
echo "=========================="
echo ""

# Проверка авторизации
if ! railway whoami &>/dev/null; then
    echo "❌ Вы не авторизованы в Railway"
    echo "📝 Выполните: railway login"
    echo "   Это откроет браузер для авторизации"
    exit 1
fi

echo "✅ Авторизация в Railway подтверждена"
echo ""

# Переход в корневую директорию
cd "$(dirname "$0")"

# Проверка, что мы в правильной директории
if [ ! -d "back" ] || [ ! -d "front" ]; then
    echo "❌ Ошибка: не найдены директории back/ или front/"
    exit 1
fi

echo "📦 Инициализация проекта Railway..."
railway init --name seee || echo "Проект уже инициализирован"

echo ""
echo "🗄️  Добавление PostgreSQL базы данных..."
railway add postgresql || echo "База данных уже добавлена"

echo ""
echo "🔧 Настройка Backend сервиса..."
cd back

# Создание сервиса backend если его нет
railway service create backend 2>/dev/null || echo "Сервис backend уже существует"

# Установка переменных окружения для backend
echo "📝 Настройка переменных окружения для Backend..."
railway variables set NODE_ENV=production
railway variables set PORT=3000

# Получение DATABASE_URL из PostgreSQL сервиса
DATABASE_URL=$(railway variables get DATABASE_URL --service postgresql 2>/dev/null || echo "")
if [ -n "$DATABASE_URL" ]; then
    railway variables set DATABASE_URL="$DATABASE_URL"
fi

echo "⚠️  Не забудьте установить следующие переменные вручную через Railway Dashboard:"
echo "   - JWT_SECRET (сгенерируйте случайную строку)"
echo "   - JWT_REFRESH_SECRET (сгенерируйте случайную строку)"
echo "   - OPENAI_API_KEY (ваш API ключ OpenAI)"
echo "   - LAVA_API_KEY (ваш API ключ Lava)"
echo "   - FRONTEND_URL (будет установлен автоматически после деплоя Frontend)"

echo ""
echo "🚀 Деплой Backend..."
railway up --service backend

cd ..

echo ""
echo "🎨 Настройка Frontend сервиса..."
cd front

# Создание сервиса frontend если его нет
railway service create frontend 2>/dev/null || echo "Сервис frontend уже существует"

# Получение Backend URL
BACKEND_URL=$(railway domain --service backend 2>/dev/null || echo "")
if [ -n "$BACKEND_URL" ]; then
    echo "📝 Настройка переменных окружения для Frontend..."
    railway variables set API_URL="https://$BACKEND_URL"
    railway variables set VITE_API_URL="https://$BACKEND_URL/api/v1"
    railway variables set VITE_SOCKET_URL="https://$BACKEND_URL"
else
    echo "⚠️  Backend URL еще не доступен. Установите переменные вручную после деплоя:"
    echo "   - API_URL=https://your-backend-url.railway.app"
    echo "   - VITE_API_URL=https://your-backend-url.railway.app/api/v1"
    echo "   - VITE_SOCKET_URL=https://your-backend-url.railway.app"
fi

echo ""
echo "🚀 Деплой Frontend..."
railway up --service frontend

cd ..

echo ""
echo "✅ Деплой завершен!"
echo ""
echo "🔗 Получение URL..."
FRONTEND_URL=$(railway domain --service frontend 2>/dev/null || echo "")
BACKEND_URL=$(railway domain --service backend 2>/dev/null || echo "")

if [ -n "$FRONTEND_URL" ]; then
    echo "🌐 Frontend URL: https://$FRONTEND_URL"
else
    echo "⚠️  Frontend URL еще не сгенерирован. Сгенерируйте его в Railway Dashboard:"
    echo "   Settings → Networking → Generate Domain"
fi

if [ -n "$BACKEND_URL" ]; then
    echo "🔧 Backend URL: https://$BACKEND_URL"
fi

echo ""
echo "📋 Следующие шаги:"
echo "   1. Откройте Railway Dashboard: https://railway.app"
echo "   2. Установите недостающие переменные окружения"
echo "   3. Проверьте логи деплоя"
echo "   4. Откройте Frontend URL в браузере"
