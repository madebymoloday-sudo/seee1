import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LavaService } from './lava.service';

@Module({
  imports: [ConfigModule],
  providers: [LavaService],
  exports: [LavaService],
})
export class LavaModule {}

