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
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PsychologistService } from '../psychologist/psychologist.service';

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
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
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
}

