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

# Строим приложение с оптимизацией памяти для Node.js
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# ============================================
# Stage 2: Production stage
# ============================================
FROM nginx:1.27-alpine AS runner

# Копируем статический nginx.conf (без envsubst)
COPY nginx.conf.static /etc/nginx/conf.d/default.conf

# Проверяем конфигурацию nginx перед запуском
RUN nginx -t || (echo "ERROR: Nginx configuration test failed!" && cat /etc/nginx/conf.d/default.conf && exit 1)

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Создаем entrypoint скрипт для лучшей диагностики
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'echo "=== Starting nginx ==="' >> /docker-entrypoint.sh && \
    echo 'echo "Testing nginx configuration..."' >> /docker-entrypoint.sh && \
    echo 'nginx -t' >> /docker-entrypoint.sh && \
    echo 'if [ $? -ne 0 ]; then' >> /docker-entrypoint.sh && \
    echo '  echo "ERROR: Nginx configuration test FAILED!"' >> /docker-entrypoint.sh && \
    echo '  cat /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo '  exit 1' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo 'echo "Nginx configuration test: OK"' >> /docker-entrypoint.sh && \
    echo 'echo "Starting nginx server..."' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Запускаем nginx через entrypoint скрипт
CMD ["/docker-entrypoint.sh"]
