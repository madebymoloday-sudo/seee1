import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { MessagesModule } from './messages/messages.module';
import { WebSocketModule } from './websocket/websocket.module';
import { PsychologistModule } from './psychologist/psychologist.module';
import { EventMapModule } from './event-map/event-map.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PipelineModule } from './pipeline/pipeline.module';

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
    SubscriptionModule,
    PipelineModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

