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
    return <Navigate to="/" replace />;
  }

  // Если есть активная подписка, разрешаем доступ
  if (hasActiveSubscription) {
    return <Outlet />;
  }

  // Если нет подписки, разрешаем доступ только к кабинету
  // Пользователь сможет купить подписку через модальное окно в кабинете
  if (location.pathname === "/cabinet") {
    return <Outlet />;
  }

  // Для всех остальных страниц без подписки редиректим в кабинет
  if (location.pathname !== "/cabinet") {
    return <Navigate to="/cabinet" replace />;
  }

  return <Outlet />;
});
