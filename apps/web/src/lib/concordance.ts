/** Shared by the concordance page (server) and its screen (client): types, the default root, the query. */

export type Facet = { slug: string; ar: string; n: number };

export type Line = {
  location: string;
  verse_key: string;
  surah: number;
  ayah: number;
  position: number;
  surah_name_ar: string;
  surah_name_translit: string;
  place: string;
  surface: string;
  form: string;
  lemma_slug: string | null;
  lemma: string | null;
  pattern: string | null;
  left: string;
  keyword: string;
  right: string;
  translation: string | null;
};

export type Work = { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string };

export type ConcordancePage = {
  root: { key: string; spaced: string; translit: string; occurrences: number };
  facets: {
    lemmas: Facet[];
    patterns: Facet[];
    surahs: { surah: number; name_ar: string; name_translit: string; revelation_place: string; n: number }[];
    pos: { tag: string; ar: string; en: string; n: number }[];
    juz: { juz: number; n: number }[];
  };
  filters: { near_ar: string | null };
  total: number;
  translation: Work | null;
  data: Line[];
  next_offset: number | null;
};

export type Filters = {
  root: string;
  lemma: string;
  pattern: string;
  surah: string;
  /** the last sūra of a range (CON-Q03); empty for one sūra */
  surah_to: string;
  place: string;
  juz: string;
  juz_to: string;
  pos: string;
  form: string;
  near: string;
  sort: string;
  view: string;
};

const FILTER_KEYS = ["lemma", "pattern", "surah", "surah_to", "place", "juz", "juz_to", "pos", "form", "near"] as const;

export const DEFAULT_ROOT = "علم";

/** The query string for the lines, the distribution and the CSV: only the filters that are set. */
export function concordanceQuery(root: string, f: Partial<Filters>, extra: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ root });
  for (const k of FILTER_KEYS) if (f[k]) qs.set(k, f[k]!);
  for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
  return qs;
}
