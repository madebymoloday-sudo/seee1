# Настройка Lava.top

## API ключ
```
fUl2wNcGBODURoZ8UfiEDiDbFbUwwgPXeMTKnfcFhCE4xTO7aYpifBaDh8GbG263
```

## Виджет для сайта
```html
<iframe title="lava.top" style="border: none" width="350" height="60" src="https://widget.lava.top/c7af956a-6721-443b-b940-ab161161afa7"></iframe>
```

## Настройка в Railway

1. Откройте сервис `/back` в Railway
2. Перейдите в **Settings** → **Variables**
3. Добавьте или обновите переменную окружения:
   - **Key:** `LAVA_API_KEY`
   - **Value:** `fUl2wNcGBODURoZ8UfiEDiDbFbUwwgPXeMTKnfcFhCE4xTO7aYpifBaDh8GbG263`
4. Сохраните изменения
5. Railway автоматически перезапустит сервис

## Дополнительные переменные (опционально)

- `LAVA_API_URL` = `https://gate.lava.top` (уже настроено по умолчанию)
- `LAVA_WEBHOOK_URL` = `https://ваш-домен/api/v1/subscription/webhook/lava`

## Виджет на сайте

Виджет Lava.top уже добавлен на страницу подписки (`/subscription`).
