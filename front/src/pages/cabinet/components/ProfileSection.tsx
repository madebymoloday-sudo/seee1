import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TelegramAuthButton from "@/components/auth/TelegramAuthButton";
import type { UserProfileDto } from "@/api/schemas";

interface ProfileSectionProps {
  profile?: UserProfileDto;
}

const ProfileSection = observer(({ profile }: ProfileSectionProps) => {
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
          <p className="text-lg">{profile.username}</p>
        </div>
        {profile.email && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-lg">{profile.email}</p>
          </div>
        )}

        {!(profile as any).telegramId ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Привяжите Telegram аккаунт для быстрого входа
            </p>
            <TelegramAuthButton authType="link" className="w-full">
              Привязать Telegram
            </TelegramAuthButton>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              ✓ Telegram аккаунт привязан: @{(profile as any).telegramUsername || "N/A"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default ProfileSection;

