import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { EventMapService } from './event-map.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateEventMapDto,
  EventMapResponseDto,
  UpdateEventMapDto,
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

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить узел нейрокарты' })
  @ApiResponse({
    status: 200,
    description: 'Узел успешно обновлен',
    type: EventMapResponseDto,
  })
  async updateEventMap(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() updateEventMapDto: UpdateEventMapDto,
  ): Promise<EventMapResponseDto> {
    return this.eventMapService.update(id, req.user.id, updateEventMapDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить узел нейрокарты вместе с потомками' })
  @ApiResponse({
    status: 204,
    description: 'Узел удален',
  })
  async deleteEventMap(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<void> {
    await this.eventMapService.delete(id, req.user.id);
  }
}
