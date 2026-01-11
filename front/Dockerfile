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

# Устанавливаем переменные по умолчанию
ARG API_URL=http://localhost:3000
ENV API_URL=$API_URL

# Копируем шаблон конфигурации nginx
COPY nginx.conf.template /tmp/nginx.conf.template

# Создаем скрипт для запуска с динамическими переменными
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'set -e' >> /docker-entrypoint.sh && \
    echo 'echo "=== Starting nginx entrypoint ==="' >> /docker-entrypoint.sh && \
    echo 'if [ -z "$API_URL" ]; then' >> /docker-entrypoint.sh && \
    echo '  echo "WARNING: API_URL not set, using default http://localhost:3000"' >> /docker-entrypoint.sh && \
    echo '  export API_URL="http://localhost:3000"' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo 'echo "API_URL=$API_URL"' >> /docker-entrypoint.sh && \
    echo 'envsubst '\''${API_URL}'\'' < /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'echo "Nginx configuration generated"' >> /docker-entrypoint.sh && \
    echo 'nginx -t && echo "Nginx configuration test: OK"' >> /docker-entrypoint.sh || echo 'Nginx configuration test: FAILED' >> /docker-entrypoint.sh && \
    echo 'echo "Starting nginx..."' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запускаем nginx
CMD ["/docker-entrypoint.sh"]

