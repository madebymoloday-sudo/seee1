import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class CreatePipelineDto {
  @ApiProperty({ description: 'Название пайплайна' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Версия пайплайна', required: false })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiProperty({ description: 'Описание пайплайна', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Конфигурация пайплайна в формате JSON' })
  @IsObject()
  configJson: any;

  @ApiProperty({ description: 'Является ли пайплайн дефолтным', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdatePipelineDto {
  @ApiProperty({ description: 'Название пайплайна', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Версия пайплайна', required: false })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiProperty({ description: 'Описание пайплайна', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Конфигурация пайплайна в формате JSON', required: false })
  @IsObject()
  @IsOptional()
  configJson?: any;

  @ApiProperty({ description: 'Является ли пайплайн дефолтным', required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class PipelineResponseDto {
  @ApiProperty({ description: 'ID пайплайна' })
  id: string;

  @ApiProperty({ description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ description: 'Название пайплайна' })
  name: string;

  @ApiProperty({ description: 'Версия пайплайна', required: false })
  version?: string;

  @ApiProperty({ description: 'Описание пайплайна', required: false })
  description?: string;

  @ApiProperty({ description: 'Конфигурация пайплайна' })
  configJson: any;

  @ApiProperty({ description: 'Является ли пайплайн дефолтным' })
  isDefault: boolean;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}

