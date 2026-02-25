import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class NeuroHintRequestDto {
  @ApiProperty({
    description: 'Описание ситуации',
    example: 'Меня постоянно критикует начальник на работе',
  })
  @IsString()
  @IsNotEmpty()
  situation: string;

  @ApiProperty({
    description: 'Эмоция, которую вызывает ситуация',
    example: 'Тревога',
  })
  @IsString()
  @IsNotEmpty()
  emotion: string;
}

export class NeuroHintResponseDto {
  @ApiProperty({
    description: 'Подсказка (вопрос/наводка) для формулировки мысли',
  })
  message: string;
}

