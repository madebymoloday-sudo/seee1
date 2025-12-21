import {
  Controller,
  Get,
  Post,
  Put,
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
import { PipelineService } from './pipeline.service';
import {
  CreatePipelineDto,
  UpdatePipelineDto,
  PipelineResponseDto,
} from './dto/pipeline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('Pipelines')
@Controller('pipelines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Создать новый пайплайн (только для админов)' })
  @ApiResponse({
    status: 201,
    description: 'Пайплайн успешно создан',
    type: PipelineResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Доступ только для администраторов' })
  async create(
    @Request() req: { user: { id: string } },
    @Body() createPipelineDto: CreatePipelineDto,
  ): Promise<PipelineResponseDto> {
    return this.pipelineService.create(req.user.id, createPipelineDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить все пайплайны пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Список пайплайнов',
    type: [PipelineResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  async findAll(
    @Request() req: { user: { id: string } },
  ): Promise<PipelineResponseDto[]> {
    return this.pipelineService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить пайплайн по ID' })
  @ApiResponse({
    status: 200,
    description: 'Пайплайн найден',
    type: PipelineResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Нет доступа к пайплайну' })
  @ApiResponse({ status: 404, description: 'Пайплайн не найден' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ): Promise<PipelineResponseDto> {
    return this.pipelineService.findOne(req.user.id, id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Обновить пайплайн (только для админов)' })
  @ApiResponse({
    status: 200,
    description: 'Пайплайн успешно обновлен',
    type: PipelineResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Доступ только для администраторов' })
  @ApiResponse({ status: 404, description: 'Пайплайн не найден' })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updatePipelineDto: UpdatePipelineDto,
  ): Promise<PipelineResponseDto> {
    return this.pipelineService.update(req.user.id, id, updatePipelineDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Удалить пайплайн (только для админов)' })
  @ApiResponse({
    status: 204,
    description: 'Пайплайн успешно удален',
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({ status: 403, description: 'Доступ только для администраторов' })
  @ApiResponse({ status: 404, description: 'Пайплайн не найден' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ): Promise<void> {
    return this.pipelineService.remove(req.user.id, id);
  }
}

