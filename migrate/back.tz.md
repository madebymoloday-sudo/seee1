# Backend Technical Specification - SEEE

## Технологический стек

- **Framework**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **WebSocket**: Socket.IO
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator, class-transformer
- **Authentication**: JWT (access + refresh tokens)
- **Password Hashing**: bcrypt
- **Telegram Auth**: Telegram Login Widget
- **Google OAuth**: Google Sign-In

---

## Архитектура

### Структура проекта

```
backend/
├── src/
│   ├── main.ts                    # Точка входа
│   ├── app.module.ts              # Корневой модуль
│   ├── prisma/
│   │   └── prisma.service.ts      # Prisma сервис
│   ├── common/                    # Общие утилиты
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── filters/
│   ├── config/                    # Конфигурация
│   ├── auth/                      # Аутентификация
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── telegram-auth.service.ts
│   │   ├── dto/
│   │   │   ├── auth.dto.ts
│   │   │   └── telegram.dto.ts
│   │   ├── guards/
│   │   └── strategies/
│   ├── users/                      # Пользователи
│   ├── sessions/                  # Сессии психолога
│   ├── messages/                  # Сообщения
│   ├── event-map/                 # Нейрокарта
│   ├── psychologist/              # AI психолог
│   ├── websocket/                 # Socket.IO
│   ├── subscription/              # Подписка и оплата
│   │   ├── subscription.controller.ts
│   │   ├── subscription.service.ts
│   │   ├── subscription.guard.ts
│   │   └── dto/
│   └── integrations/              # Внешние интеграции
│       └── lava/                  # Lava API интеграция
│           ├── lava.module.ts
│           ├── lava.service.ts
│           ├── lava.api.ts        # Сгенерированный Orval клиент
│           ├── lava.mutator.ts    # Axios instance для Lava
│           ├── schemas/           # TypeScript типы
│           └── lava.exception.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── orval.config.ts                # Конфигурация Orval
└── test/
```

---

## Правила кодирования

### 1. Структура модуля

Каждый модуль должен содержать:

```typescript
// sessions/sessions.module.ts
import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService], // Если используется в других модулях
})
export class SessionsModule {}
```

### 2. Контроллеры

**Правила:**

- Используйте декораторы Swagger для всех эндпоинтов
- Валидация через DTO
- Обработка ошибок через Exception Filters
- JWT Guard для защищенных роутов

**Пример:**

```typescript
// sessions/sessions.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SessionsService } from "./sessions.service";
import { CreateSessionDto, SessionResponseDto } from "./dto/session.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Sessions")
@Controller("sessions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Создать новую сессию" })
  @ApiResponse({
    status: 201,
    description: "Сессия успешно создана",
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизованный доступ",
  })
  async createSession(
    @Request() req: { user: { id: string } },
    @Body() createSessionDto: CreateSessionDto
  ): Promise<SessionResponseDto> {
    return this.sessionsService.create(req.user.id, createSessionDto);
  }

  @Get()
  @ApiOperation({ summary: "Получить все сессии пользователя" })
  @ApiResponse({
    status: 200,
    description: "Список сессий",
    type: [SessionResponseDto],
  })
  async getSessions(
    @Request() req: { user: { id: string } }
  ): Promise<SessionResponseDto[]> {
    return this.sessionsService.findAllByUserId(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить сессию по ID" })
  @ApiResponse({
    status: 200,
    description: "Сессия найдена",
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Сессия не найдена",
  })
  async getSession(
    @Param("id") id: string,
    @Request() req: { user: { id: string } }
  ): Promise<SessionResponseDto> {
    return this.sessionsService.findOne(id, req.user.id);
  }
}
```

### 3. Сервисы

**Правила:**

- Вся бизнес-логика в сервисах
- Использование Prisma для работы с БД
- Транзакции для сложных операций
- Обработка ошибок с понятными исключениями

**Пример:**

