import { observer } from "mobx-react-lite";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";

const RegisterPage = observer(() => {
  const { isAuthenticated, register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim() || !name.trim()) {
      toast.error("Заполните все поля");
      return;
    }

    if (password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }

    try {
      const username = name.toLowerCase().replace(/\s+/g, "_");

      await registerUser({
        email: email.trim(),
        password: password,
        name: name.trim(),
        username: username,
      });

      toast.success("Регистрация успешна! Вы вошли в систему.");
      // Редирект произойдёт автоматически через isAuthenticated
      navigate("/", { replace: true });
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
            Регистрация
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="name" className={`block mb-2 ${styles.label}`}>
              Имя
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              autoComplete="name"
              className={styles.input}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className={`block mb-2 ${styles.label}`}>
              Email
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
              placeholder="Пароль (минимум 6 символов)"
              autoComplete="new-password"
              className={styles.input}
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white"
            disabled={isLoading}
          >
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className={`text-sm ${styles.loginSubtitle}`}>
            Уже есть аккаунт?{" "}
            <button
              onClick={() => navigate("/")}
              className="underline hover:text-white/80"
            >
              Войти
            </button>
          </p>
        </div>
      </div>
    </div>
  );
});

export default RegisterPage;
