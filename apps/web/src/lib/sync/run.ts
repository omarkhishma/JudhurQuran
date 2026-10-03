"use client";

import { create } from "zustand";
import { type Account, ApiError, authFetch, SignedOut, useAccount } from "@/lib/account/store";
import { adapters } from "./adapters";
import { type Change, commit, emptyState, type Incoming, type Outgoing, plan, reconcile, STORES, type StoreName, type SyncState } from "./engine";

/**
 * One sync (PLAN P6.2): send what changed here, take the server's version where it refused, fetch what changed
 * elsewhere since the cursor, and write it into the stores. One run at a time in this tab, and one across tabs
 * where the browser has Web Locks; a change made during a run sets off another.
 */
export const SYNC_KEY = "jadhr-sync";
const DEVICE_KEY = "jadhr-device";
const CHUNK = 500;

export type SyncStatus = { state: "idle" | "syncing" | "offline" | "error"; last: number | null; tooLarge: string[]; error: string | null };
export const useSyncStatus = create<SyncStatus>(() => ({ state: "idle", last: null, tooLarge: [], error: null }));

function loadState(user: string): SyncState {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as SyncState | null;
    if (s && s.user === user) return s;
  } catch {}
  return emptyState(user);
}

function saveState(s: SyncState): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  } catch {}
}

/** This browser's id among the account's devices, kept across sign-outs so its journal days stay its own. */
export function deviceId(): string {
  try {
    const id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    const made = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    return "this";
  }
}

let applying = 0;
/** true while sync writes into the stores, so the change it makes does not set off another sync */
export const isApplying = () => applying > 0;

async function write(all: ReturnType<typeof adapters>, changes: Partial<Record<StoreName, Change[]>>, touched: Set<StoreName>): Promise<void> {
  for (const [store, list] of Object.entries(changes) as [StoreName, Change[]][]) {
    if (!list.length) continue;
    applying++;
    try {
      await all[store].apply(list);
    } finally {
      applying--;
    }
    touched.add(store);
  }
}

const group = (rs: Incoming[]): Partial<Record<StoreName, Change[]>> => {
  const out: Partial<Record<StoreName, Change[]>> = {};
  for (const r of rs) (out[r.store as StoreName] ??= []).push({ key: r.key, value: r.value, deleted: r.deleted });
  return out;
};

type PushResult = { applied: { store: string; key: string }[]; rejected: { store: string; key: string; server: Incoming }[] };
type PullResult = { records: Incoming[]; cursor: number; more: boolean; settings: Account["settings"] };

async function once(touched: Set<StoreName>): Promise<void> {
  const { session, user } = useAccount.getState();
  if (!session || !user) return;
  useSyncStatus.setState({ state: "syncing", error: null });
  const state = loadState(user.id);
  const all = adapters(deviceId());
  const journalOn = !!user.settings?.sync_journal;
  if (!journalOn) {
    // the journal stays on this device; turned on again later, it goes up afresh
    delete state.shadow.journal;
    delete state.dirty.journal;
  }
  const enabled = STORES.filter((s) => s !== "journal" || journalOn);
  const readAll = async () => Object.fromEntries(await Promise.all(enabled.map(async (s) => [s, await all[s].read()] as const)));

  const { push, tooLarge } = plan(await readAll(), state, Date.now(), { appendOnly: new Set(["journal"]) });
  saveState(state); // when each change was first seen survives a failed push
  for (let i = 0; i < push.length; i += CHUNK) {
    const chunk: Outgoing[] = push.slice(i, i + CHUNK);
    const res = await authFetch<PushResult>("/me/sync", { method: "POST", body: JSON.stringify({ records: chunk }) });
    await write(all, group(res.rejected.map((r) => r.server)), touched);
    commit(state, [], chunk, res.rejected);
    saveState(state);
  }
  commit(state, enabled, [], []); // a store with nothing in it has synced too

  const incoming: Incoming[] = [];
  let cursor = state.cursor;
  let settings: Account["settings"] = user.settings;
  for (let more = true; more; ) {
    const r = await authFetch<PullResult>(`/me/sync?since=${cursor}`);
    incoming.push(...r.records);
    cursor = r.cursor;
    settings = r.settings;
    more = r.more;
  }
  if (JSON.stringify(settings) !== JSON.stringify(user.settings)) useAccount.getState().setUser({ ...user, settings });
  const changes = reconcile(incoming, await readAll(), state);
  if (!settings.sync_journal) delete changes.journal;
  await write(all, changes, touched);
  state.cursor = cursor;
  saveState(state);
  useSyncStatus.setState({ state: "idle", last: Date.now(), tooLarge, error: null });
}

let running: Promise<Set<StoreName>> | null = null;
let again = false;

/** Run a sync, or join the one running (which then runs once more). Resolves with the stores it wrote into. */
export function runSync(): Promise<Set<StoreName>> {
  if (running) {
    again = true;
    return running;
  }
  const touched = new Set<StoreName>();
  const go = async () => {
    let relearned = false;
    do {
      again = false;
      try {
        if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("jadhr-sync", () => once(touched));
        else await once(touched);
      } catch (e) {
        if (e instanceof SignedOut) {
          useSyncStatus.setState({ state: "idle", error: null });
          break;
        }
        if (e instanceof ApiError && e.status === 403 && !relearned) {
          // a choice changed on another device (the journal turned off): learn it and go again, once
          relearned = true;
          const me = await authFetch<Account>("/me").catch(() => null);
          const u = useAccount.getState().user;
          if (me && u) {
            useAccount.getState().setUser({ ...u, settings: me.settings });
            again = true;
            continue;
          }
        }
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        useSyncStatus.setState({ state: offline || !(e instanceof ApiError) ? "offline" : "error", error: e instanceof Error ? e.message : String(e) });
        break;
      }
    } while (again);
    return touched;
  };
  running = go().finally(() => {
    running = null;
  });
  return running;
}
