import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PipelineService } from './pipeline/pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Psychologist')
@Controller('psychologist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PsychologistController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('programs')
  @ApiOperation({ summary: 'Получить список доступных программ психолога' })
  @ApiResponse({
    status: 200,
    description: 'Список программ',
  })
  async listPrograms() {
    return this.pipelineService.listAvailablePrograms();
  }

  @Get('programs/:programName')
  @ApiOperation({ summary: 'Получить программу по имени' })
  @ApiResponse({
    status: 200,
    description: 'Программа найдена',
  })
  async getProgram(@Param('programName') programName: string) {
    const program = this.pipelineService.getProgram(programName);
    if (!program) {
      return { error: `Program '${programName}' not found` };
    }
    return program;
  }
}

