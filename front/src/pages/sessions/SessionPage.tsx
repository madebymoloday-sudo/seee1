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
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Загрузка сессии...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-slate-700/50">
          <p className="text-gray-800 dark:text-gray-200 text-lg font-medium">
            {error ? "Ошибка загрузки сессии" : "Сессия не найдена"}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {error ? "Попробуйте обновить страницу" : "Возможно, сессия была удалена"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <SessionHeader session={session} />
      <div className="flex-1 overflow-hidden relative min-h-0">
        {/* Декоративные элементы фона */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/20 dark:bg-blue-500/10 rounded-full blur-3xl max-md:hidden"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 dark:bg-indigo-500/10 rounded-full blur-3xl max-md:hidden"></div>
        </div>
        <div className="relative h-full">
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
    </div>
  );
});

export default SessionPage;

