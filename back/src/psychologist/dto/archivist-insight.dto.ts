import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

const CARD_CATEGORIES = ['Освобождение', 'Улучшение +1'] as const;

export class ArchivistSuggestedCardDto {
  @ApiProperty({
    description: 'Короткое название новой карточки на разбор',
    example: 'Финансовая уверенность',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Категория карточки',
    enum: CARD_CATEGORIES,
    example: 'Улучшение +1',
  })
  @IsString()
  @IsIn(CARD_CATEGORIES)
  category: 'Освобождение' | 'Улучшение +1';

  @ApiPropertyOptional({
    description: 'Короткое объяснение, почему карточка предложена',
    example: 'Эта тема повторяется в вашем последнем разборе.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ArchivistInsightRequestDto {
  @ApiPropertyOptional({
    description: 'Идентификатор последней сессии',
    example: 'clv_session_123',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    description: 'Название или главный фокус последней сессии',
    example: 'Я не знаю, как зарабатывать больше',
  })
  @IsString()
  sessionTitle: string;

  @ApiProperty({
    description: 'Сколько монет пользователь заработал в этой сессии',
    example: 18,
  })
  @IsInt()
  @Min(0)
  coinsEarned: number;

  @ApiPropertyOptional({
    description: 'Ответы основной ветки разбора',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Ответы по дополнительным мыслям/веткам глубины',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  })
  @IsOptional()
  @IsObject()
  thoughtScopes?: Record<string, Record<string, string>>;

  @ApiPropertyOptional({
    description: 'Заметки пользователя по сессии',
    example: 'Нужно ещё вернуться к теме уверенности в себе.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ArchivistInsightResponseDto {
  @ApiProperty({
    description: 'Тёплый итог сразу после выхода из сессии',
    example:
      'За эту сессию ты заработал 18 монет. Ты уже хорошо разложил тему тревоги вокруг денег, и это важная работа.',
  })
  @IsString()
  wrapUpMessage: string;

  @ApiProperty({
    description: 'Более позднее приветствие при повторном входе в галерею',
    example:
      'Привет. Последнее, что ты разбирал, это «Я не знаю, как зарабатывать больше». Я бы рекомендовал вернуться к этой карточке или открыть новую тему из рекомендаций.',
  })
  @IsString()
  resumeMessage: string;

  @ApiProperty({
    description: 'Новые карточки, которые Архивариус рекомендует разобрать',
    type: [ArchivistSuggestedCardDto],
  })
  suggestedCards: ArchivistSuggestedCardDto[];
}
