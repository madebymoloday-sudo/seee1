# Frontend Technical Specification - SEEE

## Технологический стек

- **Framework**: React 18+
- **State Management**: MobX
- **Data Fetching**: useSWR + apiAgent (одновременно)
- **API Client Generation**: Orval
- **Routing**: React Router
- **UI Library**: shadcn/ui (или аналогичная)
- **Styling**: Tailwind CSS
- **TypeScript**: Строгая типизация
- **Build Tool**: Vite

---

## Архитектура

### Структура проекта

```
frontend/
├── src/
│   ├── main.tsx                    # Точка входа
│   ├── App.tsx                     # Корневой компонент
│   ├── api/                        # API клиенты (генерируются Orval)
│   │   ├── bazzza.swr.ts          # SWR хуки
│   │   ├── bazzza.axios.ts        # Axios функции
│   │   ├── mutator.ts             # Axios instance + interceptors
│   │   └── schemas/                # TypeScript типы
│   ├── store/                      # MobX stores
│   │   ├── rootStore.ts
│   │   ├── auth/
│   │   ├── sessions/
│   │   └── ui/
│   ├── components/                 # React компоненты
│   │   ├── ui/                     # Базовые UI компоненты (shadcn/ui)
│   │   ├── forms/                  # Переиспользуемые формы
│   │   ├── widgets/                # Виджеты
│   │   └── layout/                 # Layout компоненты
│   │       └── Layout.tsx
│   ├── pages/                      # Страницы
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── components/
│   │   ├── sessions/
│   │   │   ├── SessionsPage.tsx
│   │   │   ├── SessionPage.tsx
│   │   │   └── components/
│   │   ├── map/
│   │   │   ├── MapPage.tsx
│   │   │   └── components/
│   │   ├── cabinet/
│   │   │   ├── CabinetPage.tsx
│   │   │   └── components/
│   │   └── journal/
│   │       ├── JournalPage.tsx
│   │       └── components/
│   ├── hooks/                      # Custom hooks
│   ├── lib/                        # Утилиты
│   │   ├── api.ts                  # ApiAgent
│   │   └── utils.ts
│   └── router/                      # Роутинг
├── orval.config.ts                  # Конфигурация Orval
└── package.json
```

---

## Правила кодирования

### 1. API Client Generation (Orval)

**Конфигурация:**

```typescript
// orval.config.ts
import { defineConfig } from "orval";

export default defineConfig({
  // SWR хуки для реактивных данных
  seeeSWR: {
    input: "http://localhost:3000/api-json", // Swagger JSON
    output: {
      mode: "single",
      target: "./src/api/seee.swr.ts",
      client: "swr",
      schemas: "./src/api/schemas",
      override: {
        mutator: {
          path: "./src/api/mutator.ts",
          name: "swrMutator",
        },
      },
    },
  },

  // Axios функции для ручных вызовов
  seeeApi: {
    input: "http://localhost:3000/api-json",
    output: {
      mode: "single",
      target: "./src/api/seee.axios.ts",
      client: "axios",
      schemas: "./src/api/schemas",
      override: {
        mutator: {
          path: "./src/api/mutator.ts",
          name: "axiosInstance",
        },
      },
    },
  },
});
```

**Генерация:**

```bash
npm run generate:api
# или
npx orval
```

### 2. ApiAgent

**Класс для ручных API вызовов:**

```typescript
// src/lib/api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

class ApiAgent {
  axiosInstance: AxiosInstance;
  private baseUrl: string;

  constructor(apiUrl: string) {
    this.baseUrl = apiUrl;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
    });

    // Авторизация через interceptor
    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Refresh token interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Логика refresh token
          const refreshToken = localStorage.getItem("refreshToken");
          if (refreshToken) {
            try {
              const { data } = await axios.post(
                `${this.baseUrl}/auth/refresh`,
                {
                  refreshToken,
                }
              );
              localStorage.setItem("accessToken", data.accessToken);
              localStorage.setItem("refreshToken", data.refreshToken);
              // Повторяем запрос
              error.config.headers.Authorization = `Bearer ${data.accessToken}`;
              return this.axiosInstance.request(error.config);
            } catch {
              // Логика выхода
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              window.location.href = "/login";
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<R>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return (await this.axiosInstance.get(url, config)).data;
  }

  async post<P, R>(
    url: string,
    data?: P,
    config?: AxiosRequestConfig
  ): Promise<R> {
    return (await this.axiosInstance.post(url, data, config)).data;
  }

  async put<P, R>(
    url: string,
    data?: P,
    config?: AxiosRequestConfig
  ): Promise<R> {
    return (await this.axiosInstance.put(url, data, config)).data;
  }

  async patch<P, R>(
    url: string,
    data?: P,
    config?: AxiosRequestConfig
  ): Promise<R> {
    return (await this.axiosInstance.patch(url, data, config)).data;
  }

  async delete(url: string, config?: AxiosRequestConfig): Promise<void> {
    await this.axiosInstance.delete(url, config);
  }
}

export default new ApiAgent(BASE_URL);
```

### 3. Mutator для Orval

```typescript
// src/api/mutator.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Axios instance
const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor - добавляем токен
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - обработка refresh token
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return instance.request(originalRequest);
        } catch {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

// Для Orval axios client
export const axiosInstance = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<AxiosResponse<TData>> => {
  return instance.request<TData>({ ...config, ...(options || {}) });
};

// Для Orval SWR client
export const swrMutator = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<TData> => {
  return instance
    .request<TData>({ ...config, ...(options || {}) })
    .then((response) => response.data);
};
```

---

## MobX Stores

### Root Store

```typescript
// src/store/rootStore.ts
import { makeAutoObservable } from "mobx";
import AuthStore from "./auth/authStore";
import SessionsStore from "./sessions/sessionsStore";
import UiStore from "./ui/uiStore";

export class RootStore {
  auth: AuthStore;
  sessions: SessionsStore;
  ui: UiStore;

  constructor() {
    this.auth = new AuthStore(this);
    this.sessions = new SessionsStore(this);
    this.ui = new UiStore(this);

    makeAutoObservable(this, {}, { autoBind: true });
  }
}

export const rootStore = new RootStore();
```

### Auth Store

```typescript
// src/store/auth/authStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { RootStore } from "../rootStore";
import apiAgent from "../../lib/api";
import { usePostAuthLogin, usePostAuthRegister } from "../../api/seee.swr";

export default class AuthStore {
  rootStore: RootStore;
  user: { id: string; username: string; email?: string } | null = null;
  isAuthenticated = false;
  isLoading = false;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });

    // Проверяем токен при инициализации
    this.checkAuth();
  }

  async login(email: string, password: string) {
    this.isLoading = true;
    try {
      const response = await apiAgent.post<
        { email: string; password: string },
        {
          accessToken: string;
          refreshToken: string;
          user: { id: string; username: string; email?: string };
        }
      >("/auth/login", { email, password });

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);

      runInAction(() => {
        this.user = response.user;
        this.isAuthenticated = true;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async register(data: { email: string; password: string; name: string }) {
    this.isLoading = true;
    try {
      const response = await apiAgent.post<
        { email: string; password: string; name: string },
        {
          accessToken: string;
          refreshToken: string;
          user: { id: string; username: string; email?: string };
        }
      >("/auth/register", data);

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);

      runInAction(() => {
        this.user = response.user;
        this.isAuthenticated = true;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    runInAction(() => {
      this.user = null;
      this.isAuthenticated = false;
    });
  }

  async checkAuth() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      this.isAuthenticated = false;
      return;
    }

    try {
      const user = await apiAgent.get<{
        id: string;
        username: string;
        email?: string;
      }>("/auth/me");
      runInAction(() => {
        this.user = user;
        this.isAuthenticated = true;
      });
    } catch {
      this.logout();
    }
  }
}
```

