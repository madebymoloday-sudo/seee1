import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesResponseDto, MessageDto } from './dto/messages.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('Messages')
@Controller('sessions/:sessionId/messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить сообщения сессии с cursor pagination' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor для пагинации (ID последнего сообщения)',
    example: 'uuid',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Количество сообщений (по умолчанию 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Список сообщений',
    type: MessagesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Нет доступа к сессии' })
  async getMessages(
    @Request() req: { user: { id: string } },
    @Param('sessionId') sessionId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<MessagesResponseDto> {
    return this.messagesService.getMessages(
      sessionId,
      req.user.id,
      cursor,
      limit || 50,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Отправить сообщение в сессию' })
  @ApiResponse({
    status: 201,
    description: 'Сообщение успешно отправлено',
    type: MessageDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Нет доступа к сессии' })
  @ApiResponse({ status: 404, description: 'Сессия не найдена' })
  async createMessage(
    @Request() req: { user: { id: string } },
    @Param('sessionId') sessionId: string,
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<MessageDto> {
    return this.messagesService.createMessage(
      sessionId,
      req.user.id,
      createMessageDto.content,
    );
  }
}

