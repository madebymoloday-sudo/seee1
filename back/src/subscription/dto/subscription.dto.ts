import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class PurchaseSubscriptionDto {
  @ApiProperty({
    description: 'ID плана подписки',
    example: 'monthly',
    enum: ['monthly', 'quarterly', 'yearly'],
  })
  @IsString()
  @IsEnum(['monthly', 'quarterly', 'yearly'])
  planId: string;

  @ApiProperty({
    description: 'Промокод (опционально)',
    example: 'PROMO2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiProperty({
    description: 'Способ оплаты',
    example: 'lava',
    enum: ['lava', 'card', 'yookassa', 'balance', 'mock'],
  })
  @IsString()
  @IsEnum(['lava', 'card', 'yookassa', 'balance', 'mock'])
  paymentMethod: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({ description: 'ID подписки' })
  id: string;

  @ApiProperty({ description: 'План подписки' })
  plan: string;

  @ApiProperty({ description: 'Статус подписки' })
  status: string;

  @ApiProperty({ description: 'Дата истечения' })
  expiresAt: Date | null;

  @ApiProperty({ description: 'Автопродление' })
  autoRenew: boolean;
}

export class TransactionDto {
  @ApiProperty({ description: 'ID транзакции' })
  id: string;

  @ApiProperty({ description: 'Сумма транзакции' })
  amount: number;

  @ApiProperty({ description: 'Описание транзакции' })
  description: string;

  @ApiProperty({ description: 'Дата создания транзакции' })
  createdAt: Date;
}

