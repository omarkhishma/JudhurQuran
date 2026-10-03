"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * A map's verse text, always read from the dataset by key (P8.0, research 13 F3; law L1): a card keeps the verse's
 * key and the word's place, never its words, so neither a share link nor an imported file can show anything as a
 * verse that is not one. The keys asked for in the same moment go in one request (`GET /verses?keys=`).
 */
export type VerseText = {
  key: string;
  surah: number;
  ayah: number;
  surah_name_ar: string;
  surah_name_translit: string;
  tokens: { text: string }[];
  words: { location: string; position: number; token_from: number; token_to: number; text_uthmani: string }[];
};

const MAX = 60;
let waiting = new Map<string, { resolve: (v: VerseText | null) => void; reject: (e: unknown) => void }[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const batch = waiting;
  waiting = new Map();
  timer = null;
  const keys = [...batch.keys()];
  for (let i = 0; i < keys.length; i += MAX) {
    const chunk = keys.slice(i, i + MAX);
    try {
      const r = await fetch(`/api/v1/verses?keys=${encodeURIComponent(chunk.join(","))}`);
      if (!r.ok) throw new Error(String(r.status));
      const found = new Map(((await r.json()) as { data: VerseText[] }).data.map((v) => [v.key, v]));
      for (const k of chunk) for (const w of batch.get(k) ?? []) w.resolve(found.get(k) ?? null);
    } catch (e) {
      for (const k of chunk) for (const w of batch.get(k) ?? []) w.reject(e);
    }
  }
}

export function loadVerseText(key: string): Promise<VerseText | null> {
  return new Promise((resolve, reject) => {
    waiting.set(key, [...(waiting.get(key) ?? []), { resolve, reject }]);
    timer ??= setTimeout(() => void flush(), 15);
  });
}

export function useVerseText(key: string | undefined) {
  return useQuery({ queryKey: ["verse-text", key], queryFn: () => loadVerseText(key!), enabled: !!key, staleTime: Infinity });
}

export type Excerpt = { left: string; word: string; right: string; cutLeft: boolean; cutRight: boolean };

/** The words around a place in the verse, or the whole verse: what a card shows, and whether it was cut. */
export function excerptOf(v: VerseText, location?: string, around = 5): Excerpt {
  const toks = v.tokens.map((t) => t.text);
  const w = location ? v.words.find((x) => x.location === location) : undefined;
  if (!w) return { left: toks.join(" "), word: "", right: "", cutLeft: false, cutRight: false };
  const a = w.token_from - 1;
  const b = w.token_to;
  const from = Math.max(0, a - around);
  const to = Math.min(toks.length, b + around);
  return { left: toks.slice(from, a).join(" "), word: toks.slice(a, b).join(" "), right: toks.slice(b, to).join(" "), cutLeft: from > 0, cutRight: to < toks.length };
}

/** A word's own text at its place, as the mushaf writes it. */
export const wordAt = (v: VerseText, location: string) => {
  const w = v.words.find((x) => x.location === location);
  return w ? v.tokens.slice(w.token_from - 1, w.token_to).map((t) => t.text).join(" ") : null;
};

export type Segment = { text: string; marked: boolean };

/** The whole verse, the words at these places marked: a verse card that holds several places. */
export function markedVerse(v: VerseText, places: string[]): Segment[] {
  const marked = new Set<number>();
  for (const p of places) {
    const w = v.words.find((x) => x.location === p);
    if (w) for (let i = w.token_from - 1; i < w.token_to; i++) marked.add(i);
  }
  const out: Segment[] = [];
  v.tokens.forEach((tok, i) => {
    const m = marked.has(i);
    const last = out[out.length - 1];
    if (last && last.marked === m) last.text += ` ${tok.text}`;
    else out.push({ text: tok.text, marked: m });
  });
  return out;
}

/** The verse a place is in: `2:255:3` → `2:255`. */
export const keyOf = (place: string) => place.split(":").slice(0, 2).join(":");
