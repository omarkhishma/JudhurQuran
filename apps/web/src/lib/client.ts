"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true after hydration, false during SSR and the hydration pass — without an effect. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

function subscribeStorage(cb: () => void): () => void {
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("judhur:storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("judhur:storage", onStorage);
  };
}

/** Raw localStorage string (null on the server or when absent). Parse it in render. */
export function useLocalStorage(key: string): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

export function setLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event("judhur:storage"));
}

function subscribeTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export function useTheme(): "light" | "dark" | null {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => null,
  );
}
