import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateSessionDto {
  @ApiProperty({
    description: "Название сессии",
    example: "Тревога перед экзаменом",
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: "Название программы психолога",
    example: "default",
    required: false,
  })
  @IsOptional()
  @IsString()
  programName?: string;
}

export class SessionResponseDto {
  @ApiProperty({ description: "ID сессии", example: "uuid" })
  id: string;

  @ApiProperty({ description: "ID пользователя", example: "uuid" })
  userId: string;

  @ApiProperty({
    description: "Название сессии",
    example: "Тревога перед экзаменом",
    nullable: true,
  })
  title: string | null;

  @ApiProperty({ description: "Количество сообщений", example: 10 })
  messageCount: number;

  @ApiProperty({
    description: "Сколько монет было заработано в этой сессии",
    example: 18,
    required: false,
  })
  coinsEarned?: number;

  @ApiProperty({
    description: "Сериализованное состояние диалога",
    required: false,
    nullable: true,
  })
  dialogStateJson?: unknown | null;

  @ApiProperty({
    description: "Режим/вид сессии",
    required: false,
    nullable: true,
    example: "thought",
  })
  sessionKind?: string | null;

  @ApiProperty({
    description: "Заметки по сессии",
    required: false,
    nullable: true,
  })
  notes?: string | null;

  @ApiProperty({ description: "Дата создания" })
  createdAt: Date;

  @ApiProperty({ description: "Дата обновления" })
  updatedAt: Date;
}
