# Force rebuild cache bust - change this value to force rebuild
ARG CACHE_BUST=2026-01-14-12-30
RUN echo "Cache bust: $CACHE_BUST"

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
# Копируем скрипты для миграций
COPY --from=builder /app/scripts ./scripts
# Копируем tsconfig.json для работы ts-node
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Копируем программы психолога
COPY --from=builder /app/programs ./programs
# Миграции теперь выполняются в PrismaService.onModuleInit
# Упрощаем: просто запускаем приложение
CMD ["npm", "run", "start:prod"]

