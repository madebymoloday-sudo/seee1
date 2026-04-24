import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatWebSocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const EXPLAIN_QUESTIONS: Record<number, string> = {
  1: 'Как называется идея, которую объясняем?',
  2: 'Какую функцию выполняет эта идея?',
  3: 'Из каких основных частей состоит идея? Или по каким причинам она важна? Распишите последовательность если она важна',
  4: 'Кто основатель этой идеи?',
  5: 'Какие эмоциональные последствия для людей несёт эта идея?',
  6: 'Какие физические/практические последствия несёт идея?',
  7: 'Какой первый вывод можно сделать на основе описанного?',
  8: 'Разберём теперь как работают каждая часть по отдельности?',
  9: 'Какую часть идеи будем разбирать из тех, что вы перечисляли ранее?',
  91: 'Какую теперь часть идеи будем разбирать? Или разберём новую идею?',
};

const DEFAULT_MODE = 'Обычный';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatWebSocketGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findUserByPublicId(userId: string, currentUserId: string) {
    const target = await this.prisma.user.findFirst({
      where: { userId },
      select: { id: true, username: true, userId: true, avatarUrl: true },
    });

    if (!target) throw new NotFoundException('Пользователь не найден');
    if (target.id === currentUserId) {
      throw new BadRequestException('Нельзя добавить самого себя');
    }
    return target;
  }

  async addFriend(currentUserId: string, friendUserId: string) {
    const target = await this.findUserByPublicId(friendUserId, currentUserId);

    const [a, b] = [currentUserId, target.id].sort();
    const existing = await this.prisma.friendship.findFirst({
      where: { requesterId: a, addresseeId: b },
      select: { id: true },
    });
    if (existing) return { ok: true, friendshipId: existing.id };

    const friendship = await this.prisma.friendship.create({
      data: {
        requesterId: a,
        addresseeId: b,
        status: 'ACCEPTED',
      },
      select: { id: true },
    });

    await this.ensureDirectChat(currentUserId, target.id);

    return { ok: true, friendshipId: friendship.id };
  }

  async getFriends(currentUserId: string) {
    const links = await this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
      },
      include: {
        requester: { select: { id: true, username: true, userId: true, avatarUrl: true } },
        addressee: { select: { id: true, username: true, userId: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return links.map((f) => {
      const friend = f.requesterId === currentUserId ? f.addressee : f.requester;
      return friend;
    });
  }

  async listChats(currentUserId: string) {
    await this.reconcilePendingModeRequestsForUser(currentUserId);
    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId: currentUserId } } },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, userId: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, username: true, userId: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      chats.map(async (chat) => {
      const participants = chat.members.map((m) => m.user);
      const others = participants.filter((p) => p.id !== currentUserId);
      const title = chat.isGroup
        ? chat.name || 'Группа'
        : others[0]?.username || 'Чат с собой';
      const currentMember = chat.members.find((member) => member.userId === currentUserId);
      const unreadCount = await this.countUnreadMessages(
        chat.id,
        currentUserId,
        currentMember?.lastReadAt ?? null,
      );

      const pendingRequest = await this.prisma.chatModeRequest.findFirst({
        where: { chatId: chat.id, status: 'PENDING' },
        include: {
          approvals: { select: { userId: true, accepted: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const activeExplain = await this.prisma.chatExplainSession.findFirst({
        where: { chatId: chat.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      return {
        id: chat.id,
        title,
        isGroup: chat.isGroup,
        participants,
        unreadCount,
        pendingModeRequest: pendingRequest
          ? {
              id: pendingRequest.id,
              mode: pendingRequest.mode,
              initiatedById: pendingRequest.initiatedById,
              expiresAt: pendingRequest.expiresAt,
              approvals: pendingRequest.approvals,
            }
          : null,
        activeMode: activeExplain ? 'Объяснить' : DEFAULT_MODE,
        lastMessage: chat.messages[0]
          ? {
              id: chat.messages[0].id,
              content: chat.messages[0].content,
              mode: chat.messages[0].mode,
              createdAt: chat.messages[0].createdAt,
              sender: chat.messages[0].sender,
            }
          : null,
      };
      }),
    );
  }

  async getChatMessages(currentUserId: string, chatId: string) {
    await this.assertMember(chatId, currentUserId);
    await this.reconcilePendingModeRequests(chatId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { chatId },
      include: {
        sender: { select: { id: true, username: true, userId: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });

    await this.setChatReadMarker(currentUserId, chatId, messages[messages.length - 1]?.createdAt ?? new Date());
    this.chatGateway.emitMegaChatUnread(currentUserId, { chatId, unreadCount: 0 });

    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      mode: m.mode,
      meta: m.meta ?? null,
      createdAt: m.createdAt,
      sender: m.sender,
    }));
  }

  async sendMessage(currentUserId: string, chatId: string, content: string, mode?: string) {
    await this.assertMember(chatId, currentUserId);
    const clean = content.trim();
    if (!clean) throw new BadRequestException('Пустое сообщение');

    const message = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: currentUserId,
        content: clean,
        mode: (mode || 'Объяснить').trim() || 'Объяснить',
      },
      include: {
        sender: { select: { id: true, username: true, userId: true, avatarUrl: true } },
      },
    });

    await this.setChatReadMarker(currentUserId, chatId, message.createdAt);

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, name: true, isGroup: true },
    });

    const recipients = await this.prisma.chatMember.findMany({
      where: {
        chatId,
        userId: { not: currentUserId },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            telegramId: true,
            megaChatTelegramNotificationsEnabled: true,
          },
        },
      },
    });

    const unreadEntries = await Promise.all(
      recipients.map(async (recipient) => {
        const isViewingChat = this.chatGateway.isUserViewingChat(recipient.userId, chatId);
        if (isViewingChat) {
          await this.setChatReadMarker(recipient.userId, chatId, message.createdAt);
          return { userId: recipient.userId, unreadCount: 0, isViewingChat };
        }

        return {
          userId: recipient.userId,
          unreadCount: await this.countUnreadMessages(chatId, recipient.userId),
          isViewingChat,
        };
      }),
    );

    const payload = {
      chatId,
      message: {
        id: message.id,
        content: message.content,
        mode: message.mode,
        meta: message.meta ?? null,
        createdAt: message.createdAt,
        sender: message.sender,
      },
      chatTitle: chat?.name || null,
    };

    this.chatGateway.emitMegaChatMessage(chatId, payload);
    this.chatGateway.emitMegaChatUnread(currentUserId, { chatId, unreadCount: 0 });

    for (const unreadEntry of unreadEntries) {
      this.chatGateway.emitMegaChatUnread(unreadEntry.userId, {
        chatId,
        unreadCount: unreadEntry.unreadCount,
      });
    }

    this.chatGateway.emitMegaChatRefresh(
      [currentUserId, ...unreadEntries.map((entry) => entry.userId)],
      { chatId },
    );

    await this.notificationsService.notifyMegaChatMessage({
      chatId,
      chatTitle: chat?.name || (chat?.isGroup ? 'Группа' : message.sender.username),
      senderUsername: message.sender.username,
      messagePreview: this.getMessagePreview(message.content),
      recipients: recipients.map((recipient) => recipient.user),
      shouldSendBrowserPushToUserIds: unreadEntries
        .filter((entry) => !entry.isViewingChat)
        .map((entry) => entry.userId),
      shouldSendTelegramToUserIds: recipients
        .filter(
          (recipient) =>
            recipient.user.telegramId &&
            recipient.user.megaChatTelegramNotificationsEnabled &&
            !this.chatGateway.isUserOnline(recipient.userId),
        )
        .map((recipient) => recipient.userId),
    });

    return {
      id: message.id,
      content: message.content,
      mode: message.mode,
      meta: message.meta ?? null,
      createdAt: message.createdAt,
      sender: message.sender,
    };
  }

  async startModeRequest(currentUserId: string, chatId: string, mode: string) {
    await this.assertMember(chatId, currentUserId);
    const cleanMode = mode.trim();
    if (!cleanMode) throw new BadRequestException('Режим не указан');

    await this.reconcilePendingModeRequests(chatId);

    const existing = await this.prisma.chatModeRequest.findFirst({
      where: { chatId, status: 'PENDING' },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Уже есть активный запрос запуска режима');
    }

    const members = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });

    const expiresAt = new Date(Date.now() + 15_000);
    const request = await this.prisma.chatModeRequest.create({
      data: {
        chatId,
        mode: cleanMode,
        initiatedById: currentUserId,
        expiresAt,
      },
      select: { id: true },
    });

    // инициатор согласен автоматически
    await this.prisma.chatModeApproval.create({
      data: {
        requestId: request.id,
        userId: currentUserId,
        accepted: true,
      },
    });

    await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: currentUserId,
        content: `хочет запустить режим "${cleanMode}"`,
        mode: cleanMode,
        meta: {
          type: 'mode-request',
          requestId: request.id,
          memberCount: members.length,
        } as any,
      },
    });

    return this.getModeState(currentUserId, chatId);
  }

  async respondModeRequest(currentUserId: string, chatId: string, requestId: string, accepted: boolean) {
    await this.assertMember(chatId, currentUserId);
    const request = await this.prisma.chatModeRequest.findFirst({
      where: { id: requestId, chatId },
      select: { id: true, status: true, mode: true, initiatedById: true },
    });
    if (!request || request.status !== 'PENDING') {
      throw new NotFoundException('Запрос режима не найден');
    }

    await this.prisma.chatModeApproval.upsert({
      where: { requestId_userId: { requestId, userId: currentUserId } },
      create: { requestId, userId: currentUserId, accepted },
      update: { accepted },
    });

    if (!accepted) {
      await this.prisma.chatModeRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });

      await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: currentUserId,
          content: `отклонил(а) запуск режима "${request.mode}"`,
          mode: request.mode,
          meta: { type: 'mode-request-rejected', requestId } as any,
        },
      });
      return this.getModeState(currentUserId, chatId);
    }

    await this.tryActivateModeRequest(chatId, requestId);
    return this.getModeState(currentUserId, chatId);
  }

  async getModeState(currentUserId: string, chatId: string) {
    await this.assertMember(chatId, currentUserId);
    await this.reconcilePendingModeRequests(chatId);

    const pendingRequest = await this.prisma.chatModeRequest.findFirst({
      where: { chatId, status: 'PENDING' },
      include: {
        approvals: { select: { userId: true, accepted: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeExplain = await this.prisma.chatExplainSession.findFirst({
      where: { chatId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            mode: pendingRequest.mode,
            initiatedById: pendingRequest.initiatedById,
            expiresAt: pendingRequest.expiresAt,
            approvals: pendingRequest.approvals,
          }
        : null,
      activeMode: activeExplain ? 'Объяснить' : DEFAULT_MODE,
      explainSession: activeExplain ? this.formatExplainSession(activeExplain) : null,
      currentQuestion: activeExplain ? this.getExplainQuestion(activeExplain.currentStep) : null,
      canControl: !!activeExplain && activeExplain.initiatorId === currentUserId,
    };
  }

  async submitExplainAnswer(currentUserId: string, chatId: string, text: string) {
    const session = await this.getExplainSessionOrThrow(chatId, currentUserId);
    const clean = text.trim();
    if (!clean) throw new BadRequestException('Ответ пустой');

    const answers = this.parseAnswers(session.answersJson);
    const key = String(session.currentStep);
    if (!answers[key]) answers[key] = [];
    answers[key].push(clean);
    const answerIndex = Math.max(0, answers[key].length - 1);

    const updated = await this.prisma.chatExplainSession.update({
      where: { id: session.id },
      data: { answersJson: answers as any },
    });

    const message = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: currentUserId,
        content: clean,
        mode: 'Объяснить',
        meta: { type: 'explain-answer', step: session.currentStep, answerIndex } as any,
      },
      select: { id: true },
    });

    return {
      ...this.formatExplainSession(updated),
      answerMessageId: message.id,
    };
  }

  async editExplainAnswer(
    currentUserId: string,
    chatId: string,
    step: number,
    answerIndex: number,
    text: string,
  ) {
    const session = await this.getExplainSessionOrThrow(chatId, currentUserId);
    if (session.initiatorId !== currentUserId) {
      throw new BadRequestException('Только инициатор может редактировать ответы');
    }
    const answers = this.parseAnswers(session.answersJson);
    const key = String(step);
    if (!answers[key] || !answers[key][answerIndex]) {
      throw new NotFoundException('Ответ для редактирования не найден');
    }
    answers[key][answerIndex] = text.trim();

    const updated = await this.prisma.chatExplainSession.update({
      where: { id: session.id },
      data: { answersJson: answers as any },
    });

    return this.formatExplainSession(updated);
  }

  async controlExplainSession(currentUserId: string, chatId: string, action: 'next' | 'back' | 'finish') {
    const session = await this.getExplainSessionOrThrow(chatId, currentUserId);
    if (session.initiatorId !== currentUserId) {
      throw new BadRequestException('Только инициатор может управлять этапами');
    }

    if (action === 'finish') {
      const closed = await this.prisma.chatExplainSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: currentUserId,
          content: 'Режим "Объяснить" завершён',
          mode: 'Объяснить',
          meta: { type: 'mode-finished' } as any,
        },
      });
      return this.formatExplainSession(closed);
    }

    let nextStep = session.currentStep;
    const stack = this.parseStack(session.pathStackJson);

    if (action === 'back') {
      nextStep = stack.length > 0 ? stack.pop()! : Math.max(1, session.currentStep - 1);
    } else {
      stack.push(session.currentStep);
      nextStep = this.resolveNextExplainStep(session);
    }

    const updated = await this.prisma.chatExplainSession.update({
      where: { id: session.id },
      data: {
        currentStep: nextStep,
        pathStackJson: stack as any,
      },
    });

    await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: currentUserId,
        content: this.getExplainQuestion(nextStep),
        mode: 'Объяснить',
        meta: { type: 'explain-question', step: nextStep } as any,
      },
    });

    return this.formatExplainSession(updated);
  }

  async createDirect(currentUserId: string, friendUserId: string) {
    const target = await this.findUserByPublicId(friendUserId, currentUserId);
    const chat = await this.ensureDirectChat(currentUserId, target.id);
    return chat;
  }

  async createSelfChat(currentUserId: string) {
    const candidates = await this.prisma.chat.findMany({
      where: {
        isGroup: false,
        members: { some: { userId: currentUserId } },
      },
      include: { members: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const existing = candidates.find((c) => {
      const ids = c.members.map((m) => m.userId);
      return ids.length === 1 && ids[0] === currentUserId;
    });
    if (existing) return existing;

    return this.prisma.chat.create({
      data: {
        isGroup: false,
        createdById: currentUserId,
        name: 'Личное',
        members: {
          create: [{ userId: currentUserId }],
        },
      },
    });
  }

  async createGroup(currentUserId: string, name: string, memberUserIds: string[]) {
    const ids = new Set<string>();
    for (const uid of memberUserIds) {
      const u = await this.prisma.user.findFirst({
        where: { userId: uid },
        select: { id: true },
      });
      if (u && u.id !== currentUserId) ids.add(u.id);
    }

    const chat = await this.prisma.chat.create({
      data: {
        name: name.trim(),
        isGroup: true,
        createdById: currentUserId,
        members: {
          create: [
            { userId: currentUserId },
            ...Array.from(ids).map((id) => ({ userId: id })),
          ],
        },
      },
      select: { id: true, name: true, isGroup: true },
    });

    return chat;
  }

  async markChatRead(currentUserId: string, chatId: string, lastMessageId?: string) {
    await this.assertMember(chatId, currentUserId);

    let readAt = new Date();
    if (lastMessageId) {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: lastMessageId, chatId },
        select: { createdAt: true },
      });
      if (message) {
        readAt = message.createdAt;
      }
    } else {
      const latestMessage = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (latestMessage) {
        readAt = latestMessage.createdAt;
      }
    }

    await this.setChatReadMarker(currentUserId, chatId, readAt);
    this.chatGateway.emitMegaChatUnread(currentUserId, { chatId, unreadCount: 0 });
    return { ok: true, chatId, unreadCount: 0 };
  }

  async getNotificationSettings(currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        telegramId: true,
        megaChatTelegramNotificationsEnabled: true,
      },
    });

    return this.notificationsService.getSettings(user || {});
  }

  async saveBrowserPushSubscription(
    currentUserId: string,
    subscription: {
      endpoint: string;
      expirationTime?: number | null;
      keys: { p256dh: string; auth: string };
    },
  ) {
    return this.notificationsService.saveBrowserSubscription(currentUserId, subscription);
  }

  async removeBrowserPushSubscription(currentUserId: string, endpoint: string) {
    return this.notificationsService.removeBrowserSubscription(currentUserId, endpoint);
  }

  async updateTelegramNotificationPreference(currentUserId: string, enabled: boolean) {
    return this.notificationsService.updateTelegramNotificationPreference(currentUserId, enabled);
  }

  private async assertMember(chatId: string, userId: string) {
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Чат не найден');
  }

  private async setChatReadMarker(userId: string, chatId: string, readAt: Date) {
    await this.prisma.chatMember.updateMany({
      where: { userId, chatId },
      data: { lastReadAt: readAt },
    });
  }

  private async countUnreadMessages(chatId: string, userId: string, lastReadAt?: Date | null) {
    const membership =
      typeof lastReadAt !== 'undefined'
        ? { lastReadAt }
        : await this.prisma.chatMember.findFirst({
            where: { chatId, userId },
            select: { lastReadAt: true },
          });

    return this.prisma.chatMessage.count({
      where: {
        chatId,
        senderId: { not: userId },
        ...(membership?.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
      },
    });
  }

  private getMessagePreview(content: string) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 140) {
      return normalized;
    }

    return `${normalized.slice(0, 137)}...`;
  }

  private async ensureDirectChat(userA: string, userB: string) {
    const candidates = await this.prisma.chat.findMany({
      where: {
        isGroup: false,
        members: { some: { userId: userA } },
      },
      include: { members: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const existing = candidates.find((c) => {
      const ids = c.members.map((m) => m.userId);
      return ids.length === 2 && ids.includes(userA) && ids.includes(userB);
    });
    if (existing) return existing;

    return this.prisma.chat.create({
      data: {
        isGroup: false,
        createdById: userA,
        members: {
          create: [{ userId: userA }, { userId: userB }],
        },
      },
    });
  }

  private async reconcilePendingModeRequestsForUser(currentUserId: string) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId: currentUserId },
      select: { chatId: true },
    });
    for (const membership of memberships) {
      await this.reconcilePendingModeRequests(membership.chatId);
    }
  }

  private async reconcilePendingModeRequests(chatId: string) {
    const request = await this.prisma.chatModeRequest.findFirst({
      where: { chatId, status: 'PENDING' },
      include: {
        approvals: { select: { userId: true, accepted: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) return;

    const members = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    const approvedIds = new Set(request.approvals.filter((a) => a.accepted).map((a) => a.userId));
    const rejected = request.approvals.some((a) => !a.accepted);

    if (rejected) {
      await this.prisma.chatModeRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED' },
      });
      return;
    }

    if (new Date() >= request.expiresAt) {
      // авто-accept для молчащих пользователей
      for (const userId of memberIds) {
        if (!approvedIds.has(userId)) {
          await this.prisma.chatModeApproval.upsert({
            where: { requestId_userId: { requestId: request.id, userId } },
            create: { requestId: request.id, userId, accepted: true },
            update: { accepted: true },
          });
        }
      }
    }

    await this.tryActivateModeRequest(chatId, request.id);
  }

  private async tryActivateModeRequest(chatId: string, requestId: string) {
    const request = await this.prisma.chatModeRequest.findUnique({
      where: { id: requestId },
      include: { approvals: true },
    });
    if (!request || request.status !== 'PENDING') return;

    const members = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    const rejected = request.approvals.some((a) => !a.accepted);
    if (rejected) {
      await this.prisma.chatModeRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });
      return;
    }

    const approvedIds = new Set(request.approvals.filter((a) => a.accepted).map((a) => a.userId));
    const everyoneApproved = memberIds.every((id) => approvedIds.has(id));
    if (!everyoneApproved) return;

    await this.prisma.chatModeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' },
    });

    if (request.mode === 'Объяснить') {
      const active = await this.prisma.chatExplainSession.findFirst({
        where: { chatId, isActive: true },
        select: { id: true },
      });
      if (!active) {
        await this.prisma.chatExplainSession.create({
          data: {
            chatId,
            initiatorId: request.initiatedById,
            isActive: true,
            currentStep: 1,
            answersJson: {} as any,
            pathStackJson: [] as any,
          },
        });
        await this.prisma.chatMessage.create({
          data: {
            chatId,
            senderId: request.initiatedById,
            content: EXPLAIN_QUESTIONS[1],
            mode: 'Объяснить',
            meta: { type: 'explain-question', step: 1 } as any,
          },
        });
      }
    }
  }

  private async getExplainSessionOrThrow(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);
    const session = await this.prisma.chatExplainSession.findFirst({
      where: { chatId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw new NotFoundException('Активный режим "Объяснить" не найден');
    return session;
  }

  private parseAnswers(value: any): Record<string, string[]> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Record<string, string[]> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (Array.isArray(raw)) result[key] = raw.map((x) => String(x));
    }
    return result;
  }

  private parseStack(value: any): number[] {
    if (!Array.isArray(value)) return [];
    return value.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  }

  private resolveNextExplainStep(session: { currentStep: number; answersJson: any }) {
    const answers = this.parseAnswers(session.answersJson);
    const step8Answers = answers['8'] || [];
    const normalized8 = step8Answers.join(' ').toLowerCase();

    if (session.currentStep === 7) return 8;
    if (session.currentStep === 8) {
      return normalized8.includes('нет') ? 91 : 9;
    }
    if (session.currentStep === 9) return 2;
    if (session.currentStep === 91) {
      const last = (answers['91'] || []).slice(-1)[0]?.toLowerCase() || '';
      if (last.includes('нов') || last.includes('иде')) return 1;
      return 2;
    }
    return Math.min(8, session.currentStep + 1);
  }

  private getExplainQuestion(step: number) {
    return EXPLAIN_QUESTIONS[step] || EXPLAIN_QUESTIONS[1];
  }

  private formatExplainSession(session: any) {
    return {
      id: session.id,
      chatId: session.chatId,
      initiatorId: session.initiatorId,
      isActive: session.isActive,
      currentStep: session.currentStep,
      currentQuestion: this.getExplainQuestion(session.currentStep),
      answers: this.parseAnswers(session.answersJson),
      pathStack: this.parseStack(session.pathStackJson),
      currentIdea: session.currentIdea,
      currentPart: session.currentPart,
    };
  }
}
