/** Curated sets (API /collections, services/api collections.py; P5.2, inventory COL). */

import type { Ar } from "@/lib/reader/types";

export type Colour = "root" | "form" | "word" | "sentence" | "desc" | "amber";
export type SetCard = { id: string; ordinal: number; colour: Colour; title_ar: string; title_en: string; intro_ar: string; intro_en: string; item_count: number; root_count: number; occurrences: number; coverage: number; slugs: string[]; sample: string[] };
export type SetItem = {
  ordinal: number;
  slug: string;
  ar: Ar;
  pos: { tag: string; ar: string | null; en: string | null };
  gloss_en: string | null;
  occurrences: number;
  derivation: string | null;
  root: { key: string; spaced: string; translit: string } | null;
  pattern: { slug: string; ar: Ar } | null;
  first: { location: string; verse_key: string } | null;
};
export type SetDetail = Omit<SetCard, "slugs" | "sample"> & {
  why_ar: string;
  why_en: string;
  quote: { text_ar: string; heading_ar: string | null; attribution_ar: string | null; attribution_en: string | null } | null;
  source: { work_ar: string; work_en: string } | null;
  items: SetItem[];
  roots: { key: string; spaced: string; translit: string }[];
};
export type Coverage = { lemmas: number; roots: number; occurrences: number; total_words: number; coverage: number };

/** A type colour as a CSS value (02 §2.1): the set's colour says what kind of object it gathers. */
export const colourVar = (c: Colour) => (c === "amber" ? "var(--amber)" : `var(--c-${c})`);

/** The reader's coverage of the Quran (COL-Q04): their words in a POST body, never in a URL or a cache. */
export async function fetchCoverage(slugs: string[]): Promise<Coverage> {
  const r = await fetch("/api/v1/lemmas/coverage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs }) });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as Coverage;
}
