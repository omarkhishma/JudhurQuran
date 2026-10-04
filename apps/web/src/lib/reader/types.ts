/** Shapes of the lexeme API (/api/v1/words/:slug and friends). Kept in sync with services/api lexicon.py. */

import type { WordAudio } from "@/lib/types";

export type Ar = { full: string; bare: string; translit: string };
export type PosLabel = { tag: string; ar: string | null; en: string | null };

export type PatternInfo = {
  slug: string;
  ar: Ar;
  form_number: number | null;
  pos_hint: string | null;
  function_ar: string | null;
  function_en: string | null;
  plain_ar: string | null;
  plain_en: string | null;
  /** the board's function (quoted from the sarf books) and plain explanation (its own words), in force (P3.0c) */
  function_board?: { approved_at: string | null; sources: BoardSource[] };
  plain_board?: { approved_at: string | null };
  lemma_count: number;
  occurrences: number;
  method?: string | null;
};

/** al-Suyūṭī's entry on a word reported as non-Arabic (P3.7a), verbatim. */
export type LoanwordEntry = {
  id: string;
  review?: BoardReview;
  headword_ar: string;
  text_ar: string;
  page: number | null;
  languages: { key: string; name_ar: string; name_en: string }[];
  confidence: string;
  method: string;
  scope: string;
  attribution_ar: string;
  attribution_en: string;
};

export type LemmaLite = {
  slug: string;
  /** al-Suyūṭī reports this word as non-Arabic (family members only) */
  loanword?: boolean;
  ar: Ar;
  pos: PosLabel;
  gloss_en: string | null;
  occurrences: number;
  verse_count?: number;
  root?: { key: string; ar_spaced: string } | null;
};

export type RootInfo = {
  key: string;
  letters: string[];
  ar_spaced: string;
  translit: string;
  gloss_en: string | null;
  gist_ar: string | null;
  /** where the core idea comes from, and how many uṣūl Ibn Fāris gives the root (P3.4, P3.7a) */
  gist_source: { work_id: string; entry_id: number; page_ref: string | null; usul: "one" | "several" | "unrelated" | null } | null;
  /** the board's English gloss in force, and its word on Ibn Fāris's statement as cut (P3.0c) */
  gloss_board?: { approved_at: string | null; sources: BoardSource[] };
  gist_board?: { kept: "source" | "corrected"; approved_at: string | null };
  occurrences: number;
  verse_count: number;
  surah_count: number;
  lemma_count: number;
};

export type Label = { tag: string; ar: string; en: string };
export type Features = {
  pos?: Label;
  aspect?: Label;
  verb_form?: { number: number; roman: string; pattern: string };
  voice?: Label;
  mood?: Label;
  derivation?: Label;
  person?: Label;
  gender?: Label;
  number?: Label;
  case?: Label;
  indefinite?: boolean;
  special?: Label;
};
export type Segment = {
  kind: "prefix" | "stem" | "suffix";
  text: string;
  index: number;
  root?: string;
  lemma?: string;
  label?: Label;
  features?: Features;
};

export type Gloss = {
  id: number;
  phrase: string;
  gloss: string;
  page_ref: string | null;
  title_ar: string;
  title_en: string;
  author_ar: string;
  attribution_ar: string;
  attribution_en: string;
};

/** al-Muyassar fī Gharīb's meaning of the phrase this word belongs to (P3.1), display-only. */
export type MeaningHere = {
  id: string;
  review?: BoardReview;
  phrase_ar: string;
  meaning_ar: string;
  match_confidence: string;
  mushaf_page: number | null;
  locator: string;
  status: string;
  title_ar: string;
  title_en: string;
  publisher_ar: string;
  publisher_en: string;
  attribution_ar: string;
  attribution_en: string;
  display_only: boolean;
};

/** al-Rāghib's treatment of a lemma in al-Mufradāt (P3.1): sub-entries verbatim with his numbered senses. */
export type Mufradat = {
  work: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; death_hijri: number | null; death_ce: number | null; attribution_ar: string; attribution_en: string };
  subentries: {
    id: string;
    entry_id: number;
    review?: BoardReview;
    headword_ar: string;
    text_ar: string;
    page_ref: string | null;
    match_method: string | null;
    match_confidence: string | null;
    status: string;
    verses: string[];
    senses: { list_no: number; sense_index: number; marker_ar: string | null; announcement_ar: string | null; stated_count: number | null; found_count: number; text_ar: string; verses: string[]; page_ref: string | null }[];
  }[];
};

