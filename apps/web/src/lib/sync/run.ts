"use client";

import { create } from "zustand";
import { type Account, ApiError, authFetch, SignedOut, useAccount } from "@/lib/account/store";
import { notebookLoaded, useNotebook } from "@/lib/store/notebook";
import { adapters } from "./adapters";
import { type Change, chunks, commit, emptyState, type Incoming, type Local, plan, reconcile, STORES, type StoreName, type SyncState, vanished } from "./engine";

/**
 * One sync (PLAN P6.2): send what changed here, take the server's version where it refused, fetch what changed
 * elsewhere since the cursor, and write it into the stores. One run at a time in this tab, and one across tabs
 * where the browser has Web Locks; a change made during a run sets off another.
 */
export const SYNC_KEY = "jadhr-sync";
export const DEVICE_KEY = "jadhr-device";
/** Which account the records on this device came from, kept across sign-outs: another account is asked first (F8). */
export const OWNER_KEY = "jadhr-owner";

export type SyncStatus = {
  state: "idle" | "syncing" | "offline" | "error";
  last: number | null;
  /** records kept on this device because one is larger than the server keeps */
  tooLarge: string[];
  /** new records kept on this device because the account holds as many as it can (F14) */
  full: number;
  /** deletions made here waiting for the reader's word, per store (F11) */
  held: Partial<Record<StoreName, number>>;
  /** stores this browser could not read, so not synced this time (F11) */
  unreadable: StoreName[];
  /** another account's records are on this device: nothing syncs until the reader says what to do with them (F8) */
  owner: string | null;
  /** this browser's own records, on no account yet: they go up only on the reader's word, which names the account
   * (security review M1 — a sign-in link someone sent would otherwise carry them into the sender's account) */
  first: boolean;
  error: string | null;
};
export const useSyncStatus = create<SyncStatus>(() => ({ state: "idle", last: null, tooLarge: [], full: 0, held: {}, unreadable: [], owner: null, first: false, error: null }));

/** What a reader keeps of their own — notes, saved items, texts, maps, the journal, word states — as opposed to the
 * choices of how pages look and the flags of a first visit, which say nothing about anyone. */
function holdsOwn(locals: Partial<Record<StoreName, Local>>): boolean {
  return Object.entries(locals).some(([store, l]) => {
    if (!l || store === "prefs" || store === "audio") return false;
    if (store === "personal") return [...l.keys()].some((k) => !k.startsWith("f:"));
    return l.size > 0;
  });
}

function loadState(user: string): SyncState {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as SyncState | null;
    if (s && s.user === user) return s;
  } catch {}
  return emptyState(user);
}

function saveState(s: SyncState): void {
  live();
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  } catch {}
}

const readOwner = (): string | null => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};

