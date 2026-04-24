import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PsychologistService } from '../psychologist/psychologist.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatWebSocketGateway.name);

  constructor(
    private prisma: PrismaService,
    private psychologistService: PsychologistService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = await this.resolveUserId(client);
    if (!userId) {
      client.emit('error', { message: 'Необходима авторизация' });
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    client.join(`user:${userId}`);
    this.logger.log(`Client connected: ${client.id} (user ${userId})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !data?.chatId) {
      client.emit('error', { message: 'Необходима авторизация' });
      return;
    }

    const isMember = await this.prisma.chatMember.findFirst({
      where: { chatId: data.chatId, userId },
      select: { id: true },
    });

    if (!isMember) {
      client.emit('error', { message: 'Нет доступа к чату' });
      return;
    }

    const previousChatId = client.data.activeChatId as string | undefined;
    if (previousChatId && previousChatId !== data.chatId) {
      client.leave(`chat:${previousChatId}`);
    }

    client.join(`chat:${data.chatId}`);
    client.data.activeChatId = data.chatId;
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.chatId) {
      return;
    }

    client.leave(`chat:${data.chatId}`);
    if (client.data.activeChatId === data.chatId) {
      client.data.activeChatId = undefined;
    }
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`session:${data.sessionId}`);
    this.logger.log(`Client ${client.id} joined session ${data.sessionId}`);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() data: { sessionId: string; content: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, content, userId } = data;

    if (!userId) {
      client.emit('error', { message: 'Необходима авторизация' });
      return;
    }

    try {
      // Сохраняем сообщение пользователя
      await this.prisma.message.create({
        data: {
          sessionId,
          role: 'user',
          content,
        },
      });

      // Генерируем ответ через AI психолога
      let aiResponse: string;
      try {
        this.logger.log(
          `💬 Получено сообщение в сессии ${sessionId} от пользователя ${userId}`,
        );
        aiResponse = await this.psychologistService.generateResponse(
          sessionId,
          content,
        );
        this.logger.log(
          `✅ Ответ отправлен в сессию ${sessionId}`,
        );
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
          client.emit('error', {
            message: 'LLM не настроен. У сервера не подключен LLM API ключ. Обратитесь к администратору.',
          });
          return;
        }
        // Пробрасываем другие ошибки
        throw error;
      }

      // Получаем состояние пайплайна для отправки информации о шаге
      const pipelineState = await this.prisma.pipelineState.findUnique({
        where: { sessionId },
      });

      const state = pipelineState
        ? (pipelineState.stateJson as any)
        : null;

      // Отправляем ответ клиенту с информацией о шаге
      const messageData = {
        sessionId,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        ...(state && {
          step: state.currentStep,
          completed: state.completed,
        }),
      };

      client.emit('message', messageData);

      // Отправляем всем в комнате сессии
      this.server.to(`session:${sessionId}`).emit('message', messageData);

      // Если пайплайн завершен - сохраняем концепции
      if (state?.completed) {
        await this.saveConcepts(sessionId, state);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
      client.emit('error', {
        message: 'Ошибка при обработке сообщения',
      });
    }
  }

  private async saveConcepts(sessionId: string, state: any): Promise<void> {
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

  emitMegaChatMessage(chatId: string, payload: unknown) {
    this.server.to(`chat:${chatId}`).emit('social:message', payload);
  }

  emitMegaChatUnread(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('social:unread', payload);
  }

  emitMegaChatRefresh(userIds: string[], payload: unknown) {
    for (const userId of userIds) {
      this.server.to(`user:${userId}`).emit('social:chat_refresh', payload);
    }
  }

  isUserOnline(userId: string) {
    return (this.server.sockets.adapter.rooms.get(`user:${userId}`)?.size || 0) > 0;
  }

  isUserViewingChat(userId: string, chatId: string) {
    const room = this.server.sockets.adapter.rooms.get(`user:${userId}`);
    if (!room?.size) {
      return false;
    }

    for (const socketId of room) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket?.rooms.has(`chat:${chatId}`)) {
        return true;
      }
    }

    return false;
  }

  private async resolveUserId(client: Socket) {
    const rawToken =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers.authorization as string | undefined);
    if (!rawToken) {
      return null;
    }

    const token = rawToken.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length)
      : rawToken;

    try {
      const payload = this.jwtService.verify(token) as { sub?: string };

      return payload.sub || null;
    } catch {
      return null;
    }
  }
}
