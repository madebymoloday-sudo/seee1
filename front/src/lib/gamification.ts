const COINS_STORAGE_PREFIX = "seee_user_coins:";
const SESSION_REWARDS_STORAGE_PREFIX = "seee_session_rewards:";
const SESSION_BONUS_REWARDS_STORAGE_PREFIX = "seee_session_bonus_rewards:";
const USER_STREAK_STORAGE_PREFIX = "seee_user_streak:";
const DAILY_PRACTICE_PROGRESS_PREFIX = "seee_daily_practice_progress:";
const DRAFT_TEMPLATE_REWARD_PREFIX = "seee_draft_template_reward:";
const SESSION_PENDING_REWARD_PREFIX = "seee_session_pending_reward:";

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

type DailyStreakState = {
  streak: number;
  lastQualifiedDate: string | null;
};

type SessionBonusReward = {
  id: string;
  amount: number;
};

type DailyPracticeMinutes = 5 | 10 | 15;

type DailyPracticeProgressState = {
  dateKey: string;
  completedLineIds: string[];
  goalMinutes: DailyPracticeMinutes;
};

export type DailyPracticeProgressResult = {
  completionAccepted: boolean;
  completedLines: number;
  targetLines: number;
  progressPercent: number;
  goalCompleted: boolean;
  goalCompletedNow: boolean;
  goalMinutes: DailyPracticeMinutes;
};

