import { Injectable, NotFoundException } from '@nestjs/common';
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
    const eventMap = await this.prisma.eventMap.create({
      data: {
        userId,
        eventNumber: createEventMapDto.eventNumber ?? null,
        event: createEventMapDto.event?.trim() || null,
        emotion: createEventMapDto.emotion?.trim() || null,
        idea: createEventMapDto.idea?.trim() || null,
        rootBelief: createEventMapDto.rootBelief?.trim() || null,
        nodeType: (createEventMapDto.nodeType || 'LEGACY').trim(),
        title:
          createEventMapDto.title?.trim() ||
          createEventMapDto.idea?.trim() ||
          createEventMapDto.emotion?.trim() ||
          createEventMapDto.event?.trim() ||
          null,
        description: createEventMapDto.description?.trim() || null,
        parentId: createEventMapDto.parentId || null,
        level: createEventMapDto.level ?? 1,
        displayOrder: createEventMapDto.displayOrder ?? 0,
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

    return eventMaps.map((em) => this.toResponseDto(em));
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateEventMapDto,
  ): Promise<EventMapResponseDto> {
    const existing = await this.prisma.eventMap.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Event map node not found');
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
        ...(dto.nodeType !== undefined ? { nodeType: dto.nodeType.trim() || 'LEGACY' } : {}),
        ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        ...(dto.level !== undefined ? { level: dto.level ?? 1 } : {}),
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

    return this.toResponseDto(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
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
