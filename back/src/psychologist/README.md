# Psychologist Module - LangGraph Integration

## Обзор

Модуль психолога использует LangGraph.js для реализации структурированного пайплайна из 9 шагов для работы с пользователем.

## Пайплайн шагов

1. **PROBLEM** - Описание проблемы
2. **EMOTION** - Эмоция от проблемы
3. **THOUGHT** - Мысль, порождающая эмоцию
4. **WHY** - Почему возникла мысль
5. **IDEAS** - Альтернативные идеи от бота
6. **FOUNDER** - Основатель идеи
7. **PURPOSE** - Цель основателя
8. **CONSEQUENCES** - Эмоциональные последствия
9. **CONCLUSION** - Вывод пользователя

## Как отправлять сообщения

### 1. Через REST API

**POST** `/api/v1/sessions/:sessionId/messages`

```json
{
  "content": "Меня беспокоит экзамен"
}
```

**Ответ:**
```json
{
  "id": "uuid",
  "role": "user",
  "content": "Меня беспокоит экзамен",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

AI автоматически обработает сообщение через пайплайн и вернет ответ.

### 2. Через WebSocket

**Подключение:**
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});
```

**Отправка сообщения:**
```typescript
socket.emit('message', {
  sessionId: 'session-id',
  content: 'Меня беспокоит экзамен',
  userId: 'user-id'
});
```

**Получение ответа:**
```typescript
socket.on('message', (data) => {
  console.log(data);
  // {
  //   sessionId: 'session-id',
  //   role: 'assistant',
  //   content: 'Какую эмоцию вызывает у вас эта проблема?',
  //   timestamp: Date
  // }
});
```

## Состояние пайплайна

Состояние пайплайна автоматически сохраняется в БД в таблице `pipeline_states`:

```typescript
interface PipelineState {
  sessionId: string;
  currentStep: PipelineStep;
  problem?: string;
  emotion?: string;
  thought?: string;
  whyAnswer?: string;
  botIdeas?: string[];
  founder?: string;
  purposeOptions?: string[];
  consequences?: string[];
  conclusion?: string;
  completed: boolean;
}
```

## Конфигурация вопросов

Вопросы и промпты настраиваются в `config/pipeline-questions.json`. Можно изменить формулировки без изменения кода.

## Пример использования

```typescript
// 1. Создать сессию
POST /api/v1/sessions
{
  "title": "Тревога перед экзаменом"
}

// 2. Отправить первое сообщение
POST /api/v1/sessions/{sessionId}/messages
{
  "content": "Меня беспокоит экзамен"
}

// AI ответит: "Какую эмоцию вызывает у вас эта проблема?"

// 3. Ответить на вопрос
POST /api/v1/sessions/{sessionId}/messages
{
  "content": "Тревога"
}

// AI продолжит пайплайн...
```

## Завершение пайплайна

Когда пайплайн завершен (`completed: true`), пользователь может:
- Сохранить результаты в нейрокарту через `POST /api/v1/sessions/:id/add-to-map`
- Скачать документ сессии через `GET /api/v1/sessions/:id/document`

