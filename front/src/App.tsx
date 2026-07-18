import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import { useMobileUiScale } from "./hooks/useMobileUiScale";
import { useTheme } from "./hooks/useTheme";
import { useVisualViewportCssVars } from "./hooks/useVisualViewportCssVars";
import apiAgent from "./lib/api";
import {
  getTelegramAuthFromUrl,
  clearTelegramAuthFromUrl,
} from "./lib/telegramAuthFromUrl";
import { protectedRouter } from "./router/protectedRouter";
import { publicRouter } from "./router/publicRouter";
import { RootStoreContext, rootStore } from "./store/rootStore";

const AppContent = observer(() => {
  const { isAuthenticated, isLoading } = useAuth();
  // Инициализируем тему при загрузке
  useTheme();
  // Инициализируем мобильный масштаб интерфейса при загрузке
  useMobileUiScale();
  // Синхронизируем высоту приложения с visible viewport на iOS/mobile keyboards
  useVisualViewportCssVars();

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return (
      <div className="seee-loading-screen">
        <div className="seee-loading-sun" aria-hidden="true" />
        <div className="seee-loading-hill" aria-hidden="true" />
        <div className="seee-loading-content">
          <div className="seee-loading-mark">
            <span className="seee-loading-kicker">SEEE / THINKING SYSTEM</span>
            <div className="seee-loading-logo-wrap">
              <img
                src="/seee-logo-128.png"
                alt="Seee"
                className="seee-loading-logo"
                draggable={false}
              />
            </div>
          </div>
          <div className="seee-loading-copy">Сииикундочку!</div>
          <div className="seee-loading-line" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    );
  }

  // Рендерим соответствующий роутер в зависимости от авторизации
  // key нужен для полного пересоздания роутера при переключении
  return (
    <RouterProvider
      key={isAuthenticated ? "protected" : "public"}
      router={isAuthenticated ? protectedRouter : publicRouter}
    />
  );
});

function App() {
  // Обработка возврата из Telegram при редиректе в том же окне (мобильные / блокировка popup)
  useEffect(() => {
    if (localStorage.getItem("accessToken")) return;
    const payload = getTelegramAuthFromUrl();
    if (!payload) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await apiAgent.post<
          typeof payload,
          { accessToken: string; refreshToken: string }
        >("/auth/telegram/login", {
          id: payload.id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          username: payload.username,
          photo_url: payload.photo_url,
          auth_date: payload.auth_date,
          hash: payload.hash,
        });
        if (cancelled) return;
        localStorage.setItem("accessToken", response.accessToken);
        localStorage.setItem("refreshToken", response.refreshToken);
        clearTelegramAuthFromUrl();
        window.location.reload();
      } catch {
        if (!cancelled) clearTelegramAuthFromUrl();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Загружаем Telegram Login SDK (без data-атрибутов виджета в DOM,
    // чтобы не рендерить ошибку "Username invalid" при bot_id формате).
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector(
        'script[src="https://telegram.org/js/telegram-widget.js?22"]'
      );
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <RootStoreContext.Provider value={rootStore}>
      <AppContent />
      <Toaster />
    </RootStoreContext.Provider>
  );
}

export default App;
