import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { MessagesModule } from './messages/messages.module';
import { WebSocketModule } from './websocket/websocket.module';
import { PsychologistModule } from './psychologist/psychologist.module';
import { EventMapModule } from './event-map/event-map.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { FeedbackModule } from './feedback/feedback.module';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';
import { SocialModule } from './social/social.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    SessionsModule,
    MessagesModule,
    WebSocketModule,
    PsychologistModule,
    EventMapModule,
    PipelineModule,
    FeedbackModule,
    TelegramBotModule,
    NotificationsModule,
    SocialModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
