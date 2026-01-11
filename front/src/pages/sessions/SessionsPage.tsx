import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useSessions } from "@/hooks/useSessions";
import { MessageSquare, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SessionCard from "./components/SessionCard";

const SessionsPage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading, error } = useSessions();
  const { trigger: createSession, isMutating } =
    useSessionsControllerCreateSession();

  // Автоматически создаём и открываем сессию при первой загрузке, если сессий нет
  useEffect(() => {
    if (!isLoading && !error && sessions.length === 0 && !isMutating) {
      const createAndNavigate = async () => {
        try {
          const newSession = await createSession({});
          if (newSession) {
            navigate(`/sessions/${newSession.id}`);
          }
        } catch (error) {
          console.error("Ошибка автоматического создания сессии:", error);
        }
      };
      createAndNavigate();
    }
  }, [isLoading, error, sessions.length, isMutating, createSession, navigate]);

  const handleCreateSession = async () => {
    try {
      const newSession = await createSession({});
      if (newSession) {
        navigate(`/sessions/${newSession.id}`);
      }
    } catch (error) {
      console.error("Ошибка создания сессии:", error);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Мои сессии
          </h1>
          <Button onClick={handleCreateSession} disabled={isMutating}>
            <Plus className="h-4 w-4 mr-2" />
            {isMutating ? "Создание..." : "Новая сессия"}
          </Button>
        </div>

        {isLoading && <div>Загрузка сессий...</div>}
        {error !== undefined && error !== null && (
          <div className="text-red-500">Ошибка загрузки сессий</div>
        )}
        {!isLoading && !error && sessions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">У вас пока нет сессий</p>
            <p className="text-sm text-gray-400 mt-2">
              Создайте новую сессию, чтобы начать работу с психологом
            </p>
          </div>
        )}
        {!isLoading && !error && sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
});

export default SessionsPage;
