import { useEffect, useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useAuth } from "@/hooks/useAuth";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { Loader2 } from "lucide-react";

const ONBOARDING_DONE_PREFIX = "seee_onboarding_neuro_done:";

const EntryGatePage = observer(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const startedRef = useRef(false);

  const onboardingDone = useMemo(() => {
    const userId = user?.id;
    if (!userId) return false;
    return localStorage.getItem(`${ONBOARDING_DONE_PREFIX}${userId}`) === "1";
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!onboardingDone) return;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const s = await createSession({});
        if (s?.id) {
          navigate(`/sessions/${s.id}`, { replace: true });
        } else {
          navigate("/sessions/list", { replace: true });
        }
      } catch {
        navigate("/sessions/list", { replace: true });
      }
    })();
  }, [createSession, navigate, onboardingDone, user?.id]);

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

  if (!onboardingDone) {
    return <Navigate to="/neuro" replace />;
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Создаём новую сессию...
      </div>
    </div>
  );
});

export default EntryGatePage;