/** A particle entry treating this word (P3.8), by its lemma or by an affix of this occurrence. */
export type ParticleLink = {
  id: string;
  review?: BoardReview;
  source_id: string;
  headword_ar: string;
  descriptor_ar: string | null;
  section_ar: string;
  sense_count: number;
  stated_count: number | null;
  match_method: string | null;
  match_confidence: string | null;
  page_vol: number | null;
  page: number | null;
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  via: { kind: "lemma" } | { kind: "affix"; text: string; label: { ar: string; en: string; tag: string } };
};
export type ParticleEntry = {
  id: string;
  headword_ar: string;
  descriptor_ar: string | null;
  sense_count: number;
  stated_count: number | null;
  page_vol: number | null;
  page: number | null;
  status: string;
  senses: { id: string; kind: "intro" | "sense" | "note"; list_no: number | null; list_depth: number | null; parent_id: string | null; sense_index: number | null; marker_ar: string | null; label_ar: string | null; text_ar: string; page_vol: number | null; page: number | null }[];
  source: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; edition_ar: string | null; licence: string; licence_url: string | null; attribution_ar: string; attribution_en: string };
};

export type Occurrence = {
  location: string;
  uri: string;
  verse_key: string;
  surah: { number: number; name_ar: string; name_translit: string };
  position: number;
  token_from: number;
  token_to: number;
  surface: Ar;
  surface_imlaei: string | null;
  gloss_en: string | null;
  definite: boolean;
  features: Features;
  segments: Segment[];
  glosses: Gloss[];
  meanings_here: MeaningHere[];
  audio: WordAudio | null;
  /** ids of the mushaf signs written on this word (P3.9) */
  signs: string[];
  variants: { source: string; root_key: string | null; source_title_ar: string; source_title_en: string }[];
};

/** The editorial board's verdict on a row a book gave (P3.0c). */
export type BoardReview = { verdict: "reviewed" | "corrected"; note: string | null; correction?: string | null; approved_at: string | null };
/** A source as the board cites it: a work and where in it, and the words quoted. */
export type BoardSource = { work: string; ref: string; quote?: string; title_ar?: string; title_en?: string };
/** A sense: the board's (`status: "board"`, with its sources) or one merged from a proposal. */
export type Sense = { id: number; ordinal: number; text_ar: string | null; text_en: string | null; sources: BoardSource[]; status: string };

export type DictEntry = {
  id: number;
  headword: string;
  match: string | null;
  confidence: string;
  core_meaning: string | null;
  page_ref: string | null;
  excerpt: string;
  length: number;
};
export type DictWork = {
  id: string;
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  death_hijri: number | null;
  death_ce: number | null;
  lang: string;
  edition_note: string;
  source_url: string;
  license: string;
  attribution_ar: string;
  attribution_en: string;
  redistributable: boolean;
  entries: DictEntry[];
};

export type CoreMeaning = {
  text: string;
  work_id: string;
  title_ar: string;
  title_en: string;
  author_ar: string;
  page_ref: string | null;
  entry_id: number;
} | null;

export type FamilyGroup = { pattern: PatternInfo | null; members: LemmaLite[] };

export type Attestation = {
  location: string;
  uri?: string;
  verse_key: string;
  surah_name_ar: string;
  revelation_place?: string;
  left: string;
  keyword: string;
  right: string;
  features?: Features;
};

