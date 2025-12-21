import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async generateTokens(userId: string, email: string | null) {
    // Получаем роль пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const payload = { sub: userId, email, role: user?.role || 'user' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.generateRefreshToken(userId),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        this.parseDays(
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
    );

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: randomBytes(64).toString('hex'),
        expiresAt,
        userId,
      },
    });

    const payload = { sub: userId, tokenId };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
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
        throw new UnauthorizedException('Недействительный refresh token');
      }

      // Удаляем старый refresh token
      await this.prisma.refreshToken.delete({
        where: { id: payload.tokenId },
      });

      // Генерируем новые токены (включая роль)
      return this.generateTokens(tokenRecord.user.id, tokenRecord.user.email);
    } catch {
      throw new UnauthorizedException('Недействительный refresh token');
    }
  }

  private parseDays(expiresIn: string): number {
    const match = expiresIn.match(/(\d+)d/);
    return match ? parseInt(match[1], 10) : 7;
  }
}

