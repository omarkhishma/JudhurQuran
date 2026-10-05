"use client";

import { useSyncExternalStore } from "react";

/**
 * How this browser draws every page beyond the theme and the digits (B9, accessibility beyond AA): more contrast
 * (stronger text, lines and focus, at 7:1 — the system's own request followed when the reader has not chosen) and
 * wider spacing (taller lines and wider gaps between words; the Arabic letters never spaced apart, which would break
 * their joining). Kept in this browser like the theme, set on <html> before the page paints (the layout's script).
 */
export const CONTRAST_KEY = "jadhr-contrast";
export const SPACING_KEY = "jadhr-spacing";
export type Contrast = "auto" | "more";
export type Spacing = "normal" | "wide";

function subscribe(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-contrast", "data-spacing"] });
  return () => mo.disconnect();
}

export function useContrast(): Contrast | null {
  return useSyncExternalStore(subscribe, () => (document.documentElement.dataset.contrast === "more" ? "more" : "auto"), () => null);
}

export function useSpacing(): Spacing | null {
  return useSyncExternalStore(subscribe, () => (document.documentElement.dataset.spacing === "wide" ? "wide" : "normal"), () => null);
}

function keep(key: string, attr: "contrast" | "spacing", value: string | null): void {
  if (value === null) delete document.documentElement.dataset[attr];
  else document.documentElement.dataset[attr] = value;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export const setContrast = (c: Contrast) => keep(CONTRAST_KEY, "contrast", c === "more" ? "more" : null);
export const setSpacing = (s: Spacing) => keep(SPACING_KEY, "spacing", s === "wide" ? "wide" : null);
