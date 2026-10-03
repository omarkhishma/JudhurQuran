"use client";

import { cleanStoredFile, FILE_PREFIX, getFile, restoreFile, type StoredFile } from "@/lib/graph/files";
import { DOCS_EVENT, GRAPH_PREFIX } from "@/lib/graph/persist";
import { FILE_ID } from "@/lib/graph/sanitize";
import { TEXT_PREFIX } from "@/lib/library/texts";
import { usePersonal, usePrefs } from "@/lib/reader/store";
import { useAnalyseChoices } from "@/lib/store/analyseChoices";
import { useAudio } from "@/lib/store/audio";
import { useNotebook } from "@/lib/store/notebook";
import { useReview } from "@/lib/store/review";
import { useSaved } from "@/lib/store/saved";
import { adapters } from "@/lib/sync/adapters";
import { type Change, type Local, type StoreName } from "@/lib/sync/engine";
import { compare } from "@/lib/sync/importCompare";
import { deviceId } from "@/lib/sync/run";

/**
 * A file this site exported, read back into this browser (plan B32): what it holds is compared with what is here
 * record by record, through the same adapters sync uses. New records are added; records that differ are replaced
 * only if the reader says so; nothing here is ever deleted by an import. Signed in, what is added then syncs as any
 * change does. A store saved by another version of the site is left out and named.
 */
/** `files`: the files the maps' fields hold (lib/graph/files) — kept when not already here, as a map's own import does */
export type ImportPlan = { add: Partial<Record<StoreName, Change[]>>; differ: Partial<Record<StoreName, Change[]>>; same: number; refused: StoreName[]; files?: Record<string, StoredFile> };

type Persisted = { getInitialState: () => unknown; persist: { getOptions: () => { version?: number } } };
const STORES: { key: string; store: Persisted; names: StoreName[] }[] = [
  { key: "jadhr-saved", store: useSaved, names: ["saved"] },
  { key: "jadhr-personal", store: usePersonal, names: ["personal", "journal"] },
  { key: "jadhr-notebook", store: useNotebook, names: ["notebook"] },
  { key: "jadhr-review", store: useReview, names: ["review"] },
  { key: "jadhr-prefs", store: usePrefs, names: ["prefs"] },
  { key: "jadhr-audio", store: useAudio, names: ["audio"] },
  { key: "jadhr-analyse-choices", store: useAnalyseChoices, names: ["analyse"] },
];
const DOCUMENTS: [prefix: string, tag: string, name: StoreName][] = [
  [GRAPH_PREFIX, "g", "graphs"],
  [TEXT_PREFIX, "x", "texts"],
];

/** The largest file read: an export of a full account is well under this. */
export const MAX_IMPORT_BYTES = 50_000_000;

type Saved = { state?: Record<string, unknown>; version?: number };

/** Read an exported file against this browser; null when it is not one. */
export async function planImport(text: string): Promise<ImportPlan | null> {
  let data: { format?: string; local?: Record<string, unknown>; documents?: Record<string, unknown> } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.format !== "jadhr-local-1" || typeof data.local !== "object" || typeof data.documents !== "object" || !data.local || !data.documents) return null;
  const local = data.local;
  const documents = data.documents;
  const all = adapters(deviceId());
  const plan: ImportPlan = { add: {}, differ: {}, same: 0, refused: [] };
  const take = (name: StoreName, theirs: Local, mine: Local) => {
    const c = compare(theirs, mine);
    if (c.add.length) plan.add[name] = c.add;
    if (c.differ.length) plan.differ[name] = c.differ;
    plan.same += c.same;
  };
  for (const { key, store, names } of STORES) {
    const saved = (local[key] ?? documents[key]) as Saved | undefined;
    if (!saved || typeof saved !== "object" || !saved.state || typeof saved.state !== "object") continue;
    // a store's shape is its version's: one saved by another version of the site is not guessed at
    if ((saved.version ?? 0) !== (store.persist.getOptions().version ?? 0)) {
      plan.refused.push(...names);
      continue;
    }
    const state = { ...(store.getInitialState() as Record<string, unknown>), ...saved.state };
    for (const name of names) {
      try {
        take(name, all[name].of!(state), await all[name].read());
      } catch {
        plan.refused.push(name);
      }
    }
  }
  for (const [prefix, tag, name] of DOCUMENTS) {
    const theirs: Local = new Map();
    for (const [k, v] of Object.entries(documents)) {
      const doc = v as { id?: unknown; updatedAt?: number } | null;
      if (k.startsWith(prefix) && doc && typeof doc.id === "string") theirs.set(`${tag}:${doc.id}`, { value: doc, at: doc.updatedAt });
    }
    if (theirs.size) take(name, theirs, await all[name].read());
  }
  for (const [k, v] of Object.entries(documents)) {
    const id = k.slice(FILE_PREFIX.length);
    const f = k.startsWith(FILE_PREFIX) && FILE_ID.test(id) ? cleanStoredFile(v) : null;
    if (f) (plan.files ??= {})[id] = f;
  }
  return plan;
}

const count = (m: Partial<Record<StoreName, Change[]>>) => Object.values(m).reduce((n, xs) => n + (xs?.length ?? 0), 0);
export const planCounts = (p: ImportPlan) => ({ add: count(p.add), differ: count(p.differ), same: p.same });

/** Write the plan into this browser's stores: the new records, and the differing ones only when the reader chose
 * the file's. */
export async function applyImport(plan: ImportPlan, takeTheirs: boolean): Promise<{ added: number; replaced: number }> {
  const all = adapters(deviceId());
  const names = new Set([...Object.keys(plan.add), ...Object.keys(plan.differ)] as StoreName[]);
  for (const name of names) {
    const changes = [...(plan.add[name] ?? []), ...(takeTheirs ? (plan.differ[name] ?? []) : [])];
    if (changes.length) await all[name].apply(changes);
  }
  // a file's id names its content: one already here is the same file
  for (const [id, f] of Object.entries(plan.files ?? {})) if (!(await getFile(id))) await restoreFile(id, f);
  // maps and texts are written without a store to watch: sync and the lists hear of them here
  window.dispatchEvent(new Event(DOCS_EVENT));
  return { added: count(plan.add), replaced: takeTheirs ? count(plan.differ) : 0 };
}