export type WordPayload = {
  slug: string;
  lemma_id: number;
  mufradat: Mufradat | null;
  particles: ParticleLink[];
  loanwords: LoanwordEntry[];
  uri: string;
  ar: Ar;
  pos: PosLabel;
  verb_form: number | null;
  derivation: string | null;
  gloss_en: string | null;
  corpus_freq: number;
  verse_count: number;
  audio_url: string | null;
  root: RootInfo | null;
  pattern: PatternInfo | null;
  occurrence: Occurrence | null;
  senses: Sense[];
  senses_status: "pending" | "linked";
  /** the board put this sense list in force (P3.0c) */
  senses_board?: { approved_at: string | null };
  core_meaning: CoreMeaning;
  family: FamilyGroup[];
  shapes: { root_patterns: PatternInfo[]; same_pattern_other_roots: LemmaLite[] };
  dict_articles: DictWork[];
  timeline: {
    min: number;
    max: number;
    dictionaries: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; death_hijri: number | null; death_ce: number; lang: string; has_article: boolean }[];
    /** the Quran, then the hadith collections and the books by their compilers' death; a text attests the root where
     * its passages hold it (count: the sure, possible apart) */
    corpora: { id: string; label_ar: string; label_en: string; year: number; attests: boolean; kind?: string | null; count?: number; possible?: number }[];
    per_sense: null;
  };
  attestations: {
    text: { slug: string; title_ar: string; title_en: string };
    total: number;
    meccan: number;
    medinan: number;
    forms: { form: Ar; imlaei: string | null; occurrences: number; sample: string }[];
    by_chapter: { surah: number; name_ar: string; name_translit: string; revelation_place: string; occurrences: number }[];
    items: Attestation[];
    more: boolean;
  };
  next_steps: (
    | { kind: "cousin"; slug: string; ar: Ar; gloss_en: string | null; pattern: { slug: string; ar: Ar } | null }
    | { kind: "verse"; location: string; verse_key: string }
    | { kind: "pattern"; slug: string; ar: Ar }
  )[];
};

export type GlossaryTerm = {
  key: string;
  category: string;
  category_ar: string;
  category_en: string;
  label_ar: string;
  label_en: string;
  body_ar: string;
  body_en: string;
  href: string | null;
  jump_target: string | null;
  sort_order: number;
};

export type SurahRoot = { key: string; spaced: string; translit: string; here: number; occurrences: number; gist_ar: string | null };

