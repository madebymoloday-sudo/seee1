import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { execSync } from 'child_process';
import * as path from 'path';

async function bootstrap() {
  console.log('🚀 Starting NestJS application...\n');
  
  // КРИТИЧЕСКИ ВАЖНО: Применяем миграции ПЕРЕД созданием приложения
  if (process.env.SKIP_MIGRATIONS !== 'true') {
    try {
      console.log('🔵 [MIGRATION] Applying database schema BEFORE app creation...');
      const appRoot = process.env.APP_ROOT || '/app';
      console.log(`🔵 [MIGRATION] appRoot: ${appRoot}`);
      
      const output = execSync('npx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'inherit',
        cwd: appRoot,
        env: { ...process.env },
        encoding: 'utf-8'
      });
      console.log('🔵 [MIGRATION] ✓ Database schema applied successfully!');
    } catch (error: any) {
      console.error('🔴 [MIGRATION] ❌ CRITICAL: Database migration failed!');
      console.error('🔴 [MIGRATION] Error:', error.message);
      console.error('🔴 [MIGRATION] stdout:', error.stdout);
      console.error('🔴 [MIGRATION] stderr:', error.stderr);
      // НЕ продолжаем, если миграции не применились
      process.exit(1);
    }
  } else {
    console.log('🔵 [MIGRATION] Skipped (SKIP_MIGRATIONS=true)');
  }
  
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('SEEE API')
    .setDescription('API для системы AI-психолога')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Аутентификация и авторизация')
    .addTag('Sessions', 'Сессии психолога')
    .addTag('Messages', 'Сообщения')
    .addTag('EventMap', 'Нейрокарта')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Export JSON schema for Orval
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api-json', (_req: any, res: any) => {
    res.json(document);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log('');
  console.log('🚀 SEEE Backend успешно запущен!');
  console.log(`📍 Application: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`📋 API JSON: http://localhost:${port}/api-json`);
  console.log('');

  // Проверяем доступность LLM после старта (асинхронно, чтобы не блокировать запуск)
  try {
    const { PipelineService } = await import('./psychologist/pipeline/pipeline.service');
    const pipelineService = app.get(PipelineService);
    if (pipelineService && typeof pipelineService.checkLLMAvailability === 'function') {
      // Небольшая задержка для полной инициализации
      setTimeout(async () => {
        await pipelineService.checkLLMAvailability();
      }, 1000);
    }
  } catch (error) {
    // Игнорируем ошибки при получении сервисов
  }
}

bootstrap();

