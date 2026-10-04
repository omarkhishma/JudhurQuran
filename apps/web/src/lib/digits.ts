"use client";

import { useSyncExternalStore } from "react";

/**
 * The reader's digits (SHL-Q05): by the interface's language (Arabic-Indic in Arabic, Western in English), or always
 * one of the two. Kept in this browser, like the theme, and set on <html> before the page paints (the layout's
 * script); the stylesheet then draws every page's digits in the chosen shapes (docs/DESIGN-SYSTEM.md §2) — the text
 * itself never changes, so copying it, searching it and a screen reader read the digits as written.
 */
export const DIGITS_KEY = "jadhr-digits";
export type Digits = "auto" | "arabic" | "latin";

function subscribe(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-digits"] });
  return () => mo.disconnect();
}

const read = (): Digits => {
  const d = document.documentElement.dataset.digits;
  return d === "arabic" || d === "latin" ? d : "auto";
};

export function useDigits(): Digits | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setDigits(d: Digits): void {
  if (d === "auto") delete document.documentElement.dataset.digits;
  else document.documentElement.dataset.digits = d;
  try {
    if (d === "auto") localStorage.removeItem(DIGITS_KEY);
    else localStorage.setItem(DIGITS_KEY, d);
  } catch {}
}
