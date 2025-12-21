import { useSubscriptionControllerGetSubscription } from "../api/seee.swr";

export const useSubscription = () => {
  const { data, error, isLoading, mutate } = useSubscriptionControllerGetSubscription({
    swr: {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  });

  // Проверяем, есть ли активная подписка
  const hasActiveSubscription = data
    ? data.status === "active" && new Date(data.expiresAt) > new Date()
    : false;

  return {
    subscription: data,
    hasActiveSubscription,
    error,
    isLoading,
    refetch: mutate,
  };
};

