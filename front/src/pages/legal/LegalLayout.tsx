import { Link } from "react-router-dom";

type LegalLayoutProps = {
  title: string;
  updatedAt?: string;
  children: React.ReactNode;
};

export default function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-black/45 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm font-semibold text-zinc-900 dark:text-white hover:underline"
          >
            Seee
          </Link>
          <Link
            to="/"
            className="text-sm text-zinc-600 dark:text-zinc-300 hover:underline"
          >
            На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
              {title}
            </h1>
            {updatedAt ? (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Обновлено: {updatedAt}
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-8 text-xs text-zinc-600 dark:text-zinc-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>Seee</div>
          <a
            href="https://t.me/SeeeAppBot"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Связь с поддержкой (Telegram бот)
          </a>
        </div>
      </footer>
    </div>
  );
}

