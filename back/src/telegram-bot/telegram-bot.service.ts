import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PersonalityTestService } from './personality-test.service';
import { LevelImageService } from './level-image.service';

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
    type?: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
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
  private supportChatIdRuntime: number | null = null;
  private readonly pollingEnabled: boolean;

  private offset = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  private readonly languageByChat = new Map<number, Lang>();
  private readonly launchedChats = new Set<number>();
  private readonly supportModeChats = new Set<number>();
  private readonly passwordResetModeChats = new Set<number>();
  private readonly cabinetModeChats = new Set<number>();

  private readonly launchButton = 'Запускаемся';
  private readonly legacyLaunchButton = 'Запустить Seee ботик';
  private readonly supportButton = 'Обратиться в поддержку';
  private readonly exitSupportButton = 'Выйти из поддержки';
  private readonly cabinetButton = 'Личный кабинет';
  private readonly cabinetLangButton = 'Выбор языка';
  private readonly cabinetChangePasswordButton = 'Изменить пароль';
  private readonly cabinetBackButton = 'Назад';
  private readonly langRuButton = 'Русский';
  private readonly langEnButton = 'English';
  private readonly bindSupportCommand = '/set_support_group';

  private readonly testButton = 'Пройти тест';
  private readonly testButtonEn = 'Take the test';
  private readonly returnToMenuButton = 'Вернуться в меню';
  private readonly returnToMenuButtonEn = 'Return to menu';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly personalityTest: PersonalityTestService,
    private readonly levelImage: LevelImageService,
  ) {
    this.token = this.configService.get<string>('TELEGRAM_LOGIN_BOT_TOKEN');
    this.supportChatId = this.configService.get<string>('TELEGRAM_SUPPORT_CHAT_ID');
    if (this.supportChatId) {
      const parsed = Number(this.supportChatId);
      this.supportChatIdRuntime = Number.isFinite(parsed) ? parsed : null;
    }
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

  private normalizeButtonText(t: string): string {
    return t
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private isTestButtonClick(text: string): boolean {
    const n = this.normalizeButtonText(text);
    if (n === 'пройти тест' || n === 'take the test') return true;
    if (n.includes('пройти') && n.includes('тест')) return true;
    if (n.includes('test') && (n.includes('take') || n.includes('pass'))) return true;
    return false;
  }

  private async handleMessage(message: TelegramMessage) {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    if (!text) return;

    if (chatId < 0) {
      await this.handleGroupMessage(message);
      return;
    }

    if (!this.languageByChat.has(chatId)) {
      const initialLang = message.from?.language_code?.startsWith('ru')
        ? 'ru'
        : 'en';
      this.languageByChat.set(chatId, initialLang);
    }

    if (text === '/start' || text.startsWith('/start ')) {
      const payload = text.startsWith('/start ') ? text.slice('/start '.length).trim() : '';
      if (payload.startsWith('link_')) {
        const token = payload.slice('link_'.length).trim();
        await this.tryLinkAccountFromStartPayload(message, token);
        return;
      }
      this.personalityTest.resetTest(chatId);
      await this.sendWelcome(chatId);
      return;
    }

    // Кнопка «Пройти тест» — всегда показываем приветствие (любой вариант написания)
    if (this.isTestButtonClick(text)) {
      await this.startPersonalityTest(chatId);
      return;
    }

    // Тест личности: кнопка «Вернуться в меню»
    const testState = this.personalityTest.getState(chatId);
    const isReturnToMenu =
      this.normalizeButtonText(text) === 'вернуться в меню' ||
      this.normalizeButtonText(text) === 'return to menu' ||
      (text.includes('вернуться') && text.includes('меню')) ||
      (text.includes('return') && text.includes('menu'));
    if (
      (testState?.step === 0 || this.personalityTest.isInProgress(chatId)) &&
      isReturnToMenu
    ) {
      this.personalityTest.resetTest(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Тест прерван. Возвращаю в меню.',
          en: 'Test cancelled. Returning to menu.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    // Тест личности: после интро (step 0) — отправить первый вопрос
    if (testState?.step === 0) {
      const firstQ = this.personalityTest.advanceToFirstQuestion(chatId);
      if (firstQ) {
        await this.sendMessage(chatId, firstQ, this.getTestKeyboard());
      }
      return;
    }

    // Тест личности: в процессе (шаги 1–48)
    if (this.personalityTest.isInProgress(chatId)) {
      await this.handleTestAnswer(chatId, text);
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

    if (text === this.launchButton || text === this.legacyLaunchButton) {
      this.launchedChats.add(chatId);
      this.supportModeChats.delete(chatId);
      this.passwordResetModeChats.delete(chatId);
      this.cabinetModeChats.delete(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Seee ботик запущен. Откройте "Личный кабинет" для смены языка и пароля.',
          en: 'Seee bot is ready. Open "Personal cabinet" to change language and password.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.supportButton) {
      this.launchedChats.add(chatId);
      this.supportModeChats.add(chatId);
      this.passwordResetModeChats.delete(chatId);
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

    if (text === this.cabinetButton) {
      this.launchedChats.add(chatId);
      this.supportModeChats.delete(chatId);
      this.passwordResetModeChats.delete(chatId);
      this.cabinetModeChats.add(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Личный кабинет: выберите действие ниже.',
          en: 'Personal cabinet: choose an action below.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.cabinetBackButton) {
      this.cabinetModeChats.delete(chatId);
      this.passwordResetModeChats.delete(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Возвращаемся в главное меню.',
          en: 'Returning to the main menu.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.cabinetLangButton) {
      this.cabinetModeChats.add(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Выберите язык:',
          en: 'Choose language:',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text === this.cabinetChangePasswordButton) {
      this.launchedChats.add(chatId);
      this.supportModeChats.delete(chatId);
      this.cabinetModeChats.add(chatId);
      await this.startPasswordReset(chatId);
      return;
    }

    if (text === this.exitSupportButton) {
      this.supportModeChats.delete(chatId);
      this.passwordResetModeChats.delete(chatId);
      this.cabinetModeChats.delete(chatId);
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

    if (this.passwordResetModeChats.has(chatId)) {
      await this.handlePasswordResetMessage(chatId, text);
      return;
    }

    if (this.supportModeChats.has(chatId)) {
      await this.forwardToSupport(message);
      return;
    }

    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Нажмите "Запускаемся", чтобы начать.',
        en: "Tap 'Let's start' to begin.",
      }),
      this.getKeyboard(chatId),
    );
  }

  private async tryLinkAccountFromStartPayload(
    message: TelegramMessage,
    token: string,
  ) {
    const chatId = message.chat.id;
    const fromId = message.from?.id;
    if (!fromId) {
      await this.sendMessage(
        chatId,
        'Не удалось получить ваш Telegram ID. Попробуйте открыть ссылку ещё раз.',
        this.getKeyboard(chatId),
      );
      return;
    }

    if (!token) {
      await this.sendMessage(
        chatId,
        'Ссылка для привязки повреждена. Запросите новую в личном кабинете Seee.',
        this.getKeyboard(chatId),
      );
      return;
    }

    const record = await this.prisma.telegramLinkToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record || record.expiresAt < new Date()) {
      await this.sendMessage(
        chatId,
        'Ссылка для привязки недействительна или истекла. Запросите новую в личном кабинете Seee.',
        this.getKeyboard(chatId),
      );
      return;
    }

    const telegramId = String(fromId);

    // Make sure telegramId isn't already linked to someone else.
    const existing = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    if (existing && existing.id !== record.userId) {
      await this.sendMessage(
        chatId,
        'Этот Telegram уже привязан к другому аккаунту Seee.',
        this.getKeyboard(chatId),
      );
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { telegramId },
      }),
      this.prisma.telegramLinkToken.delete({
        where: { id: record.id },
      }),
    ]);

    await this.sendMessage(
      chatId,
      '✅ Готово! Telegram привязан к вашему аккаунту Seee. Теперь можно входить и восстанавливать пароль через Telegram.',
      this.getKeyboard(chatId),
    );
  }

  private async sendWelcome(chatId: number) {
    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Привет! Я бот Seee. Нажмите "Запускаемся" или "Пройти тест" — в конце получите уровень и 12 пунктов для работы. Кнопки языка и смены пароля в "Личном кабинете".',
        en: "Hi! I am Seee bot. Tap 'Let's start' or 'Take the test' — you'll get your level and 12 points to work on. Language and password are in 'Personal cabinet'.",
      }),
      this.getKeyboard(chatId),
    );
  }

  private async startPersonalityTest(chatId: number) {
    if (!this.personalityTest.isTestAvailable()) {
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Тест временно недоступен.',
          en: 'Test is temporarily unavailable.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }
    const out = this.personalityTest.startTest(chatId);
    if (!out) {
      await this.sendMessage(
        chatId,
        this.t(chatId, { ru: 'Не удалось начать тест. Попробуй ещё раз.', en: 'Could not start test. Try again.' }),
        this.getKeyboard(chatId),
      );
      return;
    }
    this.launchedChats.add(chatId);
    this.supportModeChats.delete(chatId);
    this.cabinetModeChats.delete(chatId);
    const testKbd = this.getTestKeyboard();

    // Сначала всегда отправляем приветствие текстом — чтобы пользователь гарантированно его увидел
    await this.sendMessage(chatId, out.intro, testKbd);

    // Картинка приветствия — ищем по разным путям (как на сервере, так локально)
    try {
      const cwd = process.cwd();
      const candidates = [
        path.join(__dirname, 'welcome.jpg'),
        path.join(__dirname, '..', '..', 'telegram-bot', 'welcome.jpg'),
        path.join(cwd, 'dist', 'src', 'telegram-bot', 'welcome.jpg'),
        path.join(cwd, 'dist', 'telegram-bot', 'welcome.jpg'),
        path.join(cwd, 'src', 'telegram-bot', 'welcome.jpg'),
        path.join(cwd, 'back', 'src', 'telegram-bot', 'welcome.jpg'),
      ];
      for (const welcomePath of candidates) {
        if (fs.existsSync(welcomePath)) {
          const buf = fs.readFileSync(welcomePath);
          if (buf.length > 0) {
            await this.sendPhoto(chatId, buf, 'Seee 💫', testKbd);
            break;
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`Welcome photo failed for ${chatId}: ${e?.message}`);
    }
  }

  private getTestKeyboard() {
    return {
      keyboard: [[{ text: this.returnToMenuButton }]],
      resize_keyboard: true,
    };
  }

  private async handleTestAnswer(chatId: number, text: string) {
    const result = this.personalityTest.handleAnswer(chatId, text);
    if (result.error) {
      await this.sendMessage(chatId, result.error, this.getTestKeyboard());
      return;
    }
    if (result.done && result.answers) {
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Секунду, формирую твои результаты…',
          en: 'One moment, preparing your results…',
        }),
        { remove_keyboard: true },
      );
      const level = this.personalityTest.computeLevel(result.answers);
      const twelvePoints = await this.personalityTest.generate12Points(result.answers);
      const levelMessage = this.personalityTest.getLevelMessage(level, twelvePoints);
      await this.sendMessage(chatId, levelMessage, { remove_keyboard: true });
      await this.sendMessage(
        chatId,
        this.personalityTest.getSalesMessage(),
        { remove_keyboard: true },
      );
      try {
        const imageBuffer = await this.levelImage.createLevelImageBuffer(level);
        await this.sendPhoto(chatId, imageBuffer);
      } catch (e: any) {
        this.logger.warn(`Level image send failed: ${e?.message}`);
      }
      const hasLinked = await this.prisma.user
        .findUnique({ where: { telegramId: String(chatId) }, select: { id: true } })
        .then((u) => !!u);
      await this.sendMessage(
        chatId,
        this.personalityTest.getCardsMessage(hasLinked),
        this.getKeyboard(chatId),
      );
      return;
    }
    if (result.nextQuestion) {
      await this.sendMessage(chatId, result.nextQuestion, this.getTestKeyboard());
    }
  }

  private async handleGroupMessage(message: TelegramMessage) {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    if (!text) return;

    if (text === this.bindSupportCommand) {
      this.supportChatIdRuntime = chatId;
      await this.sendRawMessage(
        chatId,
        `✅ Группа поддержки привязана.\nТеперь сообщения из режима "Обратиться в поддержку" будут приходить сюда.\nchat_id: ${chatId}`,
      );
    }
  }

  private async startPasswordReset(chatId: number) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: String(chatId) },
      select: { id: true },
    });

    if (!user) {
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Этот Telegram не привязан к аккаунту Seee. Сначала привяжите Telegram в личном кабинете, затем попробуйте снова.',
          en: 'This Telegram is not linked to a Seee account. Link Telegram in profile first, then try again.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    this.passwordResetModeChats.add(chatId);
    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Введите новый пароль (минимум 6 символов). Для отмены отправьте: отмена',
        en: 'Enter your new password (at least 6 characters). To cancel, send: cancel',
      }),
      this.getKeyboard(chatId),
    );
  }

  private async handlePasswordResetMessage(chatId: number, text: string) {
    const isCancel =
      text.toLowerCase() === 'отмена' || text.toLowerCase() === 'cancel';
    if (isCancel) {
      this.passwordResetModeChats.delete(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Восстановление пароля отменено.',
          en: 'Password reset canceled.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    if (text.length < 6) {
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Пароль слишком короткий. Введите минимум 6 символов.',
          en: 'Password is too short. Enter at least 6 characters.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramId: String(chatId) },
      select: { id: true },
    });

    if (!user) {
      this.passwordResetModeChats.delete(chatId);
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Не найден привязанный аккаунт. Привяжите Telegram в профиле и попробуйте снова.',
          en: 'Linked account not found. Link Telegram in profile and try again.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    const passwordHash = await bcrypt.hash(text, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.passwordResetModeChats.delete(chatId);
    await this.sendMessage(
      chatId,
      this.t(chatId, {
        ru: 'Пароль успешно обновлён. Теперь вы можете войти с новым паролем.',
        en: 'Password updated successfully. You can now log in with the new password.',
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

    if (!this.supportChatIdRuntime) {
      this.logger.warn(
        `Support message received but TELEGRAM_SUPPORT_CHAT_ID is missing. ${userLine}. Message: ${text}`,
      );
      await this.sendMessage(
        chatId,
        this.t(chatId, {
          ru: 'Сообщение получено, но поддержка не привязана. Добавьте бота в вашу группу и отправьте там команду /set_support_group.',
          en: 'Message received, but support group is not linked. Add bot to your group and send /set_support_group there.',
        }),
        this.getKeyboard(chatId),
      );
      return;
    }

    await this.sendRawMessage(
      this.supportChatIdRuntime,
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
          [{ text: this.cabinetButton }],
        ],
        resize_keyboard: true,
      };
    }

    if (!this.launchedChats.has(chatId)) {
      return {
        keyboard: [
          [{ text: this.launchButton }],
          [{ text: this.testButton }],
          [{ text: this.cabinetButton }],
        ],
        resize_keyboard: true,
      };
    }

    if (this.cabinetModeChats.has(chatId)) {
      return {
        keyboard: [
          [{ text: this.cabinetLangButton }],
          [{ text: this.cabinetChangePasswordButton }],
          [{ text: this.langRuButton }, { text: this.langEnButton }],
          [{ text: this.cabinetBackButton }],
        ],
        resize_keyboard: true,
      };
    }

    return {
      keyboard: [
        [{ text: this.supportButton }],
        [{ text: this.testButton }],
        [{ text: this.cabinetButton }],
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

  private async sendPhoto(
    chatId: number,
    photoBuffer: Buffer,
    caption?: string,
    replyMarkup?: any,
  ) {
    try {
      const form = new FormData();
      form.append('chat_id', String(chatId));
      const isPng = photoBuffer[0] === 0x89 && photoBuffer[1] === 0x50;
      form.append('photo', photoBuffer, {
        filename: isPng ? 'image.png' : 'image.jpg',
        contentType: isPng ? 'image/png' : 'image/jpeg',
      });
      if (caption) form.append('caption', caption);
      if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendPhoto`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 15000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send telegram photo to ${chatId}: ${error?.response?.data?.description || error?.message || error}`,
      );
    }
  }
}

