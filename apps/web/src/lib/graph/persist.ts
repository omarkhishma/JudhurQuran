"use client";

import { del, get, set, update } from "idb-keyval";
import { storageFrozen } from "@/lib/store/safeStorage";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
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

export async function loadGraph(id: string): Promise<GraphDoc | undefined> {
  return get<GraphDoc>(KEY(id));
}

export async function saveGraph(doc: GraphDoc): Promise<void> {
  await putGraph({
    ...doc,
    updatedAt: Date.now(),
    nodes: doc.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: doc.edges.map(({ id, source, target, data, label }) => ({ id, source, target, data, label })),
  });
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
    const s = JSON.parse(json) as { t: string; k: GraphDoc["kind"]; n: [string, number, number, GraphDoc["nodes"][number]["data"]][]; e: [string, string, string, string][] };
    const now = Date.now();
    return {
      version: 1,
      id: newId(),
      title: s.t,
      kind: s.k,
      createdAt: now,
      updatedAt: now,
      nodes: s.n.map(([id, x, y, data]) => ({ id, type: "card", position: { x, y }, data })),
      edges: s.e.map(([id, source, target, label]) => ({ id, source, target, data: label ? { label } : undefined, label: label || undefined })),
    };
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
