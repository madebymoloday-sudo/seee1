import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import { useMobileUiScale } from "./hooks/useMobileUiScale";
import { useTheme } from "./hooks/useTheme";
import { protectedRouter } from "./router/protectedRouter";
import { publicRouter } from "./router/publicRouter";
import { RootStoreContext, rootStore } from "./store/rootStore";

const AppContent = observer(() => {
  const { isAuthenticated, isLoading } = useAuth();
  // Инициализируем тему при загрузке
  useTheme();
  // Инициализируем мобильный масштаб интерфейса при загрузке
  useMobileUiScale();

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Загрузка...</div>
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
  useEffect(() => {
    // Загружаем Telegram Login SDK (без data-атрибутов виджета в DOM,
    // чтобы не рендерить ошибку "Username invalid" при bot_id формате).
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Удаляем скрипт при размонтировании
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
