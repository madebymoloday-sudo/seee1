import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PipelineService } from './pipeline/pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NeuroHintService } from './neuro-hint.service';
import { AudioTranscriptionService } from './audio-transcription.service';
import {
  NeuroHintRequestDto,
  NeuroHintResponseDto,
} from './dto/neuro-hint.dto';
import {
  AudioTranscriptionResponseDto,
  AudioTranscriptionUploadDto,
} from './dto/audio-transcription.dto';

@ApiTags('Psychologist')
@Controller('psychologist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PsychologistController {
  constructor(
    private readonly pipelineService: PipelineService,
    private readonly neuroHintService: NeuroHintService,
    private readonly audioTranscriptionService: AudioTranscriptionService,
  ) {}

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

  @Post('neuro-hint')
  @ApiOperation({
    summary:
      'Получить подсказку для формулировки мысли (по ситуации и эмоции)',
  })
  @ApiResponse({
    status: 200,
    description: 'Подсказка с наводящими вопросами',
    type: NeuroHintResponseDto,
  })
  async neuroHint(
    @Body() dto: NeuroHintRequestDto,
  ): Promise<NeuroHintResponseDto> {
    const message = await this.neuroHintService.generateThoughtHint(dto);
    return { message };
  }

  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AudioTranscriptionUploadDto })
  @ApiOperation({
    summary: 'Транскрибировать голосовой ввод пользователя через OpenAI',
  })
  @ApiResponse({
    status: 200,
    description: 'Аудио успешно распознано',
    type: AudioTranscriptionResponseDto,
  })
  async transcribeAudio(
    @UploadedFile()
    file?: {
      buffer?: Buffer;
      originalname?: string;
      mimetype?: string;
      size?: number;
    },
  ): Promise<AudioTranscriptionResponseDto> {
    return this.audioTranscriptionService.transcribeAudio(file);
  }
}
