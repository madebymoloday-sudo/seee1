# Скрипты для управления проектом

## make-admin.ts

Скрипт для назначения пользователя администратором.

### Использование

```bash
# Через npm скрипт (рекомендуется)
npm run make-admin <username|email|userId>

# Или напрямую через ts-node
npx ts-node -r tsconfig-paths/register scripts/make-admin.ts <username|email|userId>
```

### Примеры

```bash
# По email
npm run make-admin user@example.com

# По username
npm run make-admin username123

# По userId
npm run make-admin USER1234
```

### Альтернативные способы

#### 1. Через Prisma Studio (GUI)

1. Запустите Prisma Studio:
   ```bash
   npm run prisma:studio
   ```

2. Откройте таблицу `users`
3. Найдите нужного пользователя
4. Измените поле `role` с `user` на `admin`
5. Сохраните изменения

#### 2. Через SQL запрос

Подключитесь к базе данных и выполните:

```sql
-- По email
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';

-- По username
UPDATE users SET role = 'admin' WHERE username = 'username123';

-- По userId
UPDATE users SET role = 'admin' WHERE user_id = 'USER1234';
```

#### 3. Через Prisma CLI (интерактивно)

```bash
# Запустите Prisma Studio
npm run prisma:studio

# Или используйте Prisma Client напрямую в Node.js REPL
npx ts-node
```

Затем в REPL:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

await prisma.user.update({
  where: { email: 'user@example.com' },
  data: { role: 'admin' }
});
```

### Проверка прав администратора

После назначения роли администратора, пользователь сможет:
- Доступ к эндпоинтам, защищенным `@UseGuards(AdminGuard)`
- Просмотр и управление pipeline программами других пользователей
- Другие административные функции

### Важно

- После изменения роли пользователю нужно **перелогиниться** (получить новый JWT токен), чтобы изменения вступили в силу
- Роль проверяется через `AdminGuard` в защищенных эндпоинтах

