import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import apiAgent from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import styles from "./PauseSessionModal.module.css";

interface PauseSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

const PAUSE_FEEDBACK_DRAFT_PREFIX = "seee_pause_feedback_draft:";

type PauseFeedbackAnswers = {
  situation: string;
  emotion: string;
  thoughts: string;
  nextTopics: string;
  overall: string;
};

function buildPauseDraftKey(sessionId: string) {
  return `${PAUSE_FEEDBACK_DRAFT_PREFIX}${sessionId}`;
}

const PauseSessionModal = ({ isOpen, onClose, sessionId }: PauseSessionModalProps) => {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<PauseFeedbackAnswers>({
    situation: "",
    emotion: "",
    thoughts: "",
    nextTopics: "",
    overall: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const draftKey = buildPauseDraftKey(sessionId);

    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PauseFeedbackAnswers>;
        setAnswers({
          situation: String(parsed?.situation ?? ""),
          emotion: String(parsed?.emotion ?? ""),
          thoughts: String(parsed?.thoughts ?? ""),
          nextTopics: String(parsed?.nextTopics ?? ""),
          overall: String(parsed?.overall ?? ""),
        });
      }
    } catch {
      // ignore
    }

    // Close mobile keyboard and lock background scroll (prevents iOS modal jumping)
    try {
      const el = document.activeElement;
      if (el && el instanceof HTMLElement) el.blur();
    } catch {
      // ignore
    }

    const prevBody = {
      overflow: document.body.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    const prevHtml = {
      overflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "contain";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevBody.overflow;
      document.body.style.overscrollBehavior = prevBody.overscrollBehavior;
      document.documentElement.style.overflow = prevHtml.overflow;
      document.documentElement.style.overscrollBehavior =
        prevHtml.overscrollBehavior;
    };
  }, [isOpen, onClose, sessionId]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(buildPauseDraftKey(sessionId), JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers, isOpen, sessionId]);

  if (!isOpen) return null;

  const handleChange = (field: keyof typeof answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Проверяем, что все поля заполнены
    if (!answers.situation || !answers.emotion || !answers.thoughts || !answers.nextTopics || !answers.overall) {
      toast.error("Пожалуйста, заполните все поля");
      return;
    }

    setIsSubmitting(true);

    try {
      const description = [
        "Тип: Приостановка сессии",
        `а) Какую ситуацию разбирали? ${answers.situation}`,
        `б) Какую эмоцию сейчас испытываете? ${answers.emotion}`,
        `в) Какие интересные мысли вы вынесли из этой сессии? ${answers.thoughts}`,
        `г) Что ещё хотели бы разобрать после этой сессии? ${answers.nextTopics}`,
        `д) В целом, как проходила эта сессия? ${answers.overall}`,
      ].join("\n");

      // Сохраняем обратную связь (привязываем к текущей сессии)
      await apiAgent.post("/feedback", {
        sessionId,
        title: "Обратная связь после сессии",
        description,
        emotionAfter: answers.emotion.trim(),
        feedbackType: "FULL",
      });

      try {
        localStorage.removeItem(buildPauseDraftKey(sessionId));
      } catch {
        // ignore
      }

      toast.success("Разбор завершён");

      // Не создаём пустую сессию автоматически — отправляем в черновик.
      navigate("/sessions/new");

      onClose();
    } catch (error: any) {
      console.error("Ошибка сохранения обратной связи:", error);
      toast.error(error.response?.data?.message || "Ошибка сохранения обратной связи");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Завершить разбор</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.recommendation}>
            Чтобы завершить разбор, зафиксируйте короткую обратную связь по этой сессии. После
            этого карточка будет считаться закрытой.
          </p>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>
                а) Какую ситуацию разбирали?
              </label>
              <Textarea
                value={answers.situation}
                onChange={(e) => handleChange("situation", e.target.value)}
                placeholder="Опишите ситуацию..."
                rows={3}
                className={styles.textarea}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                б) Какую эмоцию сейчас испытываете?
              </label>
              <Textarea
                value={answers.emotion}
                onChange={(e) => handleChange("emotion", e.target.value)}
                placeholder="Опишите ваши эмоции..."
                rows={3}
                className={styles.textarea}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                в) Какие интересные мысли вы вынесли из этой сессии?
              </label>
              <Textarea
                value={answers.thoughts}
                onChange={(e) => handleChange("thoughts", e.target.value)}
                placeholder="Поделитесь своими мыслями..."
                rows={3}
                className={styles.textarea}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                г) Что ещё хотели бы разобрать после этой сессии?
              </label>
              <Textarea
                value={answers.nextTopics}
                onChange={(e) => handleChange("nextTopics", e.target.value)}
                placeholder="Что бы вы хотели обсудить дальше?"
                rows={3}
                className={styles.textarea}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                д) В целом, как проходила эта сессия?
              </label>
              <Textarea
                value={answers.overall}
                onChange={(e) => handleChange("overall", e.target.value)}
                placeholder="Ваша общая оценка сессии..."
                rows={3}
                className={styles.textarea}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              onClick={onClose}
              variant="outline"
              className={styles.cancelButton}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={styles.submitButton}
            >
              {isSubmitting ? "Сохранение..." : "Разбор завершён"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PauseSessionModal;
