"use client";

import { del, get, set, update } from "idb-keyval";
import { storageFrozen } from "@/lib/store/safeStorage";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { cleanDoc, cleanGraph, cleanKind, cleanTitle } from "./sanitize";
import type { GraphDoc, GraphMeta } from "./types";

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

/** A stored map, read through the rules of lib/graph/sanitize (an older copy loses the verse words it kept). */
export async function loadGraph(id: string): Promise<GraphDoc | undefined> {
  const doc = await get<GraphDoc>(KEY(id));
  return doc ? cleanDoc(doc) : undefined;
}

export async function saveGraph(doc: GraphDoc): Promise<void> {
  await putGraph({ ...cleanDoc(doc), updatedAt: Date.now() });
  changed();
}

/** Store a graph as it is, its time included (a graph synced from another device keeps the time it was made). The
 * index changes in one step, so two writes at once never drop each other's entry (audit 11 F12). */
export async function putGraph(doc: GraphDoc): Promise<void> {
  if (storageFrozen()) return;
  await set(KEY(doc.id), doc);
  const meta: GraphMeta = { id: doc.id, title: doc.title, kind: doc.kind, createdAt: doc.createdAt, updatedAt: doc.updatedAt, nodeCount: doc.nodes.length };
  await update<GraphMeta[]>(INDEX, (index = []) => [...index.filter((g) => g.id !== doc.id), meta]);
}

export async function deleteGraph(id: string, quiet = false): Promise<void> {
  await del(KEY(id));
  await update<GraphMeta[]>(INDEX, (index = []) => index.filter((g) => g.id !== id));
  if (!quiet) changed();
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** Share without a server: the whole document travels compressed in the URL fragment (never sent to us). */
export function encodeShare(doc: GraphDoc): string {
  const slim = {
    t: doc.title,
    k: doc.kind,
    n: doc.nodes.map((n) => [n.id, Math.round(n.position.x), Math.round(n.position.y), n.data]),
    e: doc.edges.map((e) => [e.id, e.source, e.target, e.data?.label ?? ""]),
  };
  return compressToEncodedURIComponent(JSON.stringify(slim));
}

export function decodeShare(fragment: string): GraphDoc | null {
  try {
    const json = decompressFromEncodedURIComponent(fragment);
    if (!json) return null;
    const s = JSON.parse(json) as { t?: unknown; k?: unknown; n?: unknown; e?: unknown };
    if (!Array.isArray(s.n) || !Array.isArray(s.e)) return null;
    // a link is anyone's text: only what a map of ours can hold is kept, and a verse is drawn from its key (F3)
    const row = (x: unknown) => (Array.isArray(x) ? x : []);
    const { nodes, edges } = cleanGraph(
      s.n.map((x) => row(x)).map(([id, x, y, data]) => ({ id, position: { x, y }, data })),
      s.e.map((x) => row(x)).map(([id, source, target, label]) => ({ id, source, target, data: { label: label || undefined } })),
    );
    const now = Date.now();
    return { version: 1, id: newId(), title: cleanTitle(s.t, ""), kind: cleanKind(s.k), createdAt: now, updatedAt: now, nodes, edges };
  } catch {
    return null;
  }
}

/** Create and store a new graph; returns its id. (Timestamps and ids are made here, outside render.) */
export async function createGraph(input: Pick<GraphDoc, "title" | "kind" | "nodes" | "edges" | "pendingLayout">): Promise<string> {
  const id = newId();
  const now = Date.now();
  await saveGraph({ version: 1, id, createdAt: now, updatedAt: now, ...input });
  return id;
}
