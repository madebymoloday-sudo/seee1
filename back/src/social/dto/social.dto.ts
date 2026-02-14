import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

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