### Sessions Store

```typescript
// src/store/sessions/sessionsStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { RootStore } from "../rootStore";
import apiAgent from "../../lib/api";
import type { SessionResponseDto } from "../../api/schemas";

export default class SessionsStore {
  rootStore: RootStore;
  sessions: SessionResponseDto[] = [];
  currentSession: SessionResponseDto | null = null;
  isLoading = false;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async fetchSessions() {
    this.isLoading = true;
    try {
      const sessions = await apiAgent.get<SessionResponseDto[]>("/sessions");
      runInAction(() => {
        this.sessions = sessions;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async createSession(title?: string) {
    this.isLoading = true;
    try {
      const session = await apiAgent.post<
        { title?: string },
        SessionResponseDto
      >("/sessions", { title });
      runInAction(() => {
        this.sessions.unshift(session);
        this.currentSession = session;
        this.isLoading = false;
      });
      return session;
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  setCurrentSession(session: SessionResponseDto | null) {
    this.currentSession = session;
  }
}
```

---

## Использование useSWR

### Компонент с useSWR

```typescript
// src/pages/sessions/SessionsPage.tsx
import { useGetSessions } from "../../api/seee.swr";
import { observer } from "mobx-react-lite";

const SessionsPage = observer(() => {
  const { data: sessions, error, isLoading, mutate } = useGetSessions();

  if (isLoading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error.message}</div>;

  return (
    <div>
      <h1>Мои сессии</h1>
      {sessions?.map((session) => (
        <div key={session.id}>
          <h3>{session.title || "Без названия"}</h3>
          <p>Сообщений: {session.messageCount}</p>
        </div>
      ))}
    </div>
  );
});

export default SessionsPage;
```

### Комбинирование useSWR и apiAgent

```typescript
// src/components/sessions/SessionList.tsx
import { useGetSessions } from "../../api/seee.swr";
import apiAgent from "../../lib/api";
import { observer } from "mobx-react-lite";
import { useState } from "react";

const SessionList = observer(() => {
  const { data: sessions, mutate } = useGetSessions();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      // Используем apiAgent для мутации
      const newSession = await apiAgent.post("/sessions", {
        title: "Новая сессия",
      });
      // Обновляем кэш SWR
      mutate([...(sessions || []), newSession]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <button onClick={handleCreateSession} disabled={isCreating}>
        Создать сессию
      </button>
      {/* Список сессий */}
    </div>
  );
});
```

---

## React Components

### Правила компонентов

1. **Используйте observer** для компонентов, использующих MobX
2. **Типизируйте props** через TypeScript
3. **Разделяйте логику и представление**
4. **Используйте custom hooks** для переиспользуемой логики

### Пример компонента

```typescript
// src/components/sessions/SessionCard.tsx
import { observer } from "mobx-react-lite";
import type { SessionResponseDto } from "../../api/schemas";

interface SessionCardProps {
  session: SessionResponseDto;
  onSelect: (session: SessionResponseDto) => void;
}

const SessionCard = observer(({ session, onSelect }: SessionCardProps) => {
  return (
    <div
      className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
      onClick={() => onSelect(session)}
    >
      <h3 className="font-semibold">{session.title || "Без названия"}</h3>
      <p className="text-sm text-gray-500">{session.messageCount} сообщений</p>
      <p className="text-xs text-gray-400">
        {new Date(session.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
});

export default SessionCard;
```

---

## Custom Hooks

### useAuth Hook

```typescript
// src/hooks/useAuth.ts
import { useContext } from "react";
import { observer } from "mobx-react-lite";
import { RootStoreContext } from "../store/rootStore";

export const useAuth = () => {
  const rootStore = useContext(RootStoreContext);
  if (!rootStore) {
    throw new Error("useAuth must be used within RootStoreProvider");
  }
  return rootStore.auth;
};
```

### useSessions Hook

```typescript
// src/hooks/useSessions.ts
import { useGetSessions } from "../api/seee.swr";
import { useAuth } from "./useAuth";
import { useEffect } from "react";

export const useSessions = () => {
  const { isAuthenticated } = useAuth();
  const { data, error, isLoading, mutate } = useGetSessions({
    swr: {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  });

  useEffect(() => {
    if (isAuthenticated && !data && !isLoading) {
      mutate();
    }
  }, [isAuthenticated, data, isLoading, mutate]);

  return {
    sessions: data || [],
    error,
    isLoading,
    refetch: mutate,
  };
};
```

### useMessages Hook (Cursor Pagination)

```typescript
// src/hooks/useMessages.ts
import { useState, useCallback, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import apiAgent from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface MessagesResponse {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const useMessages = (sessionId: string | null) => {
  const [allMessages, setAllMessages] = useState<Message[]>([]);

  // SWR Infinite для cursor pagination
  const getKey = (
    pageIndex: number,
    previousPageData: MessagesResponse | null
  ) => {
    // Если нет sessionId, не делаем запрос
    if (!sessionId) return null;

    // Если предыдущая страница была последней (hasMore = false), не делаем запрос
    if (previousPageData && !previousPageData.hasMore) return null;

    // Первая страница - без cursor
    if (pageIndex === 0) {
      return [`/sessions/${sessionId}/messages`, null];
    }

    // Последующие страницы - с cursor
    if (previousPageData?.nextCursor) {
      return [`/sessions/${sessionId}/messages`, previousPageData.nextCursor];
    }

    return null;
  };

  const fetcher = async ([url, cursor]: [string, string | null]) => {
    const params = cursor ? { cursor, limit: 50 } : { limit: 50 };
    const queryString = new URLSearchParams(params as any).toString();
    return apiAgent.get<MessagesResponse>(`${url}?${queryString}`);
  };

  const { data, error, isLoading, size, setSize, mutate } =
    useSWRInfinite<MessagesResponse>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateAll: false,
    });

  // Объединяем все сообщения из всех страниц
  useEffect(() => {
    if (data) {
      // Собираем все сообщения из всех страниц
      const messages = data.flatMap((page) => page.messages);
      // Убираем дубликаты по ID
      const uniqueMessages = Array.from(
        new Map(messages.map((m) => [m.id, m])).values()
      );
      // Сортируем по timestamp (от старых к новым)
      uniqueMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setAllMessages(uniqueMessages);
    }
  }, [data]);

  // Загрузка старых сообщений (при скролле вверх)
  const loadMore = useCallback(() => {
    const lastPage = data?.[data.length - 1];
    if (lastPage?.hasMore && !isLoading) {
      setSize(size + 1);
    }
  }, [data, isLoading, size, setSize]);

  // Проверка, есть ли еще сообщения для загрузки
  const hasMore = data?.[data.length - 1]?.hasMore ?? false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  return {
    messages: allMessages,
    error,
    isLoading: isLoading && !data,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: mutate,
  };
};
```

