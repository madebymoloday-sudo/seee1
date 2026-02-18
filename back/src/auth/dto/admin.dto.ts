import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class AdminGeneratePasswordResetLinkDto {
  @ApiProperty({
    description: 'Email аккаунта, для которого генерируем reset link',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Срок жизни ссылки (минуты). По умолчанию 60.',
    example: 60,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(24 * 60)
  expiresInMinutes?: number;
}

export class AdminGeneratePasswordResetLinkResponseDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'https://front.example.com/reset-password?token=...' })
  resetLink: string;

  @ApiProperty({ example: '2026-02-18T01:23:45.000Z' })
  expiresAt: string;

  @ApiProperty({ example: false })
  telegramLinked: boolean;
}

