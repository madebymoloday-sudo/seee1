import { useRef, useEffect, useState } from "react";
import { Download, MessageSquare, User, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "./SettingsDropdown.module.css";
import FeedbackModal from "./FeedbackModal";
import { useTheme } from "@/hooks/useTheme";

interface SettingsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

const SettingsDropdown = ({ isOpen, onClose, sessionId, messages }: SettingsDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Закрытие при клике вне меню
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleDownloadFile = () => {
    // Фильтруем только сообщения пользователя и сортируем по времени
    const userMessages = messages
      .filter((msg) => msg.role === "user")
      .map((msg, index) => `${index + 1}. ${msg.content}`)
      .join("\n\n");

    const content = `Ответы пользователя из сессии ${sessionId}\n\n${userMessages}`;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${sessionId}_responses.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onClose();
  };

  const handleFeedback = () => {
    setIsFeedbackOpen(true);
    onClose();
  };

  const handleCabinet = () => {
    navigate("/cabinet");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div ref={dropdownRef} className={styles.dropdown}>
        <button onClick={handleDownloadFile} className={styles.menuItem}>
          <Download className={styles.menuIcon} />
          <span>Скачать файл</span>
        </button>

        <button onClick={handleFeedback} className={styles.menuItem}>
          <MessageSquare className={styles.menuIcon} />
          <span>Обратная связь</span>
        </button>

        <button onClick={handleCabinet} className={styles.menuItem}>
          <User className={styles.menuIcon} />
          <span>Личный кабинет</span>
        </button>

        <div className={styles.divider} />

        <button onClick={toggleDarkMode} className={styles.menuItem}>
          {isDarkMode ? (
            <Sun className={styles.menuIcon} />
          ) : (
            <Moon className={styles.menuIcon} />
          )}
          <span>Тёмный режим</span>
          <div className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={isDarkMode}
              onChange={toggleDarkMode}
              className={styles.toggleInput}
            />
            <span className={`${styles.toggleSlider} ${isDarkMode ? styles.toggleSliderActive : ""}`} />
          </div>
        </button>
      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </>
  );
};

export default SettingsDropdown;
