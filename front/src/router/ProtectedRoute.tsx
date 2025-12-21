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

  // Если не авторизован, редиректим на логин
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Если мы на странице подписки, разрешаем доступ (даже без активной подписки)
  if (location.pathname === "/subscription") {
    return <Outlet />;
  }

  // Если нет активной подписки, редиректим на страницу подписки
  if (!hasActiveSubscription) {
    return <Navigate to="/subscription" replace />;
  }

  // Если есть активная подписка, разрешаем доступ ко всем страницам
  return <Outlet />;
});
