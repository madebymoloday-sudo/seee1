import { Module } from '@nestjs/common';
import { PsychologistService } from './psychologist.service';
import { PsychologistController } from './psychologist.controller';
import { PipelineService } from './pipeline/pipeline.service';
import { ProgramLoaderService } from './pipeline/program-loader.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { NeuroHintService } from './neuro-hint.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PsychologistController],
  providers: [PsychologistService, PipelineService, ProgramLoaderService, NeuroHintService],
  exports: [PsychologistService, PipelineService, ProgramLoaderService, NeuroHintService],
})
export class PsychologistModule {}

