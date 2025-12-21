# Интеграция с Lava Payment

## Настройка

### 1. Создание продуктов в Lava

**ВАЖНО**: API Lava работает с продуктами (offers), а не с произвольными суммами.

1. Зайдите в личный кабинет Lava: https://lava.top
2. Создайте продукты для каждого типа подписки:
   - Месячная подписка (990 ₽)
   - Квартальная подписка (2490 ₽)
   - Годовая подписка (8990 ₽)
3. Для каждого продукта получите **Offer ID** (UUID)
4. Сохраните эти ID для настройки

### 2. Переменные окружения

Добавьте следующие переменные в ваш `.env` файл:

```env
# Lava Payment Integration
LAVA_API_KEY="KeLmBoJINi6PXLuM0lODRD5EPkWw5O0p9SILz9L5oHDpYjq1jrpp4TgGdpPxCfOt"
LAVA_API_BASE_URL="https://gate.lava.top"

# Offer ID для каждого типа подписки (обязательно!)
LAVA_OFFER_ID_MONTHLY="uuid-месячной-подписки"
LAVA_OFFER_ID_QUARTERLY="uuid-квартальной-подписки"
LAVA_OFFER_ID_YEARLY="uuid-годовой-подписки"

# Или один общий offerId (если используете один продукт для всех)
LAVA_OFFER_ID="uuid-продукта"

# Webhook URL (опционально, но рекомендуется)
LAVA_WEBHOOK_URL="http://your-domain.com/api/v1/subscription/webhook/lava"
FRONTEND_URL="http://localhost:5171"
```

### 3. Настройка Webhook

В личном кабинете Lava настройте webhook URL:
```
http://your-domain.com/api/v1/subscription/webhook/lava
```

**Важно**: Создайте два webhook:
1. **Результат платежа** - для первого платежа по подписке
2. **Регулярный платеж** - для последующих платежей по подписке

Webhook будет автоматически обрабатывать уведомления о статусе платежей и активировать подписки.

### 4. Требования к пользователям

Для оформления подписки пользователь должен иметь **email** в профиле. Если email отсутствует, будет возвращена ошибка.

### 5. Тестирование

После настройки переменных окружения:

1. Перезапустите бэкенд сервер
2. Убедитесь, что у пользователя есть email в профиле
3. Попробуйте оформить подписку через фронтенд
4. Проверьте логи бэкенда для отладки

## Структура API

Согласно документации [https://gate.lava.top/docs](https://gate.lava.top/docs):
- **Базовый URL**: `https://gate.lava.top`
- **Эндпоинт**: `POST /api/v3/invoice`
- **Авторизация**: Заголовок `X-Api-Key` с API ключом
- **Обязательные поля**: `email`, `offerId`, `currency`

## API Endpoints

### Создание платежа
```
POST /api/v1/subscription/purchase
Body: {
  planId: "monthly" | "quarterly" | "yearly",
  paymentMethod: "lava",
  promoCode?: string
}
```

### Webhook от Lava
```
POST /api/v1/subscription/webhook/lava
Body: {
  orderId: string,
  status: "success" | "paid" | "pending" | "failed",
  invoiceId?: string
}
```

## Структура ответа

При создании платежа возвращается:
```json
{
  "subscription": {...},
  "paymentUrl": "https://pay.lava.ru/...",
  "sessionId": "sub_userId_timestamp"
}
```

Если `paymentUrl` присутствует, пользователь будет перенаправлен на страницу оплаты Lava.

## Статусы платежей

- `pending` - платеж создан, ожидает оплаты
- `success` / `paid` - платеж успешно выполнен, подписка активирована
- `failed` - платеж не прошел

## Отладка

Логи Lava API доступны в консоли бэкенда с префиксом `[Lava API]`.

Для проверки статуса платежа используйте:
```typescript
await lavaService.getOrderStatus(orderId);
```

