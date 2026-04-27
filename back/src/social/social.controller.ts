import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SocialService } from './social.service';
import {
  AddFriendDto,
  CreateDirectChatDto,
  CreateGroupChatDto,
  ExplainEditAnswerDto,
  ExplainSessionActionDto,
  ExplainStepAnswerDto,
  BrowserPushSubscriptionDto,
  MarkChatReadDto,
  RemoveBrowserPushSubscriptionDto,
  RespondModeRequestDto,
  SendChatMessageDto,
  StartModeRequestDto,
  UpdateTelegramNotificationPreferenceDto,
} from './dto/social.dto';

@ApiTags('Social')
@Controller('social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('users/:userId')
  @ApiOperation({ summary: 'Найти пользователя по публичному ID' })
  findUser(
    @Request() req: { user: { id: string } },
    @Param('userId') userId: string,
  ) {
    return this.socialService.findUserByPublicId(userId, req.user.id);
  }

  @Post('friends/add')
  @ApiOperation({ summary: 'Добавить пользователя в друзья по публичному ID' })
  addFriend(
    @Request() req: { user: { id: string } },
    @Body() dto: AddFriendDto,
  ) {
    return this.socialService.addFriend(req.user.id, dto.friendUserId);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Список друзей' })
  getFriends(@Request() req: { user: { id: string } }) {
    return this.socialService.getFriends(req.user.id);
  }

  @Get('chats')
  @ApiOperation({ summary: 'Список чатов пользователя (личные и групповые)' })
  listChats(@Request() req: { user: { id: string } }) {
    return this.socialService.listChats(req.user.id);
  }

  @Post('chats/direct')
  @ApiOperation({ summary: 'Создать/получить личный чат с пользователем' })
  createDirect(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateDirectChatDto,
  ) {
    return this.socialService.createDirect(req.user.id, dto.friendUserId);
  }

  @Post('chats/self')
  @ApiOperation({ summary: 'Создать/получить чат с самим собой' })
  createSelf(@Request() req: { user: { id: string } }) {
    return this.socialService.createSelfChat(req.user.id);
  }

  @Post('chats/group')
  @ApiOperation({ summary: 'Создать групповой чат' })
  createGroup(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateGroupChatDto,
  ) {
    return this.socialService.createGroup(req.user.id, dto.name, dto.memberUserIds);
  }

  @Post('chats/:chatId/join')
  @ApiOperation({ summary: 'Войти в групповой чат по пригласительной ссылке' })
  joinGroupChat(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
  ) {
    return this.socialService.joinGroupChat(req.user.id, chatId);
  }

  @Get('chats/:chatId/messages')
  @ApiOperation({ summary: 'Получить сообщения чата' })
  getMessages(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
  ) {
    return this.socialService.getChatMessages(req.user.id, chatId);
  }

  @Post('chats/:chatId/read')
  @ApiOperation({ summary: 'Отметить чат прочитанным' })
  markRead(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Body() dto: MarkChatReadDto,
  ) {
    return this.socialService.markChatRead(req.user.id, chatId, dto.lastMessageId);
  }

  @Post('chats/:chatId/messages')
  @ApiOperation({ summary: 'Отправить сообщение в чат' })
  sendMessage(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.socialService.sendMessage(req.user.id, chatId, dto.content, dto.mode);
  }

  @Get('chats/:chatId/mode-state')
  @ApiOperation({ summary: 'Текущее состояние режима в чате' })
  getModeState(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
  ) {
    return this.socialService.getModeState(req.user.id, chatId);
  }

  @Post('chats/:chatId/mode-requests')
  @ApiOperation({ summary: 'Запросить запуск режима в чате' })
  startModeRequest(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Body() dto: StartModeRequestDto,
  ) {
    return this.socialService.startModeRequest(req.user.id, chatId, dto.mode);
  }

  @Post('chats/:chatId/mode-requests/:requestId/respond')
  @ApiOperation({ summary: 'Ответить на запрос запуска режима' })
  respondModeRequest(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RespondModeRequestDto,
  ) {
    return this.socialService.respondModeRequest(req.user.id, chatId, requestId, !!dto.accepted);
  }

  @Post('chats/:chatId/explain/answer')
  @ApiOperation({ summary: 'Добавить ответ на текущий этап режима Объяснить' })
  addExplainAnswer(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Body() dto: ExplainStepAnswerDto,
  ) {
    return this.socialService.submitExplainAnswer(req.user.id, chatId, dto.text);
  }

  @Post('chats/:chatId/explain/control')
  @ApiOperation({ summary: 'Управление шагами режима Объяснить' })
  controlExplain(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Body() dto: ExplainSessionActionDto,
  ) {
    return this.socialService.controlExplainSession(req.user.id, chatId, dto.action);
  }

  @Post('chats/:chatId/explain/edit')
  @ApiOperation({ summary: 'Редактирование ответа режима Объяснить' })
  editExplainAnswer(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Body() dto: ExplainEditAnswerDto,
  ) {
    return this.socialService.editExplainAnswer(
      req.user.id,
      chatId,
      Number(dto.step),
      Number(dto.answerIndex),
      dto.text,
    );
  }

  @Get('notifications/settings')
  @ApiOperation({ summary: 'Настройки уведомлений мегачатов' })
  getNotificationSettings(@Request() req: { user: { id: string } }) {
    return this.socialService.getNotificationSettings(req.user.id);
  }

  @Post('notifications/browser-subscriptions')
  @ApiOperation({ summary: 'Сохранить browser push-подписку' })
  saveBrowserPushSubscription(
    @Request() req: { user: { id: string } },
    @Body() dto: BrowserPushSubscriptionDto,
  ) {
    return this.socialService.saveBrowserPushSubscription(req.user.id, dto);
  }

  @Post('notifications/browser-subscriptions/remove')
  @ApiOperation({ summary: 'Удалить browser push-подписку' })
  removeBrowserPushSubscription(
    @Request() req: { user: { id: string } },
    @Body() dto: RemoveBrowserPushSubscriptionDto,
  ) {
    return this.socialService.removeBrowserPushSubscription(req.user.id, dto.endpoint);
  }

  @Post('notifications/telegram')
  @ApiOperation({ summary: 'Включить или выключить Telegram-уведомления мегачатов' })
  updateTelegramNotifications(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateTelegramNotificationPreferenceDto,
  ) {
    return this.socialService.updateTelegramNotificationPreference(req.user.id, dto.enabled);
  }
}
