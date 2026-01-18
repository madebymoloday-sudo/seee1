import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Не авторизован');
    }

    // TODO: Временно отключена проверка подписки для мок-режима
    // const isActive = await this.subscriptionService.checkSubscriptionActive(
    //   userId,
    // );

    // if (!isActive) {
    //   throw new ForbiddenException(
    //     'Требуется активная подписка для доступа к этому функционалу',
    //   );
    // }

    return true;
  }
}

