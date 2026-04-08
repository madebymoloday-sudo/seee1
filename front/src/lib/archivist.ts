import { parseImportantOptions } from "./sessionUtils";

const SESSION_STATE_STORAGE_PREFIX = "seee_step_dialog_state:";
const SESSION_NOTES_STORAGE_PREFIX = "seee_session_notes:";
const SESSION_REWARDS_STORAGE_PREFIX = "seee_session_rewards:";
const ARCHIVIST_CONTEXT_STORAGE_PREFIX = "seee_archivist_gallery_context:";

export type ArchivistSuggestedCard = {
  title: string;
  category: "Освобождение" | "Улучшение +1";
  reason?: string;
};

export type SessionSnapshot = {
  sessionId: string;
  sessionTitle: string;
  situationText: string;
  importantText: string;
  notes: string;
  subject: "situation" | "thought";
  currentCoreStep: number;
  currentSolveStep: number;
  answers: Record<string, string>;
  thoughtScopes: Record<string, Record<string, string>>;
  coreThought?: string;
  importantIdeas: string[];
  emotion?: string;
  source?: string;
  conclusion?: string;
  lastActivityAt: string;
  sessionHash: string;
};

export type ArchivistGalleryContext = {
  status: "pending" | "ready";
  pendingWrapUp: boolean;
  sessionId: string;
  sessionTitle: string;
  lastSessionAt: string;
  coinsEarned: number;
  sessionHash: string;
  wrapUpMessage?: string;
  resumeMessage?: string;
  suggestedCards: ArchivistSuggestedCard[];
  snapshot?: SessionSnapshot;
};

type RawDialogState = {
  subject?: "situation" | "thought";
  coreStep?: number;
  solveStep?: number;
  situationText?: string;
  importantText?: string;
  answers?: Record<string, string>;
  thoughtScopes?: Record<string, Record<string, string>>;
};

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeRecord(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [String(key), String(entry ?? "").trim()])
      .filter(([, entry]) => entry.length > 0),
  );
}

function normalizeThoughtScopes(
  value: unknown,
): Record<string, Record<string, string>> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([scopeId, scopeValue]) => [String(scopeId), normalizeRecord(scopeValue)])
      .filter(([, scope]) => Object.keys(scope).length > 0),
  );
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function getFirstThoughtAnswer(
  thoughtScopes: Record<string, Record<string, string>>,
): string | undefined {
  for (const scope of Object.values(thoughtScopes)) {
    const thought = String(scope["core:thought:3"] || "").trim();
    if (thought) return thought;
  }
  return undefined;
}

function buildSessionTitleFallback(
  sessionTitle: string,
  situationText: string,
  coreThought: string | undefined,
): string {
  const trimmedTitle = sessionTitle.trim();
  if (trimmedTitle) return trimmedTitle;
  if (situationText.trim()) return situationText.trim();
  if (coreThought?.trim()) return coreThought.trim();
  return "последняя сессия";
}

export function getArchivistUserKey(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return "anon";
    const payload = decodeJwtPayload(token);
    return String(payload?.sub ?? payload?.id ?? payload?.userId ?? "anon");
  } catch {
    return "anon";
  }
}

export function getSessionCoinsEarned(sessionId: string): number {
  const rewardedIds = safeJsonParse<unknown[]>(
    localStorage.getItem(`${SESSION_REWARDS_STORAGE_PREFIX}${sessionId}`),
  );
  if (!Array.isArray(rewardedIds)) return 0;
  return rewardedIds.map((item) => String(item ?? "").trim()).filter(Boolean).length * 3;
}