/* ─── Knowledge layers (P3.9) and relation seeds (P3.1/P8.4), verbatim with their sources ─── */
export type KnowledgeSource = {
  id: string;
  kind: string;
  use: string;
  title_ar: string;
  title_en: string;
  version: string | null;
  url: string;
  license: string;
  license_ar: string | null;
  license_url: string | null;
  attribution_ar: string;
  attribution_en: string;
};
export type VerseRef = { id: number; key: string; surah: number; ayah: number; name_ar: string; name_translit: string };
export type EditorNote = { at: number; kind: string; text: string };
export type Asbab = {
  id: number;
  work: "tafsircenter" | "wahidi" | "suyuti";
  source_id: string;
  surah: number | null;
  ayah_from: number | null;
  ayah_to: number | null;
  number: number | null;
  heading: string | null;
  text: string;
  takhrij: string | null;
  notes: EditorNote[] | null;
  locator: string;
  match_method: string | null;
  confidence: string | null;
  page: string | null;
  section_kind: string;
};
export type VersePlace = {
  id: number;
  surah: number;
  ayah_from: number;
  ayah_to: number;
  place: string | null;
  period: "makki" | "madani" | null;
  role: "source-note" | "reported" | "preferred";
  attributed_to: string | null;
  quote: string;
  context: string;
  method: string;
  scope: "verses" | "surah";
  source_id: string;
};
export type VerseKnowledge = {
  key: string;
  status: "extracted";
  asbab: Asbab[];
  places: VersePlace[];
  cites: { to: VerseRef; to_end: VerseRef; method: string; confidence: string; quote: string | null; reference: string | null; mentions: number; source_id: string }[];
  cited_by: { from: VerseRef; method: string; confidence: string; quote: string | null; reference: string | null; source_id: string }[];
  entities: { id: number; name_ar: string; name_plain: string; occurrences: number; verse_count: number; wikidata_id: string | null; wikidata_label_ar: string | null; wikidata_label_en: string | null; wikidata_description: string | null; status: string; lemma_slug: string }[];
  sources: Record<string, KnowledgeSource>;
};
export type RelationSource = {
  id: string;
  kind: string;
  sort_order: number;
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  death_hijri: number | null;
  death_ce: number | null;
  edition_ar: string | null;
  edition_en: string | null;
  source_url: string;
  licence: string;
  licence_url: string;
  redistributable: string;
  attribution_ar: string;
  attribution_en: string;
};
export type WujuhSense = {
  id: string;
  sense_index: number;
  sense_marker_ar: string | null;
  sense_label_ar: string | null;
  text_ar: string;
  verses: string[];
  locator: string;
  page_vol: number | null;
  page: number | null;
  cites_here: boolean;
  /** the editorial board's verdict on the sense (P3.0c, P8.4) */
  review?: BoardReview;
};
export type WujuhEntry = {
  id: string;
  source_id: string;
  heading_ar: string;
  headword_ar: string;
  scope: "lemma" | "root" | "other-lemma";
  match_method: string | null;
  match_confidence: string | null;
  stated_count: number | null;
  stated_count_ar: string | null;
  intro_ar: string | null;
  locator: string;
  page_vol: number | null;
  page: number | null;
  status: string;
  senses: WujuhSense[];
};
export type Contrast = {
  id: string;
  type: "furuq_contrast" | "didd";
  source_id: string;
  heading_ar: string | null;
  headword_ar: string;
  target_ar: string | null;
  root_key: string | null;
  target_root_key: string | null;
  text_ar: string;
  verses: string[];
  locator: string;
  page_vol: number | null;
  page: number | null;
  review?: BoardReview;
};
/** A word of this root named in a field's chapter (P8.4c): the field, its place in the book, the sentence. */
export type FieldRow = {
  id: string;
  source_id: string;
  entry_id: string;
  headword_ar: string;
  root_key: string;
  sense_label_ar: string;
  heading_ar: string;
  section_ar: string | null;
  text_ar: string;
  verses: string[];
  locator: string;
  page_vol: number | null;
  page: number | null;
  review?: BoardReview;
};
export type WordRelations = {
  slug: string;
  root: string | null;
  status: "extracted";
  wujuh: WujuhEntry[];
  furuq: Contrast[];
  addad: Contrast[];
  fields: FieldRow[];
  sources: Record<string, RelationSource>;
};
export type SurahCard = {
  card: {
    surah: number;
    name_ar: string;
    place: "meccan" | "medinan";
    revelation_order: number;
    verse_count: number;
    tc_place_ar: string;
    tc_revelation_order: number;
    place_agrees: boolean;
    order_agrees: boolean;
    names: string | null;
    names_notes: EditorNote[] | null;
    revelation: string | null;
    revelation_notes: EditorNote[] | null;
    virtues: string | null;
    virtues_notes: EditorNote[] | null;
    count_text_a: string | null;
    count_text_a_notes: EditorNote[] | null;
    count_text_b: string | null;
    count_text_b_notes: EditorNote[] | null;
    aims: string | null;
    aims_notes: EditorNote[] | null;
    truncated_fields: string[] | null;
    verse_counts_status: string;
    tc_study_preferred_period: "makki" | "madani" | null;
    source_ids: string[];
  };
  sources: Record<string, KnowledgeSource>;
};

/** What a sarf work says about a pattern, verbatim (P3.3), with al-Raḍī's commentary on it. */
export type ClassicalRow = {
  id: string;
  source_id: string;
  kind: "meaning" | "inventory" | "definition" | "statement";
  section: string;
  heading_ar: string | null;
  pattern_ar: string | null;
  form_number: number | null;
  match_method: string | null;
  match_confidence: "high" | "medium" | null;
  text_ar: string;
  examples_ar: string[];
  locator: string;
  page_vol: number | null;
  page: number | null;
  status: "extracted" | "reviewed";
  review?: BoardReview;
  via: "direct" | "inflected" | "suffix";
  commentary: { id: string; source_id: string; text_ar: string; cue_ar: string | null; locator: string; page_vol: number | null; page: number | null; status: string }[];
};
export type ClassicalSource = {
  id: string;
  role: "matn" | "commentary";
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  death_hijri: number | null;
  death_ce: number | null;
  edition_ar: string | null;
  edition_en: string | null;
  page_numbering: "matches-print" | "unverified";
  licence: string;
  licence_url: string | null;
  attribution_ar: string;
  attribution_en: string;
};
