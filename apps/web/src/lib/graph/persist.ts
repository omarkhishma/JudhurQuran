"use client";

import { del, get, set, update } from "idb-keyval";
import { storageFrozen } from "@/lib/store/safeStorage";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { upgrade } from "./migrate";
import { cleanDoc, cleanKind, cleanTitle } from "./sanitize";
import { dropVersions } from "./history";
import type { ForkRef, GraphDoc, GraphMeta, SharedRef } from "./types";

/** Local-first storage: graphs live in this browser's IndexedDB, and sync to the account when signed in (P6). */
const INDEX = "jadhr-graphs-index";
export const GRAPH_PREFIX = "jadhr-graph:";
const KEY = (id: string) => `${GRAPH_PREFIX}${id}`;
/** fired on every change made here, so sync can send it (documents are not in a store it can watch) */
export const DOCS_EVENT = "jadhr:docs";
const changed = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DOCS_EVENT));
};

export async function listGraphs(): Promise<GraphMeta[]> {
  return ((await get<GraphMeta[]>(INDEX)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A stored map, read as version 2 through lib/graph/sanitize — a version-1 copy (this browser's, or one synced
 * from another device) migrated on the way (lib/graph/migrate), and written as version 2 at its next save. */
export async function loadGraph(id: string): Promise<GraphDoc | undefined> {
  const doc = await get<Record<string, unknown> & GraphDoc>(KEY(id));
  if (!doc) return undefined;
  const kind = cleanKind(doc.kind);
  const { nodes, edges } = await upgrade(doc.version, kind, doc.nodes, doc.edges);
  return { ...doc, version: 2, kind, nodes, edges, shared: cleanShared(doc.shared), forkedFrom: cleanFork(doc.forkedFrom) };
}

/** The published map a map was copied from, kept only in its own shape. */
export function cleanFork(v: unknown): ForkRef | undefined {
  const f = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return typeof f.slug === "string" && f.slug.length <= 60 && Number.isInteger(f.version) && (f.version as number) >= 1
    ? { slug: f.slug, version: f.version as number, title: typeof f.title === "string" ? f.title.slice(0, 200) : "" }
    : undefined;
}

const SHARED_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A shared map's link, kept only in its own shape (a record synced from another device is read like any other). */
export function cleanShared(v: unknown): SharedRef | undefined {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return typeof s.id === "string" && SHARED_ID.test(s.id) && Number.isInteger(s.revision) && (s.revision as number) >= 1 ? { id: s.id, revision: s.revision as number } : undefined;
}

/**
 * A map's link to its shared copy written into the stored map, or taken off it (null) — only if the stored copy is
 * still the one the editor last wrote (`base`); the stored time moves on, so the change syncs to the owner's other
 * devices like any other.
 */
export async function markShared(id: string, shared: SharedRef | null, base: number): Promise<SaveOutcome> {
  const stored = await get<GraphDoc>(KEY(id));
  if (!stored) return { conflict: "gone" };
  if (stored.updatedAt > base) return { conflict: "newer" };
  const updatedAt = Math.max(Date.now(), base + 1);
  const next: GraphDoc = { ...stored, updatedAt };
  if (shared) next.shared = shared;
  else delete next.shared;
  await putGraph(next);
  changed();
  return { saved: updatedAt };
}

export async function saveGraph(doc: GraphDoc): Promise<void> {
  await putGraph({ ...cleanDoc(doc), updatedAt: Date.now() });
  changed();
}

export type SaveOutcome = { saved: number } | { conflict: "newer" | "gone" };

/**
 * The editor's save: written only if the stored copy is still the one the editor opened or last wrote (`base`).
 * Another tab, a hand-off into the map or sync from another device may have written a newer one, or deleted it;
 * the editor then asks the reader instead of writing over it (P8.0, research 13 F1).
 */
export async function saveGraphOver(doc: GraphDoc, base: number): Promise<SaveOutcome> {
  const stored = await get<GraphDoc>(KEY(doc.id));
  if (!stored) return { conflict: "gone" };
  if (stored.updatedAt > base) return { conflict: "newer" };
  const updatedAt = Math.max(Date.now(), base + 1);
  await putGraph({ ...cleanDoc(doc), updatedAt });
  changed();
  return { saved: updatedAt };
}

/** The stored copy's time, or null when the map is no longer in this browser. */
export async function storedAt(id: string): Promise<number | null> {
  return (await get<GraphDoc>(KEY(id)))?.updatedAt ?? null;
}

/** fired when sync has written maps from the account, so an open editor can look for a newer copy */
export const GRAPHS_SYNCED_EVENT = "jadhr:graphs-synced";

/** Store a graph as it is, its time included (a graph synced from another device keeps the time it was made). The
 * index changes in one step, so two writes at once never drop each other's entry (audit 11 F12). */
export async function putGraph(doc: GraphDoc): Promise<void> {
  if (storageFrozen()) return;
  await set(KEY(doc.id), doc);
  const meta: GraphMeta = { id: doc.id, title: doc.title, kind: doc.kind, createdAt: doc.createdAt, updatedAt: doc.updatedAt, nodeCount: doc.nodes.length, ...(cleanShared(doc.shared) ? { shared: doc.shared!.id } : {}) };
  await update<GraphMeta[]>(INDEX, (index = []) => [...index.filter((g) => g.id !== doc.id), meta]);
}

export async function deleteGraph(id: string, quiet = false): Promise<void> {
  await del(KEY(id));
  await dropVersions(id);
  await update<GraphMeta[]>(INDEX, (index = []) => index.filter((g) => g.id !== id));
  if (!quiet) changed();
}

/** A file name from a map's title (EDT-262): spaces to "-", lower case, and nothing a file system refuses. */
export const fileBase = (title: string) =>
  title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "")
    .toLowerCase()
    .slice(0, 120) || "map";

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** Share without a server: the whole document travels compressed in the URL fragment (never sent to us). */
export function encodeShare(doc: GraphDoc): string {
  const slim = {
    t: doc.title,
    k: doc.kind,
    v: 2,
    n: doc.nodes.map((n) => [n.id, Math.round(n.position.x), Math.round(n.position.y), n.data]),
    e: doc.edges.map((e) => [e.id, e.source, e.target, e.data]),
  };
  return compressToEncodedURIComponent(JSON.stringify(slim));
}

/** A share link's map, read as version 2 (a link made before carries version 1 and is migrated). */
export async function decodeShare(fragment: string): Promise<GraphDoc | null> {
  let s: { v?: unknown; t?: unknown; k?: unknown; n?: unknown; e?: unknown };
  try {
    const json = decompressFromEncodedURIComponent(fragment);
    if (!json) return null;
    s = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(s.n) || !Array.isArray(s.e)) return null;
  // a link is anyone's text: only what a map of ours can hold is kept, and a verse is drawn from its key (F3)
  const row = (x: unknown) => (Array.isArray(x) ? x : []);
  const kind = cleanKind(s.k);
  const v2 = s.v === 2;
  const { nodes, edges } = await upgrade(
    v2 ? 2 : 1,
    kind,
    s.n.map((x) => row(x)).map(([id, x, y, data]) => ({ id, position: { x, y }, data })),
    s.e.map((x) => row(x)).map(([id, source, target, d]) => ({ id, source, target, data: v2 ? d : { label: d || undefined } })),
  );
  const now = Date.now();
  return { version: 2, id: newId(), title: cleanTitle(s.t, ""), kind, createdAt: now, updatedAt: now, nodes, edges };
}

/** Create and store a new graph; returns its id. (Timestamps and ids are made here, outside render.) */
export async function createGraph(input: Pick<GraphDoc, "title" | "kind" | "nodes" | "edges" | "pendingLayout" | "forkedFrom">): Promise<string> {
  const id = newId();
  const now = Date.now();
  await saveGraph({ version: 2, id, createdAt: now, updatedAt: now, ...input });
  return id;
}
