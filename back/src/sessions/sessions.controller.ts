import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, SessionResponseDto } from './dto/session.dto';
import { UpdateSessionProgramDto } from './dto/update-session-program.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../subscription/subscription.guard';

@ApiTags('Sessions')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: 'Создать новую сессию' })
  @ApiResponse({
    status: 201,
    description: 'Сессия успешно создана',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Неавторизованный доступ',
  })
  @ApiResponse({
    status: 403,
    description: 'Требуется активная подписка',
  })
  async createSession(
    @Request() req: { user: { id: string } },
    @Body() createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    return this.sessionsService.create(req.user.id, createSessionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить все сессии пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Список сессий',
    type: [SessionResponseDto],
  })
  async getSessions(
    @Request() req: { user: { id: string } },
  ): Promise<SessionResponseDto[]> {
    return this.sessionsService.findAllByUserId(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить сессию по ID' })
  @ApiResponse({
    status: 200,
    description: 'Сессия найдена',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Сессия не найдена',
  })
  async getSession(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<SessionResponseDto> {
    return this.sessionsService.findOne(id, req.user.id);
  }

  @Get(':id/document')
  @ApiOperation({ summary: 'Скачать документ сессии (Markdown)' })
  @ApiResponse({
    status: 200,
    description: 'Документ сессии',
  })
  @ApiResponse({
    status: 404,
    description: 'Сессия не найдена или нет данных концепций',
  })
  async getDocument(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<{ document: string }> {
    return this.sessionsService.generateDocument(id, req.user.id);
  }

  @Get(':id/pipeline-state')
  @ApiOperation({ summary: 'Получить состояние пайплайна сессии' })
  @ApiResponse({
    status: 200,
    description: 'Состояние пайплайна',
  })
  @ApiResponse({
    status: 404,
    description: 'Сессия не найдена',
  })
  async getPipelineState(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<{ programName?: string }> {
    return this.sessionsService.getPipelineState(id, req.user.id);
  }

  @Post(':id/add-to-map')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Добавить сессию в нейрокарту' })
  @ApiResponse({
    status: 200,
    description: 'Сессия добавлена в нейрокарту',
  })
  async addSessionToMap(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.sessionsService.addSessionToMap(id, req.user.id);
  }

  @Patch(':id/program')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить программу (пайплайн) сессии' })
  @ApiResponse({
    status: 200,
    description: 'Программа сессии успешно обновлена',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Нет доступа к сессии' })
  @ApiResponse({ status: 404, description: 'Сессия или пайплайн не найдены' })
  async updateProgram(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() updateDto: UpdateSessionProgramDto,
  ): Promise<SessionResponseDto> {
    return this.sessionsService.updateProgram(id, req.user.id, updateDto.pipelineId);
  }
}

