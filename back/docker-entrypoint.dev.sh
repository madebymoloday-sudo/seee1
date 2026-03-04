#!/bin/sh
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Applying database migrations..."
  npx prisma db push --skip-generate || echo "Migration failed, continuing..."
  if [ "$SKIP_SEED" != "true" ]; then
    echo "Running database seed..."
    npm run prisma:seed || echo "Seed failed, continuing..."
  fi
fi
echo "Starting application in dev mode (watch)..."
exec npm run start:dev