```typescript
// sessions/sessions.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSessionDto } from "./dto/session.dto";
import { SessionResponseDto } from "./dto/session.dto";

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createSessionDto: CreateSessionDto,
    checkSubscription: boolean = true
  ) {
    // Если требуется подписка - проверяем через SubscriptionService
    // Это делается на уровне Guard, но можно добавить дополнительную проверку здесь

    const session = await this.prisma.session.create({
      data: {
        userId,
        title: createSessionDto.title || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return this.toResponseDto(session);
  }

  async findAllByUserId(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return sessions.map((s) => this.toResponseDto(s));
  }

  async findOne(id: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { timestamp: "asc" },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Сессия не найдена");
    }

    if (session.userId !== userId) {
      throw new ForbiddenException("Нет доступа к этой сессии");
    }

    return this.toResponseDto(session);
  }

  async generateDocument(sessionId: string, userId: string): Promise<string> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        conceptHierarchies: true,
        user: {
          select: { username: true },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new ForbiddenException("Доступ запрещен");
    }

    if (
      !session.conceptHierarchies ||
      session.conceptHierarchies.length === 0
    ) {
      throw new NotFoundException(
        "Нет данных концепций для генерации документа"
      );
    }

    const conceptData = JSON.parse(session.conceptHierarchies[0].conceptData);
    const username = session.user.username || "Пользователь";

    return this.generateMarkdownDocument(conceptData, username);
  }

  async addSessionToMap(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { timestamp: "asc" },
        },
        conceptHierarchies: true,
      },
    });

    if (!session || session.userId !== userId) {
      throw new ForbiddenException("Доступ запрещен");
    }

    // Используем GPT для преобразования сессии в таблицу Нейрокарты
    const conversationText = session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const conceptData = session.conceptHierarchies[0]
      ? JSON.parse(session.conceptHierarchies[0].conceptData)
      : {};

    // Вызываем psychologist service для анализа через GPT
    const mapEntries = await this.psychologistService.analyzeSessionForMap(
      conversationText,
      conceptData
    );

    // Создаем записи в нейрокарте через eventMapService
    const createdEntries = await Promise.all(
      mapEntries.map((entry: any) =>
        this.eventMapService.create({
          userId,
          event: entry.event,
          emotion: entry.emotion,
          idea: entry.idea,
          rootBelief: entry.root_belief,
        })
      )
    );

    return createdEntries;
  }

  private generateMarkdownDocument(
    conceptData: Record<string, any>,
    username: string
  ): string {
    let document = `# Карта концепций - ${username}\n\n`;
    document += `*Сгенерировано: ${new Date().toLocaleString("ru-RU")}*\n\n`;

    for (const [conceptName, conceptInfo] of Object.entries(conceptData)) {
      document += `## ${conceptName}\n\n`;

      if (conceptInfo.composition) {
        document += `### Состав:\n`;
        conceptInfo.composition.forEach((item: string) => {
          document += `- ${item}\n`;
        });
        document += `\n`;
      }

      if (conceptInfo.founder) {
        document += `### Основатель: ${conceptInfo.founder}\n\n`;
      }

      if (conceptInfo.purpose) {
        document += `### Цель: ${conceptInfo.purpose}\n\n`;
      }

      if (conceptInfo.consequences) {
        document += `### Последствия:\n`;
        if (conceptInfo.consequences.emotional) {
          document += `**Эмоциональные:**\n`;
          conceptInfo.consequences.emotional.forEach((emotion: string) => {
            document += `- ${emotion}\n`;
          });
        }
        if (conceptInfo.consequences.physical) {
          document += `**Физические:**\n`;
          conceptInfo.consequences.physical.forEach((physical: string) => {
            document += `- ${physical}\n`;
          });
        }
        document += `\n`;
      }

      if (conceptInfo.conclusions) {
        document += `### Выводы:\n${conceptInfo.conclusions}\n\n`;
      }

      document += `---\n\n`;
    }

    return document;
  }

  private toResponseDto(session: any): SessionResponseDto {
    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      messageCount: session._count?.messages || 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
```

### 4. DTO (Data Transfer Objects)

**Правила:**

- Валидация через class-validator
- Swagger декораторы для документации
- Отдельные DTO для запросов и ответов

**Пример:**

```typescript
// sessions/dto/session.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsUUID } from "class-validator";

export class CreateSessionDto {
  @ApiProperty({
    description: "Название сессии",
    example: "Тревога перед экзаменом",
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;
}

export class SessionResponseDto {
  @ApiProperty({ description: "ID сессии", example: "uuid" })
  id: string;

  @ApiProperty({ description: "ID пользователя", example: "uuid" })
  userId: string;

  @ApiProperty({
    description: "Название сессии",
    example: "Тревога перед экзаменом",
    nullable: true,
  })
  title: string | null;

  @ApiProperty({ description: "Количество сообщений", example: 10 })
  messageCount: number;

  @ApiProperty({ description: "Дата создания" })
  createdAt: Date;

  @ApiProperty({ description: "Дата обновления" })
  updatedAt: Date;
}
```

---

## Аутентификация

### Telegram Авторизация

#### Обзор

Авторизация через Telegram Login Widget. Пользователь может войти или зарегистрироваться через Telegram, а также привязать Telegram аккаунт к существующему аккаунту.

#### Telegram Auth Service

```typescript
// auth/telegram-auth.service.ts
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac } from "crypto";
import { TelegramAuthPayloadDto } from "./dto/telegram.dto";

export interface ValidatedTelegramAuthPayload {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  authDate: number;
  raw: Record<string, string>;
}

@Injectable()
export class TelegramAuthService {
  private readonly maxAuthAgeSeconds: number;
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(private readonly configService: ConfigService) {
    this.maxAuthAgeSeconds = Number.parseInt(
      this.configService.get<string>("TELEGRAM_LOGIN_MAX_AGE_SECONDS", "600"),
      10
    );
  }

  validatePayload(
    payload: TelegramAuthPayloadDto
  ): ValidatedTelegramAuthPayload {
    const botToken = this.configService.get<string>("TELEGRAM_LOGIN_BOT_TOKEN");

    if (!botToken) {
      this.logger.error(
        "TELEGRAM_LOGIN_BOT_TOKEN is missing. Telegram login cannot be validated."
      );
      throw new UnauthorizedException("Telegram авторизация не настроена");
    }

    // Проверка времени авторизации
    const authDate = Number(payload.auth_date);
    if (Number.isNaN(authDate)) {
      throw new UnauthorizedException("Некорректное значение auth_date");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - authDate > this.maxAuthAgeSeconds) {
      throw new UnauthorizedException(
        "Сессия Telegram истекла, попробуйте снова"
      );
    }

    // Проверка подписи
    const dataCheckString = this.buildDataCheckString(payload);
    const secretKey = createHash("sha256").update(botToken).digest();
    const expectedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (expectedHash !== payload.hash) {
      throw new UnauthorizedException("Телеграм подпись недействительна");
    }

    return {
      telegramId: payload.id,
      firstName: payload.first_name,
      lastName: payload.last_name,
      username: payload.username,
      photoUrl: payload.photo_url,
      authDate,
      raw: this.normalizePayload(payload),
    };
  }

  private buildDataCheckString(payload: TelegramAuthPayloadDto): string {
    const entries = Object.entries(payload)
      .filter(
        ([key, value]) =>
          key !== "hash" && value !== undefined && value !== null
      )
      .map(([key, value]) => `${key}=${value}`)
      .sort();

    return entries.join("\n");
  }

  private normalizePayload(
    payload: TelegramAuthPayloadDto
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      normalized[key] = String(value);
    });

    return normalized;
  }
}
```

#### DTO для Telegram

```typescript
// auth/dto/telegram.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";

export class TelegramAuthPayloadDto {
  @ApiProperty({
    description: "Уникальный идентификатор пользователя в Telegram",
    example: "7286304943",
  })
  @IsString()
  @Matches(/^\d+$/, { message: "Поле id должно содержать только цифры" })
  id: string;

  @ApiProperty({ description: "Имя пользователя в Telegram", example: "Иван" })
  @IsString()
  @IsNotEmpty({ message: "first_name не может быть пустым" })
  first_name: string;

