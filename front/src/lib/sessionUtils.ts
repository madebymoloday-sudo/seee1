const DRAFT_SESSION_ID = "new";
const STORAGE_KEY_PREFIX = "seee_step_dialog_state:";
const SESSION_KIND_PREFIX = "seee_session_kind:";
const SESSION_NOTES_PREFIX = "seee_session_notes:";

/**
 * Очищает черновик «Новая сессия» при явном клике на «Новая сессия».
 * Вызывать перед навигацией на /sessions/new.
 */
export function clearDraftSession(userKey: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${DRAFT_SESSION_ID}`);
    localStorage.removeItem(`${SESSION_KIND_PREFIX}${DRAFT_SESSION_ID}`);
    localStorage.removeItem(`${SESSION_NOTES_PREFIX}${DRAFT_SESSION_ID}`);
    localStorage.removeItem(`seee_draft_title:${userKey}`);
    localStorage.removeItem(`seee_draft_to_explore_template:${userKey}`);
  } catch {
    // ignore
  }
}

/** Слова-связки, не являющиеся самостоятельными мыслями */
const TRANSITION_WORDS = new Set([
  "во-первых", "во-вторых", "в-третьих", "в третьих", "в-четвёртых", "в четвертых",
  "первое", "второе", "третье", "четвёртое", "четвертое", "пятое",
  "первых", "вторых", "третьих", "четвёртых", "четвертых",
  "во первых", "во вторых", "в третьих", "в четвертых",
]);

function isTransitionOnly(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (t.length < 2) return true;
  return TRANSITION_WORDS.has(t) || /^[\d\)\.\-]+$/.test(t);
}

/**
 * Парсит текст ответа на «Почему для вас это важно» в список мыслей.
 * Разбивает по: переносам строк, ; , • , — (тире), нумерованным спискам.
 * Не разбивает по запятой — она внутри предложений.
 * Отфильтровывает слова-связки (Второе, В третьих и т.п.).
 */
export function parseImportantOptions(text: string): string[] {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // 1) Базовое разбиение по структурным разделителям
  const coarse = normalized
    .split(
      /\r?\n|;\s*|•\s*|\u2022\s*|\s+—\s+|\s+-\s+(?=\S)|\*\s*|\d+[\)\.]\s+|(?:Второе|В третьих|Во-первых|Первое|Третье|Во-вторых)\s*[—\-]\s*/gi
    )
    .map((s) => s.replace(/^\d+[\)\.\-]\s*/, "").replace(/^[—\-]\s*/, "").trim())
    .filter((s) => s.length >= 3 && !isTransitionOnly(s));

  // 2) Доп. разбиение длинных кусков на отдельные предложения,
  // чтобы "глубже" показывал идеи поштучно
  const raw = coarse.flatMap((chunk) => {
    const sentenceParts = chunk
      .split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return sentenceParts.length > 1 ? sentenceParts : [chunk];
  });

  const unique: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!unique.some((x) => x.toLowerCase() === key)) unique.push(item);
    if (unique.length >= 50) break;
  }
  return unique;
}
