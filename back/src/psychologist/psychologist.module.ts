import { Module } from '@nestjs/common';
import { PsychologistService } from './psychologist.service';
import { PsychologistController } from './psychologist.controller';
import { PipelineService } from './pipeline/pipeline.service';
import { ProgramLoaderService } from './pipeline/program-loader.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PsychologistController],
  providers: [PsychologistService, PipelineService, ProgramLoaderService],
  exports: [PsychologistService, PipelineService, ProgramLoaderService],
})
export class PsychologistModule {}

