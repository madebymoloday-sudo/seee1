import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

@Module({
  imports: [PrismaModule, TelegramBotModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
