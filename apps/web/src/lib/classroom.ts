"use client";

import { authFetch } from "@/lib/account/store";

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
  notes: { location: string | null; root: string | null; text: string }[];
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
  const notes = (Array.isArray(o.notes) ? o.notes : []).filter((n) => !!n && typeof n.text === "string").slice(0, 200).map((n) => ({ location: typeof n.location === "string" ? n.location : null, root: typeof n.root === "string" ? n.root : null, text: n.text.slice(0, 1000) }));
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
