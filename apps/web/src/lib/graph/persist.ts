"use client";

import { del, get, set } from "idb-keyval";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { GraphDoc, GraphMeta } from "./types";

/** Local-first storage: graphs live in this browser's IndexedDB until accounts exist. */
const INDEX = "jadhr-graphs-index";
const KEY = (id: string) => `jadhr-graph:${id}`;

export async function listGraphs(): Promise<GraphMeta[]> {
  return ((await get<GraphMeta[]>(INDEX)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadGraph(id: string): Promise<GraphDoc | undefined> {
  return get<GraphDoc>(KEY(id));
}

export async function saveGraph(doc: GraphDoc): Promise<void> {
  const clean: GraphDoc = {
    ...doc,
    updatedAt: Date.now(),
    nodes: doc.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: doc.edges.map(({ id, source, target, data, label }) => ({ id, source, target, data, label })),
  };
  await set(KEY(doc.id), clean);
  const index = (await listGraphs()).filter((g) => g.id !== doc.id);
  index.push({ id: doc.id, title: doc.title, kind: doc.kind, createdAt: doc.createdAt, updatedAt: clean.updatedAt, nodeCount: doc.nodes.length });
  await set(INDEX, index);
}

export async function deleteGraph(id: string): Promise<void> {
  await del(KEY(id));
  await set(INDEX, (await listGraphs()).filter((g) => g.id !== id));
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
