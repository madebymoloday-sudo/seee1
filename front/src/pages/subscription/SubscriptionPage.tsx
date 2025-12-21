import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import apiAgent from "@/lib/api";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SubscriptionPage = observer(() => {
  const navigate = useNavigate();
  const { checkSubscription } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async (planId: string) => {
    setIsProcessing(true);

    try {
      // Создаем платеж через Lava API
      const response = await apiAgent.post<
        { planId: string; paymentMethod: string },
        { subscription: unknown; paymentUrl: string | null; sessionId: string | null }
      >("/subscription/purchase", {
        planId,
        paymentMethod: "lava",
      });

      // Если есть paymentUrl, перенаправляем на страницу оплаты Lava
      if (response.paymentUrl) {
        window.location.href = response.paymentUrl;
      } else {
        // Если платеж был обработан сразу (например, с баланса)
        await checkSubscription();
        navigate("/");
      }
    } catch (error: any) {
      console.error("Ошибка покупки подписки:", error);
      alert(
        error.response?.data?.message ||
          "Произошла ошибка при оформлении подписки. Попробуйте позже."
      );
      setIsProcessing(false);
    }
  };

  const plans = [
    {
      id: "monthly",
      name: "Месячная",
      price: 990,
      period: "месяц",
      features: [
        "Неограниченное количество сессий",
        "Полный анализ нейрокарты",
        "Доступ к журналу",
        "Email поддержка",
      ],
    },
    {
      id: "quarterly",
      name: "Квартальная",
      price: 2490,
      period: "3 месяца",
      recommended: true,
      features: [
        "Все из месячной подписки",
        "Экономия 17%",
        "Приоритетная поддержка",
        "Доступ к продвинутым функциям",
      ],
    },
    {
      id: "yearly",
      name: "Годовая",
      price: 8990,
      period: "год",
      features: [
        "Все из квартальной подписки",
        "Экономия 24%",
        "Персональный менеджер",
        "Экспорт данных",
        "Премиум поддержка",
      ],
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-2">
            <Sparkles className="h-10 w-10 text-primary" />
            Выберите подписку
          </h1>
          <p className="text-muted-foreground text-lg">
            Для использования сервиса необходима активная подписка
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                plan.recommended ? "border-primary shadow-lg scale-105" : ""
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                    Рекомендуется
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price} ₽</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {plan.period}
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.recommended ? "default" : "outline"}
                  onClick={() => handlePurchase(plan.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    "Обработка..."
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Оформить подписку
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            💡 После оформления подписки вы получите полный доступ к сервису
          </p>
        </div>
      </div>
    </Layout>
  );
});

export default SubscriptionPage;
