# Seed администраторов

Скрипт для автоматического создания администраторов в базе данных.

## Использование

### Запуск seed

```bash
cd back
npm run prisma:seed
```

Или через Prisma CLI:

```bash
cd back
npx prisma db seed
```

## Добавление новых администраторов

Откройте файл `prisma/seed.ts` и добавьте нового администратора в массив `admins`:

```typescript
const admins = [
  {
    email: "effectcor@gmail.com",
    password: "testtest",
    username: "effectcor",
    fullName: "Effectcor Admin",
  },
  {
    email: "gulopavel@gmail.com",
    password: "testtest",
    username: "gulopavel",
    fullName: "Gulopavel Admin",
  },
  // Добавьте нового администратора:
  {
    email: "newadmin@example.com",
    password: "password123",
    username: "newadmin",
    fullName: "New Admin Name",
  },
];
```

Затем запустите seed снова:

```bash
npm run prisma:seed
```

## Поведение скрипта

- **Если пользователь не существует**: создается новый администратор с указанными данными
- **Если пользователь существует, но не админ**: роль обновляется на `admin`
- **Если пользователь уже админ**: пропускается с сообщением

## Текущие администраторы

- `effectcor@gmail.com` / `effectcor` - пароль: `testtest`
- `gulopavel@gmail.com` / `gulopavel` - пароль: `testtest`

## Важно

- Пароли хешируются с помощью bcrypt (12 раундов)
- Для каждого администратора автоматически создается баланс (0)
- Генерируется уникальный `userId` (8 символов в верхнем регистре)
- После создания администратора нужно перелогиниться, чтобы получить новый JWT токен с ролью `admin`

