import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { TelegramAuthService } from './telegram-auth.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  UserProfileDto,
  UpdateProfileDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SubscriptionStatusDto,
} from './dto/auth.dto';
import { TelegramLoginDto, TelegramLinkDto } from './dto/telegram.dto';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import {
  AdminGeneratePasswordResetLinkDto,
  AdminGeneratePasswordResetLinkResponseDto,
} from './dto/admin.dto';

@Injectable()
export class AuthService {
  private static readonly FREE_ACCESS_PROMO_CODE = 'SEEEFREEE';
  private readonly authUserSelect = {
    id: true,
    username: true,
    userId: true,
    email: true,
    fullName: true,
    avatarUrl: true,
    telegramId: true,
    role: true,
    subscriptionStatus: true,
    subscriptionActive: true,
    subscriptionEndsAt: true,
  };

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private telegramAuthService: TelegramAuthService,
    private passwordResetService: PasswordResetService,
    private configService: ConfigService,
  ) {}

  isAdminKeyValid(adminKey: string | undefined): boolean {
    const key = String(adminKey || '').trim();
    if (!key) return false;
    const configured =
      this.configService.get<string>('ADMIN_API_KEY') ||
      this.configService.get<string>('LAVATOP_WEBHOOK_API_KEY') ||
      '';
    if (!configured) return false;
    return key === configured;
  }

  async adminGeneratePasswordResetLink(
    dto: AdminGeneratePasswordResetLinkDto,
  ): Promise<AdminGeneratePasswordResetLinkResponseDto> {
    const email = (dto.email || '').trim().toLowerCase();
    const expiresInMinutes =
      typeof dto.expiresInMinutes === 'number' && Number.isFinite(dto.expiresInMinutes)
        ? dto.expiresInMinutes
        : 60;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, telegramId: true },
    });

    if (!user?.email) {
      throw new NotFoundException('Пользователь не найден');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    return {
      email: user.email,
      resetLink,
      expiresAt: expiresAt.toISOString(),
      telegramLinked: !!user.telegramId,
    };
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.authUserSelect,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toUserProfileDto(user),
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:63',message:'register ENTRY',data:{email:dto.email,username:dto.username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.log(`🔵 [DEBUG-HYP-F] register ENTRY | email: ${dto.email}`);
    try {
      // Проверяем, существует ли пользователь
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:65',message:'BEFORE first DB query',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.log('🔵 [DEBUG-HYP-F] BEFORE first DB query (findFirst)');
      const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException({
          message: 'Пользователь с таким email уже существует',
          field: 'email',
        });
      }
      if (existingUser.username === dto.username) {
        throw new ConflictException({
          message: 'Пользователь с таким username уже существует',
          field: 'username',
        });
      }
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Генерируем userId (первые 8 символов UUID в верхнем регистре)
    const userId = randomBytes(4).toString('hex').toUpperCase();

    // Создаем пользователя
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash: hashedPassword,
        fullName: dto.name || null,
        userId,
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

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toUserProfileDto(user),
    };
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b70f77df-99ee-45b9-9bfa-1e0528e8a94f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:123',message:'register ERROR',data:{errorMessage:error?.message,errorCode:error?.code,errorName:error?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error(`🔴 [DEBUG-HYP-F] Register ERROR | message: ${error.message} | code: ${error.code} | name: ${error.name}`);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      throw error;
    }
  }

  async loginWithTelegram(dto: TelegramLoginDto): Promise<AuthResponseDto> {
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
      const userId = randomBytes(4).toString('hex').toUpperCase();

      user = await this.prisma.user.create({
        data: {
          username: validated.username || `telegram_${telegramId}`,
          passwordHash: hashedPassword,
          telegramId,
          fullName: displayName,
          email: null,
          avatarUrl: validated.photoUrl ?? null,
          userId,
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
    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toUserProfileDto(user),
    };
  }

  async linkTelegramAccount(
    userId: string,
    dto: TelegramLinkDto,
  ): Promise<UserProfileDto> {
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

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    // TokenService.refreshTokens уже проверяет токен и возвращает новые токены
    // Но нам нужен пользователь для ответа
    // Получаем userId из refresh token перед обновлением
    const { JwtService } = await import('@nestjs/jwt');
    const { ConfigService } = await import('@nestjs/config');
    const configService = new ConfigService();
    const jwtService = new JwtService({
      secret: configService.get<string>('JWT_REFRESH_SECRET'),
    });

    let userId: string;
    try {
      const payload = jwtService.verify(refreshToken) as {
        sub: string;
        tokenId: string;
      };
      userId = payload.sub;
    } catch (error) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    // Обновляем токены
    const tokens = await this.tokenService.refreshTokens(refreshToken);

    // Получаем пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.authUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toUserProfileDto(user),
    };
  }

  async getMe(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.authUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.toUserProfileDto(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.authUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const dataToUpdate: { username?: string; userId?: string } = {};

    if (typeof dto.username === 'string') {
      const nextUsername = dto.username.trim();
      if (nextUsername.length < 3) {
        throw new BadRequestException(
          'Имя пользователя должно быть не короче 3 символов',
        );
      }

      if (nextUsername !== user.username) {
        const sameUsername = await this.prisma.user.findFirst({
          where: {
            username: nextUsername,
            NOT: { id: userId },
          },
          select: { id: true },
        });

        if (sameUsername) {
          throw new ConflictException({
            message: 'Пользователь с таким username уже существует',
            field: 'username',
          });
        }

        dataToUpdate.username = nextUsername;
      }
    }

    if (typeof dto.userId === 'string') {
      const nextUserId = dto.userId.trim();
      if (nextUserId.length < 4) {
        throw new BadRequestException('ID пользователя должен быть не короче 4 символов');
      }

      if (nextUserId !== user.userId) {
        const sameUserId = await this.prisma.user.findFirst({
          where: {
            userId: nextUserId,
            NOT: { id: userId },
          },
          select: { id: true },
        });

        if (sameUserId) {
          throw new ConflictException({
            message: 'Пользователь с таким ID уже существует',
            field: 'userId',
          });
        }

        dataToUpdate.userId = nextUserId;
      }
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return this.toUserProfileDto(user);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: this.authUserSelect,
    });

    return this.toUserProfileDto(updated);
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionActive: true,
        subscriptionEndsAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return {
      status: user.subscriptionStatus,
      isActive: user.subscriptionActive,
      endsAt: user.subscriptionEndsAt?.toISOString() ?? null,
    };
  }

  async cancelSubscription(userId: string): Promise<SubscriptionStatusDto> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'CANCELED',
        subscriptionActive: false,
        subscriptionCanceledAt: new Date(),
      },
      select: {
        subscriptionStatus: true,
        subscriptionActive: true,
        subscriptionEndsAt: true,
      },
    });

    return {
      status: updated.subscriptionStatus,
      isActive: updated.subscriptionActive,
      endsAt: updated.subscriptionEndsAt?.toISOString() ?? null,
    };
  }

  async redeemPromoCode(
    userId: string,
    promoCodeRaw: string,
  ): Promise<SubscriptionStatusDto> {
    const promoCode = (promoCodeRaw || '').trim().toUpperCase();
    if (!promoCode) {
      throw new BadRequestException('Введите промокод');
    }
    if (promoCode !== AuthService.FREE_ACCESS_PROMO_CODE) {
      throw new BadRequestException('Неверный промокод');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionActive: true,
        subscriptionEndsAt: null,
        subscriptionCanceledAt: null,
        subscriptionProvider: 'promo',
        subscriptionExternalId: promoCode,
      },
      select: {
        subscriptionStatus: true,
        subscriptionActive: true,
        subscriptionEndsAt: true,
      },
    });

    return {
      status: updated.subscriptionStatus,
      isActive: updated.subscriptionActive,
      endsAt: updated.subscriptionEndsAt?.toISOString() ?? null,
    };
  }

  async handleSubscriptionWebhook(
    apiKey: string | undefined,
    payload: Record<string, any>,
  ): Promise<void> {
    const configuredApiKey =
      this.configService.get<string>('LAVATOP_WEBHOOK_API_KEY') || '';

    if (!configuredApiKey || apiKey !== configuredApiKey) {
      throw new UnauthorizedException('Invalid webhook API key');
    }

    const normalizedPayload = payload || {};
    const rawStatus = String(
      normalizedPayload?.status ??
        normalizedPayload?.payment_status ??
        normalizedPayload?.event ??
        '',
    )
      .trim()
      .toLowerCase();

    const userId = String(
      normalizedPayload?.metadata?.userId ??
        normalizedPayload?.userId ??
        '',
    ).trim();
    const email = String(
      normalizedPayload?.metadata?.email ??
        normalizedPayload?.email ??
        normalizedPayload?.customer_email ??
        '',
    ).trim().toLowerCase();

    const periodEndRaw =
      normalizedPayload?.period_end ??
      normalizedPayload?.expires_at ??
      normalizedPayload?.next_payment_at ??
      null;

    const periodEndDate =
      periodEndRaw && !Number.isNaN(new Date(periodEndRaw).getTime())
        ? new Date(periodEndRaw)
        : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

    const isCancelEvent =
      rawStatus.includes('cancel') ||
      rawStatus.includes('refund') ||
      rawStatus.includes('fail') ||
      rawStatus.includes('chargeback');

    const where =
      userId.length > 0
        ? { id: userId }
        : email.length > 0
          ? { email }
          : null;

    if (!where) {
      throw new BadRequestException('Webhook payload must contain userId or email');
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Пользователь для подписки не найден');
    }

    if (isCancelEvent) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'CANCELED',
          subscriptionActive: false,
          subscriptionCanceledAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionActive: true,
        subscriptionEndsAt: periodEndDate,
        subscriptionCanceledAt: null,
        subscriptionProvider: 'lava.top',
        subscriptionExternalId: String(
          normalizedPayload?.subscription_id ??
            normalizedPayload?.id ??
            normalizedPayload?.payment_id ??
            '',
        ).trim() || null,
      },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        telegramId: true,
      },
    });

    // Всегда возвращаем одинаковый ответ для безопасности (не раскрываем, есть ли email)
    const okMessage =
      'Если аккаунт с таким email существует, ссылка для восстановления пароля отправлена на email и в Telegram (если привязан).';

    if (!user) {
      return { message: okMessage };
    }

    const EXPIRES_MINUTES = 60;
    const token = randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000),
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await this.passwordResetService.sendResetLink({
      email: user.email ?? undefined,
      telegramId: user.telegramId ?? undefined,
      resetLink,
      expiresInMinutes: EXPIRES_MINUTES,
    });

    return { message: okMessage };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Ссылка недействительна или истекла. Запросите новую.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashedPassword },
      }),
      this.prisma.passwordResetToken.delete({
        where: { id: record.id },
      }),
    ]);

    return { message: 'Пароль успешно изменён. Войдите с новым паролем.' };
  }

  private composeDisplayName(validated: {
    firstName: string;
    lastName?: string;
  }): string {
    if (validated.lastName) {
      return `${validated.firstName} ${validated.lastName}`;
    }
    return validated.firstName;
  }

  private toUserProfileDto(user: any): UserProfileDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      telegramId: user.telegramId ?? null,
      userId: user.userId ?? null,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionActive: !!user.subscriptionActive,
      subscriptionEndsAt: user.subscriptionEndsAt
        ? new Date(user.subscriptionEndsAt).toISOString()
        : null,
    };
  }
}

