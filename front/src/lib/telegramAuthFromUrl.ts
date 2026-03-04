/**
 * Парсит данные авторизации Telegram из URL (возврат после редиректа или открытие в том же окне).
 * Поддерживает: hash #tgAuthResult=<json> и query-параметры (id, hash, auth_date, ...).
 */

export type TelegramAuthPayload = {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

function parseFromHash(): TelegramAuthPayload | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash?.replace(/^#/, "") || "";
  const match = hash.match(/tgAuthResult=(.+)/);
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match[1].trim());
    const data = JSON.parse(raw) as Record<string, unknown>;
    const id = data.id != null ? String(data.id) : "";
    const hashVal = typeof data.hash === "string" ? data.hash : "";
    const auth_date = typeof data.auth_date === "number" ? data.auth_date : Number(data.auth_date) || 0;
    if (!id || !hashVal || !auth_date) return null;
    return {
      id,
      first_name: typeof data.first_name === "string" ? data.first_name : "",
      last_name: typeof data.last_name === "string" ? data.last_name : undefined,
      username: typeof data.username === "string" ? data.username : undefined,
      photo_url: typeof data.photo_url === "string" ? data.photo_url : undefined,
      auth_date,
      hash: hashVal,
    };
  } catch {
    return null;
  }
}

function parseFromQuery(): TelegramAuthPayload | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const hashVal = params.get("hash");
  const authDateStr = params.get("auth_date");
  if (!id || !hashVal || !authDateStr) return null;
  const auth_date = parseInt(authDateStr, 10);
  if (!Number.isFinite(auth_date)) return null;
  return {
    id,
    first_name: params.get("first_name") || "",
    last_name: params.get("last_name") || undefined,
    username: params.get("username") || undefined,
    photo_url: params.get("photo_url") || undefined,
    auth_date,
    hash: hashVal,
  };
}

/** Возвращает payload, если в текущем URL есть данные авторизации Telegram, иначе null. */
export function getTelegramAuthFromUrl(): TelegramAuthPayload | null {
  return parseFromHash() || parseFromQuery();
}

/** Удаляет из URL параметры/hash авторизации Telegram (без перезагрузки). */
export function clearTelegramAuthFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("id");
  url.searchParams.delete("first_name");
  url.searchParams.delete("last_name");
  url.searchParams.delete("username");
  url.searchParams.delete("photo_url");
  url.searchParams.delete("auth_date");
  url.searchParams.delete("hash");
  window.history.replaceState(null, "", url.pathname + url.search);
}
