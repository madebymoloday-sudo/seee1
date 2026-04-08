import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ArchivistInsightRequestDto,
  ArchivistInsightResponseDto,
  ArchivistSuggestedCardDto,
} from './dto/archivist-insight.dto';
import { GptUsageService } from './gpt-usage.service';

type ArchivistInsightLLMResult = {
  wrapUpMessage?: string;
  resumeMessage?: string;
  suggestedCards?: Array<{
    title?: string;
    category?: string;
    reason?: string | null;
  }>;
};

const DEFAULT_ARCHIVIST_MODEL = 'gpt-4o-mini';
const CARD_CATEGORIES = ['Освобождение', 'Улучшение +1'] as const;

const CARD_RULES: Array<{
  markers: string[];
  cards: ArchivistSuggestedCardDto[];
}> = [
  {
    markers: ['деньг', 'зарплат', 'квартир', 'кредит', 'долг', 'работ', 'доход'],
    cards: [
      {
        title: 'Финансовая уверенность',
        category: 'Улучшение +1',
        reason: 'Эта тема поможет укрепить ощущение опоры в вопросах денег и дохода.',
      },
      {
        title: 'Если я не контролирую всё, случится катастрофа',
        category: 'Освобождение',
        reason: 'В разборе звучит напряжение вокруг контроля и безопасности.',
      },
      {
        title: 'Я должен(на) справляться со всем в одиночку',
        category: 'Освобождение',
        reason: 'Похоже, в этой теме есть сильная ставка только на себя.',
      },
    ],
  },
  {
    markers: ['неувер', 'ошиб', 'стыд', 'оцен', 'самооцен', 'недостат', 'недосто'],
    cards: [
      {
        title: 'Неуверенность в себе',
        category: 'Освобождение',
        reason: 'Эта тема напрямую связана с внутренней оценкой себя.',
      },
      {
        title: 'Доверие к себе',
        category: 'Улучшение +1',
        reason: 'Эта карточка поможет собрать более устойчивую внутреннюю опору.',
      },
      {
        title: 'Достоинство',
        category: 'Улучшение +1',
        reason: 'Полезно укрепить ощущение собственной ценности.',
      },
    ],
  },
  {
    markers: ['мама', 'папа', 'родител', 'семь', 'семья', 'детств'],
    cards: [
      {
        title: 'Отношения с родителями',
        category: 'Освобождение',
        reason: 'Похоже, корни этой темы могут быть связаны с семейным опытом.',
      },
      {
        title: 'Здоровые границы',
        category: 'Улучшение +1',
        reason: 'Эта тема часто помогает восстановить чувство собственной территории.',
      },
      {
        title: 'Право на отказ',
        category: 'Улучшение +1',
        reason: 'Полезно укрепить разрешение не подстраиваться под давление.',
      },
    ],
  },
  {
    markers: ['трев', 'страх', 'паник', 'контрол', 'катастроф'],
    cards: [
      {
        title: 'Если я тревожусь, значит, я не справляюсь',
        category: 'Освобождение',
        reason: 'В разборе слышится связка между тревогой и самооценкой.',
      },
      {
        title: 'Внутренняя устойчивость',
        category: 'Улучшение +1',
        reason: 'Эта карточка поможет выстраивать больше спокойствия и опоры.',
      },
      {
        title: 'Я могу быть спокойным(ой), даже когда не все под контролем',
        category: 'Улучшение +1',
        reason: 'Полезно собирать более мягкую альтернативу тотальному контролю.',
      },
    ],
  },
  {
    markers: ['отношен', 'девушк', 'парен', 'муж', 'жен', 'люб', 'ревност'],
    cards: [
      {
        title: 'Ревность',
        category: 'Освобождение',
        reason: 'Похоже, в теме отношений звучит тревога потери или сравнения.',
      },
      {
        title: 'Быть собой',
        category: 'Улучшение +1',
        reason: 'Полезно укрепить контакт с собой внутри отношений.',
      },
      {
        title: 'Здоровые границы',
        category: 'Улучшение +1',
        reason: 'Эта карточка помогает вернуть ясность в отношениях с другими.',
      },
    ],
  },
];

@Injectable()
export class ArchivistInsightService {
  private readonly logger = new Logger(ArchivistInsightService.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly gptUsageService: GptUsageService,
  ) {}

