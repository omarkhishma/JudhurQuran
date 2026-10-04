"use client";

import { ApiError, apiError, authFetch, useAccount } from "@/lib/account/store";
import type { GraphEdge, GraphKind, GraphNode } from "./types";

/**
 * Maps shared for comments (P8.1-E): the server's copy of a map its owner chose to share, read by anyone with the
 * link, saved by its owner naming the revision each save is made from; its history; its comments. A private map
 * never comes through here (it syncs sealed, P6).
 */

export type SharedDoc = {
  id: string;
  title: string;
  kind: GraphKind;
  doc: { version: number; nodes: GraphNode[]; edges: GraphEdge[] };
  doc_version: number;
  revision: number;
  cards: number;
  updated_at: string;
  owner: { name: string | null; mine: boolean };
  /** the owner's own id for the map in their browser: given to the owner only */
  local_id?: string;
  /** a lesson's map (P9.3): read by its class only */
  class?: { lesson_id: string; lesson_title: string; class_id: string; class_name: string; role: "instructor" | "member" };
};

export type SharedRow = Omit<SharedDoc, "doc" | "doc_version"> & { open: number; unread: number; mentions: number };

export type Person = { id: string; name: string | null };

export type Comment = {
  id: string;
  parent_id: string | null;
  node_id: string | null;
  anchor: string;
  body: string;
  deleted: boolean;
  author: (Person & { owner: boolean }) | null;
  mine: boolean;
  mentions: Person[];
  mentions_me: boolean;
  resolved_at: string | null;
  created_at: string;
  can_resolve: boolean;
  can_delete: boolean;
};

export type CommentsPage = { data: Comment[]; people: Person[]; owner: boolean };

/** A shared map, read as the signed-in reader when there is one (so the owner is told it is theirs). */
export async function readShared(id: string): Promise<SharedDoc> {
  const session = useAccount.getState().session;
  const r = await fetch(`/api/v1/graphs/${encodeURIComponent(id)}`, session ? { headers: { Authorization: `Bearer ${session}` } } : {});
  if (!r.ok) throw await apiError(r, "graph");
  return (await r.json()) as SharedDoc;
}

type Body = { title: string; kind: GraphKind; nodes: GraphNode[]; edges: GraphEdge[] };
const docOf = (b: Body) => ({ version: 2, nodes: b.nodes, edges: b.edges });

export const shareMap = (localId: string, b: Body) =>
  authFetch<SharedDoc>("/graphs", { method: "POST", body: JSON.stringify({ local_id: localId, title: b.title, kind: b.kind, doc: docOf(b) }) });

/** The owner's save; an ApiError 409 ("newer") when the map was saved from elsewhere since `base`. */
export const saveShared = (id: string, b: Body, base: number) =>
  authFetch<{ id: string; revision: number; updated_at: string }>(`/graphs/${id}`, { method: "PUT", body: JSON.stringify({ title: b.title, kind: b.kind, doc: docOf(b), base }) });

export async function stopSharing(id: string): Promise<void> {
  const session = useAccount.getState().session;
  const r = await fetch(`/api/v1/graphs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session ?? ""}` } });
  // already gone is what was asked
  if (!r.ok && r.status !== 404) throw await apiError(r, "graph");
}

export const listShared = () => authFetch<{ data: SharedRow[] }>("/graphs");
export const sharedRevisions = (id: string) => authFetch<{ data: { revision: number; title: string; cards: number; saved_at: string }[] }>(`/graphs/${id}/revisions`);
export const sharedRevision = (id: string, rev: number) =>
  authFetch<{ revision: number; title: string; doc: SharedDoc["doc"]; doc_version: number; cards: number; saved_at: string }>(`/graphs/${id}/revisions/${rev}`);

export const getComments = (id: string) => authFetch<CommentsPage>(`/graphs/${id}/comments`);
/** The reader has the comments in front of them: what came before is no longer new to them. Fetching the comments is
 * not reading them (a window keeps them for its card markers). */
export const markCommentsRead = (id: string) => authFetch<{ read: true }>(`/graphs/${id}/read`, { method: "POST" });
export const postComment = (id: string, c: { body: string; node_id?: string | null; anchor?: string; parent_id?: string | null; mentions?: string[] }) =>
  authFetch<Comment>(`/graphs/${id}/comments`, { method: "POST", body: JSON.stringify(c) });
export const resolveComment = (id: string, resolved: boolean) => authFetch<Comment>(`/comments/${id}`, { method: "PATCH", body: JSON.stringify({ resolved }) });
export async function deleteComment(id: string): Promise<void> {
  const session = useAccount.getState().session;
  const r = await fetch(`/api/v1/comments/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session ?? ""}` } });
  if (!r.ok) throw await apiError(r, "comment");
}

export const isNewer = (e: unknown) => e instanceof ApiError && e.status === 409;
export const isGone = (e: unknown) => e instanceof ApiError && e.status === 404;

/** The link a shared map is read at. */
export const sharedPath = (id: string) => `/graph/shared/${id}`;
