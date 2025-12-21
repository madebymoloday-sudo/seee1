# Схема базы данных SEEE

## Обзор

База данных PostgreSQL для системы AI-психолога с сессиями, нейрокартой и обратной связью.

## Технологии

- **ORM**: Prisma
- **БД**: PostgreSQL
- **Миграции**: Prisma Migrate

---

## Таблицы

### 1. users - Пользователи

Основная таблица пользователей системы.

```prisma
model User {
  id            String   @id @default(uuid())
  username      String   @unique
  email         String?  @unique
  passwordHash  String   @map("password_hash")
  googleId      String?  @unique @map("google_id")
  telegramId    String?  @unique @map("telegram_id")
  fullName      String?  @map("full_name")
  language      String   @default("ru")
  userId        String?  @unique @map("user_id")

  sessions           Session[]
  messages           Message[]
  eventMap           EventMap[]
  beforeAfterBeliefs BeforeAfterBelief[]
  feedback           Feedback[]
  rootBeliefs        RootBelief[]
  sessionJournal     SessionJournal[]
  interestingThoughts InterestingThought[]
  balances           Balance[]
  transactions       Transaction[]
  paymentDetails     PaymentDetails?
  refreshTokens      RefreshToken[]
  subscription       Subscription?

  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

**Поля:**

- `id` - UUID первичный ключ
- `username` - уникальное имя пользователя
- `email` - email (опционально)
- `passwordHash` - хеш пароля (bcrypt)
- `googleId` - ID для Google OAuth
- `telegramId` - ID для Telegram авторизации
- `fullName` - полное имя
- `language` - язык интерфейса (по умолчанию 'ru')
- `userId` - внешний идентификатор пользователя

---

### 2. sessions - Сессии психолога

Сессии диалога пользователя с AI-психологом.

```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  title     String?

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  Message[]
  conceptHierarchies ConceptHierarchy[]
  beforeAfterBeliefs BeforeAfterBelief[]
  feedback  Feedback[]
  rootBeliefs RootBelief[]
  sessionJournal SessionJournal[]
  interestingThoughts InterestingThought[]
  gptStatistics GptStatistics?

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("sessions")
}
```

**Поля:**

- `id` - UUID первичный ключ
- `userId` - ID пользователя
- `title` - название сессии (генерируется автоматически или задается пользователем)

---

### 3. messages - Сообщения

Сообщения в сессиях (пользователь и AI).

```prisma
model Message {
  id        String   @id @default(uuid())
  sessionId String   @map("session_id")
  role      String   // 'user' | 'assistant'
  content   String

  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  timestamp DateTime @default(now())

  @@index([sessionId])
  @@index([sessionId, timestamp]) // Составной индекс для cursor pagination
  @@map("messages")
}
```

**Поля:**

- `id` - UUID первичный ключ
- `sessionId` - ID сессии
- `role` - роль отправителя ('user' или 'assistant')
- `content` - текст сообщения
- `timestamp` - время отправки

---

### 4. event_map - Нейрокарта

Структурированные данные для карты "Карта не территория".

```prisma
model EventMap {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  eventNumber Int      @map("event_number")
  event       String
  emotion     String
  idea        String
  isCompleted Boolean  @default(false) @map("is_completed")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("event_map")
}
```

**Поля:**

- `id` - UUID первичный ключ
- `userId` - ID пользователя
- `eventNumber` - номер события
- `event` - описание события
- `emotion` - эмоция, вызванная событием
- `idea` - идея/мысль, связанная с событием
- `isCompleted` - флаг завершения обработки

---

### 5. before_after_beliefs - Убеждения "До/После"

Отслеживание трансформации убеждений.

```prisma
model BeforeAfterBelief {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  sessionId   String?  @map("session_id")
  beliefBefore String  @map("belief_before")
  beliefAfter  String? @map("belief_after")
  isTask      Boolean  @default(false) @map("is_task")
  circleNumber Int?    @map("circle_number")
  circleName   String? @map("circle_name")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  session     Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([sessionId])
  @@map("before_after_beliefs")
}
```

---

### 6. balances - Балансы пользователей

Текущий баланс каждого пользователя.

```prisma
model Balance {
  id        String   @id @default(uuid())
  userId    String   @unique @map("user_id")
  amount    Decimal  @default(0) @db.Decimal(10, 2)

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("balances")
}
```

---

### 7. transactions - Транзакции

История всех финансовых операций.

```prisma
enum TransactionType {
  PAYMENT
  WITHDRAWAL
}

