import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
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
} from './dto/auth.dto';
import { TelegramLoginDto, TelegramLinkDto } from './dto/telegram.dto';

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
}

