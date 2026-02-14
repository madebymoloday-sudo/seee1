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

const CabinetPage = observer(() => {
  const { data: profile } = useAuthControllerGetMe();
  const navigate = useNavigate();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [chatNotes, setChatNotes] = useState<
    Array<{ chatId: string; chatTitle: string; text: string; updatedAt: string }>
  >([]);
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
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <User className="h-8 w-8" />
          Личный кабинет
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ProfileSection profile={profile} />
        </div>

        {/* Настройки безопасности */}
        <div className="mb-6">
          <SecuritySettings />
        </div>

        {/* Кнопки действий */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Button
            onClick={handleNeurocardClick}
            variant="outline"
            className="flex items-center gap-2"
          >
            <img
              src="/seee-logo-128.png"
              alt="Seee"
              className="h-5 w-5 rounded-full"
              draggable={false}
            />
            Нейрокарта
          </Button>
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
              Пока нет заметок из раздела «Люди».
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
      </div>
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </Layout>
  );
});

export default CabinetPage;
