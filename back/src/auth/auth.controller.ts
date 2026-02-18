import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Headers,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  AuthResponseDto,
  UserProfileDto,
  UpdateProfileDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SubscriptionStatusDto,
  RedeemPromoCodeDto,
} from './dto/auth.dto';
import { TelegramLoginDto, TelegramLinkDto } from './dto/telegram.dto';
import {
  AdminGeneratePasswordResetLinkDto,
  AdminGeneratePasswordResetLinkResponseDto,
} from './dto/admin.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход по email и паролю' })
  @ApiResponse({
    status: 200,
    description: 'Успешная авторизация',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Неверный email или пароль',
  })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiResponse({
    status: 201,
    description: 'Пользователь успешно зарегистрирован',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Пользователь с таким email или username уже существует',
  })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Запросить восстановление пароля' })
  @ApiResponse({
    status: 200,
    description: 'Ссылка отправлена на email и/или в Telegram',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Установить новый пароль по токену' })
  @ApiResponse({
    status: 200,
    description: 'Пароль успешно изменён',
  })
  @ApiResponse({
    status: 400,
    description: 'Токен недействителен или истёк',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

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
  async loginWithTelegram(
    @Body() dto: TelegramLoginDto,
  ): Promise<AuthResponseDto> {
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
  ): Promise<UserProfileDto> {
    return this.authService.linkTelegramAccount(req.user.id, dto);
  }

  @Post('admin/password-reset-link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Админ: сгенерировать reset link и вернуть в ответе (для ручной поддержки)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ссылка сгенерирована',
    type: AdminGeneratePasswordResetLinkResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неверный admin key' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async adminGeneratePasswordResetLink(
    @Request() req: { user: { id: string; role?: string } },
    @Body() dto: AdminGeneratePasswordResetLinkDto,
  ): Promise<AdminGeneratePasswordResetLinkResponseDto> {
    if ((req.user?.role || '').toLowerCase() !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    return this.authService.adminGeneratePasswordResetLink(dto);
  }

  @Post('telegram/link-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Сгенерировать ссылку для привязки Telegram через бота',
  })
  async createTelegramLinkToken(
    @Request() req: { user: { id: string } },
  ): Promise<{ url: string; expiresAt: string }> {
    return this.authService.createTelegramBotLinkToken(req.user.id);
  }

  @Post('admin/telegram/link-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Админ: сгенерировать ссылку привязки Telegram по email',
  })
  async adminCreateTelegramLinkToken(
    @Request() req: { user: { id: string; role?: string } },
    @Body() dto: { email: string },
  ): Promise<{ url: string; expiresAt: string; telegramLinked: boolean }> {
    if (!req.user?.id) {
      throw new ForbiddenException('No user');
    }
    return this.authService.adminCreateTelegramBotLinkToken(req.user, dto.email);
  }

  @Post('support/password-reset-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Support: получить reset link по email (возвращает ссылку)',
  })
  async supportPasswordResetLink(
    @Headers('x-support-key') supportKey: string | undefined,
    @Body() dto: { email: string; expiresInMinutes?: number },
  ): Promise<AdminGeneratePasswordResetLinkResponseDto> {
    return this.authService.supportGeneratePasswordResetLink(
      supportKey,
      dto.email,
      dto.expiresInMinutes,
    );
  }

  @Post('support/telegram-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Support: получить ссылку привязки Telegram через бота по email',
  })
  async supportTelegramLink(
    @Headers('x-support-key') supportKey: string | undefined,
    @Body() dto: { email: string },
  ): Promise<{ email: string; url: string; expiresAt: string; telegramLinked: boolean }> {
    return this.authService.supportGenerateTelegramLink(supportKey, dto.email);
  }

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
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить данные текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Данные пользователя',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  async getMe(@Request() req: { user: { id: string } }): Promise<UserProfileDto> {
    return this.authService.getMe(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить профиль текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Профиль обновлён',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 401, description: 'Неавторизованный доступ' })
  @ApiResponse({
    status: 409,
    description: 'Пользователь с таким username уже существует',
  })
  async updateMe(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.authService.updateMe(req.user.id, dto);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить текущий статус подписки' })
  @ApiResponse({
    status: 200,
    description: 'Статус подписки пользователя',
    type: SubscriptionStatusDto,
  })
  async getSubscription(
    @Request() req: { user: { id: string } },
  ): Promise<SubscriptionStatusDto> {
    return this.authService.getSubscriptionStatus(req.user.id);
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отменить подписку и заблокировать доступ' })
  @ApiResponse({
    status: 200,
    description: 'Подписка отменена',
    type: SubscriptionStatusDto,
  })
  async cancelSubscription(
    @Request() req: { user: { id: string } },
  ): Promise<SubscriptionStatusDto> {
    return this.authService.cancelSubscription(req.user.id);
  }

  @Post('subscription/redeem-promo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Активировать подписку по промокоду' })
  @ApiResponse({
    status: 200,
    description: 'Промокод применён, подписка активирована',
    type: SubscriptionStatusDto,
  })
  async redeemPromoCode(
    @Request() req: { user: { id: string } },
    @Body() dto: RedeemPromoCodeDto,
  ): Promise<SubscriptionStatusDto> {
    return this.authService.redeemPromoCode(req.user.id, dto.promoCode);
  }

  @Post('subscription/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook от Lava для обновления подписки' })
  @ApiResponse({
    status: 200,
    description: 'Webhook обработан',
  })
  async lavaWebhook(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() payload: Record<string, any>,
  ): Promise<{ ok: boolean }> {
    await this.authService.handleSubscriptionWebhook(apiKey, payload);
    return { ok: true };
  }
}

