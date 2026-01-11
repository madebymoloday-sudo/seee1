import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import { useSessionsControllerGetSession, useMessagesControllerCreateMessage } from "@/api/seee.swr";
import { socketService } from "@/lib/socket";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import ChatWindow from "./components/ChatWindow";
import SessionHeader from "./components/SessionHeader";
import { Loader2 } from "lucide-react";

const SessionPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const refreshMessagesRef = useRef<(() => void) | null>(null);

  const { data: session, isLoading, error } = useSessionsControllerGetSession(
    id!,
    {
      swr: {
        enabled: !!id,
      },
    }
  );

  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem("accessToken");
    if (token) {
      socketService.connect(token);
    }

    // Ждем подключения перед join_session
    const handleConnect = () => {
      socketService.emit("join_session", { sessionId: id });
    };

    socketService.on("connect", handleConnect);

    if (socketService.isConnected) {
      socketService.emit("join_session", { sessionId: id });
    }

    return () => {
      socketService.off("connect", handleConnect);
      socketService.disconnect();
    };
  }, [id]);

  const { trigger: createMessage, isMutating } = useMessagesControllerCreateMessage(id!);
  const {
    messages,
    loadMore,
    hasMore,
    isLoadingMore,
    isLoading: isLoadingMessages,
    refresh,
    addOptimisticMessage,
    removeOptimisticMessage
  } = useMessages(id ?? null);

  const handleSendMessage = async (content: string) => {
    if (!id || !user?.id) return;

    // Генерируем временный ID для optimistic сообщения
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    // Добавляем optimistic сообщение сразу
    addOptimisticMessage(content, tempId);

    try {
      // Отправляем сообщение через REST API (POST /api/v1/sessions/:id/messages)
      await createMessage({ content });

      // Удаляем optimistic сообщение после успешной отправки
      // Реальное сообщение придет через refresh или WebSocket
      removeOptimisticMessage(tempId);

      // Обновляем список сообщений после отправки
      if (refreshMessagesRef.current) {
        refreshMessagesRef.current();
      }

      // Также ответ от AI может прийти через WebSocket
      // Индикатор "AI думает" будет показан в ChatWindow
    } catch (error: any) {
      console.error("Ошибка отправки сообщения:", error);

      // Удаляем optimistic сообщение при ошибке
      removeOptimisticMessage(tempId);

      // Можно добавить уведомление об ошибке
      const errorMessage = error?.response?.data?.message || error?.message || "Не удалось отправить сообщение";
      if (errorMessage.includes("LLM не настроен")) {
        // Ошибка LLM уже обрабатывается на бэкенде и приходит через WebSocket
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <p className="text-white text-lg">
            {error ? "Ошибка загрузки сессии" : "Сессия не найдена"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <SessionHeader session={session} />
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          sessionId={id!}
          onSendMessage={handleSendMessage}
          isSending={isMutating}
          onRefreshRef={refreshMessagesRef}
          messages={messages}
          loadMore={loadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore ?? false}
          isLoading={isLoadingMessages ?? false}
          refresh={refresh}
        />
      </div>
    </div>
  );
});

export default SessionPage;

