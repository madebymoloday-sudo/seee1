import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const SUBJECT_VALUES = ['situation', 'thought'] as const;
const DECISION_VALUES = ['advance', 'clarify'] as const;

export class StageAssistRequestDto {
  @ApiProperty({
    description: 'Тип разбираемого блока',
    enum: SUBJECT_VALUES,
    example: 'situation',
  })
  @IsString()
  @IsIn(SUBJECT_VALUES)
  subject: 'situation' | 'thought';

  @ApiProperty({
    description: 'Номер шага основного разбора',
    example: 3,
    minimum: 1,
    maximum: 9,
  })
  @IsInt()
  @Min(1)
  @Max(9)
  step: number;

  @ApiProperty({
    description: 'Текущий ответ пользователя',
    example: 'Деньги',
  })
  @IsString()
  answer: string;

  @ApiPropertyOptional({
    description: 'Первый базовый ответ пользователя на этом шаге',
    example: 'Деньги',
  })
  @IsOptional()
  @IsString()
  stageAnswer?: string;

  @ApiPropertyOptional({
    description: 'Предыдущие ответы на уточняющие подвопросы',
    type: [String],
    example: ['Я не знаю, как зарабатывать больше'],
  })
  @IsOptional()
  clarificationAnswers?: string[];

  @ApiPropertyOptional({
    description: 'Сколько уточнений уже было задано на этом шаге',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  clarificationCount?: number;

  @ApiPropertyOptional({
    description: 'Все сохранённые ответы по текущей ветке разбора',
    additionalProperties: { type: 'string' },
    example: {
      'core:situation:1': 'Я не знаю, как заработать на квартиру',
      'core:situation:2': 'Тревога',
      'core:situation:3': 'Я боюсь, что не справлюсь',
    },
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Короткое описание текущей ситуации/заголовка сессии',
    example: 'Я не знаю, как заработать на квартиру',
  })
  @IsOptional()
  @IsString()
  situationText?: string;

  @ApiPropertyOptional({
    description: 'Текущий текст списка причин/важных мыслей',
    example: 'Я боюсь остаться без денег\nЯ не доверяю себе',
  })
  @IsOptional()
  @IsString()
  importantText?: string;

  @ApiPropertyOptional({
    description:
      'Пользователь нажал кнопку "Не знаю, как описать" и хочет пойти дальше',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  skipRequested?: boolean;
}

export class StageAssistResponseDto {
  @ApiProperty({
    description: 'Решение: идти дальше или задать уточняющий подвопрос',
    enum: DECISION_VALUES,
    example: 'clarify',
  })
  @IsString()
  @IsIn(DECISION_VALUES)
  decision: 'advance' | 'clarify';

  @ApiProperty({
    description:
      'Нормализованный ответ, который нужно сохранить на текущем шаге',
    example: 'Я боюсь, что не успею заработать деньги на квартиру',
  })
  @IsString()
  normalizedAnswer: string;

  @ApiProperty({
    description:
      'Поддерживающая реакция системы. При decision=advance используется перед следующим шагом, при clarify — перед подвопросом.',
    example:
      'Спасибо, теперь картина стала яснее. Давайте посмотрим, какую эмоцию вызывает у вас эта ситуация.',
  })
  @IsString()
  reaction: string;

  @ApiPropertyOptional({
    description: 'Уточняющий подвопрос, если ответа пока недостаточно',
    example:
      'Что именно происходит с деньгами прямо сейчас: их не хватает на обязательные расходы, вы боитесь потерять доход или дело в чём-то ещё?',
  })
  @IsOptional()
  @IsString()
  followUpQuestion?: string;
}
