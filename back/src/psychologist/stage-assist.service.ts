import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  StageAssistRequestDto,
  StageAssistResponseDto,
} from './dto/stage-assist.dto';
import { GptUsageService } from './gpt-usage.service';

type StageDecision = 'advance' | 'clarify';

type StageAssistLLMResult = {
  decision?: StageDecision;
  normalizedAnswer?: string;
  reaction?: string;
  followUpQuestion?: string | null;
};

const DEFAULT_STAGE_MODEL = 'gpt-4o-mini';

const EMOTION_MARKERS = [
  'трев',
  'страх',
  'злост',
  'злюсь',
  'груст',
  'печал',
  'стыд',
  'вина',
  'винов',
  'обид',
  'апат',
  'радост',
  'счаст',
  'вдохнов',
  'надежд',
  'напряж',
  'устал',
  'паник',
  'беспомощ',
  'спокой',
  'раздраж',
  'одиноч',
  'не верю в себя',
];

const PRACTICAL_MARKERS = [
  'не могу',
  'не получается',
  'перестал',
  'перестала',
  'отклады',
  'теря',
  'пропуска',
  'не сплю',
  'не могу спать',
  'мало сплю',
  'потерял',
  'потеряла',
  'избега',
  'срыва',
  'закрыва',
  'не начина',
  'не решаюсь',
  'не запускаю',
  'трачу',
  'отказыва',
];

const POSITIVE_INTENT_MARKERS = [
  'помочь',
  'поддерж',
  'защит',
  'позабот',
  'из лучших побуждений',
  'хотела как лучше',
  'хотел как лучше',
];

const SELFISH_MARKERS = [
  'выгод',
  'удоб',
  'контрол',
  'послуш',
  'манипул',
  'спокой',
  'эконом',
  'себе',
  'для себя',
  'тише',
  'проще',
  'сохранить власть',
];

@Injectable()
export class StageAssistService {
  private readonly logger = new Logger(StageAssistService.name);
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

