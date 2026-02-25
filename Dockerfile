# Сборка бэкенда из корня репо (когда Root Directory не задан или задан корень).
# Контекст: корень репо. Копируем только back/ и собираем как back/Dockerfile.

FROM node:20.12.2 AS deps
ARG CACHE_BUST=2026-02-26
RUN echo "Cache bust: $CACHE_BUST"
WORKDIR /app
COPY back/package*.json ./
COPY back/prisma ./prisma
RUN npm i --force

FROM node:20.12.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY back/ .
RUN npx prisma generate
RUN npm run build

FROM node:20.12.2 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/programs ./programs
CMD ["npm", "run", "start:prod"]
