import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

type BrowserPushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type MegaChatNotificationRecipient = {
  id: string;
  username: string;
  telegramId?: string | null;
  megaChatTelegramNotificationsEnabled?: boolean;
};

type MegaChatNotificationPayload = {
  chatId: string;
  chatTitle: string;
  senderUsername: string;
  messagePreview: string;
  recipients: MegaChatNotificationRecipient[];
  shouldSendBrowserPushToUserIds: string[];
  shouldSendTelegramToUserIds: string[];
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly vapidPublicKey?: string;
  private readonly vapidPrivateKey?: string;
  private readonly vapidSubject: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telegramBotService: TelegramBotService,
  ) {
    this.vapidPublicKey = this.configService.get<string>('WEB_PUSH_VAPID_PUBLIC_KEY') || undefined;
    this.vapidPrivateKey = this.configService.get<string>('WEB_PUSH_VAPID_PRIVATE_KEY') || undefined;
    this.vapidSubject = this.configService.get<string>('WEB_PUSH_VAPID_SUBJECT', 'mailto:support@seee.app');
  }

  getSettings(user: { telegramId?: string | null; megaChatTelegramNotificationsEnabled?: boolean }) {
    return {
      browserPushAvailable: Boolean(this.vapidPublicKey && this.vapidPrivateKey),
      vapidPublicKey: this.vapidPublicKey ?? null,
      telegramLinked: Boolean(user.telegramId),
      telegramNotificationsEnabled: Boolean(user.megaChatTelegramNotificationsEnabled),
    };
  }

  async saveBrowserSubscription(userId: string, subscription: BrowserPushSubscriptionInput) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime:
          typeof subscription.expirationTime === 'number'
            ? new Date(subscription.expirationTime)
            : null,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime:
          typeof subscription.expirationTime === 'number'
            ? new Date(subscription.expirationTime)
            : null,
      },
    });

    return { ok: true };
  }

  async removeBrowserSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });

    return { ok: true };
  }

  async updateTelegramNotificationPreference(userId: string, enabled: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { megaChatTelegramNotificationsEnabled: enabled },
      select: {
        telegramId: true,
        megaChatTelegramNotificationsEnabled: true,
      },
    });

    return {
      ok: true,
      telegramLinked: Boolean(user.telegramId),
      telegramNotificationsEnabled: user.megaChatTelegramNotificationsEnabled,
    };
  }

  async notifyMegaChatMessage(payload: MegaChatNotificationPayload) {
    if (payload.shouldSendBrowserPushToUserIds.length > 0) {
      await this.sendBrowserPushNotifications(payload);
    }

    if (payload.shouldSendTelegramToUserIds.length > 0) {
      await this.sendTelegramNotifications(payload);
    }
  }

  private async sendBrowserPushNotifications(payload: MegaChatNotificationPayload) {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      return;
    }
    const subscriptionCount = await this.prisma.pushSubscription.count({
      where: {
        userId: { in: payload.shouldSendBrowserPushToUserIds },
      },
    });

    if (subscriptionCount > 0) {
      this.logger.warn(
        `Browser push subscriptions are stored, but actual web-push delivery is not enabled in this build. chatId=${payload.chatId}`,
      );
    }
  }

  private async sendTelegramNotifications(payload: MegaChatNotificationPayload) {
    const recipients = payload.recipients.filter((recipient) =>
      payload.shouldSendTelegramToUserIds.includes(recipient.id),
    );

    await Promise.all(
      recipients.map(async (recipient) => {
        if (!recipient.telegramId) {
          return;
        }

        await this.telegramBotService.sendUserNotificationByTelegramId(
          recipient.telegramId,
          `Новое сообщение в мегачате "${payload.chatTitle}"\n${payload.senderUsername}: ${payload.messagePreview}`,
        );
      }),
    );
  }
}
