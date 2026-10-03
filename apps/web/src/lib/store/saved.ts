"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { verseRef } from "@/lib/reader/store";
import { safeJSONStorage } from "@/lib/store/safeStorage";

/** Personal, device-local state (never sent to a server): bookmarks, verse notes, recent words. */
/** A starred entry is a lemma keyed by its slug (the reader's ☆, RDR-520: one list for every screen);
 * "word" keeps a word occurrence by its location. */
export type Bookmark = { kind: "verse" | "word" | "lemma" | "root"; key: string; label: string; at: number };
/** A note on a verse: `verse` is its key in its text (2:255); the map is keyed by text and verse
 * (`quran:2:255`, verseRef), so a second text's passages never collide with the Quran's (RDR-518). */
export type Note = { verse: string; text: string; at: number };
export type Visit = { location: string; label: string; root: string | null; at: number };

type SavedState = {
  bookmarks: Bookmark[];
  notes: Record<string, Note>;
  history: Visit[];
  toggleBookmark: (b: Omit<Bookmark, "at">) => void;
  /** a verse key in the Quran (2:255); stored under verseRef */
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
          if (text.trim()) notes[verseRef(verse)] = { verse, text, at: Date.now() };
          else delete notes[verseRef(verse)];
          return { notes };
        }),
      visit: (v) =>
        set((s) => ({ history: [{ ...v, at: Date.now() }, ...s.history.filter((x) => x.location !== v.location)].slice(0, 60) })),
      clearAll: () => set({ bookmarks: [], notes: {}, history: [] }),
    }),
    {
      name: "jadhr-saved",
      storage: safeJSONStorage,
      version: 2,
      // version 2 keys notes by text and verse (quran:2:255) instead of the bare verse key (RDR-518)
      migrate: (old, version) => {
        const s = (old ?? {}) as Partial<SavedState>;
        if (version >= 2 || !s.notes) return s as SavedState;
        const notes = Object.fromEntries(Object.values(s.notes).map((n) => [verseRef(n.verse), n]));
        return { ...s, notes } as SavedState;
      },
    },
  ),
);

/** The reader's star for a lemma: one list that Saved, the Notebook and the review queue all read. */
export function useStar(slug: string, label: string): [boolean, () => void] {
  const on = useSaved((s) => s.bookmarks.some((b) => b.kind === "lemma" && b.key === slug));
  const toggle = useSaved((s) => s.toggleBookmark);
  return [on, () => toggle({ kind: "lemma", key: slug, label })];
}

/** The reader's note on a Quran verse, if any. */
export const noteOn = (s: { notes: Record<string, Note> }, verseKey: string): Note | undefined => s.notes[verseRef(verseKey)];

export function isBookmarked(list: Bookmark[], kind: Bookmark["kind"], key: string): boolean {
  return list.some((x) => x.kind === kind && x.key === key);
}
