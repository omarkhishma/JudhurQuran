"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { PAGES } from "./pageCount";

/**
 * Turning the mushaf's pages (B1): the arrow keys as the pages lie — the next page to the left, as in a mushaf — when
 * no word, field or menu has the keys; a swipe on a phone, leftward for the next page.
 */
export function PageTurn({ page }: { page: number }) {
  const router = useRouter();
  useEffect(() => {
    const go = (n: number) => {
      if (n >= 1 && n <= PAGES) router.push(`/mushaf/${n}`);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu], .reader-panel, .reader-sheet") || el.matches(".w"))) return;
      if (e.key === "ArrowLeft") go(page + 1);
      else if (e.key === "ArrowRight") go(page - 1);
    };
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onEnd = (e: TouchEvent) => {
      // not a swipe inside the word's sheet or a dialog, which scroll and close by their own gestures
      if (!start || (e.target instanceof Element && e.target.closest(".reader-sheet, [role=dialog]"))) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(dx < 0 ? page + 1 : page - 1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [page, router]);
  return null;
}