model Transaction {
  id              String          @id @default(uuid())
  userId          String          @map("user_id")
  amount          Decimal         @db.Decimal(10, 2)
  transactionType TransactionType @map("transaction_type")
  description     String?

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt       DateTime        @default(now()) @map("created_at")

  @@index([userId])
  @@index([fromUserId])
  @@map("transactions")
}
```

---

### 8. root_beliefs - Корневые установки

Выявленные корневые убеждения пользователя.

```prisma
enum RootBeliefStatus {
  IDENTIFIED
  TRANSFORMED
  COMPLETED
}

model RootBelief {
  id            String            @id @default(uuid())
  userId        String            @map("user_id")
  sessionId     String?           @map("session_id")
  circleNumber  Int               @map("circle_number")
  circleName    String            @map("circle_name")
  negativeBelief String           @map("negative_belief")
  positiveBelief String?          @map("positive_belief")
  isTask        Boolean           @default(false) @map("is_task")
  status        RootBeliefStatus   @default(IDENTIFIED)

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  session       Session?          @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  @@index([userId])
  @@index([sessionId])
  @@map("root_beliefs")
}
```

---

### 9. feedback - Обратная связь

Отзывы и баг-репорты от пользователей.

```prisma
enum FeedbackType {
  FULL
  QUICK
}

enum FeedbackStatus {
  NEW
  IN_PROGRESS
  RESOLVED
}

