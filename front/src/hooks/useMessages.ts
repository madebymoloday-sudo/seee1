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
  const [optimisticMessages, setOptimisticMessages] = useState<Map<string, Message>>(new Map());

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

  // Добавление optimistic сообщения
  const addOptimisticMessage = useCallback((content: string, tempId: string) => {
    const optimisticMessage: Message = {
      id: tempId,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => {
      const newMap = new Map(prev);
      newMap.set(tempId, optimisticMessage);
      return newMap;
    });
  }, []);

  // Удаление optimistic сообщения
  const removeOptimisticMessage = useCallback((tempId: string) => {
    setOptimisticMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(tempId);
      return newMap;
    });
  }, []);

  // Объединяем реальные сообщения с optimistic
  const messagesWithOptimistic = [...allMessages];
  optimisticMessages.forEach((msg) => {
    // Добавляем optimistic сообщения в конец, если их еще нет в реальных
    if (!allMessages.find((m) => m.id === msg.id)) {
      messagesWithOptimistic.push(msg);
    }
  });
  // Сортируем по timestamp
  messagesWithOptimistic.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    messages: messagesWithOptimistic,
    error,
    isLoading: isLoading && !data,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: mutate,
    addOptimisticMessage,
    removeOptimisticMessage,
  };
};

