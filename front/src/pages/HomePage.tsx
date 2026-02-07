import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoginForm from "./auth/components/LoginForm";

const HomePage = observer(() => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Если пользователь не авторизован, не делаем ничего - показываем форму логина
    if (!authLoading && !isAuthenticated) {
      return;
    }

    // Если пользователь авторизован, продолжаем логику
    if (isAuthenticated) {
      // Дальше решит EntryGate (онбординг или новая сессия)
      navigate("/", { replace: true });
      return;
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Если пользователь не авторизован, показываем форму логина
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-full max-w-md px-6 py-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <img
                  src="/seee-logo-128.png"
                  alt="Seee"
                  className="h-10 w-10 rounded-full bg-white/90"
                  draggable={false}
                />
                <h1 className="text-3xl font-bold text-white">Seee</h1>
              </div>
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

  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
        <p className="text-gray-600">Перенаправляем...</p>
      </div>
    </div>
  );
});

export default HomePage;