  private getClient(): OpenAI | null {
    if (this.client) return this.client;

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-openai-api-key') {
      return null;
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async generateInsight(
    params: ArchivistInsightRequestDto,
    userId?: string,
  ): Promise<ArchivistInsightResponseDto> {
    const prepared = this.normalizeRequest(params);
    const client = this.getClient();

    if (!client) {
      return this.buildFallback(prepared);
    }

    try {
      const completion = await client.chat.completions.create({
        model:
          this.configService.get<string>('OPENAI_ARCHIVIST_MODEL')?.trim() ||
          DEFAULT_ARCHIVIST_MODEL,
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt(),
          },
          {
            role: 'user',
            content: this.buildUserPrompt(prepared),
          },
        ],
      });

      if (userId) {
        const usage =
          this.gptUsageService.extractChatCompletionUsage(completion);
        if (usage) {
          await this.gptUsageService.recordUsage({
            userId,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          });
        }
      }

      const raw = completion.choices[0]?.message?.content || '';
      const parsed = this.parseModelJson(raw);
      if (!parsed) {
        throw new Error('Archivist insight returned malformed JSON');
      }

      return this.normalizeModelResponse(prepared, parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown archivist insight error';
      this.logger.warn(`Archivist insight fallback engaged: ${message}`);
      return this.buildFallback(prepared);
    }
  }

  private normalizeRequest(params: ArchivistInsightRequestDto) {
    const answers =
      params.answers && typeof params.answers === 'object' ? params.answers : {};
    const rawThoughtScopes =
      params.thoughtScopes && typeof params.thoughtScopes === 'object'
        ? params.thoughtScopes
        : {};
    const thoughtScopes = Object.fromEntries(
      Object.entries(rawThoughtScopes).map(([scopeId, scope]) => [
        String(scopeId),
        scope && typeof scope === 'object' ? scope : {},
      ]),
    );

    return {
      sessionId: String(params.sessionId || '').trim(),
      sessionTitle: String(params.sessionTitle || '').trim() || 'последняя сессия',
      coinsEarned: Math.max(0, Math.round(Number(params.coinsEarned || 0))),
      answers,
      thoughtScopes,
      notes: String(params.notes || '').trim(),
    };
  }

  private buildSystemPrompt(): string {
    return [
      'Ты — Архивариус в приложении Seee.',
      'Ты помогаешь человеку после завершения сессии: тепло подводишь итог и предлагаешь новые карточки на разбор.',
      'Отвечай только JSON-объектом без markdown.',
      'JSON-формат:',
      '{',
      '  "wrapUpMessage": string,',
      '  "resumeMessage": string,',
      '  "suggestedCards": [',
      '    { "title": string, "category": "Освобождение" | "Улучшение +1", "reason": string }',
      '  ]',
      '}',
      'Правила:',
      '1. wrapUpMessage: 2-4 предложения на русском. Обязательно упомяни, сколько монет пользователь заработал в этой сессии. Тон тёплый, поддерживающий, без пафоса.',
      '2. resumeMessage: 1-3 предложения для более позднего возвращения в галерею. Начни с "Привет." и напомни, что последним разбиралось.',
      '3. suggestedCards: максимум 3 карточки. Названия короткие, естественные, в духе существующих карточек Seee.',
      '4. reason: короткое объяснение, почему карточка сейчас полезна.',
      '5. Не ставь диагнозы, не драматизируй и не используй угрозы.',
      '6. Если материал скорее про опору и развитие — используй категорию "Улучшение +1". Если это скорее ограничивающая идея или давление — "Освобождение".',
    ].join('\n');
  }

  private buildUserPrompt(
    params: ReturnType<ArchivistInsightService['normalizeRequest']>,
  ): string {
    return [
      `Название сессии: ${params.sessionTitle}`,
      `Монет заработано: ${params.coinsEarned}`,
      '',
      'Ответы основной ветки:',
      this.formatRecord(params.answers) || '—',
      '',
      'Ответы по дополнительным мыслям:',
      this.formatThoughtScopes(params.thoughtScopes) || '—',
      '',
      `Заметки: ${params.notes || '—'}`,
      '',
      'Сформируй итог сессии и новые карточки.',
    ].join('\n');
  }

  private normalizeModelResponse(
    params: ReturnType<ArchivistInsightService['normalizeRequest']>,
    parsed: ArchivistInsightLLMResult,
  ): ArchivistInsightResponseDto {
    const wrapUpMessage =
      String(parsed.wrapUpMessage || '').trim() ||
      this.buildFallback(params).wrapUpMessage;
    const resumeMessage =
      String(parsed.resumeMessage || '').trim() ||
      this.buildFallback(params).resumeMessage;

    const suggestedCards = this.normalizeSuggestedCards(parsed.suggestedCards);
    if (suggestedCards.length === 0) {
      return {
        wrapUpMessage,
        resumeMessage,
        suggestedCards: this.buildFallback(params).suggestedCards,
      };
    }

    return {
      wrapUpMessage,
      resumeMessage,
      suggestedCards,
    };
  }

