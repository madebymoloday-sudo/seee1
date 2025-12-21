import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const SubscriptionSuccessPage = observer(() => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkSubscription } = useAuth();
  const sessionId = searchParams.get("sessionId");

  useEffect(() => {
    // Обновляем статус подписки после успешной оплаты
    checkSubscription();
  }, [checkSubscription]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-20 w-20 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Оплата успешна!</h1>
          <p className="text-muted-foreground mb-6">
            Ваша подписка активирована. Теперь у вас есть доступ ко всем
            функциям SEEE.
          </p>
          {sessionId && (
            <p className="text-sm text-muted-foreground mb-6">
              ID транзакции: {sessionId}
            </p>
          )}
          <Button onClick={() => navigate("/")} className="w-full">
            Начать работу
          </Button>
        </div>
      </div>
    </Layout>
  );
});

export default SubscriptionSuccessPage;