model Feedback {
  id          String         @id @default(uuid())
  userId      String         @map("user_id")
  sessionId   String?        @map("session_id")
  description String
  filePath    String?        @map("file_path")
  fileType    String?        @map("file_type")
  feedbackType FeedbackType  @default(FULL) @map("feedback_type")
  status      FeedbackStatus @default(NEW)

  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  session     Session?       @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  files       FeedbackFile[]

  createdAt   DateTime       @default(now()) @map("created_at")

  @@index([userId])
  @@index([status])
  @@map("feedback")
}
```

---

### 10. feedback_files - Файлы обратной связи

Множественные файлы для одного отзыва.

```prisma
model FeedbackFile {
  id          String   @id @default(uuid())
  feedbackId String   @map("feedback_id")
  filePath   String   @map("file_path")
  fileType   String?  @map("file_type")

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now()) @map("created_at")

  @@index([feedbackId])
  @@map("feedback_files")
}
```

---

### 11. concept_hierarchies - Системы убеждений

Иерархии концепций, построенные AI.

```prisma
model ConceptHierarchy {
  id          String   @id @default(uuid())
  sessionId   String   @map("session_id")
  conceptData Json     @map("concept_data") // JSON структура концепций

  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now()) @map("created_at")

  @@index([sessionId])
  @@map("concept_hierarchies")
}
```

---

### 12. session_journal - Журнал сессий

Записи пользователя о сессиях.

```prisma
model SessionJournal {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  sessionId         String?  @map("session_id")
  dateTime          DateTime @map("date_time")
  feelingAfter      String?  @map("feeling_after")
  emotionAfter      String?  @map("emotion_after")
  howSessionWent    String?  @map("how_session_went")
  interestingThoughts String? @map("interesting_thoughts")

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  session           Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  createdAt         DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([sessionId])
  @@map("session_journal")
}
```

---

### 13. interesting_thoughts - Интересные мысли

Выделенные пользователем важные мысли.

```prisma
model InterestingThought {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  sessionId   String?  @map("session_id")
  thoughtNumber Int     @map("thought_number")
  title       String
  thoughtText String   @map("thought_text")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  session     Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([sessionId])
  @@map("interesting_thoughts")
}
```

---

### 14. gpt_statistics - Статистика GPT

Метрики работы AI-психолога.

```prisma
model GptStatistics {
  id                      String   @id @default(uuid())
  sessionId               String   @unique @map("session_id")
  userId                  String   @map("user_id")
  messageCount            Int      @default(0) @map("message_count")
  avgResponseTime         Float?   @map("avg_response_time")
  userSatisfactionScore   Float?   @map("user_satisfaction_score")
  difficultyEncountered    Int      @default(0) @map("difficulty_encountered")
  rootBeliefsIdentified    Int      @default(0) @map("root_beliefs_identified")
  positiveTransformations Int      @default(0) @map("positive_transformations")

  session                 Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  @@map("gpt_statistics")
}
```

---

### 15. payment_details - Реквизиты для выплат

Данные для выплат.

```prisma
model PaymentDetails {
  id          String   @id @default(uuid())
  userId      String   @unique @map("user_id")
  fullName    String?  @map("full_name")
  phone       String?
  birthDate   DateTime? @map("birth_date") @db.Date
  inn         String?
  paymentForm String?  @map("payment_form")
  detailsJson Json?    @map("details_json")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("payment_details")
}
```

---

### 16. refresh_tokens - Refresh токены

Таблица для хранения refresh токенов пользователей.

```prisma
model RefreshToken {
  id        String   @id
  token     String   @unique
  userId    String   @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

**Поля:**

- `id` - уникальный идентификатор токена (hex, 64 символа)
- `token` - хеш токена (hex, 128 символов, уникальный)
- `userId` - ID пользователя
- `expiresAt` - время истечения токена
- `createdAt` - время создания

**Индексы:**

- `userId` - для быстрого поиска токенов пользователя
- `expiresAt` - для очистки истекших токенов (cron job)

**Особенности:**

- При обновлении токенов старый refresh token удаляется
- При удалении пользователя все его refresh tokens удаляются (Cascade)
- Рекомендуется периодически очищать истекшие токены

---

## Индексы

### Производительность

```prisma
// В Prisma индексы создаются через @@index
// Примеры уже включены в модели выше

// Дополнительные составные индексы для частых запросов:
// - Поиск сессий пользователя: sessions(userId, createdAt)
// - Поиск сообщений в сессии: messages(sessionId, timestamp)
```

---

## Миграции

### Правила миграций

1. **Всегда используйте Prisma Migrate** для создания миграций
2. **Не удаляйте данные** без явного указания
3. **Тестируйте миграции** на копии production данных
4. **Используйте транзакции** для сложных миграций

### Пример миграции

```bash
# Создать новую миграцию
npx prisma migrate dev --name add_feedback_status

# Применить миграцию в production
npx prisma migrate deploy
```

---

## Связи и каскады

### Правила удаления

- **Cascade**: При удалении пользователя удаляются все связанные данные
- **SetNull**: При удалении сессии связанные данные остаются, но `sessionId` становится `null`
- **Restrict**: Запрет удаления при наличии связанных записей

### Примеры

```prisma
// Cascade - удаление пользователя удаляет все его сессии
user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

// SetNull - удаление сессии не удаляет мысли, но обнуляет sessionId
session   Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
```

---

## Типы данных

### PostgreSQL типы

- `String` → `TEXT` / `VARCHAR`
- `Int` → `INTEGER`
- `Decimal` → `DECIMAL(10, 2)`
- `Boolean` → `BOOLEAN`
- `DateTime` → `TIMESTAMP`
- `Json` → `JSONB` (рекомендуется для JSON полей)

### UUID vs Integer

- **UUID** для всех первичных ключей (безопасность, масштабируемость)
- **Integer** только для счетчиков и номеров (eventNumber, thoughtNumber)

---

## Примеры запросов

### Prisma Client

```typescript
// Получить пользователя с сессиями
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    sessions: {
      orderBy: { createdAt: "desc" },
      take: 10,
    },
  },
});

// Получить сессию с сообщениями
const session = await prisma.session.findUnique({
  where: { id: sessionId },
  include: {
    messages: {
      orderBy: { timestamp: "asc" },
    },
    user: {
      select: { id: true, username: true },
    },
  },
});

```

---

## Безопасность

### Рекомендации

1. **Хеширование паролей**: Используйте bcrypt с солью
2. **Валидация данных**: На уровне DTO и Prisma
3. **Индексы**: Для всех внешних ключей и часто запрашиваемых полей
4. **Транзакции**: Для операций, затрагивающих несколько таблиц
5. **Мягкое удаление**: Рассмотрите `deletedAt` для критичных данных

---

## Версионирование схемы

### Правила

1. **Не удаляйте колонки** - помечайте как deprecated
2. **Добавляйте новые поля** как nullable
3. **Миграции данных** выполняйте отдельными скриптами
4. **Документируйте изменения** в CHANGELOG.md