  async analyzeStage(
    params: StageAssistRequestDto,
    userId?: string,
  ): Promise<StageAssistResponseDto> {
    const prepared = this.normalizeRequest(params);
    const client = this.getClient();

    if (!client) {
      return this.buildFallback(prepared);
    }

    try {
      const completion = await client.chat.completions.create({
        model:
          this.configService
            .get<string>('OPENAI_STAGE_ASSIST_MODEL')
            ?.trim() || DEFAULT_STAGE_MODEL,
        temperature: 0.35,
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
        throw new Error('Stage assist returned malformed JSON');
      }

      return this.normalizeModelResponse(prepared, parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown stage assist error';
      this.logger.warn(`Stage assist fallback engaged: ${message}`);
      return this.buildFallback(prepared);
    }
  }

  private normalizeRequest(params: StageAssistRequestDto) {
    const clarificationAnswers = Array.isArray(params.clarificationAnswers)
      ? params.clarificationAnswers
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : [];

    const answers =
      params.answers && typeof params.answers === 'object' ? params.answers : {};

    return {
      subject: params.subject,
      step: params.step,
      answer: String(params.answer || '').trim(),
      stageAnswer: String(params.stageAnswer || '').trim(),
      clarificationAnswers,
      clarificationCount: Math.max(
        0,
        Math.min(2, Number(params.clarificationCount || 0)),
      ),
      answers,
      situationText: String(params.situationText || '').trim(),
      importantText: String(params.importantText || '').trim(),
      skipRequested: !!params.skipRequested,
    };
  }

  private buildSystemPrompt(): string {
    return [
      'Ты — stage-assistant приложения Seee.',
      'Ты помогаешь человеку аккуратно пройти этапы разбора мысли и ситуации.',
      'Твоя задача: решить, достаточно ли ответа на текущем шаге, или нужен уточняющий подвопрос.',
      'Отвечай ТОЛЬКО JSON-объектом без markdown.',
      'Разрешённые поля JSON:',
      '{',
      '  "decision": "advance" | "clarify",',
      '  "normalizedAnswer": string,',
      '  "reaction": string,',
      '  "followUpQuestion": string | null',
      '}',
      'Правила:',
      '1. reaction — короткая поддерживающая реакция на русском. Если decision=advance, reaction должен мягко подводить к следующему шагу. Если decision=clarify, reaction должен поддержать человека и подготовить к уточнению.',
      '1a. reaction должен опираться на конкретику ответа пользователя. Ссылайся на его ситуацию, эмоцию, мысль или вывод, а не пиши обезличенные шаблоны.',
      '1b. Не повторяй одни и те же вводные вроде "давай попробуем подробнее разобраться", если уже есть конкретный контекст. Лучше коротко отзеркаль суть и переведи к следующему шагу.',
      '2. Если ответ слишком широкий, абстрактный, не по теме или не помогает двигаться дальше, верни decision=clarify.',
      '2a. Если ответ прямо отвечает на вопрос, даже коротко, по умолчанию выбирай advance. Не задавай лишних уточнений там, где уже есть рабочий смысл.',
      '3. Максимум два уточнения на шаг. Если пользователь уже получил два уточнения или нажал skipRequested=true, обычно выбирай advance и не зацикливайся.',
      '4. На шаге 4 нормализуй причины в короткие самостоятельные мысли/идеи в отдельных строках без маркеров списка.',
      '5. На шаге 5 речь всегда о том, откуда к человеку пришла мысль/идея, а не о причинах из шага 4.',
      '6. На шаге 6 помогай искать возможную выгоду для источника мысли. Если пользователь описывает только добрые намерения, мягко попроси посмотреть и на выгоду для источника.',
      '7. На шаге 7 нужны эмоции, состояния и внутренние переживания.',
      '8. На шаге 8 нужны практические последствия: действия, поведение, потери, откладывание, сон, работа, деньги, отношения и т.д.',
      '9. На шаге 9 важно, чтобы пользователь оценил мысль: нужна она ему или нет.',
      '10. Перед шагом 10 обычно полезно мягко рекомендовать "Продолжить разбор", если у человека уже есть несколько причин или заметные последствия.',
      '11. Не ставь диагнозы, не дави и не обесценивай пользователя.',
    ].join('\n');
  }

  private buildUserPrompt(params: ReturnType<StageAssistService['normalizeRequest']>): string {
    const previousAnswers = this.formatAnswers(params.answers);
    const thought = this.getThoughtAnswer(params.subject, params.answers);
    const stageLabel = this.getStageLabel(params.step);

    return [
      `Шаг: ${params.step} (${stageLabel})`,
      `Тип разбора: ${params.subject === 'thought' ? 'мысль' : 'ситуация'}`,
      `Текущий ответ пользователя: ${params.answer || '—'}`,
      `Первый ответ на этом шаге: ${params.stageAnswer || '—'}`,
      `Уже было уточнений: ${params.clarificationCount}`,
      `Предыдущие ответы на уточнения: ${
        params.clarificationAnswers.length > 0
          ? params.clarificationAnswers.join(' | ')
          : '—'
      }`,
      `Пользователь нажал "Не знаю, как описать": ${
        params.skipRequested ? 'да' : 'нет'
      }`,
      `Ключевая мысль: ${thought || '—'}`,
      `Текст ситуации: ${params.situationText || '—'}`,
      `Текст причин/важных идей: ${params.importantText || '—'}`,
      '',
      'Контекст предыдущих ответов:',
      previousAnswers || '—',
      '',
      'Цель текущего шага:',
      this.getStageGoal(params.step),
      '',
      'Верни только JSON.',
    ].join('\n');
  }

  private formatAnswers(answers: Record<string, string>): string {
    const entries = Object.entries(answers || {}).filter(([, value]) =>
      String(value || '').trim(),
    );
    if (entries.length === 0) return '';

    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.humanizeAnswerKey(key)}: ${value}`)
      .join('\n');
  }

  private humanizeAnswerKey(key: string): string {
    const parts = key.split(':');
    if (parts.length !== 3) return key;

    const [, subject, stepRaw] = parts;
    const step = Number(stepRaw);
    const scopeLabel = subject === 'thought' ? 'мысль' : 'ситуация';
    return `${scopeLabel} • шаг ${step} (${this.getStageLabel(step)})`;
  }

  private getStageLabel(step: number): string {
    switch (step) {
      case 1:
        return 'описание ситуации';
      case 2:
        return 'эмоция';
      case 3:
        return 'мысль / идея';
      case 4:
        return 'причины';
      case 5:
        return 'источник мысли';
      case 6:
        return 'выгода источника';
      case 7:
        return 'эмоциональные последствия';
      case 8:
        return 'практические последствия';
      case 9:
        return 'вывод о нужности мысли';
      default:
        return 'этап разбора';
    }
  }

  private getStageGoal(step: number): string {
    switch (step) {
      case 1:
        return 'Понять, описал ли пользователь конкретную ситуацию. Если он уже назвал понятный контекст, не требуй лишней детализации.';
      case 2:
        return 'Вытащить эмоцию или внутреннее состояние, которое вызывает ситуация.';
      case 3:
        return 'Помочь сформулировать мысль или идею, которая запускает эмоцию.';
      case 4:
        return 'Собрать несколько причин, почему человеку эта мысль кажется правдой. Каждую причину оформи как отдельную идею.';
      case 5:
        return 'Выяснить, от кого или откуда человеку пришла сама мысль.';
      case 6:
        return 'Понять, какую личную выгоду для себя мог получать источник мысли, а не просто его добрые намерения.';
      case 7:
        return 'Определить эмоциональные последствия этой мысли.';
      case 8:
        return 'Определить практические последствия этой мысли в жизни и поведении человека.';
      case 9:
        return 'Помочь человеку сделать вывод, нужна ему эта мысль или нет.';
      default:
        return 'Аккуратно помочь пользователю продвинуться по этапу.';
    }
  }

  private parseModelJson(raw: string): StageAssistLLMResult | null {
    const text = String(raw || '').trim();
    if (!text) return null;

    try {
      return JSON.parse(text) as StageAssistLLMResult;
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return null;
      try {
        return JSON.parse(text.slice(start, end + 1)) as StageAssistLLMResult;
      } catch {
        return null;
      }
    }
  }

  private normalizeModelResponse(
    params: ReturnType<StageAssistService['normalizeRequest']>,
    result: StageAssistLLMResult,
  ): StageAssistResponseDto {
    const fallback = this.buildFallback(params);
    const decision =
      result.decision === 'clarify' || result.decision === 'advance'
        ? result.decision
        : fallback.decision;
    const normalizedAnswer = String(
      result.normalizedAnswer || fallback.normalizedAnswer,
    ).trim();
    const reaction = String(result.reaction || fallback.reaction).trim();
    const followUpQuestion = String(result.followUpQuestion || '').trim();

    if (
      params.skipRequested ||
      params.clarificationCount >= 2 ||
      (decision === 'clarify' && !followUpQuestion)
    ) {
      return {
        ...fallback,
        normalizedAnswer: normalizedAnswer || fallback.normalizedAnswer,
        reaction: reaction || fallback.reaction,
      };
    }

    if (decision === 'clarify') {
      return {
        decision,
        normalizedAnswer:
          normalizedAnswer || params.answer || params.stageAnswer || 'Не знаю',
        reaction: reaction || fallback.reaction,
        followUpQuestion: followUpQuestion || fallback.followUpQuestion,
      };
    }

    return {
      decision: 'advance',
      normalizedAnswer: normalizedAnswer || fallback.normalizedAnswer,
      reaction: reaction || fallback.reaction,
    };
  }

  private buildFallback(
    params: ReturnType<StageAssistService['normalizeRequest']>,
  ): StageAssistResponseDto {
    const step = params.step;
    const answer = params.answer;

    if (params.skipRequested || params.clarificationCount >= 2) {
      return {
        decision: 'advance',
        normalizedAnswer: this.buildAdvanceAnswer(params),
        reaction: this.getAdvanceReaction(step, params),
      };
    }

    switch (step) {
      case 1:
        if (this.looksLikeConcreteSituation(answer) || answer.length >= 8) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Пока это звучит как слишком широкая тема, а мне важно понять саму ситуацию.',
          followUpQuestion:
            'Что именно сейчас происходит с этой темой в вашей жизни? Опишите коротко саму ситуацию, которую мы разбираем.',
        };
      case 2:
        if (this.looksLikeEmotion(answer) || answer.length >= 4) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Такое правда бывает: эмоцию не всегда получается назвать сразу.',
          followUpQuestion:
            'Что ближе всего к вашему состоянию: тревога, страх, злость, стыд, грусть, обида, апатия, радость или что-то ещё?',
        };
      case 3:
        if (this.looksLikeThought(answer) || answer.length >= 6) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Пока я вижу скорее тему, чем саму мысль, которая запускает это состояние.',
          followUpQuestion:
            'Попробуйте закончить одну из фраз: "Я думаю, что ...", "Мне кажется, что ...", "Я боюсь, что ...". Какая мысль здесь звучит внутри?',
        };
      case 4: {
        const reasons = this.normalizeReasons(answer);
        if (reasons.length >= 1 || answer.length >= 12) {
          return {
            decision: 'advance',
            normalizedAnswer: reasons.join('\n') || answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Хочу помочь вам разложить это на несколько отдельных причин, чтобы потом их можно было разобрать глубже.',
          followUpQuestion:
            'Какие 2-3 конкретные причины заставляют вас в это верить? Напишите их короткими отдельными фразами.',
        };
      }
      case 5:
        if (answer.length >= 2) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Не всегда получается сразу вспомнить, откуда пришла такая мысль, и это нормально.',
          followUpQuestion:
            'Когда вы впервые начали так думать? Кто именно это внедрял или повторял: мама, папа, партнёр, школа, общество, вы сами или какой-то конкретный человек?',
        };
      case 6:
        if (
          answer.length >= 4 &&
          (!this.hasOnlyPositiveIntent(answer) || params.clarificationCount > 0)
        ) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Иногда мысль действительно может звучать как забота, но при этом быть удобной прежде всего для того, кто её передавал.',
          followUpQuestion:
            'Если посмотреть не только на добрые намерения, а на выгоду для источника, что эта мысль могла ему давать: контроль, послушание, удобство, спокойствие, экономию сил, возможность влиять на вас?',
        };
      case 7:
        if (this.looksLikeEmotion(answer) || answer.length >= 4) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Мне важно отделить эмоциональные последствия от просто описания ситуации.',
          followUpQuestion:
            'Что вы чувствуете из-за этой мысли внутри: тревогу, стыд, злость, вину, обиду, грусть, апатию, бессилие, напряжение или что-то ещё?',
        };
      case 8:
        if (this.looksLikePracticalEffect(answer) || answer.length >= 8) {
          return {
            decision: 'advance',
            normalizedAnswer: answer,
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Теперь хочу увидеть, как эта мысль влияет не только на чувства, но и на вашу жизнь на практике.',
          followUpQuestion:
            'Что из-за этой мысли меняется в поведении и жизни? Например: вы откладываете дела, теряете деньги, не можете спать, не запускаете проект, избегаете разговоров или отказываетесь от возможностей.',
        };
      case 9:
        if (this.looksLikeConclusion(answer)) {
          return {
            decision: 'advance',
            normalizedAnswer: this.normalizeConclusion(answer),
            reaction: this.getAdvanceReaction(step, params),
          };
        }
        return {
          decision: 'clarify',
          normalizedAnswer: params.stageAnswer || answer,
          reaction:
            'Здесь нам важно дойти до ясной оценки, потому что именно она помогает ослабить деструктивную мысль.',
          followUpQuestion:
            'Если сказать совсем прямо: эта мысль вам нужна или не нужна? Полезна она для вас сейчас или мешает вам?',
        };
      default:
        return {
          decision: 'advance',
          normalizedAnswer: answer || params.stageAnswer || 'Не знаю',
          reaction: this.getAdvanceReaction(step, params),
        };
    }
  }

  private buildAdvanceAnswer(
    params: ReturnType<StageAssistService['normalizeRequest']>,
  ): string {
    if (params.step === 4) {
      const combined = [
        params.stageAnswer,
        ...params.clarificationAnswers,
        params.answer,
      ]
        .filter(Boolean)
        .join('\n');
      const reasons = this.normalizeReasons(combined);
      return reasons.join('\n') || combined || 'Пока трудно сформулировать причины';
    }

    if (params.step === 9) {
      return this.normalizeConclusion(
        params.answer ||
          params.clarificationAnswers.at(-1) ||
          params.stageAnswer ||
          'Пока мне трудно сделать вывод',
      );
    }

    return (
      params.answer ||
      params.clarificationAnswers.at(-1) ||
      params.stageAnswer ||
      'Не знаю'
    );
  }

  private getAdvanceReaction(
    previousStep: number,
    params: ReturnType<StageAssistService['normalizeRequest']>,
  ): string {
    const emotion =
      this.getAnswerByStep(params.subject, params.answers, 2) || params.answer;
    const thought = this.getThoughtAnswer(params.subject, params.answers);
    const currentAnswer =
      params.answer ||
      params.clarificationAnswers.at(-1) ||
      params.stageAnswer ||
      '';
    const unknownAnswer =
      params.skipRequested ||
      /^(не знаю|не знаю как ответить|не понимаю|затрудняюсь|затрудняюсь ответить|сложно ответить|сложно сказать|не могу ответить|не могу сказать|без понятия|—)$/iu.test(
        currentAnswer.trim(),
      );

    if (unknownAnswer) {
      if (previousStep === 6) {
        return 'Ничего страшного, если сейчас не получается понять цели или выгоду источника. Это нормально.';
      }
      if (previousStep === 5) {
        return 'Ничего страшного, если сейчас не получается точно понять, откуда пришла эта мысль. Давайте двигаться дальше по тому, что можно заметить.';
      }
      if (previousStep === 7) {
        return 'Ничего страшного, если эмоциональные последствия пока трудно назвать точно. Давайте посмотрим на практическую сторону.';
      }
      return 'Ничего страшного, если сейчас нет точного ответа. Давайте перейдём к следующему шагу.';
    }

    const situation =
      this.getAnswerByStep(params.subject, params.answers, 1) ||
      params.situationText ||
      params.answer;
    const reasonCount = this.normalizeReasons(params.importantText).length;
    const shortEmotion = this.quoteForReaction(emotion, 44);
    const shortThought = this.quoteForReaction(thought, 64);
    const shortSituation = this.quoteForReaction(situation, 72);
    const shortCurrentAnswer = this.quoteForReaction(currentAnswer, 64);

    switch (previousStep) {
      case 1:
        return shortSituation
          ? `Теперь картина яснее: речь о ситуации, где ${shortSituation}. Давайте посмотрим, какую эмоцию она у вас вызывает.`
          : 'Теперь ситуация стала понятнее. Давайте посмотрим, какую эмоцию она у вас вызывает.';
      case 2:
        if (this.isPositiveEmotion(emotion)) {
          return shortEmotion
            ? `Вы уже уловили эмоцию ${shortEmotion}. Давайте теперь найдём мысль, которая её запускает.`
            : 'Хорошо, что вы замечаете и такие чувства тоже. Давайте теперь найдём мысль, которая запускает эту эмоцию.';
        }
        return shortEmotion
          ? `Понял, здесь звучит эмоция ${shortEmotion}. Давайте теперь найдём мысль или идею, которая её запускает.`
          : 'Понимаю, это может быть непросто. Давайте теперь найдём мысль или идею, которая запускает эту эмоцию.';
      case 3:
        return shortThought
          ? `Мысль ${shortThought} уже стала заметнее. Теперь разложим, почему она кажется вам убедительной.`
          : 'Хорошо, мысль уже стала заметнее. Теперь разложим, почему она кажется вам убедительной.';
      case 4:
        return reasonCount > 1
          ? `Отлично, уже видно несколько причин, почему эта мысль держится. Теперь посмотрим, от кого или откуда она вообще могла прийти.`
          : 'Спасибо, причины уже проявились. Теперь посмотрим, от кого или откуда вообще могла прийти сама мысль.';
      case 5:
        return shortThought
          ? `Так становится понятнее, как у вас закрепилась мысль ${shortThought}. Давайте теперь посмотрим, какую выгоду она могла давать источнику.`
          : 'Это помогает увидеть контекст, в котором мысль закрепилась. Давайте теперь посмотрим, какую выгоду она могла давать источнику.';
      case 6:
        return shortCurrentAnswer
          ? `Понял, здесь уже видна выгода ${shortCurrentAnswer}. Теперь посмотрим, какие эмоциональные последствия эта мысль вам приносит.`
          : 'Понял, выгода для источника здесь уже обозначилась. Теперь посмотрим, какие эмоциональные последствия эта мысль вам приносит.';
      case 7:
        return shortEmotion
          ? `Спасибо, эмоциональный след ${shortEmotion} уже хорошо виден. Давайте посмотрим, как мысль влияет на вашу жизнь на практике.`
          : 'Спасибо, внутренний эмоциональный след уже хорошо виден. Давайте посмотрим, как мысль влияет на вашу жизнь на практике.';
      case 8:
        return shortThought
          ? `Теперь уже видно, как мысль ${shortThought} отражается и на чувствах, и на реальных действиях. Осталось понять, нужна она вам или нет.`
          : 'Теперь уже видно, как эта мысль отражается и на чувствах, и на реальных действиях. Осталось понять, нужна она вам или нет.';
      case 9:
        return reasonCount > 1 || thought
          ? 'Вы уже собрали цельную картину: откуда пришла мысль, к чему она приводит и как влияет на вас. Если хотите добраться до корня глубже, обычно полезнее выбрать "Разобраться глубже", но можно и сначала решить конкретную ситуацию.'
          : 'Вы уже хорошо увидели, как эта мысль влияет на вас. Теперь можно решить: хотите сначала закрыть конкретную ситуацию или пойти глубже и разобрать её корни.';
      default:
        return 'Спасибо, давайте двигаться дальше шаг за шагом.';
    }
  }

  private looksLikeConcreteSituation(answer: string): boolean {
    const words = answer.split(/\s+/).filter(Boolean).length;
    return answer.length >= 18 && words >= 4;
  }

  private looksLikeEmotion(answer: string): boolean {
    const normalized = answer.toLowerCase();
    return EMOTION_MARKERS.some((marker) => normalized.includes(marker));
  }

  private looksLikeThought(answer: string): boolean {
    const normalized = answer.toLowerCase();
    const words = answer.split(/\s+/).filter(Boolean).length;
    return (
      words >= 4 &&
      (normalized.includes('что') ||
        normalized.includes('будто') ||
        normalized.includes('кажется') ||
        normalized.includes('боюсь') ||
        normalized.includes('долж') ||
        answer.length >= 28)
    );
  }

  private normalizeReasons(answer: string): string[] {
    const raw = String(answer || '')
      .replace(/\r\n/g, '\n')
      .split(/\n|;\s*|,\s*(?=[A-ZА-ЯЁа-яё])/)
      .map((item) =>
        item
          .replace(/^\d+[\).\s-]*/, '')
          .replace(/^[—–-]\s*/, '')
          .trim(),
      )
      .filter((item) => item.length >= 4);

    const unique: string[] = [];
    for (const item of raw) {
      const normalized = item.toLowerCase();
      if (!unique.some((existing) => existing.toLowerCase() === normalized)) {
        unique.push(item);
      }
    }
    return unique.slice(0, 8);
  }

  private hasOnlyPositiveIntent(answer: string): boolean {
    const normalized = answer.toLowerCase();
    const hasPositive = POSITIVE_INTENT_MARKERS.some((marker) =>
      normalized.includes(marker),
    );
    const hasSelfish = SELFISH_MARKERS.some((marker) =>
      normalized.includes(marker),
    );
    return hasPositive && !hasSelfish;
  }

  private looksLikePracticalEffect(answer: string): boolean {
    const normalized = answer.toLowerCase();
    return PRACTICAL_MARKERS.some((marker) => normalized.includes(marker));
  }

  private looksLikeConclusion(answer: string): boolean {
    const normalized = answer.toLowerCase();
    return (
      normalized.includes('не нужна') ||
      normalized.includes('мне не нужна') ||
      normalized.includes('мне нужна') ||
      normalized.includes('полезна') ||
      normalized.includes('мешает') ||
      normalized.includes('не хочу') ||
      normalized.includes('оставлю') ||
      normalized.includes('хочу оставить')
    );
  }

  private normalizeConclusion(answer: string): string {
    const normalized = answer.trim();
    if (!normalized) return 'Пока мне трудно сделать вывод по этой мысли';

    const lower = normalized.toLowerCase();
    if (
      lower.includes('не нужна') ||
      lower.includes('мешает') ||
      lower.includes('хочу отпустить') ||
      lower.includes('не хочу в это верить')
    ) {
      return normalized.includes('не нужна')
        ? normalized
        : 'Эта мысль мне не нужна, потому что она больше мешает, чем помогает.';
    }

    if (
      lower.includes('нужна') ||
      lower.includes('полезна') ||
      lower.includes('оставлю')
    ) {
      return normalized.includes('нужна')
        ? normalized
        : 'Эта мысль мне пока нужна, потому что я вижу в ней для себя пользу.';
    }

    return normalized;
  }

  private isPositiveEmotion(answer: string): boolean {
    const normalized = answer.toLowerCase();
    return (
      normalized.includes('радост') ||
      normalized.includes('счаст') ||
      normalized.includes('воодуш') ||
      normalized.includes('интерес') ||
      normalized.includes('облегч')
    );
  }

  private getThoughtAnswer(
    subject: 'situation' | 'thought',
    answers: Record<string, string>,
  ): string {
    return this.getAnswerByStep(subject, answers, 3);
  }

  private getAnswerByStep(
    subject: 'situation' | 'thought',
    answers: Record<string, string>,
    step: number,
  ): string {
    const direct = String(answers[`core:${subject}:${step}`] || '').trim();
    if (direct) return direct;

    const oppositeSubject = subject === 'thought' ? 'situation' : 'thought';
    return String(answers[`core:${oppositeSubject}:${step}`] || '').trim();
  }

  private quoteForReaction(value: string, maxLength: number): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized || normalized === '—') return '';
    if (normalized.length <= maxLength) return `«${normalized}»`;
    return `«${normalized.slice(0, maxLength - 1).trimEnd()}…»`;
  }
}
