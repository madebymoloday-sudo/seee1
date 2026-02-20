import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { PersonalityTestService } from './personality-test.service';
import { LevelImageService } from './level-image.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TelegramBotService, PersonalityTestService, LevelImageService],
})
export class TelegramBotModule {}

