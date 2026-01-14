# Инструкция по настройке Lava.top

## 1. API ключ Lava.top

**API ключ:** `fUl2wNcGBODURoZ8UfiEDiDbFbUwwgPXeMTKnfcFhCE4xTO7aYpifBaDh8GbG263`

### Настройка в Railway:

1. Откройте сервис `/back` в Railway
2. Перейдите в **Settings** → **Variables**
3. Добавьте или обновите переменную окружения:
   - **Key:** `LAVA_API_KEY`
   - **Value:** `fUl2wNcGBODURoZ8UfiEDiDbFbUwwgPXeMTKnfcFhCE4xTO7aYpifBaDh8GbG263`
4. Сохраните изменения
5. Перезапустите сервис `/back` (Redeploy)

### Альтернативно через Railway CLI:

```bash
railway variables set LAVA_API_KEY=fUl2wNcGBODURoZ8UfiEDiDbFbUwwgPXeMTKnfcFhCE4xTO7aYpifBaDh8GbG263 --service back
```

## 2. Виджет Lava.top

Виджет уже добавлен на страницу подписки (`/subscription`).

**Код виджета:**
```html
<iframe 
  title="lava.top" 
  style="border: none" 
  width="350" 
  height="60" 
  src="https://widget.lava.top/c7af956a-6721-443b-b940-ab161161afa7"
/>
```

**Расположение:** `front/src/pages/subscription/SubscriptionPage.tsx` (строки 169-178)

## 3. Проверка работы

После настройки API ключа:

1. Проверьте логи бэкенда - не должно быть ошибок `LAVA_API_KEY не настроен`
2. Попробуйте оформить подписку на странице `/subscription`
3. Виджет Lava.top должен отображаться внизу страницы подписки

## 4. Дополнительные переменные (опционально)

Если нужно изменить базовый URL API:
- **Key:** `LAVA_API_BASE_URL`
- **Value:** `https://gate.lava.top` (по умолчанию)
