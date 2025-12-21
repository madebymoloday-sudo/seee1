import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventMapDto, EventMapResponseDto } from './dto/event-map.dto';

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
        eventNumber: createEventMapDto.eventNumber,
        event: createEventMapDto.event,
        emotion: createEventMapDto.emotion,
        idea: createEventMapDto.idea,
        rootBelief: createEventMapDto.rootBelief || null,
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

  private toResponseDto(eventMap: any): EventMapResponseDto {
    return {
      id: eventMap.id,
      userId: eventMap.userId,
      eventNumber: eventMap.eventNumber,
      event: eventMap.event,
      emotion: eventMap.emotion,
      idea: eventMap.idea,
      rootBelief: eventMap.rootBelief,
      isCompleted: eventMap.isCompleted,
      createdAt: eventMap.createdAt,
      updatedAt: eventMap.updatedAt,
    };
  }
}

