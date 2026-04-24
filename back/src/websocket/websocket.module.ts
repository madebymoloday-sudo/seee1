import { Module } from '@nestjs/common';
import { ChatWebSocketGateway } from './websocket.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { PsychologistModule } from '../psychologist/psychologist.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    PsychologistModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ChatWebSocketGateway],
  exports: [ChatWebSocketGateway],
})
export class WebSocketModule {}
