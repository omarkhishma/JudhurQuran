import { normalize } from "@/lib/arabic/normalize";
import type { GraphNode } from "./types";
import type { VerseText } from "./verseText";

/**
 * Find a card on a map (P8.1-A, EDT-035, QAN-15): a card matches when the query, folded as the search spec folds
 * Arabic (marks and tatweel stripped, alef, yāʾ and tāʾ marbūṭa unified), is found in what the card shows or
 * stands for — its headline, its line under it, a word's written forms, a note's text, a root's letters with or
 * without spaces, a verse's reference in either digits and, once drawn, its words — and what the reader wrote in
 * its fields.
 */

const DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const latinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => DIGITS[d]);

export const foldQuery = (q: string) => normalize(latinDigits(q)).toLowerCase();
/** the mushaf's dagger alef read as the alef everyday spelling writes (ٱلْعَٰلَمِينَ ~ العالمين), as the search's
 * plain shadow reads it */
const plain = (s: string) => s.replace(/\u0670/g, "ا");

export function cardHaystack(n: GraphNode, verse?: VerseText): string {
  const d = n.data;
  const parts = [d.ar, d.sub, d.text, d.title, d.slug, d.rootKey, d.rootKey?.split("").join(" "), ...(d.forms ?? []).map((f) => f.form)];
  if (d.verse) parts.push(d.verse.key, ...(d.places ?? []));
  for (const f of d.fields ?? []) if (f.kind !== "audio" && f.kind !== "image" && f.kind !== "file") parts.push(...(Array.isArray(f.value) ? f.value : [String(f.value)]));
  if (verse) parts.push(verse.tokens.map((t) => t.text).join(" "), verse.surah_name_ar);
  const text = parts.filter(Boolean).join(" \u0001 ");
  return `${foldQuery(text)} \u0002 ${foldQuery(plain(text))}`;
}

/** The cards matching a query, in the map's order; none for an empty query. */
export function findCards(nodes: GraphNode[], query: string, verseOf: (key: string) => VerseText | undefined): string[] {
  const q = foldQuery(query);
  if (!q) return [];
  // frames are not cards: not found, not counted (EDT-147)
  return nodes.filter((n) => n.data.kind !== "frame").filter((n) => cardHaystack(n, n.data.verse ? verseOf(n.data.verse.key) : undefined).includes(q)).map((n) => n.id);
}
