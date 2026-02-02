import { observer } from "mobx-react-lite";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export const ProtectedRoute = observer(() => {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();
  const location = useLocation();

  console.log("ProtectedRoute", {
    isAuthenticated,
    isLoading,
    location,
  });

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Загрузка...</div>
      </div>
    );
  }

  // Если не авторизован, разрешаем доступ к сессиям
  if (!isAuthenticated) {
    // Разрешаем доступ к страницам сессий без авторизации
    if (location.pathname.startsWith("/sessions") || location.pathname === "/") {
      return <Outlet />;
    }
    // Для других страниц редиректим на главную
    return <Navigate to="/" replace />;
  }

  // Авторизован — разрешаем доступ ко всем страницам
  return <Outlet />;
});
