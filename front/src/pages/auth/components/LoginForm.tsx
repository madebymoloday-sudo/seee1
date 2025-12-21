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

const LoginForm = observer(() => {
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
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
          {errors.root.message}
        </div>
      )}

      <FormField>
        <FormItem>
          <FormLabel htmlFor="email">Email</FormLabel>
          <Input
            id="email"
            type="email"
            {...register("email")}
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            className={cn(
              errors.email &&
                "border-destructive focus-visible:ring-destructive"
            )}
          />
          <FormMessage message={errors.email?.message} />
        </FormItem>
      </FormField>

      <FormField>
        <FormItem>
          <FormLabel htmlFor="password">Пароль</FormLabel>
          <Input
            id="password"
            type="password"
            {...register("password")}
            autoComplete="current-password"
            aria-invalid={errors.password ? "true" : "false"}
            className={cn(
              errors.password &&
                "border-destructive focus-visible:ring-destructive"
            )}
          />
          <FormMessage message={errors.password?.message} />
        </FormItem>
      </FormField>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Вход..." : "Войти"}
      </Button>
    </Form>
  );
});

export default LoginForm;
