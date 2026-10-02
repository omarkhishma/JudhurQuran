"use client";

import { useSyncExternalStore } from "react";

function query(q: string) {
  return {
    subscribe(cb: () => void) {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    get: () => window.matchMedia(q).matches,
  };
}
const WIDE = query("(min-width: 1200px)");
const DESK = query("(min-width: 900px)");

/** Breakpoints of the design (02 §2.6): wide ≥ 1200 (rail docked), desktop ≥ 900, phone below. */
export function useBreakpoint(): "wide" | "mid" | "phone" {
  const wide = useSyncExternalStore(WIDE.subscribe, WIDE.get, () => true);
  const desk = useSyncExternalStore(DESK.subscribe, DESK.get, () => true);
  return wide ? "wide" : desk ? "mid" : "phone";
}
