import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import type { KeyboardEvent } from "react";
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
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

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}

interface SpeechRecognitionResultListLike {
  [index: number]: SpeechRecognitionResultLike;
  length: number;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex?: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

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

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

function syncTextareaHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  const computed = window.getComputedStyle(el);
  const minHeight = Number.parseFloat(computed.minHeight || "44") || 44;
  const maxHeight = Number.parseFloat(computed.maxHeight || "220") || 220;
  const nextHeight = Math.max(
    minHeight,
    Math.min(el.scrollHeight, maxHeight),
  );
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
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
    const [isRecording, setIsRecording] = useState(false);
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const focusSyncRafsRef = useRef<number[]>([]);
    const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
    const speechSupported = useMemo(
      () => getSpeechRecognitionCtor() !== null,
      [],
    );

    const isControlled =
      value !== undefined && typeof onValueChange === "function";
    const message = isControlled ? value : internalMessage;
    const showVoiceButton = message.length === 0;
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

    useLayoutEffect(() => {
      syncTextareaHeight(localRef.current);
    }, [message]);

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

    useEffect(() => {
      if (showVoiceButton) return;
      if (!isRecording) return;
      recognitionRef.current?.stop();
    }, [showVoiceButton, isRecording]);

    useEffect(() => {
      return () => {
        recognitionRef.current?.abort();
        recognitionRef.current = null;
      };
    }, []);

    const handleSend = () => {
      if (message.trim() && !disabled && !readOnly) {
        recognitionRef.current?.stop();
        onSend(message.trim());
        setMessage("");
        // Возвращаем фокус после отправки (после обновления родителя)
        const focusAfterSend = () =>
          focusTextareaWithoutScroll(localRef.current);
        window.setTimeout(focusAfterSend, 0);
        window.setTimeout(focusAfterSend, 100);
      }
    };

    const handleVoiceInputToggle = () => {
      if (disabled || readOnly) return;

      if (isRecording) {
        recognitionRef.current?.stop();
        return;
      }

      const RecognitionCtor = getSpeechRecognitionCtor();
      if (!RecognitionCtor) {
        toast.error("Голосовой ввод недоступен в этом браузере");
        return;
      }

      const recognition = new RecognitionCtor();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.lang =
        document.documentElement.lang?.trim() || navigator.language || "ru-RU";

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        const result = event.results?.[0]?.[0]?.transcript?.trim();
        if (!result) return;
        setMessage(result);
        window.requestAnimationFrame(() => {
          syncTextareaHeight(localRef.current);
          focusTextareaWithoutScroll(localRef.current);
        });
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error("Не удалось распознать голос. Попробуйте ещё раз.");
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      try {
        recognition.start();
      } catch {
        setIsRecording(false);
        recognitionRef.current = null;
        toast.error("Не удалось запустить голосовой ввод");
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

          {showVoiceButton && (
            <Button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleVoiceInputToggle();
              }}
              disabled={disabled || readOnly || !speechSupported}
              className={`${styles.voiceButton} ${
                isRecording ? styles.voiceButtonActive : styles.voiceButtonGlow
              }`}
              size="icon"
              title={
                speechSupported
                  ? isRecording
                    ? "Остановить надиктовку"
                    : "Надиктовать текст"
                  : "Голосовой ввод недоступен"
              }
              aria-label={
                isRecording ? "Остановить надиктовку" : "Надиктовать текст"
              }
            >
              {isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}

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
