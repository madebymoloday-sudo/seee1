import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import axios from 'axios';

export interface SendResetOptions {
  email?: string;
  telegramId?: string;
  resetLink: string;
  expiresInMinutes: number;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initMailer();
  }

  private initMailer(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    if (host && user && pass) {
      this.transporter = createTransport({
        host,
        port: port || 587,
        secure,
        auth: { user, pass },
      });
      this.logger.log('SMTP transporter initialized');
    } else {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Email password reset disabled.',
      );
    }
  }

  async sendResetLink(options: SendResetOptions): Promise<void> {
    const { email, telegramId, resetLink, expiresInMinutes } = options;

    const tasks: Promise<void>[] = [];

    if (email && this.transporter) {
      tasks.push(this.sendEmail(email, resetLink, expiresInMinutes));
    }

    if (telegramId) {
      tasks.push(this.sendTelegram(telegramId, resetLink, expiresInMinutes));
    }

    if (tasks.length === 0) {
      this.logger.warn(
        'Password reset: neither email nor telegram configured for user',
      );
      return;
    }

    await Promise.allSettled(tasks);
  }

  private async sendEmail(
    email: string,
    resetLink: string,
    expiresInMinutes: number,
  ): Promise<void> {
    if (!this.transporter) return;

    const from = this.configService.get<string>(
      'SMTP_FROM',
      'Seee <noreply@seee.app>',
    );

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Восстановление пароля Seee',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>Восстановление пароля</h2>
            <p>Вы запросили восстановление пароля в Seee.</p>
            <p>Нажмите на ссылку ниже, чтобы задать новый пароль:</p>
            <p><a href="${resetLink}" style="color: #0066cc;">${resetLink}</a></p>
            <p style="color: #666; font-size: 14px;">Ссылка действительна ${expiresInMinutes} минут.</p>
            <p style="color: #666; font-size: 14px;">Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email: ${err?.message}`);
      throw err;
    }
  }

  private async sendTelegram(
    telegramId: string,
    resetLink: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const botToken = this.configService.get<string>(
      'TELEGRAM_LOGIN_BOT_TOKEN',
    );

    if (!botToken) {
      this.logger.warn(
        'TELEGRAM_LOGIN_BOT_TOKEN not set. Telegram password reset disabled.',
      );
      return;
    }

    const text = `🔐 Восстановление пароля Seee\n\nПерейдите по ссылке, чтобы задать новый пароль:\n${resetLink}\n\nСсылка действительна ${expiresInMinutes} мин.`;

    try {
      await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: telegramId,
          text,
        },
        { timeout: 10000 },
      );
      this.logger.log(`Password reset sent via Telegram to ${telegramId}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send Telegram: ${err?.response?.data?.description || err?.message}`,
      );
      // Не бросаем ошибку — пользователь мог не начать диалог с ботом
    }
  }
}
