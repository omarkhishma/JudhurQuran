/**
 * The sync engine's rules (PLAN P6.2, PRF-33), kept pure so they can be tested without a browser or a server.
 *
 * Each store is a set of records keyed within it. The "shadow" is what this device last agreed with the
 * account, as a hash per record. A record whose hash differs from its shadow changed here; one in the shadow
 * but gone here was deleted here. Each change carries the time it was first seen, so a device that was offline
 * cannot pass an older edit off as new. The server keeps the newer version of each record and keeps the other
 * as a replaced version, so a merge destroys nothing.
 *
 * A store with no shadow at all has never synced on this device for this account: its records go up with the
 * time they carry (a note's last edit, a card's last review), or 1 when they carry none — so on a first sign-in
 * the account's existing choices win over a device's, and the device's are kept as replaced versions.
 */

export const STORES = ["saved", "personal", "journal", "notebook", "review", "prefs", "audio", "analyse", "graphs", "texts"] as const;
export type StoreName = (typeof STORES)[number];

/** One store's records as this device has them: a value and, where the record carries one, its own time. */
export type Local = Map<string, { value: unknown; at?: number }>;
export type Outgoing = { store: StoreName; key: string; value: unknown; deleted: boolean; updated_at: number };
export type Incoming = { store: string; key: string; value: unknown; deleted: boolean; updated_at: number };
export type Change = { key: string; value: unknown; deleted: boolean };

/** What a device remembers between syncs (localStorage "jadhr-sync"): never the records themselves. */
export type SyncState = {
  user: string;
  cursor: number;
  shadow: Partial<Record<StoreName, Record<string, string>>>;
  /** changed records not yet accepted by the server: their hash then, and when the change was first seen */
  dirty: Partial<Record<StoreName, Record<string, { h: string; at: number }>>>;
};

export const emptyState = (user: string): SyncState => ({ user, cursor: 0, shadow: {}, dirty: {} });

const GONE = "∅";

/** JSON with sorted keys, so equal values hash equally whatever order their keys were written in. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : canonical(x))).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

/** cyrb53: a fast 53-bit string hash — enough to tell a changed record from an unchanged one. */
export function hash(v: unknown): string {
  const s = canonical(v);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const byteSize = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

export type PlanOptions = {
  /** stores whose records only grow: a record gone here is not deleted for every device (the journal) */
  appendOnly?: ReadonlySet<StoreName>;
  /** the largest value the server keeps for one record; larger ones stay on this device */
  maxBytes?: number;
};

/** What this device sends: every record that changed since the shadow, with when the change was first seen. */
export function plan(locals: Partial<Record<StoreName, Local>>, state: SyncState, now: number, opts: PlanOptions = {}): { push: Outgoing[]; tooLarge: string[] } {
  const push: Outgoing[] = [];
  const tooLarge: string[] = [];
  const maxBytes = opts.maxBytes ?? 900_000;
  for (const store of STORES) {
    const local = locals[store];
    if (!local) continue;
    const shadow = state.shadow[store];
    const fresh = shadow === undefined;
    const dirty = (state.dirty[store] ??= {});
    // a first sync's times are remembered too, so a push that fails halfway keeps them for the retry
    const stamp = (key: string, h: string, at?: number) => {
      const d = dirty[key];
      const when = d && d.h === h ? d.at : fresh ? (at ?? 1) : now;
      dirty[key] = { h, at: when };
      return when;
    };
    for (const [key, { value, at }] of local) {
      const h = hash(value);
      if (!fresh && shadow[key] === h) {
        delete dirty[key];
        continue;
      }
      if (byteSize(value) > maxBytes) {
        tooLarge.push(`${store}/${key}`);
        continue;
      }
      push.push({ store, key, value, deleted: false, updated_at: stamp(key, h, at) });
    }
    if (fresh) continue;
    for (const key of Object.keys(shadow)) {
      if (local.has(key)) continue;
      if (opts.appendOnly?.has(store)) {
        delete shadow[key]; // dropped here (a cap), still kept for the account
        continue;
      }
      push.push({ store, key, value: null, deleted: true, updated_at: stamp(key, GONE) });
    }
  }
  return { push, tooLarge };
}

/** After a push: the records the server took are agreed; for the ones it refused, the server's version is. */
export function commit(state: SyncState, stores: Iterable<StoreName>, sent: Outgoing[], rejected: { store: string; key: string; server: Incoming }[]): void {
  for (const s of stores) state.shadow[s] ??= {};
  const lost = new Set(rejected.map((r) => `${r.store}\u0000${r.key}`));
  for (const r of sent) {
    const shadow = (state.shadow[r.store] ??= {});
    delete state.dirty[r.store]?.[r.key];
    if (lost.has(`${r.store}\u0000${r.key}`)) continue;
    if (r.deleted) delete shadow[r.key];
    else shadow[r.key] = hash(r.value);
  }
  for (const r of rejected) agree(state, r.server);
}

function agree(state: SyncState, r: Incoming): void {
  const shadow = (state.shadow[r.store as StoreName] ??= {});
  if (r.deleted) delete shadow[r.key];
  else shadow[r.key] = hash(r.value);
}

/**
 * Records from other devices: applied where this device has not changed the record since it last agreed (a
 * change made here meanwhile goes up next time, and the server decides between the two). Returns, per store,
 * what to write into this device's stores.
 */
export function reconcile(incoming: Incoming[], locals: Partial<Record<StoreName, Local>>, state: SyncState): Partial<Record<StoreName, Change[]>> {
  const last = new Map<string, Incoming>();
  for (const r of incoming) last.set(`${r.store}\u0000${r.key}`, r);
  const out: Partial<Record<StoreName, Change[]>> = {};
  for (const r of last.values()) {
    const store = r.store as StoreName;
    const local = locals[store];
    if (!local) continue; // a store this device does not sync (the journal turned off, or one it does not know)
    const mine = local.get(r.key);
    const hl = mine === undefined ? undefined : hash(mine.value);
    const hr = r.deleted ? undefined : hash(r.value);
    if (hl === hr) {
      agree(state, r);
      continue;
    }
    if (hl !== state.shadow[store]?.[r.key]) continue;
    (out[store] ??= []).push({ key: r.key, value: r.deleted ? null : r.value, deleted: r.deleted });
    agree(state, r);
  }
  return out;
}
