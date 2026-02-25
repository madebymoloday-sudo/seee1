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

## Аккаунты с бесплатным доступом (без подписки)

В `seed.ts` есть массив `freeAccessUsers`. При запуске seed для каждого такого пользователя:
- если аккаунта нет — создаётся с подпиской ACTIVE (доступ без оплаты);
- если аккаунт есть — подписка и **пароль** обновляются до значений из seed (логин: email из списка, пароль из поля `password`).

Данные для входа выводятся в консоль (временный пароль можно сменить в личном кабинете).

**Если пользователь не может войти** (например, Skorpio_tanya@mail.ru): запустите seed на сервере — пароль будет сброшен на указанный в `freeAccessUsers` (для Тани: `SeeeTanya25!`). Вход: email как в seed, пароль из seed.

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

