import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { SessionResponseDto } from "@/api/schemas";
import MessageInput from "./MessageInput";
import chatStyles from "./ChatWindow.module.css";
import styles from "./StepDialogWindow.module.css";

type Subject = "situation" | "thought";

type View =
  | { kind: "core"; step: number; subject: Subject }
  | { kind: "solve"; step: number }
  | { kind: "deepPick"; fromImportant: string }
  | { kind: "addToList" };

type DialogStateV1 = {
  v: 1;
  subject: Subject;
  coreStep: number; // 1..10
  solveStep: number; // 1..7
  importantText: string; // ответ шага 4 последнего прохода core
  situationText: string; // исходная ситуация (или заголовок мысль-сессии)
};

type DialogStateV2 = Omit<DialogStateV1, "v"> & {
  v: 2;
  answers: Record<string, string>;
  deepPickReturn?: {
    coreStep: number;
    solveStep: number;
    subject: Subject;
  };
};

type DialogState = DialogStateV2;

const STORAGE_KEY_PREFIX = "seee_step_dialog_state:";
const SESSION_KIND_PREFIX = "seee_session_kind:";
const SESSION_NOTES_PREFIX = "seee_session_notes:";

function parseImportantOptions(text: string): string[] {
  const raw = (text || "")
    .split(/\r?\n|;|•|\u2022|,|—|-|\*/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^\d+[\)\.\-]\s*/, "").trim())
    .filter((s) => s.length >= 2);

  const unique: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!unique.some((x) => x.toLowerCase() === key)) unique.push(item);
    // keep a safe upper bound to avoid UI overload
    if (unique.length >= 50) break;
  }
  return unique;
}

