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
const TOTAL_STEPS = 15;

interface QuestionSpec {
  id: string;
  step: number;
  type: string;
  short_label: string;
  text?: string;
  main?: string;
  elaboration?: string;
}

interface TestSpec {
  intro: { text: string; text_formatted?: string };
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

  private getQuestionDisplayText(q: QuestionSpec): string {
    if (q.main != null && q.main.length > 0) {
      const elaboration = q.elaboration?.trim();
      return `Вопрос ${q.step}: ${q.step}/${TOTAL_STEPS} — **${q.main}**${elaboration ? `\n\n${elaboration}` : ''}`;
    }
    return q.text ?? '';
  }

  /** Сбросить тест для чата (например при /start). */
  resetTest(chatId: number): void {
    this.stateByChat.delete(chatId);
  }

  startTest(chatId: number): { intro: string; introFormatted: string; firstQuestion: string } | null {
    if (!this.spec) return null;
    this.stateByChat.set(chatId, { step: 0, answers: {} });
    const q = this.spec.questions.find((x) => x.step === 1);
    const introFormatted = this.spec.intro.text_formatted || this.spec.intro.text;
    return {
      intro: this.spec.intro.text,
      introFormatted,
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
**Если пустить на самотёк:** что будет, если не работать над этим (1 предложение).
**Убеждение для разбора:** какую идею или ограничивающее убеждение нужно разобрать (1 предложение).

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
          `**${i + 1}. ${s}**\n**Что получается:** есть зона для роста.\n**Что доработать:** проработать ограничивающие убеждения.\n**Если пустить на самотёк:** прогресс в этой сфере замедлится.\n**Убеждение для разбора:** освободиться от установок, которые держат на месте.`,
      )
      .join('\n\n');
  }

  getLevelMessage(level: number, fourPoints: string): string {
    const nextLevel = Math.min(100, level + 1);
    return (
      `**Твой уровень: ${level} из 100.**\n\n` +
      `**Вот из чего складываются твои баллы по 4 сферам:**\n\n` +
      fourPoints +
      `\n\n**Чтобы перейти на уровень ${nextLevel}**, проработай каждую сферу выше — особенно блок «Убеждение для разбора».`
    );
  }

  getSalesMessage(): string {
    const link = this.configService.get<string>('FRONTEND_URL') || 'https://front-production-4a7e.up.railway.app';
    const subLink = link.replace(/\/+$/, '') + '/subscription';
    if (!this.spec) return `Начни прокачиваться: ${subLink}`;
    return this.spec.sales_message.template.replace(/\{subscription_link\}/g, subLink);
  }

  getCardsMessage(hasLinkedAccount: boolean): string {
    if (!this.spec) return 'Зайди в приложение Seee — там можно начать работу над карточками.';
    return hasLinkedAccount
      ? this.spec.cards_logic.if_app_linked.message
      : this.spec.cards_logic.if_no_subscription_or_not_linked.message;
  }

  /** Объединённое сообщение: карточки (интро) + продажа подписки. */
  getMergedSalesAndCardsMessage(hasLinkedAccount: boolean): string {
    const cardsIntro =
      'Я записал эти тезисы и добавил их в твой профиль Seee — ты сможешь разобрать каждую сферу в приложении.\n\n';
    const parts = [
      'Всё, что ты увидел — твои реальные зоны роста.',
      'В Seee ты можешь прорабатывать каждую из 4 сфер по шагам: осознать убеждение, увидеть, откуда оно взялось, и заменить на то, что тебе нужно.',
      'Переходи по ссылке и начни 👇',
    ];
    const subLink = (this.configService.get<string>('FRONTEND_URL') || 'https://front-production-4a7e.up.railway.app').replace(/\/+$/, '') + '/subscription';
    return cardsIntro + parts.join('\n\n') + '\n\n' + subLink + ' ✨';
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

    const systemPrompt = `Ты — заботливый психолог в стиле Seee. Напиши подробную, тёплую расшифровку личности на основе ответов пользователя. Тон: бережный, приветливый, позитивный, поддерживающий. Структура: краткое вступление; разделы по темам (сферы жизни, ценности, сильные стороны, барьеры, планы) — опирайся на ответы; в конце НЕ добавляй блок про Seee — его добавим отдельно. Пиши развёрнуто, но по делу. Без markdown-разметки (** и т.п.), обычный текст.`;

    const userPrompt = `Уровень по тесту: ${level} из 100.\n\n4 пункта по сферам:\n${fourPoints}\n\nОтветы пользователя:\n${answersText}\n\nНапиши персональную расшифровку в описанном тоне.`;

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
    return Packer.toBuffer(doc);
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
    return Packer.toBuffer(doc);
  }

  /** Возвращает два буфера DOCX: [вопросы-ответы, расшифровка]. */
  async getDocxBuffers(
    answers: Record<string, string | number>,
    level: number,
    fourPoints: string,
  ): Promise<[Buffer, Buffer]> {
    const [qaBuf, decodingText] = await Promise.all([
      this.buildDocxQa(answers),
      this.generateDecodingText(answers, level, fourPoints),
    ]);
    const decodingBuf = await this.buildDocxDecoding(decodingText);
    return [qaBuf, decodingBuf];
  }
}
