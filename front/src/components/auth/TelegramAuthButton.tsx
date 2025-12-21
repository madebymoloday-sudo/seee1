import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import apiAgent from "@/lib/api";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TelegramIcon } from "./TelegramIcon";

type TelegramWidgetUser = {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (
          options: { bot_id: string; request_access?: "write" | "read" },
          callback: (user?: TelegramWidgetUser | null) => void
        ) => void;
      };
    };
  }
}

interface TelegramAuthButtonProps {
  authType?: "sign-in" | "sign-up" | "link";
  children?: React.ReactNode;
  className?: string;
}

const TelegramAuthButton = observer(
  ({
    authType = "sign-in",
    children = "Войти через Telegram",
    className,
  }: TelegramAuthButtonProps) => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = () => {
      if (isLoading) return;

      const botId = import.meta.env.VITE_TELEGRAM_BOT_ID;
      if (!botId) {
        console.error("TELEGRAM_BOT_ID не настроен");
        toast.error("Telegram авторизация не настроена");
        return;
      }

      const authFn = window.Telegram?.Login?.auth;
      if (!authFn) {
        console.error("Telegram Login Widget недоступен");
        toast.error("Telegram Login Widget не загружен");
        return;
      }

      setIsLoading(true);

      authFn(
        {
          bot_id: botId,
          request_access: "write",
        },
        async (telegramUser) => {
          if (!telegramUser || !telegramUser.hash) {
            setIsLoading(false);
            return;
          }

          try {
            const payload = {
              auth_date: Number(telegramUser.auth_date),
              first_name: telegramUser.first_name,
              hash: telegramUser.hash,
              id: String(telegramUser.id),
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
              username: telegramUser.username,
            };

            if (authType === "link") {
              // Привязка к существующему аккаунту
              await apiAgent.post("/auth/telegram/link", payload);
              toast.success("Telegram аккаунт успешно привязан");
            } else {
              // Вход/регистрация
              const response = await apiAgent.post<
                typeof payload,
                {
                  accessToken: string;
                  refreshToken: string;
                  user: { id: string; username: string; email?: string };
                }
              >("/auth/telegram/login", payload);

              localStorage.setItem("accessToken", response.accessToken);
              localStorage.setItem("refreshToken", response.refreshToken);

              // Обновляем store через проверку авторизации
              await login(response.user.email || "", "");
              navigate("/");
            }
          } catch (error) {
            console.error("Telegram auth error:", error);
            const errorMessage =
              (error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ||
              "Ошибка авторизации через Telegram";
            toast.error(errorMessage);
          } finally {
            setIsLoading(false);
          }
        }
      );
    };

    return (
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className={`bg-[#2AABEE] hover:bg-[#229ED9] text-white ${
          className || ""
        }`}
      >
        {isLoading ? (
          "Загрузка..."
        ) : (
          <>
            <TelegramIcon className="mr-2 shrink-0" />
            {children}
          </>
        )}
      </Button>
    );
  }
);

export default TelegramAuthButton;
