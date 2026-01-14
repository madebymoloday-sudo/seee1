import { observer } from "mobx-react-lite";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export const ProtectedRoute = observer(() => {
  const {
    isAuthenticated,
    isLoading,
    hasActiveSubscription,
    subscriptionCheckLoading,
  } = useAuth();
  const location = useLocation();

  console.log("ProtectedRoute", {
    isAuthenticated,
    isLoading,
    hasActiveSubscription,
    subscriptionCheckLoading,
    location,
  });

  // Показываем загрузку пока проверяем авторизацию и подписку
  if (isLoading || subscriptionCheckLoading) {
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

  // Если мы в кабинете, разрешаем доступ (даже без активной подписки)
  // Пользователь сможет купить подписку через модальное окно
  if (location.pathname === "/cabinet") {
    return <Outlet />;
  }

  // Если нет активной подписки, редиректим в кабинет
  if (!hasActiveSubscription) {
    return <Navigate to="/cabinet" replace />;
  }

  // Если есть активная подписка, разрешаем доступ ко всем страницам
  return <Outlet />;
});
