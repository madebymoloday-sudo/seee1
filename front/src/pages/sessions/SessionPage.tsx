import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSessionsControllerGetSession } from "@/api/seee.swr";
import SessionHeader from "./components/SessionHeader";
import StepDialogWindow from "./components/StepDialogWindow";
import { Loader2 } from "lucide-react";
import type { SessionResponseDto } from "@/api/schemas";
import styles from "./SessionPage.module.css";

const sessionLayoutClass =
  "flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900";

const SessionPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const isDraft = id === "new";

  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setVisualHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const rootStyle =
    visualHeight != null
      ? { height: `${visualHeight}px`, minHeight: `${visualHeight}px`, maxHeight: `${visualHeight}px` }
      : { height: "100dvh", minHeight: "100dvh", maxHeight: "100dvh" } as React.CSSProperties;

  const { data: session, isLoading, error } = useSessionsControllerGetSession(
    id!,
    {
      swr: {
        enabled: !!id && !isDraft,
      },
    }
  );

  if (isDraft) {
    // Черновик: сессию на сервере НЕ создаём, пока пользователь не ответит на первый вопрос.
    let draftTitle = "Новая сессия";
    try {
      const token = localStorage.getItem("accessToken");
      const userKey = token
        ? (() => {
            try {
              const parts = token.split(".");
              if (parts.length < 2) return "anon";
              const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
              const json = decodeURIComponent(
                atob(base64)
                  .split("")
                  .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                  .join("")
              );
              const payload = JSON.parse(json);
              return String(payload?.sub ?? payload?.id ?? payload?.userId ?? "anon");
            } catch {
              return "anon";
            }
          })()
        : "anon";
      const stored = localStorage.getItem(`seee_draft_title:${userKey}`);
      if (stored && stored.trim()) draftTitle = stored.trim();
    } catch {
      // ignore
    }

    const draftSession = {
      id: "new",
      title: draftTitle,
      createdAt: new Date().toISOString(),
      messageCount: 0,
    } as unknown as SessionResponseDto;

    return (
      <div className={sessionLayoutClass} style={rootStyle}>
        <SessionHeader session={draftSession} isDraft />
        <div className={styles.sessionContent}>
          <StepDialogWindow key={draftSession.id} session={draftSession} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Загрузка сессии...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-slate-700/50">
          <p className="text-gray-800 dark:text-gray-200 text-lg font-medium">
            {error ? "Ошибка загрузки сессии" : "Сессия не найдена"}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {error ? "Попробуйте обновить страницу" : "Возможно, сессия была удалена"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={sessionLayoutClass} style={rootStyle}>
      <SessionHeader session={session} />
      <div className={styles.sessionContent}>
        <StepDialogWindow key={session.id} session={session} />
      </div>
    </div>
  );
});

export default SessionPage;

