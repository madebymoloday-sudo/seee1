import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, SessionResponseDto } from './dto/session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PipelineStep } from '../psychologist/pipeline/pipeline.types';
import type { PipelineState } from '../psychologist/pipeline/pipeline.types';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    await this.assertCanCreateSession(userId);

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
    return this.toResponseDto(session, 0);
  }

  private async assertCanCreateSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        accountType: true,
        subscriptionActive: true,
        subscriptionEndsAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (user.accountType === AccountType.TEAM_MEMBER) {
      return;
    }

    if (String(user.email || '').trim().toLowerCase() === 'gulopavel@gmail.com') {
      return;
    }

    const hasActiveSubscription =
      user.subscriptionActive &&
      (!user.subscriptionEndsAt || user.subscriptionEndsAt.getTime() > Date.now());

    if (!hasActiveSubscription) {
      throw new BadRequestException(
        'У вас закончились seee-токены, нужно пополнить баланс 💛',
      );
    }
  }

  async findAllByUserId(userId: string): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return this.toResponseDtos(userId, sessions);
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

    const [result] = await this.toResponseDtos(userId, [session]);
    return result;
  }

  async update(
    sessionId: string,
    userId: string,
    dto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!existing) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    const nextTitle =
      dto.title === undefined ? undefined : dto.title.trim() || null;
    const nextSessionKind =
      dto.sessionKind === undefined ? undefined : dto.sessionKind?.trim() || null;
    const nextNotes =
      dto.notes === undefined ? undefined : dto.notes?.trim() || null;

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
        ...(dto.dialogStateJson !== undefined
          ? { dialogStateJson: dto.dialogStateJson as any }
          : {}),
        ...(nextSessionKind !== undefined ? { sessionKind: nextSessionKind } : {}),
        ...(nextNotes !== undefined ? { notes: nextNotes } : {}),
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    if (dto.dialogStateJson !== undefined) {
      await this.addSessionToMap(sessionId, userId);
    }

    const [result] = await this.toResponseDtos(userId, [updated]);
    return result;
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

    const state = this.asRecord(session.dialogStateJson);
    if (!state) {
      return [];
    }

    let ownerNodes = await this.prisma.eventMap.findMany({
      where: {
        userId,
        nodeType: 'THOUGHT',
        sourceSessionId: session.id,
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
    });

    if (ownerNodes.length === 0) {
      const sessionTitle = session.title?.trim();
      if (sessionTitle) {
        const ownerNode = await this.prisma.eventMap.findFirst({
          where: {
            userId,
            nodeType: 'THOUGHT',
            OR: [
              { title: { equals: sessionTitle, mode: 'insensitive' } },
              { idea: { equals: sessionTitle, mode: 'insensitive' } },
            ],
          },
          orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
        });

        if (ownerNode) {
          const updatedOwnerNode = await this.prisma.eventMap.update({
            where: { id: ownerNode.id },
            data: { sourceSessionId: session.id },
          });
          ownerNodes = [updatedOwnerNode];
        }
      }
    }

    if (ownerNodes.length === 0) {
      return [];
    }

    const createdOrUpdated: any[] = [];
    for (const ownerNode of ownerNodes) {
      const reasonEntries = this.getReasonEntriesForNode(state, ownerNode);
      for (const entry of reasonEntries) {
        const title = entry.reason.trim();
        if (!title) continue;

        const existing = await this.prisma.eventMap.findFirst({
          where: {
            userId,
            parentId: ownerNode.id,
            nodeType: 'THOUGHT',
            title: {
              equals: title,
              mode: 'insensitive',
            },
          },
        });

        if (existing) {
          let sourceSessionId = existing.sourceSessionId;
          if (entry.linkedScopeId) {
            sourceSessionId = session.id;
          } else if (!sourceSessionId || sourceSessionId === session.id) {
            const childSession = await this.prisma.session.create({
              data: {
                userId,
                title,
                sessionKind: 'thought',
              },
            });
            sourceSessionId = childSession.id;
          }

          const updated = await this.prisma.eventMap.update({
            where: { id: existing.id },
            data: {
              sourceSessionId,
              sourceThoughtScopeId: entry.linkedScopeId,
              level: ownerNode.level + 1,
              displayOrder: entry.displayOrder,
            },
          });
          createdOrUpdated.push(updated);
          continue;
        }

        const childSession = entry.linkedScopeId
          ? session
          : await this.prisma.session.create({
              data: {
                userId,
                title,
                sessionKind: 'thought',
              },
            });

        const created = await this.prisma.eventMap.create({
          data: {
            userId,
            nodeType: 'THOUGHT',
            title,
            idea: title,
            parentId: ownerNode.id,
            level: ownerNode.level + 1,
            displayOrder: entry.displayOrder,
            sourceSessionId: childSession.id,
            sourceThoughtScopeId: entry.linkedScopeId,
            isMuted: false,
          },
        });
        createdOrUpdated.push(created);
      }
    }

    return createdOrUpdated.map((node) => ({
      id: node.id,
      userId: node.userId,
      eventNumber: node.eventNumber ?? null,
      event: node.event ?? null,
      emotion: node.emotion ?? null,
      idea: node.idea ?? null,
      rootBelief: node.rootBelief ?? null,
      isCompleted: node.isCompleted,
      nodeType: node.nodeType,
      title: node.title ?? null,
      description: node.description ?? null,
      parentId: node.parentId ?? null,
      level: node.level ?? 1,
      displayOrder: node.displayOrder ?? 0,
      sourceSessionId: node.sourceSessionId ?? null,
      sourceThoughtScopeId: node.sourceThoughtScopeId ?? null,
      isMuted: node.isMuted ?? false,
      metaJson: node.metaJson ?? null,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }));
  }

  private asRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, any>;
  }

  private normalizeMapText(value?: string | null): string {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private titleForEventMapNode(node: {
    title?: string | null;
    idea?: string | null;
    emotion?: string | null;
    event?: string | null;
  }): string {
    return (
      node.title?.trim() ||
      node.idea?.trim() ||
      node.emotion?.trim() ||
      node.event?.trim() ||
      ''
    );
  }

  private parseImportantOptions(textRaw: unknown): string[] {
    const text = String(textRaw || '').trim();
    if (!text) return [];

    const lines = text
      .split(/\n+/)
      .map((line) =>
        line
          .replace(/^\s*[-•*]\s+/, '')
          .replace(/^\s*\d+[.)]\s+/, '')
          .trim(),
      )
      .filter(Boolean);

    if (lines.length > 1) {
      return Array.from(new Set(lines));
    }

    const parts = text
      .split(/(?:;|,|\s+и\s+|\s+а еще\s+)/i)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3);

    return parts.length > 1 ? Array.from(new Set(parts)) : [text];
  }

  private getThoughtScopeIds(state: Record<string, any>): string[] {
    const scopes = this.asRecord(state.thoughtScopes);
    return scopes ? Object.keys(scopes) : [];
  }

  private getThoughtAnswer(
    state: Record<string, any>,
    key: string,
    scopeId?: string | null,
  ): string {
    if (key.startsWith('core:thought:')) {
      const scopes = this.asRecord(state.thoughtScopes);
      const resolvedScopeId =
        scopeId || state.activeThoughtScopeId || this.getThoughtScopeIds(state)[0];
      if (!scopes || !resolvedScopeId) return '';
      return String(this.asRecord(scopes[resolvedScopeId])?.[key] || '');
    }

    return String(this.asRecord(state.answers)?.[key] || '');
  }

  private getCandidateThoughtScopeIds(state: Record<string, any>, node: any): string[] {
    if (node.sourceThoughtScopeId) {
      return [node.sourceThoughtScopeId];
    }

    const nodeTitle = this.normalizeMapText(this.titleForEventMapNode(node));
    const scopes = this.asRecord(state.thoughtScopes) || {};
    const matchingScopeIds: string[] = [];
    for (const scopeId of Object.keys(scopes)) {
      const scopeTitle = this.normalizeMapText(
        this.asRecord(scopes[scopeId])?.['core:thought:3'],
      );
      if (scopeTitle && scopeTitle === nodeTitle) matchingScopeIds.push(scopeId);
    }
    if (matchingScopeIds.length > 0) return matchingScopeIds;

    if (state.activeThoughtScopeId) return [String(state.activeThoughtScopeId)];

    const firstScopeId = Object.keys(scopes)[0];
    return firstScopeId ? [firstScopeId] : [];
  }

  private getLinkedScopeIdsForReason(
    state: Record<string, any>,
    ownerScopeId: string | undefined,
    reason: string,
  ): string[] {
    const normalizedOwnerScopeId = ownerScopeId || '';
    const links = this.asRecord(state.thoughtScopeLinks) || {};
    return Object.entries(links)
      .filter(([, rawLink]) => {
        const link = this.asRecord(rawLink);
        return (
          link?.parentSubject === 'thought' &&
          String(link.parentScopeId || '') === normalizedOwnerScopeId &&
          this.normalizeMapText(link.parentReason) === this.normalizeMapText(reason)
        );
      })
      .map(([scopeId]) => scopeId);
  }

  private getReasonEntriesForNode(
    state: Record<string, any>,
    node: any,
  ): Array<{ reason: string; linkedScopeId: string | null; displayOrder: number }> {
    const entries: Array<{ reason: string; linkedScopeId: string | null; displayOrder: number }> = [];
    const seen = new Set<string>();
    const ownerScopeIds = this.getCandidateThoughtScopeIds(state, node);

    for (const ownerScopeId of ownerScopeIds) {
      const reasons = this.parseImportantOptions(
        this.getThoughtAnswer(state, 'core:thought:4', ownerScopeId),
      );
      for (const reason of reasons) {
        const normalized = this.normalizeMapText(reason);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        entries.push({
          reason,
          linkedScopeId:
            this.getLinkedScopeIdsForReason(state, ownerScopeId, reason)[0] || null,
          displayOrder: entries.length,
        });
      }
    }

    if (entries.length === 0) {
      const fallbackReasons = this.parseImportantOptions(
        state.importantText || this.asRecord(state.answers)?.['core:thought:4'],
      );
      for (const reason of fallbackReasons) {
        const normalized = this.normalizeMapText(reason);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        entries.push({
          reason,
          linkedScopeId: null,
          displayOrder: entries.length,
        });
      }
    }

    return entries;
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

  async delete(sessionId: string, userId: string): Promise<void> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });
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

  private async toResponseDtos(
    userId: string,
    sessions: any[],
  ): Promise<SessionResponseDto[]> {
    const sessionIds = sessions
      .map((session) => String(session?.id || "").trim())
      .filter(Boolean);

    const rewards =
      sessionIds.length > 0
        ? await this.prisma.gamificationReward.groupBy({
            by: ['sessionId'],
            where: {
              userId,
              sessionId: {
                in: sessionIds,
              },
            },
            _sum: {
              amount: true,
            },
          })
        : [];

    const coinsBySessionId = new Map<string, number>();
    for (const reward of rewards) {
      const sessionId = String(reward.sessionId || '').trim();
      if (!sessionId) continue;
      coinsBySessionId.set(
        sessionId,
        Math.max(0, Math.floor(Number(reward._sum.amount ?? 0))),
      );
    }

    return sessions.map((session) =>
      this.toResponseDto(session, coinsBySessionId.get(session.id) ?? 0),
    );
  }

  private toResponseDto(session: any, coinsEarned = 0): SessionResponseDto {
    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      messageCount: session._count?.messages || 0,
      coinsEarned: Math.max(0, Math.floor(Number(coinsEarned || 0))),
      dialogStateJson: session.dialogStateJson ?? null,
      sessionKind: session.sessionKind ?? null,
      notes: session.notes ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
