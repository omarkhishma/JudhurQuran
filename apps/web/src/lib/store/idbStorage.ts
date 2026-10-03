"use client";

import { del, get, set } from "idb-keyval";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { reportStorageFailure } from "./safeStorage";

/** Other tabs of this browser hear of each write here, as localStorage's own "storage" event tells them of its. */
export const STORES_CHANNEL = "jadhr-stores";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(STORES_CHANNEL) : null;
/** This tab's id: a channel also reaches other listeners in the same tab, which must not re-read their own write
 * (a re-read landing while the reader types would undo what they typed since). */
export const TAB_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
export type StoreMessage = { name: string; from: string };

/**
 * A persisted store kept in IndexedDB rather than localStorage (NTB-Q01: the reader's notes can be long, and
 * localStorage's few megabytes are shared by every store). A store kept in localStorage before is read from there
 * once and moved. If IndexedDB refuses, localStorage is tried; if both refuse, the reader is told.
 */
export function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      try {
        const v = await get<StorageValue<S>>(name);
        if (v !== undefined) return v;
      } catch {}
      try {
        const raw = localStorage.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
      } catch {
        return null;
      }
    },
    setItem: async (name, value) => {
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

/** Resolves once a persisted store has read its saved state (at once for one kept in localStorage). */
export function whenHydrated(store: { persist: { hasHydrated: () => boolean; onFinishHydration: (cb: () => void) => () => void } }): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = store.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}
