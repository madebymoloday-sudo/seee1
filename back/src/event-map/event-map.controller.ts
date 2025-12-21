import {
  Controller,
  Get,
  Post,
  Body,
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
import { EventMapService } from './event-map.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateEventMapDto,
  EventMapResponseDto,
} from './dto/event-map.dto';

@ApiTags('EventMap')
@Controller('event-map')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventMapController {
  constructor(private readonly eventMapService: EventMapService) {}

  @Get()
  @ApiOperation({ summary: 'Получить все записи нейрокарты пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Список записей нейрокарты',
    type: [EventMapResponseDto],
  })
  async getEventMap(
    @Request() req: { user: { id: string } },
  ): Promise<EventMapResponseDto[]> {
    return this.eventMapService.findAllByUserId(req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать запись в нейрокарте' })
  @ApiResponse({
    status: 201,
    description: 'Запись успешно создана',
    type: EventMapResponseDto,
  })
  async createEventMap(
    @Request() req: { user: { id: string } },
    @Body() createEventMapDto: CreateEventMapDto,
  ): Promise<EventMapResponseDto> {
    return this.eventMapService.create(req.user.id, createEventMapDto);
  }
}

