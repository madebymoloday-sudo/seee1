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
    localStorage.removeItem(`seee_draft_template_reward:${userKey}`);
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

function inferSubjectPrefix(text: string): string {
  const normalized = ` ${text.toLowerCase()} `;
  if (/\bя\b/u.test(normalized)) return "Я";
  if (/\bмы\b/u.test(normalized)) return "Мы";
  if (/\bони\b/u.test(normalized)) return "Они";
  if (/\bон\b/u.test(normalized)) return "Он";
  if (/\bона\b/u.test(normalized)) return "Она";
  if (/\bпапа\b/u.test(normalized)) return "Папа";
  if (/\bмама\b/u.test(normalized)) return "Мама";
  if (/\bродители\b/u.test(normalized)) return "Родители";
  if (/\bлюди\b/u.test(normalized)) return "Люди";
  return "";
}

function normalizeIdeaText(text: string): string {
  return text
    .replace(/^\s*(?:и|но|а)\s+/iu, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!,:;]+$/g, "")
    .trim();
}

function ensureSubjectPrefix(text: string, subjectPrefix: string): string {
  const normalized = normalizeIdeaText(text);
  if (!normalized) return "";
  if (!subjectPrefix) return normalized;
  if (
    /^(я|мы|они|он|она|папа|мама|родители|люди|система|человек)\b/iu.test(
      normalized,
    )
  ) {
    return normalized;
  }
  return `${subjectPrefix} ${normalized}`;
}

function splitIdeaChunk(chunk: string): string[] {
  const trimmed = normalizeIdeaText(chunk);
  if (!trimmed) return [];

  const becauseMatch = trimmed.match(/^(.*?)(?:,\s*|\s+)потому что\s+(.+)$/iu);
  if (becauseMatch) {
    const left = normalizeIdeaText(becauseMatch[1]);
    const right = ensureSubjectPrefix(
      becauseMatch[2],
      inferSubjectPrefix(left),
    );
    return [left, right].filter((item) => item && !isTransitionOnly(item));
  }

  const linkedMatch = trimmed.match(/^(.*?),\s*(?:и|но|а)\s+(.+)$/iu);
  if (linkedMatch) {
    const left = normalizeIdeaText(linkedMatch[1]);
    const right = ensureSubjectPrefix(
      linkedMatch[2],
      inferSubjectPrefix(left),
    );
    return [left, right].filter((item) => item && !isTransitionOnly(item));
  }

  return [trimmed];
}

/**
 * Парсит текст ответа на «Почему для вас это важно» в список мыслей.
 * Разбивает по: переносам строк, запятым, ; , • , — (тире), нумерованным спискам.
 * Отфильтровывает слова-связки (Второе, В третьих и т.п.).
 */
export function parseImportantOptions(text: string): string[] {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // 1) Базовое разбиение по явным структурным разделителям.
  const coarse = normalized
    .split(
      /\r?\n|;\s*|•\s*|\u2022\s*|\s+—\s+|\s+-\s+(?=\S)|\*\s*|\d+[\)\.]\s+|(?:Второе|В третьих|Во-первых|Первое|Третье|Во-вторых)\s*[—\-]\s*/gi
    )
    .map((s) => s.replace(/^\d+[\)\.\-]\s*/, "").replace(/^[—\-]\s*/, "").trim())
    .filter((s) => s.length >= 3 && !isTransitionOnly(s));

  // 2) Разбиваем крупные куски на предложения и связанные смысловые части.
  const raw = coarse.flatMap((chunk) =>
    chunk
      .split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/g)
      .flatMap((sentence) => splitIdeaChunk(sentence))
      .map((item) => normalizeIdeaText(item))
      .filter((item) => item.length >= 3 && !isTransitionOnly(item)),
  );

  const unique: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!unique.some((x) => x.toLowerCase() === key)) unique.push(item);
    if (unique.length >= 50) break;
  }
  return unique;
}
