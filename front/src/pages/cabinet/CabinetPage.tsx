import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { User } from "lucide-react";
import { useAuthControllerGetMe } from "@/api/seee.swr";
import ProfileSection from "./components/ProfileSection";
import SecuritySettings from "./components/SecuritySettings";
import ReferralSystem from "./components/ReferralSystem";
import MyFeedback from "./components/MyFeedback";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import FeedbackModal from "../sessions/components/FeedbackModal";
import { useAuth } from "@/hooks/useAuth";
import apiAgent from "@/lib/api";
import { toast } from "sonner";
import BottomNavigation from "../sessions/components/BottomNavigation";
import { useSWRConfig } from "swr";
import { getAuthControllerGetMeKey } from "@/api/seee.swr";
import { getSubscriptionTimeLeftLabel, isSubscriptionActive } from "@/lib/subscription";

function getAccountTypeLabel(accountType?: "USER" | "MANAGER" | "TEAM_MEMBER") {
  switch (accountType) {
    case "MANAGER":
      return "Владелец компании";
    case "TEAM_MEMBER":
      return "Член команды";
    default:
      return "Пользователь";
  }
}

function getAccountTypeDescription(accountType?: "USER" | "MANAGER" | "TEAM_MEMBER") {
  switch (accountType) {
    case "MANAGER":
      return "У вас есть доступ к кабинету владельца, ссылке для команды и сводке по закреплённым аккаунтам.";
    case "TEAM_MEMBER":
      return "Ваш доступ предоставлен по приглашению основателя, подпиской управляет компания.";
    default:
      return "Обычный пользовательский аккаунт с личной подпиской и стандартным доступом.";
  }
}

