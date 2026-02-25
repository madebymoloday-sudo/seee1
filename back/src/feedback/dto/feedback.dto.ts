import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackStatus, FeedbackType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class FeedbackItemDto {
  @ApiProperty({ description: 'ID записи обратной связи' })
  id: string;

  @ApiPropertyOptional({ description: 'ID сессии (если отзыв привязан к сессии)' })
  sessionId?: string | null;

  @ApiPropertyOptional({ description: 'Название сессии (для удобного вывода в UI)' })
  sessionTitle?: string | null;

  @ApiPropertyOptional({ description: 'Название отзыва (редактируемое пользователем)' })
  title?: string | null;

  @ApiProperty({ description: 'Текст отзыва (или сериализованная форма)' })
  description: string;

  @ApiProperty({ enum: FeedbackType })
  feedbackType: FeedbackType;

  @ApiProperty({ enum: FeedbackStatus })
  status: FeedbackStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreateFeedbackDto {
  @ApiPropertyOptional({ description: 'ID сессии (если отзыв оставлен после сессии)' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Название отзыва' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Текст отзыва' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  description: string;

  @ApiPropertyOptional({ enum: FeedbackType, description: 'Тип обратной связи' })
  @IsOptional()
  @IsEnum(FeedbackType)
  feedbackType?: FeedbackType;
}

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ description: 'Новое название отзыва' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Новый текст отзыва' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;
}