---

## WebSocket Integration

### Socket.IO Client

```typescript
// src/lib/socket.ts
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log("Socket connected");
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

export const socketService = new SocketService();
```

### Использование в компоненте

```typescript
// src/components/chat/ChatWindow.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { socketService } from "../../lib/socket";
import { useAuth } from "../../hooks/useAuth";
import { useMessages } from "../../hooks/useMessages";

const ChatWindow = ({ sessionId }: { sessionId: string }) => {
  const { isAuthenticated } = useAuth();
  const { messages, loadMore, hasMore, isLoadingMore, refresh } =
    useMessages(sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Загрузка сообщений при монтировании
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("accessToken");
    if (token) {
      socketService.connect(token);
    }

    socketService.emit("join_session", { sessionId });

    return () => {
      socketService.disconnect();
    };
  }, [sessionId, isAuthenticated]);

  // Обработка новых сообщений через WebSocket
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (data.sessionId === sessionId) {
        // Обновляем SWR кэш
        refresh();
      }
    };

    socketService.on("message", handleNewMessage);

    return () => {
      socketService.off("message", handleNewMessage);
    };
  }, [sessionId, refresh]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Обработка скролла для загрузки старых сообщений
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const isScrolledToTop = container.scrollTop === 0;
      const isScrolledToBottom =
        container.scrollHeight - container.scrollTop <=
        container.clientHeight + 100;

      setIsAtBottom(isScrolledToBottom);

      // Загружаем старые сообщения при скролле вверх
      if (isScrolledToTop && hasMore && !isLoadingMore) {
        const previousScrollHeight = container.scrollHeight;
        loadMore();

        // Сохраняем позицию скролла после загрузки
        setTimeout(() => {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - previousScrollHeight;
        }, 100);
      }
    },
    [hasMore, isLoadingMore, loadMore]
  );

  const sendMessage = (content: string) => {
    socketService.emit("message", { sessionId, content });
    setIsAtBottom(true); // После отправки скроллим вниз
  };

  return (
    <div className="flex flex-col h-full">
      {/* Индикатор загрузки старых сообщений */}
      {isLoadingMore && (
        <div className="p-2 text-center text-sm text-gray-500">
          Загрузка старых сообщений...
        </div>
      )}

      {/* Контейнер сообщений */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <p>{message.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Индикатор, что есть еще сообщения */}
      {hasMore && !isLoadingMore && (
        <button
          onClick={loadMore}
          className="p-2 text-center text-sm text-blue-500 hover:text-blue-700"
        >
          Загрузить старые сообщения
        </button>
      )}
    </div>
  );

  // Скачивание документа
  const handleDownloadDocument = async () => {
    if (!sessionId) return;

    try {
      const response = await apiAgent.get<{ document: string }>(
        `/sessions/${sessionId}/document`
      );

      if (response.document) {
        const blob = new Blob([response.document], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `concept_map_${sessionId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert("Документ пока пуст. Продолжите диалог.");
      }
    } catch (error) {
      console.error("Ошибка загрузки документа:", error);
      alert("Ошибка загрузки документа");
    }
  };

  // Добавление сессии в нейрокарту
  const handleAddToMap = async () => {
    if (!sessionId) return;

    if (
      !confirm(
        "Добавить эту сессию в нейрокарту? GPT проанализирует диалог и создаст записи."
      )
    ) {
      return;
    }

    try {
      await apiAgent.post(`/sessions/${sessionId}/add-to-map`);
      alert("Сессия успешно добавлена в нейрокарту!");
      navigate("/map");
    } catch (error) {
      console.error("Ошибка добавления в нейрокарту:", error);
      alert("Ошибка добавления в нейрокарту");
    }
  };

  // Обработка критических сообщений (суицидальные мысли)
  useEffect(() => {
    if (!socket) return;

    const handleCriticalResponse = (data: {
      is_critical: boolean;
      requires_psychiatrist: boolean;
      message: string;
    }) => {
      if (data.is_critical) {
        // Добавляем критическое сообщение в чат
        addMessage("assistant", data.message, true, false, null, true);

        // Показываем предупреждение
        alert(
          "⚠️ Обнаружены критические мысли. Рекомендуем обратиться к специалисту."
        );
      }
    };

    socket.on("critical_response", handleCriticalResponse);

    return () => {
      socket.off("critical_response", handleCriticalResponse);
    };
  }, [socket]);

  return (
    <div>
      {/* Кнопка скачивания документа */}
      <button
        onClick={handleDownloadDocument}
        className="btn-download"
        title="Скачать документ сессии"
      >
        📥 Скачать документ
      </button>

      {/* Кнопка добавления в нейрокарту */}
      {sessionId && (
        <button
          onClick={handleAddToMap}
          className="btn-add-to-map"
          title="Добавить сессию в нейрокарту"
        >
          ➕ Добавить в нейрокарту
        </button>
      )}

      {/* UI чата */}
    </div>
  );
};
```

---

## Роутинг

### React Router Setup

```typescript
// src/router/index.tsx
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import LoginPage from "../pages/auth/LoginPage";
import SessionsPage from "../pages/sessions/SessionsPage";
import SessionPage from "../pages/sessions/SessionPage";
import MapPage from "../pages/map/MapPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <SessionsPage />,
      },
      {
        path: "sessions/:id",
        element: <SessionPage />,
      },
      {
        path: "map",
        element: <MapPage />,
      },
    ],
  },
]);
```

### Protected Route

```typescript
// src/router/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { observer } from "mobx-react-lite";

export const ProtectedRoute = observer(() => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
});
```

### Public Route

```typescript
// src/router/PublicRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { observer } from "mobx-react-lite";

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute = observer(({ children }: PublicRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
});
```

---

## Структура страниц

### Общая структура роутинга

```typescript
// src/router/index.tsx
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";

// Public pages
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

// Protected pages
import SessionsPage from "../pages/sessions/SessionsPage";
import SessionPage from "../pages/sessions/SessionPage";
import MapPage from "../pages/map/MapPage";
import CabinetPage from "../pages/cabinet/CabinetPage";
import JournalPage from "../pages/journal/JournalPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: "/register",
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <SessionsPage />,
      },
      {
        path: "sessions/:id",
        element: <SessionPage />,
      },
      {
        path: "map",
        element: <MapPage />,
      },
      {
        path: "cabinet",
        element: <CabinetPage />,
      },
      {
        path: "journal",
        element: <JournalPage />,
      },
    ],
  },
]);
```

---

## Страница 1: Авторизация (Login)

### Компоненты

```
pages/auth/
├── LoginPage.tsx              # Основная страница
└── components/
    ├── LoginForm.tsx          # Форма входа
    └── GoogleLoginButton.tsx  # Кнопка Google OAuth
```

### Реализация

```typescript
// pages/auth/LoginPage.tsx
import { observer } from "mobx-react-lite";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "./components/LoginForm";
import GoogleLoginButton from "./components/GoogleLoginButton";

const LoginPage = observer(() => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SEEE</h1>
          <p className="text-gray-600 mt-2">Вход в систему</p>
        </div>

        <LoginForm />

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">или</span>
            </div>
          </div>

          <GoogleLoginButton />
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Нет аккаунта?{" "}
          <a href="/register" className="text-blue-600 hover:text-blue-500">
            Зарегистрироваться
          </a>
        </p>
      </div>
    </div>
  );
});

