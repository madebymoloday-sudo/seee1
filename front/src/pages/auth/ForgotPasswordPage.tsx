import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import apiAgent from "@/lib/api";
import { toast } from "sonner";
import styles from "./LoginPage.module.css";

const ForgotPasswordPage = observer(() => {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      const res = await apiAgent.post<
        { email: string },
        { message: string }
      >("/auth/forgot-password", { email: data.email });
      setSuccess(true);
      toast.success(res.message);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Ошибка запроса";
      toast.error(msg);
    }
  };

  return (
    <div className={styles.loginPageContainer}>
      {success ? (
        <div className={styles.loginFormContainer}>
          <div className="text-center space-y-5">
            <div className="flex items-center justify-center gap-2">
              <img
                src="/seee-logo-128.png"
                alt="Seee"
                className="h-8 w-8 rounded-full bg-white/90"
                draggable={false}
              />
              <h1 className={`text-3xl font-bold ${styles.loginTitle}`}>Seee</h1>
            </div>
            <p className={`text-lg font-medium ${styles.loginSubtitle}`}>
              Сообщение отправлено в Telegram-бота
            </p>
            <a
              href="https://t.me/SeeeAppBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md bg-[#2AABEE] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#229ED9]"
            >
              Открыть @SeeeAppBot
            </a>
            <Button
              onClick={() => navigate("/login")}
              className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              Вернуться к входу
            </Button>
          </div>
        </div>
      ) : (
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
              Восстановление пароля
            </p>
          </div>

          <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField>
              <FormItem>
                <FormLabel htmlFor="email" className="text-white">
                  Email
                </FormLabel>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  autoComplete="email"
                  placeholder="Ваш email"
                  className={cn(
                    "bg-white/10 border-white/30 text-white placeholder:text-white/60",
                    errors.email && "border-red-400"
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

            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1 bg-white/20 border-white/30 text-white hover:bg-white/30"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Отправка..." : "Отправить ссылку"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/login")}
                className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                Назад
              </Button>
            </div>
          </Form>

          <div className="mt-6 text-center">
            <p className={`text-sm ${styles.loginSubtitle}`}>
              Вспомнили пароль?{" "}
              <button
                onClick={() => navigate("/login")}
                className="underline hover:text-white/80"
              >
                Войти
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

export default ForgotPasswordPage;
