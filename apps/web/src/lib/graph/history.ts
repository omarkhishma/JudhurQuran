"use client";

import { del, get, update } from "idb-keyval";
import { storageFrozen } from "@/lib/store/safeStorage";
import type { GraphEdge, GraphNode } from "./types";

/**
 * A private map's history (P8.1-E, EDT-259): the map as it was, kept in this browser at most every ten minutes of
 * editing, the last thirty. A shared map's history is the server's (lib/graph/shared). Kept beside the map under the
 * site's own prefix, so the browser's export and "delete local data" take it with everything else; it does not sync.
 */
export type Version = { at: number; title: string; cards: number; nodes: GraphNode[]; edges: GraphEdge[] };

const KEY = (id: string) => `jadhr-graph-history:${id}`;
export const VERSION_EVERY = 10 * 60_000;
const KEEP = 30;

/** The map as just saved, kept as a version when the last one is ten minutes old or there is none. */
export async function keepVersion(id: string, title: string, nodes: GraphNode[], edges: GraphEdge[], at = Date.now()): Promise<void> {
  if (storageFrozen()) return;
  await update<Version[]>(KEY(id), (list = []) => {
    if (list[0] && at - list[0].at < VERSION_EVERY) return list;
    const cards = nodes.filter((n) => n.data.kind !== "frame").length;
    return [{ at, title, cards, nodes, edges }, ...list].slice(0, KEEP);
  });
}

export async function listVersions(id: string): Promise<Version[]> {
  return (await get<Version[]>(KEY(id))) ?? [];
}

export async function dropVersions(id: string): Promise<void> {
  await del(KEY(id));
}