export default LoginPage;
```

```typescript
// pages/auth/components/LoginForm.tsx
import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

const LoginForm = observer(() => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка входа");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Вход..." : "Войти"}
      </Button>
    </form>
  );
});

export default LoginForm;
```

---

## Страница 2: Регистрация (Register)

### Компоненты

```
pages/auth/
├── RegisterPage.tsx           # Страница регистрации
└── components/
    └── TelegramAuthButton.tsx # Кнопка Telegram авторизации
```

### Реализация

```typescript
// pages/auth/RegisterPage.tsx
import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import apiAgent from "../../lib/api";

const RegisterPage = observer(() => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }

    setIsLoading(true);
    try {
      await apiAgent.post("/auth/register", {
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Ошибка регистрации");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SEEE</h1>
          <p className="text-gray-600 mt-2">Регистрация</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="name">Имя</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              minLength={6}
            />
          </div>

          <div>
            <Label htmlFor="passwordConfirm">Подтвердите пароль</Label>
            <Input
              id="passwordConfirm"
              type="password"
              value={formData.passwordConfirm}
              onChange={(e) =>
                setFormData({ ...formData, passwordConfirm: e.target.value })
              }
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Уже есть аккаунт?{" "}
          <a href="/login" className="text-blue-600 hover:text-blue-500">
            Войти
          </a>
        </p>
      </div>
    </div>
  );
});

export default RegisterPage;
```

### Компонент Telegram Auth Button

```typescript
// components/auth/TelegramAuthButton.tsx
import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";
import apiAgent from "../../lib/api";

type TelegramWidgetUser = {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (
          options: { bot_id: string; request_access?: "write" | "read" },
          callback: (user?: TelegramWidgetUser | null) => void
        ) => void;
      };
    };
  }
}

interface TelegramAuthButtonProps {
  authType?: "sign-in" | "sign-up" | "link";
  children?: React.ReactNode;
  className?: string;
}

const TelegramAuthButton = observer(
  ({
    authType = "sign-in",
    children = "Войти через Telegram",
    className,
  }: TelegramAuthButtonProps) => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = () => {
      if (isLoading) return;

      const botId = import.meta.env.VITE_TELEGRAM_BOT_ID;
      if (!botId) {
        console.error("TELEGRAM_BOT_ID не настроен");
        alert("Telegram авторизация не настроена");
        return;
      }

      const authFn = window.Telegram?.Login?.auth;
      if (!authFn) {
        console.error("Telegram Login Widget недоступен");
        alert("Telegram Login Widget не загружен");
        return;
      }

      setIsLoading(true);

      authFn(
        {
          bot_id: botId,
          request_access: "write",
        },
        async (telegramUser) => {
          if (!telegramUser || !telegramUser.hash) {
            setIsLoading(false);
            return;
          }

          try {
            const payload = {
              auth_date: Number(telegramUser.auth_date),
              first_name: telegramUser.first_name,
              hash: telegramUser.hash,
              id: String(telegramUser.id),
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
              username: telegramUser.username,
            };

            if (authType === "link") {
              // Привязка к существующему аккаунту
              await apiAgent.post("/auth/telegram/link", payload);
              alert("Telegram аккаунт успешно привязан");
            } else {
              // Вход/регистрация
              const response = await apiAgent.post<
                typeof payload,
                {
                  accessToken: string;
                  refreshToken: string;
                  user: { id: string; username: string; email?: string };
                }
              >("/auth/telegram/login", payload);

              localStorage.setItem("accessToken", response.accessToken);
              localStorage.setItem("refreshToken", response.refreshToken);

              await login(response.user.email || "", ""); // Обновляем store
              navigate("/");
            }
          } catch (error: any) {
            console.error("Telegram auth error:", error);
            alert(
              error.response?.data?.message ||
                "Ошибка авторизации через Telegram"
            );
          } finally {
            setIsLoading(false);
          }
        }
      );
    };

    return (
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className={`bg-[#2AABEE] hover:bg-[#229ED9] text-white ${className}`}
      >
        {isLoading ? (
          "Загрузка..."
        ) : (
          <>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="mr-2"
            >
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.2 2.189-1.1 7.5-1.55 9.95-.2.9-.6 1.2-1 1.2-.8.1-1.4-.3-2.2-.6-1.2-.5-1.9-.8-3-.1-.5.3-.9.6-1.4.6-.3 0-.7-.2-1-.4-1.7-1.5-2.7-2.4-4.3-3.8-1.5-1.3-.4-2 .3-2.2.7-.2 1.1-.3 1.5-.3.5 0 .8.1 1.1.2 1.1.4 1.6.6 2.6.4.3-.1.6-.1.9-.1.3 0 .6.1.9.2 1.1.3 1.9.4 3.4.2z" />
            </svg>
            {children}
          </>
        )}
      </Button>
    );
  }
);

export default TelegramAuthButton;
```

### Интеграция в LoginPage

```typescript
// pages/auth/LoginPage.tsx - добавить Telegram кнопку

import TelegramAuthButton from "../../components/auth/TelegramAuthButton";

// В компоненте после GoogleLoginButton:
<div className="mt-6">
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-300" />
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="px-2 bg-white text-gray-500">или</span>
    </div>
  </div>

  <TelegramAuthButton authType="sign-in" className="w-full mt-4">
    Войти через Telegram
  </TelegramAuthButton>
</div>;
```

### Интеграция в RegisterPage

```typescript
// pages/auth/RegisterPage.tsx - добавить Telegram кнопку

import TelegramAuthButton from "../../components/auth/TelegramAuthButton";

// В компоненте после формы регистрации:
<div className="mt-6">
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-300" />
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="px-2 bg-white text-gray-500">или</span>
    </div>
  </div>

  <TelegramAuthButton authType="sign-up" className="w-full mt-4">
    Зарегистрироваться через Telegram
  </TelegramAuthButton>
</div>;
```

### Интеграция в Cabinet (привязка Telegram)

```typescript
// pages/cabinet/components/ProfileSection.tsx - добавить привязку Telegram

import TelegramAuthButton from "../../../components/auth/TelegramAuthButton";

// В компоненте профиля:
{
  !profile?.telegramId ? (
    <div className="mt-4">
      <p className="text-sm text-gray-600 mb-2">
        Привяжите Telegram аккаунт для быстрого входа
      </p>
      <TelegramAuthButton authType="link" className="w-full">
        Привязать Telegram
      </TelegramAuthButton>
    </div>
  ) : (
    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
      <p className="text-sm text-green-800">
        ✓ Telegram аккаунт привязан: @{profile.telegramUsername}
      </p>
    </div>
  );
}
```

### Загрузка Telegram Widget

```typescript
// src/main.tsx или App.tsx - добавить скрипт

useEffect(() => {
  // Загружаем Telegram Login Widget
  const script = document.createElement("script");
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.setAttribute(
    "data-telegram-login",
    import.meta.env.VITE_TELEGRAM_BOT_ID
  );
  script.setAttribute("data-size", "large");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  script.setAttribute("data-request-access", "write");
  script.async = true;
  document.body.appendChild(script);

  return () => {
    document.body.removeChild(script);
  };
}, []);
```

### Environment Variables

```env
# .env
VITE_TELEGRAM_BOT_ID=your-telegram-bot-id
```

---

## Страница 3: Список сессий (Sessions)

### Компоненты

```
pages/sessions/
├── SessionsPage.tsx            # Основная страница
└── components/
    ├── SessionCard.tsx          # Карточка сессии
    ├── SessionList.tsx          # Список сессий
    ├── NewSessionButton.tsx     # Кнопка создания
    └── SessionFilters.tsx       # Фильтры
