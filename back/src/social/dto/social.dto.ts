import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class AddFriendDto {
  @ApiProperty({ description: 'Публичный ID пользователя для добавления', example: 'SEEE_USER_01' })
  @IsString()
  @IsNotEmpty()
  friendUserId: string;
}

export class CreateDirectChatDto {
  @ApiProperty({ description: 'Публичный ID пользователя', example: 'SEEE_USER_01' })
  @IsString()
  @IsNotEmpty()
  friendUserId: string;
}

export class CreateGroupChatDto {
  @ApiProperty({ description: 'Название группы', example: 'Команда разбора' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ description: 'Публичные ID участников', example: ['SEEE_USER_01', 'SEEE_USER_02'] })
  @IsArray()
  @IsString({ each: true })
  memberUserIds: string[];
}

export class SendChatMessageDto {
  @ApiProperty({ description: 'Текст сообщения' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Режим чата',
    example: 'Объяснить',
    default: 'Объяснить',
  })
  @IsOptional()
  @IsString()
  mode?: string;
}

export class StartModeRequestDto {
  @ApiProperty({
    description: 'Название режима',
    example: 'Объяснить',
  })
  @IsString()
  @IsNotEmpty()
  mode: string;
}

export class RespondModeRequestDto {
  @ApiProperty({ description: 'Согласие/отклонение', example: true })
  @IsBoolean()
  accepted: boolean;
}

export class ExplainSessionActionDto {
  @ApiProperty({ description: 'Действие инициатора', example: 'next' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['next', 'back', 'finish'])
  action: 'next' | 'back' | 'finish';
}

export class ExplainStepAnswerDto {
  @ApiProperty({ description: 'Текст ответа шага' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class ExplainEditAnswerDto {
  @ApiProperty({ description: 'Номер шага', example: 3 })
  step: number;

  @ApiProperty({ description: 'Индекс ответа в шаге', example: 0 })
  answerIndex: number;

  @ApiProperty({ description: 'Новый текст' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class MarkChatReadDto {
  @ApiPropertyOptional({ description: 'Последнее прочитанное сообщение', example: 'chat-message-id' })
  @IsOptional()
  @IsString()
  lastMessageId?: string;
}

export class BrowserPushSubscriptionDto {
  @ApiProperty({ description: 'Push endpoint браузера' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiPropertyOptional({ description: 'Время истечения подписки' })
  @IsOptional()
  expirationTime?: number | null;

  @ApiProperty({
    description: 'Ключи браузерной push-подписки',
    example: { p256dh: '...', auth: '...' },
  })
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class RemoveBrowserPushSubscriptionDto {
  @ApiProperty({ description: 'Push endpoint браузера' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}

export class UpdateTelegramNotificationPreferenceDto {
  @ApiProperty({ description: 'Включить Telegram-уведомления для мегачатов', example: true })
  @IsBoolean()
  enabled: boolean;
}
