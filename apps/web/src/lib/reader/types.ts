/** Shapes of the lexeme API (/api/v1/words/:slug and friends). Kept in sync with services/api lexicon.py. */

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
  lemma_count: number;
  occurrences: number;
  method?: string | null;
};

export type LemmaLite = {
  slug: string;
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
  gist_source: unknown;
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
  variants: { source: string; root_key: string | null; source_title_ar: string; source_title_en: string }[];
};

export type Sense = { id: number; ordinal: number; text_ar: string | null; text_en: string | null; sources: unknown[]; status: string };

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
};

export type WordPayload = {
  slug: string;
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
  core_meaning: CoreMeaning;
  family: FamilyGroup[];
  shapes: { root_patterns: PatternInfo[]; same_pattern_other_roots: LemmaLite[] };
  dict_articles: DictWork[];
  timeline: {
    min: number;
    max: number;
    dictionaries: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; death_hijri: number | null; death_ce: number; lang: string; has_article: boolean }[];
    corpora: { id: string; label_ar: string; label_en: string; year: number; attests: boolean }[];
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
    | { kind: "cousin"; slug: string; ar: Ar; gloss_en: string | null }
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
