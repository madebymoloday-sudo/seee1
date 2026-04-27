import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { PENDING_CHAT_INVITE_KEY } from "./people/InviteRedirectPage";

const EntryGatePage = observer(() => {
  const subscriptionGateEnabled =
    String(import.meta.env.VITE_REQUIRE_SUBSCRIPTION || "").toLowerCase() ===
    "true";
  const navigate = useNavigate();
  const { user } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const hasActiveSubscription = !!user.subscriptionActive;
    if (subscriptionGateEnabled && !hasActiveSubscription) {
      navigate("/subscription", { replace: true });
      return;
    }

    const pendingChatInvite = localStorage.getItem(PENDING_CHAT_INVITE_KEY);
    if (pendingChatInvite) {
      navigate(`/invite/${encodeURIComponent(pendingChatInvite)}`, { replace: true });
      return;
    }

    navigate("/sessions/list", { replace: true });
  }, [
    navigate,
    subscriptionGateEnabled,
    user?.id,
    user?.subscriptionActive,
  ]);

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

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Открываем архивариуса...
      </div>
    </div>
  );
});

export default EntryGatePage;
