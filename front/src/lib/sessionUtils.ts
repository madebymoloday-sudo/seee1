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
  return TRANSITION_WORDS.has(t) || /^[\d).-]+$/.test(t);
}

function normalizeIdeaText(text: string): string {
  return text
    .replace(/^\s*(?:и|но|а)\s+/iu, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!,:;]+$/g, "")
    .trim();
}

/**
 * Парсит текст ответа на «Почему для вас это важно» в список мыслей.
 * Разделяет только явно оформленные пункты, не разрывая естественную фразу
 * по запятым, союзам или словам «потому что».
 */
export function parseImportantOptions(text: string): string[] {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const raw = normalized
    .replace(/\s+(?=\d+[.)]\s+)/g, "\n")
    .split(/\n+|;+/)
    .map((item) =>
      normalizeIdeaText(
        item
          .replace(/^\s*[-•*]\s+/, "")
          .replace(/^\s*\d+[.)]\s+/, ""),
      ),
    )
    .filter((s) => s.length >= 3 && !isTransitionOnly(s));

  const unique: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!unique.some((x) => x.toLowerCase() === key)) unique.push(item);
    if (unique.length >= 50) break;
  }
  return unique;
}
