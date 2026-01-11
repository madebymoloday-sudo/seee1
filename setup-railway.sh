#!/bin/bash

# Скрипт для настройки Railway проекта через API
# Использование: ./setup-railway.sh

set -e

RAILWAY_TOKEN="6ecf44cc-693b-413d-a4a3-3761595c9dbc"
PROJECT_NAME="seee"

echo "🚂 Настройка Railway проекта через API"
echo "========================================"
echo ""

# Проверка наличия curl
if ! command -v curl &> /dev/null; then
    echo "❌ curl не установлен. Установите curl для продолжения."
    exit 1
fi

echo "📦 Создание проекта на Railway..."
PROJECT_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$PROJECT_NAME\"}" \
  https://api.railway.app/v1/projects)

PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
    echo "⚠️  Не удалось создать проект через API. Возможно, проект уже существует."
    echo "📝 Пожалуйста, создайте проект вручную через Railway Dashboard:"
    echo "   1. Откройте https://railway.app"
    echo "   2. Нажмите 'New Project'"
    echo "   3. Выберите 'Deploy from GitHub repo'"
    echo "   4. Выберите репозиторий 'madebymoloday-sudo/seee1'"
    exit 1
fi

echo "✅ Проект создан! ID: $PROJECT_ID"
echo ""

echo "📝 Следующие шаги:"
echo "   1. Добавьте токен в GitHub Secrets:"
echo "      - Откройте: https://github.com/madebymoloday-sudo/seee1/settings/secrets/actions"
echo "      - Нажмите 'New repository secret'"
echo "      - Name: RAILWAY_TOKEN"
echo "      - Value: $RAILWAY_TOKEN"
echo ""
echo "   2. Настройте сервисы в Railway Dashboard:"
echo "      - Откройте: https://railway.app/project/$PROJECT_ID"
echo "      - Добавьте PostgreSQL базу данных"
echo "      - Создайте Backend сервис (Root Directory: back)"
echo "      - Создайте Frontend сервис (Root Directory: front)"
echo ""
echo "   3. Установите переменные окружения (см. SETUP_RAILWAY_TOKEN.md)"
echo ""
echo "   4. После настройки, каждый push в main будет автоматически деплоить изменения"
