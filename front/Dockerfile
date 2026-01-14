# ============================================
# Stage 1: Build stage
# ============================================
FROM node:22.21.0-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем только файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm i

# Копируем исходный код
COPY . .

# Force rebuild cache bust (update to trigger)
ARG CACHE_BUST=2026-01-14T20-35-DEPLOY
RUN echo "CACHE_BUST(front)=$CACHE_BUST"

# Строим приложение с оптимизацией памяти для Node.js
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# ============================================
# Stage 2: Production stage
# ============================================
FROM nginx:1.27-alpine AS runner

# Копируем статический nginx.conf (без envsubst)
COPY nginx.conf.static /etc/nginx/conf.d/default.conf

# Проверяем конфигурацию nginx
RUN nginx -t

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Проверяем, что файлы скопировались
RUN ls -la /usr/share/nginx/html && \
    ls -la /usr/share/nginx/html/index.html || echo "WARNING: index.html not found!"

# Устанавливаем правильные права доступа
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# Открываем порт 8080
EXPOSE 8080

# Создаем простой тестовый скрипт для диагностики
RUN echo '#!/bin/sh' > /test-nginx.sh && \
    echo 'echo "Testing nginx..."' >> /test-nginx.sh && \
    echo 'nginx -t' >> /test-nginx.sh && \
    echo 'echo "Listing files in /usr/share/nginx/html:"' >> /test-nginx.sh && \
    echo 'ls -la /usr/share/nginx/html' >> /test-nginx.sh && \
    echo 'echo "Starting nginx..."' >> /test-nginx.sh && \
    echo 'exec nginx -g "daemon off;"' >> /test-nginx.sh && \
    chmod +x /test-nginx.sh

# Запускаем nginx через тестовый скрипт
CMD ["/test-nginx.sh"]