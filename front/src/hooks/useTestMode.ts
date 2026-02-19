import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const STORAGE_KEY = "seee_test_mode";

export function useTestMode(): {
  isTestMode: boolean;
  setTestMode: (value: boolean) => void;
  toggleTestMode: () => void;
  canUseTestMode: boolean;
} {
  const { user, isAdmin } = useAuth();
  const [isTestMode, setTestModeState] = useState(false);

  const canUseTestMode = !!isAdmin;

  useEffect(() => {
    if (!canUseTestMode) {
      setTestModeState(false);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setTestModeState(raw === "1");
    } catch {
      setTestModeState(false);
    }
  }, [canUseTestMode]);

  const setTestMode = useCallback(
    (value: boolean) => {
      if (!canUseTestMode) return;
      setTestModeState(value);
      try {
        if (value) localStorage.setItem(STORAGE_KEY, "1");
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
    [canUseTestMode]
  );

  const toggleTestMode = useCallback(() => {
    setTestMode(!isTestMode);
  }, [isTestMode, setTestMode]);

  return { isTestMode, setTestMode, toggleTestMode, canUseTestMode };
}

export function getTestModeFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
