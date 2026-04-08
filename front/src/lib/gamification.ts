const COINS_STORAGE_PREFIX = "seee_user_coins:";
const SESSION_REWARDS_STORAGE_PREFIX = "seee_session_rewards:";

export type League = {
  id: string;
  name: string;
  min: number;
  max: number | null;
  accent: string;
  surface: string;
};

export type LeaderboardEntry = {
  id: string;
  username: string;
  avatarLabel: string;
  avatarEmoji: string;
  avatarSurface: string;
  points: number;
  league: League;
  badgeCount?: number;
  isCurrentUser?: boolean;
};

export const LEAGUES: League[] = [
  { id: "sand", name: "Песочная", min: 0, max: 99, accent: "#d8b36c", surface: "linear-gradient(135deg, #f4dfb2 0%, #ddb86e 100%)" },
  { id: "stone", name: "Каменная", min: 100, max: 249, accent: "#8e98a6", surface: "linear-gradient(135deg, #d4dae3 0%, #8a93a1 100%)" },
  { id: "bronze", name: "Бронзовая", min: 250, max: 499, accent: "#b87333", surface: "linear-gradient(135deg, #d8a06a 0%, #b26b2a 100%)" },
  { id: "silver", name: "Серебряная", min: 500, max: 999, accent: "#a8b4c5", surface: "linear-gradient(135deg, #eef2f7 0%, #aeb9c9 100%)" },
  { id: "gold", name: "Золотая", min: 1000, max: 1999, accent: "#d4a54e", surface: "linear-gradient(135deg, #fff0b7 0%, #d6a33a 100%)" },
  { id: "diamond", name: "Алмазная", min: 2000, max: 3999, accent: "#5bb6ff", surface: "linear-gradient(135deg, #d8f2ff 0%, #53a8f0 100%)" },
  { id: "ruby", name: "Рубиновая", min: 4000, max: 6999, accent: "#d64c69", surface: "linear-gradient(135deg, #ffced7 0%, #ce3a5d 100%)" },
  { id: "platinum", name: "Платиновая", min: 7000, max: 10999, accent: "#6ab9b2", surface: "linear-gradient(135deg, #dbfff7 0%, #67b7ae 100%)" },
  { id: "sapphire", name: "Сапфировая", min: 11000, max: 15999, accent: "#4f7bf2", surface: "linear-gradient(135deg, #dce7ff 0%, #4e75df 100%)" },
  { id: "archivist", name: "Архивариус", min: 16000, max: null, accent: "#7a58d1", surface: "linear-gradient(135deg, #ece2ff 0%, #7f59d8 100%)" },
] as const;

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

export function getGamificationUserKey(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return "anon";
    const payload = decodeJwtPayload(token);
    return String(payload?.sub ?? payload?.id ?? payload?.userId ?? "anon");
  } catch {
    return "anon";
  }
}

export function getGamificationUsername(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return "Вы";
    const payload = decodeJwtPayload(token);
    return String(payload?.username ?? payload?.name ?? "Вы");
  } catch {
    return "Вы";
  }
}

export function getAvatarLabel(username: string): string {
  const normalized = (username || "").trim();
  if (!normalized) return "S";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
}

