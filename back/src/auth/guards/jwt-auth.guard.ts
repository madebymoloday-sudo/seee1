import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Обработка ошибок истечения токена
    if (info instanceof TokenExpiredError) {
      throw new ForbiddenException('токен устарел');
    }

    // Обработка других JWT ошибок
    if (info instanceof JsonWebTokenError) {
      throw new UnauthorizedException('Недействительный токен');
    }

    // Обработка других ошибок
    if (err || !user) {
      throw err || new UnauthorizedException('Неавторизованный доступ');
    }

    return user;
  }
}

