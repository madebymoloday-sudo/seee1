import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import apiAgent from "@/lib/api";

type SubscriptionStatusResponse = {
  status: "NONE" | "ACTIVE" | "CANCELED";
  isActive: boolean;
  endsAt?: string | null;
};

const LAVA_WIDGET_URL =
  "https://widget.lava.top/4cec9675-8ace-4321-8544-84142c34d6d8";

const SubscriptionGatePage = () => {
  const auth = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [subscription, setSubscription] =
    useState<SubscriptionStatusResponse | null>(null);

  const hasActiveSubscription = useMemo(() => {
    if (subscription?.isActive) return true;
    return !!auth.user?.subscriptionActive;
  }, [auth.user?.subscriptionActive, subscription?.isActive]);

  const refreshSubscription = async () => {
    setIsChecking(true);
    try {
      const data = await apiAgent.get<SubscriptionStatusResponse>(
        "/auth/subscription",
      );
      setSubscription(data);
      auth.user = auth.user
        ? {
            ...auth.user,
            subscriptionActive: data.isActive,
            subscriptionStatus: data.status,
            subscriptionEndsAt: data.endsAt ?? null,
          }
        : auth.user;
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Не удалось проверить подписку",
      );
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPromoCode = async () => {
    const code = promoCode.trim();
    if (!code) {
      toast.error("Введите промокод");
      return;
    }
    setIsApplyingPromo(true);
    try {
      const data = await apiAgent.post<
        { promoCode: string },
        SubscriptionStatusResponse
      >("/auth/subscription/redeem-promo", { promoCode: code });
      setSubscription(data);
      auth.user = auth.user
        ? {
            ...auth.user,
            subscriptionActive: data.isActive,
            subscriptionStatus: data.status,
            subscriptionEndsAt: data.endsAt ?? null,
          }
        : auth.user;
      toast.success("Промокод применён. Доступ открыт!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Не удалось применить промокод");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  if (hasActiveSubscription) {
    return <Navigate to="/sessions/list" replace />;
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-6 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-black">
      <div className="w-full max-w-xl rounded-2xl border border-black/10 dark:border-white/15 bg-white/85 dark:bg-zinc-900/75 backdrop-blur p-5 md:p-7">
        <h1 className="text-2xl font-bold text-center mb-2">Оформите подписку</h1>
        <p className="text-sm text-muted-foreground text-center mb-5">
          После оплаты доступ к приложению откроется автоматически.
        </p>

        <div className="flex justify-center mb-4">
          <iframe
            title="lava.top"
            style={{ border: "none" }}
            width="350"
            height="60"
            src={LAVA_WIDGET_URL}
          />
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={refreshSubscription}
            className="rounded-lg border border-black/10 dark:border-white/20 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
            disabled={isChecking}
          >
            {isChecking ? "Проверяем..." : "Я оформил подписку"}
          </button>
        </div>

        <div className="mt-5 border-t border-black/10 dark:border-white/15 pt-4">
          <p className="text-sm font-medium text-center mb-3">Есть промокод?</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Введите промокод"
              className="w-full rounded-lg border border-black/10 dark:border-white/20 bg-white/75 dark:bg-zinc-900/75 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/45"
              autoCapitalize="characters"
            />
            <button
              type="button"
              onClick={applyPromoCode}
              className="rounded-lg border border-black/10 dark:border-white/20 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 whitespace-nowrap"
              disabled={isApplyingPromo}
            >
              {isApplyingPromo ? "Применяем..." : "Применить"}
            </button>
          </div>
        </div>

        {isChecking && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Проверяем статус...
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionGatePage;
