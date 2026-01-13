import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { useSessions } from "@/hooks/useSessions";
import { Loader2 } from "lucide-react";

const HomePage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading } = useSessions();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();

  useEffect(() => {
    // Если есть сессии, открываем первую
    if (!isLoading && sessions.length > 0) {
      navigate(`/sessions/${sessions[0].id}`, { replace: true });
      return;
    }

    // Если нет сессий, создаём новую
    if (!isLoading && sessions.length === 0 && !isMutating) {
      const createAndNavigate = async () => {
        try {
          const newSession = await createSession({});
          if (newSession) {
            navigate(`/sessions/${newSession.id}`, { replace: true });
          }
        } catch (error) {
          console.error("Ошибка создания сессии:", error);
        }
      };
      createAndNavigate();
    }
  }, [isLoading, sessions, isMutating, navigate, createSession]);

  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
        <p className="text-gray-600">Загрузка...</p>
      </div>
    </div>
  );
});

export default HomePage;
