"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";
import { bodyOffsets, makeRun, type Run } from "./run";

type Span = { from: number; to: number };

/**
 * The reader's selection inside an element, as offsets in the text it shows (B36). It is kept when a press elsewhere
 * only collapses it — so the button that quotes it can be pressed, on a phone too — and given up when the reader
 * selects something else, or clears it.
 */
export function useSelectionIn(ref: RefObject<HTMLElement | null>): [Span | null, () => void] {
  const [sel, setSel] = useState<Span | null>(null);
  useEffect(() => {
    const on = () => {
      const s = document.getSelection();
      const el = ref.current;
      if (!s || !el || s.rangeCount === 0 || s.isCollapsed) return;
      const r = s.getRangeAt(0);
      if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return setSel(null);
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.startContainer, r.startOffset);
      const from = pre.toString().length;
      setSel({ from, to: from + r.toString().length });
    };
    document.addEventListener("selectionchange", on);
    return () => document.removeEventListener("selectionchange", on);
  }, [ref]);
  const clear = useCallback(() => {
    setSel(null);
    document.getSelection()?.removeAllRanges();
  }, []);
  return [sel, clear];
}

/** The passage chosen in an article as it is shown, as a run of the article as the dataset serves it. */
export function passageOf(body: string | undefined, shown: string, sel: Span | null): Run | null {
  if (!body || !sel) return null;
  const at = bodyOffsets(body, shown, sel.from, sel.to);
  return at ? makeRun(body, at[0], at[1]) : null;
}
