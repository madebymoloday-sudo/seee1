import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptionControllerGetSubscription } from "@/api/seee.swr";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, RefreshCw } from "lucide-react";

const SubscriptionSection = observer(() => {
  const { data: subscription, isLoading, error } =
    useSubscriptionControllerGetSubscription();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Загрузка информации о подписке...
        </CardContent>
      </Card>
    );
  }

  if (error || !subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Подписка</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              У вас нет активной подписки
            </p>
            <Badge variant="secondary" className="text-sm">
              Неактивна
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const planNames: Record<string, string> = {
    MONTHLY: "Месячная",
    QUARTERLY: "Квартальная",
    YEARLY: "Годовая",
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: "Активна",
    EXPIRED: "Истекла",
    CANCELLED: "Отменена",
    PENDING: "Ожидает оплаты",
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive"> =
    {
      ACTIVE: "default",
      EXPIRED: "destructive",
      CANCELLED: "secondary",
      PENDING: "secondary",
    };

  const isActive =
    subscription.status?.toUpperCase() === "ACTIVE" &&
    subscription.expiresAt &&
    new Date(subscription.expiresAt) > new Date();

  const expiresAt = subscription.expiresAt
    ? new Date(subscription.expiresAt)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Подписка
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            План
          </label>
          <p className="text-lg font-semibold">
            {planNames[subscription.plan?.toUpperCase() || ""] ||
              subscription.plan ||
              "Не указан"}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Статус
          </label>
          <div className="mt-1">
            <Badge
              variant={
                statusColors[
                  subscription.status?.toUpperCase() || "PENDING"
                ] || "secondary"
              }
              className="text-sm"
            >
              {statusLabels[subscription.status?.toUpperCase() || ""] ||
                subscription.status ||
                "Неизвестен"}
            </Badge>
          </div>
        </div>

        {expiresAt && (
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isActive ? "Истекает" : "Истекла"}
            </label>
            <p className="text-lg">
              {expiresAt.toLocaleDateString("ru-RU", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            {isActive && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil(
                  (expiresAt.getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{" "}
                дней осталось
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Автопродление
          </label>
          <p className="text-lg">
            {subscription.autoRenew ? "Включено" : "Выключено"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
});

export default SubscriptionSection;

