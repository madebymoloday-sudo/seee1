export const SEE_TOKENS_EXPIRED_MESSAGE =
  "У вас закончились seee-токены, нужно пополнить баланс 💛";

export type SubscriptionLike = {
  accountType?: "USER" | "MANAGER" | "TEAM_MEMBER" | null;
  subscriptionActive?: boolean | null;
  subscriptionEndsAt?: string | null;
};

export function getSubscriptionEndsAtTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isSubscriptionActive(user?: SubscriptionLike | null): boolean {
  if (!user) return false;
  if (user.accountType === "TEAM_MEMBER") return true;
  if (!user.subscriptionActive) return false;
  const endsAt = getSubscriptionEndsAtTime(user.subscriptionEndsAt);
  return endsAt === null || endsAt > Date.now();
}

export function getSubscriptionTimeLeftLabel(value?: string | null): string {
  const endsAt = getSubscriptionEndsAtTime(value);
  if (endsAt === null) return "Бессрочно";

  const diff = endsAt - Date.now();
  if (diff <= 0) return "0 дней";

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(diff / dayMs);
  if (days >= 1) return `${days} дн.`;

  const hours = Math.max(1, Math.ceil(diff / hourMs));
  return `${hours} ч.`;
}

export function extractApiMessage(error: unknown): string {
  const response = (error as { response?: { data?: { message?: unknown } } })?.response;
  const message = response?.data?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return "";
}

export function isSeeTokensExpiredError(error: unknown): boolean {
  return extractApiMessage(error).includes("seee-токены");
}
