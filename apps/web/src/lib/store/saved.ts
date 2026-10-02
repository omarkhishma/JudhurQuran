"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Personal, device-local state (never sent to a server): bookmarks, verse notes, recent words. */
export type Bookmark = { kind: "verse" | "word" | "root"; key: string; label: string; at: number };
export type Note = { verse: string; text: string; at: number };
export type Visit = { location: string; label: string; root: string | null; at: number };

type SavedState = {
  bookmarks: Bookmark[];
  notes: Record<string, Note>;
  history: Visit[];
  toggleBookmark: (b: Omit<Bookmark, "at">) => void;
  setNote: (verse: string, text: string) => void;
  visit: (v: Omit<Visit, "at">) => void;
  clearAll: () => void;
};

export const useSaved = create<SavedState>()(
  persist(
    (set) => ({
      bookmarks: [],
      notes: {},
      history: [],
      toggleBookmark: (b) =>
        set((s) =>
          s.bookmarks.some((x) => x.kind === b.kind && x.key === b.key)
            ? { bookmarks: s.bookmarks.filter((x) => !(x.kind === b.kind && x.key === b.key)) }
            : { bookmarks: [{ ...b, at: Date.now() }, ...s.bookmarks] },
        ),
      setNote: (verse, text) =>
        set((s) => {
          const notes = { ...s.notes };
          if (text.trim()) notes[verse] = { verse, text, at: Date.now() };
          else delete notes[verse];
          return { notes };
        }),
      visit: (v) =>
        set((s) => ({ history: [{ ...v, at: Date.now() }, ...s.history.filter((x) => x.location !== v.location)].slice(0, 60) })),
      clearAll: () => set({ bookmarks: [], notes: {}, history: [] }),
    }),
    { name: "jadhr-saved", version: 1 },
  ),
);

export function isBookmarked(list: Bookmark[], kind: Bookmark["kind"], key: string): boolean {
  return list.some((x) => x.kind === kind && x.key === key);
}
