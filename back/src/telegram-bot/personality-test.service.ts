import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const FIRST_SCALE_QUESTION_IDS = [
  'q1', 'q5', 'q9', 'q13', 'q17', 'q21', 'q25', 'q29', 'q33', 'q37', 'q41', 'q45',
];

interface TestSpec {
  intro: { text: string };
  questions: Array<{
    id: string;
    step: number;
    type: string;
    text: string;
    short_label: string;
  }>;
  spheres: Array<{ id: string; name: string; order: number }>;
  message_level_and_12_points: { structure: string; generation_note: string };
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
    // Файл копируется в dist/ при сборке (nest-cli.json assets). __dirname = dist/src/telegram-bot
    const distRoot = path.resolve(__dirname, '..', '..', '..');
    const backRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const cwd = process.cwd();
    const candidates = [
      path.join(distRoot, 'telegram_test_prompt.json'),
      path.join(backRoot, 'telegram_test_prompt.json'),
      path.join(cwd, 'telegram_test_prompt.json'),
      path.join(cwd, 'back', 'telegram_test_prompt.json'),
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
    return s != null && s.step >= 1 && s.step <= 48;
  }

  startTest(chatId: number): { intro: string; firstQuestion: string } | null {
    if (!this.spec) return null;
    this.stateByChat.set(chatId, { step: 0, answers: {} });
    const q = this.spec.questions.find((x) => x.step === 1);
    return {
      intro: this.spec.intro.text,
      firstQuestion: q ? q.text : '',
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
    return q ? { id: q.id, text: q.text, type: q.type } : null;
  }

  parseScaleAnswer(text: string): number | null {
    const t = text.trim().toLowerCase();
    if (/^затрудняюсь|затрудняюсь ответить$/i.test(t)) return 3;
    const n = parseInt(text.trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    return null;
  }

  /** После интро пользователь ответил — отдаём первый вопрос и переводим шаг в 1. */
  advanceToFirstQuestion(chatId: number): string | null {
    const state = this.stateByChat.get(chatId);
    if (!state || !this.spec || state.step !== 0) return null;
    const q = this.spec.questions.find((x) => x.step === 1);
    state.step = 1;
    return q ? q.text : null;
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

    if (state.step >= 48) {
      const answers = { ...state.answers };
      this.stateByChat.delete(chatId);
      return { nextQuestion: null, done: true, answers };
    }

    state.step += 1;
    const next = this.spec.questions.find((q) => q.step === state.step);
    return {
      nextQuestion: next ? next.text : null,
      done: false,
    };
  }

  computeLevel(answers: Record<string, string | number>): number {
    let sum = 0;
    for (const id of FIRST_SCALE_QUESTION_IDS) {
      const v = answers[id];
      if (typeof v === 'number') sum += v;
      else if (v === undefined || String(v).toLowerCase().includes('затрудняюсь')) sum += 3;
      else {
        const n = parseInt(String(v), 10);
        sum += Number.isFinite(n) && n >= 1 && n <= 10 ? n : 3;
      }
    }
    return Math.round((sum / 12) * 10);
  }

  async generate12Points(answers: Record<string, string | number>): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set, returning placeholder for 12 points');
      return this.getFallback12Points();
    }

    const level = this.computeLevel(answers);
    const answersText = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const systemPrompt = `Ты — психолог в стиле Seee. На основе ответов пользователя на тест из 12 сфер жизни сформируй 12 конкретных пунктов для работы. Для каждой сферы (в порядке: родители и детство, агрессия в реализации, агрессия для защиты, отношения, самооценка, страхи, принятие и забота о себе, ответственность и честность, проявленность, здоровье физическое, здоровье психологическое, внимание) дай: (1) тему для разбора, (2) ограничивающие убеждения в этой сфере, (3) короткий тезис под разбор. Пиши по-русски, кратко и по делу. Формат: нумерованный список 1–12, каждый пункт — 2–4 предложения.`;

    const userPrompt = `Уровень пользователя: ${level} из 100.\n\nОтветы на вопросы теста:\n${answersText}\n\nСформируй 12 пунктов по сферам (что разобрать, от каких убеждений освободиться, тезис под разбор).`;

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
      this.logger.error(`OpenAI 12 points generation failed: ${e?.message}`);
    }
    return this.getFallback12Points();
  }

  private getFallback12Points(): string {
    const spheres = [
      'Родители и детство',
      'Агрессия в реализации',
      'Агрессия для защиты',
      'Отношения',
      'Самооценка и самоопределение',
      'Страхи',
      'Принятие и забота о себе',
      'Ответственность и честность',
      'Проявленность',
      'Здоровье физическое',
      'Здоровье психологическое',
      'Внимание',
    ];
    return spheres
      .map(
        (s, i) =>
          `${i + 1}. ${s}: разобрать ограничивающие убеждения в этой сфере и сформулировать тезис для работы в Seee.`,
      )
      .join('\n\n');
  }

  getLevelMessage(level: number, twelvePoints: string): string {
    if (!this.spec) return `Твой уровень: ${level} из 100.`;
    const tpl = this.spec.message_level_and_12_points.structure;
    return tpl
      .replace(/\{level\}/g, String(level))
      .replace(/\{level\+1\}/g, String(Math.min(100, level + 1)))
      .replace('Вот 12 пунктов', 'Вот 12 пунктов:\n\n' + twelvePoints);
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
}
