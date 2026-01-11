import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react-lite";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

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
      await login(data.email, data.password);
      // После успешного логина проверка подписки происходит в authStore
      // Перенаправление на нужную страницу обработает ProtectedRoute
      navigate("/");
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Ошибка входа";

      // Устанавливаем ошибку на поле password при ошибке входа
      // (бэкенд возвращает общее сообщение "Неверный email или пароль")
      setError("password", {
        type: "manual",
        message: errorMessage,
      });
    }
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="bg-red-500/20 border border-red-400 text-white px-4 py-3 rounded-md">
          {errors.root.message}
        </div>
      )}

      <FormField>
        <FormItem>
          <FormLabel htmlFor="email" className="text-white">Email</FormLabel>
          <Input
            id="email"
            type="email"
            {...register("email")}
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            className={cn(
              "bg-white/10 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50",
              errors.email &&
                "border-red-400 focus-visible:ring-red-400"
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
        <FormItem>
          <FormLabel htmlFor="password" className="text-white">Пароль</FormLabel>
          <Input
            id="password"
            type="password"
            {...register("password")}
            autoComplete="current-password"
            aria-invalid={errors.password ? "true" : "false"}
            className={cn(
              "bg-white/10 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50",
              errors.password &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.password?.message && (
            <FormMessage 
              message={errors.password?.message}
              className="text-red-200"
            />
          )}
        </FormItem>
      </FormField>

      <div className="flex gap-3">
        <Button 
          type="submit" 
          className="flex-1 bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white" 
          disabled={isLoading}
        >
          {isLoading ? "Вход..." : "Войти"}
        </Button>
        {onSwitchToRegister && (
          <Button 
            type="button"
            onClick={onSwitchToRegister}
            variant="outline"
            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" 
          >
            Регистрация
          </Button>
        )}
      </div>
    </Form>
  );
});

export default LoginForm;
