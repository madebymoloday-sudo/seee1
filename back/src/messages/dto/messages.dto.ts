import { ApiProperty } from '@nestjs/swagger';

export class MessageDto {
  @ApiProperty({ description: 'ID сообщения', example: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Роль отправителя',
    enum: ['user', 'assistant'],
    example: 'user',
  })
  role: 'user' | 'assistant';

  @ApiProperty({ description: 'Содержимое сообщения', example: 'Привет!' })
  content: string;

  @ApiProperty({ description: 'Время отправки' })
  timestamp: Date;
}

export class MessagesResponseDto {
  @ApiProperty({
    description: 'Список сообщений',
    type: [MessageDto],
  })
  messages: MessageDto[];

  @ApiProperty({
    description: 'Cursor для следующей страницы (ID последнего сообщения)',
    example: 'uuid',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Есть ли еще сообщения для загрузки',
    example: true,
  })
  hasMore: boolean;
}

