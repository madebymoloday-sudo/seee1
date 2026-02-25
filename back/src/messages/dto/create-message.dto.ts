import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Содержимое сообщения',
    example: 'Привет, мне нужна помощь',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

