# 1) Устанавливаем все deps (включая dev)
FROM node:20.12.2 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm i --force

# 2) Сборка + prisma generate
FROM node:20.12.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Нужны исходники и схема до generate
COPY . .
# Важно: схема должна лежать в ./prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

# 4) Прод-образ: только то, что нужно в рантайме
FROM node:20.12.2 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Устанавливаем curl для healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Копируем схему Prisma и seed для возможного применения миграций и seed
COPY --from=builder /app/prisma ./prisma
# Копируем tsconfig.json для работы ts-node
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Копируем программы психолога
COPY --from=builder /app/programs ./programs
# Создаем entrypoint скрипт для применения миграций и seed при старте
RUN cat > /app/docker-entrypoint.sh << 'EOF'
#!/bin/sh
set -e

echo "=== Starting application setup ==="

if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Step 1: Applying database migrations..."
  
  # Проверяем подключение к БД
  echo "Checking database connection..."
  if ! npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; then
    echo "WARNING: Could not verify database connection, but continuing..."
  fi
  
  if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations)" ]; then
    echo "Found migrations directory, running migrate deploy..."
    npx prisma migrate deploy || {
      echo "WARNING: migrate deploy failed, trying db push..."
      npx prisma db push --skip-generate --accept-data-loss || {
        echo "ERROR: Database migration failed!"
        exit 1
      }
    }
  else
    echo "No migrations directory found, using db push..."
    npx prisma db push --skip-generate --accept-data-loss || {
      echo "ERROR: Database push failed! Check DATABASE_URL connection."
      echo "DATABASE_URL format: postgresql://user:password@host:port/database"
      exit 1
    }
  fi
  
  echo "Step 2: Generating Prisma Client..."
  npx prisma generate || {
    echo "ERROR: Prisma generate failed!"
    exit 1
  }
  
  echo "Step 3: Database migrations completed successfully!"
  
  if [ "$SKIP_SEED" != "true" ]; then
    echo "Step 4: Running database seed..."
    npm run prisma:seed || echo "WARNING: Seed failed, continuing..."
  fi
else
  echo "Skipping migrations (SKIP_MIGRATIONS=true)"
fi

echo "=== Starting application ==="
exec npm run start:prod
EOF
RUN chmod +x /app/docker-entrypoint.sh
CMD ["/app/docker-entrypoint.sh"]

