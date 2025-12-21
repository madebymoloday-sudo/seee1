import { observer } from "mobx-react-lite";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import LoginForm from "./components/LoginForm";
import TelegramAuthButton from "@/components/auth/TelegramAuthButton";
import { Brain } from "lucide-react";

const LoginPage = observer(() => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">SEEE</h1>
          </div>
          <p className="text-gray-600 mt-2">Вход в систему</p>
        </div>

        <LoginForm />

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">или</span>
            </div>
          </div>

          <TelegramAuthButton authType="sign-in" className="w-full mt-4">
            Войти через Telegram
          </TelegramAuthButton>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Нет аккаунта?{" "}
          <a href="/register" className="text-blue-600 hover:text-blue-500">
            Зарегистрироваться
          </a>
        </p>
      </div>
    </div>
  );
});

export default LoginPage;

