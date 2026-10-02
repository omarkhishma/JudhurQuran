/** Shapes returned by the Judhur API (/api/v1). Kept in sync with services/api content.py. */

export type Label = { tag: string; ar: string; en: string };

export type Surah = {
  number: number;
  name_ar: string;
  name_translit: string;
  name_en: string;
  revelation_place: "meccan" | "medinan";
  revelation_order: number;
  verse_count: number;
  rukus: number;
  page_start: number;
  page_end: number;
  juz_start: number;
  word_count: number;
  has_basmala: boolean;
};

export type Token = { position: number; text: string; word_from: number; word_to: number };

export type WordLite = {
  position: number;
  location: string;
  token_from: number;
  token_to: number;
  pos: string;
  text_uthmani: string;
  text_imlaei: string;
  translit: string | null;
  gloss_en: string | null;
  root: string | null;
  lemma: string | null;
  lemma_id: number | null;
};

export type Features = {
  pos: Label;
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
  flags?: string[];
};

export type Segment = {
  index: number;
  kind: "prefix" | "stem" | "suffix";
  text: string;
  features?: Features;
  lemma?: string;
  root?: string;
  label?: Label;
};

export type Verse = {
  id: number;
  surah: number;
  ayah: number;
  key: string;
  page: number;
  juz: number;
  line_start: number;
  line_end: number;
  hizb_mark: boolean;
  hizb_quarter: number;
  manzil: number;
  ruku: number;
  sajda: "recommended" | "obligatory" | null;
  text_qpc: string;
  number_text: string;
  text_imlaei: string;
  word_count: number;
  token_count: number;
  tokens: Token[];
  words: WordLite[];
  translation?: { text: string; footnotes: string | null } | null;
  prev?: string | null;
  next?: string | null;
};

export type SurahPayload = {
  surah: Surah;
  verses: Verse[];
  translation?: { id: string; title_ar: string; title_en: string };
};

export type LemmaSummary = {
  id: number;
  key: string;
  ar: string;
  ar_bare: string;
  pos: string;
  verb_form: number | null;
  derivation: string | null;
  occurrences: number;
  verse_count: number;
  gloss_en: string | null;
  pattern: string | null;
  forms?: { form: string; occurrences: number; sample: string }[];
};

export type RootSummary = {
  key: string;
  letters: string[];
  spaced: string;
  translit: string;
  occurrences: number;
  verse_count: number;
  surah_count: number;
  lemma_count: number;
};

export type Variant = {
  source: string;
  root_key: string | null;
  source_title_ar: string;
  source_title_en: string;
  url: string;
};

export type NextStep =
  | { kind: "cousin"; lemma: LemmaSummary; location: string }
  | { kind: "verse"; location: string; verse_key: string }
  | {
      kind: "shape";
      lemma: LemmaSummary & { root: string };
      location: string;
      verb_form?: Features["verb_form"];
      derivation?: Label;
    };

export type WordDetail = {
  id: number;
  location: string;
  surah: number;
  ayah: number;
  position: number;
  token_from: number;
  token_to: number;
  text_uthmani: string;
  text_imlaei: string;
  pos: string;
  definite: boolean;
  features: Features;
  segments: Segment[];
  translit: string | null;
  gloss_en: string | null;
  verse: {
    id: number;
    key: string;
    surah: number;
    ayah: number;
    text_qpc: string;
    number_text: string;
    page: number;
    juz: number;
    surah_name_ar: string;
    tokens: Token[];
  };
  lemma: LemmaSummary | null;
  root: (RootSummary & { lemmas: LemmaSummary[] }) | null;
  variants: Variant[];
  occurrences: { form: number; lemma: number | null; root: number | null };
  next_steps: NextStep[];
  root_meaning: {
    core: RootLexicon["core_meaning"];
    mufradat: (Pick<LexiconWork, "id" | "title_ar" | "title_en" | "author_ar" | "death_hijri" | "attribution_ar" | "attribution_en"> & { entry: LexiconEntrySummary }) | null;
  } | null;
  glosses: Gloss[];
};

export type RootDetail = RootSummary & {
  lemmas: (LemmaSummary & { forms: { form: string; occurrences: number; sample: string }[] })[];
  distribution: {
    surah: number;
    name_ar: string;
    name_translit: string;
    revelation_place: "meccan" | "medinan";
    occurrences: number;
  }[];
  variants: { source: string; location: string; form: string; other_root: string | null }[];
  also_attributed: { source: string; location: string; form: string; corpus_root: string | null }[];
  lexicon: RootLexicon;
};

export type Occurrence = {
  location: string;
  verse_key: string;
  left: string;
  keyword: string;
  right: string;
  form: string;
  lemma: string | null;
  lemma_id: number | null;
  pos: string;
  surah_name_ar: string;
};

export type OccurrencesPage = {
  root: { key: string; spaced: string; translit: string; occurrences: number };
  total: number;
  data: Occurrence[];
  next_cursor: string | null;
};

export type Work = {
  id: string;
  kind: "tafsir" | "translation";
  lang: string;
  level: string | null;
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  version: string;
  default_for: string | null;
  verse_coverage: number;
  passage_count: number;
  source_id: string;
  source_title_ar: string;
  source_title_en: string;
  source_url: string;
  source_license: string;
  attribution_ar: string;
  attribution_en: string;
};

export type Commentary = {
  verse: string;
  data: {
    work: Work;
    passage: { text: string; footnotes: string | null; verse_from: string; verse_to: string } | null;
  }[];
};

export type Source = {
  id: string;
  kind: string;
  role: string;
  title_ar: string;
  title_en: string;
  version: string | null;
  url: string;
  license: string;
  license_url: string | null;
  attribution_ar: string;
  attribution_en: string;
};

export type Meta = {
  dataset: {
    version: string;
    text_sha256: string;
    counts: Record<string, number>;
    loaded_at: string;
  };
  sources: Source[];
};

export type SearchResult = {
  query: string;
  detected: { kind: string; label_ar: string; label_en: string; surah?: number; ayah?: number };
  results: {
    verses: { key: string; surah: number; ayah: number; text_qpc: string; text_imlaei: string; name_ar: string; name_translit: string }[];
    surahs: Surah[];
    roots: { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number; verse_count: number }[];
    lemmas: { id: number; ar: string; pos: string; occurrences: number; root: string | null; gloss_en?: string | null }[];
    words: {
      form: string;
      display: string;
      occurrences: number;
      sample: string;
      lemma_id: number | null;
      lemma: string | null;
      root: string | null;
      exact: boolean;
    }[];
  };
};

export type LexiconWork = {
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
};

export type LexiconEntrySummary = {
  id: number;
  headword: string;
  match: string | null;
  confidence: "exact" | "manual" | "high";
  core_meaning: string | null;
  page_ref: string | null;
  excerpt: string;
  length: number;
};

export type RootLexicon = {
  core_meaning: { text: string; work_id: string; title_ar: string; title_en: string; author_ar: string; page_ref: string | null; entry_id: number } | null;
  works: (LexiconWork & { entries: LexiconEntrySummary[] })[];
};

export type Gloss = { id: number; phrase: string; gloss: string; page_ref: string | null; title_ar: string; title_en: string; author_ar: string; attribution_ar: string; attribution_en: string };
