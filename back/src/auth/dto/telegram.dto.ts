import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class TelegramAuthPayloadDto {
  @ApiProperty({
    description: 'Уникальный идентификатор пользователя в Telegram',
    example: '7286304943',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'Поле id должно содержать только цифры' })
  id: string;

  @ApiProperty({
    description: 'Имя пользователя в Telegram',
    example: 'Иван',
  })
  @IsString()
  @IsNotEmpty({ message: 'first_name не может быть пустым' })
  first_name: string;

  @ApiPropertyOptional({
    description: 'Фамилия пользователя в Telegram',
    example: 'Петров',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Username пользователя в Telegram',
    example: 'ivan_petrov',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'URL аватара пользователя',
    example: 'https://t.me/i/userpic/320/abcd1234.jpg',
  })
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiProperty({
    description: 'Время авторизации (unix timestamp)',
    example: 1730976000,
  })
  @Type(() => Number)
  @IsInt({ message: 'auth_date должен быть целым числом' })
  @Min(0)
  auth_date: number;

  @ApiProperty({
    description: 'Хэш, подписанный Telegram',
    example:
      'a2ff0b58e531d0ef0a6e2e1f5780f0b0a6f45d5ff10c4a5a9bdb0f2e3a1b2c3d',
  })
  @IsString()
  @IsNotEmpty({ message: 'hash обязателен' })
  hash: string;
}

export class TelegramLoginDto extends TelegramAuthPayloadDto {}
export class TelegramLinkDto extends TelegramAuthPayloadDto {}

