"use client";

import { create } from "zustand";
import { authFetch, useAccount } from "@/lib/account/store";
import { usePersonal } from "@/lib/reader/store";
import { useSaved } from "@/lib/store/saved";
import type { Range } from "@/lib/classroom";

/**
 * What a member's reader sends for an open lesson (P9.2a; research 16 §2). Only for the classes the reader joined,
 * only for the verses of a lesson open now, and only counts: a word looked up, a note written on a verse (its
 * number, never its words — a verse's own place is its word 0), a word marked known (confirm) or still being learnt
 * (struggle) in study mode, and the minutes the reader was active on a lesson's verses. Everything else stays in the
 * browser as before. Sent in batches, and when the page is left; a refusal (the lesson closed, the reader left the
 * class) drops what waited.
 */

export type ActiveLesson = { id: string; class: string; title: string; ranges: Range[]; roots: string[]; due_at: string | null; open_until: string };
type Kind = "lookup" | "note" | "confirm" | "struggle";

export const useActiveLessons = create<{ lessons: ActiveLesson[]; set: (l: ActiveLesson[]) => void }>()((set) => ({ lessons: [], set: (lessons) => set({ lessons }) }));

const inRange = (s: number, a: number, r: Range) => r.surah === s && r.from <= a && a <= r.to;
/** The open lesson whose verses hold this one, if any. */
export function lessonForVerse(s: number, a: number, lessons = useActiveLessons.getState().lessons): ActiveLesson | null {
  return lessons.find((l) => l.ranges.some((r) => inRange(s, a, r))) ?? null;
}
function lessonForPlace(location: string): ActiveLesson | null {
  const m = /^(\d{1,3}):(\d{1,3}):(\d{1,3})$/.exec(location);
  return m ? lessonForVerse(Number(m[1]), Number(m[2])) : null;
}

/** The reader's own day, as the server accepts it (within a day of its own). */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const counts = new Map<string, { lesson: string; location: string; kind: Kind; n: number }>();
const minutes = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

// what happened before the open lessons were known waits for them, then is counted or dropped
let known = false;
const early: { kind: Kind; location: string }[] = [];

function count(kind: Kind, location: string) {
  if (!known) {
    if (early.length < 200) early.push({ kind, location });
    return;
  }
  const l = lessonForPlace(location);
  if (!l) return;
  const key = `${l.id}|${location}|${kind}`;
  const cur = counts.get(key);
  counts.set(key, { lesson: l.id, location, kind, n: Math.min(100, (cur?.n ?? 0) + 1) });
  if (!timer) timer = setTimeout(() => void flush(false), 15_000);
}

async function send(path: string, body: unknown, keepalive: boolean) {
  await authFetch<unknown>(path, { method: "POST", body: JSON.stringify(body), keepalive });
}

/** What waited, sent: counts per lesson, then each lesson's minutes. A refusal drops it; a failed network keeps it
 * for the next try. */
export async function flush(keepalive: boolean) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!useAccount.getState().session) {
    counts.clear();
    minutes.clear();
    return;
  }
  const day = today();
  const byLesson = new Map<string, { location: string; kind: Kind; n: number }[]>();
  for (const c of counts.values()) byLesson.set(c.lesson, [...(byLesson.get(c.lesson) ?? []), { location: c.location, kind: c.kind, n: c.n }]);
  counts.clear();
  for (const [lesson, items] of byLesson) {
    try {
      await send(`/classroom/lessons/${lesson}/counts`, { day, items: items.slice(0, 500) }, keepalive);
    } catch (e) {
      // the network, not a refusal: kept for the next try
      if (e instanceof TypeError) for (const it of items) counts.set(`${lesson}|${it.location}|${it.kind}`, { lesson, ...it });
    }
  }
  const mins = [...minutes.entries()];
  minutes.clear();
  for (const [lesson, m] of mins) {
    try {
      await send(`/classroom/lessons/${lesson}/progress`, { day, minutes: Math.min(60, m) }, keepalive);
    } catch (e) {
      if (e instanceof TypeError) minutes.set(lesson, m);
    }
  }
}

