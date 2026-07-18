import { useEffect } from "react";

function roundViewportValue(value: number) {
  return `${Math.round(value)}px`;
}

function isEditableElement(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

export function useVisualViewportCssVars() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const visualViewport = window.visualViewport;
    let rafId = 0;

    const updateViewportVars = () => {
      rafId = 0;

      const layoutHeight = window.innerHeight;
      const layoutWidth = window.innerWidth;
      const viewportHeight = visualViewport?.height ?? layoutHeight;
      const viewportWidth = visualViewport?.width ?? layoutWidth;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const keyboardInset = Math.max(
        0,
        layoutHeight - viewportHeight - viewportTop,
      );
      const keyboardOpen =
        keyboardInset > 80 && isEditableElement(document.activeElement);

      root.style.setProperty(
        "--app-layout-height",
        roundViewportValue(layoutHeight),
      );
      root.style.setProperty(
        "--app-layout-width",
        roundViewportValue(layoutWidth),
      );
      root.style.setProperty(
        "--app-viewport-height",
        roundViewportValue(viewportHeight),
      );
      root.style.setProperty(
        "--app-viewport-width",
        roundViewportValue(viewportWidth),
      );
      root.style.setProperty(
        "--app-viewport-top",
        roundViewportValue(viewportTop),
      );
      root.style.setProperty(
        "--app-viewport-left",
        roundViewportValue(viewportLeft),
      );
      root.style.setProperty(
        "--app-keyboard-inset",
        roundViewportValue(keyboardInset),
      );
      root.dataset.keyboardOpen = keyboardOpen ? "true" : "false";
    };

    const scheduleUpdate = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(updateViewportVars);
    };

    scheduleUpdate();

    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate, {
      passive: true,
    });
    window.addEventListener("pageshow", scheduleUpdate, { passive: true });
    window.addEventListener("focusin", scheduleUpdate);
    window.addEventListener("focusout", scheduleUpdate);
    visualViewport?.addEventListener("resize", scheduleUpdate);
    visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.removeEventListener("pageshow", scheduleUpdate);
      window.removeEventListener("focusin", scheduleUpdate);
      window.removeEventListener("focusout", scheduleUpdate);
      visualViewport?.removeEventListener("resize", scheduleUpdate);
      visualViewport?.removeEventListener("scroll", scheduleUpdate);
      delete root.dataset.keyboardOpen;
    };
  }, []);
}
