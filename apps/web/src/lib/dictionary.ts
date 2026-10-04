import type { LexiconWork } from "@/lib/types";

/** The Arabic dictionary (P11.1): every root the lexica file an article under, the Quran's and all the others. */
export type DictRootRow = {
  key: string;
  display: string;
  letters: number;
  first: string;
  quran_root: string | null;
  lexica: string[];
  articles: number;
  attested_as_written: boolean;
  unsure: boolean;
  filed_under: string | null;
};
/** How an article reached its root (jadhr_pipeline.lexica.dictroots). */
export type DictRule = "quran" | "as-written" | "alif-hamza" | "alif-weak" | "two-letter-doubled" | "two-letter-weak" | "ambiguous" | "unresolved";
export type DictArticle = { id: number; uri: string; headword: string; rule: DictRule; candidates: string[] | null; page_ref: string | null; excerpt: string; length: number };
export type DictWork = LexiconWork & { kind: string; articles: DictArticle[] };
export type DictRoot = Omit<DictRootRow, "filed_under"> & {
  spaced: string;
  works: DictWork[];
  candidates: { key: string; display: string; articles: number }[];
  quran: { key: string; spaced: string; translit: string; occurrences: number; verse_count: number; surah_count: number; lemma_count: number; gist_ar: string | null } | null;
  filed_under: DictRootRow | null;
  prev: { key: string; display: string } | null;
  next: { key: string; display: string } | null;
};
export type DictLetter = { letter: string; roots: number; quranic: number };

/** A root's address on the dictionary: its key (the hamza written ء), never a guess at a spelling. */
export const dictHref = (key: string) => `/dictionary/${encodeURIComponent(key)}`;
/** An article's own address (P1.7a): its root's page, opened at it by its identifier. */
export const articleHref = (key: string, uri: string) => `${dictHref(key)}#${encodeURIComponent(uri)}`;
const FOLD: Record<string, string> = { "أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي", "ة": "ه" };
/** The dictionary page of a Quranic root (its key أخذ is the dictionary's ءخذ). */
export const dictHrefOfQuranRoot = (key: string) => dictHref([...key].map((c) => FOLD[c] ?? c).join(""));
/** An article shown under a Quranic root, on the dictionary's page of that root (P1.7a). */
export const articleHrefOfQuranRoot = (key: string, uri: string) => `${dictHrefOfQuranRoot(key)}#${encodeURIComponent(uri)}`;