/** Opened: said once when the reader first reads a lesson's verses (an empty progress message records the day). */
const opened = new Set<string>();

export async function refreshActive() {
  if (!useAccount.getState().session) useActiveLessons.getState().set([]);
  else {
    try {
      const got = await authFetch<{ data: ActiveLesson[] }>("/classroom/me/active");
      useActiveLessons.getState().set(got.data);
    } catch {
      // not signed in any more, or offline: nothing is counted until it is known again
      useActiveLessons.getState().set([]);
    }
  }
  known = true;
  for (const e of early.splice(0)) count(e.kind, e.location);
}

/** Marks a lesson finished, or not, by the member's word. */
export async function setFinished(lesson: string, finished: boolean) {
  await send(`/classroom/lessons/${lesson}/progress`, { day: today(), finished, minutes: 0 }, false);
}

const READER = /^\/(en\/)?(quran|word|read)(\/|$)/;

/** Starts listening to the reader's own stores; returns how to stop. One per page. */
export function startClassroomSignals(): () => void {
  void refreshActive();
  const stops: (() => void)[] = [];
  // a lookup: a new word at a new place in the reading context
  stops.push(
    usePersonal.subscribe((s, prev) => {
      const c = s.context;
      const p = prev.context;
      if (c?.word && c.at && (c.word !== p?.word || c.at !== p?.at)) count("lookup", c.at);
      if (s.wordStates !== prev.wordStates && c?.word && c.at) {
        const now = s.wordStates[c.word];
        if (now !== prev.wordStates[c.word]) {
          if (now === "known") count("confirm", c.at);
          else if (now === "learning") count("struggle", c.at);
        }
      }
    }),
  );
  // a note written on a verse: its number, never its words
  stops.push(
    useSaved.subscribe((s, prev) => {
      if (s.notes === prev.notes) return;
      for (const [key, n] of Object.entries(s.notes)) {
        const was = prev.notes[key];
        const m = /^quran:(\d{1,3}):(\d{1,3})$/.exec(key);
        if (m && n?.text?.trim() && !was?.text?.trim()) count("note", `${m[1]}:${m[2]}:0`);
      }
    }),
  );
  // active minutes on a lesson's verses: the verse in view, the page visible, the reader active in the last minute
  let lastActive = 0;
  const active = () => (lastActive = Date.now());
  for (const ev of ["pointerdown", "keydown", "scroll", "wheel", "touchstart"]) window.addEventListener(ev, active, { passive: true, capture: true });
  const tick = setInterval(() => {
    if (document.visibilityState !== "visible" || Date.now() - lastActive > 60_000 || !READER.test(location.pathname)) return;
    const pos = usePersonal.getState().progress.quran;
    const l = pos ? lessonForVerse(pos.chapter, pos.passage) : null;
    if (!l) return;
    if (!opened.has(l.id)) {
      opened.add(l.id);
      void send(`/classroom/lessons/${l.id}/progress`, { day: today(), minutes: 0 }, false).catch(() => opened.delete(l.id));
    }
    minutes.set(l.id, (minutes.get(l.id) ?? 0) + 1);
    if (!timer) timer = setTimeout(() => void flush(false), 15_000);
  }, 60_000);
  const hide = () => document.visibilityState === "hidden" && void flush(true);
  const leave = () => void flush(true);
  const focus = () => void refreshActive();
  // a lesson assigned while the page is open is known within ten minutes, or at once when the reader comes back
  const again = setInterval(() => void refreshActive(), 10 * 60_000);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", leave);
  window.addEventListener("focus", focus);
  const auth = useAccount.subscribe((s, prev) => s.session !== prev.session && void refreshActive());
  return () => {
    stops.forEach((s) => s());
    auth();
    clearInterval(tick);
    clearInterval(again);
    window.removeEventListener("pagehide", leave);
    for (const ev of ["pointerdown", "keydown", "scroll", "wheel", "touchstart"]) window.removeEventListener(ev, active, { capture: true });
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("focus", focus);
  };
}
