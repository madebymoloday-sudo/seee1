import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { TelegramAuthPayloadDto } from './dto/telegram.dto';

export interface ValidatedTelegramAuthPayload {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  authDate: number;
  raw: Record<string, string>;
}

@Injectable()
export class TelegramAuthService {
  private readonly maxAuthAgeSeconds: number;
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(private readonly configService: ConfigService) {
    this.maxAuthAgeSeconds = Number.parseInt(
      this.configService.get<string>('TELEGRAM_LOGIN_MAX_AGE_SECONDS', '600'),
      10,
    );
  }

  validatePayload(
    payload: TelegramAuthPayloadDto,
  ): ValidatedTelegramAuthPayload {
    const botToken = this.configService.get<string>(
      'TELEGRAM_LOGIN_BOT_TOKEN',
    );

    if (!botToken) {
      this.logger.error(
        'TELEGRAM_LOGIN_BOT_TOKEN is missing. Telegram login cannot be validated.',
      );
      throw new UnauthorizedException('Telegram авторизация не настроена');
    }

    // Проверка времени авторизации
    const authDate = Number(payload.auth_date);
    if (Number.isNaN(authDate)) {
      throw new UnauthorizedException('Некорректное значение auth_date');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - authDate > this.maxAuthAgeSeconds) {
      throw new UnauthorizedException(
        'Сессия Telegram истекла, попробуйте снова',
      );
    }

    // Проверка подписи
    const dataCheckString = this.buildDataCheckString(payload);
    const secretKey = createHash('sha256').update(botToken).digest();
    const expectedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== payload.hash) {
      throw new UnauthorizedException('Телеграм подпись недействительна');
    }

    return {
      telegramId: payload.id,
      firstName: payload.first_name,
      lastName: payload.last_name,
      username: payload.username,
      photoUrl: payload.photo_url,
      authDate,
      raw: this.normalizePayload(payload),
    };
  }

  private buildDataCheckString(payload: TelegramAuthPayloadDto): string {
    const entries = Object.entries(payload)
      .filter(
        ([key, value]) =>
          key !== 'hash' && value !== undefined && value !== null,
      )
      .map(([key, value]) => `${key}=${value}`)
      .sort();

    return entries.join('\n');
  }

  private normalizePayload(
    payload: TelegramAuthPayloadDto,
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      normalized[key] = String(value);
    });

    return normalized;
  }
}

