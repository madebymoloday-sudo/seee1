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
}

