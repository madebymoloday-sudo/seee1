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

echo "=========================================="
echo "=== Starting application setup ==="
echo "=========================================="

if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo ""
  echo "Step 1: Checking Prisma schema..."
  if [ ! -f "/app/prisma/schema.prisma" ]; then
    echo "ERROR: Prisma schema not found at /app/prisma/schema.prisma"
    exit 1
  fi
  echo "✓ Prisma schema found"
  
  echo ""
  echo "Step 2: Checking DATABASE_URL..."
  if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set!"
    exit 1
  fi
  echo "✓ DATABASE_URL is set"
  
  echo ""
  echo "Step 3: Applying database schema..."
  if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations 2>/dev/null)" ]; then
    echo "Found migrations directory, running migrate deploy..."
    npx prisma migrate deploy 2>&1 || {
      echo "WARNING: migrate deploy failed, trying db push..."
      npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
        echo "ERROR: Database migration failed!"
        echo "Please check DATABASE_URL connection string"
        exit 1
      }
    }
  else
    echo "No migrations directory found, using db push..."
    npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
      echo "ERROR: Database push failed!"
      echo "DATABASE_URL format should be: postgresql://user:password@host:port/database"
      exit 1
    }
  fi
  echo "✓ Database schema applied successfully"
  
  echo ""
  echo "Step 4: Generating Prisma Client..."
  npx prisma generate 2>&1 || {
    echo "ERROR: Prisma generate failed!"
    exit 1
  }
  echo "✓ Prisma Client generated"
  
  echo ""
  echo "Step 5: Database setup completed successfully!"
  
  if [ "$SKIP_SEED" != "true" ]; then
    echo ""
    echo "Step 6: Running database seed..."
    npm run prisma:seed 2>&1 || echo "WARNING: Seed failed, continuing..."
  fi
else
  echo "Skipping migrations (SKIP_MIGRATIONS=true)"
fi

echo ""
echo "=========================================="
echo "=== Starting application ==="
echo "=========================================="

# Применяем миграции перед запуском (если не пропущены)
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo ""
  echo "=== Applying database migrations (from entrypoint) ==="
  if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations 2>/dev/null)" ]; then
    echo "Found migrations, running migrate deploy..."
    npx prisma migrate deploy 2>&1 || {
      echo "migrate deploy failed, trying db push..."
      npx prisma db push --skip-generate --accept-data-loss 2>&1
    }
  else
    echo "No migrations found, running db push..."
    npx prisma db push --skip-generate --accept-data-loss 2>&1
  fi
  echo "✓ Migrations completed"
  echo ""
fi

exec npm run start:prod
EOF
RUN chmod +x /app/docker-entrypoint.sh
CMD ["/app/docker-entrypoint.sh"]

