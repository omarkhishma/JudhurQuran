"use client";

import { del, get, keys } from "idb-keyval";
import { useAccount } from "@/lib/account/store";

/**
 * Everything this site keeps in the browser lives under keys that start with "jadhr-": stores in
 * localStorage (preferences, word states, stars, notes, sessions, proposals, choices, audio settings)
 * and documents in IndexedDB (graphs, the reader's own texts). Export and delete walk the prefix, so a
 * store added later is never left out of either (the promise in the footer and on the hub).
 */
const PREFIX = "jadhr-";

export type LocalExport = { format: "jadhr-local-1"; exported_at: string; local: Record<string, unknown>; documents: Record<string, unknown> };

function localKeys(): string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k && k.startsWith(PREFIX));
  } catch {
    return [];
  }
}

async function documentKeys(): Promise<string[]> {
  try {
    return (await keys()).map(String).filter((k) => k.startsWith(PREFIX));
  } catch {
    return [];
  }
}

// not the reader's data, so never in an export (removed on delete like the rest): the session token is a secret,
// and sync's memory of what it last agreed with the account and this browser's device id are machinery
const SECRET = new Set(["jadhr-auth", "jadhr-sync", "jadhr-device"]);

export async function collectLocalData(): Promise<LocalExport> {
  const local: Record<string, unknown> = {};
  for (const k of localKeys().filter((x) => !SECRET.has(x)).sort()) {
    const raw = localStorage.getItem(k);
    try {
      local[k] = JSON.parse(raw ?? "null");
    } catch {
      local[k] = raw;
    }
  }
  const documents: Record<string, unknown> = {};
  for (const k of (await documentKeys()).sort()) documents[k] = await get(k);
  return { format: "jadhr-local-1", exported_at: new Date().toISOString(), local, documents };
}

/** A JSON file of everything above, saved by the browser; nothing leaves the device. */
export async function exportLocalData(): Promise<void> {
  const data = await collectLocalData();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `jadhr-my-data-${data.exported_at.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Remove every key under the prefix. The caller reloads, so stores in memory cannot write it back. Signed in,
 * this device leaves the account first: clearing this browser must never delete what the account holds. */
export async function deleteLocalData(): Promise<void> {
  const { session, signOut } = useAccount.getState();
  if (session) {
    signOut();
    await fetch("/api/v1/auth/signout", { method: "POST", headers: { Authorization: `Bearer ${session}` } }).catch(() => null);
  }
  for (const k of localKeys()) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }
  for (const k of await documentKeys()) await del(k);
}
