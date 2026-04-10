import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength, Matches, MaxLength, IsIn } from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'ID пользователя, который пригласил (реферальный источник)',
    example: 'uuid-реферера',
  })
  @IsString()
  @IsOptional()
  referrerId?: string;

  @ApiPropertyOptional({
    description: 'Код ссылки для регистрации сотрудника',
    example: 'TEAMABC123',
  })
  @IsString()
  @IsOptional()
  teamInviteCode?: string;
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

  @ApiPropertyOptional({
    description: 'Тип аккаунта',
    example: 'MANAGER',
  })
  accountType?: 'USER' | 'MANAGER' | 'TEAM_MEMBER';

  @ApiPropertyOptional({ description: 'Telegram ID (если привязан)' })
  telegramId?: string | null;

  @ApiPropertyOptional({
    description: 'Публичный уникальный ID пользователя',
    example: 'SEEE_USER_01',
  })
  userId?: string | null;

  @ApiPropertyOptional({
    description: 'Статус подписки',
    example: 'ACTIVE',
  })
  subscriptionStatus?: 'NONE' | 'ACTIVE' | 'CANCELED';

  @ApiPropertyOptional({
    description: 'Активна ли подписка',
    example: true,
  })
  subscriptionActive?: boolean;

  @ApiPropertyOptional({
    description: 'Дата окончания подписки',
    example: '2026-03-10T00:00:00.000Z',
  })
  subscriptionEndsAt?: string | null;

  @ApiPropertyOptional({
    description: 'Сколько минут в день пользователь хочет тратить на приложение',
    example: 10,
  })
  dailyPracticeMinutes?: 5 | 10 | 15 | null;
}

export class ManagerAccessSetupDto {
  @ApiProperty({
    description: 'Email аккаунта, которому нужно выдать статус руководителя',
    example: 'manager@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Лимит сотрудников по ссылке',
    example: 20,
  })
  @IsOptional()
  teamSeatsLimit?: number;
}

export class ManagerAccessSetupResponseDto {
  @ApiProperty({ description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ description: 'Email пользователя' })
  email: string;

  @ApiProperty({ description: 'Тип аккаунта' })
  accountType: 'MANAGER';

  @ApiProperty({ description: 'Лимит сотрудников' })
  teamSeatsLimit: number;

  @ApiProperty({ description: 'Реферальная ссылка для продаж' })
  salesReferralLink: string;

  @ApiProperty({ description: 'Ссылка для сотрудников' })
  employeeInviteLink: string;
}

export class SubscriptionStatusDto {
  @ApiProperty({
    description: 'Статус подписки',
    example: 'ACTIVE',
  })
  status: 'NONE' | 'ACTIVE' | 'CANCELED';

  @ApiProperty({
    description: 'Активна ли подписка',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Дата окончания подписки',
    example: '2026-03-10T00:00:00.000Z',
  })
  endsAt?: string | null;
}

export class ManagerTeamMemberDto {
  @ApiProperty({ description: 'Внутренний ID пользователя' })
  id: string;

  @ApiPropertyOptional({ description: 'Публичный ID пользователя' })
  userId?: string | null;

  @ApiProperty({ description: 'Имя аккаунта' })
  username: string;

  @ApiPropertyOptional({ description: 'Полное имя' })
  fullName?: string | null;

  @ApiProperty({ description: 'Зарегистрирован ли сотрудник по ссылке' })
  isRegistered: boolean;

  @ApiProperty({ description: 'Количество разобранных карточек' })
  processedCardsCount: number;

  @ApiProperty({ description: 'Рейтинг в монетах' })
  coinsRating: number;

  @ApiPropertyOptional({ description: 'Эмоциональный фон по последней обратной связи' })
  emotionalState?: string | null;

  @ApiPropertyOptional({ description: 'Краткая метка эмоционального фона' })
  emotionalTone?: string | null;

  @ApiPropertyOptional({ description: 'Дата последней обратной связи' })
  lastFeedbackAt?: string | null;
}

export class ManagerTeamOverviewDto {
  @ApiProperty({ description: 'Количество подключённых аккаунтов' })
  connectedAccountsCount: number;

  @ApiProperty({ description: 'Лимит мест для сотрудников' })
  teamSeatsLimit: number;

  @ApiProperty({ description: 'Сколько мест уже занято' })
  occupiedSeatsCount: number;

  @ApiProperty({ type: [ManagerTeamMemberDto] })
  members: ManagerTeamMemberDto[];
}

export class RedeemPromoCodeDto {
  @ApiProperty({
    description: 'Промокод для бесплатного доступа',
    example: 'SEEEFREEE',
  })
  @IsString()
  @IsNotEmpty()
  promoCode: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Access token' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Данные пользователя', type: UserProfileDto })
  user: UserProfileDto;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Имя пользователя',
    example: 'ivan_petrov',
    minLength: 3,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ApiPropertyOptional({
    description: 'Уникальный публичный ID пользователя (для добавления в друзья)',
    example: 'SEEE_USER_01',
    minLength: 4,
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'userId может содержать только латинские буквы, цифры и underscore',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Новый пароль (минимум 6 символов)',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    description: 'Сколько минут в день пользователь хочет тратить на приложение',
    example: 10,
    enum: [5, 10, 15],
  })
  @IsOptional()
  @IsIn([5, 10, 15])
  dailyPracticeMinutes?: 5 | 10 | 15;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email пользователя',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Токен сброса из письма или Telegram',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Новый пароль',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
