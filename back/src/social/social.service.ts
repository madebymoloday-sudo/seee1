import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

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

    return chats.map((chat) => {
      const participants = chat.members.map((m) => m.user);
      const others = participants.filter((p) => p.id !== currentUserId);
      const title = chat.isGroup
        ? chat.name || 'Группа'
        : others[0]?.username || 'Личный чат';

      return {
        id: chat.id,
        title,
        isGroup: chat.isGroup,
        participants,
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
    });
  }

  async getChatMessages(currentUserId: string, chatId: string) {
    await this.assertMember(chatId, currentUserId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { chatId },
      include: {
        sender: { select: { id: true, username: true, userId: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });

    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      mode: m.mode,
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

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return {
      id: message.id,
      content: message.content,
      mode: message.mode,
      createdAt: message.createdAt,
      sender: message.sender,
    };
  }

  async createDirect(currentUserId: string, friendUserId: string) {
    const target = await this.findUserByPublicId(friendUserId, currentUserId);
    const chat = await this.ensureDirectChat(currentUserId, target.id);
    return chat;
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

  private async assertMember(chatId: string, userId: string) {
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Чат не найден');
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
}

