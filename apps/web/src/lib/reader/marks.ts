"use client";

import { useCallback } from "react";
import { displayBare } from "@/lib/arabic/normalize";
import { useAfterMount } from "@/lib/client";
import { usePrefs } from "./store";

/**
 * The vowel marks of a text that is not the mushaf (D7): the dictionaries, the hadith, the books and the reader's own
 * texts show them, or the reader hides them. The mushaf is never stripped. The server renders with the marks; the
 * browser takes them off once it has read the preference, so the page hydrates as it was sent.
 */
export function useMarks(): (text: string) => string {
  const marks = usePrefs((s) => s.marks);
  const mounted = useAfterMount();
  return useCallback((text: string) => (mounted && !marks ? displayBare(text) : text), [mounted, marks]);
}
