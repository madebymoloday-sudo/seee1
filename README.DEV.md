# Development режим с Docker

Этот файл описывает работу с проектом в development режиме с использованием Docker Compose.

## Быстрый старт

```bash
# Запуск всех сервисов в dev режиме
docker-compose -f docker-compose.dev.yml up -d

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f

# Остановка
docker-compose -f docker-compose.dev.yml down
```

## Особенности dev режима

### Hot Reload
- **Backend**: Использует `npm run start:dev` с watch режимом NestJS
- **Frontend**: Использует Vite dev server с HMR (Hot Module Replacement)
- Все изменения в исходниках автоматически применяются без перезапуска контейнеров

### Volume Mounts
Исходники монтируются как volumes, что позволяет:
- Редактировать код на хосте
- Видеть изменения сразу в контейнерах
- Не пересобирать образы при изменении кода

### Порты
- **Frontend**: `http://localhost:5171` (Vite dev server)
- **Backend**: `http://localhost:3000` (NestJS)
- **PostgreSQL**: `localhost:5432`

## Команды

### Запуск
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Просмотр логов
```bash
# Все сервисы
docker-compose -f docker-compose.dev.yml logs -f

# Только backend
docker-compose -f docker-compose.dev.yml logs -f backend

# Только frontend
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### Остановка
```bash
docker-compose -f docker-compose.dev.yml down
```

### Пересборка после изменения зависимостей
```bash
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up -d
```

### Применение миграций Prisma
```bash
# Вручную (если нужно)
docker-compose -f docker-compose.dev.yml exec backend npx prisma db push
docker-compose -f docker-compose.dev.yml exec backend npm run prisma:seed
```

## Переменные окружения

Создайте файл `.env` в корне проекта (опционально):

```env
# Database
POSTGRES_USER=seee_user
POSTGRES_PASSWORD=seee_password
POSTGRES_DB=seee_db

# JWT (для dev можно использовать простые ключи)
JWT_SECRET=dev-secret-key
JWT_REFRESH_SECRET=dev-refresh-secret-key

# API Keys (опционально для dev)
OPENAI_API_KEY=your-key
LAVA_API_KEY=your-key
LAVA_API_URL=https://gate.lava.top

# Ports
BACKEND_PORT=3000
FRONTEND_PORT=5171
POSTGRES_PORT=5432
```

## Отличия от production

1. **Hot Reload**: Изменения применяются автоматически
2. **Volume Mounts**: Исходники монтируются из хоста
3. **Dev зависимости**: Установлены все dev-зависимости
4. **Отдельная БД**: Используется `postgres_data_dev` volume
5. **Более длительный start_period**: Для healthcheck (60s для backend)

## Troubleshooting

### Изменения не применяются
- Убедитесь, что volumes правильно смонтированы
- Проверьте логи: `docker-compose -f docker-compose.dev.yml logs -f`

### Ошибки при запуске
- Проверьте, что порты не заняты другими процессами
- Убедитесь, что все зависимости установлены в контейнерах

### Проблемы с Prisma
- Применение миграций происходит автоматически при первом запуске
- Если нужно применить вручную: `docker-compose -f docker-compose.dev.yml exec backend npx prisma db push`

