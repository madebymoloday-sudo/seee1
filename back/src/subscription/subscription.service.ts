import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LavaService, InvoiceResponse } from '../integrations/lava/lava.service';
import { PurchaseSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionPlan } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private lavaService: LavaService,
    private configService: ConfigService,
  ) {}

  /**
   * Проверяет, является ли пользователь администратором
   */
  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'admin';
  }

  /**
   * Создает или возвращает мок-подписку для администратора
   */
  private async getOrCreateAdminSubscription(userId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      // Создаем мок-подписку на год для админа
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          plan: SubscriptionPlan.YEARLY,
          status: 'ACTIVE',
          expiresAt,
          autoRenew: true,
          paymentMethod: 'mock',
          lavaOrderId: null,
        },
      });
    } else if (subscription.status !== 'ACTIVE' || !subscription.expiresAt || subscription.expiresAt < new Date()) {
      // Обновляем подписку админа, если она истекла
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: SubscriptionPlan.YEARLY,
          status: 'ACTIVE',
          expiresAt,
          autoRenew: true,
          paymentMethod: 'mock',
          lavaOrderId: null,
        },
      });
    }

    return subscription;
  }

  async getSubscription(userId: string) {
    // Для администраторов всегда возвращаем активную мок-подписку
    const isUserAdmin = await this.isAdmin(userId);
    if (isUserAdmin) {
      return this.getOrCreateAdminSubscription(userId);
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return null;
    }

    // Проверяем, не истекла ли подписка
    if (
      subscription.status === 'ACTIVE' &&
      subscription.expiresAt &&
      subscription.expiresAt < new Date()
    ) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });

      return {
        ...subscription,
        status: 'EXPIRED',
      };
    }

    return subscription;
  }

  async checkSubscriptionActive(userId: string): Promise<boolean> {
    // Администраторы всегда имеют активную подписку
    const isUserAdmin = await this.isAdmin(userId);
    if (isUserAdmin) {
      return true;
    }

    const subscription = await this.getSubscription(userId);
    return (
      subscription?.status === 'ACTIVE' &&
      subscription.expiresAt &&
      subscription.expiresAt > new Date()
    );
  }

  async getTransactions(userId: string) {
    // Получаем все транзакции типа PAYMENT (оплата подписки)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        transactionType: 'PAYMENT',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Ограничиваем последними 50 транзакциями
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: Number(transaction.amount),
      description: transaction.description || 'Оплата подписки',
      createdAt: transaction.createdAt,
    }));
  }

  async purchaseSubscription(userId: string, dto: PurchaseSubscriptionDto) {
    const { planId, promoCode, paymentMethod = 'lava' } = dto;

    // Для администраторов всегда используем мок-подписку
    const isUserAdmin = await this.isAdmin(userId);
    if (isUserAdmin) {
      return this.createMockSubscription(userId, planId);
    }

    // Если способ оплаты 'mock', создаем подписку без реальной оплаты
    if (paymentMethod === 'mock') {
      return this.createMockSubscription(userId, planId);
    }

    // Получаем план
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new BadRequestException('Неверный план подписки');
    }

    // Применяем промокод если есть
    let finalPrice = plan.price;
    if (promoCode) {
      const discount = await this.validatePromoCode(promoCode);
      finalPrice = plan.price - discount;
    }

    // Проверяем баланс если оплата с баланса
    if (paymentMethod === 'balance') {
      const balance = await this.prisma.balance.findUnique({
        where: { userId },
      });

      if (!balance || Number(balance.amount) < finalPrice) {
        throw new BadRequestException('Недостаточно средств на балансе');
      }
    }

    // Создаем платеж через Lava API
    let lavaOrderId: string | null = null;
    let paymentUrl: string | null = null;
    if (paymentMethod !== 'balance') {
      // Получаем email пользователя для Lava API
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        throw new BadRequestException(
          'Для оформления подписки необходимо указать email в профиле пользователя.'
        );
      }

      // Получаем offerId для плана подписки
      const offerIdMap: Record<string, string> = {
        monthly: this.configService.get<string>('LAVA_OFFER_ID_MONTHLY') || '',
        quarterly: this.configService.get<string>('LAVA_OFFER_ID_QUARTERLY') || '',
        yearly: this.configService.get<string>('LAVA_OFFER_ID_YEARLY') || '',
      };

      const offerId = offerIdMap[planId] || this.configService.get<string>('LAVA_OFFER_ID') || '';

      if (!offerId) {
        throw new BadRequestException(
          'LAVA_OFFER_ID не настроен. Укажите LAVA_OFFER_ID или LAVA_OFFER_ID_MONTHLY/QUARTERLY/YEARLY в переменных окружения.'
        );
      }

      const order = await this.lavaService.createPayment({
        amount: finalPrice,
        orderId: `sub_${userId}_${Date.now()}`,
        paymentMethod,
        successUrl: `${process.env.FRONTEND_URL}/subscription/success`,
        failUrl: `${process.env.FRONTEND_URL}/subscription?error=payment_failed`,
        email: user.email,
        offerId: offerId,
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
        status: paymentMethod === 'balance' ? 'ACTIVE' : 'PENDING',
        expiresAt,
        autoRenew: true,
        paymentMethod,
        lavaOrderId,
      },
      update: {
        plan: plan.planType,
        status: paymentMethod === 'balance' ? 'ACTIVE' : 'PENDING',
        expiresAt,
        paymentMethod,
        lavaOrderId,
      },
    });

    // Если оплата с баланса - списываем средства
    if (paymentMethod === 'balance') {
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
          transactionType: 'PAYMENT',
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

  async confirmPayment(lavaOrderId: string): Promise<InvoiceResponse> {
    // Проверяем статус платежа через Lava API
    const order = await this.lavaService.getOrderStatus(lavaOrderId);

    // Lava может возвращать статусы: 'success', 'paid', 'pending', 'failed'
    if (order.status === 'success' || order.status === 'paid') {
      const subscription = await this.prisma.subscription.findUnique({
        where: { lavaOrderId },
      });

      if (subscription && subscription.status !== 'ACTIVE') {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
          },
        });

        // Создаем транзакцию для истории
        const plan = this.getPlanById(
          subscription.plan === 'MONTHLY'
            ? 'monthly'
            : subscription.plan === 'QUARTERLY'
              ? 'quarterly'
              : 'yearly',
        );

        if (plan) {
          await this.prisma.transaction.create({
            data: {
              userId: subscription.userId,
              amount: -plan.price,
              transactionType: 'PAYMENT',
              description: `Оплата подписки ${plan.name}`,
            },
          });
        }
      }
    }

    return order;
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: false,
        status: 'CANCELLED',
      },
    });
  }

  async validatePromoCode(code: string): Promise<number> {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promoCode || !promoCode.isActive) {
      throw new BadRequestException('Промокод недействителен');
    }

    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      throw new BadRequestException('Промокод истек');
    }

    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      throw new BadRequestException('Промокод исчерпан');
    }

    // Увеличиваем счетчик использования
    await this.prisma.promoCode.update({
      where: { id: promoCode.id },
      data: {
        currentUses: {
          increment: 1,
        },
      },
    });

    // Возвращаем скидку (amount или percent)
    if (promoCode.discountAmount) {
      return Number(promoCode.discountAmount);
    }
    // TODO: Если discountPercent, нужно вычислять процент от суммы
    return 0;
  }

  private getPlanById(planId: string): {
    planType: SubscriptionPlan;
    name: string;
    price: number;
    duration: number;
  } | null {
    const plans: Record<
      string,
      { planType: SubscriptionPlan; name: string; price: number; duration: number }
    > = {
      monthly: {
        planType: SubscriptionPlan.MONTHLY,
        name: 'Месячная подписка',
        price: 990,
        duration: 30,
      },
      quarterly: {
        planType: SubscriptionPlan.QUARTERLY,
        name: 'Квартальная подписка',
        price: 2490,
        duration: 90,
      },
      yearly: {
        planType: SubscriptionPlan.YEARLY,
        name: 'Годовая подписка',
        price: 8990,
        duration: 365,
      },
    };

    return plans[planId] || null;
  }

  /**
   * Создает моковую подписку для разработки
   */
  private async createMockSubscription(userId: string, planId: string) {
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new BadRequestException('Неверный план подписки');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.duration);

    // Создаем или обновляем подписку в БД
    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: plan.planType,
        status: 'ACTIVE',
        expiresAt,
        autoRenew: true,
        paymentMethod: 'mock',
        lavaOrderId: null,
      },
      update: {
        plan: plan.planType,
        status: 'ACTIVE',
        expiresAt,
        autoRenew: true,
        paymentMethod: 'mock',
        lavaOrderId: null,
      },
    });

    return {
      subscription,
      paymentUrl: null,
      sessionId: null,
    };
  }
}

