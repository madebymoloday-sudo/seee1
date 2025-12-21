import { useSessionsControllerGetSessions } from "../api/seee.swr";

export const useSessions = () => {
  const { data, error, isLoading, mutate } = useSessionsControllerGetSessions({
    swr: {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  });

  return {
    sessions: data || [],
    error,
    isLoading,
    refetch: mutate,
  };
};