export function buildSessionSnapshot(
  sessionId: string,
  sessionTitle?: string | null,
): SessionSnapshot | null {
  const rawState = safeJsonParse<RawDialogState>(
    localStorage.getItem(`${SESSION_STATE_STORAGE_PREFIX}${sessionId}`),
  );

  if (!rawState) return null;

  const answers = normalizeRecord(rawState.answers);
  const thoughtScopes = normalizeThoughtScopes(rawState.thoughtScopes);
  const notes = String(
    localStorage.getItem(`${SESSION_NOTES_STORAGE_PREFIX}${sessionId}`) || "",
  ).trim();
  const situationText = String(rawState.situationText || "").trim();
  const importantText = String(rawState.importantText || "").trim();
  const coreThought = String(
    answers["core:situation:3"] || getFirstThoughtAnswer(thoughtScopes) || "",
  ).trim() || undefined;
  const emotion = String(
    answers["core:situation:2"] || answers["core:thought:2"] || "",
  ).trim() || undefined;
  const source = String(
    answers["core:situation:5"] || answers["core:thought:5"] || "",
  ).trim() || undefined;
  const conclusion = String(
    answers["core:situation:9"] || answers["core:thought:9"] || "",
  ).trim() || undefined;
  const importantIdeas = parseImportantOptions(
    importantText ||
      answers["core:situation:4"] ||
      answers["core:thought:4"] ||
      "",
  );

  const hasContent =
    Object.keys(answers).length > 0 ||
    Object.keys(thoughtScopes).length > 0 ||
    notes.length > 0 ||
    situationText.length > 0 ||
    importantText.length > 0;

  if (!hasContent) return null;

  const snapshotBase = {
    sessionId,
    sessionTitle: buildSessionTitleFallback(
      String(sessionTitle || ""),
      situationText,
      coreThought,
    ),
    situationText,
    importantText,
    notes,
    subject:
      rawState.subject === "thought"
        ? ("thought" as const)
        : ("situation" as const),
    currentCoreStep:
      Number.isFinite(Number(rawState.coreStep)) && Number(rawState.coreStep) > 0
        ? Number(rawState.coreStep)
        : 1,
    currentSolveStep:
      Number.isFinite(Number(rawState.solveStep)) && Number(rawState.solveStep) > 0
        ? Number(rawState.solveStep)
        : 1,
    answers,
    thoughtScopes,
    coreThought,
    importantIdeas,
    emotion,
    source,
    conclusion,
    lastActivityAt: new Date().toISOString(),
  };

  return {
    ...snapshotBase,
    sessionHash: hashString(JSON.stringify(snapshotBase)),
  };
}

export function createPendingArchivistContext(
  sessionId: string,
  sessionTitle?: string | null,
): ArchivistGalleryContext | null {
  const snapshot = buildSessionSnapshot(sessionId, sessionTitle);
  if (!snapshot) return null;

  return {
    status: "pending",
    pendingWrapUp: true,
    sessionId,
    sessionTitle: snapshot.sessionTitle,
    lastSessionAt: snapshot.lastActivityAt,
    coinsEarned: getSessionCoinsEarned(sessionId),
    sessionHash: snapshot.sessionHash,
    suggestedCards: [],
    snapshot,
  };
}

export function loadArchivistGalleryContext(
  userKey = getArchivistUserKey(),
): ArchivistGalleryContext | null {
  return safeJsonParse<ArchivistGalleryContext>(
    localStorage.getItem(`${ARCHIVIST_CONTEXT_STORAGE_PREFIX}${userKey}`),
  );
}

export function saveArchivistGalleryContext(
  context: ArchivistGalleryContext,
  userKey = getArchivistUserKey(),
): void {
  try {
    localStorage.setItem(
      `${ARCHIVIST_CONTEXT_STORAGE_PREFIX}${userKey}`,
      JSON.stringify(context),
    );
  } catch {
    // ignore
  }
}

export function formatCoinsLabel(amount: number): string {
  const safeAmount = Math.max(0, Math.floor(amount));
  const mod10 = safeAmount % 10;
  const mod100 = safeAmount % 100;
  if (mod10 === 1 && mod100 !== 11) return `${safeAmount} монету`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${safeAmount} монеты`;
  }
  return `${safeAmount} монет`;
}

export function buildFallbackWrapUpMessage(
  context: Pick<ArchivistGalleryContext, "coinsEarned" | "sessionTitle" | "snapshot">,
): string {
  const title = context.snapshot?.coreThought || context.sessionTitle || "эту тему";
  const coinsText = formatCoinsLabel(context.coinsEarned);
  const emotion = context.snapshot?.emotion
    ? ` Ты успел(а) заметить, что здесь особенно звучит ${context.snapshot.emotion.toLowerCase()}.`
    : "";

  return `За эту сессию ты заработал ${coinsText}. Ты уже неплохо продвинулся в теме «${title}», и это правда важная работа.${emotion} Разбирать такие вещи бывает непросто, но ты молодец, что не остановился(ась).`;
}

export function buildFallbackResumeMessage(
  context: Pick<ArchivistGalleryContext, "sessionTitle" | "snapshot" | "suggestedCards">,
): string {
  const title = context.snapshot?.coreThought || context.sessionTitle || "последняя карточка";
  const firstSuggested = context.suggestedCards[0]?.title;

  if (firstSuggested) {
    return `Привет. Последнее, что ты разбирал(а), это «${title}». Я бы рекомендовал либо продолжить эту карточку, либо взять новую тему «${firstSuggested}», которую я подготовил после прошлого разбора.`;
  }

  return `Привет. Последнее, что ты разбирал(а), это «${title}». Там ещё есть за что зацепиться, так что я бы рекомендовал вернуться к этой карточке и продолжить разбор.`;
}

export function buildArchivistSuggestedTemplateId(
  sessionId: string,
  title: string,
): string {
  return `to_explore:archivist:${sessionId}:${hashString(title.trim().toLowerCase())}`;
}
