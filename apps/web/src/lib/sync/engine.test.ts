import { describe, expect, it } from "vitest";
import { canonical, chunks, commit, DELETION_GUARD, emptyState, hash, type Local, plan, reconcile, type SyncState, vanished } from "./engine";

const T = Date.UTC(2026, 9, 3);
const local = (entries: [string, unknown, number?][]): Local => new Map(entries.map(([k, value, at]) => [k, { value, at }]));

/** A device that has agreed with the account on these records. */
function synced(store: "saved" | "personal" | "journal", entries: [string, unknown][]): SyncState {
  const s = emptyState("u1");
  s.shadow[store] = Object.fromEntries(entries.map(([k, v]) => [k, hash(v)]));
  return s;
}

describe("the sync engine (P6.2, PRF-33)", () => {
  it("hashes equal values equally whatever order their keys were written in", () => {
    expect(canonical({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe('{"a":[1,{"d":2}],"b":1}');
    expect(hash({ a: 1, b: "عِلْم" })).toBe(hash({ b: "عِلْم", a: 1 }));
    expect(hash({ a: 1 })).not.toBe(hash({ a: 2 }));
  });

  it("on a first sign-in sends everything with the time each record carries, or 1 when it carries none", () => {
    const s = emptyState("u1");
    const { push } = plan({ saved: local([["b:lemma:ilm", { label: "عِلْم" }, T - 5000]]), personal: local([["w:ilm", "known"]]) }, s, T);
    expect(push.map((r) => [r.store, r.key, r.updated_at])).toEqual([
      ["saved", "b:lemma:ilm", T - 5000],
      ["personal", "w:ilm", 1],
    ]);
  });

  it("keeps a first sync's times for the retry when the push fails halfway", () => {
    const s = emptyState("u1");
    const mine = local([["b:a", 1, T - 9], ["b:b", 2]]);
    const first = plan({ saved: mine }, s, T).push;
    commit(s, [], first.slice(0, 1), []); // the first half went up, then the network failed
    expect(plan({ saved: mine }, s, T + 60_000).push.map((r) => [r.key, r.updated_at])).toEqual([["b:b", 1]]);
  });

  it("then sends only what changed, stamped when the change was first seen — an offline edit keeps its time", () => {
    const s = synced("saved", [["b:a", { x: 1 }], ["b:b", { x: 2 }]]);
    const changed = local([["b:a", { x: 1 }], ["b:b", { x: 3 }]]);
    expect(plan({ saved: changed }, s, T).push.map((r) => [r.key, r.updated_at])).toEqual([["b:b", T]]);
    // the push failed; an hour later the same change still carries its first time
    expect(plan({ saved: changed }, s, T + 3_600_000).push[0].updated_at).toBe(T);
    // changed again: the new change has the new time
    expect(plan({ saved: local([["b:a", { x: 1 }], ["b:b", { x: 4 }]]) }, s, T + 7_200_000).push[0].updated_at).toBe(T + 7_200_000);
  });

  it("sends a deletion as a tombstone, except from an append-only store whose local copy is capped", () => {
    const s = synced("saved", [["b:a", 1], ["b:b", 2]]);
    expect(plan({ saved: local([["b:a", 1]]) }, s, T).push).toEqual([{ store: "saved", key: "b:b", value: null, deleted: true, updated_at: T }]);
    const j = synced("journal", [["s:2026-01-01:quran:d1", { lookups: 3 }]]);
    expect(plan({ journal: local([]) }, j, T, { appendOnly: new Set(["journal"]) }).push).toEqual([]);
    expect(j.shadow.journal).toEqual({});
  });

  it("keeps a record too large for the server on this device and says so", () => {
    const { push, tooLarge } = plan({ saved: local([["n:big", "x".repeat(50)]]) }, emptyState("u1"), T, { maxBytes: 20 });
    expect([push, tooLarge]).toEqual([[], ["saved/n:big"]]);
  });

  it("agrees on what the server took, and on the server's version where it refused", () => {
    const s = emptyState("u1");
    const { push } = plan({ saved: local([["b:a", 1], ["b:b", 2]]) }, s, T);
    commit(s, ["saved", "notebook"], push, [{ store: "saved", key: "b:b", server: { store: "saved", key: "b:b", value: 9, deleted: false, updated_at: T } }]);
    expect(s.shadow).toEqual({ saved: { "b:a": hash(1), "b:b": hash(9) }, notebook: {} });
    expect(s.dirty.saved).toEqual({});
  });

  it("applies another device's records unless this device changed the same record since it last agreed", () => {
    const s = synced("saved", [["b:a", 1], ["b:b", 2], ["b:c", 3]]);
    const mine = local([["b:a", 1], ["b:b", 20], ["b:c", 3]]);
    const out = reconcile(
      [
        { store: "saved", key: "b:a", value: 10, deleted: false, updated_at: T },
        { store: "saved", key: "b:b", value: 200, deleted: false, updated_at: T }, // changed here too: the server decides next push
        { store: "saved", key: "b:c", value: null, deleted: true, updated_at: T },
        { store: "saved", key: "b:d", value: 4, deleted: false, updated_at: T },
        { store: "journal", key: "s:x", value: 1, deleted: false, updated_at: T }, // not synced on this device
      ],
      { saved: mine },
      s,
    );
    expect(out).toEqual({
      saved: [
        { key: "b:a", value: 10, deleted: false },
        { key: "b:c", value: null, deleted: true },
        { key: "b:d", value: 4, deleted: false },
      ],
    });
    expect(s.shadow.saved).toEqual({ "b:a": hash(10), "b:b": hash(2), "b:d": hash(4) });
  });

  it("treats a record that already matches as agreed, and takes only the last version of a key in one pull", () => {
    const s = emptyState("u1");
    s.shadow.saved = {};
    const out = reconcile(
      [
        { store: "saved", key: "b:a", value: 1, deleted: false, updated_at: T },
        { store: "saved", key: "b:x", value: 1, deleted: false, updated_at: T },
        { store: "saved", key: "b:x", value: 2, deleted: false, updated_at: T + 1 },
      ],
      { saved: local([["b:a", 1]]) },
      s,
    );
    expect(out).toEqual({ saved: [{ key: "b:x", value: 2, deleted: false }] });
    expect(s.shadow.saved).toEqual({ "b:a": hash(1), "b:x": hash(2) });
  });

  it("holds many deletions in one store for the reader's word, and sends them once confirmed (F11)", () => {
    const keys = Array.from({ length: 40 }, (_, i) => [`n:${i}`, i] as [string, unknown]);
    const s = synced("saved", keys);
    // the store reads as empty, as a failed read would: nothing goes up, nothing is forgotten
    const held = plan({ saved: local([]) }, s, T);
    expect([held.push, held.held]).toEqual([[], { saved: 40 }]);
    expect(Object.keys(s.shadow.saved!)).toHaveLength(40);
    // a few deletions pass as ever
    expect(plan({ saved: local(keys.slice(0, 35)) }, s, T).push).toHaveLength(5);
    expect(DELETION_GUARD(40)).toBe(10);
    // confirmed: they go up
    expect(plan({ saved: local([]) }, s, T, { allowDeletions: new Set(["saved"]) }).push).toHaveLength(40);
  });

  it("keeps a refused record changed here, to try again (a full account, F14)", () => {
    const s = emptyState("u1");
    const { push } = plan({ saved: local([["b:a", 1], ["b:b", 2]]) }, s, T);
    commit(s, ["saved"], push, [], [{ store: "saved", key: "b:b" }]);
    expect(s.shadow.saved).toEqual({ "b:a": hash(1) });
    expect(plan({ saved: local([["b:a", 1], ["b:b", 2]]) }, s, T).push.map((r) => r.key)).toEqual(["b:b"]);
  });

  it("on a full resync reads what it agreed and no longer finds as deleted elsewhere (F6)", () => {
    const s = synced("saved", [["b:a", 1], ["b:gone", 2]]);
    const there = [{ store: "saved", key: "b:a", value: 1, deleted: false, updated_at: T }];
    expect(vanished(there, s)).toEqual([{ store: "saved", key: "b:gone", value: null, deleted: true, updated_at: 0 }]);
  });

  it("splits a push by count and by size, a record larger than a request's share going alone (F16)", () => {
    const rec = (key: string, n: number) => ({ store: "texts" as const, key, value: "x".repeat(n), deleted: false, updated_at: T });
    const push = [rec("a", 10), rec("b", 10), rec("c", 900), rec("d", 10), rec("e", 10), rec("f", 10)];
    expect(chunks(push, 3, 1000).map((c) => c.map((r) => r.key))).toEqual([["a", "b"], ["c"], ["d", "e", "f"]]);
    expect(chunks([], 3, 1000)).toEqual([]);
  });
});
