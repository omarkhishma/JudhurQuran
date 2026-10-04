"use client";

import { authFetch } from "@/lib/account/store";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";

/**
 * The classroom's API (P9, research 16): classes and lessons, joining with consent, a lesson as a file. The server
 * holds the privacy rules — consent's version, the floor, a member's own choice, classes for minors — and the screen
 * says them.
 */

export type Range = { surah: number; from: number; to: number };
export type LessonOut = {
  id: string;
  class_id: string;
  title: string;
  ranges: Range[];
  verses: number;
  roots: { key: string; spaced: string }[];
  assigned_at: string;
  due_at: string | null;
  open_until: string;
  open: boolean;
  /** the lesson's map (P9.3): a map its instructor shares, the class's only; their own id for it to them alone */
  map: LessonMap | null;
  /** proposals waiting for the instructor */
  pending: number;
  mine?: { opened_on: string | null; finished_on: string | null; minutes: number; nudged: boolean };
  class?: { id: string; name: string; minors: boolean; role: "instructor" | "member" };
};
export type ClassOut = {
  id: string;
  name: string;
  minors: boolean;
  role: "instructor" | "member";
  instructor: { name: string | null };
  members: number;
  created_at: string;
  archived_at: string | null;
  join_code?: string;
  me?: { detail_opt_in: boolean; joined_at: string | null };
  roster?: { id: string; name: string | null; joined_at: string; detail_opt_in: boolean }[];
  lessons?: LessonOut[];
};
export type Preview = { class: { id: string; name: string; minors: boolean }; instructor: { name: string | null }; consent_version: string; floor: number; already: "instructor" | "member" | null };
export type LessonPack = {
  format: "jadhr-lesson-pack";
  version: 1;
  title: string;
  class: string;
  instructor: string | null;
  ranges: Range[];
  verses: string[];
  roots: { key: string; spaced: string }[];
  notes: { location: string | null; root: string | null; text: string; word?: string | null }[];
  due_at: string | null;
  exported_at: string;
};

const base = "/classroom";
const json = (body: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(body) });

export const getClasses = () => authFetch<{ can_teach: boolean; teaching: ClassOut[]; learning: ClassOut[] }>(`${base}/classes`);
export const createClass = (name: string, minors: boolean) => authFetch<ClassOut>(`${base}/classes`, json({ name, minors }));
export const getClass = (id: string) => authFetch<ClassOut>(`${base}/classes/${encodeURIComponent(id)}`);
export const updateClass = (id: string, p: { name?: string; minors?: boolean; archived?: boolean }) => authFetch<ClassOut>(`${base}/classes/${encodeURIComponent(id)}`, json(p, "PATCH"));
export const newCode = (id: string) => authFetch<ClassOut>(`${base}/classes/${encodeURIComponent(id)}/code`, { method: "POST" });
export const previewJoin = (code: string) => authFetch<Preview>(`${base}/join/${encodeURIComponent(code)}`);
export const joinClass = (code: string, consent: string, detail: boolean) => authFetch<ClassOut>(`${base}/join/${encodeURIComponent(code)}`, json({ consent, detail_opt_in: detail }));
export const setDetail = (id: string, on: boolean) => authFetch<ClassOut>(`${base}/classes/${encodeURIComponent(id)}/membership`, json({ detail_opt_in: on }, "PATCH"));
export const addLesson = (id: string, p: { title: string; ranges: Range[]; roots: string[]; due: string | null }) => authFetch<LessonOut>(`${base}/classes/${encodeURIComponent(id)}/lessons`, json(p));
export const getLesson = (id: string) => authFetch<LessonOut>(`${base}/lessons/${encodeURIComponent(id)}`);
export const getPack = (id: string) => authFetch<LessonPack>(`${base}/lessons/${encodeURIComponent(id)}/pack`);

