import { Module } from '@nestjs/common';
import { ChatWebSocketGateway } from './websocket.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { PsychologistModule } from '../psychologist/psychologist.module';

@Module({
  imports: [PrismaModule, PsychologistModule],
  providers: [ChatWebSocketGateway],
  exports: [ChatWebSocketGateway],
})
export class WebSocketModule {}

