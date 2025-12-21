import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateEventMapDto {
  @ApiProperty({
    description: 'Номер события',
    example: 1,
  })
  @IsInt()
  eventNumber: number;

  @ApiProperty({
    description: 'Описание события',
    example: 'Экзамен',
  })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({
    description: 'Эмоция, вызванная событием',
    example: 'Тревога',
  })
  @IsString()
  @IsNotEmpty()
  emotion: string;

  @ApiProperty({
    description: 'Идея/мысль, связанная с событием',
    example: 'Я провалюсь',
  })
  @IsString()
  @IsNotEmpty()
  idea: string;

  @ApiPropertyOptional({
    description: 'Корневое убеждение',
    example: 'Я неудачник',
  })
  @IsOptional()
  @IsString()
  rootBelief?: string;
}

export class EventMapResponseDto {
  @ApiProperty({ description: 'ID записи' })
  id: string;

  @ApiProperty({ description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ description: 'Номер события' })
  eventNumber: number;

  @ApiProperty({ description: 'Описание события' })
  event: string;

  @ApiProperty({ description: 'Эмоция' })
  emotion: string;

  @ApiProperty({ description: 'Идея' })
  idea: string;

  @ApiPropertyOptional({ description: 'Корневое убеждение' })
  rootBelief?: string | null;

  @ApiProperty({ description: 'Завершена ли обработка' })
  isCompleted: boolean;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}

