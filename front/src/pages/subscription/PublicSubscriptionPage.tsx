import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAVA_WIDGET_URL =
  "https://widget.lava.top/4cec9675-8ace-4321-8544-84142c34d6d8";

export default function PublicSubscriptionPage() {
  const [params] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const ref = params.get("ref") || params.get("utm_source") || "";

  useEffect(() => {
    // Save referral context for later (optional)
    const raw = params.toString();
    if (!raw) return;
    try {
      localStorage.setItem("seee_ref_params", raw);
    } catch {
      // ignore
    }
  }, [params]);

  const shareLink = useMemo(() => {
    const base = `${window.location.origin}/subscription`;
    return ref ? `${base}?${params.toString()}` : base;
  }, [params, ref]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-black/45 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="text-sm font-semibold text-zinc-900 dark:text-white">
            Seee
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Войти</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/">На главную</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-black/10 dark:border-white/15 bg-white/85 dark:bg-white/5 backdrop-blur p-6 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-semibold">
            <CreditCard className="h-5 w-5" />
            <h1 className="text-2xl font-bold">Оплата подписки</h1>
          </div>

          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Нажмите кнопку ниже, чтобы оплатить подписку. После оплаты откроется страница с переходом к регистрации.
            Уже есть аккаунт — войдите.
          </p>

          {ref ? (
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Реферальный переход: <span className="font-mono">{ref}</span>
            </div>
          ) : null}

          <div className="mt-6 flex justify-center">
            <iframe
              title="lava.top"
              style={{ border: "none" }}
              width="350"
              height="60"
              src={LAVA_WIDGET_URL}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 p-4">
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              Контакты и документы
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <a
                href="https://t.me/SeeeAppBot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Связь с поддержкой (Telegram)
              </a>
              <Link to="/legal/offer" className="hover:underline">
                Оферта
              </Link>
              <Link to="/legal/privacy" className="hover:underline">
                Персональные данные
              </Link>
              <Link to="/legal/refund" className="hover:underline">
                Возвраты
              </Link>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Если нужно — можно поделиться этой страницей.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLink);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  // ignore
                }
              }}
            >
              {copied ? "Скопировано" : "Скопировать ссылку"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