```

### Реализация

```typescript
// pages/sessions/SessionsPage.tsx
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useGetSessions } from "../../api/seee.swr";
import { useSessions } from "../../hooks/useSessions";
import SessionList from "./components/SessionList";
import NewSessionButton from "./components/NewSessionButton";
import { Layout } from "../../components/layout/Layout";

const SessionsPage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading, error, refetch } = useSessions();

  const handleCreateSession = async () => {
    // Логика создания через store или apiAgent
    const newSession = await apiAgent.post("/sessions", {});
    navigate(`/sessions/${newSession.id}`);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Мои сессии</h1>
          <NewSessionButton onCreate={handleCreateSession} />
        </div>

        {isLoading && <div>Загрузка сессий...</div>}
        {error && <div className="text-red-500">Ошибка: {error.message}</div>}
        {!isLoading && !error && <SessionList sessions={sessions} />}
      </div>
    </Layout>
  );
});

export default SessionsPage;
```

```typescript
// pages/sessions/components/SessionList.tsx
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import SessionCard from "./SessionCard";
import type { SessionResponseDto } from "../../../api/schemas";

interface SessionListProps {
  sessions: SessionResponseDto[];
}

const SessionList = observer(({ sessions }: SessionListProps) => {
  const navigate = useNavigate();

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">У вас пока нет сессий</p>
        <p className="text-sm text-gray-400 mt-2">
          Создайте новую сессию, чтобы начать работу с психологом
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          onClick={() => navigate(`/sessions/${session.id}`)}
        />
      ))}
    </div>
  );
});

export default SessionList;
```

---

## Страница 4: Диалог сессии (Session Chat)

### Функции

- **Отправка сообщений** через WebSocket
- **Получение ответов от AI** в реальном времени
- **Скачивание документа** сессии (Markdown)
- **Добавление сессии в нейрокарту** через GPT
- **Обнаружение суицидальных мыслей** (критические сообщения)

### Компоненты

```
pages/sessions/
└── SessionPage.tsx              # Страница диалога
    └── components/
        ├── ChatWindow.tsx       # Окно чата
        ├── MessageList.tsx      # Список сообщений
        ├── MessageInput.tsx     # Поле ввода
        └── SessionHeader.tsx    # Заголовок сессии
```

### Реализация

```typescript
// pages/sessions/SessionPage.tsx
import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import { useGetSession } from "../../api/seee.swr";
import { socketService } from "../../lib/socket";
import ChatWindow from "./components/ChatWindow";
import SessionHeader from "./components/SessionHeader";
import { Layout } from "../../components/layout/Layout";

const SessionPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading, error } = useGetSession(id!);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem("accessToken");
    if (token) {
      socketService.connect(token);
    }

    // Подключаемся к сессии
    socketService.emit("join_session", { sessionId: id });

    // Слушаем новые сообщения
    socketService.on("message", (data: any) => {
      if (data.sessionId === id) {
        setMessages((prev) => [...prev, data]);
      }
    });

    return () => {
      socketService.disconnect();
    };
  }, [id]);

  const handleSendMessage = (content: string) => {
    if (!id) return;
    socketService.emit("message", { sessionId: id, content });
  };

  if (isLoading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error.message}</div>;
  if (!session) return <div>Сессия не найдена</div>;

  return (
    <Layout>
      <div className="flex flex-col h-screen">
        <SessionHeader session={session} />
        <ChatWindow
          sessionId={id!}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>
    </Layout>
  );
});

export default SessionPage;
```

---

## Страница 5: Нейрокарта (Map)

### Компоненты

```
pages/map/
├── MapPage.tsx                  # Основная страница
└── components/
    ├── MapTabs.tsx              # Вкладки (Карта / До-После)
    ├── EventMapTable.tsx        # Таблица событий
    ├── EventForm.tsx            # Форма добавления события
    ├── BeforeAfterTable.tsx     # Таблица До/После
    └── BeforeAfterForm.tsx      # Форма До/После
```

### Реализация

```typescript
// pages/map/MapPage.tsx
import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useGetEventMap, useGetBeforeAfter } from "../../api/seee.swr";
import MapTabs from "./components/MapTabs";
import EventMapTable from "./components/EventMapTable";
import BeforeAfterTable from "./components/BeforeAfterTable";
import { Layout } from "../../components/layout/Layout";

const MapPage = observer(() => {
  const [activeTab, setActiveTab] = useState<"map" | "before-after">("map");
  const { data: eventMap, mutate: refetchMap } = useGetEventMap();
  const { data: beforeAfter, mutate: refetchBeforeAfter } = useGetBeforeAfter();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">🗺️ Карта не территория</h1>

        <MapTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "map" && (
          <div>
            <EventMapTable events={eventMap || []} onRefresh={refetchMap} />
          </div>
        )}

        {activeTab === "before-after" && (
          <div>
            <BeforeAfterTable
              items={beforeAfter || []}
              onRefresh={refetchBeforeAfter}
            />
          </div>
        )}
      </div>
    </Layout>
  );
});

export default MapPage;
```

---

## Страница 6: Личный кабинет (Cabinet)

### Компоненты

```
pages/cabinet/
├── CabinetPage.tsx              # Основная страница
└── components/
    ├── ProfileSection.tsx        # Профиль пользователя
    ├── BalanceSection.tsx        # Баланс и транзакции
    └── PaymentDetailsForm.tsx    # Форма реквизитов
```

### Реализация

```typescript
// pages/cabinet/CabinetPage.tsx
import { observer } from "mobx-react-lite";
import { useGetUserProfile, useGetBalance } from "../../api/seee.swr";
import ProfileSection from "./components/ProfileSection";
import BalanceSection from "./components/BalanceSection";
import { Layout } from "../../components/layout/Layout";

const CabinetPage = observer(() => {
  const { data: profile } = useGetUserProfile();
  const { data: balance } = useGetBalance();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">👤 Личный кабинет</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProfileSection profile={profile} />
          <BalanceSection balance={balance} />
        </div>
      </div>
    </Layout>
  );
});

export default CabinetPage;
```

---

## Страница 7: Журнал сессий (Journal)

### Компоненты

```
pages/journal/
├── JournalPage.tsx              # Основная страница
└── components/
    ├── JournalEntryList.tsx     # Список записей
    ├── JournalEntryForm.tsx     # Форма записи
    ├── InterestingThoughts.tsx  # Интересные мысли
    └── JournalStats.tsx         # Статистика
```

### Реализация

```typescript
// pages/journal/JournalPage.tsx
import { observer } from "mobx-react-lite";
import {
  useGetJournalEntries,
  useGetInterestingThoughts,
} from "../../api/seee.swr";
import JournalEntryList from "./components/JournalEntryList";
import InterestingThoughts from "./components/InterestingThoughts";
import JournalStats from "./components/JournalStats";
import { Layout } from "../../components/layout/Layout";

