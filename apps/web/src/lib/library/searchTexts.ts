"use client";

import { normalize } from "@/lib/arabic/normalize";
import { words } from "./segment";
import { listTexts, loadText } from "./texts";

/** A passage of one of the reader's own texts that holds the query, with the words around it. */
export type TextHit = { id: string; title: string; passage: number; before: string; match: string; after: string };

const AROUND = 8;

/**
 * Search the reader's own texts (SRC-Q03 "my texts"): in this browser, over IndexedDB, so a private text is
 * never sent anywhere to be searched. Matching ignores vowels and hamza spelling as the server's search does;
 * each passage that holds the query counts once, and the first `cap` come back with their context.
 */
export async function searchMyTexts(q: string, cap = 20): Promise<{ hits: TextHit[]; total: number }> {
  const nq = normalize(q).trim();
  if (nq.length < 2) return { hits: [], total: 0 };
  const parts = nq.split(/\s+/);
  const hits: TextHit[] = [];
  let total = 0;
  for (const meta of await listTexts()) {
    const text = await loadText(meta.id);
    if (!text) continue;
    text.passages.forEach((p, i) => {
      if (!normalize(p).includes(nq)) return;
      total++;
      if (hits.length >= cap) return;
      const ws = words(p);
      const norms = ws.map((w) => normalize(w.word));
      const at = norms.findIndex((_, k) => parts.every((x, j) => (norms[k + j] ?? "").includes(x)));
      const k = Math.max(0, at);
      const end = k + parts.length;
      const join = (from: number, to: number) => ws.slice(Math.max(0, from), to).map((w) => w.surface).join(" ");
      hits.push({ id: text.id, title: text.title, passage: i + 1, before: join(k - AROUND, k), match: join(k, end), after: join(end, end + AROUND) });
    });
  }
  return { hits, total };
}