  private parseModelJson(raw: string): ArchivistInsightLLMResult | null {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as ArchivistInsightLLMResult;
    } catch {
      return null;
    }
  }

  private normalizeSuggestedCards(
    cards: ArchivistInsightLLMResult['suggestedCards'],
  ): ArchivistSuggestedCardDto[] {
    if (!Array.isArray(cards)) return [];

    const seen = new Set<string>();
    const normalized: ArchivistSuggestedCardDto[] = [];

    for (const card of cards) {
      const title = String(card?.title || '').trim();
      const reason = String(card?.reason || '').trim();
      const category = String(card?.category || '').trim();

      if (!title) continue;
      if (!CARD_CATEGORIES.includes(category as (typeof CARD_CATEGORIES)[number])) {
        continue;
      }

      const titleKey = title.toLowerCase();
      if (seen.has(titleKey)) continue;
      seen.add(titleKey);

      normalized.push({
        title,
        category: category as ArchivistSuggestedCardDto['category'],
        reason: reason || undefined,
      });

      if (normalized.length >= 3) break;
    }

    return normalized;
  }

  private buildFallback(
    params: ReturnType<ArchivistInsightService['normalizeRequest']>,
  ): ArchivistInsightResponseDto {
    const theme = this.getThemeLabel(params);
    const suggestedCards = this.pickSuggestedCards(params);

    return {
      wrapUpMessage: `За эту сессию ты заработал ${this.formatCoins(params.coinsEarned)}. Ты уже успел(а) неплохо разложить тему «${theme}», и это действительно важная работа. Разбирать такие вещи бывает непросто, но ты молодец, что пошёл(шла) вглубь и не остановился(ась).`,
      resumeMessage: suggestedCards[0]
        ? `Привет. Последнее, что ты разбирал(а), это «${theme}». Я бы рекомендовал вернуться к этой карточке или взять новую тему «${suggestedCards[0].title}», которую я подготовил после прошлого разбора.`
        : `Привет. Последнее, что ты разбирал(а), это «${theme}». Там ещё есть за что зацепиться, так что я бы рекомендовал вернуться к этой карточке и продолжить разбор.`,
      suggestedCards,
    };
  }

  private pickSuggestedCards(
    params: ReturnType<ArchivistInsightService['normalizeRequest']>,
  ): ArchivistSuggestedCardDto[] {
    const corpus = this.buildCorpus(params);
    const picked: ArchivistSuggestedCardDto[] = [];
    const seen = new Set<string>();

    for (const rule of CARD_RULES) {
      const hasMarker = rule.markers.some((marker) => corpus.includes(marker));
      if (!hasMarker) continue;

      for (const card of rule.cards) {
        const key = `${card.category}:${card.title}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(card);
        if (picked.length >= 3) return picked;
      }
    }

    const fallbacks: ArchivistSuggestedCardDto[] = [
      {
        title: 'Внутренняя опора',
        category: 'Улучшение +1',
        reason: 'Эта тема помогает собрать устойчивость после сложных разборов.',
      },
      {
        title: 'Со мной что-то не так',
        category: 'Освобождение',
        reason: 'Полезно проверить, не звучит ли в фоне жёсткая самооценка.',
      },
      {
        title: 'Доверие к себе',
        category: 'Улучшение +1',
        reason: 'Эта карточка помогает укрепить более спокойную связь с собой.',
      },
    ];

    for (const card of fallbacks) {
      const key = `${card.category}:${card.title}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(card);
      if (picked.length >= 3) break;
    }

    return picked;
  }

  private buildCorpus(
    params: ReturnType<ArchivistInsightService['normalizeRequest']>,
  ): string {
    const parts: string[] = [params.sessionTitle, params.notes];

    for (const value of Object.values(params.answers || {})) {
      if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim());
      }
    }

    for (const scope of Object.values(params.thoughtScopes || {})) {
      for (const value of Object.values(scope || {})) {
        if (typeof value === 'string' && value.trim()) {
          parts.push(value.trim());
        }
      }
    }

    return parts.join(' ').toLowerCase().replace(/ё/g, 'е');
  }

  private getThemeLabel(
    params: ReturnType<ArchivistInsightService['normalizeRequest']>,
  ): string {
    const directThought = String(
      params.answers['core:situation:3'] ||
        params.answers['core:thought:3'] ||
        '',
    ).trim();
    if (directThought) return directThought;
    return params.sessionTitle || 'последняя сессия';
  }

  private formatRecord(record: Record<string, string>): string {
    return Object.entries(record)
      .map(([key, value]) => `${key}: ${String(value || '').trim() || '—'}`)
      .join('\n');
  }

  private formatThoughtScopes(
    thoughtScopes: Record<string, Record<string, string>>,
  ): string {
    return Object.entries(thoughtScopes)
      .map(([scopeId, scope]) => {
        const body = Object.entries(scope || {})
          .map(([key, value]) => `${key}: ${String(value || '').trim() || '—'}`)
          .join('\n');
        return `${scopeId}\n${body}`;
      })
      .join('\n\n');
  }

  private formatCoins(amount: number): string {
    const safeAmount = Math.max(0, Math.round(amount));
    const mod10 = safeAmount % 10;
    const mod100 = safeAmount % 100;
    if (mod10 === 1 && mod100 !== 11) return `${safeAmount} монету`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${safeAmount} монеты`;
    }
    return `${safeAmount} монет`;
  }
}
