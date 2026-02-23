import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

const FIRST_SCALE_QUESTION_IDS = ['q1', 'q3', 'q5', 'q7'];
const TOTAL_STEPS = 17;

interface QuestionSpec {
  id: string;
  step: number;
  type: string;
  short_label: string;
  sphere_id?: string;
  text?: string;
  main?: string;
  elaboration?: string;
}

interface TestSpec {
  intro: { text: string; text_formatted?: string; text_formatted_html?: string };
  questions: QuestionSpec[];
  spheres: Array<{ id: string; name: string; order: number }>;
  message_level_and_12_points?: { structure: string; generation_note: string };
  sales_message: { template: string };
  cards_logic: {
    if_app_linked: { message: string };
    if_no_subscription_or_not_linked: { message: string };
  };
}

export interface PersonalityTestState {
  step: number;
  answers: Record<string, string | number>;
}

@Injectable()
export class PersonalityTestService {
  private readonly logger = new Logger(PersonalityTestService.name);
  private spec: TestSpec | null = null;
  private readonly stateByChat = new Map<number, PersonalityTestState>();

  constructor(private readonly configService: ConfigService) {
    this.loadSpec();
  }

  private loadSpec() {
    // Сборка Nest: .js лежит в dist/src/telegram-bot/; asset копирует JSON в dist/telegram-bot/
    const cwd = process.cwd();
    const candidates = [
      path.join(__dirname, 'telegram_test_prompt.json'),
      path.join(__dirname, '..', '..', 'telegram-bot', 'telegram_test_prompt.json'),
      path.join(__dirname, '..', '..', '..', 'telegram_test_prompt.json'),
      path.join(cwd, 'telegram_test_prompt.json'),
      path.join(cwd, 'dist', 'telegram_test_prompt.json'),
      path.join(cwd, 'dist', 'src', 'telegram-bot', 'telegram_test_prompt.json'),
      path.join(cwd, 'dist', 'telegram-bot', 'telegram_test_prompt.json'),
      path.join(cwd, 'back', 'telegram_test_prompt.json'),
      path.join(cwd, 'back', 'dist', 'src', 'telegram-bot', 'telegram_test_prompt.json'),
      path.join(cwd, 'src', 'telegram-bot', 'telegram_test_prompt.json'),
      path.join(cwd, '..', 'telegram_test_prompt.json'),
    ];
    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const raw = fs.readFileSync(p, 'utf-8');
        this.spec = JSON.parse(raw) as TestSpec;
        this.logger.log(`Personality test spec loaded from ${p}`);
        return;
      } catch (e: any) {
        this.logger.warn(`Personality test spec load failed (${p}): ${e?.message}`);
      }
    }
    this.logger.warn('Personality test spec not loaded (no valid file found)');
  }

  getSpec(): TestSpec | null {
    return this.spec;
  }

  isTestAvailable(): boolean {
    return this.spec !== null;
  }

  getState(chatId: number): PersonalityTestState | undefined {
    return this.stateByChat.get(chatId);
  }

  isInProgress(chatId: number): boolean {
    const s = this.stateByChat.get(chatId);
    return s != null && s.step >= 1 && s.step <= TOTAL_STEPS;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private getQuestionDisplayText(q: QuestionSpec): string {
    if (q.main != null && q.main.length > 0) {
      const elaboration = q.elaboration?.trim();
      const main = this.escapeHtml(q.main);
      const elab = elaboration ? '\n\n' + this.escapeHtml(elaboration) : '';
      return `Вопрос ${q.step}: ${q.step}/${TOTAL_STEPS} — <b>${main}</b>${elab}`;
    }
    return q.text ?? '';
  }

  /** Сбросить тест для чата (например при /start). */
  resetTest(chatId: number): void {
    this.stateByChat.delete(chatId);
  }

  startTest(chatId: number): { intro: string; introFormatted: string; introFormattedHtml: string; firstQuestion: string } | null {
    if (!this.spec) return null;
    this.stateByChat.set(chatId, { step: 0, answers: {} });
    const q = this.spec.questions.find((x) => x.step === 1);
    const introFormatted = this.spec.intro.text_formatted || this.spec.intro.text;
    const introFormattedHtml =
      (this.spec.intro as { text_formatted_html?: string }).text_formatted_html || introFormatted;
    return {
      intro: this.spec.intro.text,
      introFormatted,
      introFormattedHtml,
      firstQuestion: q ? this.getQuestionDisplayText(q) : '',
    };
  }

  sendIntroAndFirstQuestion(chatId: number): { intro: string; firstQuestion: string } | null {
    const out = this.startTest(chatId);
    if (!out) return null;
    const q = this.spec!.questions.find((x) => x.step === 1);
    if (q) {
      const state = this.stateByChat.get(chatId)!;
      state.step = 1;
    }
    return out;
  }

  getQuestion(step: number): { id: string; text: string; type: string } | null {
    if (!this.spec) return null;
    const q = this.spec.questions.find((x) => x.step === step);
    return q ? { id: q.id, text: this.getQuestionDisplayText(q), type: q.type } : null;
  }

  parseScaleAnswer(text: string): number | null {
    const t = text.trim().toLowerCase();
    if (/затрудняюсь|затрудняюсь ответить/.test(t)) return 3;
    const n = parseInt(text.trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    const match = text.trim().match(/\b([1-9]|10)\b/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 10) return num;
    }
    return null;
  }

  /** После интро пользователь ответил — отдаём первый вопрос и переводим шаг в 1. */
  advanceToFirstQuestion(chatId: number): string | null {
    const state = this.stateByChat.get(chatId);
    if (!state || !this.spec || state.step !== 0) return null;
    const q = this.spec.questions.find((x) => x.step === 1);
    state.step = 1;
    return q ? this.getQuestionDisplayText(q) : null;
  }

  handleAnswer(
    chatId: number,
    text: string,
  ): { nextQuestion: string | null; done: boolean; answers?: Record<string, string | number>; error?: string } {
    const state = this.stateByChat.get(chatId);
    if (!state || !this.spec) {
      return { nextQuestion: null, done: false, error: 'Тест не найден.' };
    }

    const current = this.spec.questions.find((q) => q.step === state.step);
    if (!current) {
      return { nextQuestion: null, done: false, error: 'Шаг не найден.' };
    }

    if (current.type === 'scale_1_10') {
      const num = this.parseScaleAnswer(text);
      if (num === null) {
        return {
          nextQuestion: null,
          done: false,
          error: 'Ответьте числом от 1 до 10 или напишите «затрудняюсь ответить».',
        };
      }
      state.answers[current.id] = num;
    } else {
      state.answers[current.id] = text.trim().slice(0, 2000);
    }

    if (state.step >= TOTAL_STEPS) {
      const answers = { ...state.answers };
      this.stateByChat.delete(chatId);
      return { nextQuestion: null, done: true, answers };
    }

    state.step += 1;
    const next = this.spec.questions.find((q) => q.step === state.step);
    return {
      nextQuestion: next ? this.getQuestionDisplayText(next) : null,
      done: false,
    };
  }

  computeLevel(answers: Record<string, string | number>): number {
    let sum = 0;
    for (const id of FIRST_SCALE_QUESTION_IDS) {
      const v = answers[id];
      if (typeof v === 'number') sum += Math.max(1, Math.min(10, v));
      else if (v === undefined || String(v).toLowerCase().includes('затрудняюсь')) sum += 3;
      else {
        const n = parseInt(String(v), 10);
        sum += Number.isFinite(n) && n >= 1 && n <= 10 ? n : 3;
      }
    }
    const level = Math.round((sum / FIRST_SCALE_QUESTION_IDS.length) * 10);
    return Math.max(1, Math.min(100, level));
  }

  /** Одна строка: уровень человеческого развития по всем критериям (жирным). */
  getLevelDescriptionBold(level: number): string {
    return `**Ваш уровень человеческого развития по всем критериям: ${level} из 100.**`;
  }

  /** Обратная связь по ответам на внесферные вопросы (не 4 сферы). Отправляется перед блоком по 4 сферам. */
  async generateExtraFeedback(answers: Record<string, string | number>): Promise<string> {
    if (!this.spec) return '';
    const extraQuestions = this.spec.questions.filter((q) => (q as QuestionSpec & { sphere_id?: string }).sphere_id === 'extra');
    if (extraQuestions.length === 0) return '';
    const extraEntries = extraQuestions
      .map((q) => {
        const v = answers[q.id];
        return `${q.short_label || q.id}: ${v ?? '—'}`;
      })
      .join('\n');
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) return '';

    const systemPrompt = `Ты — психолог в стиле Seee. На основе только этих ответов пользователя (на вопросы не про 4 сферы жизни) напиши один связный текст обратной связи. Обязательно включи все блоки по пунктам.

Важно: каждый пункт начинай с жирной буквы — именно в формате **А)**, **Б)**, **В)**, **Г)**, **Д)**, **Е)**, **Ж)**, **З)** (буква и скобка жирным через **). После скобки — название блока, его тоже можно выделить жирным.

**А)** Отметь, что до конца теста доходят не многие — лишь около 10%. Скажи, что этот человек — уникальная личность.

**Б) Твои скрытые мощные стороны** — что в ответах выдаёт сильные стороны, о которых человек мог не задумываться.

**В) Твои слепые зоны** — что человек не замечает в себе или в ситуации.

**Г) Куда направить усилия** — 1–3 конкретных направления по ответам.

**Д) Чего ты боишься** — какие страхи или ограничения просматриваются в ответах.

**Е) Что ты о себе не осознаёшь** — неочевидные выводы из ответов.

**Ж) Пять слабых сторон** — бережно, но честно, по ответам.

**З) Скрытая информация о вас: что мешает раскрыться на 100%?** — итоговый блок: что, судя по ответам, больше всего мешает полной реализации.

Тон: тёплый, поддерживающий, без осуждения. Опирайся только на приведённые ответы. Пиши развёрнуто, но структурированно. Все заголовки пунктов (А)–З)) обязательно в формате **А)**, **Б)** и т.д.`;

    const userPrompt = `Ответы пользователя на дополнительные вопросы:\n\n${extraEntries}\n\nНапиши обратную связь по описанной структуре (А–З).`;

    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2000,
          temperature: 0.6,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 60000,
        },
      );
      const content = res.data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content.trim();
    } catch (e: any) {
      this.logger.error(`OpenAI extra feedback generation failed: ${e?.message}`);
    }
    return '';
  }

  async generate4Points(answers: Record<string, string | number>): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set, returning placeholder for 4 points');
      return this.getFallback4Points();
    }

    const level = this.computeLevel(answers);
    const answersText = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const systemPrompt = `Ты — психолог в стиле Seee. На основе ответов пользователя сформируй 4 блока — по одному на сферу. Для каждой сферы выведи ровно 4 строки в формате (используй ** только для этих заголовков):

**N. Название сферы**
**Что получается:** один короткий тезис — что у человека уже хорошо получается в этой сфере.
**Что доработать:** что конкретно стоит улучшить.
**Возможные последствия:** разложи цепочку последствий — что будет, если не работать над этим. Пиши так, чтобы вызвать осознание: сначала ближайшее следствие (например, отказ от спорта → меньше митохондрий → снижение тонуса мышц → падение энергии → риск заболеваний, ожирения, проблем с костями и позвоночником). Цепочка из 3–5 звеньев, конкретно и по делу, чтобы человек почувствовал последствия.
**Что рекомендую разобрать в Seee:** структура строго такая: а) Зачастую проблемы в этой сфере связаны не с внешними условиями, а с ограничивающими убеждениями, которые запускают лень, страхи или комплексы. б) Чаще всего встречаются такие убеждения, которые формируют чувство [назови типичные для сферы]. в) В твоём случае рекомендую разобрать в Seee следующие карточки: «название карточки 1», «название карточки 2», «название карточки 3» — придумай конкретные формулировки под ответы человека. В конце добавь одну фразу: это поможет начать движение, потому что в голове хранятся все команды, а мозг управляет нашим поведением.

Сферы по порядку: Секс, Реализация, Здоровье, Отношения.
Тон: поддерживающий, мотивирующий, бережный. Опирайся на ответы. Между блоками оставляй одну пустую строку.`;

    const userPrompt = `Уровень пользователя по тесту: ${level} из 100.\n\nОтветы пользователя:\n${answersText}\n\nСформируй 4 блока по описанному формату.`;

    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.6,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 60000,
        },
      );
      const content = res.data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content.trim();
    } catch (e: any) {
      this.logger.error(`OpenAI 4 points generation failed: ${e?.message}`);
    }
    return this.getFallback4Points();
  }

  private getFallback4Points(): string {
    const spheres = ['Секс', 'Реализация', 'Здоровье', 'Отношения'];
    return spheres
      .map(
        (s, i) =>
          `**${i + 1}. ${s}**\n**Что получается:** есть зона для роста.\n**Что доработать:** проработать ограничивающие убеждения.\n**Возможные последствия:** без изменений прогресс замедлится, энергия и качество жизни могут снизиться.\n**Что рекомендую разобрать в Seee:** ограничивающие убеждения в этой сфере — разобрать в приложении карточки по темам, которые ты указал в ответах.`,
      )
      .join('\n\n');
  }

  getLevelMessage(level: number, fourPoints: string): string {
    const nextLevel = Math.min(100, level + 1);
    return (
      `**Твой уровень: ${level} из 100.**\n\n` +
      `**Вот из чего складываются твои баллы по 4 сферам:**\n\n` +
      fourPoints +
      `\n\n**Чтобы перейти на уровень ${nextLevel}**, проработай каждую сферу выше — особенно блок «Что рекомендую разобрать в Seee».`
    );
  }

  getSalesMessage(): string {
    const link = this.getLandingLink();
    if (!this.spec) return `Узнай больше о Seee: ${link}`;
    return this.spec.sales_message.template.replace(/\{subscription_link\}/g, link);
  }

  getCardsMessage(hasLinkedAccount: boolean): string {
    if (!this.spec) return 'Зайди на сайт Seee — там можно начать работу над карточками.';
    return hasLinkedAccount
      ? this.spec.cards_logic.if_app_linked.message
      : this.spec.cards_logic.if_no_subscription_or_not_linked.message;
  }

  /** Ссылка на лендинг (главная страница), не на оплату. */
  getLandingLink(): string {
    const base = this.configService.get<string>('FRONTEND_URL') || 'https://front-production-4a7e.up.railway.app';
    return base.replace(/\/+$/, '');
  }

  /** Объединённое сообщение: карточки + как проходит разбор + польза + ссылка на лендинг. */
  getMergedSalesAndCardsMessage(hasLinkedAccount: boolean): string {
    const cardsIntro =
      'Я записал эти тезисы и добавил их в твой профиль Seee — ты сможешь разобрать каждую сферу в приложении.\n\n';
    const parts = [
      'Всё, что ты увидел — твои реальные зоны роста.',
      'В Seee ты можешь прорабатывать каждую из 4 сфер по шагам: осознать убеждение, увидеть, откуда оно взялось, и заменить на то, что тебе нужно.',
      'Процесс такой: ты выбираешь ситуацию или мысль, которая тебя беспокоит, а ИИ ведёт тебя через вопросы к ясности — без советов и оценок. В итоге ты сам находишь опору и новое решение, а не получаешь готовый ответ. Так прорабатываются и убеждения из теста: по шагам, в своём темпе, с конкретной пользой — меньше тревоги, яснее цели, устойчивее отношения и состояние.',
      'Переходи по ссылке и узнай больше 👇',
    ];
    const landingLink = this.getLandingLink();
    return cardsIntro + parts.join('\n\n') + '\n\n' + landingLink + ' ✨';
  }

  /** Генерирует текст расшифровки личности (для второго DOCX). */
  async generateDecodingText(
    answers: Record<string, string | number>,
    level: number,
    fourPoints: string,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const answersText = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const systemPrompt = `Ты — опытный психолог, который пишет глубокий персональный анализ личности (как подробная расшифровка для клиента). На основе ответов пользователя напиши развёрнутый, тёплый, но содержательный текст. Обязательно: 1) Похвали конкретные сильные стороны и нестандартные качества, которые видишь в ответах. 2) Укажи 2–4 наиболее «болезненные» или уязвимые зоны для роста — темы, которые человеку реально стоит проработать в первую очередь, с бережной формулировкой. 3) Дай неочевидные инсайты: что в ответах может говорить о паттернах, ценностях, защитах — то, что человек мог не осознавать. 4) Структура: вступление; блоки по темам (сферы жизни, ценности, сильные стороны, барьеры, эмоциональное состояние, отношения, планы); в конце НЕ добавляй блок про Seee — его добавим отдельно. Пиши подробно, как в качественном персональном отчёте: объёмный, с конкретикой из ответов. Тон: бережный, поддерживающий, без клише. Без markdown (** и т.п.), обычный текст.`;

    const userPrompt = `Уровень по тесту: ${level} из 100.\n\n4 пункта по сферам:\n${fourPoints}\n\nОтветы пользователя:\n${answersText}\n\nНапиши глубокую персональную расшифровку: похвали, укажи болезненные зоны роста, дай нестандартные инсайты.`;

    try {
      if (apiKey) {
        const res = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 2500,
            temperature: 0.6,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 90000,
          },
        );
        const content = res.data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) return content.trim();
      }
    } catch (e: any) {
      this.logger.error(`OpenAI decoding generation failed: ${e?.message}`);
    }
    return 'На основе твоих ответов видно сильные стороны и зоны роста. Seee поможет проработать убеждения и двигаться вперёд в каждой сфере.';
  }

  /** Блок про Seee для конца файла расшифровки. */
  private getSeeeBlockForDoc(): string {
    return [
      'Как Seee может помочь вам',
      '',
      'Seee — это инструмент для осознанного управления мышлением и эмоциями. Он помогает не просто знать свои слабые места, а по шагам разбирать ограничивающие убеждения, видеть, откуда они взялись, и заменять их на то, что вам действительно нужно.',
      '',
      'В Seee вы можете прорабатывать каждую сферу жизни: секс, реализацию, здоровье, отношения. Искусственный интеллект ведёт вас через вопросы и рефлексию, в бережном и поддерживающем тоне. Многие запросы, о которых вы рассказали в тесте, можно решать именно через такую пошаговую работу в приложении.',
      '',
      'Мы будем рады поддержать вас на этом пути. Переходите в Seee и начинайте — ваши карточки уже ждут вас там.',
    ].join('\n');
  }

  /** Собирает DOCX «Вопросы и ответы». */
  async buildDocxQa(answers: Record<string, string | number>): Promise<Buffer> {
    if (!this.spec) throw new Error('Spec not loaded');
    const children: Paragraph[] = [
      new Paragraph({
        text: 'Вопросы и ответы — Seee',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        text: `Дата: ${new Date().toLocaleString('ru-RU')}`,
        spacing: { after: 300 },
      }),
    ];
    for (const q of this.spec.questions) {
      const label = q.short_label || q.main || q.id;
      const answer = answers[q.id] ?? '—';
      const answerStr = typeof answer === 'number' ? String(answer) : String(answer);
      children.push(
        new Paragraph({
          children: [new TextRun({ text: label, bold: true })],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          text: `Ответ: ${answerStr}`,
          spacing: { after: 200 },
        }),
      );
    }
    const doc = new Document({
      sections: [{ children }],
    });
    return await Packer.toBuffer(doc);
  }

  /** Собирает DOCX «Расшифровка личности» (текст + блок Seee). */
  async buildDocxDecoding(decodingText: string): Promise<Buffer> {
    const seeeBlock = this.getSeeeBlockForDoc();
    const fullText = decodingText.trim() + '\n\n' + seeeBlock;
    const paragraphs = fullText.split(/\n\n+/).map(
      (block) =>
        new Paragraph({
          text: block.replace(/\n/g, ' '),
          spacing: { after: 200 },
        }),
    );
    const children: Paragraph[] = [
      new Paragraph({
        text: 'Расшифровка личности — Seee',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        text: `Дата: ${new Date().toLocaleString('ru-RU')}`,
        spacing: { after: 400 },
      }),
      ...paragraphs,
    ];
    const doc = new Document({
      sections: [{ children }],
    });
    return await Packer.toBuffer(doc);
  }

  /** Возвращает два буфера DOCX: [вопросы-ответы, расшифровка]. */
  async getDocxBuffers(
    answers: Record<string, string | number>,
    level: number,
    fourPoints: string,
  ): Promise<[Buffer, Buffer]> {
    const decodingText = await this.generateDecodingText(answers, level, fourPoints);
    let qaBuf: Buffer;
    let decodingBuf: Buffer;
    try {
      qaBuf = await this.buildDocxQa(answers);
    } catch (e: any) {
      this.logger.error(`buildDocxQa failed: ${e?.message} ${e?.stack || ''}`);
      throw e;
    }
    try {
      decodingBuf = await this.buildDocxDecoding(decodingText);
    } catch (e: any) {
      this.logger.error(`buildDocxDecoding failed: ${e?.message} ${e?.stack || ''}`);
      throw e;
    }
    return [qaBuf, decodingBuf];
  }
}
