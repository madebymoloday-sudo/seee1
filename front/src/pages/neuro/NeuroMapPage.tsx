import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import apiAgent from "@/lib/api";
import {
  useEventMapControllerCreateEventMap,
  useEventMapControllerGetEventMap,
  useSessionsControllerCreateSession,
} from "@/api/seee.swr";
import MessageInput from "@/pages/sessions/components/MessageInput";
import chatStyles from "@/pages/sessions/components/ChatWindow.module.css";
import { mutate } from "swr";

type EmotionEntry = {
  id: string;
  emotion: string;
  thought: string | null; // null = "не могу ответить"
  sessionId?: string; // session created in "Моя коллекция" for this thought
};

type SituationEntry = {
  id: string;
  situation: string;
  emotions: EmotionEntry[];
};

type Cursor =
  | { kind: "situation" }
  | { kind: "emotionInput"; editingEmotionIndex?: number }
  | { kind: "emotionActions"; emotionIndex: number }
  | { kind: "thought"; emotionIndex: number }
  | { kind: "summary" };

type DraftV1 = {
  v: 1;
  situationIndex: number;
  cursor: Cursor;
  situations: SituationEntry[];
};

type HistorySnapshot = {
  draft: DraftV1;
  inputText: string;
  hint: string | null;
  notice: string | null;
};

const STORAGE_KEY = "seee_neuromap_draft_v1";
const SESSION_KIND_PREFIX = "seee_session_kind:";

function setSessionKind(sessionId: string, kind: "thought") {
  try {
    localStorage.setItem(`${SESSION_KIND_PREFIX}${sessionId}`, kind);
  } catch {
    // ignore
  }
}

function uid(): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cloneDraft(draft: DraftV1): DraftV1 {
  return JSON.parse(JSON.stringify(draft)) as DraftV1;
}

function loadDraft(): DraftV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftV1>;
    if (parsed.v !== 1) return null;
    if (!Array.isArray(parsed.situations) || parsed.situations.length === 0)
      return null;
    if (typeof parsed.situationIndex !== "number") return null;
    if (!parsed.cursor || typeof (parsed.cursor as any).kind !== "string")
      return null;
    return parsed as DraftV1;
  } catch {
    return null;
  }
}

function defaultDraft(): DraftV1 {
  return {
    v: 1,
    situationIndex: 0,
    cursor: { kind: "situation" },
    situations: [
      {
        id: uid(),
        situation: "",
        emotions: [],
      },
    ],
  };
}

function isTextStage(cursor: Cursor): cursor is Extract<
  Cursor,
  { kind: "situation" | "emotionInput" | "thought" }
> {
  return (
    cursor.kind === "situation" ||
    cursor.kind === "emotionInput" ||
    cursor.kind === "thought"
  );
}

function getPrompt(draft: DraftV1, hint: string | null, notice: string | null): string {
  const s = draft.situations[draft.situationIndex];
  const cursor = draft.cursor;

  const base = (() => {
    if (cursor.kind === "situation") {
      return (
        "Здравствуйте, перед тем как начать пользоваться нашим приложением Seee по работе с мышлением, расскажите, какая негативная ситуация у вас в жизни происходит и беспокоит?\n\n" +
        "Запишем каждую ситуацию по-отдельности, так что пока что опишите первую ситуацию, которая вас беспокоит больше всего. Писать можно буквально любую ситуацию, я помогу со всеми."
      );
    }

    if (cursor.kind === "emotionInput") {
      // Первая или следующая эмоция
      if (s.emotions.length === 0 && cursor.editingEmotionIndex === undefined) {
        return (
          "Хорошо, спасибо, что поделились тем что у вас происходит, расскажите, какие эмоции у вас вызывает эта ситуация?\n\n" +
          "Присылайте каждую из эмоций по отдельности — в рамках моего подхода важно перечислить каждую эмоцию!"
        );
      }
      return "Какую ещё эмоцию вызывает ситуация? Важно перечислить каждую из них.";
    }

    if (cursor.kind === "emotionActions") {
      const emotion = s.emotions[cursor.emotionIndex]?.emotion || "—";
      return `Записал эмоцию: "${emotion}". Хотите добавить ещё одну эмоцию или идём дальше?`;
    }

    if (cursor.kind === "thought") {
      const emotion = s.emotions[cursor.emotionIndex]?.emotion || "—";
      return `Хорошо, вы написали, что испытываете "${emotion}". Попробуйте описать, какая мысль вызывает у вас это чувство?`;
    }

    // summary
    return "Отлично. Я записал(а) ситуацию, эмоции и мысли в нейрокарту. Хотите добавить ещё одну ситуацию или записать эту ситуацию в вашу нейрокарту?";
  })();

  const parts = [base];
  if (notice) parts.push(`\n\n${notice}`);
  if (hint) parts.push(`\n\n${hint}`);
  return parts.join("");
}

