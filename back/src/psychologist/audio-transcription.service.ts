import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';

const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

function normalizeFileName(
  originalName?: string,
  mimeType?: string,
): string {
  const trimmed = (originalName || '').trim();
  if (trimmed) return trimmed.replace(/\s+/g, '-');

  if (mimeType?.includes('mp4')) return 'voice-note.m4a';
  if (mimeType?.includes('ogg')) return 'voice-note.ogg';
  if (mimeType?.includes('wav')) return 'voice-note.wav';
  return 'voice-note.webm';
}

@Injectable()
export class AudioTranscriptionService {
  private readonly logger = new Logger(AudioTranscriptionService.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-openai-api-key') {
      throw new ServiceUnavailableException({
        message:
          'Транскрибация не настроена. У сервера не подключен OpenAI API ключ.',
        field: 'transcription',
      });
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async transcribeAudio(file?: {
    buffer?: Buffer;
    originalname?: string;
    mimetype?: string;
    size?: number;
  }): Promise<{ text: string; model: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Аудиофайл не получен');
    }

    const model =
      this.configService.get<string>('OPENAI_TRANSCRIPTION_MODEL')?.trim() ||
      DEFAULT_TRANSCRIPTION_MODEL;

    try {
      const upload = await toFile(
        file.buffer,
        normalizeFileName(file.originalname, file.mimetype),
        {
          type: file.mimetype || undefined,
        },
      );

      const transcription = await this.getClient().audio.transcriptions.create({
        file: upload,
        model,
      });

      const text =
        typeof transcription === 'string'
          ? transcription.trim()
          : String(transcription.text || '').trim();

      if (!text) {
        throw new BadRequestException(
          'Не удалось распознать речь в аудио. Попробуйте ещё раз.',
        );
      }

      return { text, model };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown transcription error';
      this.logger.error(`Audio transcription failed: ${message}`);

      throw new ServiceUnavailableException({
        message:
          'Не удалось распознать аудио. Проверьте микрофон и попробуйте ещё раз.',
        field: 'transcription',
      });
    }
  }
}