  @ApiPropertyOptional({
    description: "Фамилия пользователя в Telegram",
    example: "Петров",
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: "Username пользователя в Telegram",
    example: "ivan_petrov",
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: "URL аватара пользователя",
    example: "https://t.me/i/userpic/320/abcd1234.jpg",
  })
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiProperty({
    description: "Время авторизации (unix timestamp)",
    example: 1730976000,
  })
  @Type(() => Number)
  @IsInt({ message: "auth_date должен быть целым числом" })
  @Min(0)
  auth_date: number;

  @ApiProperty({
    description: "Хэш, подписанный Telegram",
    example: "a2ff0b58e531d0ef0a6e2e1f5780f0b0a6f45d5ff10c4a5a9bdb0f2e3a1b2c3d",
  })
  @IsString()
  @IsNotEmpty({ message: "hash обязателен" })
  hash: string;
}

export class TelegramLoginDto extends TelegramAuthPayloadDto {}
export class TelegramLinkDto extends TelegramAuthPayloadDto {}
```

#### Методы в Auth Service

```typescript
// auth/auth.service.ts - добавить методы

async loginWithTelegram(dto: TelegramLoginDto) {
  const validated = this.telegramAuthService.validatePayload(dto);
  const telegramId = validated.telegramId;

  // Ищем пользователя по telegram_id
  let user = await this.prisma.user.findUnique({
    where: { telegramId },
    select: this.authUserSelect,
  });

  if (!user) {
    // Создаем нового пользователя
    const hashedPassword = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      12,
    );

    const displayName = this.composeDisplayName(validated);

    user = await this.prisma.user.create({
      data: {
        username: validated.username || `telegram_${telegramId}`,
        passwordHash: hashedPassword,
        telegramId,
        fullName: displayName,
        email: null,
        avatarUrl: validated.photoUrl ?? null,
        userId: str(uuid.uuid4())[:8].upper(),
      },
      select: this.authUserSelect,
    });

    // Создаем начальный баланс
    await this.prisma.balance.create({
      data: {
        userId: user.id,
        amount: 0,
      },
    });
  } else {
    // Обновляем аватар если его нет
    if (!user.avatarUrl && validated.photoUrl) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: validated.photoUrl },
        select: this.authUserSelect,
      });
    }
  }

  // Генерируем токены
  const tokens = await this.tokenService.generateTokens(user.id);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: this.toUserProfileDto(user),
  };
}

async linkTelegramAccount(userId: string, dto: TelegramLinkDto) {
  const validated = this.telegramAuthService.validatePayload(dto);
  const telegramId = validated.telegramId;

  // Проверяем, не привязан ли уже этот Telegram аккаунт
  const existingUser = await this.prisma.user.findUnique({
    where: { telegramId },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new ConflictException(
      'Этот Telegram аккаунт уже привязан к другому пользователю',
    );
  }

  // Привязываем Telegram к текущему пользователю
  const user = await this.prisma.user.update({
    where: { id: userId },
    data: {
      telegramId,
      avatarUrl: validated.photoUrl ?? undefined,
    },
    select: this.authUserSelect,
  });

  return this.toUserProfileDto(user);
}
```

#### Контроллер

```typescript
// auth/auth.controller.ts - добавить эндпоинты

@Post('telegram/login')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Вход через Telegram Login Widget' })
@ApiResponse({
  status: 200,
  description: 'Успешная авторизация через Telegram',
  type: AuthResponseDto,
})
@ApiResponse({
  status: 401,
  description: 'Недействительное подтверждение Telegram',
})
async loginWithTelegram(@Body() dto: TelegramLoginDto) {
  return this.authService.loginWithTelegram(dto);
}

@Post('telegram/link')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({
  summary: 'Привязать Telegram аккаунт к текущему пользователю',
})
@ApiResponse({
  status: 200,
  description: 'Telegram-аккаунт успешно привязан',
  type: UserProfileDto,
})
@ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
@ApiResponse({ status: 409, description: 'Telegram-аккаунт уже привязан' })
async linkTelegram(
  @Request() req: { user: { id: string } },
  @Body() dto: TelegramLinkDto,
) {
  return this.authService.linkTelegramAccount(req.user.id, dto);
}
```

#### Обновление схемы БД

```prisma
// prisma/schema.prisma - добавить поле в User

model User {
  // ... существующие поля
  telegramId String? @unique @map("telegram_id")
  // ...
}
```

#### Конфигурация

```env
# .env
TELEGRAM_LOGIN_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_LOGIN_MAX_AGE_SECONDS=600
```

---

## Аутентификация

### JWT Strategy

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return { id: user.id, email: user.email };
  }
}
```

### Token Service

```typescript
// auth/token.service.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService
  ) {}

  async generateTokens(userId: string, email: string | null) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_SECRET"),
        expiresIn: this.configService.get<string>("JWT_EXPIRES_IN", "15m"),
      }),
      this.generateRefreshToken(userId),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        this.parseDays(
          this.configService.get<string>("JWT_REFRESH_EXPIRES_IN", "7d")
        )
    );

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: randomBytes(64).toString("hex"),
        expiresAt,
        userId,
      },
    });

    const payload = { sub: userId, tokenId };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
    });
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      }) as { sub: string; tokenId: string };

      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { id: payload.tokenId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException("Недействительный refresh token");
      }

      // Удаляем старый refresh token
      await this.prisma.refreshToken.delete({
        where: { id: payload.tokenId },
      });

      // Генерируем новые токены
      return this.generateTokens(tokenRecord.user.id, tokenRecord.user.email);
    } catch {
      throw new UnauthorizedException("Недействительный refresh token");
    }
  }

  private parseDays(expiresIn: string): number {
    const match = expiresIn.match(/(\d+)d/);
    return match ? parseInt(match[1], 10) : 7;
  }
}
```

### Refresh Token Strategy

```typescript
// auth/strategies/refresh-token.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh"
) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_REFRESH_SECRET"),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; tokenId: string }) {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token отсутствует");
    }

    return { userId: payload.sub, tokenId: payload.tokenId };
  }
}
```

### Guards

```typescript
// auth/guards/jwt-auth.guard.ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
```

```typescript
// auth/guards/refresh-token.guard.ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class RefreshTokenGuard extends AuthGuard("jwt-refresh") {}
```

### Refresh Token Endpoint

```typescript
// auth/auth.controller.ts - добавить метод

@Post('refresh')
@HttpCode(HttpStatus.OK)
@UseGuards(RefreshTokenGuard)
@ApiOperation({ summary: 'Обновление токенов' })
@ApiResponse({
  status: 200,
  description: 'Токены успешно обновлены',
  type: AuthResponseDto,
})
@ApiResponse({
  status: 401,
  description: 'Недействительный refresh token',
})
async refresh(
  @Body() dto: RefreshTokenDto,
) {
  return this.tokenService.refreshTokens(dto.refreshToken);
}
```

### Refresh Token DTO

```typescript
// auth/dto/auth.dto.ts - добавить

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

### Обновление Auth Service

```typescript
// auth/auth.service.ts - использовать TokenService

constructor(
  private prisma: PrismaService,
  private tokenService: TokenService, // добавить
  private telegramAuthService: TelegramAuthService,
) {}

async login(email: string, password: string) {
  // ... проверка пароля ...
  const tokens = await this.tokenService.generateTokens(user.id, user.email);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: this.toUserProfileDto(user),
  };
}

