import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import styles from "./MessageInput.module.css";

interface MessageInputProps {
  onSend: (message: string) => void;
  onSettingsClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

function setCombinedRefs<T>(value: T, refs: Array<React.Ref<T> | undefined>) {
  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === "function") ref(value);
    else (ref as React.MutableRefObject<T>).current = value;
  }
}

const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  ({ onSend, onSettingsClick, disabled = false, placeholder, autoFocus }: MessageInputProps, forwardedRef) => {
  const [message, setMessage] = useState("");
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const combinedRef = useMemo(() => {
    return (el: HTMLTextAreaElement | null) => {
      localRef.current = el;
      setCombinedRefs(el, [forwardedRef]);
    };
  }, [forwardedRef]);

  useEffect(() => {
    if (!autoFocus) return;
    if (disabled) return;
    const t = window.setTimeout(() => localRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [autoFocus, disabled]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      // Не теряем фокус после отправки (особенно на мобильных)
      window.setTimeout(() => localRef.current?.focus(), 0);
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
          ref={combinedRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder ?? "Введите сообщение..."}
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
});

MessageInput.displayName = "MessageInput";

export default MessageInput;