const NeuroMapPage = observer(() => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");

  const [draft, setDraft] = useState<DraftV1>(() => loadDraft() ?? defaultDraft());

  const currentSituation = draft.situations[draft.situationIndex];

  const { data: existingMap } = useEventMapControllerGetEventMap();
  const { trigger: createEventMap, isMutating: isSaving } =
    useEventMapControllerCreateEventMap();
  const { trigger: createSession } = useSessionsControllerCreateSession();

  const prompt = useMemo(() => getPrompt(draft, hint, notice), [draft, hint, notice]);

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  // Autofocus when we need text input
  useEffect(() => {
    if (!isTextStage(draft.cursor)) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [
    draft.cursor.kind,
    draft.situationIndex,
    draft.cursor.kind === "thought" ? draft.cursor.emotionIndex : null,
    draft.cursor.kind === "emotionInput" ? draft.cursor.editingEmotionIndex : null,
  ]);

  // Keep inputText in sync when entering edit/back stages
  useEffect(() => {
    const c = draft.cursor;
    const s = draft.situations[draft.situationIndex];

    if (c.kind === "situation") {
      setInputText(s.situation || "");
      return;
    }

    if (c.kind === "emotionInput") {
      if (typeof c.editingEmotionIndex === "number") {
        setInputText(s.emotions[c.editingEmotionIndex]?.emotion || "");
      } else {
        setInputText("");
      }
      return;
    }

    if (c.kind === "thought") {
      setInputText(s.emotions[c.emotionIndex]?.thought || "");
      return;
    }

    setInputText("");
  }, [draft.cursor, draft.situationIndex, draft.situations]);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      { draft: cloneDraft(draft), inputText, hint, notice },
    ]);
  }, [draft, hint, inputText, notice]);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      setDraft(last.draft);
      setInputText(last.inputText);
      setHint(last.hint);
      setNotice(last.notice);
      return prev.slice(0, -1);
    });
  }, []);

  const ensureSituationExists = useCallback(
    (index: number) => {
      setDraft((prev) => {
        if (prev.situations[index]) return prev;
        const next = cloneDraft(prev);
        next.situations[index] = { id: uid(), situation: "", emotions: [] };
        return next;
      });
    },
    []
  );

  const onSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const draftSnapshot = cloneDraft(draft);

      const c = draft.cursor;
      const sIdx = draft.situationIndex;

      setHint(null);
      setNotice(null);

      if (c.kind === "situation") {
        pushHistory();
        ensureSituationExists(sIdx);
        setDraft((prev) => {
          const next = cloneDraft(prev);
          next.situations[sIdx].situation = trimmed;
          next.cursor = { kind: "emotionInput" };
          return next;
        });
        return;
      }

      if (c.kind === "emotionInput") {
        pushHistory();
        setDraft((prev) => {
          const next = cloneDraft(prev);
          const s = next.situations[sIdx];
          const editIdx = c.editingEmotionIndex;
          if (typeof editIdx === "number" && s.emotions[editIdx]) {
            s.emotions[editIdx].emotion = trimmed;
            // При редактировании мысль оставляем как есть
            next.cursor = { kind: "emotionActions", emotionIndex: editIdx };
          } else {
            const newIdx = s.emotions.length;
            s.emotions.push({ id: uid(), emotion: trimmed, thought: "" });
            next.cursor = { kind: "emotionActions", emotionIndex: newIdx };
          }
          return next;
        });
        return;
      }

      if (c.kind === "thought") {
        pushHistory();
        const currentEmotionIndex = c.emotionIndex;

        setDraft((prev) => {
          const next = cloneDraft(prev);
          const s = next.situations[sIdx];
          const e = s.emotions[currentEmotionIndex];
          if (e) e.thought = trimmed;

          const nextEmotionIndex = currentEmotionIndex + 1;
          if (nextEmotionIndex < s.emotions.length) {
            next.cursor = { kind: "thought", emotionIndex: nextEmotionIndex };
          } else {
            next.cursor = { kind: "summary" };
          }
          return next;
        });

        // Create/Update a "thought session" in My Collection for this thought
        (async () => {
          try {
            const s = draftSnapshot.situations[sIdx];
            const e = s.emotions[currentEmotionIndex];
            if (!e) return;
            if (!trimmed) return;

            if (!e.sessionId) {
              const newSession = await createSession({ title: trimmed });
              if (!newSession?.id) return;

              setSessionKind(newSession.id, "thought");
              await mutate(`/api/v1/sessions`);

              setDraft((prev) => {
                const next = cloneDraft(prev);
                const ee =
                  next.situations[sIdx]?.emotions?.[currentEmotionIndex];
                if (ee && !ee.sessionId) ee.sessionId = newSession.id;
                return next;
              });
            } else {
              // If user edited the thought (via back), update the session title
              await apiAgent.patch(`/sessions/${e.sessionId}`, { title: trimmed });
              await mutate(`/api/v1/sessions`);
            }
          } catch {
            // non-blocking
          }
        })();

        return;
      }
    },
    [createSession, draft, ensureSituationExists, pushHistory]
  );

  const onAddEmotion = useCallback(() => {
    if (draft.cursor.kind !== "emotionActions") return;
    pushHistory();
    setHint(null);
    setNotice(null);
    setDraft((prev) => ({ ...prev, cursor: { kind: "emotionInput" } }));
  }, [draft.cursor.kind, pushHistory]);

  const onGoToThoughts = useCallback(() => {
    const s = draft.situations[draft.situationIndex];
    if (s.emotions.length === 0) {
      toast.error("Сначала добавьте хотя бы одну эмоцию");
      return;
    }
    pushHistory();
    setHint(null);
    setNotice(null);
    setDraft((prev) => ({ ...prev, cursor: { kind: "thought", emotionIndex: 0 } }));
  }, [draft.situationIndex, draft.situations, pushHistory]);

  const requestHint = useCallback(async () => {
    if (draft.cursor.kind !== "thought") return;
    const s = draft.situations[draft.situationIndex];
    const emotion = s.emotions[draft.cursor.emotionIndex]?.emotion;
    const situation = s.situation;
    if (!situation.trim() || !emotion?.trim()) return;

    setNotice(null);
    setHint(null);

    try {
      const res = await apiAgent.post<
        { situation: string; emotion: string },
        { message: string }
      >("/psychologist/neuro-hint", { situation, emotion });
      setHint(res.message);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        "Не удалось получить подсказку. Попробуйте описать мысль любыми своими словами — даже очень коротко.";
      setHint(typeof msg === "string" ? msg : String(msg));
    }
  }, [draft]);

  const onCantAnswer = useCallback(() => {
    if (draft.cursor.kind !== "thought") return;
    pushHistory();
    setHint(null);
    setNotice("Всё в порядке, такое бывает, давайте разберём другие эмоции или ситуации.");

    setDraft((prev) => {
      const next = cloneDraft(prev);
      const s = next.situations[next.situationIndex];
      const e = s.emotions[prev.cursor.kind === "thought" ? prev.cursor.emotionIndex : 0];
      if (e) e.thought = null;

      const currentIdx =
        prev.cursor.kind === "thought" ? prev.cursor.emotionIndex : 0;
      const nextIdx = currentIdx + 1;
      if (nextIdx < s.emotions.length) {
        next.cursor = { kind: "thought", emotionIndex: nextIdx };
      } else {
        next.cursor = { kind: "summary" };
      }
      return next;
    });
  }, [draft.cursor.kind, pushHistory]);

  const onAddSituation = useCallback(() => {
    pushHistory();
    setHint(null);
    setNotice(null);
    setDraft((prev) => {
      const next = cloneDraft(prev);
      next.situations.push({ id: uid(), situation: "", emotions: [] });
      next.situationIndex = next.situations.length - 1;
      next.cursor = { kind: "situation" };
      return next;
    });
  }, [pushHistory]);

  const nextEventNumberStart = useMemo(() => {
    const max = (existingMap || []).reduce((acc, item) => {
      return Math.max(acc, Number(item.eventNumber) || 0);
    }, 0);
    return max + 1;
  }, [existingMap]);

  const onSaveToNeuroMap = useCallback(async () => {
    const s = draft.situations[draft.situationIndex];
    if (!s.situation.trim()) {
      toast.error("Ситуация пуста");
      return;
    }
    if (s.emotions.length === 0) {
      toast.error("Нет эмоций для сохранения");
      return;
    }

    let num = nextEventNumberStart;
    try {
      for (const e of s.emotions) {
        const idea =
          e.thought === null
            ? "Не удалось сформулировать мысль"
            : (e.thought || "").trim() || "Не удалось сформулировать мысль";

        await createEventMap({
          eventNumber: num,
          event: s.situation.trim(),
          emotion: e.emotion.trim(),
          idea,
        });
        num += 1;
      }
      toast.success("Ситуация записана в нейрокарту");
    } catch (err) {
      console.error("Save neuro map error:", err);
      toast.error("Не удалось записать в нейрокарту");
    }
  }, [createEventMap, draft, nextEventNumberStart]);

  const actionRow = (() => {
    const c = draft.cursor;
    const canBack = history.length > 0;

    if (c.kind === "situation") {
      return (
        <div className="flex justify-center gap-2 flex-wrap px-4 pb-3">
          <Button variant="outline" onClick={goBack} disabled={!canBack}>
            Назад
          </Button>
        </div>
      );
    }

    if (c.kind === "emotionInput") {
      return (
        <div className="flex justify-center gap-2 flex-wrap px-4 pb-3">
          <Button variant="outline" onClick={goBack} disabled={!canBack}>
            Назад
          </Button>
        </div>
      );
    }

    if (c.kind === "emotionActions") {
      const s = draft.situations[draft.situationIndex];
      return (
        <div className="flex justify-center gap-2 flex-wrap px-4 pb-3">
          <Button variant="outline" onClick={goBack} disabled={!canBack}>
            Назад
          </Button>
          <Button variant="secondary" onClick={onAddEmotion}>
            Добавить эмоцию
          </Button>
          <Button onClick={onGoToThoughts} disabled={s.emotions.length === 0}>
            Идём дальше
          </Button>
        </div>
      );
    }

    if (c.kind === "thought") {
      return (
        <div className="flex justify-center gap-2 flex-wrap px-4 pb-3">
          <Button variant="outline" onClick={goBack} disabled={!canBack}>
            Назад
          </Button>
          <Button variant="secondary" onClick={requestHint}>
            Затрудняюсь ответить
          </Button>
          <Button variant="ghost" onClick={onCantAnswer}>
            Не могу ответить
          </Button>
        </div>
      );
    }

    // summary
    return (
      <div className="flex justify-center gap-2 flex-wrap px-4 pb-3">
        <Button variant="outline" onClick={goBack} disabled={!canBack}>
          Назад
        </Button>
        <Button variant="secondary" onClick={onAddSituation}>
          Добавить ещё одну ситуацию
        </Button>
        <Button onClick={onSaveToNeuroMap} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Сохраняю...
            </>
          ) : (
            "Записать ситуацию в мою нейрокарту"
          )}
        </Button>
      </div>
    );
  })();

  const summaryTable = useMemo(() => {
    if (draft.cursor.kind !== "summary") return null;
    const s = currentSituation;
    const rows = s.emotions.length > 0 ? s.emotions : [];
    if (rows.length === 0) return null;

    return (
      <div className="w-full max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ситуация</TableHead>
              <TableHead>Эмоции</TableHead>
              <TableHead>Мысли</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.id}>
                {idx === 0 && (
                  <TableCell rowSpan={rows.length} className="align-top">
                    {s.situation || "—"}
                  </TableCell>
                )}
                <TableCell>{row.emotion || "—"}</TableCell>
                <TableCell>
                  {row.thought === null
                    ? "—"
                    : (row.thought || "").trim() || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }, [currentSituation, draft.cursor.kind]);

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex-1 overflow-hidden">
          <div className={chatStyles.chatWindow}>
            <div className={chatStyles.messagesContainer}>
              <div className={chatStyles.messageWrapper}>
                <div className={`${chatStyles.message} ${chatStyles.assistantMessage}`}>
                  <p className={chatStyles.messageContent}>{prompt}</p>
                </div>
              </div>

              {summaryTable && (
                <div className={chatStyles.messageWrapper}>
                  <div className={`${chatStyles.message} ${chatStyles.assistantMessage}`}>
                    {summaryTable}
                  </div>
                </div>
              )}
            </div>

            {actionRow}

            {isTextStage(draft.cursor) && (
              <div style={{ position: "relative" }}>
                <MessageInput
                  ref={inputRef}
                  onSend={onSend}
                  disabled={isSaving}
                  readOnly={isSaving}
                  placeholder="Введите ответ..."
                  autoFocus
                  value={inputText}
                  onValueChange={setInputText}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
});

export default NeuroMapPage;

