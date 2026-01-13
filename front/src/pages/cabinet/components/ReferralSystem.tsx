import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import styles from "./ReferralSystem.module.css";

interface ReferralData {
  userId: string;
  balance: number;
  promoCode: string;
  referralLink: string;
}

const ReferralSystem = () => {
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        // TODO: Заменить на реальный API endpoint когда будет готов
        // const response = await apiAgent.get<ReferralData>("/referral");
        // setReferralData(response);

        // Временные данные для демонстрации
        setReferralData({
          userId: user?.id || "unknown",
          balance: 0,
          promoCode: `PROMO${user?.id?.substring(0, 8).toUpperCase() || "XXXX"}`,
          referralLink: `${window.location.origin}/register?ref=${user?.id || "unknown"}&utm_source=referral`,
        });
      } catch (error) {
        console.error("Ошибка загрузки реферальных данных:", error);
        toast.error("Не удалось загрузить данные реферальной системы");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferralData();
  }, [user]);

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success("Скопировано в буфер обмена");
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error("Не удалось скопировать");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          Загрузка...
        </CardContent>
      </Card>
    );
  }

  if (!referralData) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          Данные реферальной системы недоступны
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Реферальная система</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ID пользователя */}
        <div className={styles.field}>
          <label className={styles.label}>ID аккаунта</label>
          <div className={styles.valueWrapper}>
            <span className={styles.value}>{referralData.userId}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(referralData.userId, "userId")}
              className={styles.copyButton}
            >
              {copied === "userId" ? (
                <Check className={styles.icon} />
              ) : (
                <Copy className={styles.icon} />
              )}
            </Button>
          </div>
        </div>

        {/* Баланс */}
        <div className={styles.field}>
          <label className={styles.label}>Баланс на счёте</label>
          <div className={styles.valueWrapper}>
            <span className={styles.value}>{referralData.balance} ₽</span>
          </div>
        </div>

        {/* Промокод */}
        <div className={styles.field}>
          <label className={styles.label}>Промокод</label>
          <div className={styles.valueWrapper}>
            <span className={styles.value}>{referralData.promoCode}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(referralData.promoCode, "promoCode")}
              className={styles.copyButton}
            >
              {copied === "promoCode" ? (
                <Check className={styles.icon} />
              ) : (
                <Copy className={styles.icon} />
              )}
            </Button>
          </div>
        </div>

        {/* Реферальная ссылка */}
        <div className={styles.field}>
          <label className={styles.label}>Реферальная ссылка</label>
          <div className={styles.valueWrapper}>
            <span className={styles.valueLink}>{referralData.referralLink}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(referralData.referralLink, "referralLink")}
              className={styles.copyButton}
            >
              {copied === "referralLink" ? (
                <Check className={styles.icon} />
              ) : (
                <Copy className={styles.icon} />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralSystem;
