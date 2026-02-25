import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:9',message:'onModuleInit ENTRY',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('🔵 [DEBUG-HYP-A] PrismaService.onModuleInit called');
    console.log(`🔵 [DEBUG-HYP-B] SKIP_MIGRATIONS = ${process.env.SKIP_MIGRATIONS}`);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:14',message:'SKIP_MIGRATIONS check',data:{skipMigrations:process.env.SKIP_MIGRATIONS,willSkip:process.env.SKIP_MIGRATIONS==='true'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
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
        
        console.log(`🔵 __dirname: ${__dirname}`);
        console.log(`🔵 appRoot: ${appRoot}`);
        console.log(`🔵 migrationsPath: ${migrationsPath}`);
        console.log(`🔵 migrationsPath exists: ${fs.existsSync(migrationsPath)}`);
        const hasMigrations = fs.existsSync(migrationsPath) && 
                             fs.readdirSync(migrationsPath).length > 0;

        console.log(`🔵 hasMigrations: ${hasMigrations}`);

        // Всегда используем db push, так как миграций нет
        // Это безопаснее и работает быстрее для разработки
        console.log(`🔵 [DEBUG-HYP-C] BEFORE execSync db push | appRoot: ${appRoot} | hasDbUrl: ${!!process.env.DATABASE_URL}`);
        console.log('Running prisma db push to apply schema...');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:37',message:'BEFORE execSync db push',data:{appRoot,hasDbUrl:!!process.env.DATABASE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:95',message:'AFTER spawnSync db push SUCCESS',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.log(`🔵 [DEBUG-HYP-D] db push SUCCESS`);
        } catch (error: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:100',message:'spawnSync db push ERROR',data:{errorMessage:error?.message,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.error(`🔴 [DEBUG-HYP-D] db push FAILED! | error: ${error?.message} | code: ${error?.code}`);
          console.error('Error message:', error.message);
          throw error; // Не продолжаем, если миграции не применились
        }
        
        console.log('\n✓ Migrations completed successfully!');
        console.log('==========================================\n');
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:56',message:'Migration error caught (outer catch)',data:{errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.error(`🔴 [DEBUG-HYP-E] Migration error caught (outer catch): ${error.message}`);
        console.error('Error stack:', error.stack);
        console.error('Continuing anyway...\n');
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:62',message:'Migrations SKIPPED',data:{skipMigrations:process.env.SKIP_MIGRATIONS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.log(`🔵 [DEBUG-HYP-B] Migrations SKIPPED (SKIP_MIGRATIONS=${process.env.SKIP_MIGRATIONS})`);
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:65',message:'BEFORE $connect',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.log('🔵 [DEBUG-HYP-F] BEFORE $connect');
    try {
      await this.$connect();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.service.ts:66',message:'AFTER $connect',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.log('🔵 [DEBUG-HYP-F] AFTER $connect - SUCCESS');
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

