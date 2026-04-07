import { ApiProperty } from '@nestjs/swagger';

export class AudioTranscriptionUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Аудиофайл для транскрибации',
  })
  file: any;
}

export class AudioTranscriptionResponseDto {
  @ApiProperty({
    description: 'Распознанный текст',
    example: 'Меня беспокоит ситуация, как я сейчас живу.',
  })
  text: string;

  @ApiProperty({
    description: 'Модель OpenAI, которая была использована для транскрибации',
    example: 'gpt-4o-mini-transcribe',
  })
  model: string;
}
