import { useAuth } from "@/hooks/useAuth";
import { socketService } from "@/lib/socket";
import { Loader2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import MessageInput from "./MessageInput";
import EmotionCarousel from "./EmotionCarousel";
import styles from "./ChatWindow.module.css";

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
  const [visibleMessages, setVisibleMessages] = useState<{ message: Message; isVisible: boolean; fadeOut?: boolean }[]>([]);
  const [showEmotionCarousel, setShowEmotionCarousel] = useState(false);
  const fadeOutTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      };

      const handleDisconnect = () => {
        // Обработка отключения
      };

      socketService.on("connect", handleConnect);
      socketService.on("disconnect", handleDisconnect);

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

  // Логика показа сообщений: только одно от AI, затем ответ пользователя, затем оба исчезают
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }

    if (messages.length === 0) {
      setVisibleMessages([]);
      return;
    }

    // Находим последнее сообщение от assistant (обратный поиск)
    let lastAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }
    
    if (lastAssistantIndex === -1) {
      // Если нет сообщений от assistant, показываем все сообщения пользователя
      setVisibleMessages(messages.map(m => ({ message: m, isVisible: true })));
      return;
    }

    const lastAssistant = messages[lastAssistantIndex];
    const userResponseAfter = messages.slice(lastAssistantIndex + 1);

    // Показываем только последнее сообщение от assistant и ответы пользователя после него
    const newVisible: { message: Message; isVisible: boolean; fadeOut?: boolean }[] = [];
    
    // Добавляем последнее сообщение от assistant
    newVisible.push({ message: lastAssistant, isVisible: true });
    
    // Добавляем ответы пользователя после него
    userResponseAfter.forEach(msg => {
      newVisible.push({ message: msg, isVisible: true });
    });

    setVisibleMessages(newVisible);

    // Если есть ответ пользователя, запускаем таймер для плавного исчезновения
    if (userResponseAfter.length > 0) {
      fadeOutTimerRef.current = setTimeout(() => {
        setVisibleMessages(prev => prev.map(msg => ({ ...msg, fadeOut: true })));
        
        // Через время полностью скрываем
        setTimeout(() => {
          setVisibleMessages([]);
        }, 500); // Время анимации fadeOut
      }, 3000); // Показываем сообщения 3 секунды перед исчезновением
    }

    // Проверяем, нужно ли показать карусель эмоций
    const questionLower = lastAssistant.content.toLowerCase();
    if (questionLower.includes("эмоцию") || 
        questionLower.includes("эмоция") ||
        questionLower.includes("какую эмоцию") ||
        questionLower.includes("какие эмоции")) {
      setShowEmotionCarousel(true);
    } else {
      setShowEmotionCarousel(false);
    }

    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
      }
    };
  }, [messages]);

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
    // Скрываем карусель эмоций после отправки
    setShowEmotionCarousel(false);
  };

  const handleEmotionSelect = (emotions: string[]) => {
    // Отправляем выбранные эмоции как сообщение
    const emotionText = `Выбранные эмоции: ${emotions.join(", ")}`;
    handleSend(emotionText);
  };

  const handleSettingsClick = () => {
    // TODO: Добавить функционал настроек
  };

  return (
    <div className={styles.chatWindow}>
      {/* Контейнер сообщений */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={styles.messagesContainer}
      >
        {isLoading && messages.length === 0 && (
          <div className={styles.loadingContainer}>
            <Loader2 className={styles.loader} />
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className={styles.emptyState}>
            <MessageSquare className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Добро пожаловать в сессию!</p>
            <p className={styles.emptyText}>
              Начните диалог с AI-психологом. Задавайте вопросы, делитесь
              мыслями и получайте поддержку.
            </p>
          </div>
        )}

        {/* Показываем только видимые сообщения (центрированные) */}
        {visibleMessages.map(({ message, isVisible, fadeOut }) => (
          <div
            key={message.id}
            className={`${styles.messageWrapper} ${
              fadeOut ? styles.fadeOut : isVisible ? styles.visible : styles.hidden
            }`}
          >
            <div
              className={`${styles.message} ${
                message.role === "user" ? styles.userMessage : styles.assistantMessage
              }`}
            >
              <p className={styles.messageContent}>{message.content}</p>
            </div>
          </div>
        ))}

        {/* Карусель эмоций */}
        {showEmotionCarousel && (
          <div className={styles.emotionCarouselWrapper}>
            <EmotionCarousel
              onSelect={handleEmotionSelect}
              onCancel={() => setShowEmotionCarousel(false)}
            />
          </div>
        )}

        {/* Индикатор "AI думает..." */}
        {isAiThinking && (
          <div className={styles.messageWrapper}>
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.thinkingIndicator}>
                <Loader2 className={styles.thinkingLoader} />
                <span className={styles.thinkingText}>AI думает...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <MessageInput 
        onSend={handleSend} 
        onSettingsClick={handleSettingsClick}
        disabled={isLoading || isSending} 
      />
    </div>
  );
};

export default ChatWindow;
