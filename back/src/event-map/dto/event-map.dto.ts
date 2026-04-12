import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEventMapDto {
  @ApiProperty({
    description: 'Номер события',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  eventNumber?: number;

  @ApiProperty({
    description: 'Описание события',
    example: 'Экзамен',
    required: false,
  })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiProperty({
    description: 'Эмоция, вызванная событием',
    example: 'Тревога',
    required: false,
  })
  @IsOptional()
  @IsString()
  emotion?: string;

  @ApiProperty({
    description: 'Идея/мысль, связанная с событием',
    example: 'Я провалюсь',
    required: false,
  })
  @IsOptional()
  @IsString()
  idea?: string;

  @ApiPropertyOptional({
    description: 'Корневое убеждение',
    example: 'Я неудачник',
  })
  @IsOptional()
  @IsString()
  rootBelief?: string;

  @ApiPropertyOptional({
    description: 'Тип узла mindmap',
    example: 'SITUATION',
  })
  @IsOptional()
  @IsString()
  nodeType?: string;

  @ApiPropertyOptional({
    description: 'Название узла',
    example: 'Ссора с коллегой',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({
    description: 'Описание узла',
    example: 'Коллега резко ответил на созвоне',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Родительский узел',
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Уровень узла в дереве',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiPropertyOptional({
    description: 'Порядок отображения',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Связанная сессия',
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  sourceSessionId?: string;

  @ApiPropertyOptional({
    description: 'Связанный thought scope',
    example: 'thought-123',
  })
  @IsOptional()
  @IsString()
  sourceThoughtScopeId?: string;

  @ApiPropertyOptional({
    description: 'Пометка, что мысль временно не важна',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isMuted?: boolean;

  @ApiPropertyOptional({
    description: 'Дополнительные данные узла',
  })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;
}

export class UpdateEventMapDto extends CreateEventMapDto {}

export class EventMapResponseDto {
  @ApiProperty({ description: 'ID записи' })
  id: string;

  @ApiProperty({ description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ description: 'Номер события' })
  eventNumber?: number | null;

  @ApiProperty({ description: 'Описание события' })
  event?: string | null;

  @ApiProperty({ description: 'Эмоция' })
  emotion?: string | null;

  @ApiProperty({ description: 'Идея' })
  idea?: string | null;

  @ApiPropertyOptional({ description: 'Корневое убеждение' })
  rootBelief?: string | null;

  @ApiProperty({ description: 'Завершена ли обработка' })
  isCompleted: boolean;

  @ApiPropertyOptional({ description: 'Тип узла карты' })
  nodeType?: string;

  @ApiPropertyOptional({ description: 'Название узла' })
  title?: string | null;

  @ApiPropertyOptional({ description: 'Описание узла' })
  description?: string | null;

  @ApiPropertyOptional({ description: 'ID родителя' })
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Уровень узла' })
  level?: number;

  @ApiPropertyOptional({ description: 'Порядок отображения' })
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'ID связанной сессии' })
  sourceSessionId?: string | null;

  @ApiPropertyOptional({ description: 'ID связанного thought scope' })
  sourceThoughtScopeId?: string | null;

  @ApiPropertyOptional({ description: 'Мысль временно не важна' })
  isMuted?: boolean;

  @ApiPropertyOptional({ description: 'Дополнительные данные узла' })
  metaJson?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}
