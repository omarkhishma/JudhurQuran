/** The shapes the statistics API answers in (P16; services/api/src/jadhr_api/stats.py). Every answer carries what it
 * counted (`method`), which the page says under its chart (law L4). */

export type Method = { unit: string; counted: string };
export type RootRef = { key: string; spaced: string; translit: string };
export type LemmaRef = { slug: string; ar: string; gloss_en: string | null };
export type SurahRef = { surah: number; name_ar: string; name_translit: string; verses: number; words: number };

export type Overview = {
  surahs: number;
  verses: number;
  words: number;
  words_with_root: number;
  lemmas: number;
  content_lemmas: number;
  roots: number;
  patterns: number;
  hapax_lemmas: number;
  hapax_roots: number;
  mean_words_per_verse: number;
  place: Record<"meccan" | "medinan", { surahs: number; words: number }>;
  longest_verse: { key: string; words: number };
  longest_surah: SurahRef;
  shortest_surah: SurahRef;
  top_lemma: LemmaRef & { count: number };
  top_root: RootRef & { count: number };
  method: Method;
};

export type FreqItem = { count: number; share: number } & Partial<RootRef & LemmaRef & { tag: string; ar: string; en: string; translit: string }>;
export type Frequency = { kind: "root" | "lemma" | "pattern" | "pos"; total_words: number; distinct: number; items: FreqItem[]; method: Method };

export type SurahProfile = { surah: number; name_ar: string; name_translit: string; place: "meccan" | "medinan"; revelation_order: number; verses: number; words: number; words_per_verse: number; lemmas: number; roots: number; unique_roots: number; hapax: number };
export type SurahProfiles = { data: SurahProfile[]; method: Method };
export type SurahDetail = SurahProfile & {
  top_roots: (RootRef & { count: number; per_1000: number; quran: number })[];
  unique_roots: (RootRef & { count: number })[];
  top_lemmas: (LemmaRef & { count: number })[];
  hapax_lemmas: LemmaRef[];
  neighbours: (SurahRef & { similarity: number })[];
  method: Method;
};
export type MatrixData = { roots: (RootRef & { total: number })[]; surahs: (SurahRef & { place: string; revelation_order: number })[]; counts: number[][]; method: Method };
export type RankFrequency = { counts: number[]; cumulative: number[]; method: Method };
export type Distribution = {
  root?: RootRef;
  lemma?: LemmaRef;
  total: number;
  verses: number;
  surahs: { surah: number; name_ar: string; name_translit: string; place: "meccan" | "medinan"; revelation_order: number; count: number; per_1000: number }[];
  pages: number[];
  juz: number[];
  method: Method;
};
export type Collocations = { root: RootRef; verses: number; min_shared: number; items: (RootRef & { verses: number; verses_of_root: number; pmi: number; g2: number })[]; method: Method };
export type NetworkData = { nodes: (RootRef & { count: number; verses: number })[]; edges: { a: string; b: string; verses: number; pmi: number; g2: number }[]; method: Method };
export type Similarity = { order: number[]; surahs: (SurahRef & { place: string })[]; matrix: number[][]; method: Method };
