import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email пользователя',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Пароль',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'Имя пользователя',
    example: 'ivan_petrov',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @ApiProperty({
    description: 'Email пользователя',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Пароль',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'Полное имя',
    example: 'Иван Петров',
  })
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UserProfileDto {
  @ApiProperty({ description: 'ID пользователя' })
  id: string;

  @ApiProperty({ description: 'Имя пользователя' })
  username: string;

  @ApiPropertyOptional({ description: 'Email' })
  email?: string | null;

  @ApiPropertyOptional({ description: 'Полное имя' })
  fullName?: string | null;

  @ApiPropertyOptional({ description: 'URL аватара' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ description: 'Роль пользователя', example: 'user' })
  role?: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Access token' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Данные пользователя', type: UserProfileDto })
  user: UserProfileDto;
}

