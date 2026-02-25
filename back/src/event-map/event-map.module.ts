import { Module } from '@nestjs/common';
import { EventMapController } from './event-map.controller';
import { EventMapService } from './event-map.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EventMapController],
  providers: [EventMapService],
  exports: [EventMapService],
})
export class EventMapModule {}

