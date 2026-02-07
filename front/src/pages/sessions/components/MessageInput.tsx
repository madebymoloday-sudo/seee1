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
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
}

function setCombinedRefs<T>(value: T, refs: Array<React.Ref<T> | undefined>) {
  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === "function") ref(value);
    else (ref as React.MutableRefObject<T>).current = value;
  }
}

const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  (
    {
      onSend,
      onSettingsClick,
      disabled = false,
      readOnly = false,
      placeholder,
      autoFocus,
      value,
      onValueChange,
    }: MessageInputProps,
    forwardedRef
  ) => {
  const [internalMessage, setInternalMessage] = useState("");
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const isControlled = value !== undefined && typeof onValueChange === "function";
  const message = isControlled ? value : internalMessage;
  const setMessage = (next: string) => {
    if (isControlled) onValueChange(next);
    else setInternalMessage(next);
  };

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

  const autoResize = () => {
    const el = localRef.current;
    if (!el) return;
    // reset then fit content
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled && !readOnly) {
      onSend(message.trim());
      setMessage("");
      // Не теряем фокус после отправки (особенно на мобильных)
      window.setTimeout(() => localRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
            onMouseDown={(e) => {
              // Не забираем фокус у textarea при клике по кнопке
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSettingsClick();
            }}
            className={styles.settingsButton}
            variant="ghost"
            size="icon"
            title="Настройки"
            disabled={disabled}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}

        {/* Поле ввода */}
        <Textarea
          ref={combinedRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            // Resize as user types
            window.requestAnimationFrame(autoResize);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Введите сообщение..."}
          disabled={disabled}
          readOnly={readOnly}
          className={styles.textarea}
          rows={3}
        />

        {/* Кнопка отправки (стрелка вверх) */}
        <Button
          type="button"
          onMouseDown={(e) => {
            // Не забираем фокус у textarea при клике по кнопке
            e.preventDefault();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSend();
          }}
          disabled={disabled || readOnly || !message.trim()}
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

