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
    if (unique.length >= 8) break;
  }
  return unique;
}

function loadState(sessionId: string): DialogStateV1 | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DialogStateV1>;
    if (parsed?.v !== 1) return null;
    // минимальная валидация
    if (typeof parsed.coreStep !== "number" || typeof parsed.solveStep !== "number") return null;
    return parsed as DialogStateV1;
  } catch {
    return null;
  }
}

function saveState(sessionId: string, state: DialogStateV1) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify(state));
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

interface StepDialogWindowProps {
  session: SessionResponseDto;
}

const StepDialogWindow = observer(({ session }: StepDialogWindowProps) => {
  const navigate = useNavigate();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();

  const [state, setState] = useState<DialogStateV1>(() => {
    const existing = loadState(session.id);
    if (existing) return existing;

    const kind = getSessionKind(session.id);
    const isThought = kind === "thought";
    const situationText = isThought ? (session.title || "Новая сессия") : "";
    return {
      v: 1,
      subject: isThought ? "thought" : "situation",
      coreStep: isThought ? 2 : 1,
      solveStep: 1,
      importantText: "",
      situationText,
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
    return parseImportantOptions(state.importantText);
  }, [view, state.importantText]);

  const [lastUserAnswer, setLastUserAnswer] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const timersRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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

  const [listTitle, setListTitle] = useState("");
  const [listNotes, setListNotes] = useState("");
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const computeNextState = (answer: string): DialogStateV1 | null => {
    const trimmed = answer.trim();
    if (!trimmed) return null;

    // deepPick
    if (view.kind === "deepPick") {
      return {
        ...state,
        subject: "thought",
        situationText: trimmed,
        coreStep: 2,
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

  const onAnswer = (answer: string) => {
    if (isTransitioning) return;
    const nextState = computeNextState(answer);
    if (!nextState) return;

    // Показать ответ и плавно убрать пару (вопрос+ответ), затем показать следующий вопрос
    setLastUserAnswer(answer.trim());
    setIsTransitioning(true);
    setIsFadingOut(false);

    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];

    timersRef.current.push(
      window.setTimeout(() => setIsFadingOut(true), 250),
      window.setTimeout(() => {
        setState(nextState);
        setLastUserAnswer(null);
        setIsFadingOut(false);
        setIsTransitioning(false);
      }, 850)
    );
  };

  const goDeepPick = () => {
    setState((s) => ({ ...s, coreStep: 99 })); // pseudo-step for deepPick
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
      navigate("/sessions");
    } catch (e) {
      console.error(e);
      toast.error("Не удалось добавить мысль");
    }
  };

  const showCoreChoice = view.kind === "core" && view.step === 10;
  const showSolveChoice = view.kind === "solve" && view.step === 7;

  return (
    <div className={chatStyles.chatWindow}>
      <div className={chatStyles.messagesContainer}>
        <div
          className={`${chatStyles.messageWrapper} ${chatStyles.visible} ${
            isFadingOut ? chatStyles.fadeOut : ""
          }`}
        >
          <div className={`${chatStyles.message} ${chatStyles.assistantMessage}`}>
            <p className={chatStyles.messageContent}>{prompt}</p>
          </div>
        </div>

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
                className={styles.choiceButton}
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
            <Button className={styles.choiceButton} onClick={goSolve}>
              Решить ситуацию
            </Button>
            <Button className={styles.choiceButton} variant="outline" onClick={goDeepPick}>
              Разобраться глубже
            </Button>
          </div>
        )}

        {showSolveChoice && (
          <div className={styles.choiceRow}>
            <Button className={styles.choiceButton} variant="outline" onClick={goDeepPick}>
              Разобраться глубже
            </Button>
            <Button className={styles.choiceButton} onClick={openAddToList}>
              Добавить в список
            </Button>
          </div>
        )}
      </div>

      {/* Ввод ответа (только там, где нужен текст) */}
      {isTextAnswerView(view) && (
        <div style={{ position: "relative" }}>
          <MessageInput
            ref={inputRef}
            onSend={onAnswer}
            disabled={isMutating || isTransitioning}
            placeholder="Введите ответ..."
            autoFocus
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
              <Button variant="outline" onClick={() => setIsListModalOpen(false)}>
                Отмена
              </Button>
              <Button onClick={submitAddToList} disabled={isMutating}>
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

