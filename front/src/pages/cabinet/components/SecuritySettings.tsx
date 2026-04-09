import { useState } from "react";
import { Eye, EyeOff, Edit2, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import apiAgent from "@/lib/api";
import styles from "./SecuritySettings.module.css";

const SecuritySettings = () => {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [showLogin, setShowLogin] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isEditingLogin, setIsEditingLogin] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newLogin, setNewLogin] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingLogin, setIsSavingLogin] = useState(false);

  const handleEditLogin = () => {
    setIsEditingLogin(true);
    setNewLogin(user?.email || "");
  };

  const handleSaveLogin = async () => {
    if (!newLogin.trim()) {
      toast.error("Email не может быть пустым");
      return;
    }

    setIsSavingLogin(true);
    try {
      await apiAgent.patch("/auth/me", { email: newLogin });
      toast.success("Email успешно обновлён");
      setIsEditingLogin(false);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Ошибка обновления email");
    } finally {
      setIsSavingLogin(false);
    }
  };

  const handleCancelLogin = () => {
    setIsEditingLogin(false);
    setNewLogin(user?.email || "");
  };

  const handleEditPassword = () => {
    setIsEditingPassword(true);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiAgent.patch("/auth/me", { password: newPassword });
      toast.success("Пароль успешно обновлён");
      setIsEditingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Ошибка обновления пароля");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCancelPassword = () => {
    setIsEditingPassword(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const maskLogin = (email: string) => {
    if (!email) return "";
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const maskedLocal = local.length > 2 
      ? local.substring(0, 2) + "*".repeat(local.length - 2)
      : "*".repeat(local.length);
    return `${maskedLocal}@${domain}`;
  };

  // Реальный текущий пароль показывать нельзя — но "глазик" должен давать видимый эффект
  // Пароль не хранится на клиенте и не может быть показан.
  const maskPassword = () => "********";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки безопасности</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Логин */}
        <div className={styles.field}>
          <label className={styles.label}>Логин</label>
          <div className={styles.inputWrapper}>
            <Input
              type={showLogin ? "text" : "password"}
              value={showLogin ? (user?.email || "") : maskLogin(user?.email || "")}
              readOnly
              className={styles.input}
            />
            <button
              type="button"
              onClick={() => setShowLogin(!showLogin)}
              className={styles.eyeButton}
              title={showLogin ? "Скрыть" : "Показать"}
            >
              {showLogin ? <EyeOff className={styles.eyeIcon} /> : <Eye className={styles.eyeIcon} />}
            </button>
            {!isEditingLogin ? (
              <Button
                onClick={handleEditLogin}
                variant="outline"
                size="sm"
                className={styles.editButton}
              >
                <Edit2 className={styles.editIcon} />
                Редактировать
              </Button>
            ) : (
              <div className={styles.editActions}>
                <Input
                  type="email"
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  className={styles.editInput}
                  placeholder="Новый email"
                />
                <Button
                  onClick={handleSaveLogin}
                  size="sm"
                  className={styles.saveButton}
                  disabled={isSavingLogin}
                >
                  {isSavingLogin ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button
                  onClick={handleCancelLogin}
                  variant="outline"
                  size="sm"
                  className={styles.cancelButton}
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Пароль */}
        <div className={styles.field}>
          <label className={styles.label}>Пароль</label>
          <div className={styles.inputWrapper}>
            <Input
              type="password"
              value={maskPassword()}
              readOnly
              className={styles.input}
            />
            <button
              type="button"
              onClick={() => {
                // Нельзя показать текущий пароль — объясняем пользователю.
                toast.message("Пароль нельзя показать — его можно только задать заново.");
              }}
              className={styles.eyeButton}
              title="Пароль нельзя показать"
            >
              <Eye className={styles.eyeIcon} />
            </button>
            {!isEditingPassword ? (
              <Button
                onClick={handleEditPassword}
                variant="outline"
                size="sm"
                className={styles.editButton}
              >
                <Edit2 className={styles.editIcon} />
                Редактировать
              </Button>
            ) : (
              <div className={styles.editActions}>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${styles.editInput} pr-10`}
                    placeholder="Новый пароль"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showNewPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${styles.editInput} pr-10`}
                    placeholder="Подтвердите пароль"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showNewPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={handleSavePassword}
                  size="sm"
                  className={styles.saveButton}
                  disabled={isSavingPassword}
                >
                  {isSavingPassword ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button
                  onClick={handleCancelPassword}
                  variant="outline"
                  size="sm"
                  className={styles.cancelButton}
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Тема */}
        <div className={styles.field}>
          <label className={styles.label}>Тема</label>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {isDarkMode ? "Тёмная тема включена" : "Светлая тема включена"}
            </div>
            <Button onClick={toggleDarkMode} variant="outline" size="sm">
              {isDarkMode ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  Светлая
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  Тёмная
                </>
              )}
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default SecuritySettings;