async loginWithTelegram(dto: TelegramLoginDto) {
  // ... валидация и создание пользователя ...
  const tokens = await this.tokenService.generateTokens(user.id, user.email);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: this.toUserProfileDto(user),
  };
}
```

### Обновление Auth Module

```typescript
// auth/auth.module.ts

import { TokenService } from "./token.service";
import { RefreshTokenStrategy } from "./strategies/refresh-token.strategy";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN", "15m"),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService, // добавить
    TelegramAuthService,
    JwtStrategy,
    RefreshTokenStrategy, // добавить
  ],
  exports: [AuthService, TokenService, TelegramAuthService],
})
export class AuthModule {}
```

### Environment Variables

```env
# .env
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d
```

---

## WebSocket (Socket.IO)

### Настройка

```typescript
// websocket/websocket.module.ts
import { Module } from "@nestjs/common";
import { WebSocketGateway } from "./websocket.gateway";

@Module({
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}
```

### Gateway

```typescript
// websocket/websocket.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/chat",
})
export class WebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("message")
  @UseGuards(JwtAuthGuard)
  handleMessage(
    @MessageBody() data: { sessionId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    // Обработка сообщения
    this.server.emit("message", data);
  }

  @SubscribeMessage("join_session")
  handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(`session:${data.sessionId}`);
  }
}
```

---

## Messages Module (Cursor Pagination)

### Контроллер

```typescript
// messages/messages.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { MessagesService } from "./messages.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MessagesResponseDto } from "./dto/messages.dto";

@ApiTags("Messages")
@Controller("sessions/:sessionId/messages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: "Получить сообщения сессии с cursor pagination" })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Cursor для пагинации (ID последнего сообщения)",
    example: "uuid",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Количество сообщений (по умолчанию 50)",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Список сообщений",
    type: MessagesResponseDto,
  })
  @ApiResponse({ status: 401, description: "Неавторизованный доступ" })
  @ApiResponse({ status: 403, description: "Нет доступа к сессии" })
  async getMessages(
    @Param("sessionId") sessionId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: number,
    @Request() req: { user: { id: string } }
  ) {
    return this.messagesService.getMessages(
      sessionId,
      req.user.id,
      cursor,
      limit || 50
    );
  }
}
```

### Сервис

```typescript
// messages/messages.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MessagesResponseDto, MessageDto } from "./dto/messages.dto";

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async getMessages(
    sessionId: string,
    userId: string,
    cursor?: string,
    limit: number = 50
  ): Promise<MessagesResponseDto> {
    // Проверяем доступ к сессии
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new NotFoundException("Сессия не найдена");
    }

    if (session.userId !== userId) {
      throw new ForbiddenException("Нет доступа к этой сессии");
    }

    // Cursor pagination: получаем сообщения ДО cursor (старые сообщения)
    const where: any = {
      sessionId,
    };

    if (cursor) {
      // Получаем timestamp сообщения с cursor
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { timestamp: true },
      });

      if (cursorMessage) {
        // Берем сообщения, которые были ДО этого timestamp
        where.timestamp = {
          lt: cursorMessage.timestamp,
        };
      }
    }

    // Получаем сообщения в обратном порядке (от новых к старым)
    // Но возвращаем в прямом порядке (от старых к новым)
    const messages = await this.prisma.message.findMany({
      where,
      take: limit + 1, // Берем на 1 больше для проверки hasMore
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        role: true,
        content: true,
        timestamp: true,
      },
    });

    // Проверяем, есть ли еще сообщения
    const hasMore = messages.length > limit;
    const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

    // Реверсируем для возврата от старых к новым
    messagesToReturn.reverse();

    // Следующий cursor - это ID последнего (самого старого) сообщения
    const nextCursor =
      messagesToReturn.length > 0 ? messagesToReturn[0].id : null;

    return {
      messages: messagesToReturn.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: m.timestamp,
      })),
      nextCursor,
      hasMore,
    };
  }
}
```

### DTO

```typescript
// messages/dto/messages.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class MessageDto {
  @ApiProperty({ description: "ID сообщения", example: "uuid" })
  id: string;

  @ApiProperty({
    description: "Роль отправителя",
    enum: ["user", "assistant"],
    example: "user",
  })
  role: "user" | "assistant";

  @ApiProperty({ description: "Содержимое сообщения", example: "Привет!" })
  content: string;

  @ApiProperty({ description: "Время отправки" })
  timestamp: Date;
}

export class MessagesResponseDto {
  @ApiProperty({
    description: "Список сообщений",
    type: [MessageDto],
  })
  messages: MessageDto[];

