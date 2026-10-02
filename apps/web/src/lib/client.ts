"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/** true after hydration, false during SSR and the hydration pass — without an effect. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** true from the frame after the first commit. For portals into server-rendered DOM: after a client-side
 * navigation that DOM does not exist yet during the first render, which useIsClient cannot tell. */
export function useAfterMount(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function subscribeStorage(cb: () => void): () => void {
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("jadhr:storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("jadhr:storage", onStorage);
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
  window.dispatchEvent(new Event("jadhr:storage"));
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
