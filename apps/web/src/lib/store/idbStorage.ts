"use client";

import { del, get, set } from "idb-keyval";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { reportStorageFailure, storageFrozen } from "./safeStorage";

/** Other tabs of this browser hear of each write here, as localStorage's own "storage" event tells them of its. */
export const STORES_CHANNEL = "jadhr-stores";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(STORES_CHANNEL) : null;
/** This tab's id: a channel also reaches other listeners in the same tab, which must not re-read their own write
 * (a re-read landing while the reader types would undo what they typed since). */
export const TAB_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
export type StoreMessage = { name: string; from: string };

/** Stores whose last read failed: never written until a read works, so what could not be read is not replaced. */
const unread = new Set<string>();

/**
 * A persisted store kept in IndexedDB rather than localStorage (NTB-Q01: the reader's notes can be long, and
 * localStorage's few megabytes are shared by every store). A store kept in localStorage before is read from there
 * once and moved. If IndexedDB refuses a write, localStorage takes it; if both refuse, the reader is told. A read
 * IndexedDB refuses fails the store's loading — it never reads as empty, which would let an empty notebook replace
 * the notes and sync delete them on every device (audit 11 F11).
 */
export function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      // a write IndexedDB refused went to localStorage, and every write it took removed that copy: one there is newer
      try {
        const raw = localStorage.getItem(name);
        if (raw) return JSON.parse(raw) as StorageValue<S>;
      } catch {}
      if (typeof indexedDB === "undefined") return null; // the server's render, or a browser with nowhere else to keep it
      try {
        const v = await get<StorageValue<S>>(name);
        unread.delete(name);
        return v ?? null;
      } catch (e) {
        unread.add(name);
        throw e;
      }
    },
    setItem: async (name, value) => {
      if (unread.has(name) || storageFrozen()) {
        if (unread.has(name)) reportStorageFailure();
        return;
      }
      try {
        await set(name, value);
        try {
          localStorage.removeItem(name);
        } catch {}
        channel?.postMessage({ name, from: TAB_ID } satisfies StoreMessage);
      } catch {
        try {
          localStorage.setItem(name, JSON.stringify(value));
        } catch {
          reportStorageFailure();
        }
      }
    },
    removeItem: async (name) => {
      try {
        await del(name);
      } catch {}
      try {
        localStorage.removeItem(name);
      } catch {}
    },
  };
}
