import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import { protectedRouter } from "./router/protectedRouter";
import { publicRouter } from "./router/publicRouter";
import { RootStoreContext, rootStore } from "./store/rootStore";

const AppContent = observer(() => {
  const { isAuthenticated, isLoading } = useAuth();

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
    // Загружаем Telegram Login Widget
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    const botId = import.meta.env.VITE_TELEGRAM_BOT_ID;
    if (botId) {
      script.setAttribute("data-telegram-login", botId);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-request-access", "write");
    }
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
