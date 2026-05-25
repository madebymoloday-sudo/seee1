import { observer } from "mobx-react-lite";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSubscriptionActive } from "@/lib/subscription";

export const ProtectedRoute = observer(() => {
  const subscriptionGateEnabled =
    String(import.meta.env.VITE_REQUIRE_SUBSCRIPTION || "").toLowerCase() ===
    "true";
  const {
    isAuthenticated,
    isLoading,
    user,
  } = useAuth();
  const location = useLocation();

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

  const isSubscriptionPage = location.pathname === "/subscription";
  const hasActiveSubscription = isSubscriptionActive(user);

  if (subscriptionGateEnabled && !hasActiveSubscription && !isSubscriptionPage) {
    return <Navigate to="/subscription" replace />;
  }

  if (subscriptionGateEnabled && hasActiveSubscription && isSubscriptionPage) {
    return <Navigate to="/sessions/list" replace />;
  }

  // Авторизован — разрешаем доступ ко всем страницам
  return <Outlet />;
});
