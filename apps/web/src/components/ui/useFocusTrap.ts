"use client";

import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * What every overlay owes the keyboard (RDR-461, 02 §2.7): focus moves in — to `[data-autofocus]` or the first
 * control — Tab stays inside, Esc closes, and focus goes back to what opened it. `onClose` may change on every
 * render: it is read when needed, so a re-render never moves the reader's focus.
 */
export function useFocusTrap(box: RefObject<HTMLElement | null>, active: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      // focus that fell out (a control replaced under it) comes back to the edge it left from
      const inside = box.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === a || !inside)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (document.activeElement === z || !inside)) {
        e.preventDefault();
        a.focus();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [active, box]);
}
