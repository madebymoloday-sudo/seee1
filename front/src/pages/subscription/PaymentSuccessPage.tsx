import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PAYMENT_DONE_KEY = "seee_payment_completed";
const TTL_MS = 60 * 60 * 1000; // 1 hour

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref") || "";
    try {
      sessionStorage.setItem(PAYMENT_DONE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    navigate(`/register${query}`, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-zinc-950 dark:to-black">
      <p className="text-zinc-600 dark:text-zinc-400">Переход к регистрации...</p>
    </div>
  );
}

export { PAYMENT_DONE_KEY, TTL_MS };
