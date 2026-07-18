import type { SessionResponseDto } from "@/api/schemas";
import { useSessionsControllerGetSession } from "@/api/seee.swr";
import { Loader2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isSubscriptionActive, SEE_TOKENS_EXPIRED_MESSAGE } from "@/lib/subscription";
import SessionHeader from "./components/SessionHeader";
import StepDialogWindow from "./components/StepDialogWindow";
import styles from "./SessionPage.module.css";
import sceneStyles from "@/styles/immersiveScene.module.css";

const sessionLayoutClass =
  `flex min-h-0 flex-col overflow-hidden ${sceneStyles.scene}`;

const SessionPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const isDraft = id === "new";

  const {
    data: session,
    isLoading,
    error,
  } = useSessionsControllerGetSession(id!, {
    swr: {
      enabled: !!id && !isDraft,
    },
  });

  if (isDraft) {
    if (auth.isAuthenticated && !isSubscriptionActive(auth.user)) {
      return (
        <div className={`${sceneStyles.scene} flex min-h-screen items-center justify-center px-4`}>
          <div className="w-full max-w-md rounded-3xl border border-white/35 bg-white/84 p-6 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
              Seee-токены закончились
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {SEE_TOKENS_EXPIRED_MESSAGE}
            </p>
            <Button asChild className="mt-5 w-full rounded-2xl">
              <Link to="/subscription?topup=1">Пополнить баланс</Link>
            </Button>
          </div>
        </div>
      );
    }

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
                  .map(
                    (c) =>
                      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2),
                  )
                  .join(""),
              );
              const payload = JSON.parse(json);
              return String(
                payload?.sub ?? payload?.id ?? payload?.userId ?? "anon",
              );
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
      <div
        className={sessionLayoutClass}
        style={{ height: "var(--app-interactive-height, 100dvh)" }}
      >
        <SessionHeader session={draftSession} isDraft />
        <div className={`${styles.sessionContent} ${sceneStyles.content}`}>
          <StepDialogWindow key={draftSession.id} session={draftSession} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div
          className={`${sceneStyles.scene} ${sceneStyles.content} flex h-full w-full items-center justify-center`}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-gray-700 dark:text-gray-200 text-sm">
              Загрузка сессии...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className={`${sceneStyles.scene} flex h-screen items-center justify-center`}>
        <div className="text-center p-8 bg-white/78 dark:bg-slate-900/68 backdrop-blur-xl rounded-2xl shadow-xl border border-white/35 dark:border-white/10">
          <p className="text-gray-800 dark:text-gray-100 text-lg font-medium">
            {error ? "Ошибка загрузки сессии" : "Сессия не найдена"}
          </p>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">
            {error
              ? "Попробуйте обновить страницу"
              : "Возможно, сессия была удалена"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={sessionLayoutClass}
      style={{ height: "var(--app-interactive-height, 100dvh)" }}
    >
      <SessionHeader session={session} />
      <div className={`${styles.sessionContent} ${sceneStyles.content}`}>
        <StepDialogWindow key={session.id} session={session} />
      </div>
    </div>
  );
});

export default SessionPage;
