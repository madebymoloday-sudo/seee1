import { observer } from "mobx-react-lite";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export const SubscriptionRoute = observer(() => {
  const {
    isAuthenticated,
    isLoading,
    hasActiveSubscription,
    subscriptionCheckLoading,
  } = useAuth();
  const location = useLocation();

  // Показываем загрузку только если действительно идет загрузка
  if (isLoading || subscriptionCheckLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Если есть активная подписка, разрешаем доступ
  if (hasActiveSubscription) {
    return <Outlet />;
  }

  // Если нет подписки и мы не на странице подписки, редиректим
  if (location.pathname !== "/subscription" && location.pathname !== "/") {
    return <Navigate to="/subscription" replace />;
  }

  // Если мы на главной странице без подписки, редиректим на страницу подписки
  if (location.pathname === "/") {
    return <Navigate to="/subscription" replace />;
  }

  // Если мы уже на странице подписки, показываем её
  return <Outlet />;
});
