import { useEffect, useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useEventMapControllerGetEventMap } from "@/api/seee.swr";

const ONBOARDING_DONE_PREFIX = "seee_onboarding_neuro_done:";

const EntryGatePage = observer(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const startedRef = useRef(false);
  const { data: eventMap, error: eventMapError } = useEventMapControllerGetEventMap();

  const onboardingDone = useMemo(() => {
    const userId = user?.id;
    if (!userId) return false;
    const key = `${ONBOARDING_DONE_PREFIX}${userId}`;
    if (localStorage.getItem(key) === "1") return true;
    // Migration: older flow could write "anonymous" before authStore was ready
    if (localStorage.getItem(`${ONBOARDING_DONE_PREFIX}anonymous`) === "1") return true;
    if (Array.isArray(eventMap) && eventMap.length > 0) return true;
    return false;
  }, [eventMap, user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const anonKey = `${ONBOARDING_DONE_PREFIX}anonymous`;
    const realKey = `${ONBOARDING_DONE_PREFIX}${userId}`;
    try {
      if (localStorage.getItem(realKey) !== "1" && localStorage.getItem(anonKey) === "1") {
        localStorage.setItem(realKey, "1");
        localStorage.removeItem(anonKey);
      }
      if (localStorage.getItem(realKey) !== "1" && Array.isArray(eventMap) && eventMap.length > 0) {
        localStorage.setItem(realKey, "1");
      }
    } catch {
      // ignore
    }
  }, [eventMap, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!onboardingDone) return;
    if (startedRef.current) return;
    startedRef.current = true;

    // ВАЖНО: не создаём пустую сессию на сервере при входе.
    // Сессия должна появляться только после первого ответа в /sessions/new.
    navigate("/sessions", { replace: true });
  }, [navigate, onboardingDone, user?.id]);

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загружаем...
        </div>
      </div>
    );
  }

  if (!onboardingDone && !eventMapError && eventMap === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Проверяем данные аккаунта...
        </div>
      </div>
    );
  }

  if (!onboardingDone) {
    return <Navigate to="/neuro" replace />;
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Открываем сессии...
      </div>
    </div>
  );
});

export default EntryGatePage;

