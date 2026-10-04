"use client";

import { ApiError, apiError, authFetch, useAccount } from "@/lib/account/store";
import { upgrade } from "./migrate";
import { createGraph } from "./persist";
import type { GraphEdge, GraphKind, GraphNode } from "./types";
export {
  embedPath,
  embedSnippet,
  MAP_CITE_FORMATS,
  mapCitation,
  PUBLISHED_LICENCE,
  publishedMapPath,
  publishedPath,
  slugify,
  type ChangeCounts,
  type EmbedOptions,
  type MapCiteFormat,
  type MapCounts,
  type PublishedMap,
  type PublishedRow,
  type VersionChanges,
} from "./publishedShared";
import type { PublishedMap, PublishedRow } from "./publishedShared";


/**
 * Published maps (P8.5): a map its owner published under an address of its own, each publish a version that never
 * changes, read by anyone at `/g/{slug}`, framed by any site from `/embed/g/{slug}`, copied into a reader's own maps
 * and cited by its version's address. The API is the gate for every rule; what is here reads and asks.
 */

const headers = (): HeadersInit => {
  const session = useAccount.getState().session;
  return session ? { Authorization: `Bearer ${session}` } : {};
};

/** A published map, read as the signed-in reader when there is one (so its owner and the board are told). */
export async function readPublished(slug: string, version?: number): Promise<PublishedMap> {
  const r = await fetch(`/api/v1/published/${encodeURIComponent(slug)}${version ? `?v=${version}` : ""}`, { headers: headers() });
  if (!r.ok) throw await apiError(r, "published");
  return (await r.json()) as PublishedMap;
}

export async function checkSlug(slug: string): Promise<{ slug: string; valid: boolean; available: boolean; suggestion: string | null }> {
  const r = await fetch(`/api/v1/published/check?slug=${encodeURIComponent(slug)}`);
  if (!r.ok) throw await apiError(r, "published");
  return r.json();
}

type Content = { title: string; description: string; kind: GraphKind; nodes: GraphNode[]; edges: GraphEdge[] };
const docOf = (c: Content) => ({ version: 2, nodes: c.nodes, edges: c.edges });

export const publishMap = (localId: string, slug: string, c: Content, forkedFrom?: { slug: string; version: number } | null) =>
  authFetch<PublishedMap>("/published", {
    method: "POST",
    body: JSON.stringify({ local_id: localId, slug, title: c.title, description: c.description, kind: c.kind, doc: docOf(c), forked_from: forkedFrom ?? null }),
  });

export const publishVersion = (slug: string, c: Content) =>
  authFetch<PublishedMap>(`/published/${encodeURIComponent(slug)}/versions`, { method: "POST", body: JSON.stringify({ title: c.title, description: c.description, kind: c.kind, doc: docOf(c) }) });

export async function withdrawMap(slug: string): Promise<void> {
  const r = await fetch(`/api/v1/published/${encodeURIComponent(slug)}`, { method: "DELETE", headers: headers() });
  if (!r.ok && r.status !== 410) throw await apiError(r, "published");
}

export const myPublished = () => authFetch<{ data: PublishedRow[] }>("/me/published");

export async function gallery(offset = 0, limit = 24, by?: string): Promise<{ data: PublishedRow[]; total: number }> {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit), ...(by ? { by } : {}) });
  const r = await fetch(`/api/v1/published?${q}`);
  if (!r.ok) throw await apiError(r, "published");
  return r.json();
}

async function count(slug: string, what: "fork" | "cite"): Promise<number> {
  const r = await fetch(`/api/v1/published/${encodeURIComponent(slug)}/${what}`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) throw await apiError(r, "published");
  const got = (await r.json()) as { fork_count?: number; cite_count?: number };
  return (what === "fork" ? got.fork_count : got.cite_count) ?? 0;
}
export const countFork = (slug: string) => count(slug, "fork");
export const countCite = (slug: string) => count(slug, "cite");

export const reportMap = (slug: string, version: number, reason: string) =>
  authFetch<{ reported: true }>(`/published/${encodeURIComponent(slug)}/report`, { method: "POST", body: JSON.stringify({ version, reason }) });
export const mapReports = () => authFetch<{ data: { id: number; slug: string; version: number; reason: string; created_at: string; title: string }[] }>("/published/reports");
export const resolveMapReport = (id: number, outcome: "dismissed" | "withdrawn") =>
  authFetch<{ id: number; outcome: string }>(`/published/reports/${id}/resolve`, { method: "POST", body: JSON.stringify({ outcome }) });

export const isWithdrawn = (e: unknown) => e instanceof ApiError && e.status === 410;
export const isMissing = (e: unknown) => e instanceof ApiError && e.status === 404;

// ─── fork ────────────────────────────────────────────────────────────────────

/**
 * A copy of a published version as the reader's own map (EDT-290, EDT-345): read as any stored map is — cleaned, a
 * version-1 document migrated, both shapes of link accepted (EDT-291) — kept in this browser like any of their maps,
 * the map it came from named on it; the original's count told, once per reader.
 */
export async function forkPublished(m: PublishedMap, title: string): Promise<string> {
  const { nodes, edges } = await upgrade(m.doc.version ?? m.doc_version, m.kind, m.doc.nodes, m.doc.edges);
  const id = await createGraph({ title, kind: m.kind, nodes, edges, forkedFrom: { slug: m.slug, version: m.version, title: m.title } });
  if (!m.mine) void countFork(m.slug).catch(() => {});
  return id;
}
