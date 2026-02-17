import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}

