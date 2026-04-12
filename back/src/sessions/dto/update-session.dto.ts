import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateSessionDto {
  @ApiPropertyOptional({
    description: "Новое название сессии",
    example: "Мысль: я недостаточно хорош",
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: "Сериализованное состояние диалога сессии",
  })
  @IsOptional()
  dialogStateJson?: unknown;

  @ApiPropertyOptional({
    description: "Вид сессии",
    example: "thought",
  })
  @IsOptional()
  @IsString()
  sessionKind?: string | null;

  @ApiPropertyOptional({
    description: "Заметки по сессии",
  })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
