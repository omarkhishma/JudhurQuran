/** Questions in natural language (P18, D35): the API's reading of a question and its computed answer. */

export const INTENTS = ["count", "where", "distribution", "meaning", "root", "compare", "together", "theme", "surah", "superlative"] as const;
export type Intent = (typeof INTENTS)[number];
export const TWO_TERMS: Intent[] = ["compare", "together"];
export const SUPERLATIVES = ["longest_surah", "shortest_surah", "longest_verse", "shortest_verse", "most_frequent_word", "least_frequent_word", "most_frequent_root", "least_frequent_root", "most_frequent_noun", "most_frequent_verb"] as const;

export type LemmaSubject = { kind: "lemma"; id: number; slug: string; ar: string; pos: string; occurrences: number; gloss_en: string | null; root_key: string | null; root_spaced: string | null; first: string };
export type RootSubject = { kind: "root"; key: string; spaced: string; translit: string; occurrences: number; lemma_count: number; verse_count: number };
export type Subject = LemmaSubject | RootSubject;
export type Term = { text: string; subject: Subject | null } | null;

export type Understood = {
  intent: Intent;
  a: Term;
  b: Term;
  surah: number | null;
  place: "meccan" | "medinan" | null;
  focus: string | null;
  how: "rule" | "example" | "search" | "given";
  example: string | null;
  notes: string[];
};

export type VerseRef = { key: string; surah: number; ayah: number; text_qpc: string; name_ar: string; name_translit: string };
export type SurahCount = { surah: number; name_ar: string; name_translit: string; place: "meccan" | "medinan"; revelation_order: number; count: number; per_1000: number };
type Place = { meccan: number; medinan: number };

export type CountAnswer = { kind: "count"; subject: Subject; count: number; verses: number; root?: { key: string; spaced: string; count: number; lemmas: number }; entity?: { wikidata_id: string; wikidata_label_ar: string | null; wikidata_label_en: string | null } | null };
export type WhereAnswer = { kind: "where" | "distribution"; subject: Subject; count: number; verses: number; surah_count: number; place: Place; surahs: SurahCount[]; first?: VerseRef[] };
export type MeaningAnswer = { kind: "meaning"; subject: Subject; gharib: { meaning_ar: string; phrase_ar: string; verse_key: string; title_ar: string; title_en: string; work_id: string }[]; word_page?: string; root_page?: string };
export type RootAnswer = { kind: "root"; subject: Subject; root: { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number; verse_count: number; gist_ar: string | null; gloss_en: string | null } | null; family?: { slug: string; ar: string; pos: string; occurrences: number }[] };
type Counts = { n: number; v: number; meccan: number; medinan: number; root?: { key: string; spaced: string; n: number; v: number } };
export type PairAnswer = { kind: "compare" | "together"; a: Subject; b: Subject; shared_verses: number; verses: VerseRef[]; counts?: { a: Counts; b: Counts }; same_root?: boolean; relations?: { relation: string; slug: string }[] };
export type SemanticHit = { verse: VerseRef; source: { work: { id: string; title_ar: string; title_en: string } | null; text: string | null }; by_meaning: number | null; by_words: number | null };
export type ThemeAnswer = { kind: "theme"; text: string; semantic: { status: string; lang?: "ar" | "en"; items: SemanticHit[]; total: number }; topics: { id: string; name: string; source_id: string; verse_count: number }[] };
export type SurahAnswer = { kind: "surah"; focus: "verses" | "words" | "roots" | null; surah: { number: number; name_ar: string; name_translit: string; place: "meccan" | "medinan"; revelation_order: number; verses: number; words: number; words_per_verse: number; lemmas: number; roots: number; hapax: number; unique_roots: { key: string; spaced: string }[]; top_roots: { key: string; spaced: string; count: number }[] } };
export type SuperlativeAnswer = { kind: "superlative"; focus: string; items: Record<string, string | number | null>[]; measure: string };
export type Unresolved = { kind: "unresolved"; missing: "a" | "b" | "surah" | "focus" };
export type Answer = CountAnswer | WhereAnswer | MeaningAnswer | RootAnswer | PairAnswer | ThemeAnswer | SurahAnswer | SuperlativeAnswer | Unresolved;

export type AskPayload = { question: string | null; understood: Understood; answer: Answer; fallback: ThemeAnswer | null };

/** The reading a reader set, as the API takes it back. */
export type Reading = { intent: Intent; a?: string; b?: string; surah?: number; place?: "meccan" | "medinan" };

export function askQuery(q: string, reading: Reading | null, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (reading) {
    p.set("intent", reading.intent);
    if (reading.a) p.set("a", reading.a);
    if (reading.b) p.set("b", reading.b);
    if (reading.surah) p.set("surah", String(reading.surah));
    if (reading.place) p.set("place", reading.place);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

/** A question rather than a word: a question mark, a question word, or several words. */
export function looksLikeQuestion(q: string): boolean {
  const s = q.trim();
  if (/[؟?]$/.test(s)) return true;
  if (/^(كم|أين|اين|ما|ماذا|من|متى|هل|لماذا|كيف|أي|اي|قارن|الفرق|آيات|ايات|how|what|where|which|why|who|when|is|are|does|do|compare|verses)(?:\s|$)/i.test(s)) return s.split(/\s+/).length >= 2;
  return s.split(/\s+/).length >= 4;
}
