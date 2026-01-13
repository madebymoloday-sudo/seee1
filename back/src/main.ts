import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  if (process.env.SKIP_MIGRATIONS === 'true') {
    console.log('⚠️  Skipping migrations (SKIP_MIGRATIONS=true)');
    return;
  }

  // Используем process.stdout.write для гарантированного вывода
  process.stdout.write('\n');
  process.stdout.write('==========================================\n');
  process.stdout.write('=== Applying database migrations ===\n');
  process.stdout.write('==========================================\n');
  process.stdout.write('\n');

  try {
    // Проверяем наличие DATABASE_URL
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set!');
    }
    process.stdout.write('✓ DATABASE_URL is set\n');

    // Проверяем наличие Prisma schema
    const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Prisma schema not found at ${schemaPath}`);
    }
    process.stdout.write('✓ Prisma schema found\n');

    // Проверяем наличие папки migrations
    const migrationsPath = path.join(__dirname, '../../prisma/migrations');
    const hasMigrations = fs.existsSync(migrationsPath) && 
                         fs.readdirSync(migrationsPath).length > 0;

    const appRoot = path.join(__dirname, '../..');
    process.stdout.write(`Working directory: ${appRoot}\n`);

    if (hasMigrations) {
      process.stdout.write('Found migrations directory, running migrate deploy...\n');
      try {
        execSync('npx prisma migrate deploy', { 
          stdio: 'inherit',
          cwd: appRoot,
          env: { ...process.env },
          shell: '/bin/sh'
        });
      } catch (migrateError: any) {
        process.stdout.write('WARNING: migrate deploy failed, trying db push...\n');
        execSync('npx prisma db push --skip-generate --accept-data-loss', { 
          stdio: 'inherit',
          cwd: appRoot,
          env: { ...process.env },
          shell: '/bin/sh'
        });
      }
    } else {
      process.stdout.write('No migrations directory found, using db push...\n');
      execSync('npx prisma db push --skip-generate --accept-data-loss', { 
        stdio: 'inherit',
        cwd: appRoot,
        env: { ...process.env },
        shell: '/bin/sh'
      });
    }

    process.stdout.write('\n');
    process.stdout.write('✓ Database migrations completed successfully!\n');
    process.stdout.write('==========================================\n');
    process.stdout.write('\n');
  } catch (error: any) {
    process.stderr.write('\n');
    process.stderr.write('❌ ERROR: Database migration failed!\n');
    process.stderr.write(`Error details: ${error.message || error}\n`);
    if (error.stdout) process.stderr.write(`stdout: ${error.stdout.toString()}\n`);
    if (error.stderr) process.stderr.write(`stderr: ${error.stderr.toString()}\n`);
    process.stderr.write('\n');
    process.stderr.write('Application will continue, but database operations may fail.\n');
    process.stderr.write('Please check DATABASE_URL and database connectivity.\n');
    process.stderr.write('\n');
  }
}

async function bootstrap() {
  // Применяем миграции перед запуском приложения
  process.stdout.write('\n🚀 Starting bootstrap process...\n');
  process.stdout.write(`Current working directory: ${process.cwd()}\n`);
  process.stdout.write(`__dirname: ${__dirname}\n`);
  await runMigrations();
  process.stdout.write('✅ Migrations completed, creating NestJS app...\n');
  
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

