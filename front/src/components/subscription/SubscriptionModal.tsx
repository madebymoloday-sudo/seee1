import { X } from "lucide-react";
import { useSubscriptionControllerGetSubscription } from "@/api/seee.swr";
import { useNavigate } from "react-router-dom";
import styles from "./SubscriptionModal.module.css";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal = ({ isOpen, onClose }: SubscriptionModalProps) => {
  const navigate = useNavigate();
  const { data: subscription, isLoading } = useSubscriptionControllerGetSubscription();

  if (!isOpen) return null;

  const isActive =
    subscription &&
    subscription.status?.toUpperCase() === "ACTIVE" &&
    subscription.expiresAt &&
    new Date(subscription.expiresAt) > new Date();

  const expiresAt = subscription?.expiresAt
    ? new Date(subscription.expiresAt)
    : null;

  // Форматируем оставшееся время
  const getTimeRemaining = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
    } else if (hours > 0) {
      return `${hours} ${hours === 1 ? "час" : hours < 5 ? "часа" : "часов"}`;
    } else if (minutes > 0) {
      return `${minutes} ${minutes === 1 ? "минута" : minutes < 5 ? "минуты" : "минут"}`;
    } else {
      return "менее минуты";
    }
  };

  const timeRemaining = expiresAt ? getTimeRemaining(expiresAt) : null;

  const handlePurchase = () => {
    onClose();
    navigate("/subscription");
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Подписка</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : (
            <>
              {/* Статус подписки */}
              <div className={styles.statusSection}>
                <span className={styles.statusLabel}>Статус подписки:</span>
                <span
                  className={`${styles.statusValue} ${
                    isActive ? styles.statusActive : styles.statusInactive
                  }`}
                >
                  {isActive ? "Активирована" : "Неактивирована"}
                </span>
              </div>

              {/* Остаток времени */}
              {isActive && timeRemaining && (
                <div className={styles.timeRemaining}>
                  <span className={styles.timeLabel}>Осталось до конца подписки:</span>
                  <span className={styles.timeValue}>{timeRemaining}</span>
                </div>
              )}

              {/* Кнопка покупки */}
              <button onClick={handlePurchase} className={styles.purchaseButton}>
                Купить подписку
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
