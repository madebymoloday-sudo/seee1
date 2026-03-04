import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoginForm from "./auth/components/LoginForm";
import styles from "./auth/LoginPage.module.css";

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
      <div className={styles.loginPageContainer}>
        <div className="w-full max-w-md px-6 py-8">
          <div className={styles.loginFormContainer}>
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <img
                  src="/seee-logo-128.png"
                  alt="Seee"
                  className="h-10 w-10 rounded-full bg-white/90"
                  draggable={false}
                />
                <h1 className={`text-3xl font-bold ${styles.loginTitle}`}>Seee</h1>
              </div>
              <p className={`text-base ${styles.loginSubtitle}`}>Войдите в свой аккаунт</p>
            </div>
            {showRegister ? (
              <div>
                <p className={`text-sm mb-4 text-center ${styles.loginSubtitle}`}>
                  Уже есть аккаунт?{" "}
                  <button
                    onClick={() => setShowRegister(false)}
                    className="underline hover:opacity-80"
                  >
                    Войти
                  </button>
                </p>
                <Button
                  onClick={() => navigate("/subscription")}
                  className="w-full bg-white/14 hover:bg-white/18 text-white border border-white/22"
                >
                  Оформить подписку и зарегистрироваться
                </Button>
                <p className="text-xs mt-3 text-center text-white/70">
                  Поддержка:{" "}
                  <a
                    href="https://t.me/SeeeAppBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white/90"
                  >
                    Telegram
                  </a>
                </p>
              </div>
            ) : (
              <>
                <LoginForm />
                <p className={`text-sm mt-4 text-center ${styles.loginSubtitle}`}>
                  Нет аккаунта?{" "}
                  <button
                    onClick={() => setShowRegister(true)}
                    className="underline hover:opacity-80"
                  >
                    Оформить подписку и зарегистрироваться
                  </button>
                </p>
                <p className="text-xs mt-3 text-center text-white/70">
                  Поддержка:{" "}
                  <a
                    href="https://t.me/SeeeAppBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white/90"
                  >
                    Telegram
                  </a>
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
