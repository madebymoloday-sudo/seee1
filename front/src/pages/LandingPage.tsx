import { Link, Navigate, useSearchParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import {
  ArrowDownRight,
  ArrowRight,
  Brain,
  Map,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import styles from "./LandingPage.module.css";

const LAVA_WIDGET_URL =
  "https://widget.lava.top/4cec9675-8ace-4321-8544-84142c34d6d8";

const steps = [
  {
    number: "01",
    title: "Назовите ситуацию",
    text: "Не нужно готовиться. Опишите то, что происходит, своими словами.",
    color: "sky",
  },
  {
    number: "02",
    title: "Увидьте связь",
    text: "Seee помогает связать событие, мысль, эмоцию и последствия.",
    color: "grass",
  },
  {
    number: "03",
    title: "Дойдите до сути",
    text: "Вопрос за вопросом вы находите собственный ответ, а не чужой совет.",
    color: "sunset",
  },
] as const;

const topics = [
  "отношения",
  "деньги",
  "тревога",
  "выгорание",
  "самооценка",
  "семья",
  "работа",
  "цели",
];

const LandingPage = observer(() => {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref") || "";
  const subscriptionPath = ref
    ? `/subscription?ref=${ref}&utm_source=referral`
    : "/subscription";

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <img src="/seee-logo-128.png" alt="" className={styles.brandLogo} />
            <span>Seee</span>
          </Link>

          <nav className={styles.headerActions} aria-label="Основная навигация">
            <Link to="/login" className={styles.textLink}>
              Войти
            </Link>
            <Button asChild size="sm">
              <Link to={subscriptionPath}>Начать</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <ShieldCheck aria-hidden="true" />
              Пространство для честного разговора с собой
            </div>

            <h1>
              Увидеть
              <br />
              то, что
              <br />
              <span>управляет</span>
              <br />
              вами.
            </h1>

            <p className={styles.heroText}>
              Seee разбирает сложную ситуацию на мысли, эмоции и причины,
              чтобы вы увидели целую картину и нашли свой следующий шаг.
            </p>

            <div className={styles.heroActions}>
              <Button asChild size="lg" className={styles.heroButton}>
                <Link to={subscriptionPath}>
                  Начать разбор <ArrowRight />
                </Link>
              </Button>
              <span>2–5 минут на одну мысль</span>
            </div>
          </div>

          <div className={styles.heroStage} aria-label="Визуальная модель Seee">
            <div className={styles.sunsetDisc} />
            <div className={styles.skyShape}>
              <span>мысль</span>
              <span>эмоция</span>
              <span>причина</span>
            </div>
            <div className={styles.grassShape} />
            <div className={styles.coreObject}>
              <div className={styles.coreHalo} />
              <div className={styles.core}>
                <img src="/seee-logo-128.png" alt="Seee" />
              </div>
              <p>Одна мысль.<br />Весь контекст.</p>
            </div>
          </div>

          <a href="#method" className={styles.scrollCue}>
            Как это работает <ArrowDownRight />
          </a>
        </section>

        <section id="method" className={styles.method}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionNumber}>001</span>
            <div>
              <p className={styles.kicker}>Метод</p>
              <h2>Не мотивация.<br />Ясность.</h2>
            </div>
            <p>
              Seee не говорит, что делать. Он задаёт точные вопросы и помогает
              увидеть убеждения, которые обычно остаются фоном.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            {steps.map((step) => (
              <article
                key={step.number}
                className={`${styles.stepCard} ${styles[step.color]}`}
              >
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.mapSection}>
          <div className={styles.mapCopy}>
            <p className={styles.kicker}>Нейрокарта</p>
            <h2>Мышление становится видимым.</h2>
            <p>
              Каждая сессия продолжает вашу карту. Ситуации, эмоции и мысли
              складываются в живую структуру, к которой можно вернуться.
            </p>
            <Link to="/login" className={styles.inlineLink}>
              Открыть свою карту <ArrowRight />
            </Link>
          </div>

          <div className={styles.mapVisual}>
            <div className={`${styles.mapNode} ${styles.mapSituation}`}>
              <span>Ситуация</span>
              Я откладываю важное
            </div>
            <div className={styles.mapLine} />
            <div className={styles.mapBranches}>
              <div className={`${styles.mapNode} ${styles.mapEmotion}`}>
                <span>Эмоция</span>
                Тревога
              </div>
              <div className={`${styles.mapNode} ${styles.mapThought}`}>
                <span>Мысль</span>
                Я не справлюсь
              </div>
              <div className={`${styles.mapNode} ${styles.mapDeep}`}>
                <span>Глубже</span>
                Меня будут оценивать
              </div>
            </div>
          </div>
        </section>

        <section className={styles.principles}>
          <div className={styles.principle}>
            <Brain />
            <h3>Глубоко</h3>
            <p>Вопросы идут от факта к причине, а не по кругу.</p>
          </div>
          <div className={styles.principle}>
            <MessageCircle />
            <h3>Естественно</h3>
            <p>Отвечайте коротко, подробно или голосом.</p>
          </div>
          <div className={styles.principle}>
            <Map />
            <h3>Связно</h3>
            <p>Новые мысли продолжают вашу личную нейрокарту.</p>
          </div>
          <div className={styles.principle}>
            <Sparkles />
            <h3>Ваше</h3>
            <p>Финальный ответ находите вы, а не алгоритм.</p>
          </div>
        </section>

        <div className={styles.topicRail} aria-label="Темы для разбора">
          {topics.concat(topics).map((topic, index) => (
            <span key={`${topic}-${index}`}>{topic} ·</span>
          ))}
        </div>

        <section className={styles.cta}>
          <div className={styles.ctaCopy}>
            <p className={styles.kicker}>Начните с одной мысли</p>
            <h2>Остальное<br />проявится.</h2>
            <p>
              Seee не заменяет специалиста и не ставит диагнозы. Это
              инструмент для самостоятельного анализа мышления.
            </p>
          </div>

          <div className={styles.paymentCard}>
            <span className={styles.paymentLabel}>Доступ к Seee</span>
            <h3>Оформить подписку</h3>
            <div className={styles.widgetWrap}>
              <iframe
                title="Оплата Lava.top"
                src={LAVA_WIDGET_URL}
                width="350"
                height="60"
              />
            </div>
            <Button asChild size="lg" className={styles.mobilePaymentButton}>
              <Link to={subscriptionPath}>Перейти к оплате</Link>
            </Button>
            <div className={styles.paymentLinks}>
              <Link to="/login">У меня есть аккаунт</Link>
              <a
                href="https://t.me/SeeeAppBot"
                target="_blank"
                rel="noopener noreferrer"
              >
                Поддержка
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <span>Seee © {new Date().getFullYear()}</span>
          <span>Создано для размышления</span>
        </div>
        <nav>
          <Link to="/legal/offer">Оферта</Link>
          <Link to="/legal/privacy">Данные</Link>
          <Link to="/legal/refund">Возвраты</Link>
        </nav>
      </footer>
    </div>
  );
});

export default LandingPage;