const JournalPage = observer(() => {
  const { data: entries, mutate: refetchEntries } = useGetJournalEntries();
  const { data: thoughts } = useGetInterestingThoughts();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">📝 Журнал сессий</h1>

        <JournalStats entries={entries || []} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <JournalEntryList
            entries={entries || []}
            onRefresh={refetchEntries}
          />
          <InterestingThoughts thoughts={thoughts || []} />
        </div>
      </div>
    </Layout>
  );
});

export default JournalPage;
```

---

## Общий Layout компонент

```typescript
// components/layout/Layout.tsx
import { observer } from "mobx-react-lite";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = observer(({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex space-x-8">
              <Link to="/" className="text-xl font-bold text-blue-600">
                SEEE
              </Link>
              <Link to="/" className="text-gray-700 hover:text-gray-900">
                Сессии
              </Link>
              <Link to="/map" className="text-gray-700 hover:text-gray-900">
                Нейрокарта
              </Link>
              <Link to="/journal" className="text-gray-700 hover:text-gray-900">
                Журнал
              </Link>
              <Link to="/cabinet" className="text-gray-700 hover:text-gray-900">
                Кабинет
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user?.username}</span>
              <Button variant="outline" onClick={handleLogout}>
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main>{children || <Outlet />}</main>
    </div>
  );
});
```

---

## Best Practices

1. **Используйте useSWR для чтения**, apiAgent для мутаций
2. **Типизируйте все** через TypeScript
3. **Разделяйте concerns**: логика в stores, UI в components
4. **Используйте observer** только там, где нужно
5. **Кэшируйте данные** через SWR
6. **Обрабатывайте ошибки** явно
7. **Используйте loading states** для UX
8. **Генерируйте API клиенты** через Orval
9. **Валидируйте данные** на фронте и бэке
10. **Тестируйте критичные компоненты**

---

## Структура файлов компонента

```
components/
└── sessions/
    ├── SessionCard.tsx          # Компонент карточки
    ├── SessionList.tsx          # Список сессий
    ├── SessionForm.tsx           # Форма создания
    └── index.ts                 # Экспорты
```

---

## Environment Variables

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_TELEGRAM_BOT_ID=your-telegram-bot-id
```

---

## Telegram Авторизация

### Обзор

Авторизация через Telegram Login Widget. Пользователь может:

- Войти через Telegram (если аккаунт уже существует)
- Зарегистрироваться через Telegram (создается новый аккаунт)
- Привязать Telegram к существующему аккаунту

### Настройка Telegram Bot

1. **Создать бота через @BotFather:**

   - Отправить `/newbot`
   - Получить токен бота
   - Настроить домен для Login Widget (если нужно)

2. **Получить Bot ID:**
   - Bot ID можно получить из токена (первые цифры до `:`)
   - Или через API: `https://api.telegram.org/bot<TOKEN>/getMe`

### Компонент TelegramAuthButton

См. реализацию выше в разделе "Страница 2: Регистрация"

### Использование

**На странице входа:**

```typescript
<TelegramAuthButton authType="sign-in">Войти через Telegram</TelegramAuthButton>
```

**На странице регистрации:**

```typescript
<TelegramAuthButton authType="sign-up">
  Зарегистрироваться через Telegram
</TelegramAuthButton>
```

**В личном кабинете (привязка):**

```typescript
<TelegramAuthButton authType="link">Привязать Telegram</TelegramAuthButton>
```

### Безопасность

1. **Валидация подписи:** Backend проверяет HMAC-SHA256 подпись
2. **Время авторизации:** Payload действителен только 10 минут
3. **Уникальность:** Один Telegram аккаунт может быть привязан только к одному пользователю
4. **Автоматическое создание:** Если пользователь не найден - создается автоматически

### Поток данных

```
1. Пользователь нажимает кнопку Telegram
2. Открывается Telegram Login Widget
3. Пользователь авторизуется в Telegram
4. Telegram возвращает данные с подписью (hash)
5. Frontend отправляет payload на /auth/telegram/login
6. Backend валидирует подпись и время
7. Создается/находится пользователь
8. Генерируются JWT токены
9. Frontend сохраняет токены и обновляет store
10. Редирект на главную страницу
```

---

## Полный список компонентов

### Основные компоненты интерфейса

#### 1. Sidebar (Боковая панель)

```
components/layout/
└── Sidebar.tsx
```

**Элементы:**

- **Header:**
  - Кнопка "Новая сессия" (`btn-new-chat`)
  - Кнопка "⚡ Нейрокарта" (`btn-map`)
- **Sessions List:**
  - Список сессий с возможностью:
    - Переименования (✏️)
    - Удаления (×)
    - Выбора активной сессии
- **Footer:**
  - "Скачать документ" (`btn-download`) - скачивает Markdown документ сессии
  - "➕ Добавить сессию в Нейрокарту" (`btn-add-to-map`) - скрыта по умолчанию, появляется при активной сессии
  - "📝 Обратная связь" (`btn-feedback`)
  - "👤 Личный кабинет" (`btn-cabinet`)
  - "Выйти" (`btn-logout`)

#### 2. Chat Window (Окно чата)

```
components/chat/
├── ChatWindow.tsx
├── MessageList.tsx
├── MessageItem.tsx
├── MessageInput.tsx
└── WelcomeMessage.tsx
```

**Элементы:**

- **Header:**
  - Кнопка переключения sidebar (`sidebar-toggle-btn`)
  - Мобильное меню (`mobile-menu-toggle`)
  - Заголовок сессии (`chat-title-center`)
  - Логотип SEEE (кликабельный)
  - Кнопка "⏸️ Приостановить сессию" (`btn-pause-session`) - только desktop
- **Messages Container:**
  - Welcome message (при первой загрузке)
  - Список сообщений (user/assistant)
  - Индикатор печати AI
- **Input Container:**
  - Навигационные кнопки (скрыты по умолчанию):
    - "🎯 Перейти к убеждению" (`goToBeliefBtn`)
    - "⏭️ Далее" (`skipStepBtn`)
    - "✏️ Дополнить" (`editConceptBtn`)
  - Кнопка "Затрудняюсь ответить" (появляется под сообщением AI)
  - Форма ввода:
    - Textarea для сообщения
    - Кнопка отправки (desktop/mobile версии)
    - Мобильное меню (`mobile-menu-toggle-bottom`)

#### 3. Mobile Menu (Мобильное меню)

```
components/mobile/
└── MobileMenu.tsx
```

**Элементы:**

- "📋 Боковая панель"
- "⏸️ Приостановить сессию"
- "👤 Личный кабинет"
- "🌙 Тёмный режим" (toggle)
- "📝 Обратная связь"

---

## Модальные окна

### 1. Личный кабинет (Cabinet Modal)

```
components/modals/
└── CabinetModal.tsx
```

**Вкладки:**

1. **Баланс** (`tab-balance`)

   - Текущий баланс
   - История транзакций

2. **Реквизиты** (`tab-payment`)

   - Форма реквизитов для выплат

3. **Журнал сессий** (`tab-journal`)

   - Список записей журнала

4. **Интересные мысли** (`tab-thoughts`)

   - Список мыслей
   - Кнопка "Добавить мысль"

5. **Безопасность** (`tab-security`)

   - Email для восстановления
   - Ссылка на поддержку

