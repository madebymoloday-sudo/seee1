import { useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import styles from "./MessageInput.module.css";

interface MessageInputProps {
  onSend: (message: string) => void;
  onSettingsClick?: () => void;
  disabled?: boolean;
}

const MessageInput = ({ onSend, onSettingsClick, disabled = false }: MessageInputProps) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.messageInputContainer}>
      <div className={styles.inputWrapper}>
        {/* Кнопка настроек (+) */}
        {onSettingsClick && (
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSettingsClick();
            }}
            className={styles.settingsButton}
            variant="ghost"
            size="icon"
            title="Настройки"
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}

        {/* Поле ввода */}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          disabled={disabled}
          className={styles.textarea}
          rows={1}
        />

        {/* Кнопка отправки (стрелка вверх) */}
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSend();
          }}
          disabled={disabled || !message.trim()}
          className={styles.sendButton}
          size="icon"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;

