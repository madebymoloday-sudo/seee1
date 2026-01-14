import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('🔵 PrismaService.onModuleInit called');
    console.log(`🔵 SKIP_MIGRATIONS = ${process.env.SKIP_MIGRATIONS}`);
    
    // Apply migrations before connecting to database
    if (process.env.SKIP_MIGRATIONS !== 'true') {
      try {
        console.log('\n==========================================');
        console.log('=== Applying database migrations ===');
        console.log('==========================================\n');
        
        // После компиляции __dirname будет в dist/src/prisma
        // Нужно подняться на 3 уровня вверх, чтобы попасть в корень проекта
        const appRoot = path.join(__dirname, '../../..');
        const migrationsPath = path.join(appRoot, 'prisma/migrations');
        
        console.log(`🔵 __dirname: ${__dirname}`);
        console.log(`🔵 appRoot: ${appRoot}`);
        console.log(`🔵 migrationsPath: ${migrationsPath}`);
        const hasMigrations = fs.existsSync(migrationsPath) && 
                             fs.readdirSync(migrationsPath).length > 0;

        if (hasMigrations) {
          console.log('Found migrations, running migrate deploy...');
          try {
            execSync('npx prisma migrate deploy', { 
              stdio: 'inherit',
              cwd: appRoot,
              env: { ...process.env }
            });
          } catch (error) {
            console.log('migrate deploy failed, trying db push...');
            execSync('npx prisma db push --skip-generate --accept-data-loss', { 
              stdio: 'inherit',
              cwd: appRoot,
              env: { ...process.env }
            });
          }
        } else {
          console.log('No migrations found, running db push...');
          execSync('npx prisma db push --skip-generate --accept-data-loss', { 
            stdio: 'inherit',
            cwd: appRoot,
            env: { ...process.env }
          });
        }
        
        console.log('\n✓ Migrations completed successfully!');
        console.log('==========================================\n');
      } catch (error: any) {
        console.error('\n❌ Migration error:', error.message);
        console.error('Continuing anyway...\n');
      }
    }
    
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

