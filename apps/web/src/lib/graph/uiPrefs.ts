"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { reportStorageFailure, storageFrozen } from "@/lib/store/safeStorage";

/**
 * The editor's panels and display, kept on this device only (EDT-309, HWF-34, QAN-22): the library open or
 * folded to its rail, the card types shown or hidden, the details open, and transliteration — off unless the
 * reader turns it on in the Arabic interface, on in the English one. Not synced: they describe a screen.
 */
type UiPrefs = {
  libraryOpen: boolean;
  typesHidden: boolean;
  detailsOpen: boolean;
  /** null: the language's default */
  translit: boolean | null;
  set: (p: Partial<Omit<UiPrefs, "set">>) => void;
};

export const GRAPH_UI_KEY = "jadhr-graph-ui";
/** The editor in the split view's graph pane (P8.6): a pane half a screen wide, so it opens with the library and the
 * details folded to their rails, and keeps its own panels apart from the editor's on its own. Only this site frames
 * its pages (frame-ancestors 'self'), and only the split view does. */
const inPane = typeof window !== "undefined" && window.parent !== window;
const KEY = inPane ? `${GRAPH_UI_KEY}:split` : GRAPH_UI_KEY;

// written 200 ms after the last change (HWF-34): dragging a panel open and shut writes once; a page left before
// then writes what is pending as it goes
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, string>();
const write = (name: string) => {
  const value = pending.get(name);
  pending.delete(name);
  clearTimeout(timers.get(name));
  if (value === undefined || storageFrozen()) return;
  try {
    localStorage.setItem(name, value);
  } catch {
    reportStorageFailure();
  }
};
if (typeof window !== "undefined") window.addEventListener("pagehide", () => [...pending.keys()].forEach(write));
const debounced: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    pending.set(name, value);
    clearTimeout(timers.get(name));
    timers.set(name, setTimeout(() => write(name), 200));
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

export const useGraphUi = create<UiPrefs>()(
  persist(
    (set) => ({ libraryOpen: !inPane, typesHidden: false, detailsOpen: !inPane, translit: null, set: (p) => set(p) }),
    { name: KEY, storage: createJSONStorage(() => debounced), version: 1, partialize: ({ libraryOpen, typesHidden, detailsOpen, translit }) => ({ libraryOpen, typesHidden, detailsOpen, translit }) },
  ),
);

export const translitOn = (pref: boolean | null, locale: string) => pref ?? locale !== "ar";
