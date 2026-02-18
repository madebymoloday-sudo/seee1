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
    __telegramWidgetLoadPromise?: Promise<void>;
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

function loadTelegramWidgetScript(): Promise<void> {
  if (window.Telegram?.Login?.auth) {
    return Promise.resolve();
  }

  if (window.__telegramWidgetLoadPromise) {
    return window.__telegramWidgetLoadPromise;
  }

  window.__telegramWidgetLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://telegram.org/js/telegram-widget.js?22"]'
    );

    if (existing) {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.Telegram?.Login?.auth) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt > 8000) {
          window.clearInterval(timer);
          reject(new Error("Telegram SDK load timeout"));
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Telegram SDK"));
    document.body.appendChild(script);
  });

  return window.__telegramWidgetLoadPromise;
}

interface TelegramAuthButtonProps {
  authType?: "sign-in" | "sign-up" | "link";
  children?: React.ReactNode;
  className?: string;
  onLinkSuccess?: () => void;
}

const TelegramAuthButton = observer(
  ({
    authType = "sign-in",
    children = "Войти через Telegram",
    className,
    onLinkSuccess,
  }: TelegramAuthButtonProps) => {
    const navigate = useNavigate();
    const auth = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
      if (isLoading) return;

      const fallbackBotId = "8225371483";
      const envBotId = import.meta.env.VITE_TELEGRAM_BOT_ID;
      const botId =
        typeof envBotId === "string" && /^\d+$/.test(envBotId.trim())
          ? envBotId.trim()
          : fallbackBotId;

      // Common production misconfig: setting username/token instead of numeric bot_id.
      if (envBotId && botId === fallbackBotId && envBotId !== fallbackBotId) {
        console.warn(
          "VITE_TELEGRAM_BOT_ID must be a numeric bot id. Falling back to default.",
          { envBotId }
        );
      }

      setIsLoading(true);

      try {
        await loadTelegramWidgetScript();
      } catch (e) {
        console.error("Telegram SDK load error:", e);
        toast.error("Не удалось загрузить Telegram. Проверьте интернет и попробуйте снова.");
        setIsLoading(false);
        return;
      }

      const authFn = window.Telegram?.Login?.auth;
      if (!authFn) {
        console.error("Telegram Login Widget недоступен");
        toast.error("Telegram Login Widget не загружен");
        setIsLoading(false);
        return;
      }

      authFn(
        {
          bot_id: botId,
          request_access: "write",
        },
        async (telegramUser) => {
          if (!telegramUser) {
            toast.message("Telegram вход отменён");
            setIsLoading(false);
            return;
          }
          if (!telegramUser.hash) {
            toast.error("Telegram не вернул подпись (hash). Попробуйте ещё раз.");
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
              await apiAgent.post<
                typeof payload,
                Record<string, unknown>
              >("/auth/telegram/link", payload);
              toast.success("Telegram аккаунт успешно привязан");
              onLinkSuccess?.();
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

              // Обновляем store через проверку авторизации (токены уже в localStorage)
              await auth.checkAuth();
              navigate("/", { replace: true });
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
