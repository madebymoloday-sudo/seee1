import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { useSessions } from "@/hooks/useSessions";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LoginForm from "./auth/components/LoginForm";

const HomePage = observer(() => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { sessions, isLoading, error } = useSessions();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Если пользователь не авторизован, не делаем ничего - показываем форму логина
    if (!authLoading && !isAuthenticated) {
      return;
    }

    // Если пользователь авторизован, продолжаем логику
    if (isAuthenticated) {
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
            if (error?.response?.status === 401) {
              // Пользователь не авторизован - показываем форму логина
              return;
            } else if (error?.response?.status === 502) {
              toast.error("Сервер временно недоступен. Попробуйте позже.");
            } else {
              toast.error("Не удалось создать сессию. Попробуйте обновить страницу.");
            }
          }
        };
        createAndNavigate();
      }

      // Если есть ошибка загрузки сессий (401 = не авторизован)
      if (error && (error as any)?.response?.status !== 401) {
        setHasError(true);
      }
    }
  }, [isLoading, sessions, error, isMutating, navigate, createSession, hasError, isAuthenticated, authLoading]);

  const handleRetry = () => {
    setHasError(false);
    setRetryCount(prev => prev + 1);
    window.location.reload();
  };

  // Если пользователь не авторизован, показываем форму логина
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-full max-w-md px-6 py-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">SEEE</h1>
              <p className="text-white/80">Войдите в свой аккаунт</p>
            </div>
            {showRegister ? (
              <div>
                <p className="text-white/80 text-sm mb-4 text-center">
                  Уже есть аккаунт?{" "}
                  <button
                    onClick={() => setShowRegister(false)}
                    className="text-white underline hover:text-white/80"
                  >
                    Войти
                  </button>
                </p>
                <Button
                  onClick={() => navigate("/register")}
                  className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  Перейти к регистрации
                </Button>
              </div>
            ) : (
              <>
                <LoginForm />
                <p className="text-white/80 text-sm mt-4 text-center">
                  Нет аккаунта?{" "}
                  <button
                    onClick={() => setShowRegister(true)}
                    className="text-white underline hover:text-white/80"
                  >
                    Зарегистрироваться
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

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
