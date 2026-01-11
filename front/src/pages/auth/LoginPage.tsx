import { observer } from "mobx-react-lite";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import LoginForm from "./components/LoginForm";
import TelegramAuthButton from "@/components/auth/TelegramAuthButton";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./LoginPage.module.css";

const LoginPage = observer(() => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubscribe = () => {
    // TODO: Добавить ссылку на оплату, когда пользователь пришлет
    window.location.href = "/subscription";
  };

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginFormContainer}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-8 w-8 text-white" />
            <h1 className={`text-3xl font-bold ${styles.loginTitle}`}>SEEE</h1>
          </div>
          <p className={`mt-2 ${styles.loginSubtitle}`}>Вход в систему</p>
        </div>

        <LoginForm />

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${styles.divider}`} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${styles.dividerText}`}>или</span>
            </div>
          </div>

          <TelegramAuthButton authType="sign-in" className="w-full mt-4">
            Войти через Telegram
          </TelegramAuthButton>
        </div>

        <div className="mt-4">
          <Button
            onClick={handleSubscribe}
            variant="outline"
            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
          >
            Купить подписку
          </Button>
        </div>

      </div>
    </div>
  );
});

export default LoginPage;

