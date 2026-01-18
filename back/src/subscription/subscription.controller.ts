import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { InvoiceResponse } from "../integrations/lava/lava.service";
import {
  PurchaseSubscriptionDto,
  SubscriptionResponseDto,
  TransactionDto,
} from "./dto/subscription.dto";
import { SubscriptionService } from "./subscription.service";

@ApiTags("Subscription")
@Controller("subscription")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: "Получить текущую подписку пользователя" })
  @ApiResponse({
    status: 200,
    description: "Подписка пользователя",
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: "Подписка не найдена",
    schema: {
      type: "null",
    },
  })
  async getSubscription(
    @Request() req: { user: { id: string } },
    @Res() res: Response,
  ): Promise<void> {
    const subscription = await this.subscriptionService.getSubscription(
      req.user.id,
    );
    // Явно возвращаем JSON null вместо пустого тела
    if (subscription === null) {
      res.json(null);
    } else {
      res.json(subscription);
    }
  }

  @Get("transactions")
  @ApiOperation({ summary: "Получить транзакции оплаты подписки" })
  @ApiResponse({
    status: 200,
    description: "Список транзакций",
    type: [TransactionDto],
  })
  async getTransactions(
    @Request() req: { user: { id: string } }
  ): Promise<TransactionDto[]> {
    return this.subscriptionService.getTransactions(req.user.id);
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
  async confirmPayment(@Body() body: { orderId: string }): Promise<InvoiceResponse> {
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
  @Public()
  @Post("webhook/lava")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для уведомлений от Lava API" })
  async handleLavaWebhook(@Body() body: any) {
    this.logger.log(`[Lava Webhook] Received: ${JSON.stringify(body)}`);

    // Lava отправляет уведомления в формате:
    // { orderId, status, invoiceId, ... }
    const orderId = body.orderId || body.invoiceId;
    const status = body.status;

    if (orderId) {
      // Если статус успешный или это моковый orderId, подтверждаем платеж
      if (status === 'success' || status === 'paid' || orderId.startsWith('mock_')) {
        await this.subscriptionService.confirmPayment(orderId);
      }
      return { received: true, processed: true };
    }

    return { received: true };
  }

  // Эндпоинт для моковой активации подписки (только для разработки)
  @Post("mock/activate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "[DEV ONLY] Моковая активация подписки" })
  async mockActivate(
    @Request() req: { user: { id: string } },
    @Body() body: { planId?: string }
  ) {
    const planId = body.planId || "monthly";
    return this.subscriptionService.purchaseSubscription(req.user.id, {
      planId,
      paymentMethod: "mock",
    });
  }
}
