import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import apiAgent from "@/lib/api";

const PENDING_CHAT_INVITE_KEY = "seee_pending_chat_invite";

const InviteRedirectPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!chatId || isLoading) return;

    if (!isAuthenticated) {
      localStorage.setItem(PENDING_CHAT_INVITE_KEY, chatId);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await apiAgent.post(`/social/chats/${chatId}/join`, {});
      } finally {
        if (!cancelled) {
          localStorage.removeItem(PENDING_CHAT_INVITE_KEY);
          navigate(`/people?chatId=${encodeURIComponent(chatId)}`, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, isAuthenticated, isLoading, navigate]);

  if (!chatId) {
    return <Navigate to="/people" replace />;
  }

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Открываем чат...
      </div>
    </div>
  );
};

export { PENDING_CHAT_INVITE_KEY };
export default InviteRedirectPage;
