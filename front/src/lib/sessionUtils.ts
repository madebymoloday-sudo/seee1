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

  // Разбиваем по: переносам, ; , • , — , " - ", нумерованным спискам, связкам "Второе -" "В третьих -"
  const raw = normalized
    .split(
      /\r?\n|;\s*|•\s*|\u2022\s*|\s+—\s+|\s+-\s+(?=\S)|\*\s*|\d+[\)\.]\s+|(?:Второе|В третьих|Во-первых|Первое|Третье|Во-вторых)\s*[—\-]\s*/gi
    )
    .map((s) => s.replace(/^\d+[\)\.\-]\s*/, "").replace(/^[—\-]\s*/, "").trim())
    .filter((s) => s.length >= 3 && !isTransitionOnly(s));

  const unique: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!unique.some((x) => x.toLowerCase() === key)) unique.push(item);
    if (unique.length >= 50) break;
  }
  return unique;
}
