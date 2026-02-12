import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type Lang = 'ru' | 'en';

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: {
    id: number;
  };
  from?: {
    id: number;
    first_name?: string;
    username?: string;
    language_code?: string;
  };
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly token?: string;
  private readonly supportChatId?: string;
  private readonly pollingEnabled: boolean;

  private offset = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  private readonly languageByChat = new Map<number, Lang>();
  private readonly launchedChats = new Set<number>();
  private readonly supportModeChats = new Set<number>();

  private readonly launchButton = 'Запустить Seee ботик';
  private readonly supportButton = 'Обратиться в поддержку';
  private readonly exitSupportButton = 'Выйти из поддержки';
  private readonly langRuButton = 'Русский';
  private readonly langEnButton = 'English';

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('TELEGRAM_LOGIN_BOT_TOKEN');
    this.supportChatId = this.configService.get<string>('TELEGRAM_SUPPORT_CHAT_ID');
    this.pollingEnabled =
      this.configService.get<string>('TELEGRAM_BOT_POLLING_ENABLED', 'true') !==
      'false';
  }

  onModuleInit() {
    if (!this.token) {
      this.logger.warn(
        'TELEGRAM_LOGIN_BOT_TOKEN is missing. Telegram bot menu/support is disabled.',
      );
      return;
    }

    if (!this.pollingEnabled) {
      this.logger.log('Telegram bot polling disabled (TELEGRAM_BOT_POLLING_ENABLED=false).');
      return;
    }

    this.logger.log('Telegram bot polling started.');
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startPolling() {
    const tick = async () => {
      if (this.pollInFlight) {
        this.pollTimer = setTimeout(tick, 1000);
        return;
      }
      this.pollInFlight = true;
      try {
        await this.pollUpdates();
      } catch (error: any) {
        this.logger.error(`Telegram polling error: ${error?.message || error}`);
      } finally {
        this.pollInFlight = false;
        this.pollTimer = setTimeout(tick, 1500);
      }
    };

    void tick();
  }

  private async pollUpdates() {
    const response = await axios.get<{ ok: boolean; result: TelegramUpdate[] }>(
      `https://api.telegram.org/bot${this.token}/getUpdates`,
      {
        params: {
          timeout: 25,
          offset: this.offset,
          allowed_updates: JSON.stringify(['message']),
        },
        timeout: 30000,
      },
    );

    if (!response.data?.ok || !Array.isArray(response.data.result)) {
      return;
    }

    for (const update of response.data.result) {
      this.offset = update.update_id + 1;
      if (update.message) {
        await this.handleMessage(update.message);
      }
    }
  }

  private async handleMessage(message: TelegramMessage) {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    if (!text) return;

    if (!this.languageByChat.has(chatId)) {
      const initialLang = message.from?.language_code?.startsWith('ru')
        ? 'ru'
        : 'en';
      this.languageByChat.set(chatId, initialLang);
    }

    if (text === '/start') {
      await this.sendWelcome(chatId);
      return;
    }

    if (text === this.langRuButton || text === this.langEnButton) {
      const lang: Lang = text === this.langRuButton ? 'ru' : 'en';
      this.languageByChat.set(chatId, lang);
      await this.sendMessage(
        chatId,
        lang === 'ru' ? 'Язык переключен на русский.' : 'Language switched to English.',
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.launchButton) {
      this.launchedChats.add(chatId);
      this.supportModeChats.delete(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Seee ботик запущен. Если нужна помощь — нажмите "Обратиться в поддержку".',
          en: 'Seee bot is ready. If you need help, tap "Contact support".',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.supportButton) {
      this.launchedChats.add(chatId);
      this.supportModeChats.add(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Режим обратной связи включен. Напишите ваше сообщение, я передам его поддержке.',
          en: 'Support mode is on. Send your message and I will forward it to support.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.exitSupportButton) {
      this.supportModeChats.delete(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Режим обратной связи выключен.',
          en: 'Support mode turned off.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (this.supportModeChats.has(chatId)) {
      await this.forwardToSupport(message);
      return;
    }

    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Нажмите "Запустить Seee ботик", чтобы начать.',
        en: 'Tap "Launch Seee bot" to begin.',
      }),
      this.getKeyboard(chatId),
    );
  }

  private async sendWelcome(chatId: number) {
    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Привет! Я бот Seee. Выберите язык и нажмите "Запустить Seee ботик".',
        en: 'Hi! I am Seee bot. Choose language and tap "Launch Seee bot".',
      }),
      this.getKeyboard(chatId),
    );
  }

  private async forwardToSupport(message: TelegramMessage) {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const from = message.from;
    const userLine = [
      `chat_id: ${chatId}`,
      from?.username ? `username: @${from.username}` : null,
      from?.first_name ? `name: ${from.first_name}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    if (!this.supportChatId) {
      this.logger.warn(
        `Support message received but TELEGRAM_SUPPORT_CHAT_ID is missing. ${userLine}. Message: ${text}`,
      );
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Сообщение получено, но поддержка сейчас не подключена. Попробуйте позже.',
          en: 'Message received, but support is not connected right now. Please try later.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    await this.sendRawMessage(
      Number(this.supportChatId),
      `📩 Новое обращение в поддержку\n${userLine}\n\n${text}`,
    );

    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Готово, сообщение отправлено в поддержку.',
        en: 'Done, your message was forwarded to support.',
      }),
      this.getKeyboard(chatId),
    );
  }

  private getKeyboard(chatId: number) {
    if (this.supportModeChats.has(chatId)) {
      return {
        keyboard: [
          [{ text: this.exitSupportButton }],
          [{ text: this.langRuButton }, { text: this.langEnButton }],
        ],
        resize_keyboard: true,
      };
    }

    if (!this.launchedChats.has(chatId)) {
      return {
        keyboard: [
          [{ text: this.launchButton }],
          [{ text: this.langRuButton }, { text: this.langEnButton }],
        ],
        resize_keyboard: true,
      };
    }

    return {
      keyboard: [
        [{ text: this.supportButton }],
        [{ text: this.langRuButton }, { text: this.langEnButton }],
      ],
      resize_keyboard: true,
    };
  }

  private t(chatId: number, text: { ru: string; en: string }): string {
    return this.languageByChat.get(chatId) === 'ru' ? text.ru : text.en;
  }

  private async sendMessage(chatId: number, text: string, replyMarkup?: any) {
    await this.sendRawMessage(chatId, text, replyMarkup);
  }

  private async sendRawMessage(chatId: number, text: string, replyMarkup?: any) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          chat_id: chatId,
          text,
          reply_markup: replyMarkup,
        },
        { timeout: 10000 },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send telegram message to ${chatId}: ${
          error?.response?.data?.description || error?.message || error
        }`,
      );
    }
  }
}

