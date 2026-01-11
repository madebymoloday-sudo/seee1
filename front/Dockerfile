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

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запускаем nginx напрямую с выводом в stdout для логирования
CMD ["nginx", "-g", "daemon off;", "-c", "/etc/nginx/nginx.conf"]