6. **Настройки** (`tab-settings`)
   - Масштаб текста (+/-)
   - Язык интерфейса (ru/en)

**Поиск:** Глобальный поиск по всем разделам кабинета

### 2. Обратная связь (Feedback Modal)

```
components/modals/
└── FeedbackModal.tsx
```

**Поля:**

- "Расскажите о себе" \* (textarea)
- "Какие у вас были ожидания от процесса?" \* (textarea)
- "Сбылись ли эти ожидания?" \* (textarea)
- "Как всё прошло?" \* (textarea)
- Прикрепить файл (скриншот, видео)

### 3. Приостановка сессии (Pause Session Modal)

```
components/modals/
└── PauseSessionModal.tsx
```

**Поля:**

- "Как вы себя чувствуете после сессии?" (textarea)
- "Какую эмоцию испытываете?" (input)
- "Как проходила сессия?" (textarea)
- "Какие интересные мысли были на этой сессии?" (textarea)

### 4. Выбор убеждений (Belief Selection Modal)

```
components/modals/
└── BeliefSelectionModal.tsx
```

**Функции:**

- Список убеждений для выбора
- Режим редактирования:
  - Кнопка "✏️ Редактировать убеждения"
  - Выбор убеждений для удаления
  - "🗑️ Удалить выбранные"
  - "💾 Сохранить изменения"

### 5. Просмотр концепции (View Concept Modal)

```
components/modals/
└── ViewConceptModal.tsx
```

**Функции:**

- Просмотр полной структуры идеи
- Кнопка "📤 Извлечь идею из структуры"

### 6. Извлечение концепции (Extract Concept Modal)

```
components/modals/
└── ExtractConceptModal.tsx
```

**Поля:**

- Выбор частей идеи для извлечения
- "Название новой идеи" (input)

### 7. Редактирование концепции (Edit Concept Modal)

```
components/modals/
└── EditConceptModal.tsx
```

**Поля:**

- Выбор убеждения (select)
- Выбор поля для редактирования:
  - Убеждение
  - Части убеждения
  - Основатель
  - Цель
  - Последствия
  - Вывод
  - Комментарий

### 8. О SEEE (About Modal)

```
components/modals/
└── AboutModal.tsx
```

**Содержание:**

- Описание SEEE
- С какими ситуациями может помочь
- Как работает архитектура мышления
- Информация о разработчике

---

## Поля регистрации

### Форма регистрации

```typescript
interface RegisterFormData {
  username: string; // Обязательное, минимум 3 символа
  password: string; // Обязательное, минимум 6 символов
  passwordConfirm: string; // Обязательное, должно совпадать с password
}
```

**Валидация:**

- `username`: минимум 3 символа, уникальное
- `password`: минимум 6 символов
- `passwordConfirm`: должно совпадать с `password`

**Backend обработка:**

- Генерация `user_id` (UUID первые 8 символов)
- Хеширование пароля (bcrypt)

---

## Экраны оплаты

### Страница 8: Подписка и оплата (Subscription)

#### Компоненты

```
pages/subscription/
├── SubscriptionPage.tsx          # Основная страница
└── components/
    ├── SubscriptionPlans.tsx     # Тарифные планы
    ├── PaymentForm.tsx           # Форма оплаты
    ├── PaymentMethods.tsx        # Способы оплаты
    ├── PromoCodeInput.tsx        # Промокод
    └── PaymentSuccess.tsx        # Успешная оплата
```

#### Реализация

```typescript
// pages/subscription/SubscriptionPage.tsx
import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import SubscriptionPlans from "./components/SubscriptionPlans";
import PaymentForm from "./components/PaymentForm";
import { Layout } from "../../components/layout/Layout";
import { useGetBalance } from "../../api/seee.swr";
import apiAgent from "../../lib/api";

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration: number; // дней
  features: string[];
  popular?: boolean;
}

const SubscriptionPage = observer(() => {
  const navigate = useNavigate();
  const { data: balance } = useGetBalance();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null
  );
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);

  const plans: SubscriptionPlan[] = [
    {
      id: "monthly",
      name: "Месячная подписка",
      price: 990,
      duration: 30,
      features: [
        "Неограниченные сессии",
        "Доступ к нейрокарте",
        "Журнал сессий",
        "Поддержка 24/7",
      ],
    },
    {
      id: "quarterly",
      name: "Квартальная подписка",
      price: 2490,
      duration: 90,
      features: ["Все из месячной", "Скидка 16%", "Приоритетная поддержка"],
      popular: true,
    },
    {
      id: "yearly",
      name: "Годовая подписка",
      price: 8990,
      duration: 365,
      features: [
        "Все из квартальной",
        "Скидка 24%",
        "VIP поддержка",
        "Ранний доступ к новым функциям",
      ],
    },
  ];

  const handleApplyPromo = async (code: string) => {
    try {
      const response = await apiAgent.post("/subscription/validate-promo", {
        code,
      });
      setPromoDiscount(response.discount);
    } catch (error) {
      alert("Промокод недействителен");
    }
  };

  const handlePayment = async (paymentMethod: string) => {
    if (!selectedPlan) return;

    try {
      const response = await apiAgent.post("/subscription/purchase", {
        planId: selectedPlan.id,
        promoCode: promoCode || undefined,
        paymentMethod,
      });

      // Редирект на страницу успешной оплаты
      navigate(`/subscription/success?sessionId=${response.sessionId}`);
    } catch (error) {
      alert("Ошибка при оплате");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">💳 Подписка</h1>

        {!selectedPlan ? (
          <SubscriptionPlans
            plans={plans}
            onSelect={setSelectedPlan}
            balance={balance?.amount || 0}
          />
        ) : (
          <PaymentForm
            plan={selectedPlan}
            promoCode={promoCode}
            promoDiscount={promoDiscount}
            onPromoCodeChange={setPromoCode}
            onApplyPromo={handleApplyPromo}
            onPayment={handlePayment}
            onBack={() => setSelectedPlan(null)}
          />
        )}
      </div>
    </Layout>
  );
});

export default SubscriptionPage;
```

```typescript
// pages/subscription/components/SubscriptionPlans.tsx
import { observer } from "mobx-react-lite";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";

interface SubscriptionPlansProps {
  plans: SubscriptionPlan[];
  onSelect: (plan: SubscriptionPlan) => void;
  balance: number;
}

const SubscriptionPlans = observer(
  ({ plans, onSelect, balance }: SubscriptionPlansProps) => {
    return (
      <div>
        {balance > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">
              💰 У вас на балансе: <strong>{balance} ₽</strong>
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Баланс будет использован при оплате
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`p-6 ${
                plan.popular ? "border-2 border-blue-500" : ""
              }`}
            >
              {plan.popular && (
                <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                  ПОПУЛЯРНЫЙ
                </div>
              )}

              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-600"> ₽</span>
                <span className="text-sm text-gray-500">
                  {" "}
                  / {plan.duration} дней
                </span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                onClick={() => onSelect(plan)}
                variant={plan.popular ? "default" : "outline"}
              >
                Выбрать план
              </Button>
            </Card>
          ))}
        </div>
      </div>
    );
  }
);

export default SubscriptionPlans;
```

