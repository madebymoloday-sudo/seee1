export function normalizeMapText(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseImportantOptions(value: unknown): string[] {
  const text = String(value || '').trim();
  if (!text) return [];

  const structurallySeparated = text
    .replace(/\s+(?=\d+[.)]\s+)/g, '\n')
    .split(/\n+|;+/)
    .map((part) =>
      part
        .replace(/^\s*[-•*]\s+/, '')
        .replace(/^\s*\d+[.)]\s+/, '')
        .trim(),
    )
    .filter(Boolean);

  const unique = new Map<string, string>();
  for (const option of structurallySeparated) {
    const normalized = normalizeMapText(option);
    if (normalized && !unique.has(normalized)) {
      unique.set(normalized, option);
    }
  }

  return Array.from(unique.values());
}
