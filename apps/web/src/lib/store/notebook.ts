"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { idbStorage } from "./idbStorage";

/**
 * The reader's own notes (PLAN P5.4, inventory NTB): free notes with a title, a body, tags and the links their
 * @-mentions resolve to, kept in this browser's IndexedDB (L6, NTB-Q01/Q02) and so in the export and the delete,
 * and synced when the reader signs in (P6). Notes on a verse stay where the reader writes them (the saved store,
 * keyed by verse); the Notebook shows and edits both.
 */
/** What a note's @-mentions resolve to: roots, verses and words (lemma slugs, for backlinks, NTB-31). */
export type NoteLinks = { roots: string[]; verses: string[]; words?: string[] };
export type FreeNote = { id: string; title: string; body: string; tags: string[]; created: number; updated: number; links: NoteLinks };

type NotebookState = {
  notes: FreeNote[];
  create: () => string;
  update: (id: string, patch: Partial<Pick<FreeNote, "title" | "body" | "tags" | "links">>) => void;
  remove: (id: string) => void;
};

export const useNotebook = create<NotebookState>()(
  persist(
    (set) => ({
      notes: [],
      create: () => {
        const now = Date.now();
        const id = `n${now.toString(36)}`;
        set((s) => ({ notes: [...s.notes, { id, title: "", body: "", tags: [], created: now, updated: now, links: { roots: [], verses: [] } }] }));
        return id;
      },
      update: (id, patch) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updated: patch.links && Object.keys(patch).length === 1 ? n.updated : Date.now() } : n)) })),
      remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    // only the notes are kept (IndexedDB stores values, not functions); read asynchronously, so screens wait for it
    { name: "jadhr-notebook", storage: idbStorage<Pick<NotebookState, "notes">>(), version: 1, partialize: (s) => ({ notes: s.notes }) },
  ),
);

const subscribeHydration = (cb: () => void) => useNotebook.persist.onFinishHydration(cb);

/** Whether the notes have been read from this browser yet (they arrive a moment after the page). */
export function useNotebookReady(): boolean {
  return useSyncExternalStore(subscribeHydration, () => useNotebook.persist.hasHydrated(), () => false);
}
