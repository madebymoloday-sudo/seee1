import { useSessionsControllerGetSessions } from "../api/seee.swr";
import { useAuth } from "./useAuth";

export const useSessions = () => {
  const { isAuthenticated } = useAuth();
  
  // Не делаем запрос, если пользователь не авторизован
  // Используем null как ключ, чтобы отключить запрос
  const { data, error, isLoading, mutate } = useSessionsControllerGetSessions(
    isAuthenticated ? {} : null,
    {
      swr: {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        // Отключаем повторные попытки при ошибке 401
        shouldRetryOnError: (error: any) => {
          if (error?.response?.status === 401) {
            return false;
          }
          return true;
        },
        errorRetryCount: 0,
      },
    }
  );

  return {
    sessions: data || [],
    error: isAuthenticated ? error : null,
    isLoading: isAuthenticated ? isLoading : false,
    refetch: mutate,
  };
};
