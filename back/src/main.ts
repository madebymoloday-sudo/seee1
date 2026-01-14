// Apply migrations BEFORE any imports to ensure they run
import { execSync } from 'child_process';
import * as path from 'path';

// Force immediate execution - log to stderr to ensure it's visible
process.stderr.write('📦 MIGRATIONS: main.ts loaded\n');
process.stderr.write(`📦 MIGRATIONS: __dirname = ${__dirname}\n`);

if (process.env.SKIP_MIGRATIONS !== 'true') {
  try {
    process.stderr.write('📦 MIGRATIONS: Starting...\n');
    const appRoot = path.join(__dirname, '../..');
    process.stderr.write(`📦 MIGRATIONS: appRoot = ${appRoot}\n`);
    process.stderr.write(`📦 MIGRATIONS: DATABASE_URL = ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}\n`);
    
    // Always try db push first (simpler and more reliable)
    process.stderr.write('📦 MIGRATIONS: Running prisma db push...\n');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { 
      stdio: 'inherit',
      cwd: appRoot,
      env: { ...process.env }
    });
    
    process.stderr.write('📦 MIGRATIONS: Completed successfully!\n');
  } catch (error: any) {
    process.stderr.write(`📦 MIGRATIONS: ERROR - ${error.message}\n`);
    process.stderr.write('📦 MIGRATIONS: Continuing anyway...\n');
  }
} else {
  process.stderr.write('📦 MIGRATIONS: Skipped (SKIP_MIGRATIONS=true)\n');
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  console.log('🚀 Starting NestJS application...\n');
  
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
    .addTag('Subscription', 'Подписка и оплата')
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

