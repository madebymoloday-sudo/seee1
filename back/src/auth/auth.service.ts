import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { TelegramAuthService } from './telegram-auth.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { LoginDto, RegisterDto, AuthResponseDto, UserProfileDto } from './dto/auth.dto';
import { TelegramLoginDto, TelegramLinkDto } from './dto/telegram.dto';

@Injectable()
export class AuthService {
  private readonly authUserSelect = {
    id: true,
    username: true,
    email: true,
    fullName: true,
    avatarUrl: true,
    telegramId: true,
    role: true,
  };

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private telegramAuthService: TelegramAuthService,
  ) {}

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
    // Проверяем, существует ли пользователь
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
    };
  }
}

