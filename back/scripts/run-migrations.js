#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('==========================================');
console.log('=== Running Database Migrations ===');
console.log('==========================================\n');

if (process.env.SKIP_MIGRATIONS === 'true') {
  console.log('⚠️  Skipping migrations (SKIP_MIGRATIONS=true)');
  process.exit(0);
}

try {
  const appRoot = path.join(__dirname, '../');
  console.log(`Working directory: ${appRoot}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}\n`);

  // Check if migrations directory exists
  const migrationsPath = path.join(appRoot, 'prisma/migrations');
  const hasMigrations = fs.existsSync(migrationsPath) && 
                       fs.readdirSync(migrationsPath).length > 0;

  if (hasMigrations) {
    console.log('Found migrations directory, running migrate deploy...');
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
} catch (error) {
  console.error('\n❌ ERROR: Database migration failed!');
  console.error(`Error: ${error.message}`);
  console.error('\nApplication will continue, but database operations may fail.\n');
  // Don't exit with error - let the app start anyway
}
