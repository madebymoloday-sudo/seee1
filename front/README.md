# Frontend SEEE

Фронтенд приложение для системы AI-психолога SEEE.

## Технологический стек

- **Framework**: React 18+ с TypeScript
- **State Management**: MobX
- **Data Fetching**: useSWR + apiAgent
- **API Client Generation**: Orval
- **Routing**: React Router
- **UI Library**: shadcn/ui (базовые компоненты)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`

## Генерация API клиентов

Для генерации TypeScript клиентов из Swagger документации:

```bash
npm run generate:api
```

Это создаст:
- `src/api/seee.swr.ts` - SWR хуки для реактивных данных
- `src/api/seee.axios.ts` - Axios функции для ручных вызовов
- `src/api/schemas/` - TypeScript типы

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
VITE_TELEGRAM_BOT_ID=your-telegram-bot-id
```

## Структура проекта

```
front/
├── src/
│   ├── api/                        # API клиенты (генерируются Orval)
│   ├── store/                      # MobX stores
│   │   ├── rootStore.ts
│   │   ├── auth/
│   │   ├── sessions/
│   │   └── ui/
│   ├── components/                 # React компоненты
│   │   ├── ui/                     # Базовые UI компоненты
│   │   └── layout/                 # Layout компоненты
│   ├── pages/                      # Страницы
│   │   ├── auth/
│   │   ├── sessions/
│   │   ├── map/
│   │   ├── cabinet/
│   │   └── journal/
│   ├── hooks/                      # Custom hooks
│   ├── lib/                        # Утилиты
│   │   ├── api.ts                  # ApiAgent
│   │   ├── socket.ts               # Socket.IO client
│   │   └── utils.ts
│   └── router/                     # Роутинг
├── orval.config.ts                 # Конфигурация Orval
└── package.json
```

## Страницы

- `/login` - Вход в систему
- `/register` - Регистрация
- `/` - Список сессий
- `/sessions/:id` - Диалог сессии
- `/map` - Нейрокарта
- `/cabinet` - Личный кабинет
- `/journal` - Журнал сессий

## Разработка

### Добавление нового API эндпоинта

1. Обновите Swagger документацию на бэкенде
2. Запустите `npm run generate:api`
3. Используйте сгенерированные хуки в компонентах

### Использование MobX stores

```typescript
import { observer } from "mobx-react-lite";
import { useAuth } from "../hooks/useAuth";

const MyComponent = observer(() => {
  const { user, isAuthenticated } = useAuth();
  // ...
});
```

### Использование SWR

```typescript
import { useGetSessions } from "../api/seee.swr";

const SessionsList = () => {
  const { data, error, isLoading } = useGetSessions();
  // ...
};
```

## Сборка

```bash
npm run build
```

Собранные файлы будут в папке `dist/`

## Линтинг

```bash
npm run lint
```
