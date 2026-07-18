import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EventMap } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEventMapDto,
  EventMapResponseDto,
  UpdateEventMapDto,
} from './dto/event-map.dto';

@Injectable()
export class EventMapService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createEventMapDto: CreateEventMapDto,
  ): Promise<EventMapResponseDto> {
    const nodeType = this.normalizeNodeType(createEventMapDto.nodeType);
    const placement = await this.resolvePlacement(
      userId,
      nodeType,
      createEventMapDto.parentId || null,
      createEventMapDto.level,
    );
    await this.assertSessionOwnership(
      userId,
      createEventMapDto.sourceSessionId,
    );

    const title =
      createEventMapDto.title?.trim() ||
      createEventMapDto.idea?.trim() ||
      createEventMapDto.emotion?.trim() ||
      createEventMapDto.event?.trim() ||
      null;

    const duplicate = await this.findDuplicateSibling({
      userId,
      nodeType,
      parentId: placement.parentId,
      title,
    });
    if (duplicate) {
      const updatedDuplicate = await this.prisma.eventMap.update({
        where: { id: duplicate.id },
        data: {
          ...(createEventMapDto.description?.trim() && !duplicate.description
            ? { description: createEventMapDto.description.trim() }
            : {}),
          ...(createEventMapDto.sourceSessionId && !duplicate.sourceSessionId
            ? { sourceSessionId: createEventMapDto.sourceSessionId }
            : {}),
          ...(createEventMapDto.sourceThoughtScopeId &&
          !duplicate.sourceThoughtScopeId
            ? {
                sourceThoughtScopeId:
                  createEventMapDto.sourceThoughtScopeId,
              }
            : {}),
        },
      });
      return this.toResponseDto(updatedDuplicate);
    }

    const displayOrder =
      createEventMapDto.displayOrder ??
      (await this.getNextDisplayOrder(userId, placement.parentId));
    const eventMap = await this.prisma.eventMap.create({
      data: {
        userId,
        eventNumber: createEventMapDto.eventNumber ?? null,
        event: createEventMapDto.event?.trim() || null,
        emotion: createEventMapDto.emotion?.trim() || null,
        idea: createEventMapDto.idea?.trim() || null,
        rootBelief: createEventMapDto.rootBelief?.trim() || null,
        nodeType,
        title,
        description: createEventMapDto.description?.trim() || null,
        parentId: placement.parentId,
        level: placement.level,
        displayOrder,
        sourceSessionId: createEventMapDto.sourceSessionId || null,
        sourceThoughtScopeId: createEventMapDto.sourceThoughtScopeId || null,
        isMuted: createEventMapDto.isMuted ?? false,
        metaJson: (createEventMapDto.metaJson as any) ?? null,
      },
    });

    return this.toResponseDto(eventMap);
  }

  async findAllByUserId(userId: string): Promise<EventMapResponseDto[]> {
    const eventMaps = await this.prisma.eventMap.findMany({
      where: { userId },
      orderBy: [
        { eventNumber: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return this.normalizeNodesForRead(eventMaps).map((em) =>
      this.toResponseDto(em),
    );
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateEventMapDto,
  ): Promise<EventMapResponseDto> {
    const existing = await this.prisma.eventMap.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Event map node not found');
    }

    const nodeType =
      dto.nodeType === undefined
        ? this.normalizeNodeType(existing.nodeType)
        : this.normalizeNodeType(dto.nodeType);
    if (nodeType !== this.normalizeNodeType(existing.nodeType)) {
      throw new BadRequestException(
        'Тип существующего узла нейрокарты нельзя изменить',
      );
    }

    const parentId =
      dto.parentId === undefined ? existing.parentId : dto.parentId || null;
    if (parentId === existing.id) {
      throw new BadRequestException('Узел не может быть своим родителем');
    }
    if (parentId) {
      await this.assertParentIsNotDescendant(userId, existing.id, parentId);
    }

    const placement = await this.resolvePlacement(
      userId,
      nodeType,
      parentId,
      dto.level,
    );
    await this.assertSessionOwnership(userId, dto.sourceSessionId);

    const title =
      dto.title === undefined
        ? existing.title
        : dto.title?.trim() || null;
    const duplicate = await this.findDuplicateSibling({
      userId,
      nodeType,
      parentId: placement.parentId,
      title,
      excludeId: existing.id,
    });
    if (duplicate) {
      throw new BadRequestException(
        'Такая карточка уже есть в этой ветке нейрокарты',
      );
    }

    const updated = await this.prisma.eventMap.update({
      where: { id: existing.id },
      data: {
        ...(dto.eventNumber !== undefined ? { eventNumber: dto.eventNumber ?? null } : {}),
        ...(dto.event !== undefined ? { event: dto.event?.trim() || null } : {}),
        ...(dto.emotion !== undefined ? { emotion: dto.emotion?.trim() || null } : {}),
        ...(dto.idea !== undefined ? { idea: dto.idea?.trim() || null } : {}),
        ...(dto.rootBelief !== undefined
          ? { rootBelief: dto.rootBelief?.trim() || null }
          : {}),
        nodeType,
        ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        parentId: placement.parentId,
        level: placement.level,
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder ?? 0 } : {}),
        ...(dto.sourceSessionId !== undefined
          ? { sourceSessionId: dto.sourceSessionId || null }
          : {}),
        ...(dto.sourceThoughtScopeId !== undefined
          ? { sourceThoughtScopeId: dto.sourceThoughtScopeId || null }
          : {}),
        ...(dto.isMuted !== undefined ? { isMuted: dto.isMuted } : {}),
        ...(dto.metaJson !== undefined ? { metaJson: (dto.metaJson as any) ?? null } : {}),
      },
    });

    const levelDelta = placement.level - existing.level;
    if (levelDelta !== 0) {
      await this.shiftDescendantLevels(userId, existing.id, levelDelta);
    }

    return this.toResponseDto(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.eventMap.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Event map node not found');
    }

    const allNodes = await this.prisma.eventMap.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const idsToDelete = new Set<string>([id]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const node of allNodes) {
        if (node.parentId && idsToDelete.has(node.parentId) && !idsToDelete.has(node.id)) {
          idsToDelete.add(node.id);
          changed = true;
        }
      }
    }

    await this.prisma.eventMap.deleteMany({
      where: {
        userId,
        id: { in: Array.from(idsToDelete) },
      },
    });
  }

  private normalizeNodesForRead(sourceNodes: EventMap[]): EventMap[] {
    const nodes = [...sourceNodes].sort(
      (left, right) =>
        left.level - right.level ||
        left.createdAt.getTime() - right.createdAt.getTime(),
    );
    const aliases = new Map<string, string>();
    const canonicalByKey = new Map<string, EventMap>();
    const normalizedNodes: EventMap[] = [];

    for (const node of nodes) {
      const nodeType = this.normalizeStoredNodeType(node.nodeType);
      const parentId = node.parentId
        ? aliases.get(node.parentId) || node.parentId
        : null;
      const normalizedNode = { ...node, nodeType, parentId };

      // Root situations may legitimately have the same title. Old duplicate
      // descendants are collapsed only for the response; GET never mutates data.
      if (!parentId || nodeType === 'SITUATION') {
        normalizedNodes.push(normalizedNode);
        continue;
      }

      const normalizedTitle = this.normalizeText(
        node.title || node.idea || node.emotion || node.event,
      );
      if (!normalizedTitle) {
        normalizedNodes.push(normalizedNode);
        continue;
      }

      const key = `${parentId}|${nodeType}|${normalizedTitle}`;
      const canonical = canonicalByKey.get(key);
      if (canonical) {
        aliases.set(node.id, canonical.id);
        continue;
      }

      canonicalByKey.set(key, normalizedNode);
      normalizedNodes.push(normalizedNode);
    }

    return normalizedNodes.map((node) => ({
      ...node,
      parentId: node.parentId
        ? aliases.get(node.parentId) || node.parentId
        : null,
    }));
  }

  private normalizeStoredNodeType(value?: string | null): string {
    const nodeType = String(value || 'LEGACY')
      .trim()
      .toUpperCase();
    return ['SITUATION', 'EMOTION', 'THOUGHT', 'LEGACY'].includes(nodeType)
      ? nodeType
      : 'LEGACY';
  }

  private normalizeNodeType(value?: string | null): string {
    const nodeType = String(value || 'LEGACY')
      .trim()
      .toUpperCase();
    if (!['SITUATION', 'EMOTION', 'THOUGHT', 'LEGACY'].includes(nodeType)) {
      throw new BadRequestException('Неизвестный тип узла нейрокарты');
    }
    return nodeType;
  }

  private async resolvePlacement(
    userId: string,
    nodeType: string,
    parentId: string | null,
    requestedLevel?: number,
  ): Promise<{ parentId: string | null; level: number }> {
    if (nodeType === 'SITUATION') {
      return { parentId: null, level: 1 };
    }

    if (!parentId) {
      if (nodeType === 'LEGACY') {
        return {
          parentId: null,
          level: Math.max(1, requestedLevel ?? 1),
        };
      }
      throw new BadRequestException(
        nodeType === 'EMOTION'
          ? 'Для эмоции необходимо выбрать ситуацию'
          : 'Для мысли необходимо выбрать эмоцию или родительскую мысль',
      );
    }

    const parent = await this.prisma.eventMap.findFirst({
      where: { id: parentId, userId },
      select: { id: true, nodeType: true, level: true },
    });
    if (!parent) {
      throw new NotFoundException('Родительский узел нейрокарты не найден');
    }

    const parentType = this.normalizeNodeType(parent.nodeType);
    const parentIsValid =
      nodeType === 'LEGACY' ||
      (nodeType === 'EMOTION' && parentType === 'SITUATION') ||
      (nodeType === 'THOUGHT' &&
        ['EMOTION', 'THOUGHT'].includes(parentType));
    if (!parentIsValid) {
      throw new BadRequestException(
        'Недопустимая связь между уровнями нейрокарты',
      );
    }

    return {
      parentId: parent.id,
      level: Math.max(1, parent.level + 1),
    };
  }

  private async assertSessionOwnership(
    userId: string,
    sessionId?: string | null,
  ): Promise<void> {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) return;

    const session = await this.prisma.session.findUnique({
      where: { id: normalizedSessionId },
      select: { userId: true },
    });
    if (!session) {
      throw new NotFoundException('Связанная сессия не найдена');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Нет доступа к связанной сессии');
    }
  }

  private async findDuplicateSibling(params: {
    userId: string;
    nodeType: string;
    parentId: string | null;
    title?: string | null;
    excludeId?: string;
  }): Promise<any | null> {
    // Two distinct situations may legitimately have the same short name.
    if (params.nodeType === 'SITUATION' && !params.parentId) return null;

    const normalizedTitle = this.normalizeText(params.title);
    if (!normalizedTitle) return null;

    const siblings = await this.prisma.eventMap.findMany({
      where: {
        userId: params.userId,
        nodeType: params.nodeType,
        parentId: params.parentId,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
    });
    return (
      siblings.find(
        (sibling) =>
          this.normalizeText(
            sibling.title ||
              sibling.idea ||
              sibling.emotion ||
              sibling.event,
          ) === normalizedTitle,
      ) || null
    );
  }

  private async getNextDisplayOrder(
    userId: string,
    parentId: string | null,
  ): Promise<number> {
    const lastSibling = await this.prisma.eventMap.findFirst({
      where: { userId, parentId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    return (lastSibling?.displayOrder ?? -1) + 1;
  }

  private async assertParentIsNotDescendant(
    userId: string,
    nodeId: string,
    parentId: string,
  ): Promise<void> {
    const nodes = await this.prisma.eventMap.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const descendants = new Set<string>([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) {
        if (
          node.parentId &&
          descendants.has(node.parentId) &&
          !descendants.has(node.id)
        ) {
          descendants.add(node.id);
          changed = true;
        }
      }
    }
    if (descendants.has(parentId)) {
      throw new BadRequestException(
        'Нельзя переместить узел внутрь его собственной ветки',
      );
    }
  }

  private async shiftDescendantLevels(
    userId: string,
    nodeId: string,
    delta: number,
  ): Promise<void> {
    const nodes = await this.prisma.eventMap.findMany({
      where: { userId },
      select: { id: true, parentId: true, level: true },
    });
    const descendants = new Set<string>();
    let parentIds = new Set<string>([nodeId]);
    while (parentIds.size > 0) {
      const nextParentIds = new Set<string>();
      for (const node of nodes) {
        if (
          node.parentId &&
          parentIds.has(node.parentId) &&
          !descendants.has(node.id)
        ) {
          descendants.add(node.id);
          nextParentIds.add(node.id);
        }
      }
      parentIds = nextParentIds;
    }

    if (descendants.size === 0) return;
    await this.prisma.$transaction(
      nodes
        .filter((node) => descendants.has(node.id))
        .map((node) =>
          this.prisma.eventMap.update({
            where: { id: node.id },
            data: { level: Math.max(1, node.level + delta) },
          }),
        ),
    );
  }

  private normalizeText(value?: string | null): string {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toResponseDto(eventMap: any): EventMapResponseDto {
    return {
      id: eventMap.id,
      userId: eventMap.userId,
      eventNumber: eventMap.eventNumber ?? null,
      event: eventMap.event ?? null,
      emotion: eventMap.emotion ?? null,
      idea: eventMap.idea ?? null,
      rootBelief: eventMap.rootBelief ?? null,
      isCompleted: eventMap.isCompleted,
      nodeType: eventMap.nodeType,
      title: eventMap.title ?? null,
      description: eventMap.description ?? null,
      parentId: eventMap.parentId ?? null,
      level: eventMap.level ?? 1,
      displayOrder: eventMap.displayOrder ?? 0,
      sourceSessionId: eventMap.sourceSessionId ?? null,
      sourceThoughtScopeId: eventMap.sourceThoughtScopeId ?? null,
      isMuted: eventMap.isMuted ?? false,
      metaJson: (eventMap.metaJson as Record<string, unknown> | null) ?? null,
      createdAt: eventMap.createdAt,
      updatedAt: eventMap.updatedAt,
    };
  }
}
