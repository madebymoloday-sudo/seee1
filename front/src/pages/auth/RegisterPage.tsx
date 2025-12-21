import { observer } from "mobx-react-lite";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  registerSchema,
  type RegisterFormData,
} from "@/lib/validations/auth";
import { Brain } from "lucide-react";
import TelegramAuthButton from "@/components/auth/TelegramAuthButton";
import { cn } from "@/lib/utils";

const RegisterPage = observer(() => {
  const navigate = useNavigate();
  const { isAuthenticated, register: registerUser, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.name,
        username: data.username,
      });
      navigate("/");
    } catch (err: any) {
      const errorResponse = err.response?.data;
      const errorMessage =
        typeof errorResponse?.message === "string"
          ? errorResponse.message
          : Array.isArray(errorResponse?.message)
          ? errorResponse.message[0]
          : "Ошибка регистрации";
      const errorField = errorResponse?.field;

      // Если указано поле, устанавливаем ошибку на конкретное поле
      if (errorField) {
        // Проверяем, является ли поле валидным полем формы
        const validFields: (keyof RegisterFormData)[] = [
          "email",
          "username",
          "password",
          "passwordConfirm",
          "name",
        ];
        if (validFields.includes(errorField as keyof RegisterFormData)) {
          setError(errorField as keyof RegisterFormData, {
            type: "manual",
            message: errorMessage,
          });
        } else {
          // Если поле неизвестно, показываем общую ошибку
          setError("root", {
            type: "manual",
            message: errorMessage,
          });
        }
      } else {
        // Иначе показываем общую ошибку
        setError("root", {
          type: "manual",
          message: errorMessage,
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">SEEE</h1>
          </div>
          <p className="text-gray-600 mt-2">Регистрация</p>
        </div>

        <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
              {errors.root.message}
            </div>
          )}

          <FormField>
            <FormItem>
              <FormLabel htmlFor="username">Имя пользователя</FormLabel>
              <Input
                id="username"
                {...register("username")}
                aria-invalid={errors.username ? "true" : "false"}
                className={cn(
                  errors.username && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <FormMessage message={errors.username?.message} />
            </FormItem>
          </FormField>

          <FormField>
            <FormItem>
              <FormLabel htmlFor="name">Имя</FormLabel>
              <Input
                id="name"
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
                className={cn(
                  errors.name && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <FormMessage message={errors.name?.message} />
            </FormItem>
          </FormField>

          <FormField>
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                id="email"
                type="email"
                {...register("email")}
                aria-invalid={errors.email ? "true" : "false"}
                className={cn(
                  errors.email && "border-destructive focus-visible:ring-destructive"
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
                aria-invalid={errors.password ? "true" : "false"}
                className={cn(
                  errors.password && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <FormMessage message={errors.password?.message} />
            </FormItem>
          </FormField>

          <FormField>
            <FormItem>
              <FormLabel htmlFor="passwordConfirm">Подтвердите пароль</FormLabel>
              <Input
                id="passwordConfirm"
                type="password"
                {...register("passwordConfirm")}
                aria-invalid={errors.passwordConfirm ? "true" : "false"}
                className={cn(
                  errors.passwordConfirm && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <FormMessage message={errors.passwordConfirm?.message} />
            </FormItem>
          </FormField>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </Button>
        </Form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">или</span>
            </div>
          </div>

          <TelegramAuthButton authType="sign-up" className="w-full mt-4">
            Зарегистрироваться через Telegram
          </TelegramAuthButton>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Уже есть аккаунт?{" "}
          <a href="/login" className="text-blue-600 hover:text-blue-500">
            Войти
          </a>
        </p>
      </div>
    </div>
  );
});

export default RegisterPage;