  @ApiProperty({
    description: "Cursor для следующей страницы (ID последнего сообщения)",
    example: "uuid",
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({
    description: "Есть ли еще сообщения для загрузки",
    example: true,
  })
  hasMore: boolean;
}
```

### Модуль

```typescript
// messages/messages.module.ts
import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
```

### Обновление индекса БД

```prisma
// prisma/schema.prisma - обновить модель Message

model Message {
  id        String   @id @default(uuid())
  sessionId String   @map("session_id")
  role      String   // 'user' | 'assistant'
  content   String
  timestamp DateTime @default(now())

  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, timestamp]) // Составной индекс для cursor pagination
  @@map("messages")
}
```

---

## AI Психолог

### Сервис

```typescript
// psychologist/psychologist.service.ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PsychologistService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });
  }

  async generateResponse(
    sessionId: string,
    userMessage: string
  ): Promise<string> {
    // Получаем историю сообщений
    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
      take: 20, // Последние 20 сообщений
    });

    // Формируем промпт
    const systemPrompt = this.getSystemPrompt();
    const conversationMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Вызов OpenAI
    const completion = await this.openai.chat.completions.create({
      model: this.configService.get<string>("OPENAI_MODEL", "gpt-4o-mini"),
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    // Сохраняем сообщения в БД
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          sessionId,
          role: "user",
          content: userMessage,
        },
      }),
      this.prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: response,
        },
      }),
    ]);

    return response;
  }

  private getSystemPrompt(): string {
    return `Ты профессиональный психолог, который помогает людям разобраться в их переживаниях и построить систему убеждений их идей.

Твой алгоритм работы:
1. Начни с мягкого вопроса о самочувствии
2. Только после того, как человек поделился своими чувствами, мягко спроси о ситуациях
3. Для каждой идеи/ситуации выстраивай систему убеждений

КРИТИЧЕСКИ ВАЖНО:
- Следуй алгоритму строго
- Задавай только ОДИН вопрос за раз
- Не перепрыгивай через этапы`;
  }
}
```

---

## Subscription Module (Подписка и оплата)

### Модель Subscription

```prisma
// prisma/schema.prisma

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  PENDING
}

enum SubscriptionPlan {
  MONTHLY
  QUARTERLY
  YEARLY
}

model Subscription {
  id            String            @id @default(uuid())
  userId        String            @unique @map("user_id")
  plan          SubscriptionPlan
  status        SubscriptionStatus @default(PENDING)
  expiresAt     DateTime?         @map("expires_at")
  autoRenew     Boolean           @default(true) @map("auto_renew")
  paymentMethod String?           @map("payment_method")
  lavaOrderId   String?           @unique @map("lava_order_id")

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  @@index([userId])
  @@index([status])
  @@index([expiresAt])
  @@map("subscriptions")
}
```

### Сервис

```typescript
// subscription/subscription.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LavaService } from "../integrations/lava/lava.service";
import {
  CreateSubscriptionDto,
  PurchaseSubscriptionDto,
} from "./dto/subscription.dto";

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private lavaService: LavaService
  ) {}

  async getSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return null;
    }

    // Проверяем, не истекла ли подписка
    if (
      subscription.status === "ACTIVE" &&
      subscription.expiresAt &&
      subscription.expiresAt < new Date()
    ) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
      });

      return {
        ...subscription,
        status: "EXPIRED",
      };
    }

    return subscription;
  }

  async checkSubscriptionActive(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return (
      subscription?.status === "ACTIVE" &&
      subscription.expiresAt &&
      subscription.expiresAt > new Date()
    );
  }

  async purchaseSubscription(userId: string, dto: PurchaseSubscriptionDto) {
    const { planId, promoCode, paymentMethod } = dto;

    // Получаем план
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new BadRequestException("Неверный план подписки");
    }

    // Применяем промокод если есть
    let finalPrice = plan.price;
    if (promoCode) {
      const discount = await this.validatePromoCode(promoCode);
      finalPrice = plan.price - discount;
    }

    // Проверяем баланс если оплата с баланса
    if (paymentMethod === "balance") {
      const balance = await this.prisma.balance.findUnique({
        where: { userId },
      });

      if (!balance || balance.amount < finalPrice) {
        throw new BadRequestException("Недостаточно средств на балансе");
      }
    }

    // Создаем платеж через Lava API
    let lavaOrderId: string | null = null;
    let paymentUrl: string | null = null;
    if (paymentMethod !== "balance") {
      const order = await this.lavaService.createPayment({
        amount: finalPrice,
        orderId: `sub_${userId}_${Date.now()}`,
        paymentMethod,
        successUrl: `${process.env.FRONTEND_URL}/subscription/success`,
        failUrl: `${process.env.FRONTEND_URL}/subscription?error=payment_failed`,
      });

      lavaOrderId = order.id;
      paymentUrl = order.paymentUrl;
    }

    // Создаем или обновляем подписку
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.duration);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: plan.planType,
        status: paymentMethod === "balance" ? "ACTIVE" : "PENDING",
        expiresAt,
        autoRenew: true,
        paymentMethod,
        lavaOrderId,
      },
      update: {
        plan: plan.planType,
        status: paymentMethod === "balance" ? "ACTIVE" : "PENDING",
        expiresAt,
        paymentMethod,
        lavaOrderId,
      },
    });

    // Если оплата с баланса - списываем средства
    if (paymentMethod === "balance") {
      await this.prisma.balance.update({
        where: { userId },
        data: {
          amount: {
            decrement: finalPrice,
          },
        },
      });

      // Создаем транзакцию
      await this.prisma.transaction.create({
        data: {
          userId,
          amount: -finalPrice,
          transactionType: "PAYMENT",
          description: `Оплата подписки ${plan.name}`,
        },
      });
    }

    return {
      subscription,
      paymentUrl,
      sessionId: lavaOrderId,
    };
  }

  async confirmPayment(lavaOrderId: string) {
    // Проверяем статус платежа через Lava API
    const order = await this.lavaService.getOrderStatus(lavaOrderId);

    if (order.status === "success") {
      const subscription = await this.prisma.subscription.findUnique({
        where: { lavaOrderId },
      });

      if (subscription) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
          },
        });
      }
    }

    return order;
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException("Подписка не найдена");
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: false,
        status: "CANCELLED",
      },
    });
  }

  async validatePromoCode(code: string): Promise<number> {
    // Логика валидации промокода
    // Можно хранить в отдельной таблице promo_codes
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promoCode || !promoCode.isActive) {
      throw new BadRequestException("Промокод недействителен");
    }

    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      throw new BadRequestException("Промокод истек");
    }

    return promoCode.discountAmount || 0;
  }

  private getPlanById(planId: string) {
    const plans = {
      monthly: {
        planType: "MONTHLY",
        name: "Месячная подписка",
        price: 990,
        duration: 30,
      },
      quarterly: {
        planType: "QUARTERLY",
        name: "Квартальная подписка",
        price: 2490,
        duration: 90,
      },
      yearly: {
        planType: "YEARLY",
        name: "Годовая подписка",
        price: 8990,
        duration: 365,
      },
    };

    return plans[planId] || null;
  }
}
```

### Контроллер

```typescript
// subscription/subscription.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SubscriptionService } from "./subscription.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  PurchaseSubscriptionDto,
  SubscriptionResponseDto,
} from "./dto/subscription.dto";

