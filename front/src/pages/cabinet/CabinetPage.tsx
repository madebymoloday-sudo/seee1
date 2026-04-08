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

const CabinetPage = observer(() => {
  const { data: profile } = useAuthControllerGetMe();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [chatNotes, setChatNotes] = useState<
    Array<{ chatId: string; chatTitle: string; text: string; updatedAt: string }>
  >([]);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const userSub = useMemo(() => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return "";
      const [, payload] = token.split(".");
      return JSON.parse(atob(payload)).sub || "";
    } catch {
      return "";
    }
  }, []);

  const handleNeurocardClick = () => {
    navigate("/map");
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

  useEffect(() => {
    if (!userSub) return;
    const indexKey = `seee_people_chat_notes:index:${userSub}`;
    const raw = localStorage.getItem(indexKey);
    if (!raw) {
      setChatNotes([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, any>;
      const list = Object.values(parsed || {})
        .filter((x: any) => (x?.text || "").trim().length > 0)
        .sort(
          (a: any, b: any) =>
            new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime()
        );
      setChatNotes(list as any);
    } catch {
      setChatNotes([]);
    }
  }, [userSub, profile?.id]);

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
            <Button variant="outline" onClick={() => navigate("/sessions/list")}>
              Галерея сессий
            </Button>
            <Button variant="outline" onClick={handleNeurocardClick}>
              Нейрокарта
            </Button>
            <Button variant="outline" onClick={() => navigate("/journal")}>
              Журнал
            </Button>
            <Button variant="outline" onClick={() => navigate("/people")}>
              Чаты
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ProfileSection profile={profile} />
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
          <h2 className="mb-3 text-lg font-semibold">Заметки из чатов</h2>
          {chatNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока нет заметок из раздела «Чаты».
            </p>
          ) : (
            <div className="space-y-3">
              {chatNotes.map((note) => (
                <div key={note.chatId} className="rounded-lg border p-3">
                  <div className="mb-1 text-sm font-medium">{note.chatTitle || "Чат"}</div>
                  <div className="text-sm whitespace-pre-wrap">{note.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Подписка</h2>
          <div className="space-y-2 text-sm">
            <p>
              Статус:{" "}
              <span className="font-semibold">
                {profile?.subscriptionActive ? "Активна" : "Не активна"}
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
              disabled={!!profile?.subscriptionActive}
            >
              {profile?.subscriptionActive ? "Подписка оформлена" : "Оформить подписку"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={!profile?.subscriptionActive || isCancelingSubscription}
            >
              {isCancelingSubscription ? "Отмена..." : "Отменить подписку"}
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
        onPeople={() => navigate("/people")}
        onArchivist={() => navigate("/sessions/list")}
        onNewSession={() => navigate("/sessions/new")}
        onCabinet={() => navigate("/cabinet")}
      />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </Layout>
  );
});

export default CabinetPage;
