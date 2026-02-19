import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "@/lib/validations/auth";
import apiAgent from "@/lib/api";
import { toast } from "sonner";
import styles from "./LoginPage.module.css";

const ResetPasswordPage = observer(() => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      toast.error("Отсутствует токен. Проверьте ссылку из письма.");
      navigate("/forgot-password", { replace: true });
    }
  }, [token, navigate]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    try {
      await apiAgent.post<
        { token: string; newPassword: string },
        { message: string }
      >("/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      setSuccess(true);
      toast.success("Пароль успешно изменён");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Ошибка сброса пароля";
      toast.error(msg);
    }
  };

  if (!token) {
    return null;
  }

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
          <p className="mt-2 text-white/90">
            {success ? "Пароль изменён" : "Новый пароль"}
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <p className="text-white/90 text-sm text-center">
              Пароль успешно изменён. Войдите с новым паролем.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              Перейти к входу
            </Button>
          </div>
        ) : (
          <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField>
              <FormItem>
                <FormLabel htmlFor="newPassword" className="text-white">
                  Новый пароль
                </FormLabel>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    {...register("newPassword")}
                    autoComplete="new-password"
                    placeholder="Минимум 6 символов"
                    className={cn(
                      "bg-white/10 border-white/30 text-white placeholder:text-white/60 pr-10",
                      errors.newPassword && "border-red-400"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.newPassword?.message && (
                  <FormMessage
                    message={errors.newPassword?.message}
                    className="text-red-200"
                  />
                )}
              </FormItem>
            </FormField>

            <FormField>
              <FormItem>
                <FormLabel htmlFor="confirmPassword" className="text-white">
                  Подтвердите пароль
                </FormLabel>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    {...register("confirmPassword")}
                    autoComplete="new-password"
                    placeholder="Повторите пароль"
                    className={cn(
                      "bg-white/10 border-white/30 text-white placeholder:text-white/60 pr-10",
                      errors.confirmPassword && "border-red-400"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword?.message && (
                  <FormMessage
                    message={errors.confirmPassword?.message}
                    className="text-red-200"
                  />
                )}
              </FormItem>
            </FormField>

            <Button
              type="submit"
              className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Сохранение..." : "Сохранить пароль"}
            </Button>
          </Form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-white/90">
            Вспомнили пароль?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-white underline hover:text-white"
            >
              Войти
            </button>
          </p>
        </div>
      </div>
    </div>
  );
});

export default ResetPasswordPage;
