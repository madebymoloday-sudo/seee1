import { useAuth } from "@/hooks/useAuth";

/**
 * Режим тестирования (например для админа / нововведений).
 * isTestMode: true если включён через localStorage и пользователь подходит по роли.
 */
export function useTestMode(): { isTestMode: boolean } {
  const auth = useAuth();
  const isTestMode =
    typeof window !== "undefined" &&
    !!auth.user &&
    (auth.user as { role?: string }).role === "admin" &&
    localStorage.getItem("seee_test_mode") === "1";
  return { isTestMode };
}
