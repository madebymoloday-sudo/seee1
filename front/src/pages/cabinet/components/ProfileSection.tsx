import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TelegramAuthButton from "@/components/auth/TelegramAuthButton";
import { TelegramIcon } from "@/components/auth/TelegramIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserProfileDto } from "@/api/schemas";
import apiAgent from "@/lib/api";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { getAuthControllerGetMeKey } from "@/api/seee.swr";
import { useAuth } from "@/hooks/useAuth";

interface ProfileSectionProps {
  profile?: UserProfileDto;
}

const ProfileSection = observer(({ profile }: ProfileSectionProps) => {
  const { mutate } = useSWRConfig();
  const auth = useAuth();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isEditingUserId, setIsEditingUserId] = useState(false);
  const [userIdDraft, setUserIdDraft] = useState("");
  const [isSavingUserId, setIsSavingUserId] = useState(false);

  useEffect(() => {
    if (!profile?.username) return;
    if (isEditingUsername) return;
    setUsernameDraft(profile.username);
  }, [isEditingUsername, profile?.username]);

  useEffect(() => {
    if (isEditingUserId) return;
    setUserIdDraft(profile?.userId || "");
  }, [isEditingUserId, profile?.userId]);

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Загрузка профиля...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Имя пользователя
          </label>
          {!isEditingUsername ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg break-all">{profile.username}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUsernameDraft(profile.username);
                  setIsEditingUsername(true);
                }}
              >
                Редактировать
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  placeholder="Введите имя пользователя"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isSavingUsername}
                />
                <Button
                  onClick={async () => {
                    const nextUsername = usernameDraft.trim();
                    if (nextUsername.length < 3) {
                      toast.error("Имя пользователя должно быть не короче 3 символов");
                      return;
                    }

                    setIsSavingUsername(true);
                    try {
                      const updated = await apiAgent.patch<
                        { username: string },
                        UserProfileDto
                      >("/auth/me", { username: nextUsername });

                      // Обновляем данные профиля в SWR
                      await mutate(getAuthControllerGetMeKey());

                      // Обновляем username в authStore, чтобы он сразу поменялся в шапке
                      if (auth.user?.id && auth.user.id === updated.id) {
                        auth.user = { ...auth.user, username: updated.username };
                      }

                      toast.success("Имя пользователя обновлено");
                      setIsEditingUsername(false);
                    } catch (err: any) {
                      const msg = err?.response?.data?.message;
                      toast.error(
                        typeof msg === "string"
                          ? msg
                          : "Не удалось обновить имя пользователя"
                      );
                    } finally {
                      setIsSavingUsername(false);
                    }
                  }}
                  disabled={isSavingUsername}
                >
                  Сохранить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setUsernameDraft(profile.username);
                    setIsEditingUsername(false);
                  }}
                  disabled={isSavingUsername}
                >
                  Отмена
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Минимум 3 символа.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Публичный ID
          </label>
          {!isEditingUserId ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg break-all">
                {profile.userId || "Не задан"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUserIdDraft(profile.userId || "");
                  setIsEditingUserId(true);
                }}
              >
                Редактировать
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={userIdDraft}
                  onChange={(e) => setUserIdDraft(e.target.value)}
                  placeholder="Например: SEEE_USER_01"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isSavingUserId}
                />
                <Button
                  onClick={async () => {
                    const nextUserId = userIdDraft.trim();
                    if (nextUserId.length < 4) {
                      toast.error("ID должен быть не короче 4 символов");
                      return;
                    }
                    if (!/^[A-Za-z0-9_]+$/.test(nextUserId)) {
                      toast.error("Допустимы только буквы, цифры и underscore");
                      return;
                    }

                    setIsSavingUserId(true);
                    try {
                      const updated = await apiAgent.patch<
                        { userId: string },
                        UserProfileDto
                      >("/auth/me", { userId: nextUserId });

                      await mutate(getAuthControllerGetMeKey());

                      if (auth.user?.id && auth.user.id === updated.id) {
                        auth.user = { ...auth.user, userId: updated.userId ?? null };
                      }

                      toast.success("Публичный ID обновлён");
                      setIsEditingUserId(false);
                    } catch (err: any) {
                      const msg = err?.response?.data?.message;
                      toast.error(
                        typeof msg === "string"
                          ? msg
                          : "Не удалось обновить ID пользователя"
                      );
                    } finally {
                      setIsSavingUserId(false);
                    }
                  }}
                  disabled={isSavingUserId}
                >
                  Сохранить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setUserIdDraft(profile.userId || "");
                    setIsEditingUserId(false);
                  }}
                  disabled={isSavingUserId}
                >
                  Отмена
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Используется для добавления в друзья. Уникален в системе.
              </p>
            </div>
          )}
        </div>
        {profile.email && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-lg">{profile.email}</p>
          </div>
        )}

        {!profile.telegramId ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Привяжите Telegram аккаунт для быстрого входа
            </p>
            <TelegramAuthButton
              authType="link"
              className="w-full"
              onLinkSuccess={() => mutate(getAuthControllerGetMeKey())}
            >
              Привязать Telegram
            </TelegramAuthButton>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ Привязано к Telegram
              </span>
            </div>
            <a
              href="https://t.me/SeeeAppBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2AABEE] px-4 py-2 text-sm font-medium text-white hover:bg-[#229ED9] transition-colors"
            >
              <TelegramIcon className="h-5 w-5" />
              Открыть бота Seee
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default ProfileSection;