@ApiTags("Subscription")
@Controller("subscription")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: "Получить текущую подписку пользователя" })
  @ApiResponse({
    status: 200,
    description: "Подписка пользователя",
    type: SubscriptionResponseDto,
  })
  async getSubscription(@Request() req: { user: { id: string } }) {
    return this.subscriptionService.getSubscription(req.user.id);
  }

  @Post("purchase")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Оформить подписку" })
  @ApiResponse({
    status: 200,
    description: "Подписка оформлена",
  })
  async purchase(
    @Request() req: { user: { id: string } },
    @Body() dto: PurchaseSubscriptionDto
  ) {
    return this.subscriptionService.purchaseSubscription(req.user.id, dto);
  }

  @Post("confirm-payment")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Подтвердить оплату (webhook от Lava)" })
  @ApiResponse({
    status: 200,
    description: "Платеж подтвержден",
  })
  async confirmPayment(@Body() body: { orderId: string }) {
    return this.subscriptionService.confirmPayment(body.orderId);
  }

  @Post("cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Отменить подписку" })
  @ApiResponse({
    status: 200,
    description: "Подписка отменена",
  })
  async cancel(@Request() req: { user: { id: string } }) {
    return this.subscriptionService.cancelSubscription(req.user.id);
  }

  @Post("validate-promo")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Проверить промокод" })
  async validatePromo(@Body() body: { code: string }) {
    const discount = await this.subscriptionService.validatePromoCode(
      body.code
    );
    return { discount, valid: true };
  }

  // Webhook endpoint для Lava (без авторизации)
  @Post("webhook/lava")
  @HttpCode(HttpStatus.OK)
  @UseGuards() // Без JWT, только проверка подписи от Lava
  @ApiOperation({ summary: "Webhook для уведомлений от Lava API" })
  async handleLavaWebhook(@Body() body: any) {
    // Проверяем подпись от Lava (если требуется)
    // Обрабатываем уведомление о статусе платежа
    if (body.orderId) {
      return this.subscriptionService.confirmPayment(body.orderId);
    }
    return { received: true };
  }
}
```

### Subscription Guard

```typescript
// subscription/subscription.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException("Не авторизован");
    }

    const isActive = await this.subscriptionService.checkSubscriptionActive(
      userId
    );

    if (!isActive) {
      throw new ForbiddenException(
        "Требуется активная подписка для доступа к этому функционалу"
      );
    }

    return true;
  }
}
```

### DTO

```typescript
// subscription/dto/subscription.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum } from "class-validator";

export class PurchaseSubscriptionDto {
  @ApiProperty({
    description: "ID плана подписки",
    example: "monthly",
    enum: ["monthly", "quarterly", "yearly"],
  })
  @IsString()
  @IsEnum(["monthly", "quarterly", "yearly"])
  planId: string;

  @ApiProperty({
    description: "Промокод (опционально)",
    example: "PROMO2024",
    required: false,
  })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiProperty({
    description: "Способ оплаты",
    example: "card",
    enum: ["card", "yookassa", "balance"],
  })
  @IsString()
  @IsEnum(["card", "yookassa", "balance"])
  paymentMethod: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({ description: "ID подписки" })
  id: string;

  @ApiProperty({ description: "План подписки" })
  plan: string;

  @ApiProperty({ description: "Статус подписки" })
  status: string;

  @ApiProperty({ description: "Дата истечения" })
  expiresAt: Date | null;

  @ApiProperty({ description: "Автопродление" })
  autoRenew: boolean;
}
```

### Модуль

```typescript
// subscription/subscription.module.ts
import { Module } from "@nestjs/common";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionService } from "./subscription.service";
import { PrismaModule } from "../prisma/prisma.module";
import { LavaModule } from "../integrations/lava/lava.module";

