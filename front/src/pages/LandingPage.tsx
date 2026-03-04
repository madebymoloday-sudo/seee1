import { useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import {
  Brain,
  Sparkles,
  MessageCircle,
  CreditCard,
  Map,
  Layers,
  Zap,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const LAVA_WIDGET_URL =
  "https://widget.lava.top/4cec9675-8ace-4321-8544-84142c34d6d8";

type Feature = {
  title: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const LandingPage = observer(() => {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref") || "";
  const subscriptionPath = ref ? `/subscription?ref=${ref}&utm_source=referral` : "/subscription";

  // Если вдруг в publicRouter оказались авторизованы (редкий случай) — не показываем лендинг.
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const features = useMemo<Feature[]>(
    () => [
      {
        title: "Быстро",
        text: "Разбор запускается за секунды: пишете ситуацию — получаете структуру и следующий шаг.",
        Icon: Zap,
      },
      {
        title: "Удобно",
        text: "Интерфейс как чат: можно отвечать коротко, длинно, возвращаться и уточнять мысль.",
        Icon: MessageCircle,
      },
      {
        title: "Глубоко",
        text: "Сессии идут по логике сильного ИИ, которая повторяет человеческое мышление и доводит до инсайтов.",
        Icon: Brain,
      },
      {
        title: "Интересно",
        text: "Это не похоже на классические психологические сессии — больше похоже на умный разбор смысла и причин.",
        Icon: Sparkles,
      },
    ],
    []
  );

  const domains = useMemo(
    () => [
      "Деньги",
      "Отношения",
      "Секс",
      "Здоровье",
      "Самооценка",
      "Тревога",
      "Работа",
      "Выгорание",
      "Семья",
      "Цели",
    ],
    []
  );

  const domainChipClasses = useMemo(
    () => [
      "border-emerald-200/70 bg-emerald-50 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
      "border-fuchsia-200/70 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-100",
      "border-amber-200/70 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100",
      "border-cyan-200/70 bg-cyan-50 text-cyan-950 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-100",
      "border-violet-200/70 bg-violet-50 text-violet-950 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100",
      "border-rose-200/70 bg-rose-50 text-rose-950 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100",
      "border-sky-200/70 bg-sky-50 text-sky-950 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-100",
      "border-orange-200/70 bg-orange-50 text-orange-950 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-100",
      "border-teal-200/70 bg-teal-50 text-teal-950 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-100",
      "border-indigo-200/70 bg-indigo-50 text-indigo-950 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-100",
    ],
    []
  );

  const featureAccentClasses = useMemo(
    () => [
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200",
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
      "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-black/45 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 select-none">
            <img
              src="/seee-logo-128.png"
              alt="Seee"
              className="h-9 w-9 rounded-full bg-white/90"
              draggable={false}
            />
            <div className="leading-tight">
              <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                Seee
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Разборы, нейрокарта, инсайты
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Войти</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to={subscriptionPath}>Оформить подписку</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1 text-sm text-zinc-800 dark:text-zinc-200">
              <ShieldCheck className="h-4 w-4" />
              <span>Приватно. Без “психотерапии”. По делу.</span>
            </div>

            <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Seee помогает разбирать ситуации так, как думает человек — но
              быстрее и глубже
            </h1>
            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">
              Вы описываете, что происходит в жизни. Seee задает правильные
              вопросы, вытаскивает ключевые мысли и эмоции и помогает увидеть
              новые причины, смыслы и решения.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-2xl">
                <Link to={subscriptionPath}>Оформить подписку и начать</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl">
                <Link to="/login">Уже есть аккаунт</Link>
              </Button>
            </div>

            <div className="mt-7 rounded-2xl border border-black/10 dark:border-white/15 bg-white/75 dark:bg-white/5 backdrop-blur p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-zinc-900 dark:text-white">
                <CreditCard className="h-4 w-4" />
                Оформить подписку
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  Оплата через Lava.top (кнопка-виджет).
                </div>
                <iframe
                  title="lava.top"
                  style={{ border: "none" }}
                  width="350"
                  height="60"
                  src={LAVA_WIDGET_URL}
                />
              </div>
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-4 gap-y-2">
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
          </div>

          {/* Right mock "image" */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-cyan-200/40 via-fuchsia-200/20 to-amber-200/30 dark:from-cyan-500/15 dark:via-fuchsia-500/10 dark:to-amber-500/10 blur-2xl rounded-[3rem]" />
            <div className="relative rounded-[2rem] border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-300" />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Демонстрация сессии
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                      коротко → глубже → вывод
                    </div>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  ~2–5 минут
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-zinc-100 dark:bg-white/10 p-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Seee
                  </div>
                  <div className="text-sm text-zinc-900 dark:text-white">
                    Опишите ситуацию, которая вас беспокоит, одной-двумя
                    фразами.
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-50 dark:from-cyan-500/15 dark:to-blue-500/10 p-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Вы
                  </div>
                  <div className="text-sm text-zinc-900 dark:text-white">
                    Я снова откладываю важное и потом чувствую вину.
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-100 dark:bg-white/10 p-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Seee
                  </div>
                  <div className="text-sm text-zinc-900 dark:text-white">
                    Какая мысль запускает это чувство вины? И что вы боитесь
                    потерять, если сделаете “идеально”?
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    <Layers className="h-4 w-4" /> Карточки
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    идеи “на разбор”
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    <Map className="h-4 w-4" /> Нейрокарта
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    мысли → эмоции
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                    <Search className="h-4 w-4" /> Инсайт
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    новый взгляд
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[2rem] border border-black/10 dark:border-white/15 bg-gradient-to-br from-white/90 to-slate-50/60 dark:from-white/5 dark:to-white/0 backdrop-blur p-6">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
            Почему это работает
          </h2>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            Seee основан на логике сильного ИИ, который шаг за шагом повторяет
            структуру человеческого мышления, но не “лечит”, а помогает понять.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ title, text, Icon }, idx) => (
              <div
                key={title}
                className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur p-4"
              >
                <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-semibold">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-black/10 dark:border-white/15 ${featureAccentClasses[idx % featureAccentClasses.length]}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {title}
                </div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Domains */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-[2rem] border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur p-6">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
            Можно разбирать любые темы
          </h2>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            Не важно, что это: деньги, секс, отношения или здоровье — механика
            одинакова: ситуация → мысль → эмоция → последствия → вывод.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {domains.map((d, idx) => (
              <span
                key={d}
                className={`rounded-full border px-3 py-1 text-sm ${domainChipClasses[idx % domainChipClasses.length]}`}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Neuro map */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-[2rem] border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1 text-sm text-zinc-800 dark:text-zinc-200">
                <Map className="h-4 w-4" />
                <span>Нейрокарта</span>
              </div>
              <h2 className="mt-4 text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
                Ситуация → эмоции → мысли — и дальше разбор “как по нейронам”
              </h2>
              <p className="mt-3 text-zinc-700 dark:text-zinc-300">
                Нейрокарта помогает увидеть ситуацию со стороны: какие эмоции в ней
                включаются и какие мысли эти эмоции “держат”. По сути, это карта того,
                как работает ваша внутренняя нейросеть — и сильный ИИ повторяет эту
                логику, чтобы разбирать быстро и глубоко.
              </p>
              <p className="mt-3 text-zinc-700 dark:text-zinc-300">
                После заполнения нейрокарты система может предложить карточки,
                которые полезно разобрать — например, с пометкой “Рекомендовано вам”.
              </p>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="rounded-2xl">
                  <Link to={subscriptionPath}>Оформить подписку</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl">
                  <Link to="/login">Войти</Link>
                </Button>
              </div>

              <div className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
                Важно: Seee — не медицинский сервис и не заменяет врача. Это инструмент
                для анализа и понимания.
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-tr from-cyan-200/35 via-fuchsia-200/20 to-amber-200/30 dark:from-cyan-500/12 dark:via-fuchsia-500/10 dark:to-amber-500/10 blur-2xl rounded-[3rem]" />

              <div className="relative rounded-[2rem] border border-black/10 dark:border-white/15 bg-white/85 dark:bg-white/5 backdrop-blur p-5 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Пример нейрокарты
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    1 ситуация → несколько веток
                  </div>
                </div>

                {/* Mind map mock */}
                <div className="mt-4 relative h-[320px] rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 overflow-hidden">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 640 320"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="mmLine" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="rgba(0,0,0,0.18)" />
                        <stop offset="1" stopColor="rgba(0,0,0,0.06)" />
                      </linearGradient>
                      <linearGradient id="mmLineDark" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="rgba(255,255,255,0.20)" />
                        <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
                      </linearGradient>
                    </defs>

                    {/* Situation to emotions */}
                    <path
                      d="M 170 160 C 245 160, 260 70, 330 70"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 170 160 C 245 160, 260 160, 330 160"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 170 160 C 245 160, 260 250, 330 250"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />

                    {/* Emotions to thoughts */}
                    <path
                      d="M 450 70 C 510 70, 525 48, 590 48"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 450 70 C 510 70, 525 92, 590 92"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 450 160 C 510 160, 525 138, 590 138"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 450 160 C 510 160, 525 182, 590 182"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 450 250 C 510 250, 525 228, 590 228"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 450 250 C 510 250, 525 272, 590 272"
                      stroke="url(#mmLine)"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>

                  {/* Nodes */}
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Ситуация
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white max-w-[150px]">
                        “Я снова откладываю важное”
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-[52%] top-6 -translate-x-1/2">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-gradient-to-br from-fuchsia-100 to-rose-50 dark:from-fuchsia-500/15 dark:to-rose-500/10 px-3 py-2 shadow-sm">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Эмоция
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Тревога
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-[52%] top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-500/15 dark:to-orange-500/10 px-3 py-2 shadow-sm">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Эмоция
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Вина
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-[52%] bottom-6 -translate-x-1/2">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-gradient-to-br from-cyan-100 to-blue-50 dark:from-cyan-500/15 dark:to-blue-500/10 px-3 py-2 shadow-sm">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Эмоция
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Усталость
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-3 top-6">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm max-w-[170px]">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Мысли
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        “Я не справлюсь”
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-3 top-[86px]">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm max-w-[170px]">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Мысли
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        “Надо идеально”
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-3 top-[132px]">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm max-w-[170px]">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Мысли
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        “Меня осудят”
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-3 top-[176px]">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm max-w-[170px]">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Мысли
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        “Это про меня”
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-3 top-[222px]">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm max-w-[170px]">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Мысли
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        “Сил нет”
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-3 top-[266px]">
                    <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/30 px-3 py-2 shadow-sm max-w-[170px]">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Мысли
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        “Надо отдохнуть”
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blurred "session" continuation + recommended card */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 p-3 overflow-hidden">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Сессия (продолжение)
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="rounded-xl bg-zinc-100 dark:bg-white/10 p-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Seee
                        </div>
                        <div className="text-sm text-zinc-900 dark:text-white">
                          Какая мысль запускает эту эмоцию?
                        </div>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-cyan-100 to-blue-50 dark:from-cyan-500/15 dark:to-blue-500/10 p-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Вы
                        </div>
                        <div className="text-sm text-zinc-900 dark:text-white">
                          “Если не идеально — значит провал”
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 backdrop-blur-[2px] bg-white/0 pointer-events-none" />
                    <div className="absolute right-3 bottom-3 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {/* intentionally blurred */}
                      в разборе дальше...
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Карточка на разбор
                      </div>
                      <span className="inline-flex items-center rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                        Рекомендовано вам
                      </span>
                    </div>
                    <div className="mt-2 rounded-2xl border border-black/10 dark:border-white/15 bg-gradient-to-br from-amber-100 to-rose-50 dark:from-amber-500/15 dark:to-rose-500/10 p-3">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Идея
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                        “Надо идеально”
                      </div>
                      <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                        Предстоит изучить → в пару кликов начать разбор
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="rounded-[2rem] border border-black/10 dark:border-white/15 bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-white/0 backdrop-blur p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
                Попробуйте Seee сегодня
              </h2>
              <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                Зарегистрируйтесь и начните разбор первой ситуации. Если хотите
                сразу оформить подписку — кнопка ниже.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="rounded-2xl">
                  <Link to={subscriptionPath}>Оформить подписку</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl">
                  <Link to="/login">Войти</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/75 dark:bg-white/5 backdrop-blur p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-zinc-900 dark:text-white">
                <CreditCard className="h-4 w-4" />
                Оплата Lava.top
              </div>
              <iframe
                title="lava.top"
                style={{ border: "none" }}
                width="350"
                height="60"
                src={LAVA_WIDGET_URL}
              />
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Если виджет не отображается — откройте страницу в браузере без
                блокировщиков.
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Seee</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://t.me/SeeeAppBot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Связь с поддержкой
            </a>
            <Link to="/forgot-password" className="hover:underline">
              Забыли пароль?
            </Link>
            <Link to={subscriptionPath} className="hover:underline">
              Регистрация
            </Link>
            <Link to="/legal/offer" className="hover:underline">
              Оферта
            </Link>
            <Link to="/legal/privacy" className="hover:underline">
              Политика ПДн
            </Link>
            <Link to="/legal/refund" className="hover:underline">
              Возвраты
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
});

export default LandingPage;