/** A deletion answers 204 with no body: read as done. */
async function gone(path: string): Promise<void> {
  await authFetch<unknown>(path, { method: "DELETE" }).catch((e: unknown) => {
    if (!(e instanceof SyntaxError)) throw e;
  });
}
export const deleteClass = (id: string) => gone(`${base}/classes/${encodeURIComponent(id)}`);
export const leaveClass = (id: string) => gone(`${base}/classes/${encodeURIComponent(id)}/membership`);
export const removeMember = (id: string, user: string) => gone(`${base}/classes/${encodeURIComponent(id)}/members/${encodeURIComponent(user)}`);
export const deleteLesson = (id: string) => gone(`${base}/lessons/${encodeURIComponent(id)}`);

/** A lesson pack read from a file: only its own shape, its verses as keys of the mushaf. */
export function readPack(raw: unknown): LessonPack | null {
  const o = raw as Partial<LessonPack> | null;
  if (!o || o.format !== "jadhr-lesson-pack" || o.version !== 1 || typeof o.title !== "string" || !Array.isArray(o.verses) || !Array.isArray(o.ranges)) return null;
  const verses = o.verses.filter((k): k is string => typeof k === "string" && /^\d{1,3}:\d{1,3}$/.test(k)).slice(0, 300);
  const roots = (Array.isArray(o.roots) ? o.roots : []).filter((r): r is { key: string; spaced: string } => !!r && typeof r.key === "string" && typeof r.spaced === "string").slice(0, 30);
  const notes = (Array.isArray(o.notes) ? o.notes : [])
    .filter((n) => !!n && typeof n.text === "string")
    .slice(0, 200)
    .map((n) => ({
      location: typeof n.location === "string" && /^\d{1,3}:\d{1,3}:\d{1,3}$/.test(n.location) ? n.location : null,
      root: typeof n.root === "string" ? n.root.slice(0, 8) : null,
      text: n.text.slice(0, 1000),
      word: typeof n.word === "string" ? n.word.slice(0, 60) : null,
    }));
  return {
    format: "jadhr-lesson-pack",
    version: 1,
    title: o.title.slice(0, 160),
    class: typeof o.class === "string" ? o.class.slice(0, 120) : "",
    instructor: typeof o.instructor === "string" ? o.instructor.slice(0, 80) : null,
    ranges: o.ranges.filter((r): r is Range => !!r && Number.isInteger(r.surah) && Number.isInteger(r.from) && Number.isInteger(r.to)).slice(0, 10),
    verses,
    roots,
    notes,
    due_at: typeof o.due_at === "string" ? o.due_at : null,
    exported_at: typeof o.exported_at === "string" ? o.exported_at : "",
  };
}

/** A lesson's ranges as a reader reads them: «الفاتحة ١–٧ · البقرة ١–٥». */
export function rangesLine(ranges: Range[], names: Map<number, string> | undefined, fmt: (n: number) => string): string {
  return ranges.map((r) => `${names?.get(r.surah) ?? fmt(r.surah)} ${r.from === r.to ? fmt(r.from) : `${fmt(r.from)}–${fmt(r.to)}`}`).join(" · ");
}

// ─── the instructor's views and the member's own (P9.2b) ─────────────────────

export type Layer = "lookup" | "note" | "confirm" | "struggle";
export type Cell = { learners: number; total: number } | { few: true };
export type Heat = {
  members: number;
  floor: number;
  few: number;
  floor_met: boolean;
  minors: boolean;
  opened: number;
  finished: number;
  median_minutes: number | null;
  not_started: { count: number; named: (string | null)[] };
  quick: { count: number; named: (string | null)[] };
  words: Record<string, Partial<Record<Layer, Cell>>>;
  roots: ({ key: string; spaced: string } & Cell)[];
  nudges: { sent: number; seen: number };
};
export type Matrix = {
  floor_met: boolean;
  floor: number;
  members: number;
  columns: { key: string; spaced: string }[];
  rows: { name: string | null; cells: Record<string, number> }[];
  others: { count: number; cells: Record<string, number> } | null;
  others_few?: boolean;
};
export type LessonNote = { id: string; location: string | null; root: string | null; text: string };

