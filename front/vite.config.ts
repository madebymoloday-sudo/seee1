import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// Определяем target для proxy (для работы в Docker используем имя сервиса)
const proxyTarget = process.env.VITE_PROXY_TARGET || "http://localhost:3000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5171,
    host: true, // Позволяет доступ извне контейнера
    proxy: {
      "/api/v1": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
        // Не убираем префикс - бэкенд ожидает полный путь /api/v1/auth/login
      },
      "/api-json": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/api/docs": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: proxyTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
