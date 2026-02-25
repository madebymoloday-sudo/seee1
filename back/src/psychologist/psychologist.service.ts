import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from './pipeline/pipeline.service';
import { PipelineState } from './pipeline/pipeline.types';

@Injectable()
export class PsychologistService {
  private readonly logger = new Logger(PsychologistService.name);

  constructor(
    private prisma: PrismaService,
    private pipelineService: PipelineService,
  ) {}

  async generateResponse(
    sessionId: string,
    userMessage: string,
    programName?: string,
  ): Promise<string> {
    const startTime = Date.now();

    // Получаем текущее состояние пайплайна из БД
    const pipelineStateRecord = await this.prisma.pipelineState.findUnique({
      where: { sessionId },
    });

    let currentState: PipelineState | undefined;
    if (pipelineStateRecord) {
      currentState = pipelineStateRecord.stateJson as unknown as PipelineState;
    }

    // Если programName не указан, используем из состояния или 'default'
    const targetProgramName =
      programName || currentState?.programName || 'default';

    this.logger.log(
      `🤖 Генерация ответа для сессии ${sessionId} (программа: ${targetProgramName})`,
    );

    // Обрабатываем сообщение через пайплайн
    const result = await this.pipelineService.processMessage(
      sessionId,
      userMessage,
      currentState,
      targetProgramName,
    );

    const processingTime = Date.now() - startTime;

    // Сохраняем состояние пайплайна в БД
    await this.savePipelineState(sessionId, result.state);

    // Сохраняем ответ AI в БД
    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: result.message,
      },
    });

    // Если пайплайн завершен - сохраняем концепции
    if (result.state.completed) {
      await this.saveConcepts(sessionId, result.state);
      this.logger.log(
        `✨ Пайплайн завершен для сессии ${sessionId}. Концепции сохранены.`,
      );
    }

    this.logger.log(
      `✅ Ответ успешно сгенерирован для сессии ${sessionId} (${processingTime}ms, шаг: ${result.state.currentStep})`,
    );

    return result.message;
  }

  private async savePipelineState(
    sessionId: string,
    state: PipelineState,
  ): Promise<void> {
    await this.prisma.pipelineState.upsert({
      where: { sessionId },
      create: {
        sessionId,
        stateJson: state as any,
      },
      update: {
        stateJson: state as any,
      },
    });
  }

  private async saveConcepts(
    sessionId: string,
    state: PipelineState,
  ): Promise<void> {
    // Сохраняем концепции в concept_hierarchies после завершения пайплайна
    const conceptData = {
      problem: state.problem,
      emotion: state.emotion,
      thought: state.thought,
      whyAnswer: state.whyAnswer,
      botIdeas: state.botIdeas,
      founder: state.founder,
      purposeOptions: state.purposeOptions,
      consequences: state.consequences,
      conclusion: state.conclusion,
    };

    // Проверяем, не создана ли уже запись
    const existing = await this.prisma.conceptHierarchy.findFirst({
      where: { sessionId },
    });

    if (!existing) {
      await this.prisma.conceptHierarchy.create({
        data: {
          sessionId,
          conceptData: conceptData as any,
        },
      });
      this.logger.log(`Concepts saved for session ${sessionId}`);
    }
  }
}