const L = (id: string) => `${base}/lessons/${encodeURIComponent(id)}`;
export const getHeat = (id: string) => authFetch<Heat>(`${L(id)}/heat`);
export const getMatrix = (id: string, layer: Layer) => authFetch<Matrix>(`${L(id)}/matrix?layer=${layer}`);
export const getMine = (id: string) => authFetch<{ counts: { location: string; kind: Layer; n: number }[] }>(`${L(id)}/mine`);
export const getNotes = (id: string) => authFetch<{ data: LessonNote[] }>(`${L(id)}/notes`);
export const addNote = (id: string, p: { location?: string; root?: string; text?: string }) => authFetch<{ data: LessonNote[] }>(`${L(id)}/notes`, json(p));
export const editNote = (id: string, p: { text?: string; move?: -1 | 1 }) => authFetch<{ data: LessonNote[] }>(`${base}/notes/${encodeURIComponent(id)}`, json(p, "PATCH"));
export const removeNote = (id: string) => authFetch<{ data: LessonNote[] }>(`${base}/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
export const sendNudge = (id: string) => authFetch<{ sent: number }>(`${L(id)}/nudges`, { method: "POST" });

/** The verse keys a lesson covers, in the mushaf's order. */
export const lessonKeys = (ranges: Range[]) => ranges.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, i) => `${r.surah}:${r.from + i}`));

// ─── the lesson's map (P9.3) ─────────────────────────────────────────────────

export type LessonMap = { id: string; revision: number; cards: number; title: string; local_id?: string };
export type CardKind = "root" | "pattern" | "lemma" | "verse" | "note" | "frame";
/** A card as a feed or a proposal names it: its kind and its name. */
export type CardRef = { id: string; kind: CardKind; label: string };
export type Proposal = {
  id: string;
  by: { name: string | null; me: boolean };
  cards: GraphNode[];
  links: GraphEdge[];
  note: string;
  status: "pending" | "confirmed" | "declined";
  base_revision: number;
  created_at: string;
  decided_at: string | null;
};
export type FeedItem = {
  id: string;
  kind: "edited" | "proposed" | "confirmed" | "declined" | "commented";
  who: { name: string | null; me: boolean };
  at: string;
  detail: {
    added?: CardRef[];
    removed?: CardRef[];
    linked?: number;
    unlinked?: number;
    proposal?: string;
    cards?: CardRef[];
    links?: number;
    for?: string | null;
    body?: string;
    reply?: boolean;
    card?: CardRef | null;
  };
};

export const setLessonMap = (id: string, graphId: string) => authFetch<LessonOut>(`${L(id)}/map`, json({ graph_id: graphId }, "PUT"));
export const getProposals = (id: string) => authFetch<{ data: Proposal[] }>(`${L(id)}/proposals`);
export const sendProposal = (id: string, p: { base: number; cards: GraphNode[]; links: GraphEdge[]; note: string }) => authFetch<Proposal>(`${L(id)}/proposals`, json(p));
export const decideProposal = (pid: string, decision: "confirmed" | "declined") => authFetch<Proposal>(`${base}/proposals/${encodeURIComponent(pid)}/decide`, json({ decision }));
export const withdrawProposal = (pid: string) => gone(`${base}/proposals/${encodeURIComponent(pid)}`);
export const getActivity = (id: string, before?: string | null) => authFetch<{ data: FeedItem[]; next: string | null }>(`${L(id)}/activity${before ? `?before=${encodeURIComponent(before)}` : ""}`);

/** A card as a proposal or the feed names it, read from the card itself (as the server does). */
export function cardRef(n: GraphNode): CardRef {
  const d = n.data;
  const kinds: CardKind[] = ["root", "pattern", "lemma", "verse", "note", "frame"];
  return { id: n.id, kind: kinds.includes(d.kind as CardKind) ? (d.kind as CardKind) : "note", label: (d.ar || d.verse?.key || d.title || d.text || "").trim().slice(0, 80) };
}
