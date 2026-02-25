import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class NeuroHintService {
  private llm: ChatOpenAI | null = null;

  constructor(private configService: ConfigService) {}

  private getLLM(): ChatOpenAI {
    if (this.llm) return this.llm;

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-openai-api-key') {
      throw new ServiceUnavailableException({
        message:
          'LLM не настроен. У сервера не подключен LLM API ключ. Обратитесь к администратору.',
        field: 'llm',
      });
    }

    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.5,
      maxTokens: 220,
      openAIApiKey: apiKey,
    });

    return this.llm;
  }

  async generateThoughtHint(params: {
    situation: string;
    emotion: string;
  }): Promise<string> {
    const situation = (params.situation || '').trim();
    const emotion = (params.emotion || '').trim();

    if (!situation || !emotion) {
      return 'Попробуйте описать мысль любыми словами — даже очень коротко. Например: "Мне кажется, что …"';
    }

    const system = [
      'Ты — внимательный психологический помощник приложения Seee.',
      'Задача: помочь пользователю сформулировать мысль/идею/убеждение, которая вызывает эмоцию.',
      'Ответ должен быть на русском, поддерживающим, коротким (3–7 предложений).',
      'Не давай диагностику и не спорь с пользователем.',
      'Дай 2–4 наводящих вопроса и 1–2 примера шаблонов мыслей формата "Я думаю, что …".',
    ].join('\n');

    const user = [
      `Ситуация: ${situation}`,
      `Эмоция: ${emotion}`,
      '',
      'Сформулируй подсказку, чтобы пользователь смог(ла) написать мысль одной фразой.',
    ].join('\n');

    const llm = this.getLLM();
    const response = await llm.invoke([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    const text = String(response.content || '').trim();
    return (
      text ||
      'Иногда эмоцию запускает автоматическая мысль/оценка. Попробуйте начать с фразы "Я думаю, что …" и закончить её как получится.'
    );
  }
}

