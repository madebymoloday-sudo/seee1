import { observer } from "mobx-react-lite";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import styles from "./LoginPage.module.css";

const LoginPage = observer(() => {
  const { isAuthenticated, login, register: registerUser, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Заполните все поля");
      return;
    }

    try {
      await login(email, password);
      // Редирект произойдёт автоматически через isAuthenticated
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Ошибка входа. Проверьте данные.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Заполните email и пароль");
      return;
    }

    if (password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }

    try {
      // Генерируем имя из email (часть до @)
      const userName = email.split("@")[0];
      const username = userName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

      await registerUser({
        email: email.trim(),
        password: password,
        name: userName,
        username: username,
      });

      toast.success("Регистрация успешна! Вы вошли в систему.");
      // Редирект произойдёт автоматически через isAuthenticated
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Ошибка регистрации";
      const message = Array.isArray(errorMessage) ? errorMessage[0] : errorMessage;
      toast.error(message);
    }
  };

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginFormContainer}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-8 w-8 text-white" />
            <h1 className={`text-3xl font-bold ${styles.loginTitle}`}>SEEE</h1>
          </div>
          <p className={`mt-2 ${styles.loginSubtitle}`}>
            Вход в систему
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className={`block mb-2 ${styles.label}`}>
              Логин
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className={styles.input}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className={`block mb-2 ${styles.label}`}>
              Пароль
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              className={styles.input}
              required
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1 bg-[#0088cc] hover:bg-[#0077b3] text-white border-none shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? "Вход..." : "Войти"}
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRegister(e);
              }}
              variant="outline"
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              disabled={isLoading}
            >
              {isLoading ? "Регистрация..." : "Регистрация"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default LoginPage;
