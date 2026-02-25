import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const PAYMENT_DONE_KEY = "seee_payment_completed";
const TTL_MS = 60 * 60 * 1000; // 1 hour

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    try {
      sessionStorage.setItem(PAYMENT_DONE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  const ref = searchParams.get("ref") || "";
  const registerLink = ref ? `/register?ref=${encodeURIComponent(ref)}` : "/register";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-white dark:from-zinc-950 dark:to-black">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/15 bg-white/85 dark:bg-white/5 backdrop-blur p-6 shadow-sm text-center">
        <CheckCircle className="mx-auto h-14 w-14 text-emerald-500 dark:text-emerald-400" />
        <h1 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">
          Оплата прошла успешно
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Теперь создайте аккаунт или войдите, если он уже есть.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="rounded-2xl">
            <Link to={registerLink}>Перейти к регистрации</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-2xl">
            <Link to="/login">Войти</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export { PAYMENT_DONE_KEY, TTL_MS };