const CabinetPage = observer(() => {
  const { data: profile } = useAuthControllerGetMe();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { mutate } = useSWRConfig();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [isSavingDailyPractice, setIsSavingDailyPractice] = useState(false);

  const handleNeurocardClick = () => {
    navigate("/map");
  };

  const handleSessionsGalleryClick = () => {
    navigate("/sessions/list");
  };

  const handleMegachatsClick = () => {
    navigate("/people");
  };

  const handleArchivistClick = () => {
    navigate("/sessions/list");
  };

  const handleManagersClick = () => {
    navigate("/cabinet/founder");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const subscriptionEndsAtText = useMemo(() => {
    if (!profile?.subscriptionEndsAt) return "—";
    const d = new Date(profile.subscriptionEndsAt);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }, [profile?.subscriptionEndsAt]);

  const subscriptionDaysLeft = useMemo(() => {
    if (!profile?.subscriptionEndsAt) return null;
    const d = new Date(profile.subscriptionEndsAt);
    if (Number.isNaN(d.getTime())) return null;
    const ms = d.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [profile?.subscriptionEndsAt]);

  const subscriptionTimeLeftText = useMemo(
    () => getSubscriptionTimeLeftLabel(profile?.subscriptionEndsAt),
    [profile?.subscriptionEndsAt],
  );

  const effectiveSubscriptionActive = isSubscriptionActive(profile);

  const streakPreview = useMemo(() => {
    const streak = Math.max(0, Number(profile?.dailyStreak ?? 0));
    const visibleCount = Math.min(7, Math.max(3, streak || 3));
    return Array.from({ length: visibleCount }, (_, index) => index < streak);
  }, [profile?.dailyStreak]);

  useEffect(() => {
    const syncProfile = () => {
      void mutate(getAuthControllerGetMeKey());
    };
    window.addEventListener("seee:streak-updated", syncProfile as EventListener);
    window.addEventListener("seee:coins-updated", syncProfile as EventListener);
    return () => {
      window.removeEventListener("seee:streak-updated", syncProfile as EventListener);
      window.removeEventListener("seee:coins-updated", syncProfile as EventListener);
    };
  }, [mutate]);

  const handleCancelSubscription = async () => {
    if (!window.confirm("Точно отменить подписку? Доступ к приложению будет заблокирован.")) {
      return;
    }
    setIsCancelingSubscription(true);
    try {
      const result = await apiAgent.post<undefined, { status: string; isActive: boolean }>(
        "/auth/subscription/cancel",
      );
      if (user) {
        user.subscriptionStatus = result.status as any;
        user.subscriptionActive = result.isActive;
      }
      toast.success("Подписка отменена. Доступ ограничен.");
      navigate("/subscription", { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Не удалось отменить подписку");
    } finally {
      setIsCancelingSubscription(false);
    }
  };

  const handleDailyPracticeChange = async (minutes: 5 | 10 | 15) => {
    if (isSavingDailyPractice) return;
    setIsSavingDailyPractice(true);
    try {
      const updated = await apiAgent.patch<
        { dailyPracticeMinutes: 5 | 10 | 15 },
        { dailyPracticeMinutes?: 5 | 10 | 15 | null }
      >("/auth/me", { dailyPracticeMinutes: minutes });
      if (user) {
        user.dailyPracticeMinutes = updated.dailyPracticeMinutes ?? minutes;
      }
      await mutate(getAuthControllerGetMeKey());
      toast.success("Ежедневная цель обновлена");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Не удалось обновить ежедневную цель");
    } finally {
      setIsSavingDailyPractice(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 pb-28">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <User className="h-8 w-8" />
          Личный кабинет
        </h1>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Разделы</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" onClick={handleNeurocardClick}>
              Нейрокарта
            </Button>
            <Button variant="outline" onClick={handleSessionsGalleryClick}>
              Галерея сессий
            </Button>
            <Button variant="outline" onClick={handleMegachatsClick}>
              Мега-чаты
            </Button>
            <Button variant="outline" onClick={handleArchivistClick}>
              Архивариус
            </Button>
            {profile?.accountType === "MANAGER" ? (
              <Button variant="outline" onClick={handleManagersClick}>
                Кабинет владельца
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ProfileSection profile={profile} />
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Статус аккаунта</h2>
          <div className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold">
            {getAccountTypeLabel(profile?.accountType)}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {getAccountTypeDescription(profile?.accountType)}
          </p>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Seee-токены</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-bold">
                {effectiveSubscriptionActive ? subscriptionTimeLeftText : "Закончились"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {effectiveSubscriptionActive
                  ? "Столько осталось до окончания текущего доступа."
                  : "У вас закончились seee-токены, нужно пополнить баланс 💛"}
              </p>
            </div>
            <Button onClick={() => navigate("/subscription")}>
              {effectiveSubscriptionActive ? "Пополнить заранее" : "Пополнить баланс"}
            </Button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Ежедневная цель</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Сколько минут в день я хочу тратить на C каждый день.
          </p>
          <div className="flex flex-wrap gap-3">
            {[5, 10, 15].map((minutes) => (
              <Button
                key={minutes}
                variant={profile?.dailyPracticeMinutes === minutes ? "default" : "outline"}
                disabled={isSavingDailyPractice}
                onClick={() => handleDailyPracticeChange(minutes as 5 | 10 | 15)}
              >
                {minutes} минут
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Ударный режим</h2>
          <p className="text-sm text-muted-foreground">
            Серия дней подряд, в которые вы закрыли ежедневную цель.
          </p>
          <div className="mt-4 flex items-center gap-2">
            {streakPreview.map((active, index) => (
              <div
                key={index}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
                  active
                    ? "border-orange-300 bg-orange-100 text-orange-600"
                    : "border-muted bg-muted/40 text-muted-foreground"
                }`}
              >
                {active ? "🔥" : "·"}
              </div>
            ))}
          </div>
          <p className="mt-4 text-base font-semibold">
            {profile?.dailyStreak ?? 0} дней подряд
          </p>
        </div>

        {/* Настройки безопасности */}
        <div className="mb-6">
          <SecuritySettings />
        </div>

        {/* Кнопки действий */}
        <div className="mb-6">
          <Button
            onClick={() => setIsFeedbackOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            Обратная связь
          </Button>
        </div>

        {/* Реферальная система */}
        <div className="mb-6">
          <ReferralSystem />
        </div>

        {/* Моя обратная связь */}
        <div className="mb-6">
          <MyFeedback />
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Подписка</h2>
          <div className="space-y-2 text-sm">
            {profile?.accountType === "TEAM_MEMBER" ? (
              <p>
                Доступ: <span className="font-semibold">по приглашению основателя</span>
              </p>
            ) : null}
            <p>
              Статус:{" "}
              <span className="font-semibold">
                {effectiveSubscriptionActive ? "Активна" : "Не активна"}
              </span>
            </p>
            <p>
              Дата окончания: <span className="font-semibold">{subscriptionEndsAtText}</span>
            </p>
            <p>
              Осталось дней:{" "}
              <span className="font-semibold">
                {subscriptionDaysLeft === null ? "—" : subscriptionDaysLeft}
              </span>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/subscription")}
              disabled={effectiveSubscriptionActive || profile?.accountType === "TEAM_MEMBER"}
            >
              {profile?.accountType === "TEAM_MEMBER"
                ? "Доступ управляется руководителем"
                : effectiveSubscriptionActive
                  ? "Подписка оформлена"
                  : "Оформить подписку"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={
                !effectiveSubscriptionActive ||
                isCancelingSubscription ||
                profile?.accountType === "TEAM_MEMBER"
              }
            >
              {profile?.accountType === "TEAM_MEMBER"
                ? "Недоступно для сотрудников"
                : isCancelingSubscription
                  ? "Отмена..."
                  : "Отменить подписку"}
            </Button>
          </div>
        </div>

        <div className="pb-6 pt-2">
          <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
            Выйти
          </Button>
        </div>
      </div>
      <BottomNavigation
        onRating={() => navigate("/rating")}
        onMindMap={() => navigate("/map")}
        onCabinet={() => navigate("/cabinet")}
      />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </Layout>
  );
});

export default CabinetPage;