export function getUserCoins(userKey = getGamificationUserKey()): number {
  try {
    const raw = localStorage.getItem(`${COINS_STORAGE_PREFIX}${userKey}`);
    const value = Number(raw ?? "0");
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function setUserCoins(value: number, userKey = getGamificationUserKey()) {
  try {
    localStorage.setItem(`${COINS_STORAGE_PREFIX}${userKey}`, String(Math.max(0, Math.floor(value))));
  } catch {
    // ignore
  }
}

function getRewardedAnswerIds(sessionId: string): string[] {
  try {
    const raw = localStorage.getItem(`${SESSION_REWARDS_STORAGE_PREFIX}${sessionId}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map((x) => String(x ?? "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setRewardedAnswerIds(sessionId: string, rewardIds: string[]) {
  try {
    localStorage.setItem(`${SESSION_REWARDS_STORAGE_PREFIX}${sessionId}`, JSON.stringify(rewardIds));
  } catch {
    // ignore
  }
}

function emitCoinsUpdated(balance: number) {
  window.dispatchEvent(
    new CustomEvent("seee:coins-updated", {
      detail: { balance },
    }),
  );
}

export function awardCoinsForAnswer(
  sessionId: string,
  answerId: string,
  amount = 3,
): { awarded: boolean; balance: number; delta: number } {
  const rewardedIds = getRewardedAnswerIds(sessionId);
  if (rewardedIds.includes(answerId)) {
    return { awarded: false, balance: getUserCoins(), delta: 0 };
  }

  const nextBalance = getUserCoins() + amount;
  setRewardedAnswerIds(sessionId, [...rewardedIds, answerId]);
  setUserCoins(nextBalance);
  emitCoinsUpdated(nextBalance);

  return { awarded: true, balance: nextBalance, delta: amount };
}

export function getLeagueForPoints(points: number): League {
  return (
    LEAGUES.find((league) => {
      if (points < league.min) return false;
      if (league.max === null) return true;
      return points <= league.max;
    }) || LEAGUES[0]
  );
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const MOCK_NAMES = [
  "Mira", "Ivo", "Nika", "Arlen", "Lina", "Theo", "Sora", "Mika", "Rian", "Noel",
  "Ayla", "Kian", "Luma", "Vera", "Milo", "Eden", "Rhea", "Tao", "Nero", "Mina",
];

const AVATAR_EMOJIS = ["🧑🏻", "👩🏼", "🧑🏾", "👨🏻", "👩🏽", "🧑🏽", "👨🏿", "👩🏻", "🧔🏽", "👩🏿"];
const AVATAR_SURFACES = [
  "linear-gradient(135deg, #ffd8a8 0%, #ff9f68 100%)",
  "linear-gradient(135deg, #d9ecff 0%, #7fb4ff 100%)",
  "linear-gradient(135deg, #ffe0ec 0%, #ff8fc2 100%)",
  "linear-gradient(135deg, #dff7e1 0%, #7ed392 100%)",
  "linear-gradient(135deg, #efe2ff 0%, #ad87ff 100%)",
  "linear-gradient(135deg, #fff4cf 0%, #f3c665 100%)",
];

export function formatPointsLabel(points: number): string {
  const mod10 = points % 10;
  const mod100 = points % 100;
  if (mod10 === 1 && mod100 !== 11) return `${points} очко`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${points} очка`;
  }
  return `${points} очков`;
}

export function buildLeaderboardEntries(): LeaderboardEntry[] {
  const userKey = getGamificationUserKey();
  const username = getGamificationUsername();
  const currentPoints = getUserCoins(userKey);
  const currentLeague = getLeagueForPoints(currentPoints);

  const currentUserEntry: LeaderboardEntry = {
    id: userKey,
    username,
    avatarLabel: getAvatarLabel(username),
    avatarEmoji: "🙂",
    avatarSurface: "linear-gradient(135deg, #fff2c2 0%, #e0b358 100%)",
    points: currentPoints,
    league: currentLeague,
    badgeCount: 55,
    isCurrentUser: true,
  };

  const peers = Array.from({ length: 18 }, (_, index) => {
    const baseName = MOCK_NAMES[index % MOCK_NAMES.length];
    const seed = hash(`${userKey}:${baseName}:${index}`);
    const rangeMax = currentLeague.max ?? currentLeague.min + 12000;
    const span = Math.max(1, rangeMax - currentLeague.min + 1);
    const points = currentLeague.min + (seed % span);
    const username = `${baseName}_${String((seed % 89) + 11)}`;
    return {
      id: `peer-${index}`,
      username,
      avatarLabel: getAvatarLabel(username),
      avatarEmoji: AVATAR_EMOJIS[index % AVATAR_EMOJIS.length],
      avatarSurface: AVATAR_SURFACES[index % AVATAR_SURFACES.length],
      points,
      league: currentLeague,
      badgeCount: (seed % 64) + 1,
    } satisfies LeaderboardEntry;
  });

  return [...peers, currentUserEntry].sort((a, b) => b.points - a.points);
}
