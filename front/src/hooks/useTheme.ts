import { useState, useEffect } from "react";

export const useTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Проверяем сохранённое значение или системные настройки
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return saved === "true";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    // Применяем класс к document
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", String(isDarkMode));

    // Синхронизируем другие вкладки/хуки внутри приложения
    // (storage не всегда срабатывает в той же вкладке)
    window.dispatchEvent(new Event("seee:darkMode"));
  }, [isDarkMode]);

  useEffect(() => {
    const syncFromStorage = () => {
      const saved = localStorage.getItem("darkMode");
      if (saved === null) return;
      const next = saved === "true";
      setIsDarkMode((prev) => (prev === next ? prev : next));
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "darkMode") return;
      syncFromStorage();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("seee:darkMode", syncFromStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("seee:darkMode", syncFromStorage);
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return { isDarkMode, toggleDarkMode };
};