/** Records this device holds now belong with this account (after a sync, or the reader's word). */
export function setOwner(user: string): void {
  try {
    localStorage.setItem(OWNER_KEY, user);
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

/** Lookups waiting to be shared, when the reader has turned that on (P6.1): sent with the next sync, in a batch. */
type Lookup = { lemma: string | null; root: string | null; verse: string | null };
let lookups: Lookup[] = [];
export function queueLookup(e: Lookup): void {
  if (!useAccount.getState().user?.settings?.share_lookups) return;
  lookups = [...lookups, e].slice(-500);
}

let applying = 0;
/** true while sync writes into the stores, so the change it makes does not set off another sync */
export const isApplying = () => applying > 0;

/** This tab stops syncing (its data is being deleted, F15): a run in progress writes nothing more. */
let stopped = false;
class Stopped extends Error {}
function live(): void {
  if (stopped) throw new Stopped();
}

/** Stop syncing in this tab and wait for a run in progress to end; the page reloads after, which starts afresh. */
export async function stopSync(): Promise<void> {
  stopped = true;
  await running?.catch(() => undefined);
}

async function write(all: ReturnType<typeof adapters>, changes: Partial<Record<StoreName, Change[]>>, touched: Set<StoreName>): Promise<void> {
  for (const [store, list] of Object.entries(changes) as [StoreName, Change[]][]) {
    if (!list.length) continue;
    live();
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

type PushResult = { applied: { store: string; key: string }[]; rejected: { store: string; key: string; server: Incoming }[]; refused?: { store: string; key: string; reason: "too_large" | "full" }[] };
type PullResult = { records: Incoming[]; cursor: number; more: boolean; full?: boolean; settings: Account["settings"] };

/** Whether a run must follow at once (the journal just turned on, so this device's own goes up). */
let followUp = false;

/** Stores whose held deletions the reader confirmed (they go up in the next run), or asked to have back (F11). */
const allowed = new Set<StoreName>();
const restoring = new Set<StoreName>();

/** The reader's word on deletions held in a store: send them to the account, or bring the records back from it. */
export function answerDeletions(store: StoreName, send: boolean): Promise<Set<StoreName>> {
  (send ? allowed : restoring).add(store);
  useSyncStatus.setState((s) => {
    const held = { ...s.held };
    delete held[store];
    return { held };
  });
  return runSync();
}

async function once(touched: Set<StoreName>): Promise<void> {
  const { session, user } = useAccount.getState();
  if (!session || !user || stopped) return;
  // a store read asynchronously must be read before it is compared, and one that could not be read stays out:
  // read as empty, its records would look deleted (F11)
  let notebook = await notebookLoaded();
  if (!notebook) {
    await useNotebook.persist.rehydrate();
    notebook = await notebookLoaded();
  }
  const state = loadState(user.id);
  const all = adapters(deviceId());
  const journalOn = !!user.settings?.sync_journal;
  if (!journalOn) {
    // the journal stays on this device; turned on again later, it goes up afresh
    delete state.shadow.journal;
    delete state.dirty.journal;
  }
  const unreadable: StoreName[] = notebook ? [] : ["notebook"];
  const synced = (journal: boolean) => STORES.filter((s) => (s !== "journal" || journal) && !unreadable.includes(s));
  const enabled = synced(journalOn);
  const readAll = async (stores: readonly StoreName[] = enabled): Promise<Partial<Record<StoreName, Local>>> =>
    Object.fromEntries(await Promise.all(stores.map(async (s) => [s, await all[s].read()] as const)));

  const locals = await readAll();
  // another account's records on this device are not taken into this one without the reader's word (F8)
  const owner = readOwner();
  const fresh = !state.cursor && !Object.keys(state.shadow).length;
  if (owner && owner !== user.id && fresh && Object.values(locals).some((l) => l && l.size > 0)) {
    useSyncStatus.setState({ state: "idle", owner, first: false, error: null });
    return;
  }
  // nor are this browser's own records taken into the first account it signs in to without the reader's word (M1)
  if (!owner && fresh && holdsOwn(locals)) {
    useSyncStatus.setState({ state: "idle", owner: null, first: true, error: null });
    return;
  }
  useSyncStatus.setState({ state: "syncing", owner: null, first: false, error: null });

  // records the reader asked to have back: forgotten as agreed, so the pull from the beginning writes them again
  const back = [...restoring].filter((s) => enabled.includes(s));
  for (const store of back) {
    const shadow = state.shadow[store] ?? {};
    for (const key of Object.keys(shadow))
      if (!locals[store]?.has(key)) {
        delete shadow[key];
        delete state.dirty[store]?.[key];
      }
  }
  const { push, tooLarge, held } = plan(locals, state, Date.now(), { appendOnly: new Set(["journal"]), allowDeletions: allowed });
  saveState(state); // when each change was first seen survives a failed push
  const kept = { tooLarge: [...tooLarge], full: 0 };
  for (const chunk of chunks(push)) {
    const res = await authFetch<PushResult>("/me/sync", { method: "POST", body: JSON.stringify({ records: chunk }) });
    await write(all, group(res.rejected.map((r) => r.server)), touched);
    const refused = res.refused ?? [];
    commit(state, [], chunk, res.rejected, refused);
    for (const r of refused) {
      if (r.reason === "full") kept.full++;
      else kept.tooLarge.push(`${r.store}/${r.key}`);
    }
    saveState(state);
  }
  for (const s of enabled) allowed.delete(s); // the reader's word covers the deletions it was given for
  commit(state, enabled, [], []); // a store with nothing in it has synced too

  const incoming: Incoming[] = [];
  let cursor = back.length ? 0 : state.cursor;
  let settings: Account["settings"] = user.settings;
  let full = false;
  for (let more = true; more; ) {
    const r = await authFetch<PullResult>(`/me/sync?since=${cursor}`);
    full ||= !!r.full;
    incoming.push(...r.records);
    cursor = r.cursor;
    settings = r.settings;
    more = r.more;
  }
  for (const s of back) restoring.delete(s);
  // deletions purged on the server before this device saw them: what it agreed and no longer finds there went (F6)
  if (full) incoming.push(...vanished(incoming, state));
  live();
  if (JSON.stringify(settings) !== JSON.stringify(user.settings)) useAccount.getState().setUser({ ...user, settings });
  // the journal turned on elsewhere is learnt from this pull: its records are taken now (the cursor moves past
  // them), and this device's own go up in the run that follows
  const journalNow = !!settings.sync_journal;
  if (journalNow && !journalOn) followUp = true;
  const changes = reconcile(incoming, await readAll(synced(journalNow)), state);
  if (!journalNow) delete changes.journal;
  await write(all, changes, touched);
  state.cursor = cursor;
  saveState(state);
  setOwner(user.id);
  // shared lookups go only while sharing is on; turned off, what was waiting is dropped, never sent
  if (lookups.length && settings.share_lookups) {
    const batch = lookups;
    lookups = [];
    await authFetch("/me/lookups", { method: "POST", body: JSON.stringify({ events: batch }) }).catch(() => {
      lookups = [...batch, ...lookups].slice(-500);
    });
  } else if (!settings.share_lookups) lookups = [];
  useSyncStatus.setState({ state: "idle", last: Date.now(), tooLarge: kept.tooLarge, full: kept.full, held, unreadable, error: null });
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
      followUp = false;
      try {
        if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("jadhr-sync", () => once(touched));
        else await once(touched);
        if (followUp) again = true;
      } catch (e) {
        if (e instanceof Stopped) break;
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
    } while (again && !stopped);
    return touched;
  };
  running = go().finally(() => {
    running = null;
  });
  return running;
}