```typescript
// pages/subscription/components/PaymentForm.tsx
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import PromoCodeInput from "./PromoCodeInput";
import PaymentMethods from "./PaymentMethods";

interface PaymentFormProps {
  plan: SubscriptionPlan;
  promoCode: string;
  promoDiscount: number;
  onPromoCodeChange: (code: string) => void;
  onApplyPromo: (code: string) => void;
  onPayment: (method: string) => void;
  onBack: () => void;
}

const PaymentForm = ({
  plan,
  promoCode,
  promoDiscount,
  onPromoCodeChange,
  onApplyPromo,
  onPayment,
  onBack,
}: PaymentFormProps) => {
  const [selectedMethod, setSelectedMethod] = useState<string>("card");

  const finalPrice = plan.price - promoDiscount;

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="outline" onClick={onBack} className="mb-6">
        ← Назад к планам
      </Button>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Оформление подписки</h2>

        <div className="mb-6 p-4 bg-gray-50 rounded">
          <div className="flex justify-between mb-2">
            <span>План:</span>
            <span className="font-semibold">{plan.name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Стоимость:</span>
            <span>{plan.price} ₽</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between mb-2 text-green-600">
              <span>Скидка:</span>
              <span>-{promoDiscount} ₽</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold pt-2 border-t">
            <span>Итого:</span>
            <span>{finalPrice} ₽</span>
          </div>
        </div>

        <PromoCodeInput
          value={promoCode}
          onChange={onPromoCodeChange}
          onApply={onApplyPromo}
          discount={promoDiscount}
        />

        <PaymentMethods
          selected={selectedMethod}
          onSelect={setSelectedMethod}
        />

        <Button
          className="w-full mt-6"
          onClick={() => onPayment(selectedMethod)}
        >
          Оплатить {finalPrice} ₽
        </Button>
      </div>
    </div>
  );
};

export default PaymentForm;
```

```typescript
// pages/subscription/components/PaymentMethods.tsx
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Label } from "../../../components/ui/label";

interface PaymentMethodsProps {
  selected: string;
  onSelect: (method: string) => void;
}

const PaymentMethods = ({ selected, onSelect }: PaymentMethodsProps) => {
  return (
    <div className="mb-6">
      <Label className="text-lg font-semibold mb-4 block">
        Способ оплаты
      </Label>
      <RadioGroup value={selected} onValueChange={onSelect}>
        <div className="flex items-center space-x-2 p-4 border rounded-lg mb-2">
          <RadioGroupItem value="card" id="card" />
          <Label htmlFor="card" className="flex-1 cursor-pointer">
            <div className="font-semibold">💳 Банковская карта</div>
            <div className="text-sm text-gray-500">
              Visa, MasterCard, МИР
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-2 p-4 border rounded-lg mb-2">
          <RadioGroupItem value="yookassa" id="yookassa" />
          <Label htmlFor="yookassa" className="flex-1 cursor-pointer">
            <div className="font-semibold">💳 ЮKassa</div>
            <div className="text-sm text-gray-500">
              Банковские карты, электронные кошельки
            </Label>
        </div>
        <div className="flex items-center space-x-2 p-4 border rounded-lg">
          <RadioGroupItem value="balance" id="balance" />
          <Label htmlFor="balance" className="flex-1 cursor-pointer">
            <div className="font-semibold">💰 С баланса</div>
            <div className="text-sm text-gray-500">
              Использовать средства с баланса аккаунта
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};

export default PaymentMethods;
```

```typescript
// pages/subscription/components/PromoCodeInput.tsx
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

interface PromoCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  onApply: (code: string) => void;
  discount: number;
}

const PromoCodeInput = ({
  value,
  onChange,
  onApply,
  discount,
}: PromoCodeInputProps) => {
  const [isApplied, setIsApplied] = useState(false);

  const handleApply = () => {
    if (value.trim()) {
      onApply(value.trim());
      setIsApplied(true);
    }
  };

  return (
    <div className="mb-6">
      <Label className="mb-2 block">Промокод</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsApplied(false);
          }}
          placeholder="Введите промокод"
          disabled={isApplied && discount > 0}
        />
        <Button
          onClick={handleApply}
          variant="outline"
          disabled={!value.trim() || (isApplied && discount > 0)}
        >
          {isApplied && discount > 0 ? "✓ Применён" : "Применить"}
        </Button>
      </div>
      {discount > 0 && (
        <p className="text-green-600 text-sm mt-2">
          Промокод применён! Скидка: {discount} ₽
        </p>
      )}
    </div>
  );
};

export default PromoCodeInput;
```

```typescript
// pages/subscription/components/PaymentSuccess.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Layout } from "../../components/layout/Layout";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  useEffect(() => {
    // Обновляем баланс и подписку после успешной оплаты
    // Можно вызвать refetch для баланса
  }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-4">Оплата успешна!</h1>
          <p className="text-gray-600 mb-6">
            Ваша подписка активирована. Теперь у вас есть доступ ко всем
            функциям SEEE.
          </p>
          {sessionId && (
            <p className="text-sm text-gray-500 mb-6">
              ID транзакции: {sessionId}
            </p>
          )}
          <Button onClick={() => navigate("/")}>Начать работу</Button>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentSuccess;
```

### Интеграция в роутинг

```typescript
// router/index.tsx - добавить роуты
{
  path: "subscription",
  element: <SubscriptionPage />,
},
{
  path: "subscription/success",
  element: <PaymentSuccess />,
},
```

### Интеграция в меню

**В Sidebar добавить:**

```typescript
<button className="btn-subscription" onClick={() => navigate("/subscription")}>
  💳 Подписка
</button>
```

**В Layout добавить в навигацию:**

```typescript
<Link to="/subscription" className="text-gray-700 hover:text-gray-900">
  💳 Подписка
</Link>
```

### Страница управления подпиской

```typescript
// pages/subscription/ManageSubscriptionPage.tsx
import { observer } from "mobx-react-lite";
import { useGetSubscription } from "../../api/seee.swr";
import { Button } from "../../components/ui/button";
import { Layout } from "../../components/layout/Layout";

const ManageSubscriptionPage = observer(() => {
  const { data: subscription, mutate } = useGetSubscription();

  const handleCancel = async () => {
    if (confirm("Вы уверены, что хотите отменить подписку?")) {
      await apiAgent.post("/subscription/cancel");
      mutate();
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Управление подпиской</h1>

        {subscription ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold">{subscription.planName}</h3>
              <p className="text-gray-600">
                Активна до:{" "}
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-4">
              <Button onClick={() => navigate("/subscription")}>
                Изменить план
              </Button>
              {subscription.autoRenew && (
                <Button variant="outline" onClick={handleCancel}>
                  Отменить подписку
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">У вас нет активной подписки</p>
            <Button onClick={() => navigate("/subscription")}>
              Оформить подписку
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
});

export default ManageSubscriptionPage;
```

---

## Итоговая структура страниц

1. **Login** - Авторизация
2. **Register** - Регистрация
3. **Sessions** - Список сессий
4. **Session** - Диалог сессии
5. **Map** - Нейрокарта
6. **Cabinet** - Личный кабинет
7. **Journal** - Журнал сессий
8. **Subscription** - Подписка и оплата ⭐ НОВОЕ
9. **Subscription/Success** - Успешная оплата ⭐ НОВОЕ
10. **Subscription/Manage** - Управление подпиской ⭐ НОВОЕ
