"use client";

import { useEffect } from "react";
import { usePersonal } from "@/lib/reader/store";

/**
 * Remembers where the reader is in a hadith collection or a book (LIB-Q03), so the Library's "continue" card
 * resumes there: in this browser, and synced with the reader's other positions when they are signed in.
 */
export function RecordPlace({ text, chapter, at, label }: { text: string; chapter: number; at: string; label: string }) {
  const setProgress = usePersonal((s) => s.setProgress);
  useEffect(() => {
    setProgress(text, { chapter, passage: 0, ref: at, label });
  }, [setProgress, text, chapter, at, label]);
  return null;
}
