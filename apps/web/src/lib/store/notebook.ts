"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "./safeStorage";

/**
 * The reader's own notes (PLAN P5.4, inventory NTB): free notes with a title, a body, tags and the links their
 * @-mentions resolve to, kept in this browser (L6, NTB-Q01/Q02) and so in the export and the delete. Notes on a
 * verse stay where the reader writes them (the saved store, keyed by verse); the Notebook shows and edits both.
 */
export type NoteLinks = { roots: string[]; verses: string[] };
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
    { name: "jadhr-notebook", storage: safeJSONStorage, version: 1 },
  ),
);
