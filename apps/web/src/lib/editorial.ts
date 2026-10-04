"use client";

import { authFetch } from "@/lib/account/store";

/**
 * The editorial workbench's API (P3.0, research 14): the board's worklists, a target with what is in force on it,
 * the open work, its decisions, history and candidates from the cited sources, and the work's life — save, submit,
 * withdraw, discard, decide, verdicts and decisions in batches. The server and the database hold the rules (the
 * board only; never the author's own approval); the screen only says them.
 */

import type { Kind, Layer, State } from "./editorialShape";

export { KINDS, LAYERS, STATES, type Kind, type Layer, type State } from "./editorialShape";

export type Source = { work: string; ref: string; quote?: string };
export type Status = "draft" | "review" | "changes" | "approved" | "retired";

export type Entry = {
  id: string;
  kind: Kind;
  target: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  sources: Source[];
  status: Status;
  revision: number;
  author: { id: string | null; name: string | null };
  updated_at: string;
  decided_at: string | null;
  mine?: boolean;
};

type Counts = { total: number; draft: number; review: number; changes: number; approved: number };
export type Worklists = { kinds: (Counts & { kind: Kind })[]; layers: (Counts & { layer: Layer })[]; awaiting_me: number; my_open: number; role: string };
/** A relation row's details (P8.4): its two ends as the book words them, the roots they were mapped to and how surely,
 * the sense it names, its verses. */
export type RelationRow = {
  type: "furuq_contrast" | "near_synonym_candidate" | "wujuh_sense" | "didd" | "field_member";
  source_id: string;
  headword_ar: string;
  target_ar: string | null;
  root: string | null;
  target_root: string | null;
  match_confidence: string | null;
  target_match_confidence: string | null;
  sense_label_ar: string | null;
  verses: string[];
  locator: string;
};
/** A topic layer's row (P8.3b): the verse in the mushaf's text, and the topic — or QSAC's tag — where its source
 * places it. */
export type TopicLayerRow = { verse_key: string; verse_text: string; topic_id: string; name: string; description: string | null; parent_ar: string | null; parent_en: string | null; grand_en: string | null };
export type TargetRow = { key: string; label: string; sub: string; occurrences?: number; state: Exclude<State, "all">; source_status?: string; relation?: RelationRow; topic?: TopicLayerRow };

export type EntryPage = {
  kind: Kind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: Record<string, any>;
  in_force: Entry | null;
  open: Entry | null;
  decisions: { revision: number; decision: "approve" | "changes"; note: string | null; by: string | null; at: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidates: Record<string, any>;
  history: { action: string; revision: number; by: string | null; at: string }[];
};

const enc = (s: string) => s.split("/").map(encodeURIComponent).join("/");

export const getWorklists = () => authFetch<Worklists>("/editorial/worklists");
export const getTargets = (kind: Kind, p: { state: State; q: string; layer?: Layer; offset: number; limit?: number }) => {
  const qs = new URLSearchParams({ state: p.state, offset: String(p.offset), limit: String(p.limit ?? 50) });
  if (p.q) qs.set("q", p.q);
  if (p.layer) qs.set("layer", p.layer);
  return authFetch<{ total: number; data: TargetRow[] }>(`/editorial/${kind}?${qs}`);
};
export const getEntry = (kind: Kind, target: string) => authFetch<EntryPage>(`/editorial/${kind}/${enc(target)}`);
export const saveEntry = (kind: Kind, target: string, value: unknown, sources: Source[]) =>
  authFetch<Entry>(`/editorial/${kind}/${enc(target)}`, { method: "PUT", body: JSON.stringify({ value, sources }) });
export const submitEntry = (id: string) => authFetch<Entry>(`/editorial/entries/${id}/submit`, { method: "POST" });
export const withdrawEntry = (id: string) => authFetch<Entry>(`/editorial/entries/${id}/withdraw`, { method: "POST" });
export async function discardEntry(id: string): Promise<void> {
  await authFetch<unknown>(`/editorial/entries/${id}`, { method: "DELETE" }).catch((e: unknown) => {
    // a 204 has no body to read: the deletion itself succeeded
    if (!(e instanceof SyntaxError)) throw e;
  });
}
export const decideEntry = (id: string, decision: "approve" | "changes", note: string) =>
  authFetch<Entry>(`/editorial/entries/${id}/decide`, { method: "POST", body: JSON.stringify({ decision, note: note || null }) });
export type Work = { id: string; title_ar: string; title_en: string };
export const getWorks = () => authFetch<{ data: Work[] }>("/editorial/works");
export const getAwaiting = () => authFetch<{ data: Entry[] }>("/editorial/awaiting");
/** A relation's end mapped to another root (P8.4), or a QSAC tag's verse placed under an Arabic topic (P8.3b). */
export type Ends = { root?: string; target_root?: string; topic?: string };
export type VerdictItem = { row: string; verdict: "reviewed" | "corrected" | "rejected"; note?: string; correction?: string; ends?: Ends };
export const saveVerdicts = (layer: Layer, items: VerdictItem[], submit: boolean) =>
  authFetch<{ data: Entry[] }>("/editorial/verdicts", { method: "POST", body: JSON.stringify({ layer, items, submit }) });
export const decideMany = (ids: string[], decision: "approve" | "changes", note: string) =>
  authFetch<{ data: Entry[] }>("/editorial/decide", { method: "POST", body: JSON.stringify({ ids, decision, note: note || null }) });
