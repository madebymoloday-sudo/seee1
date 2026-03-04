import { useEffect, useState } from "react";

const MOBILE_SCALE_KEY = "mobileUiScale";
const DEFAULT_MOBILE_SCALE = 0.94;

function isFiniteScale(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampScale(value: number) {
  return Math.min(1, Math.max(0.82, value));
}

function readInitialScale() {
  const saved = localStorage.getItem(MOBILE_SCALE_KEY);
  if (saved !== null) {
    const parsed = Number.parseFloat(saved);
    if (isFiniteScale(parsed)) return clampScale(parsed);
  }
  return DEFAULT_MOBILE_SCALE;
}

export function applyMobileUiScale(scale: number) {
  const safeScale = clampScale(scale);
  document.documentElement.style.setProperty("--mobile-ui-scale", safeScale.toFixed(2));
}

export function useMobileUiScale() {
  const [mobileUiScale, setMobileUiScaleState] = useState<number>(() => readInitialScale());

  useEffect(() => {
    applyMobileUiScale(mobileUiScale);
    localStorage.setItem(MOBILE_SCALE_KEY, String(mobileUiScale));
    window.dispatchEvent(new Event("seee:mobileUiScale"));
  }, [mobileUiScale]);

  useEffect(() => {
    const syncFromStorage = () => {
      const saved = localStorage.getItem(MOBILE_SCALE_KEY);
      if (saved === null) return;
      const parsed = Number.parseFloat(saved);
      if (!isFiniteScale(parsed)) return;
      const next = clampScale(parsed);
      setMobileUiScaleState((prev) => (prev === next ? prev : next));
      applyMobileUiScale(next);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== MOBILE_SCALE_KEY) return;
      syncFromStorage();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("seee:mobileUiScale", syncFromStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("seee:mobileUiScale", syncFromStorage);
    };
  }, []);

  const setMobileUiScale = (next: number) => {
    setMobileUiScaleState(clampScale(next));
  };

  const resetMobileUiScale = () => {
    setMobileUiScaleState(DEFAULT_MOBILE_SCALE);
  };

  return { mobileUiScale, setMobileUiScale, resetMobileUiScale };
}

