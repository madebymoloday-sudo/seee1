import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class UpdateSessionProgramDto {
  @ApiProperty({
    description: "ID пайплайна (программы)",
    example: "uuid",
  })
  @IsString()
  pipelineId: string;
}

