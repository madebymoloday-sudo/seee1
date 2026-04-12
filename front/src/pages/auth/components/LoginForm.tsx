import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import TelegramAuthButton from "@/components/auth/TelegramAuthButton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react-lite";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import styles from "../LoginPage.module.css";

interface LoginFormProps {
  onSwitchToRegister?: () => void;
}

const LoginForm = observer(({ onSwitchToRegister }: LoginFormProps) => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email.trim().toLowerCase(), data.password);
      navigate("/", { replace: true });
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        (err.response?.status === 401 ? "Неверный email или пароль" : "Ошибка входа");

      setError("password", {
        type: "manual",
        message: errorMessage,
      });
      toast.error(errorMessage);
    }
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-md border border-red-400/45 bg-red-500/12 px-4 py-3 text-red-100">
          {errors.root.message}
        </div>
      )}

      <FormField>
        <FormItem>
          <FormLabel htmlFor="email" className={styles.authLabel}>
            Email
          </FormLabel>
          <Input
            id="email"
            type="email"
            {...register("email")}
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            className={cn(
              "bg-transparent border-white/24 text-white placeholder:text-white/60 focus-visible:ring-white/40",
              errors.email && "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.email?.message && (
            <FormMessage 
              message={errors.email?.message} 
              className="text-red-200"
            />
          )}
        </FormItem>
      </FormField>

      <FormField>
        <FormItem className="space-y-1.5">
          <FormLabel htmlFor="password" className="text-white/90">
            Пароль
          </FormLabel>
          <Input
            id="password"
            type="password"
            {...register("password")}
            autoComplete="current-password"
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password?.message ? "password-error" : undefined}
            className={cn(
              "bg-transparent border-white/24 text-white placeholder:text-white/60 focus-visible:ring-white/40",
              errors.password && "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.password?.message ? (
            <p id="password-error" className="text-sm font-medium text-red-200">
              {errors.password.message}
            </p>
          ) : null}
          <div className="pt-0.5 text-right">
            <Link
              to="/forgot-password"
              className={styles.authInlineLink}
            >
              Забыли пароль?
            </Link>
          </div>
        </FormItem>
      </FormField>

      <div className="flex gap-3">
        <Button 
          type="submit" 
          className={`flex-1 bg-white/14 hover:bg-white/18 border border-white/22 ${styles.authButton}`}
          disabled={isLoading}
        >
          {isLoading ? "Вход..." : "Войти"}
        </Button>
        {onSwitchToRegister && (
          <Button 
            type="button"
            onClick={onSwitchToRegister}
            variant="outline"
            className={`flex-1 bg-white/10 hover:bg-white/14 border border-white/18 ${styles.authButton}`}
          >
            Регистрация
          </Button>
        )}
      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/25" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className={`bg-transparent px-2 ${styles.authMutedText}`}>
            или
          </span>
        </div>
      </div>

      <TelegramAuthButton authType="sign-in" className="w-full">
        Войти через Telegram
      </TelegramAuthButton>
    </Form>
  );
});

export default LoginForm;
