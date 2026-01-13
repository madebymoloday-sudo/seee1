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
RUN echo '#!/bin/sh\n\
set -e\n\
if [ "$SKIP_MIGRATIONS" != "true" ]; then\n\
  echo "Applying database migrations..."\n\
  if [ -d "/app/prisma/migrations" ]; then\n\
    echo "Found migrations directory, running migrate deploy..."\n\
    npx prisma migrate deploy || { echo "migrate deploy failed, trying db push..."; npx prisma db push --skip-generate; }\n\
  else\n\
    echo "No migrations directory found, using db push..."\n\
    npx prisma db push --skip-generate --accept-data-loss\n\
  fi\n\
  echo "Generating Prisma Client..."\n\
  npx prisma generate\n\
  if [ "$SKIP_SEED" != "true" ]; then\n\
    echo "Running database seed..."\n\
    npm run prisma:seed || echo "Seed failed, continuing..."\n\
  fi\n\
fi\n\
echo "Starting application..."\n\
exec npm run start:prod' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
CMD ["/app/docker-entrypoint.sh"]

