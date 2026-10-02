"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelState =
  | { kind: "word"; location: string }
  | { kind: "verse"; key: string; tab?: string }
  | null;

type ReaderState = {
  panel: PanelState;
  openWord: (location: string) => void;
  openVerse: (key: string, tab?: string) => void;
  close: () => void;
};

export const useReader = create<ReaderState>((set) => ({
  panel: null,
  openWord: (location) => set({ panel: { kind: "word", location } }),
  openVerse: (key, tab) => set({ panel: { kind: "verse", key, tab } }),
  close: () => set({ panel: null }),
}));

export type ReadingPrefs = {
  scale: number; // reading text multiplier, floor 0.8, step 0.1
  showTranslation: boolean | null; // null → locale default (on in English, off in Arabic)
  inlineTafsir: boolean; // al-Muyassar under each verse
  translation: string;
  tafsirs: string[]; // ordered work ids shown in the verse panel
  layout: "verses" | "flow";
  highlightRoot: boolean;
};

type PrefsState = ReadingPrefs & {
  set: (p: Partial<ReadingPrefs>) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      scale: 1,
      showTranslation: null,
      inlineTafsir: false,
      translation: "saheeh",
      tafsirs: ["muyassar", "saadi", "ibn-kathir", "tabari", "qurtubi", "baghawi", "mukhtasar"],
      layout: "verses",
      highlightRoot: true,
      set: (p) => set(p),
    }),
    { name: "judhur-prefs", version: 1 },
  ),
);
