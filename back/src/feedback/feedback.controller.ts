import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFeedbackDto, FeedbackItemDto, UpdateFeedbackDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать обратную связь' })
  @ApiResponse({ status: 201, type: FeedbackItemDto })
  async create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateFeedbackDto,
  ): Promise<FeedbackItemDto> {
    return this.feedbackService.create(req.user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить мою обратную связь' })
  @ApiResponse({ status: 200, type: [FeedbackItemDto] })
  async my(
    @Request() req: { user: { id: string } },
    @Query('sessionOnly') sessionOnly?: string,
  ): Promise<FeedbackItemDto[]> {
    return this.feedbackService.my(req.user.id, {
      sessionOnly: sessionOnly === '1' || sessionOnly === 'true',
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить мою обратную связь' })
  @ApiResponse({ status: 200, type: FeedbackItemDto })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ): Promise<FeedbackItemDto> {
    return this.feedbackService.update(req.user.id, id, dto);
  }
}