export type PendingSessionReward = {
  id: string;
  amount: number;
  templateId?: string;
  reason?: string;
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
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    const recoveredCoins = recoverCoinsFromSessionStorage();
    if (recoveredCoins > 0) {
      setUserCoins(recoveredCoins, userKey);
      return recoveredCoins;
    }

    if (userKey !== "anon") {
      const anonRaw = localStorage.getItem(`${COINS_STORAGE_PREFIX}anon`);
      const anonValue = Number(anonRaw ?? "0");
      if (Number.isFinite(anonValue) && anonValue > 0) {
        setUserCoins(Math.floor(anonValue), userKey);
        return Math.floor(anonValue);
      }
    }

    return 0;
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

function recoverCoinsFromSessionStorage(): number {
  try {
    let total = 0;

    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (!storageKey) continue;

      if (storageKey.startsWith(SESSION_REWARDS_STORAGE_PREFIX)) {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(parsed)) {
          total +=
            parsed
              .map((item) => String(item ?? "").trim())
              .filter(Boolean).length * 3;
        }
        continue;
      }

      if (storageKey.startsWith(SESSION_BONUS_REWARDS_STORAGE_PREFIX)) {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(parsed)) {
          total += parsed.reduce((sum, entry) => {
            const amount = Math.floor(
              Number((entry as { amount?: unknown })?.amount ?? 0),
            );
            return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
          }, 0);
        }
      }
    }

    return Math.max(0, Math.floor(total));
  } catch {
    return 0;
  }
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function getDayDiff(fromDateKey: string, toDateKey: string): number | null {
  const from = parseLocalDateKey(fromDateKey);
  const to = parseLocalDateKey(toDateKey);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function getStoredStreakState(userKey = getGamificationUserKey()): DailyStreakState {
  try {
    const raw = localStorage.getItem(`${USER_STREAK_STORAGE_PREFIX}${userKey}`);
    const parsed = raw ? (JSON.parse(raw) as Partial<DailyStreakState>) : null;
    const streak = Number(parsed?.streak ?? 0);
    return {
      streak: Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0,
      lastQualifiedDate:
        typeof parsed?.lastQualifiedDate === "string" ? parsed.lastQualifiedDate : null,
    };
  } catch {
    return { streak: 0, lastQualifiedDate: null };
  }
}

function setStoredStreakState(
  state: DailyStreakState,
  userKey = getGamificationUserKey(),
) {
  try {
    localStorage.setItem(
      `${USER_STREAK_STORAGE_PREFIX}${userKey}`,
      JSON.stringify({
        streak: Math.max(0, Math.floor(state.streak)),
        lastQualifiedDate: state.lastQualifiedDate,
      }),
    );
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

function getSessionBonusRewards(sessionId: string): SessionBonusReward[] {
  try {
    const raw = localStorage.getItem(`${SESSION_BONUS_REWARDS_STORAGE_PREFIX}${sessionId}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: String((entry as { id?: unknown })?.id ?? "").trim(),
        amount: Math.max(
          0,
          Math.floor(Number((entry as { amount?: unknown })?.amount ?? 0)),
        ),
      }))
      .filter((entry) => entry.id && entry.amount > 0);
  } catch {
    return [];
  }
}

function setSessionBonusRewards(sessionId: string, rewards: SessionBonusReward[]) {
  try {
    localStorage.setItem(
      `${SESSION_BONUS_REWARDS_STORAGE_PREFIX}${sessionId}`,
      JSON.stringify(rewards),
    );
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

function emitStreakUpdated(streak: number) {
  window.dispatchEvent(
    new CustomEvent("seee:streak-updated", {
      detail: { streak },
    }),
  );
}

function emitDailyPracticeProgress(detail: DailyPracticeProgressResult) {
  window.dispatchEvent(
    new CustomEvent("seee:daily-practice-progress", {
      detail,
    }),
  );
}

export function getTargetLinesForDailyPractice(minutes: DailyPracticeMinutes | null | undefined): number {
  switch (minutes) {
    case 10:
      return 2;
    case 15:
      return 3;
    case 5:
    default:
      return 1;
  }
}

function getDailyPracticeProgressState(
  userKey = getGamificationUserKey(),
): DailyPracticeProgressState | null {
  try {
    const raw = localStorage.getItem(`${DAILY_PRACTICE_PROGRESS_PREFIX}${userKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyPracticeProgressState>;
    const completedLineIds = Array.isArray(parsed?.completedLineIds)
      ? parsed.completedLineIds.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const goalMinutes =
      parsed?.goalMinutes === 5 || parsed?.goalMinutes === 10 || parsed?.goalMinutes === 15
        ? parsed.goalMinutes
        : 5;
    const dateKey = typeof parsed?.dateKey === "string" ? parsed.dateKey : getLocalDateKey();
    return {
      dateKey,
      completedLineIds,
      goalMinutes,
    };
  } catch {
    return null;
  }
}

function setDailyPracticeProgressState(
  state: DailyPracticeProgressState,
  userKey = getGamificationUserKey(),
) {
  try {
    localStorage.setItem(
      `${DAILY_PRACTICE_PROGRESS_PREFIX}${userKey}`,
      JSON.stringify(state),
    );
  } catch {
    // ignore
  }
}

export function getTodayDailyPracticeProgress(
  goalMinutes: DailyPracticeMinutes | null | undefined,
  userKey = getGamificationUserKey(),
): DailyPracticeProgressResult {
  const normalizedGoalMinutes: DailyPracticeMinutes =
    goalMinutes === 10 || goalMinutes === 15 ? goalMinutes : 5;
  const todayKey = getLocalDateKey();
  const targetLines = getTargetLinesForDailyPractice(normalizedGoalMinutes);
  const state = getDailyPracticeProgressState(userKey);
  const completedLineIds =
    state && state.dateKey === todayKey ? state.completedLineIds : [];
  const completedLines = Math.min(targetLines, completedLineIds.length);
  const progressPercent = Math.min(
    100,
    Math.round((completedLines / Math.max(1, targetLines)) * 100),
  );
  return {
    completionAccepted: false,
    completedLines,
    targetLines,
    progressPercent,
    goalCompleted: completedLines >= targetLines,
    goalCompletedNow: false,
    goalMinutes: normalizedGoalMinutes,
  };
}

export function recordDailyPracticeLineCompletion(
  lineId: string,
  goalMinutes: DailyPracticeMinutes | null | undefined,
  userKey = getGamificationUserKey(),
): DailyPracticeProgressResult {
  const normalizedGoalMinutes: DailyPracticeMinutes =
    goalMinutes === 10 || goalMinutes === 15 ? goalMinutes : 5;
  const todayKey = getLocalDateKey();
  const targetLines = getTargetLinesForDailyPractice(normalizedGoalMinutes);
  const currentState = getDailyPracticeProgressState(userKey);
  const baseState: DailyPracticeProgressState =
    currentState && currentState.dateKey === todayKey
      ? {
          ...currentState,
          goalMinutes: normalizedGoalMinutes,
        }
      : {
          dateKey: todayKey,
          completedLineIds: [],
          goalMinutes: normalizedGoalMinutes,
        };

  const safeLineId = String(lineId || "").trim();
  if (!safeLineId || baseState.completedLineIds.includes(safeLineId)) {
    return getTodayDailyPracticeProgress(normalizedGoalMinutes, userKey);
  }

  const nextCompletedLineIds = [...baseState.completedLineIds, safeLineId];
  const nextState: DailyPracticeProgressState = {
    ...baseState,
    completedLineIds: nextCompletedLineIds,
  };
  setDailyPracticeProgressState(nextState, userKey);

  const completedLines = Math.min(targetLines, nextCompletedLineIds.length);
  const goalCompleted = completedLines >= targetLines;
  const previousGoalCompleted = baseState.completedLineIds.length >= targetLines;
  const result: DailyPracticeProgressResult = {
    completionAccepted: true,
    completedLines,
    targetLines,
    progressPercent: Math.min(
      100,
      Math.round((completedLines / Math.max(1, targetLines)) * 100),
    ),
    goalCompleted,
    goalCompletedNow: goalCompleted && !previousGoalCompleted,
    goalMinutes: normalizedGoalMinutes,
  };

  emitDailyPracticeProgress(result);
  return result;
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

export function getSessionCoinsEarned(sessionId: string): number {
  const answerCoins = getRewardedAnswerIds(sessionId).length * 3;
  const bonusCoins = getSessionBonusRewards(sessionId).reduce(
    (sum, reward) => sum + Math.max(0, Math.floor(reward.amount)),
    0,
  );
  return answerCoins + bonusCoins;
}

export function awardSessionBonus(
  sessionId: string,
  bonusId: string,
  amount: number,
): { awarded: boolean; balance: number; delta: number; sessionCoins: number } {
  const safeBonusId = String(bonusId || "").trim();
  const safeAmount = Math.max(0, Math.floor(amount));
  if (!safeBonusId || safeAmount <= 0) {
    return {
      awarded: false,
      balance: getUserCoins(),
      delta: 0,
      sessionCoins: getSessionCoinsEarned(sessionId),
    };
  }

  const existingRewards = getSessionBonusRewards(sessionId);
  if (existingRewards.some((reward) => reward.id === safeBonusId)) {
    return {
      awarded: false,
      balance: getUserCoins(),
      delta: 0,
      sessionCoins: getSessionCoinsEarned(sessionId),
    };
  }

  setSessionBonusRewards(sessionId, [
    ...existingRewards,
    { id: safeBonusId, amount: safeAmount },
  ]);

  const nextBalance = getUserCoins() + safeAmount;
  setUserCoins(nextBalance);
  emitCoinsUpdated(nextBalance);

  return {
    awarded: true,
    balance: nextBalance,
    delta: safeAmount,
    sessionCoins: getSessionCoinsEarned(sessionId),
  };
}

export function loadDraftSessionReward(
  userKey = getGamificationUserKey(),
): PendingSessionReward | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_TEMPLATE_REWARD_PREFIX}${userKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSessionReward>;
    const id = String(parsed?.id ?? "").trim();
    const amount = Math.max(0, Math.floor(Number(parsed?.amount ?? 0)));
    if (!id || amount <= 0) return null;
    return {
      id,
      amount,
      templateId: parsed?.templateId ? String(parsed.templateId).trim() : undefined,
      reason: parsed?.reason ? String(parsed.reason).trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function saveDraftSessionReward(
  reward: PendingSessionReward | null,
  userKey = getGamificationUserKey(),
): void {
  try {
    if (!reward || !reward.id || reward.amount <= 0) {
      localStorage.removeItem(`${DRAFT_TEMPLATE_REWARD_PREFIX}${userKey}`);
      return;
    }

    localStorage.setItem(
      `${DRAFT_TEMPLATE_REWARD_PREFIX}${userKey}`,
      JSON.stringify({
        id: String(reward.id),
        amount: Math.max(0, Math.floor(reward.amount)),
        templateId: reward.templateId,
        reason: reward.reason,
      }),
    );
  } catch {
    // ignore
  }
}

export function clearDraftSessionReward(userKey = getGamificationUserKey()): void {
  try {
    localStorage.removeItem(`${DRAFT_TEMPLATE_REWARD_PREFIX}${userKey}`);
  } catch {
    // ignore
  }
}

export function assignPendingSessionReward(
  sessionId: string,
  reward: PendingSessionReward | null,
): void {
  try {
    if (!reward || !reward.id || reward.amount <= 0) {
      localStorage.removeItem(`${SESSION_PENDING_REWARD_PREFIX}${sessionId}`);
      return;
    }

    localStorage.setItem(
      `${SESSION_PENDING_REWARD_PREFIX}${sessionId}`,
      JSON.stringify({
        id: String(reward.id),
        amount: Math.max(0, Math.floor(reward.amount)),
        templateId: reward.templateId,
        reason: reward.reason,
      }),
    );
  } catch {
    // ignore
  }
}

export function claimPendingSessionReward(
  sessionId: string,
): { awarded: boolean; balance: number; delta: number; sessionCoins: number } {
  try {
    const raw = localStorage.getItem(`${SESSION_PENDING_REWARD_PREFIX}${sessionId}`);
    if (!raw) {
      return {
        awarded: false,
        balance: getUserCoins(),
        delta: 0,
        sessionCoins: getSessionCoinsEarned(sessionId),
      };
    }

    const parsed = JSON.parse(raw) as Partial<PendingSessionReward>;
    const rewardId = String(parsed?.id ?? "").trim();
    const amount = Math.max(0, Math.floor(Number(parsed?.amount ?? 0)));
    if (!rewardId || amount <= 0) {
      localStorage.removeItem(`${SESSION_PENDING_REWARD_PREFIX}${sessionId}`);
      return {
        awarded: false,
        balance: getUserCoins(),
        delta: 0,
        sessionCoins: getSessionCoinsEarned(sessionId),
      };
    }

    const result = awardSessionBonus(sessionId, rewardId, amount);
    localStorage.removeItem(`${SESSION_PENDING_REWARD_PREFIX}${sessionId}`);
    return result;
  } catch {
    return {
      awarded: false,
      balance: getUserCoins(),
      delta: 0,
      sessionCoins: getSessionCoinsEarned(sessionId),
    };
  }
}

export function getUserStreak(userKey = getGamificationUserKey()): number {
  const state = getStoredStreakState(userKey);
  if (!state.lastQualifiedDate || state.streak <= 0) return 0;
  const todayKey = getLocalDateKey();
  const diff = getDayDiff(state.lastQualifiedDate, todayKey);
  if (diff === 0 || diff === 1) {
    return state.streak;
  }
  return 0;
}

export function formatStreakLabel(days: number): string {
  const safeDays = Math.max(0, Math.floor(days));
  const mod10 = safeDays % 10;
  const mod100 = safeDays % 100;
  if (mod10 === 1 && mod100 !== 11) return `${safeDays} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${safeDays} дня`;
  }
  return `${safeDays} дней`;
}

export function awardDailyStreakForProgress(
  amount = 10,
  userKey = getGamificationUserKey(),
): { awarded: boolean; balance: number; delta: number; streak: number } {
  const todayKey = getLocalDateKey();
  const state = getStoredStreakState(userKey);
  const diff = state.lastQualifiedDate
    ? getDayDiff(state.lastQualifiedDate, todayKey)
    : null;

  if (diff === 0) {
    return {
      awarded: false,
      balance: getUserCoins(userKey),
      delta: 0,
      streak: getUserStreak(userKey),
    };
  }

  const nextStreak = diff === 1 ? Math.max(1, state.streak + 1) : 1;
  const nextBalance = getUserCoins(userKey) + amount;

  setStoredStreakState(
    {
      streak: nextStreak,
      lastQualifiedDate: todayKey,
    },
    userKey,
  );
  setUserCoins(nextBalance, userKey);
  emitCoinsUpdated(nextBalance);
  emitStreakUpdated(nextStreak);

  return { awarded: true, balance: nextBalance, delta: amount, streak: nextStreak };
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
  "Ксения Зорина",
  "Дмитрий Волков",
  "Анна Белова",
  "Павел Орлов",
  "Мария Соколова",
  "Илья Миронов",
  "Екатерина Левина",
  "Артем Громов",
  "Алина Туманова",
  "Никита Романов",
  "Вера Лазарева",
  "Тимур Жданов",
  "Ольга Ермакова",
  "Михаил Крылов",
  "Полина Гущина",
  "София Веденеева",
  "Роман Яковлев",
  "Егор Лапин",
  "Дарья Осипова",
  "Лев Трофимов",
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
    return {
      id: `peer-${index}`,
      username: baseName,
      avatarLabel: getAvatarLabel(baseName),
      avatarEmoji: AVATAR_EMOJIS[index % AVATAR_EMOJIS.length],
      avatarSurface: AVATAR_SURFACES[index % AVATAR_SURFACES.length],
      points,
      league: currentLeague,
      badgeCount: (seed % 64) + 1,
    } satisfies LeaderboardEntry;
  });

  return [...peers, currentUserEntry].sort((a, b) => b.points - a.points);
}
