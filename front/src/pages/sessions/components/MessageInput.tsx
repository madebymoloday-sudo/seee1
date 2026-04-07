import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Plus } from "lucide-react";
import type { KeyboardEvent } from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
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

function focusTextareaWithoutScroll(el: HTMLTextAreaElement | null) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function keepCurrentQuestionVisible(el: HTMLTextAreaElement | null) {
  if (!el) return;

  const chatRoot = el.closest('[data-chat-root="true"]');
  const currentQuestion = chatRoot?.querySelector<HTMLElement>(
    '[data-chat-current-question="true"]',
  );
  const scrollContainer = chatRoot?.querySelector<HTMLElement>(
    '[data-chat-scroll-container="true"]',
  );

  if (currentQuestion) {
    currentQuestion.scrollIntoView({
      block: "start",
      inline: "nearest",
    });
    return;
  }

  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
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
    forwardedRef,
  ) => {
    const [internalMessage, setInternalMessage] = useState("");
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const focusSyncRafsRef = useRef<number[]>([]);

    const isControlled =
      value !== undefined && typeof onValueChange === "function";
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
      const t = window.setTimeout(
        () => focusTextareaWithoutScroll(localRef.current),
        0,
      );
      return () => window.clearTimeout(t);
    }, [autoFocus, disabled]);

    useEffect(() => {
      const el = localRef.current;
      if (!el) return;

      const clearFocusSyncFrames = () => {
        focusSyncRafsRef.current.forEach((frameId) =>
          window.cancelAnimationFrame(frameId),
        );
        focusSyncRafsRef.current = [];
      };

      const scheduleFocusSync = () => {
        clearFocusSyncFrames();

        const syncNow = () => {
          keepCurrentQuestionVisible(localRef.current);
        };

        syncNow();
        focusSyncRafsRef.current.push(window.requestAnimationFrame(syncNow));
        focusSyncRafsRef.current.push(
          window.requestAnimationFrame(() => {
            focusSyncRafsRef.current.push(window.requestAnimationFrame(syncNow));
          }),
        );
      };

      const onFocus = () => {
        scheduleFocusSync();
      };
      const onBlur = () => {
        clearFocusSyncFrames();
      };

      const visualViewport = window.visualViewport;
      const syncOnViewportChange = () => {
        if (document.activeElement === el) {
          scheduleFocusSync();
        }
      };

      el.addEventListener("focus", onFocus);
      el.addEventListener("blur", onBlur);
      visualViewport?.addEventListener("resize", syncOnViewportChange);
      visualViewport?.addEventListener("scroll", syncOnViewportChange);

      return () => {
        el.removeEventListener("focus", onFocus);
        el.removeEventListener("blur", onBlur);
        visualViewport?.removeEventListener("resize", syncOnViewportChange);
        visualViewport?.removeEventListener("scroll", syncOnViewportChange);
        clearFocusSyncFrames();
      };
    }, []);

    const handleSend = () => {
      if (message.trim() && !disabled && !readOnly) {
        onSend(message.trim());
        setMessage("");
        // Возвращаем фокус после отправки (после обновления родителя)
        const focusAfterSend = () =>
          focusTextareaWithoutScroll(localRef.current);
        window.setTimeout(focusAfterSend, 0);
        window.setTimeout(focusAfterSend, 100);
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
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Введите сообщение..."}
            disabled={disabled}
            readOnly={readOnly}
            className={styles.textarea}
            rows={1}
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
  },
);

MessageInput.displayName = "MessageInput";

export default MessageInput;
