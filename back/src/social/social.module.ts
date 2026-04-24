import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WebSocketModule, NotificationsModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
