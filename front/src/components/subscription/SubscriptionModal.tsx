import { X, Check, CreditCard, Sparkles } from "lucide-react";
import { useSubscriptionControllerGetSubscription } from "@/api/seee.swr";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiAgent from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import styles from "./SubscriptionModal.module.css";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal = ({ isOpen, onClose }: SubscriptionModalProps) => {
  const { checkSubscription } = useAuth();
  const { isLoading } = useSubscriptionControllerGetSubscription();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

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
        onClose();
        // Обновляем страницу, чтобы показать новую подписку
        window.location.reload();
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className={styles.header}>
          <h2 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles className="h-6 w-6" />
            Выберите подписку
          </h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.content} style={{ padding: '24px' }}>
          {isLoading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : (
            <>
              <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666' }}>
                Для использования сервиса необходима активная подписка
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    style={{
                      position: 'relative',
                      ...(plan.recommended ? { border: '2px solid #3b82f6', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' } : {})
                    }}
                  >
                    {plan.recommended && (
                      <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)' }}>
                        <span style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                          Рекомендуется
                        </span>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle style={{ fontSize: '20px' }}>{plan.name}</CardTitle>
                      <CardDescription>
                        <div style={{ marginTop: '16px' }}>
                          <span style={{ fontSize: '32px', fontWeight: 'bold' }}>{plan.price} ₽</span>
                          <span style={{ color: '#666' }}> / {plan.period}</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {plan.features.map((feature, index) => (
                          <li key={index} style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                            <Check className="h-5 w-5" style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '14px' }}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        style={{ width: '100%' }}
                        variant={plan.recommended ? "default" : "outline"}
                        onClick={() => handlePurchase(plan.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          "Обработка..."
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" style={{ marginRight: '8px' }} />
                            Оформить подписку
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Виджет Lava.top */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <iframe
                  title="lava.top"
                  style={{ border: 'none' }}
                  width="350"
                  height="60"
                  src="https://widget.lava.top/c7af956a-6721-443b-b940-ab161161afa7"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
