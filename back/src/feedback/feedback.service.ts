import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackStatus, FeedbackType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto, FeedbackItemDto, UpdateFeedbackDto } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto): Promise<FeedbackItemDto> {
    const title =
      typeof dto.title === 'string' ? (dto.title.trim() || null) : null;
    const description = dto.description?.trim?.() ?? dto.description;
    const emotionAfter =
      typeof dto.emotionAfter === 'string' ? (dto.emotionAfter.trim() || null) : null;

    if (!description || description.trim().length < 3) {
      throw new BadRequestException('Описание должно быть не короче 3 символов');
    }

    let sessionId: string | null = null;
    if (dto.sessionId) {
      const session = await this.prisma.session.findFirst({
        where: { id: dto.sessionId, userId },
        select: { id: true },
      });
      if (!session) {
        throw new NotFoundException('Сессия не найдена');
      }
      sessionId = dto.sessionId;
    }

    const created = await this.prisma.feedback.create({
      data: {
        userId,
        sessionId,
        title,
        description: description.trim(),
        emotionAfter,
        feedbackType: dto.feedbackType ?? FeedbackType.FULL,
        status: FeedbackStatus.NEW,
      },
      select: {
        id: true,
        sessionId: true,
        title: true,
        description: true,
        emotionAfter: true,
        feedbackType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        session: { select: { title: true } },
      },
    });

    return {
      id: created.id,
      sessionId: created.sessionId,
      sessionTitle: created.session?.title ?? null,
      title: created.title,
      description: created.description,
      emotionAfter: created.emotionAfter,
      feedbackType: created.feedbackType,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async my(userId: string, opts?: { sessionOnly?: boolean }): Promise<FeedbackItemDto[]> {
    const items = await this.prisma.feedback.findMany({
      where: {
        userId,
        ...(opts?.sessionOnly ? { sessionId: { not: null } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sessionId: true,
        title: true,
        description: true,
        emotionAfter: true,
        feedbackType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        session: { select: { title: true } },
      },
    });

    return items.map((f) => ({
      id: f.id,
      sessionId: f.sessionId,
      sessionTitle: f.session?.title ?? null,
      title: f.title,
      description: f.description,
      emotionAfter: f.emotionAfter,
      feedbackType: f.feedbackType,
      status: f.status,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  async update(userId: string, id: string, dto: UpdateFeedbackDto): Promise<FeedbackItemDto> {
    const existing = await this.prisma.feedback.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Обратная связь не найдена');
    }

    const dataToUpdate: {
      title?: string | null;
      description?: string;
      emotionAfter?: string | null;
    } = {};

    if (typeof dto.title === 'string') {
      dataToUpdate.title = dto.title.trim() || null;
    }
    if (typeof dto.description === 'string') {
      const nextDescription = dto.description.trim();
      if (nextDescription.length < 3) {
        throw new BadRequestException('Описание должно быть не короче 3 символов');
      }
      dataToUpdate.description = nextDescription;
    }
    if (typeof dto.emotionAfter === 'string') {
      const nextEmotion = dto.emotionAfter.trim();
      if (nextEmotion.length < 2) {
        throw new BadRequestException(
          'Эмоциональное состояние должно быть не короче 2 символов',
        );
      }
      dataToUpdate.emotionAfter = nextEmotion;
    }

    const updated = await this.prisma.feedback.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        sessionId: true,
        title: true,
        description: true,
        emotionAfter: true,
        feedbackType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        session: { select: { title: true } },
      },
    });

    return {
      id: updated.id,
      sessionId: updated.sessionId,
      sessionTitle: updated.session?.title ?? null,
      title: updated.title,
      description: updated.description,
      emotionAfter: updated.emotionAfter,
      feedbackType: updated.feedbackType,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
