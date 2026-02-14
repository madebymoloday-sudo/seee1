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
  SendChatMessageDto,
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

  @Post('chats/group')
  @ApiOperation({ summary: 'Создать групповой чат' })
  createGroup(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateGroupChatDto,
  ) {
    return this.socialService.createGroup(req.user.id, dto.name, dto.memberUserIds);
  }

  @Get('chats/:chatId/messages')
  @ApiOperation({ summary: 'Получить сообщения чата' })
  getMessages(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
  ) {
    return this.socialService.getChatMessages(req.user.id, chatId);
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
}

