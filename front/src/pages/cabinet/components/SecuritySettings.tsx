import { useState } from "react";
import { Eye, EyeOff, Edit2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import apiAgent from "@/lib/api";
import styles from "./SecuritySettings.module.css";

const SecuritySettings = () => {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingLogin, setIsEditingLogin] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newLogin, setNewLogin] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleEditLogin = () => {
    setIsEditingLogin(true);
    setNewLogin(user?.email || "");
  };

  const handleSaveLogin = async () => {
    if (!newLogin.trim()) {
      toast.error("Email не может быть пустым");
      return;
    }

    try {
      await apiAgent.patch("/auth/profile", { email: newLogin });
      toast.success("Email успешно обновлён");
      setIsEditingLogin(false);
      // Обновляем данные пользователя
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Ошибка обновления email");
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

    try {
      await apiAgent.patch("/auth/profile", { password: newPassword });
      toast.success("Пароль успешно обновлён");
      setIsEditingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Ошибка обновления пароля");
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

  const maskPassword = () => "••••••••";

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
                <Button onClick={handleSaveLogin} size="sm" className={styles.saveButton}>
                  Сохранить
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
              type={showPassword ? "text" : "password"}
              value={showPassword ? "password123" : maskPassword()}
              readOnly
              className={styles.input}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className={styles.eyeButton}
              title={showPassword ? "Скрыть" : "Показать"}
            >
              {showPassword ? <EyeOff className={styles.eyeIcon} /> : <Eye className={styles.eyeIcon} />}
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
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.editInput}
                  placeholder="Новый пароль"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.editInput}
                  placeholder="Подтвердите пароль"
                />
                <Button onClick={handleSavePassword} size="sm" className={styles.saveButton}>
                  Сохранить
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
      </CardContent>
    </Card>
  );
};

export default SecuritySettings;
