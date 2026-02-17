import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
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
              <Link to="/register">Начать</Link>
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
                <Link to="/register">Создать аккаунт</Link>
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
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
          Почему это работает
        </h2>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          Seee основан на логике сильного ИИ, который шаг за шагом повторяет
          структуру человеческого мышления, но не “лечит”, а помогает понять.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ title, text, Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur p-4"
            >
              <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-semibold">
                <Icon className="h-5 w-5" />
                {title}
              </div>
              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {text}
              </div>
            </div>
          ))}
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
            {domains.map((d) => (
              <span
                key={d}
                className="rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1 text-sm text-zinc-800 dark:text-zinc-200"
              >
                {d}
              </span>
            ))}
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
                  <Link to="/register">Начать бесплатно</Link>
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
            <Link to="/forgot-password" className="hover:underline">
              Забыли пароль?
            </Link>
            <Link to="/register" className="hover:underline">
              Регистрация
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
});

export default LandingPage;

