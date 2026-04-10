import { observer } from "mobx-react-lite";
import { Navigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { PAYMENT_DONE_KEY, TTL_MS } from "../subscription/PaymentSuccessPage";

const RegisterPage = observer(() => {
  const { isAuthenticated, register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated) return;
    try {
      const teamInviteCode = searchParams.get("team") || "";
      if (teamInviteCode) {
        setAllowed(true);
        return;
      }
      const raw = sessionStorage.getItem(PAYMENT_DONE_KEY);
      const ts = raw ? parseInt(raw, 10) : 0;
      const ref = searchParams.get("ref") || "";
      const subscriptionPath = ref ? `/subscription?ref=${ref}` : "/subscription";
      if (!raw || !Number.isFinite(ts) || Date.now() - ts > TTL_MS) {
        navigate(subscriptionPath, { replace: true });
        return;
      }
      setAllowed(true);
    } catch {
      navigate("/subscription", { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams]);

  if (isAuthenticated) {
    return <Navigate to="/sessions/list" replace />;
  }

  if (allowed !== true) {
    return (
      <div className={styles.loginPageContainer}>
        <div className={styles.loginFormContainer}>
          <p className={`text-center ${styles.loginSubtitle}`}>Переход к оформлению подписки...</p>
        </div>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !name.trim()) {
      toast.error("Заполните все поля");
      return;
    }

    if (password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    try {
      const username = name.toLowerCase().replace(/\s+/g, "_");

      await registerUser({
        email: email.trim(),
        password: password,
        name: name.trim(),
        username: username,
        referrerId: searchParams.get("ref") || undefined,
        teamInviteCode: searchParams.get("team") || undefined,
      });

      try {
        sessionStorage.removeItem(PAYMENT_DONE_KEY);
      } catch {
        // ignore
      }
      toast.success("Регистрация успешна! Вы вошли в систему.");
      const ref = searchParams.get("ref");
      if (ref) {
        try {
          localStorage.setItem("seee_ref", ref);
        } catch {
          // ignore
        }
      }
      navigate("/sessions/list", { replace: true });
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
            <img
              src="/seee-logo-128.png"
              alt="Seee"
              className="h-8 w-8 rounded-full bg-white/90"
              draggable={false}
            />
            <h1 className={`text-3xl font-bold ${styles.loginTitle}`}>Seee</h1>
          </div>
          <p className={`mt-2 ${styles.loginSubtitle}`}>
            Регистрация
          </p>
          {searchParams.get("team") ? (
            <p className={`mt-2 ${styles.loginSubtitle}`}>
              Регистрация сотрудника по приглашению. Оплата подписки не требуется.
            </p>
          ) : null}
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль (минимум 6 символов)"
                autoComplete="new-password"
                className={`${styles.input} pr-10`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className={`block mb-2 ${styles.label}`}>
              Подтвердите пароль
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                autoComplete="new-password"
                className={`${styles.input} pr-10`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white"
            disabled={isLoading}
          >
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className={`text-sm ${styles.loginSubtitle}`}>
            Уже есть аккаунт?{" "}
            <button
              onClick={() => navigate("/login")}
              className="underline hover:text-white/80"
            >
              Войти
            </button>
          </p>
          <p className="text-xs text-white/70">
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
      </div>
    </div>
  );
});

export default RegisterPage;
