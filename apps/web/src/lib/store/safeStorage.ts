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

const storage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      failed = true;
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("jadhr:storage-error"));
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