@Module({
  imports: [PrismaModule, LavaModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
```

### Использование Guard

```typescript
// sessions/sessions.controller.ts - пример использования

import { SubscriptionGuard } from '../subscription/subscription.guard';

@Post()
@UseGuards(JwtAuthGuard, SubscriptionGuard) // Добавляем SubscriptionGuard
@ApiOperation({ summary: 'Создать новую сессию' })
@ApiResponse({
  status: 403,
  description: 'Требуется активная подписка',
})
async create(
  @Request() req: { user: { id: string } },
  @Body() dto: CreateSessionDto,
) {
  // Только пользователи с активной подпиской могут создавать сессии
  return this.sessionsService.create(req.user.id, dto);
}

// Пример: получение списка сессий не требует подписки
@Get()
@UseGuards(JwtAuthGuard) // Только JWT, без SubscriptionGuard
@ApiOperation({ summary: 'Получить список сессий' })
async findAll(@Request() req: { user: { id: string } }) {
  return this.sessionsService.findAllByUserId(req.user.id);
}
```

### Эндпоинты, требующие подписку

**С SubscriptionGuard:**

- `POST /sessions` - создание новой сессии
- `POST /sessions/:id/messages` (WebSocket) - отправка сообщения
- `GET /sessions/:id/document` - скачивание документа
- `POST /sessions/:id/add-to-map` - добавление в нейрокарту

**Без SubscriptionGuard (доступны всем авторизованным):**

- `GET /sessions` - список сессий
- `GET /sessions/:id` - просмотр сессии
- `GET /sessions/:id/messages` - получение сообщений
- `PUT /sessions/:id` - редактирование сессии
- `DELETE /sessions/:id` - удаление сессии
- `GET /cabinet/*` - личный кабинет
- `GET /subscription` - информация о подписке

### Модель PromoCode

```prisma
// prisma/schema.prisma - добавить

model PromoCode {
  id            String    @id @default(uuid())
  code          String    @unique
  discountAmount Decimal  @map("discount_amount") @db.Decimal(10, 2)
  discountPercent Int?    @map("discount_percent")
  isActive      Boolean   @default(true) @map("is_active")
  expiresAt     DateTime? @map("expires_at")
  maxUses       Int?      @map("max_uses")
  currentUses   Int       @default(0) @map("current_uses")

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@map("promo_codes")
}
```

### Обновление модели User

```prisma
// prisma/schema.prisma - добавить связь

model User {
  // ... существующие поля
  subscription Subscription?
  // ...
}
```

---

## Swagger Configuration

### main.ts

```typescript
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const config = new DocumentBuilder()
  .setTitle("SEEE API")
  .setDescription("API для системы AI-психолога")
  .setVersion("1.0")
  .addBearerAuth()
  .addTag("Auth", "Аутентификация и авторизация")
  .addTag("Sessions", "Сессии психолога")
  .addTag("Messages", "Сообщения")
  .addTag("EventMap", "Нейрокарта")
  .addTag("Subscription", "Подписка и оплата")
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api/docs", app, document, {
  swaggerOptions: {
    persistAuthorization: true,
  },
});

// Экспорт JSON для генерации клиента
httpAdapter.get("/api-json", (_req, res) => {
  res.json(document);
});
```

---

## Обработка ошибок

### Exception Filter

```typescript
// common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Внутренняя ошибка сервера";

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
```

---

## Валидация

### Global Validation Pipe

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Удаляет свойства, не описанные в DTO
    forbidNonWhitelisted: true, // Выбрасывает ошибку при наличии лишних свойств
    transform: true, // Автоматически преобразует типы
    transformOptions: {
      enableImplicitConversion: true,
    },
  })
);
```

---

## Конфигурация

### Config Module

```typescript
// config/config.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
  ],
})
export class ConfigModule {}
```

### Использование

```typescript
import { ConfigService } from '@nestjs/config';

constructor(private configService: ConfigService) {
  const dbUrl = this.configService.get<string>('DATABASE_URL');
}
```

---

## Тестирование

### Unit Tests

```typescript
// sessions/sessions.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { SessionsService } from "./sessions.service";
import { PrismaService } from "../prisma/prisma.service";

describe("SessionsService", () => {
  let service: SessionsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: PrismaService,
          useValue: {
            session: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
```

---

## Интеграция с Lava API

### Обзор

Интеграция с [Lava API](https://gate.lava.top/docs) для работы с внешними сервисами через API Gateway. Используется Orval для генерации TypeScript клиента из OpenAPI спецификации.

### Настройка Orval для внешнего API

**Конфигурация Orval:**

```typescript
// orval.config.ts
import { defineConfig } from "orval";

export default defineConfig({
  // Lava API клиент
  lavaApi: {
    input: "https://gate.lava.top/openapi.json", // OpenAPI спецификация Lava
    output: {
      mode: "single",
      target: "./src/integrations/lava/lava.api.ts",
      client: "axios",
      schemas: "./src/integrations/lava/schemas",
      override: {
        mutator: {
          path: "./src/integrations/lava/lava.mutator.ts",
          name: "lavaAxiosInstance",
        },
        operations: {
          // Префикс для всех операций
          operationName: (operation, route, method) => {
            return `lava${
              operation.operationId
                ? operation.operationId.charAt(0).toUpperCase() +
                  operation.operationId.slice(1)
                : `${method}${route.split("/").pop()}`
            }`;
          },
        },
      },
    },
  },
});
```

### Mutator для Lava API

```typescript
// src/integrations/lava/lava.mutator.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ConfigService } from "@nestjs/config";

const LAVA_API_BASE_URL = "https://gate.lava.top";

// Создаем axios instance для Lava API
const createLavaInstance = (apiKey: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: LAVA_API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey, // Или другой способ авторизации согласно документации Lava
    },
    timeout: 30000,
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Логирование запросов в dev режиме
      if (process.env.NODE_ENV === "development") {
        console.log(`[Lava API] ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Обработка ошибок Lava API
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // Логирование ошибок
        console.error(`[Lava API Error] ${status}:`, data);

        // Можно добавить retry логику для определенных ошибок
        if (status === 429) {
          // Rate limit - можно добавить retry с задержкой
          console.warn("[Lava API] Rate limit exceeded");
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Экспорт для Orval
export const lavaAxiosInstance = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<AxiosResponse<TData>> => {
  // Получаем API ключ из переменных окружения
  // В реальном приложении лучше использовать ConfigService через DI
  const apiKey = process.env.LAVA_API_KEY || "";

  if (!apiKey) {
    throw new Error("LAVA_API_KEY is not configured");
  }

  const instance = createLavaInstance(apiKey);
  return instance.request<TData>({ ...config, ...(options || {}) });
};
```

### Сервис для работы с Lava API

```typescript
// src/integrations/lava/lava.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lavaGetSomeResource, lavaPostSomeAction } from "./lava.api";
import type {
  SomeResourceResponse,
  SomeActionRequest,
  SomeActionResponse,
} from "./schemas";

@Injectable()
export class LavaService {
  private readonly logger = new Logger(LavaService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Получить ресурс из Lava API
   */
  async getResource(resourceId: string): Promise<SomeResourceResponse> {
    try {
      const response = await lavaGetSomeResource({
        path: { id: resourceId },
      });

      this.logger.log(`Resource ${resourceId} retrieved successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Выполнить действие через Lava API
   */
  async performAction(data: SomeActionRequest): Promise<SomeActionResponse> {
    try {
      const response = await lavaPostSomeAction({
        data,
      });

      this.logger.log("Action performed successfully");
      return response.data;
    } catch (error) {
      this.logger.error("Failed to perform action:", error);
      throw error;
    }
  }

  /**
   * Создать платеж через Lava API
   * Адаптируйте под реальный API Lava согласно документации
   */
  async createPayment(dto: {
    amount: number;
    orderId: string;
    paymentMethod: string;
    successUrl: string;
    failUrl: string;
  }): Promise<{ id: string; paymentUrl: string; status: string }> {
    try {
      // Используем Orval сгенерированный клиент
      // Пример вызова (нужно адаптировать под реальный API Lava)
      const response = await lavaPostSomeAction({
        data: {
          amount: dto.amount,
          orderId: dto.orderId,
          paymentMethod: dto.paymentMethod,
          successUrl: dto.successUrl,
          failUrl: dto.failUrl,
        },
      });

      this.logger.log(`[Lava API] Payment created: ${dto.orderId}`);
      return {
        id: response.data?.id || dto.orderId,
        paymentUrl: response.data?.paymentUrl || response.data?.url || "",
        status: response.data?.status || "pending",
      };
    } catch (error) {
      this.logger.error(`[Lava API] Error creating payment: ${error}`);
      throw error;
    }
  }

  /**
   * Получить статус заказа в Lava API
   */
  async getOrderStatus(orderId: string): Promise<{
    id: string;
    paymentUrl: string;
    status: string;
  }> {
    try {
      // Используем Orval сгенерированный клиент
      const response = await lavaGetSomeResource({
        path: { id: orderId },
      });

      this.logger.log(
        `[Lava API] Order status: ${orderId} - ${response.data?.status}`
      );
      return {
        id: response.data?.id || orderId,
        paymentUrl: response.data?.paymentUrl || "",
        status: response.data?.status || "unknown",
      };
    } catch (error) {
      this.logger.error(`[Lava API] Error getting order status: ${error}`);
      throw error;
    }
  }
}
```

### Модуль интеграции

```typescript
// src/integrations/lava/lava.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LavaService } from "./lava.service";

@Module({
  imports: [ConfigModule],
  providers: [LavaService],
  exports: [LavaService], // Экспортируем для использования в других модулях
})
export class LavaModule {}
```

### Использование в других модулях

```typescript
// src/sessions/sessions.module.ts
import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { LavaModule } from "../integrations/lava/lava.module";

@Module({
  imports: [LavaModule], // Импортируем Lava модуль
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
```

```typescript
// src/sessions/sessions.service.ts
import { Injectable } from "@nestjs/common";
import { LavaService } from "../integrations/lava/lava.service";

@Injectable()
export class SessionsService {
  constructor(private lavaService: LavaService) {}

  async createSession(data: CreateSessionDto) {
    // Используем Lava API если нужно
    const externalData = await this.lavaService.getResource("some-id");

    // Создаем сессию
    const session = await this.prisma.session.create({
      data: {
        // ... данные сессии
      },
    });

    return session;
  }
}
```

### Конфигурация

**Environment variables:**

```env
# .env
LAVA_API_KEY=your-lava-api-key
LAVA_API_BASE_URL=https://gate.lava.top
```

**Config Module:**

```typescript
// src/config/config.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: Joi.object({
        LAVA_API_KEY: Joi.string().required(),
        LAVA_API_BASE_URL: Joi.string().uri().default("https://gate.lava.top"),
      }),
    }),
  ],
})
export class ConfigModule {}
```

### Обработка ошибок

```typescript
// src/integrations/lava/lava.exception.ts
import { HttpException, HttpStatus } from "@nestjs/common";

export class LavaApiException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_GATEWAY
  ) {
    super(
      {
        statusCode,
        message: `Lava API Error: ${message}`,
        error: "Lava API Integration Error",
      },
      statusCode
    );
  }
}
```

### Тестирование

```typescript
// src/integrations/lava/lava.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { LavaService } from "./lava.service";
import * as lavaApi from "./lava.api";

jest.mock("./lava.api");

describe("LavaService", () => {
  let service: LavaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LavaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "LAVA_API_KEY") return "test-key";
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LavaService>(LavaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should get resource from Lava API", async () => {
    const mockResponse = { data: { id: "123", name: "Test" } };
    (lavaApi.lavaGetSomeResource as jest.Mock).mockResolvedValue(mockResponse);

    const result = await service.getResource("123");

    expect(result).toEqual(mockResponse.data);
    expect(lavaApi.lavaGetSomeResource).toHaveBeenCalledWith({
      path: { id: "123" },
    });
  });
});
```

### Генерация клиента

**Package.json scripts:**

```json
{
  "scripts": {
    "generate:lava": "orval --config orval.config.ts",
    "generate:all": "npm run generate:lava && npm run generate:seee"
  }
}
```

**Запуск генерации:**

```bash
npm run generate:lava
```

### Best Practices для интеграции

1. **Используйте отдельный mutator** для каждого внешнего API
2. **Храните API ключи** в переменных окружения
3. **Обрабатывайте ошибки** явно с понятными сообщениями
4. **Логируйте запросы** в development режиме
5. **Используйте retry логику** для временных ошибок (429, 503)
6. **Кэшируйте ответы** где возможно
7. **Тестируйте интеграцию** с моками
8. **Документируйте использование** в README модуля

---

## Best Practices

1. **Всегда используйте транзакции** для операций, затрагивающих несколько таблиц
2. **Валидируйте входные данные** через DTO
3. **Используйте типы** вместо `any`
4. **Обрабатывайте ошибки** явно
5. **Документируйте API** через Swagger
6. **Тестируйте критичную логику**
7. **Используйте индексы** в БД для производительности
8. **Логируйте важные операции**
9. **Используйте Orval** для генерации клиентов внешних API
10. **Изолируйте интеграции** в отдельные модули
