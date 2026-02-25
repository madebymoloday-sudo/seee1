import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePipelineDto,
  UpdatePipelineDto,
  PipelineResponseDto,
} from './dto/pipeline.dto';

@Injectable()
export class PipelineService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createPipelineDto: CreatePipelineDto,
  ): Promise<PipelineResponseDto> {
    // Если устанавливаем как дефолтный, снимаем флаг с других пайплайнов пользователя
    if (createPipelineDto.isDefault) {
      await this.prisma.pipelineProgram.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const pipeline = await this.prisma.pipelineProgram.create({
      data: {
        userId,
        name: createPipelineDto.name,
        version: createPipelineDto.version,
        description: createPipelineDto.description,
        configJson: createPipelineDto.configJson,
        isDefault: createPipelineDto.isDefault ?? false,
      },
    });

    return this.toResponseDto(pipeline);
  }

  async findAll(userId: string): Promise<PipelineResponseDto[]> {
    const pipelines = await this.prisma.pipelineProgram.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return pipelines.map((p) => this.toResponseDto(p));
  }

  async findOne(userId: string, id: string): Promise<PipelineResponseDto> {
    const pipeline = await this.prisma.pipelineProgram.findUnique({
      where: { id },
    });

    if (!pipeline) {
      throw new NotFoundException('Пайплайн не найден');
    }

    if (pipeline.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этому пайплайну');
    }

    return this.toResponseDto(pipeline);
  }

  async update(
    userId: string,
    id: string,
    updatePipelineDto: UpdatePipelineDto,
  ): Promise<PipelineResponseDto> {
    const pipeline = await this.prisma.pipelineProgram.findUnique({
      where: { id },
    });

    if (!pipeline) {
      throw new NotFoundException('Пайплайн не найден');
    }

    if (pipeline.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этому пайплайну');
    }

    // Если устанавливаем как дефолтный, снимаем флаг с других пайплайнов пользователя
    if (updatePipelineDto.isDefault === true) {
      await this.prisma.pipelineProgram.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.pipelineProgram.update({
      where: { id },
      data: {
        name: updatePipelineDto.name,
        version: updatePipelineDto.version,
        description: updatePipelineDto.description,
        configJson: updatePipelineDto.configJson,
        isDefault: updatePipelineDto.isDefault,
      },
    });

    return this.toResponseDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const pipeline = await this.prisma.pipelineProgram.findUnique({
      where: { id },
    });

    if (!pipeline) {
      throw new NotFoundException('Пайплайн не найден');
    }

    if (pipeline.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этому пайплайну');
    }

    await this.prisma.pipelineProgram.delete({
      where: { id },
    });
  }

  private toResponseDto(pipeline: any): PipelineResponseDto {
    return {
      id: pipeline.id,
      userId: pipeline.userId,
      name: pipeline.name,
      version: pipeline.version,
      description: pipeline.description,
      configJson: pipeline.configJson,
      isDefault: pipeline.isDefault,
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
    };
  }
}

