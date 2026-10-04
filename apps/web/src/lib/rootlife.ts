import { paragraphHref } from "@/lib/books";
import { type TextHit, hadithHref } from "@/lib/hadith";

/**
 * A root's life across the texts (P11.4b): the hadith and the books holding it, by text, with counts — the sure (the
 * word's form is the Quran's) apart from the possible (found by a pattern or a weak-root rule) — and its passages,
 * each with the root's word in its report. The shapes the API serves (services/api: rootlife.py).
 */

export type TextCount = { slug: string; kind: "hadith" | "book"; title_ar: string; title_en: string; sure: number; possible: number };
export type Kwic = { before: string; word: string; after: string };
export type RootHit = Pick<TextHit, "uri" | "ref" | "text" | "top" | "chapter"> & { sure: boolean; kwic: Kwic | null };
export type RootInTexts = {
  root: { key: string; display: string; quran_root: string | null };
  counts: TextCount[];
  totals: Partial<Record<"hadith" | "book", { sure: number; possible: number; texts: number }>>;
  data: RootHit[];
  total: number;
  offset: number;
  limit: number;
};

export type Which = "sure" | "possible" | "all";
export type Query = { kind: "hadith" | "book" | null; text: string | null; which: Which; page: number };

/** Where a passage of a text is read: a hadith's page, a book paragraph's page. */
export const hitHref = (h: Pick<RootHit, "text" | "ref">) => (h.text.kind === "hadith" ? hadithHref(h.text.slug, h.ref) : paragraphHref(h.text.slug, h.ref));

/** The page of every passage holding a root, under the filters. */
export function rootTextsHref(key: string, q: Partial<Query> = {}) {
  const p = new URLSearchParams();
  if (q.kind) p.set("kind", q.kind);
  if (q.text) p.set("text", q.text);
  if (q.which && q.which !== "sure") p.set("which", q.which);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return `/dictionary/${encodeURIComponent(key)}/texts${s ? `?${s}` : ""}`;
}
