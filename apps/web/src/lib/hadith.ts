import { toArabicDigits } from "@/lib/format";

/**
 * The hadith collections (P11.2): the Six Books and the Muwaṭṭaʾ as texts of the generic model, each record verbatim
 * under its printed number, its isnād, matn and the collector's comment told apart by rule, every narrator's name
 * linked to Ibn Ḥajar's entry or left with its candidates, HadeethEnc's explanation beside the number it cites.
 * The shapes the API serves (services/api: texts.py, narrators.py).
 */

export type Source = {
  id: string;
  title_ar: string;
  title_en: string;
  version?: string | null;
  url?: string;
  license: string;
  license_ar?: string;
  license_url: string | null;
  attribution_ar: string;
  attribution_en: string;
};

export type ChapterLine = {
  ordinal: number;
  title_ar: string;
  title_en: string;
  level: number;
  parent: number | null;
  children: number;
  total: number;
  first_ref: string | null;
  passage_count: number;
};

export type Collection = {
  slug: string;
  kind: string;
  title_ar: string;
  title_en: string;
  author_ar: string | null;
  author_en: string | null;
  meta_ar: string | null;
  meta_en: string | null;
  era_year: number | null;
  chapter_count: number;
  passage_count: number;
  token_count: number;
  info: { death_ah?: number; numbering_ar?: string; numbering_en?: string } | null;
  chapters: ChapterLine[];
  source: Source | null;
  titles_source: Source | null;
};

export type Grade = { grader: string; grader_ar: string; grader_en: string; work_ar: string | null; value: string; value_ar: string | null };
export type Split = { method: string; rule: string; status: string; isnad: [number, number]; matn: [number, number] | null; comment: [number, number] | null };
export type RecordMeta = {
  number: number | string | null;
  sequence: number;
  grades: Grade[];
  verdict?: string | null;
  empty?: boolean;
  witness?: { source: string; version: string; number: number } | null;
  split?: (Split & { names: [number, number][] }) | null;
};

export type ListedRecord = { ref: string; ordinal: number; chapter: number; ar_full: string; token_count: number; meta: RecordMeta };

export type ChapterPage = {
  text: { slug: string; kind: string; title_ar: string; title_en: string; author_ar: string | null; author_en: string | null };
  chapter: { ordinal: number; title_ar: string; title_en: string; level: number; passage_count: number; total: number };
  path: { ordinal: number; title_ar: string; title_en: string }[];
  children: ChapterLine[];
  prev: { ordinal: number; title_ar: string; title_en: string } | null;
  next: { ordinal: number; title_ar: string; title_en: string } | null;
  passages: ListedRecord[];
  offset: number;
  limit: number;
  total: number;
};

export type Reading = {
  root: string | null;
  dict_root: string | null;
  pattern: string | null;
  pattern_ar: string | null;
  pos: string | null;
  confidence: number;
  lemma: { slug: string; ar: string; pos_ar: string | null; pos_en: string | null; gloss_en: string | null } | null;
};
export type Form = { norm: string; kind: string; confidence: number; sure: boolean; clitics: string[]; readings: Reading[] };
export type Segment = { t: string; w?: number; p?: "isnad" | "matn" | "comment"; n?: number };
export type NarratorCard = { id: number; number: number | null; name: string; verdict: string | null; rank: number | null; tabaqa: number | null; death_ah: number | null };
export type ChainLink = { ordinal: number; text: string; rule: string; confidence: number; status: string; candidates: number; narrator: NarratorCard | null };
export type Explanation = {
  id: number;
  title: string;
  text: string;
  explanation: string;
  word_meanings: { word: string; meaning: string }[];
  benefits: string[];
  link: string | null;
  grade: string | null;
  attribution: string | null;
  version: string;
  cites: { book: string; number: number };
  agreement: number;
  status: "agrees" | "partly";
};

export type HadithRecord = {
  text: ChapterPage["text"];
  ref: string;
  /** the record's own address (hadith:bukhari:1), which a correction names (B58) */
  uri: string;
  path: { ordinal: number; title_ar: string; title_en: string }[];
  ar_full: string;
  token_count: number;
  meta: RecordMeta;
  segments: Segment[];
  words: number[];
  forms: { [id: string]: Form };
  parts: Split | null;
  narrators: ChainLink[];
  roots: string[];
  roots_low: string[];
  prev: string | null;
  next: string | null;
  source: Source | null;
  explanations: Explanation[];
  explanations_source: Source | null;
  narrators_source: Source | null;
};

export type Narrator = NarratorCard & {
  text: string;
  death_text: string | null;
  read: {
    rank: number | null;
    rank_def: string | null;
    tabaqa: number | null;
    tabaqa_rule: string | null;
    tabaqa_def: string | null;
    death_ah: number | null;
    death_rule: string | null;
    death_def: string | null;
  };
  sigla: { siglum: string; book_ar: string | null }[];
  records: { slug: string; title_ar: string; title_en: string; records: number }[];
  narrates_from: (NarratorCard & { records: number })[];
  narrated_by: (NarratorCard & { records: number })[];
  source: Source | null;
};

export type TextHit = {
  uri: string;
  ref: string;
  text: { slug: string; kind: string; title_ar: string; title_en: string };
  top: { ordinal: number; title_ar: string; title_en: string };
  chapter: { ordinal: number; title_ar: string; title_en: string };
  start: string;
  excerpt?: string | null;
  link?: { rule: string; confidence: number; status: string };
};

/** The seven collections, in the order the shelf gives them. */
export const COLLECTIONS = ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik"] as const;
export const isCollection = (s: string): boolean => (COLLECTIONS as readonly string[]).includes(s);

/** A record's address. A sub-number's point («1907.01», Muslim's records under one ʿAbd al-Bāqī number) is written
 * «_» there: the site's proxy passes a path with a point by as a file. */
export const hadithHref = (slug: string, ref: string) => `/hadith/${slug}/${encodeURIComponent(ref.replace(".", "_"))}`;
/** The record a hadith address names. */
export const refOfPath = (segment: string) => decodeURIComponent(segment).replace("_", ".");
export const kitabHref = (slug: string, ordinal: number, page = 1) => `/hadith/${slug}/kitab/${ordinal}${page > 1 ? `?page=${page}` : ""}`;
export const narratorHref = (id: number) => `/hadith/narrators/${id}`;

/** A record's parts, cut where the split says (the text holds no character outside the BMP, so the offsets the API
 * counts are the string's own: services/api tests hold that). */
export function parts(text: string, split: Split | null | undefined): { isnad: string; matn: string; comment: string } | null {
  if (!split) return null;
  const [, iEnd] = split.isnad;
  return {
    isnad: text.slice(0, iEnd),
    matn: split.matn ? text.slice(split.matn[0], split.matn[1]) : "",
    comment: split.comment ? text.slice(split.comment[0], split.comment[1]) : "",
  };
}

/** A record Muslim's edition leaves unnumbered is cited by its place («s12»): it has no ʿAbd al-Bāqī number. */
export const unnumbered = (ref: string) => ref.startsWith("s");
/** A record's number as a page shows it: the edition's, or — unnumbered — its place in the compilation, said so by the
 * caller with the `unnumbered` message. */
export const shownRef = (ref: string) => (unnumbered(ref) ? ref.slice(1) : ref);
/** A record's number written in the interface's digits (an identifier: no grouping), «١٩٠٧.٠١» on an Arabic page. */
export const refText = (ref: string, locale: string) => (locale === "ar" ? toArabicDigits(shownRef(ref)) : shownRef(ref));
