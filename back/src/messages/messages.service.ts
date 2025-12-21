import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesResponseDto, MessageDto } from './dto/messages.dto';
import { PsychologistService } from '../psychologist/psychologist.service';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private psychologistService: PsychologistService,
  ) {}

  async getMessages(
    sessionId: string,
    userId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<MessagesResponseDto> {
    // Проверяем доступ к сессии
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    // Cursor pagination: получаем сообщения ДО cursor (старые сообщения)
    const where: any = {
      sessionId,
    };

    if (cursor) {
      // Получаем timestamp сообщения с cursor
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { timestamp: true },
      });

      if (cursorMessage) {
        // Берем сообщения, которые были ДО этого timestamp
        where.timestamp = {
          lt: cursorMessage.timestamp,
        };
      }
    }

    // Получаем сообщения в обратном порядке (от новых к старым)
    // Но возвращаем в прямом порядке (от старых к новым)
    const messages = await this.prisma.message.findMany({
      where,
      take: limit + 1, // Берем на 1 больше для проверки hasMore
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        role: true,
        content: true,
        timestamp: true,
      },
    });

    // Проверяем, есть ли еще сообщения
    const hasMore = messages.length > limit;
    const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

    // Реверсируем для возврата от старых к новым
    messagesToReturn.reverse();

    // Следующий cursor - это ID первого (самого старого) сообщения в списке
    const nextCursor =
      messagesToReturn.length > 0 ? messagesToReturn[0].id : null;

    return {
      messages: messagesToReturn.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      })),
      nextCursor,
      hasMore,
    };
  }

  async createMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): Promise<MessageDto> {
    // Проверяем доступ к сессии
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этой сессии');
    }

    // Сохраняем сообщение пользователя
    const userMessage = await this.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });

    try {
      // Генерируем ответ через AI психолога
      const aiResponse = await this.psychologistService.generateResponse(
        sessionId,
        content,
      );

      // AI ответ уже сохранен в generateResponse, просто возвращаем сообщение пользователя
      return {
        id: userMessage.id,
        role: 'user',
        content: userMessage.content,
        timestamp: userMessage.timestamp,
      };
    } catch (error: any) {
      // Проверяем ошибку LLM API
      const errorMessage = error?.message || String(error);
      if (
        errorMessage.includes('API key') ||
        errorMessage.includes('MODEL_AUTHENTICATION') ||
        errorMessage.includes('Incorrect API key') ||
        errorMessage.includes('401') ||
        error?.status === 401 ||
        error?.response?.status === 401
      ) {
        throw new ServiceUnavailableException({
          message: 'LLM не настроен. У сервера не подключен LLM API ключ. Обратитесь к администратору.',
          field: 'llm',
        });
      }
      // Пробрасываем другие ошибки
      throw error;
    }
  }
}

