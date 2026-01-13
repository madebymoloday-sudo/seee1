import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { useSessions } from "@/hooks/useSessions";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const HomePage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading, error } = useSessions();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Если есть сессии, открываем первую
    if (!isLoading && !error && sessions.length > 0) {
      navigate(`/sessions/${sessions[0].id}`, { replace: true });
      return;
    }

    // Если нет сессий и нет ошибки, создаём новую
    if (!isLoading && !error && sessions.length === 0 && !isMutating && !hasError) {
      const createAndNavigate = async () => {
        try {
          const newSession = await createSession({});
          if (newSession) {
            navigate(`/sessions/${newSession.id}`, { replace: true });
          }
        } catch (error: any) {
          console.error("Ошибка создания сессии:", error);
          setHasError(true);
          if (error?.response?.status === 502) {
            toast.error("Сервер временно недоступен. Попробуйте позже.");
          } else {
            toast.error("Не удалось создать сессию. Попробуйте обновить страницу.");
          }
        }
      };
      createAndNavigate();
    }

    // Если есть ошибка загрузки сессий
    if (error) {
      setHasError(true);
    }
  }, [isLoading, sessions, error, isMutating, navigate, createSession, hasError]);

  const handleRetry = () => {
    setHasError(false);
    setRetryCount(prev => prev + 1);
    window.location.reload();
  };

  // Показываем ошибку только если есть проблема
  if (hasError && !isLoading && retryCount < 3) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md px-4">
          <p className="text-gray-800 text-lg mb-4">
            Не удалось подключиться к серверу
          </p>
          <p className="text-gray-600 text-sm mb-6">
            Пожалуйста, проверьте подключение к интернету и попробуйте снова
          </p>
          <Button
            onClick={handleRetry}
            className="bg-[#0088cc] hover:bg-[#0077b3] text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  // Если слишком много попыток, показываем сообщение
  if (retryCount >= 3) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md px-4">
          <p className="text-gray-800 text-lg mb-4">
            Сервер временно недоступен
          </p>
          <p className="text-gray-600 text-sm mb-6">
            Пожалуйста, попробуйте позже или обратитесь в поддержку
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            Обновить страницу
          </Button>
        </div>
      </div>
    );
  }

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
