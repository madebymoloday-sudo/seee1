import apiAgent from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2, Mic, Plus, Square } from "lucide-react";
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

interface RecordingConfig {
  extension: string;
  mimeType?: string;
}

interface TranscriptionResponse {
  text: string;
  model: string;
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

function isVoiceRecordingSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function getPreferredRecordingConfig(): RecordingConfig {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return { extension: "webm" };
  }

  const candidates: RecordingConfig[] = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "m4a" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];

  return (
    candidates.find(
      (candidate) =>
        !!candidate.mimeType && MediaRecorder.isTypeSupported(candidate.mimeType),
    ) || { extension: "webm" }
  );
}

function getExtensionFromMimeType(
  mimeType?: string,
  fallback = "webm",
): string {
  if (!mimeType) return fallback;

  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
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
    const [isTranscribing, setIsTranscribing] = useState(false);
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const focusSyncRafsRef = useRef<number[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingConfigRef = useRef<RecordingConfig | null>(null);
    const recordingSupported = useMemo(() => isVoiceRecordingSupported(), []);

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

    const clearRecorderResources = () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    };

    const applyTranscriptToInput = (transcript: string) => {
      setMessage(transcript);
      window.requestAnimationFrame(() => {
        syncTextareaHeight(localRef.current);
        focusTextareaWithoutScroll(localRef.current);
      });
    };

    const transcribeAudioBlob = async (audioBlob: Blob, mimeType?: string) => {
      const resolvedMimeType = mimeType || audioBlob.type;
      const extension = getExtensionFromMimeType(
        resolvedMimeType,
        recordingConfigRef.current?.extension || "webm",
      );
      const formData = new FormData();
      formData.append("file", audioBlob, `voice-note.${extension}`);

      setIsTranscribing(true);
      try {
        const response = await apiAgent.post<FormData, TranscriptionResponse>(
          "/psychologist/transcribe",
          formData,
        );
        const transcript = (response.text || "").trim();
        if (!transcript) {
          toast.error("Не удалось распознать речь. Попробуйте ещё раз.");
          return;
        }
        applyTranscriptToInput(transcript);
      } catch (error: unknown) {
        const apiMessage = (
          error as { response?: { data?: { message?: unknown } } }
        )?.response?.data?.message;
        const errorMessage =
          typeof apiMessage === "string" || Array.isArray(apiMessage)
            ? apiMessage
            : "Не удалось распознать голос.";
        toast.error(
          Array.isArray(errorMessage) ? errorMessage[0] : errorMessage,
        );
      } finally {
        recordingConfigRef.current = null;
        setIsTranscribing(false);
      }
    };

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
      if (!showVoiceButton && isRecording) {
        mediaRecorderRef.current?.stop();
      }
    }, [isRecording, showVoiceButton]);

    useEffect(() => {
      return () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.ondataavailable = null;
          recorder.onstop = null;
          recorder.onerror = null;
          recorder.stop();
        }
        clearRecorderResources();
      };
    }, []);

    const handleSend = () => {
      if (isRecording || isTranscribing) return;
      if (message.trim() && !disabled && !readOnly) {
        onSend(message.trim());
        setMessage("");
        const focusAfterSend = () =>
          focusTextareaWithoutScroll(localRef.current);
        window.setTimeout(focusAfterSend, 0);
        window.setTimeout(focusAfterSend, 100);
      }
    };

    const handleVoiceInputToggle = async () => {
      if (disabled || readOnly || isTranscribing) return;

      if (isRecording) {
        mediaRecorderRef.current?.stop();
        return;
      }

      if (!recordingSupported) {
        toast.error("Запись с микрофона недоступна в этом браузере");
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: true,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        const config = getPreferredRecordingConfig();
        const recorder = config.mimeType
          ? new MediaRecorder(stream, { mimeType: config.mimeType })
          : new MediaRecorder(stream);

        recordingConfigRef.current = config;
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          setIsRecording(false);
          clearRecorderResources();
          recordingConfigRef.current = null;
          toast.error("Не удалось записать аудио. Попробуйте ещё раз.");
        };

        recorder.onstart = () => {
          setIsRecording(true);
        };

        recorder.onstop = () => {
          const chunks = [...audioChunksRef.current];
          const recorderMimeType =
            recorder.mimeType || config.mimeType || "audio/webm";

          setIsRecording(false);
          clearRecorderResources();

          if (chunks.length === 0) {
            recordingConfigRef.current = null;
            toast.error("Запись получилась пустой. Попробуйте ещё раз.");
            return;
          }

          const audioBlob = new Blob(chunks, { type: recorderMimeType });
          void transcribeAudioBlob(audioBlob, recorderMimeType);
        };

        recorder.start();
      } catch (error: unknown) {
        setIsRecording(false);
        stream?.getTracks().forEach((track) => track.stop());
        clearRecorderResources();
        recordingConfigRef.current = null;

        const errorName = String((error as { name?: unknown })?.name || "");
        if (
          errorName === "NotAllowedError" ||
          errorName === "PermissionDeniedError"
        ) {
          toast.error(
            "Доступ к микрофону запрещён. Разрешите доступ и попробуйте ещё раз.",
          );
          return;
        }

        if (
          errorName === "NotFoundError" ||
          errorName === "DevicesNotFoundError"
        ) {
          toast.error("Микрофон не найден.");
          return;
        }

        toast.error("Не удалось включить микрофон. Попробуйте ещё раз.");
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const voiceButtonDisabled =
      disabled ||
      readOnly ||
      isTranscribing ||
      (!recordingSupported && !isRecording);

    return (
      <div className={styles.messageInputContainer}>
        <div className={styles.inputWrapper}>
          {onSettingsClick && (
            <Button
              type="button"
              onMouseDown={(e) => {
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
              disabled={disabled || isRecording || isTranscribing}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}

          <Textarea
            ref={combinedRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Введите сообщение..."}
            disabled={disabled}
            readOnly={readOnly || isRecording || isTranscribing}
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
                void handleVoiceInputToggle();
              }}
              disabled={voiceButtonDisabled}
              className={`${styles.voiceButton} ${
                isRecording || isTranscribing
                  ? styles.voiceButtonActive
                  : styles.voiceButtonGlow
              }`}
              size="icon"
              title={
                isTranscribing
                  ? "Распознаём голос..."
                  : recordingSupported
                    ? isRecording
                      ? "Остановить запись"
                      : "Надиктовать текст"
                    : "Голосовой ввод недоступен"
              }
              aria-label={
                isTranscribing
                  ? "Распознаём голос"
                  : isRecording
                    ? "Остановить запись"
                    : "Надиктовать текст"
              }
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}

          <Button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSend();
            }}
            disabled={
              disabled || readOnly || isRecording || isTranscribing || !message.trim()
            }
            className={styles.sendButton}
            size="icon"
            aria-label="Отправить ответ"
            title="Отправить ответ"
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
