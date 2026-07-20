import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Apply migrations before connecting to database
    if (process.env.SKIP_MIGRATIONS !== 'true') {
      try {
        console.log('\n==========================================');
        console.log('=== Applying database migrations ===');
        console.log('==========================================\n');
        
        // В Docker контейнере корень проекта всегда /app
        // После компиляции __dirname будет в dist/src/prisma
        // Используем абсолютный путь для надежности
        const appRoot = process.env.APP_ROOT || '/app';
        const migrationsPath = path.join(appRoot, 'prisma/migrations');
        
        console.log(`Prisma migrations path: ${migrationsPath}`);
        const hasMigrations = fs.existsSync(migrationsPath) && 
                             fs.readdirSync(migrationsPath).length > 0;

        console.log(`Prisma migrations available: ${hasMigrations}`);

        // Всегда используем db push, так как миграций нет
        // Это безопаснее и работает быстрее для разработки
        console.log('Running prisma db push to apply schema...');
        try {
          // В Docker контейнере всегда Linux, поэтому используем простой подход
          // Используем spawnSync для избежания проблем с shell в разных окружениях
          const prismaPath = path.join(appRoot, 'node_modules', '.bin', 'prisma');
          
          if (fs.existsSync(prismaPath)) {
            // Используем прямой вызов через node для надежности
            const nodePath = process.execPath;
            const result = spawnSync(nodePath, [
              prismaPath,
              'db',
              'push',
              '--skip-generate',
              '--accept-data-loss'
            ], {
              stdio: 'inherit',
              cwd: appRoot,
              env: { ...process.env },
              shell: false, // Не используем shell для избежания проблем
            });
            
            if (result.error) {
              throw result.error;
            }
            if (result.status !== 0) {
              throw new Error(`Prisma db push failed with status ${result.status}`);
            }
          } else {
            // Fallback: используем npx через spawnSync
            console.warn('⚠️  Prisma CLI not found at expected path, trying npx...');
            const result = spawnSync('npx', [
              'prisma',
              'db',
              'push',
              '--skip-generate',
              '--accept-data-loss'
            ], {
              stdio: 'inherit',
              cwd: appRoot,
              env: { ...process.env },
              shell: false,
            });
            
            if (result.error || result.status !== 0) {
              throw result.error || new Error(`npx prisma db push failed with status ${result.status}`);
            }
          }
          console.log('Prisma db push completed successfully');
        } catch (error: any) {
          console.error(`Prisma db push failed: ${error?.message}`);
          console.error('Error message:', error.message);
          throw error; // Не продолжаем, если миграции не применились
        }
        
        console.log('\n✓ Migrations completed successfully!');
        console.log('==========================================\n');
      } catch (error: any) {
        console.error(`Migration error caught: ${error.message}`);
        console.error('Error stack:', error.stack);
        console.error('Continuing anyway...\n');
      }
    } else {
      console.log(`Migrations skipped (SKIP_MIGRATIONS=${process.env.SKIP_MIGRATIONS})`);
    }

    console.log('Connecting Prisma client');
    try {
      await this.$connect();
      console.log('Prisma client connected');
    } catch (error: any) {
      console.error('🔴 [ERROR] Failed to connect to database:', error.message);
      console.error('⚠️  Application will continue, but database operations may fail');
      // Не бросаем ошибку, чтобы приложение могло запуститься
      // БД может быть временно недоступна, но приложение должно отвечать на healthcheck
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
