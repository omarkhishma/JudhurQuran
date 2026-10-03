"use client";

import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * localStorage for the persisted stores, with writes that cannot throw (RDR-444): a full quota or a
 * browser that refuses storage leaves the in-memory state working, and the reader is told once, through
 * the "jadhr:storage-error" event the reader shows as a toast.
 */
let failed = false;

/** Whether a write has failed this session (a write can fail before anything listens for it). */
export const storageFailed = () => failed;

/** Tell the reader, once, that this browser would not save (StorageWarning listens). */
export function reportStorageFailure(): void {
  failed = true;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("jadhr:storage-error"));
}

let frozen = false;

/** Stop every store writing in this tab: this browser's data is being deleted, and the page reloads next (F15). */
export function freezeStorage(): void {
  frozen = true;
}
export const storageFrozen = () => frozen;

const storage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (frozen) return;
    try {
      localStorage.setItem(name, value);
    } catch {
      reportStorageFailure();
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* nothing to remove */
    }
  },
};

export const safeJSONStorage = createJSONStorage(() => storage);
