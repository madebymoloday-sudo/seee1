import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, SessionResponseDto } from './dto/session.dto';
import { PipelineStep } from '../psychologist/pipeline/pipeline.types';
import type { PipelineState } from '../psychologist/pipeline/pipeline.types';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createSessionDto: CreateSessionDto,
    checkSubscription: boolean = true,
  ): Promise<SessionResponseDto> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        title: createSessionDto.title || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // Если указана программа - создаем начальное состояние пайплайна с этой программой
    if (createSessionDto.programName) {
      const initialState: PipelineState = {
        sessionId: session.id,
        programName: createSessionDto.programName,
        currentStep: PipelineStep.PROBLEM,
        completed: false,
      };

      await this.prisma.pipelineState.create({
        data: {
          sessionId: session.id,
          stateJson: initialState as any,
        },
      });
    }

    return this.toResponseDto(session);
  }

  async findAllByUserId(userId: string): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return sessions.map((s) => this.toResponseDto(s));
  }

  async findOne(id: string, userId: string): Promise<SessionResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    return this.toResponseDto(session);
  }

  async generateDocument(
    sessionId: string,
    userId: string,
  ): Promise<{ document: string }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        conceptHierarchies: true,
        user: {
          select: { username: true },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Доступ запрещен');
    }

    if (
      !session.conceptHierarchies ||
      session.conceptHierarchies.length === 0
    ) {
      throw new NotFoundException(
        'Нет данных концепций для генерации документа',
      );
    }

    const conceptData =
      typeof session.conceptHierarchies[0].conceptData === 'string'
        ? JSON.parse(session.conceptHierarchies[0].conceptData)
        : session.conceptHierarchies[0].conceptData;
    const username = session.user.username || 'Пользователь';

    const document = this.generateMarkdownDocument(conceptData, username);
    return { document };
  }

  async addSessionToMap(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
        conceptHierarchies: true,
      },
    });

    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Доступ запрещен');
    }

    // TODO: Интеграция с PsychologistService и EventMapService
    // Пока возвращаем пустой массив
    return [];
  }

  async getPipelineState(
    sessionId: string,
    userId: string,
  ): Promise<{ programName?: string }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    const pipelineState = await this.prisma.pipelineState.findUnique({
      where: { sessionId },
    });

    if (!pipelineState) {
      return {};
    }

    const state = pipelineState.stateJson as any;
    return {
      programName: state?.programName,
    };
  }

  async updateProgram(
    sessionId: string,
    userId: string,
    pipelineId: string,
  ): Promise<SessionResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    // Получаем пайплайн из базы
    const pipeline = await this.prisma.pipelineProgram.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      throw new NotFoundException('Пайплайн не найден');
    }

    // Проверяем доступ: пайплайн должен принадлежать пользователю или быть дефолтным
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isAdmin = user?.role === 'admin';
    const hasAccess = pipeline.userId === userId || pipeline.isDefault || isAdmin;

    if (!hasAccess) {
      throw new ForbiddenException('Нет доступа к этому пайплайну');
    }

    // Получаем имя программы из конфига (используем name как programName)
    const programName = pipeline.name;

    // Обновляем или создаем pipelineState с новой программой
    const existingState = await this.prisma.pipelineState.findUnique({
      where: { sessionId },
    });

    if (existingState) {
      const currentState = existingState.stateJson as any;
      const updatedState: PipelineState = {
        ...currentState,
        programName,
        // Если пайплайн еще не начат, сбрасываем на первый шаг
        currentStep: currentState.completed
          ? currentState.currentStep
          : PipelineStep.PROBLEM,
      };

      await this.prisma.pipelineState.update({
        where: { sessionId },
        data: {
          stateJson: updatedState as any,
        },
      });
    } else {
      // Создаем новое состояние
      const initialState: PipelineState = {
        sessionId,
        programName,
        currentStep: PipelineStep.PROBLEM,
        completed: false,
      };

      await this.prisma.pipelineState.create({
        data: {
          sessionId,
          stateJson: initialState as any,
        },
      });
    }

    return this.findOne(sessionId, userId);
  }

  private generateMarkdownDocument(
    conceptData: Record<string, any>,
    username: string,
  ): string {
    let document = `# Карта концепций - ${username}\n\n`;
    document += `*Сгенерировано: ${new Date().toLocaleString('ru-RU')}*\n\n`;

    for (const [conceptName, conceptInfo] of Object.entries(conceptData)) {
      document += `## ${conceptName}\n\n`;

      if (conceptInfo.composition) {
        document += `### Состав:\n`;
        conceptInfo.composition.forEach((item: string) => {
          document += `- ${item}\n`;
        });
        document += `\n`;
      }

      if (conceptInfo.founder) {
        document += `### Основатель: ${conceptInfo.founder}\n\n`;
      }

      if (conceptInfo.purpose) {
        document += `### Цель: ${conceptInfo.purpose}\n\n`;
      }

      if (conceptInfo.consequences) {
        document += `### Последствия:\n`;
        if (conceptInfo.consequences.emotional) {
          document += `**Эмоциональные:**\n`;
          conceptInfo.consequences.emotional.forEach((emotion: string) => {
            document += `- ${emotion}\n`;
          });
        }
        if (conceptInfo.consequences.physical) {
          document += `**Физические:**\n`;
          conceptInfo.consequences.physical.forEach((physical: string) => {
            document += `- ${physical}\n`;
          });
        }
        document += `\n`;
      }

      if (conceptInfo.conclusions) {
        document += `### Выводы:\n${conceptInfo.conclusions}\n\n`;
      }

      document += `---\n\n`;
    }

    return document;
  }

  private toResponseDto(session: any): SessionResponseDto {
    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      messageCount: session._count?.messages || 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

