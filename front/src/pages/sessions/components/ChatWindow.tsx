import { useAuth } from "@/hooks/useAuth";
import { socketService } from "@/lib/socket";
import { Loader2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import MessageInput from "./MessageInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatWindowProps {
  sessionId: string;
  onSendMessage: (content: string) => void;
  isSending?: boolean;
  onRefreshRef?: React.MutableRefObject<(() => void) | null>;
  messages: Message[];
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoading: boolean;
  refresh: () => void;
}

const ChatWindow = ({
  sessionId,
  onSendMessage,
  isSending = false,
  onRefreshRef,
  messages,
  loadMore,
  hasMore,
  isLoadingMore,
  isLoading,
  refresh,
}: ChatWindowProps) => {
  const { isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const lastMessageCountRef = useRef(0);

  // Передаем функцию refresh в родительский компонент
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = refresh;
    }
  }, [refresh, onRefreshRef]);

  // Загрузка сообщений при монтировании
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("accessToken");
    if (token) {
      // Ждем подключения перед join_session
      const handleConnect = () => {
        socketService.emit("join_session", { sessionId });
        setSocketConnected(true);
      };

      const handleDisconnect = () => {
        setSocketConnected(false);
      };

      socketService.on("connect", handleConnect);
      socketService.on("disconnect", handleDisconnect);

      // Проверяем текущий статус подключения (асинхронно)
      setTimeout(() => {
        setSocketConnected(socketService.isConnected);
      }, 0);

      // Подключаемся (если еще не подключены)
      if (!socketService.isConnected) {
        socketService.connect(token);
      } else {
        // Если уже подключен, сразу делаем join
        socketService.emit("join_session", { sessionId });
      }

      return () => {
        socketService.off("connect", handleConnect);
        socketService.off("disconnect", handleDisconnect);
        // Не отключаемся здесь, так как SessionPage управляет подключением
      };
    }
  }, [sessionId, isAuthenticated]);

  // Обработка новых сообщений через WebSocket
  useEffect(() => {
    const handleNewMessage = (data: { sessionId?: string }) => {
      if (data.sessionId === sessionId) {
        // Обновляем SWR кэш для получения новых сообщений
        refresh();
        // Когда приходит ответ от AI, скрываем индикатор "думает"
        setIsAiThinking(false);
      }
    };

    const handleError = (error: unknown) => {
      console.error("WebSocket error:", error);
      setIsAiThinking(false);
      // Можно показать уведомление об ошибке
    };

    socketService.on("message", handleNewMessage);
    socketService.on("error", handleError);

    return () => {
      socketService.off("message", handleNewMessage);
      socketService.off("error", handleError);
    };
  }, [sessionId, refresh]);

  // Отслеживание когда приходит ответ от AI, чтобы скрыть индикатор "думает"
  useEffect(() => {
    // Если количество сообщений увеличилось и последнее от assistant - AI ответил
    if (messages.length > lastMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        setIsAiThinking(false);
      }
    }

    lastMessageCountRef.current = messages.length;
  }, [messages]);

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

  const handleSend = (content: string) => {
    onSendMessage(content);
    setIsAtBottom(true);
    // Устанавливаем индикатор "AI думает" сразу после отправки
    setIsAiThinking(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Статус подключения */}
      {socketConnected && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Подключено к чату</span>
          </div>
        </div>
      )}

      {/* Индикатор загрузки старых сообщений */}
      {isLoadingMore && (
        <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка старых сообщений...
        </div>
      )}

      {/* Контейнер сообщений */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="flex flex-col items-center gap-2">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">Добро пожаловать в сессию!</p>
              <p className="text-sm text-center max-w-md">
                Начните диалог с AI-психологом. Задавайте вопросы, делитесь
                мыслями и получайте поддержку.
              </p>
            </div>
          </div>
        )}

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
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Индикатор "AI думает..." */}
        {isAiThinking && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-lg p-3 bg-muted">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground italic">
                  AI думает...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Индикатор, что есть еще сообщения */}
      {hasMore && !isLoadingMore && (
        <button
          onClick={loadMore}
          className="p-2 text-center text-sm text-primary hover:text-primary/80"
        >
          Загрузить старые сообщения
        </button>
      )}

      {/* Поле ввода */}
      <MessageInput onSend={handleSend} disabled={isLoading || isSending} />
    </div>
  );
};

export default ChatWindow;
