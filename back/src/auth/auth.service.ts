import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, FeedbackType } from '@prisma/client';
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
  ManagerTeamOverviewDto,
  ManagerAccessSetupDto,
  ManagerAccessSetupResponseDto,
} from './dto/auth.dto';
import { TelegramLoginDto, TelegramLinkDto } from './dto/telegram.dto';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import {
  AdminGeneratePasswordResetLinkDto,
  AdminGeneratePasswordResetLinkResponseDto,
} from './dto/admin.dto';
import { ForbiddenException } from '@nestjs/common';

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
    accountType: true,
    dailyPracticeMinutes: true,
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

  private isSupportKeyValid(keyRaw: string | undefined): boolean {
    const key = String(keyRaw || '').trim();
    if (!key) return false;
    // Use existing bot token as support key so no extra env setup is required.
    const configured = this.configService.get<string>('TELEGRAM_LOGIN_BOT_TOKEN');
    if (!configured) return false;
    return key === configured;
  }

  async getReferralInfo(userId: string): Promise<{
    userId: string;
    balance: number;
    promoCode: string;
    referralLink: string;
    accountType: 'USER' | 'MANAGER' | 'TEAM_MEMBER';
    employeeInviteLink: string | null;
    teamSeatsLimit: number;
    occupiedSeatsCount: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userId: true,
        accountType: true,
        teamInviteCode: true,
        teamSeatsLimit: true,
        _count: {
          select: {
            teamMembers: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const balance = await this.prisma.balance.findUnique({
      where: { userId: user.id },
      select: { amount: true },
    });

    const amountNumber = balance ? Number(balance.amount) : 0;
    const promoCodeBase = user.userId || user.id;
    const promoCode = `PROMO${promoCodeBase.substring(0, 8).toUpperCase()}`;

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/+$/, '') ||
      'https://seee.app';
    const referralLink = `${frontendUrl}/?ref=${user.id}&utm_source=referral`;
    const employeeInviteLink =
      user.accountType === AccountType.MANAGER && user.teamInviteCode
        ? `${frontendUrl}/register?team=${user.teamInviteCode}`
        : null;

    return {
      userId: user.userId || user.id,
      balance: amountNumber,
      promoCode,
      referralLink,
      accountType: user.accountType,
      employeeInviteLink,
      teamSeatsLimit: user.teamSeatsLimit,
      occupiedSeatsCount: user._count.teamMembers,
    };
  }

  async getManagerTeamOverview(userId: string): Promise<ManagerTeamOverviewDto> {
    const manager = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountType: true,
        teamSeatsLimit: true,
        teamMembers: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            username: true,
            fullName: true,
            dailyPracticeMinutes: true,
            balances: {
              select: { amount: true },
            },
            feedback: {
              where: {
                sessionId: { not: null },
                feedbackType: FeedbackType.FULL,
              },
              orderBy: { createdAt: 'desc' },
              select: {
                sessionId: true,
                description: true,
                emotionAfter: true,
                createdAt: true,
                session: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!manager) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (manager.accountType !== AccountType.MANAGER) {
      throw new ForbiddenException('Раздел доступен только руководителям');
    }

    const occupiedSeatsCount = manager.teamMembers.length;
    const vacantSeatsCount = Math.max(0, manager.teamSeatsLimit - occupiedSeatsCount);

    return {
      connectedAccountsCount: occupiedSeatsCount,
      teamSeatsLimit: manager.teamSeatsLimit,
      occupiedSeatsCount,
      members: [
        ...manager.teamMembers.map((member) => {
          const latestFeedback = member.feedback[0];
          const completedCardsCount = new Set(
            member.feedback
              .map((item) => String(item.sessionId || '').trim())
              .filter(Boolean),
          ).size;
          const emotionalState = this.buildTeamMemberEmotionalState({
            sessionTitle: latestFeedback?.session?.title ?? null,
            feedbackDescription: latestFeedback?.description ?? null,
            emotionAfter: latestFeedback?.emotionAfter ?? null,
          });

          return {
            id: member.id,
            userId: member.userId,
            username: member.username,
            fullName: member.fullName,
            isRegistered: true,
            hasCompletedOnboarding: this.hasCompletedOnboarding(
              member.dailyPracticeMinutes,
            ),
            completedCardsCount,
            coinsRating: Number(member.balances[0]?.amount ?? 0),
            emotionalState,
            emotionalTone: this.getEmotionalTone(
              `${latestFeedback?.emotionAfter || ''} ${latestFeedback?.description || ''} ${
                emotionalState || ''
              }`,
            ),
            lastFeedbackAt: latestFeedback?.createdAt?.toISOString?.() ?? null,
          };
        }),
        ...Array.from({ length: vacantSeatsCount }, (_, index) => ({
          id: `vacant-${index + 1}`,
          userId: null,
          username: `slot_${index + 1}`,
          fullName: `Слот ${occupiedSeatsCount + index + 1}`,
          isRegistered: false,
          hasCompletedOnboarding: false,
          completedCardsCount: 0,
          coinsRating: 0,
          emotionalState: null,
          emotionalTone: null,
          lastFeedbackAt: null,
        })),
      ],
    };
  }

  async configureManagerAccess(
    dto: ManagerAccessSetupDto,
  ): Promise<ManagerAccessSetupResponseDto> {
    const email = (dto.email || '').trim().toLowerCase();
    const teamSeatsLimit = Math.max(1, Math.floor(Number(dto.teamSeatsLimit || 20)));

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, teamInviteCode: true },
    });

    if (!user?.email) {
      throw new NotFoundException('Пользователь не найден');
    }

    const inviteCode = user.teamInviteCode || this.generateTeamInviteCode();
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountType: AccountType.MANAGER,
        teamSeatsLimit,
        teamInviteCode: inviteCode,
      },
      select: {
        id: true,
        email: true,
        accountType: true,
        teamSeatsLimit: true,
        teamInviteCode: true,
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/+$/, '') ||
      'https://seee.app';

    return {
      userId: updated.id,
      email: updated.email || email,
      accountType: 'MANAGER',
      teamSeatsLimit: updated.teamSeatsLimit,
      salesReferralLink: `${frontendUrl}/?ref=${updated.id}&utm_source=referral`,
      employeeInviteLink: `${frontendUrl}/register?team=${updated.teamInviteCode}`,
    };
  }

  private getEmotionalTone(emotionRaw?: string | null): string | null {
    const emotion = String(emotionRaw || '').trim().toLowerCase();
    if (!emotion) return null;

    const negativeMarkers = [
      'трев',
      'стресс',
      'устал',
      'выгор',
      'подав',
      'груст',
      'тяжело',
      'разбит',
      'зл',
      'раздраж',
      'апат',
    ];
    if (negativeMarkers.some((marker) => emotion.includes(marker))) {
      return 'Требует внимания';
    }

    const positiveMarkers = [
      'спокой',
      'уверен',
      'рад',
      'хорош',
      'стабиль',
      'вдохнов',
      'мотив',
      'легче',
      'лучше',
    ];
    if (positiveMarkers.some((marker) => emotion.includes(marker))) {
      return 'Стабильный';
    }

    return 'Нейтральный';
  }

  private hasCompletedOnboarding(
    dailyPracticeMinutes?: number | null,
  ): boolean {
    return (
      dailyPracticeMinutes === 5 ||
      dailyPracticeMinutes === 10 ||
      dailyPracticeMinutes === 15
    );
  }

  private buildTeamMemberEmotionalState(params: {
    sessionTitle?: string | null;
    feedbackDescription?: string | null;
    emotionAfter?: string | null;
  }): string | null {
    const sessionTitle = String(params.sessionTitle || '').trim();
    const feedbackDescription = String(params.feedbackDescription || '')
      .replace(/\s+/g, ' ')
      .trim();
    const emotionAfter = String(params.emotionAfter || '').trim();
    const corpus = `${emotionAfter} ${feedbackDescription} ${sessionTitle}`
      .toLowerCase()
      .replace(/ё/g, 'е')
      .trim();

    if (!corpus) return null;

    const tone = this.getEmotionalTone(corpus);
    const topicLead = sessionTitle ? `По теме «${sessionTitle}» ` : '';

    if (tone === 'Стабильный') {
      if (emotionAfter) {
        return `${topicLead}после последнего разбора чувствуется больше опоры и спокойствия: ${emotionAfter}.`;
      }
      return `${topicLead}после последнего разбора состояние выглядит более спокойным и устойчивым.`;
    }

    if (tone === 'Требует внимания') {
      if (emotionAfter) {
        return `${topicLead}после последнего разбора напряжение ещё сохраняется: ${emotionAfter}.`;
      }
      return `${topicLead}в фоне ещё остаются напряжение, усталость или тревога.`;
    }

    if (emotionAfter) {
      return `${topicLead}состояние после последнего разбора описывается так: ${emotionAfter}.`;
    }

    return `${topicLead}состояние пока выглядит нейтральным, без явного перегруза.`;
  }

  assertSupportKey(keyRaw: string | undefined): void {
    if (!this.isSupportKeyValid(keyRaw)) {
      throw new UnauthorizedException('Invalid support key');
    }
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

  async createTelegramBotLinkToken(userId: string): Promise<{
    url: string;
    expiresAt: string;
  }> {
    const EXPIRES_MINUTES = 30;
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000);

    // One active token per user.
    await this.prisma.telegramLinkToken.upsert({
      where: { userId },
      update: { token, expiresAt },
      create: { token, userId, expiresAt },
      select: { id: true },
    });

    const botUsername =
      this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'SeeeAppBot';
    const url = `https://t.me/${botUsername}?start=link_${token}`;
    return { url, expiresAt: expiresAt.toISOString() };
  }

  async adminCreateTelegramBotLinkToken(
    adminUser: { id: string; role?: string },
    emailRaw: string,
  ): Promise<{ url: string; expiresAt: string; telegramLinked: boolean }> {
    if ((adminUser.role || '').toLowerCase() !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    const email = (emailRaw || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, telegramId: true, email: true },
    });
    if (!user?.id) {
      throw new NotFoundException('Пользователь не найден');
    }
    const { url, expiresAt } = await this.createTelegramBotLinkToken(user.id);
    return { url, expiresAt, telegramLinked: !!user.telegramId };
  }

  async supportGeneratePasswordResetLink(
    supportKey: string | undefined,
    emailRaw: string,
    expiresInMinutesRaw?: number,
  ): Promise<AdminGeneratePasswordResetLinkResponseDto> {
    this.assertSupportKey(supportKey);
    const email = (emailRaw || '').trim().toLowerCase();
    const expiresInMinutes =
      typeof expiresInMinutesRaw === 'number' && Number.isFinite(expiresInMinutesRaw)
        ? expiresInMinutesRaw
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

  async supportGenerateTelegramLink(
    supportKey: string | undefined,
    emailRaw: string,
  ): Promise<{ email: string; url: string; expiresAt: string; telegramLinked: boolean }> {
    this.assertSupportKey(supportKey);
    const email = (emailRaw || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, telegramId: true },
    });
    if (!user?.email) {
      throw new NotFoundException('Пользователь не найден');
    }
    const { url, expiresAt } = await this.createTelegramBotLinkToken(user.id);
    return { email: user.email, url, expiresAt, telegramLinked: !!user.telegramId };
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
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

      // Определяем источник регистрации: продажная ссылка или ссылка сотрудника
      let referrerId: string | null = null;
      let managerId: string | null = null;
      let accountType: AccountType = AccountType.USER;
      let subscriptionStatus: 'NONE' | 'ACTIVE' | 'CANCELED' = 'NONE';
      let subscriptionActive = false;
      let subscriptionProvider: string | null = null;
      let subscriptionExternalId: string | null = null;

      if (dto.teamInviteCode && dto.teamInviteCode.trim().length > 0) {
        const inviteCode = dto.teamInviteCode.trim().toUpperCase();
        const manager = await this.prisma.user.findFirst({
          where: {
            teamInviteCode: inviteCode,
            accountType: AccountType.MANAGER,
          },
          select: {
            id: true,
            teamSeatsLimit: true,
            _count: {
              select: { teamMembers: true },
            },
          },
        });

        if (!manager) {
          throw new BadRequestException('Ссылка для сотрудников недействительна');
        }
        if (manager._count.teamMembers >= manager.teamSeatsLimit) {
          throw new BadRequestException('Лимит регистраций по ссылке сотрудника исчерпан');
        }

        managerId = manager.id;
        accountType = AccountType.TEAM_MEMBER;
        subscriptionStatus = 'ACTIVE';
        subscriptionActive = true;
        subscriptionProvider = 'manager-team';
        subscriptionExternalId = inviteCode;
      } else if (dto.referrerId && dto.referrerId.trim().length > 0) {
        const refUser = await this.prisma.user.findUnique({
          where: { id: dto.referrerId.trim() },
          select: { id: true },
        });
        if (refUser) {
          referrerId = refUser.id;
        }
      }

      // Создаем пользователя
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash: hashedPassword,
          fullName: dto.name || null,
          userId,
          referrerId,
          managerId,
          accountType,
          subscriptionStatus,
          subscriptionActive,
          subscriptionProvider,
          subscriptionExternalId,
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
          accountType: AccountType.USER,
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

    const dataToUpdate: {
      username?: string;
      userId?: string;
      passwordHash?: string;
      dailyPracticeMinutes?: 5 | 10 | 15;
    } = {};

    if (typeof dto.password === 'string' && dto.password.length >= 6) {
      dataToUpdate.passwordHash = await bcrypt.hash(dto.password, 12);
    }

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

    if (dto.dailyPracticeMinutes === 5 || dto.dailyPracticeMinutes === 10 || dto.dailyPracticeMinutes === 15) {
      dataToUpdate.dailyPracticeMinutes = dto.dailyPracticeMinutes;
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

    // Начисляем реферальные вознаграждения (если есть)
    const rawAmount =
      Number(normalizedPayload?.amount ?? normalizedPayload?.sum ?? normalizedPayload?.price) || 0;
    const fallbackAmount = Number(
      this.configService.get<string>('SUBSCRIPTION_PRICE_RUB') || '0',
    );
    const amountForRewards = rawAmount > 0 ? rawAmount : fallbackAmount;

    if (amountForRewards > 0) {
      await this.allocateReferralRewards(user.id, amountForRewards);
    }
  }

  /**
   * Начисление реферальных вознаграждений:
   * 1 уровень — 20%, 2 уровень — 7% от суммы подписки.
   */
  private async allocateReferralRewards(
    subscribedUserId: string,
    subscriptionAmount: number,
  ): Promise<void> {
    if (!subscriptionAmount || !Number.isFinite(subscriptionAmount) || subscriptionAmount <= 0) {
      return;
    }

    const userWithReferrers = await this.prisma.user.findUnique({
      where: { id: subscribedUserId },
      select: {
        id: true,
        referrer: {
          select: {
            id: true,
            referrer: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!userWithReferrers || !userWithReferrers.referrer) {
      return;
    }

    const level1 = userWithReferrers.referrer;
    const level2 = level1.referrer || null;

    const level1Reward = +(subscriptionAmount * 0.2).toFixed(2);
    const level2Reward = level2 ? +(subscriptionAmount * 0.07).toFixed(2) : 0;

    await this.prisma.$transaction(async (tx) => {
      // 1 уровень — 20%
      await tx.balance.upsert({
        where: { userId: level1.id },
        update: {
          amount: { increment: level1Reward },
        },
        create: {
          userId: level1.id,
          amount: level1Reward,
        },
      });
      await tx.transaction.create({
        data: {
          userId: level1.id,
          amount: level1Reward,
          transactionType: 'PAYMENT',
          description: `Реферальное вознаграждение 1 уровня за подписку пользователя ${subscribedUserId}`,
        },
      });

      // 2 уровень — 7%
      if (level2 && level2Reward > 0) {
        await tx.balance.upsert({
          where: { userId: level2.id },
          update: {
            amount: { increment: level2Reward },
          },
          create: {
            userId: level2.id,
            amount: level2Reward,
          },
        });
        await tx.transaction.create({
          data: {
            userId: level2.id,
            amount: level2Reward,
            transactionType: 'PAYMENT',
            description: `Реферальное вознаграждение 2 уровня за подписку пользователя ${subscribedUserId}`,
          },
        });
      }
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
      role: user.role,
      accountType: user.accountType,
      dailyPracticeMinutes:
        user.dailyPracticeMinutes === 5 ||
        user.dailyPracticeMinutes === 10 ||
        user.dailyPracticeMinutes === 15
          ? user.dailyPracticeMinutes
          : null,
      telegramId: user.telegramId ?? null,
      userId: user.userId ?? null,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionActive: !!user.subscriptionActive,
      subscriptionEndsAt: user.subscriptionEndsAt
        ? new Date(user.subscriptionEndsAt).toISOString()
        : null,
    };
  }

  private generateTeamInviteCode(): string {
    return `TEAM${randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