function loadState(sessionId: string): DialogState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed: any = JSON.parse(raw);

    // v2
    if (parsed?.v === 2) {
      if (typeof parsed.coreStep !== "number" || typeof parsed.solveStep !== "number") return null;
      return parsed as DialogStateV2;
    }

    // v1 -> v2 migration
    if (parsed?.v === 1) {
      if (typeof parsed.coreStep !== "number" || typeof parsed.solveStep !== "number") return null;
      const v1 = parsed as DialogStateV1;
      const migrated: DialogStateV2 = {
        ...v1,
        v: 2,
        answers: {},
      };
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

function saveState(sessionId: string, state: DialogState) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function removeState(sessionId: string) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

function getSessionKind(sessionId: string): "thought" | "default" {
  const v = localStorage.getItem(`${SESSION_KIND_PREFIX}${sessionId}`);
  return v === "thought" ? "thought" : "default";
}

function setSessionKind(sessionId: string, kind: "thought") {
  try {
    localStorage.setItem(`${SESSION_KIND_PREFIX}${sessionId}`, kind);
  } catch {
    // ignore
  }
}

function setSessionNotes(sessionId: string, notes: string) {
  try {
    localStorage.setItem(`${SESSION_NOTES_PREFIX}${sessionId}`, notes);
  } catch {
    // ignore
  }
}

function getSessionNotes(sessionId: string): string | null {
  try {
    return localStorage.getItem(`${SESSION_NOTES_PREFIX}${sessionId}`);
  } catch {
    return null;
  }
}

function removeSessionMeta(sessionId: string) {
  try {
    localStorage.removeItem(`${SESSION_KIND_PREFIX}${sessionId}`);
    localStorage.removeItem(`${SESSION_NOTES_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserKey(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const payload = decodeJwtPayload(token);
      const sub = payload?.sub ?? payload?.id ?? payload?.userId;
      if (sub) return String(sub);
    }
  } catch {
    // ignore
  }
  return "anon";
}

function removeToExploreTemplate(userKey: string, templateId: string) {
  try {
    const key = `seee_to_explore_templates:${userKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return;
    const next = parsed.filter((x) => String(x?.id ?? "") !== templateId);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function coreQuestion(step: number, subject: Subject): string {
  const thing = subject === "thought" ? "эта мысль" : "эта ситуация";
  switch (step) {
    case 1:
      return "Расскажите, какая ситуация вас беспокоит";
    case 2:
      return `Какую эмоцию у вас вызывает ${thing}?`;
    case 3:
      return `Как вы думаете, какая мысль/идея вызывает эту эмоцию?`;
    case 4:
      return `Почему для вас это важно? Перечислите несколько вариантов.`;
    case 5:
      return `Как вы думаете, кто заразил вас этой мыслью? Это может быть человек, сообщество, вы сами, родители и прочее. Если не знаете, то так и напишите "не знаю".`;
    case 6:
      return `Как думаете, с какой эгоистичной целью эта мысль/идея была вам сказана?`;
    case 7:
      return `Какие эмоциональные последствия вы понесли из-за этой мысли?`;
    case 8:
      return `Какие физические последствия понесла за собой эта мысль?`;
    case 9:
      return `Какой вывод вы можете сделать по этой мысли? Нужна вам она или нет?`;
    case 10:
      return `Хотите ли вы решить конкретно ${subject === "thought" ? "эту мысль" : "эту ситуацию"} или готовы разобраться в вопросе глубже?`;
    default:
      return "";
  }
}

function solveQuestion(step: number, important: string): string {
  switch (step) {
    case 1:
      return "К чему вы хотели бы прийти?";
    case 2:
      return "При каких обстоятельствах это возможно?";
    case 3:
      return "Исходя из описанных обстоятельств, что можно придумать?";
    case 4:
      return "Что из этого можно сделать уже сейчас?";
    case 5:
      return "Что ещё нужно для реализации?";
    case 6:
      return "Что сделаешь прямо сейчас?";
    case 7:
      return `Так же, у вас ещё остались важные мысли, которые вы указали в ответе на вопрос: "Почему для вас это важно".\n\nВы написали:\n${important || "—"}\n\nХотели бы вы разобраться с ними сейчас или добавить их в список на поиск выхода в будущем?`;
    default:
      return "";
  }
}

function isTextAnswerView(view: View): boolean {
  if (view.kind === "addToList") return false;
  if (view.kind === "deepPick") return true;
  if (view.kind === "core") return view.step >= 1 && view.step <= 9;
  if (view.kind === "solve") return view.step >= 1 && view.step <= 6;
  return false;
}

function getPrompt(view: View, importantText: string, situationText: string): string {
  if (view.kind === "core") return coreQuestion(view.step, view.subject);
  if (view.kind === "solve") return solveQuestion(view.step, importantText);
  if (view.kind === "deepPick") {
    return `В ответе на вопрос: "Почему для вас это важно" вы написали:\n\n${view.fromImportant || importantText || "—"}\n\nКакую из этих мыслей вы хотели бы разобрать?`;
  }
  if (view.kind === "addToList") {
    return `Добавить мысль в список на будущее.\n\nСюда можно вынести мысль из ответа "Почему для вас это важно":\n${importantText || "—"}`;
  }
  return situationText;
}

function stepKey(view: View): string {
  if (view.kind === "core") return `core:${view.subject}:${view.step}`;
  if (view.kind === "solve") return `solve:${view.step}`;
  if (view.kind === "deepPick") return `deepPick`;
  return "other";
}

interface StepDialogWindowProps {
  session: SessionResponseDto;
}

const StepDialogWindow = observer(({ session }: StepDialogWindowProps) => {
  const navigate = useNavigate();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const isDraftSession = session.id === "new";

  const [state, setState] = useState<DialogState>(() => {
    const existing = loadState(session.id);
    if (existing) return existing;

    const kind = getSessionKind(session.id);
    const isThought = kind === "thought";
    const situationText = isThought ? (session.title || "Новая сессия") : "";
    return {
      v: 2,
      subject: isThought ? "thought" : "situation",
      coreStep: isThought ? 2 : 1,
      solveStep: 1,
      importantText: "",
      situationText,
      answers: {},
    };
  });

  useEffect(() => {
    saveState(session.id, state);
  }, [session.id, state]);

  const view: View = useMemo(() => {
    // Модальные режимы
    if (state.coreStep === 0) return { kind: "addToList" };
    if (state.coreStep === 99) return { kind: "deepPick", fromImportant: state.importantText };

    // Решение
    if (state.subject === "situation" && state.solveStep >= 1 && state.solveStep <= 7 && state.coreStep === 100) {
      return { kind: "solve", step: state.solveStep };
    }

    // Основной цикл
    return { kind: "core", step: state.coreStep, subject: state.subject };
  }, [state]);

  const prompt = useMemo(
    () => getPrompt(view, state.importantText, state.situationText),
    [view, state.importantText, state.situationText]
  );

  const importantOptions = useMemo(() => {
    if (view.kind !== "deepPick") return [];
    const text =
      view.fromImportant ||
      state.answers["core:situation:4"] ||
      state.answers["core:thought:4"] ||
      state.importantText ||
      "";
    return parseImportantOptions(text);
  }, [view, state.answers, state.importantText]);

  const importantTextForDeep = useMemo(() => {
    return (
      state.answers["core:situation:4"] ||
      state.answers["core:thought:4"] ||
      state.importantText ||
      ""
    );
  }, [state.answers, state.importantText]);

  const [lastUserAnswer, setLastUserAnswer] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [listTitle, setListTitle] = useState("");
  const [listNotes, setListNotes] = useState("");
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const timersRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const canDeepNow = useMemo(() => {
    // button should be available during the session after step 4 is answered at least once
    if (isTransitioning || isListModalOpen) return false;
    if (view.kind === "deepPick") return false;
    return parseImportantOptions(importantTextForDeep).length > 0;
  }, [importantTextForDeep, isListModalOpen, isTransitioning, view.kind]);

  useEffect(() => {
    if (!isListModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsListModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isListModalOpen]);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  // Автофокус на поле ввода после смены шага/ветки
  useEffect(() => {
    if (isListModalOpen) return;
    if (isTransitioning) return;
    if (!isTextAnswerView(view)) return;

    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isListModalOpen,
    isTransitioning,
    view.kind,
    view.kind === "core" ? view.step : null,
    view.kind === "solve" ? view.step : null,
    view.kind === "deepPick" ? view.fromImportant : null,
  ]);

  // Sync input with saved answer (review mode on revisit)
  useEffect(() => {
    if (!isTextAnswerView(view)) {
      setInputText("");
      setIsEditing(false);
      return;
    }
    const key = stepKey(view);
    const saved = state.answers[key];
    if (saved !== undefined) {
      setInputText(saved);
      setIsEditing(false);
    } else {
      setInputText("");
      setIsEditing(true);
    }
  }, [state.answers, view]);

  const computeNextState = (answer: string): DialogState | null => {
    const trimmed = answer.trim();
    if (!trimmed) return null;

    // deepPick
    if (view.kind === "deepPick") {
      return {
        ...state,
        subject: "thought",
        situationText: trimmed,
        coreStep: 2,
        deepPickReturn: undefined,
      };
    }

    // core 1..9
    if (view.kind === "core") {
      const next = view.step + 1;

      if (view.step === 1) {
        return { ...state, situationText: trimmed, coreStep: next };
      }
      if (view.step === 4) {
        return { ...state, importantText: trimmed, coreStep: next };
      }

      return { ...state, coreStep: next };
    }

    // solve 1..6
    if (view.kind === "solve") {
      const next = view.step + 1;
      return { ...state, solveStep: next };
    }

    return null;
  };

  const onAnswer = async (answer: string) => {
    if (isTransitioning) return;
    const nextState = computeNextState(answer);
    if (!nextState) return;

    const key = stepKey(view);
    const trimmed = answer.trim();
    const nextStateWithAnswer: DialogState = {
      ...(nextState as any),
      v: 2,
      answers: { ...(state.answers || {}), [key]: trimmed },
    };

    // Черновик: создаём сессию только после ответа на ПЕРВЫЙ вопрос (core step 1).
    if (isDraftSession && view.kind === "core" && view.step === 1) {
      setLastUserAnswer(trimmed);
      setIsTransitioning(true);
      setIsFadingOut(false);

      try {
        const userKey = getUserKey();
        const draftTitle = localStorage.getItem(`seee_draft_title:${userKey}`)?.trim();
        const templateId = localStorage.getItem(`seee_draft_to_explore_template:${userKey}`)?.trim();

        const title = (draftTitle && draftTitle.length > 0 ? draftTitle : trimmed).slice(0, 80);
        const newSession = await createSession({ title });
        if (!newSession?.id) {
          toast.error("Не удалось создать сессию");
          setIsTransitioning(false);
          return;
        }

        // переносим состояние диалога и метаданные с draft-id на реальный id
        saveState(newSession.id, nextStateWithAnswer);

        const kind = getSessionKind(session.id);
        if (kind === "thought") {
          setSessionKind(newSession.id, "thought");
        }
        const notes = getSessionNotes(session.id);
        if (notes && notes.trim()) {
          setSessionNotes(newSession.id, notes.trim());
        }

        removeState(session.id);
        removeSessionMeta(session.id);

        if (templateId) {
          removeToExploreTemplate(userKey, templateId);
        }
        try {
          localStorage.removeItem(`seee_draft_title:${userKey}`);
          localStorage.removeItem(`seee_draft_to_explore_template:${userKey}`);
        } catch {
          // ignore
        }

        navigate(`/sessions/${newSession.id}`, { replace: true });
      } catch (e) {
        console.error(e);
        toast.error("Не удалось создать сессию");
        setIsTransitioning(false);
      }
      return;
    }

    // Показать ответ и плавно убрать пару (вопрос+ответ), затем показать следующий вопрос
    setLastUserAnswer(trimmed);
    setIsTransitioning(true);
    setIsFadingOut(false);

    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];

    timersRef.current.push(
      window.setTimeout(() => setIsFadingOut(true), 250),
      window.setTimeout(() => {
        setState(nextStateWithAnswer);
        setLastUserAnswer(null);
        setIsFadingOut(false);
        setIsTransitioning(false);
        // for the next step we'll switch to edit/review depending on saved answer (effect)
      }, 850)
    );
  };

  const goDeepPick = () => {
    setState((s) => ({
      ...s,
      // make sure we use the latest stored answer
      importantText:
        s.answers["core:situation:4"] ||
        s.answers["core:thought:4"] ||
        s.importantText ||
        "",
      deepPickReturn: { coreStep: s.coreStep, solveStep: s.solveStep, subject: s.subject },
      coreStep: 99, // pseudo-step for deepPick
    }));
  };

  const goSolve = () => {
    setState((s) => ({ ...s, coreStep: 100, solveStep: 1, subject: "situation" }));
  };

  const openAddToList = () => {
    setIsListModalOpen(true);
    setListTitle("");
    setListNotes("");
  };

  const submitAddToList = async () => {
    const title = listTitle.trim();
    if (!title) {
      toast.error("Введите название мысли");
      return;
    }

    try {
      const newSession = await createSession({ title });
      if (!newSession?.id) {
        toast.error("Не удалось создать сессию");
        return;
      }

      setSessionKind(newSession.id, "thought");
      if (listNotes.trim()) {
        setSessionNotes(newSession.id, listNotes.trim());
      }

      toast.success("Мысль добавлена в список сессий");
      setIsListModalOpen(false);
      navigate("/sessions/list");
    } catch (e) {
      console.error(e);
      toast.error("Не удалось добавить мысль");
    }
  };

  const showCoreChoice = view.kind === "core" && view.step === 10;
  const showSolveChoice = view.kind === "solve" && view.step === 7;

  const canGoBack = (() => {
    if (isTransitioning || isListModalOpen) return false;
    if (view.kind === "deepPick") return true;
    if (view.kind === "solve") return true;
    if (view.kind === "core") {
      const min = view.subject === "thought" ? 2 : 1;
      return view.step > min;
    }
    return false;
  })();

  const goBack = () => {
    if (!canGoBack) return;
    if (view.kind === "deepPick") {
      setState((s) => {
        if (s.deepPickReturn) {
          return {
            ...s,
            coreStep: s.deepPickReturn.coreStep,
            solveStep: s.deepPickReturn.solveStep,
            subject: s.deepPickReturn.subject,
            deepPickReturn: undefined,
          };
        }
        return { ...s, coreStep: 10, deepPickReturn: undefined };
      });
      return;
    }
    if (view.kind === "solve") {
      setState((s) => {
        if (s.solveStep > 1) return { ...s, solveStep: s.solveStep - 1 };
        // back to the core choice step
        return { ...s, coreStep: 10, solveStep: 1, subject: "situation" };
      });
      return;
    }
    if (view.kind === "core") {
      const min = view.subject === "thought" ? 2 : 1;
      setState((s) => ({ ...s, coreStep: Math.max(min, s.coreStep - 1) }));
    }
  };

  return (
    <div className={styles.wizardWindow}>
      <div className={styles.stage}>
        <div
          className={`${chatStyles.messageWrapper} ${chatStyles.visible} ${
            isFadingOut ? chatStyles.fadeOut : ""
          }`}
        >
          <div className={`${chatStyles.message} ${chatStyles.assistantMessage}`}>
            <p className={chatStyles.messageContent}>{prompt}</p>
          </div>
        </div>

        {canGoBack && (
          <div
            className={`${chatStyles.messageWrapper} ${chatStyles.visible} ${
              isFadingOut ? chatStyles.fadeOut : ""
            }`}
            style={{ justifyContent: "flex-end", marginTop: "-0.75rem" }}
          >
            <div
              className={`${chatStyles.message} ${chatStyles.assistantMessage}`}
              style={{
                width: "auto",
                maxWidth: 260,
                padding: "0.75rem 1rem",
                borderRadius: "999px",
              }}
            >
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack || isTransitioning}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: isTransitioning ? "not-allowed" : "pointer",
                  opacity: isTransitioning ? 0.6 : 1,
                }}
                className={chatStyles.messageContent}
                aria-label="Назад"
                title="Назад"
              >
                ← Назад
              </button>
            </div>
          </div>
        )}

        {lastUserAnswer && (
          <div
            className={`${chatStyles.messageWrapper} ${chatStyles.visible} ${
              isFadingOut ? chatStyles.fadeOut : ""
            }`}
          >
            <div className={`${chatStyles.message} ${chatStyles.userMessage}`}>
              <p className={chatStyles.messageContent}>{lastUserAnswer}</p>
            </div>
          </div>
        )}

        {(state.situationText || view.kind === "core") && view.kind === "core" && view.step === 1 && (
          <p className={styles.helperText}>
            Напишите ответ ниже. После каждого ответа вы увидите следующий вопрос.
          </p>
        )}

        {view.kind === "deepPick" && importantOptions.length > 0 && (
          <div className={styles.choiceRow}>
            {importantOptions.map((opt) => (
              <Button
                key={opt}
                className={`${styles.choiceButton} ${chatStyles.glassButton}`}
                variant="outline"
                onClick={() => onAnswer(opt)}
                disabled={isTransitioning}
              >
                {opt}
              </Button>
            ))}
          </div>
        )}

        {showCoreChoice && (
          <div className={styles.choiceRow}>
            <Button className={`${styles.choiceButton} ${chatStyles.glassButton}`} onClick={goSolve}>
              Решить ситуацию
            </Button>
            <Button className={`${styles.choiceButton} ${chatStyles.glassButton}`} variant="outline" onClick={goDeepPick}>
              Разобраться глубже
            </Button>
          </div>
        )}

        {showSolveChoice && (
          <div className={styles.choiceRow}>
            <Button className={`${styles.choiceButton} ${chatStyles.glassButton}`} variant="outline" onClick={goDeepPick}>
              Разобраться глубже
            </Button>
            <Button className={`${styles.choiceButton} ${chatStyles.glassButton}`} onClick={openAddToList}>
              Добавить в список
            </Button>
          </div>
        )}
      </div>

      {/* Кнопки управления (назад/редактирование) */}
      {isTextAnswerView(view) && (
        <div className="flex justify-center gap-2 flex-wrap px-4 pb-3">
          {canDeepNow && (
            <Button
              type="button"
              variant="outline"
              onClick={goDeepPick}
              disabled={isTransitioning || isListModalOpen}
              className={chatStyles.glassButton}
              title='Показать идеи из ответа "Почему это важно"'
            >
              Глубже
            </Button>
          )}
          {!isEditing && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditing(true);
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className={chatStyles.glassButton}
              >
                Отредактировать
              </Button>
              <Button onClick={() => onAnswer(inputText)} disabled={!inputText.trim()} className={chatStyles.glassButton}>
                Дальше
              </Button>
            </>
          )}
        </div>
      )}

      {/* Ввод ответа (только там, где нужен текст) */}
      {isTextAnswerView(view) && (
        <div style={{ position: "relative" }}>
          <MessageInput
            ref={inputRef}
            onSend={(v) => {
              if (!isEditing) return;
              onAnswer(v);
            }}
            disabled={isMutating}
            readOnly={isMutating || isTransitioning || !isEditing}
            placeholder="Введите ответ..."
            autoFocus
            value={inputText}
            onValueChange={setInputText}
          />
        </div>
      )}

      {/* Модалка 'Добавить в список' */}
      {isListModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsListModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Добавить мысль в список</h3>
            <div className={styles.modalBody}>
              <Input
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="А) Как называется мысль?"
              />
              <Textarea
                value={listNotes}
                onChange={(e) => setListNotes(e.target.value)}
                placeholder="Б) Примечания"
                rows={4}
              />
              <p className={styles.modalHint}>
                Эта мысль на разбор появится у вас в списке сессий.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setIsListModalOpen(false)} className={chatStyles.glassButton}>
                Отмена
              </Button>
              <Button onClick={submitAddToList} disabled={isMutating} className={chatStyles.glassButton}>
                Отправить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default StepDialogWindow;

