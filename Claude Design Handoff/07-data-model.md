# 7 · Data model

The prototypes have no database. Every entity below is derived from `prototypes/lexicon-data.js` (the content model) plus the `jadhr-*` localStorage keys (the user model). This document turns both into a real schema.

Postgres DDL is given because the shape matters more than the engine; adapt to your ORM. **Read §7.1 before the DDL** — the Arabic-specific decisions are the part that goes wrong if skipped.

---

## 7.1 Arabic-specific decisions (read first)

**1 · Store three forms of every Arabic string.**
```
ar_full      the display form, with tashkīl      كِتَابَة
ar_bare      diacritics stripped                  كتابة
ar_norm      bare + alef/hamza folded, for match  كتابه → كتابه
```
`ar_full` is what you render. `ar_bare` is what you show when the tashkīl toggle is off. `ar_norm` is **never displayed** — it exists only for matching and indexing. Generate `ar_bare` and `ar_norm` as stored generated columns or in a trigger, never by hand.

Normalisation, matching the prototype:
```
strip:  /[\u064B-\u0652\u0670\u0640]/g     (harakat, superscript alef, tatweel)
fold:   أ إ آ → ا      ى → ي      ة → ه     (matching only)
```

**2 · Never store English inside an Arabic text field.** Glosses are separate columns. The prototype had a bug where glosses were spliced into Arabic lexicon text; the schema should make that impossible.

**3 · Roots are sequences, not strings.** Store the consonants as an ordered array *and* the joined form. A root is looked up by its letters in order, matched against a word's consonantal skeleton. Storing only `"كتب"` makes the root builder and skeleton matching awkward.

**4 · Tokens are first-class rows, not a JSON blob.** The prototype encodes a token as `'المَكْتَبَةِ|maktaba|noun · genitive, definite'` inside a passage array. In production each token is a row, because the concordance, the heat-map, the reading surface, and the analyser all query tokens directly.

**5 · Every text uses `NFC`, `UTF-8`, and an explicit collation.** Mixed normalisation forms will silently break equality comparisons on Arabic.

---

## 7.2 Content schema

```sql
-- ─── Roots ────────────────────────────────────────────────────────────
create table roots (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,        -- 'ktb' — stable slug, used in URLs
  letters       text[] not null,              -- {'ك','ت','ب'} ordered
  ar_spaced     text not null,                -- 'ك ت ب' display form
  ar_bare       text not null,                -- 'كتب'
  translit      text not null,                -- 'k-t-b'
  gloss_en      text not null,                -- 'writing, inscribing, setting down'
  gist_ar       text,                          -- the classical core-idea phrase
  corpus_freq   integer not null default 0,
  created_at    timestamptz not null default now()
);
create index on roots (ar_bare);
create index on roots using gin (letters);

-- ─── Patterns (awzān) ─────────────────────────────────────────────────
create table patterns (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,         -- 'fa3al', 'maf3al'
  ar_full       text not null,                -- 'مَفْعَلَة'
  ar_bare       text not null,
  translit      text not null,                -- 'mafʿala'
  function_en   text not null,                -- 'noun of place (fem.)'
  form_number   smallint,                     -- I–X where applicable
  pos_hint      text,                          -- 'noun' | 'verb' | 'participle'
  plain_en      text                           -- plain-language explanation
);

-- ─── Words (lexemes) ──────────────────────────────────────────────────
create table words (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,         -- 'maktaba' — used in ?w=
  root_id       uuid not null references roots(id),
  pattern_id    uuid references patterns(id),
  ar_full       text not null,                -- 'مَكْتَبَة'
  ar_bare       text generated always as (regexp_replace(ar_full,'[\u064B-\u0652\u0670\u0640]','','g')) stored,
  ar_norm       text,                          -- set by trigger: bare + folded
  translit      text not null,                -- 'maktaba'
  gloss_en      text not null,                -- short gloss
  pos           text not null,                -- 'noun'|'verb'|'participle'|'adjective'|'particle'
  def_ar        text,                          -- classical one-line definition
  corpus_freq   integer not null default 0,
  audio_url     text,                          -- null until real audio exists
  created_at    timestamptz not null default now()
);
create index on words (root_id);
create index on words (pattern_id);
create index on words (ar_bare);
create index on words (ar_norm);

-- ─── Senses ───────────────────────────────────────────────────────────
-- Separate table because senses are the unit of editing: proposals target
-- {word, sense}, and merged edits rewrite one sense with a credit line.
create table senses (
  id            uuid primary key default gen_random_uuid(),
  word_id       uuid not null references words(id) on delete cascade,
  ordinal       smallint not null,            -- 1-based, display order
  text_en       text not null,
  text_ar       text,
  credited_to   uuid references users(id),    -- set when a proposal merges
  credited_at   timestamptz,
  source_note   text,
  unique (word_id, ordinal)
);

-- ─── Historical dictionaries ──────────────────────────────────────────
create table dictionaries (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,         -- 'lisan', 'lane', 'ayn'
  name_ar       text not null,                -- 'لسان العرب'
  name_en       text not null,                -- 'Lisan al-Arab'
  author        text not null,
  death_year    integer,                      -- CE, for the timeline
  kind          text not null,                -- 'earliest'|'general'|'root'|'interpretive'|'english'
  tag           text,                          -- 'comprehensive', 'concise'
  license       text not null,                -- REQUIRED. see 10-open-questions §1
  source_note   text,                          -- edition + provenance
  sort_order    smallint not null default 0
);

-- ─── Dictionary articles ──────────────────────────────────────────────
create table dict_articles (
  id            uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id),
  word_id       uuid references words(id),
  root_id       uuid references roots(id),    -- root-organised lexica key on root
  body          text not null,                -- the article, Arabic or English
  body_lang     text not null default 'ar',
  page_ref      text,
  unique (dictionary_id, word_id)
);
create index on dict_articles (word_id);
create index on dict_articles (root_id);

-- ─── Texts, chapters, passages, tokens ────────────────────────────────
create table texts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,         -- 'quran', 'bukhari', 'u-abc123'
  title_ar      text not null,
  title_en      text not null,
  kind          text not null,                -- 'quran'|'hadith'|'poetry'|'prose'|'user'
  meta          text,                          -- 'Medinan · 286 verses'
  era_year      integer,                       -- for the timeline / distribution
  owner_id      uuid references users(id),    -- null = canonical corpus
  license       text,
  created_at    timestamptz not null default now()
);

create table chapters (
  id            uuid primary key default gen_random_uuid(),
  text_id       uuid not null references texts(id) on delete cascade,
  ordinal       smallint not null,
  title_ar      text not null,
  title_en      text not null,
  meta          text,
  unique (text_id, ordinal)
);

create table passages (
  id            uuid primary key default gen_random_uuid(),
  chapter_id    uuid not null references chapters(id) on delete cascade,
  ordinal       smallint not null,
  ref           text,                          -- '2:31', 'Bukhārī 71', null for prose
  ar_full       text not null,                -- the joined passage, display form
  translit      text,
  trans_en      text,
  difficulty    smallint,                      -- 1-5, shown in the Reader's contents
  unique (chapter_id, ordinal)
);
create index on passages (chapter_id, ordinal);

create table tokens (
  id            uuid primary key default gen_random_uuid(),
  passage_id    uuid not null references passages(id) on delete cascade,
  ordinal       smallint not null,            -- position in the passage
  surface       text not null,                -- 'المَكْتَبَةِ' as it appears
  surface_bare  text not null,
  word_id       uuid references words(id),    -- null = unanalysed / particle
  root_id       uuid references roots(id),
  pattern_id    uuid references patterns(id),
  gram          text,                          -- 'noun · genitive, definite'
  confidence    real,                          -- from the analyser; 1.0 if hand-tagged
  unique (passage_id, ordinal)
);
create index on tokens (word_id);
create index on tokens (root_id);          -- the concordance's hot path
create index on tokens (surface_bare);

-- ─── Plain-language glossary ──────────────────────────────────────────
create table glossary_terms (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,         -- 'root', 'wazn', 'participle'
  label         text not null,
  category      text not null,                -- 'grammar', 'lexicography'
  plain_en      text not null,                -- 2-3 plain sentences
  jump_target   text                           -- 'family' | 'shapes' | …
);
```

**~30 glossary terms are already written** in `Lexicon Reader v5.dc.html` (search for `const GLOSSARY`). Extract them verbatim — they are edited copy, not placeholder.

---

## 7.3 User and community schema

```sql
create table users (
  id            uuid primary key default gen_random_uuid(),
  handle        text unique,
  display_name  text not null,
  email         text unique,
  role          text not null default 'member', -- 'member'|'reviewer'|'instructor'|'admin'
  created_at    timestamptz not null default now()
);

-- Anonymous, local-first users get a client-generated id and migrate on sign-in.
create table anon_migrations (
  anon_id       text primary key,
  user_id       uuid not null references users(id),
  migrated_at   timestamptz not null default now()
);

-- jadhr-word-states
create table word_states (
  user_id       uuid not null references users(id) on delete cascade,
  word_id       uuid not null references words(id) on delete cascade,
  state         text not null,                -- 'learning'|'known'|'starred'
  updated_at    timestamptz not null default now(),
  primary key (user_id, word_id)
);

-- jadhr-progress
create table reading_progress (
  user_id       uuid not null references users(id) on delete cascade,
  text_id       uuid not null references texts(id) on delete cascade,
  chapter_ord   smallint not null,
  passage_ord   smallint not null,
  updated_at    timestamptz not null default now(),
  primary key (user_id, text_id)
);

-- jadhr-notes
create table notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  body          text not null,
  tags          text[] not null default '{}',
  word_id       uuid references words(id),
  passage_id    uuid references passages(id),
  kind          text not null default 'note', -- 'note'|'marginalia'|'trail'|'journal'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on notes (user_id, created_at desc);

-- jadhr-sessions — feeds the journal, the classroom heat-map, and the profile
create table lookup_events (
  id            bigserial primary key,
  user_id       uuid references users(id) on delete cascade,
  word_id       uuid references words(id),
  root_id       uuid references roots(id),
  text_id       uuid references texts(id),
  passage_id    uuid references passages(id),
  kind          text not null,                -- 'lookup'|'ask'|'confirm'|'struggle'
  created_at    timestamptz not null default now()
);
create index on lookup_events (user_id, created_at desc);
create index on lookup_events (root_id, created_at desc);

-- Spaced repetition. The unit is the ROOT FAMILY, not the word.
create table review_cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  root_id       uuid not null references roots(id),
  due_at        timestamptz not null,
  interval_days real not null default 0,
  ease          real not null default 2.5,
  reps          integer not null default 0,
  lapses        integer not null default 0,
  last_grade    smallint,
  last_mode     text,                          -- 'root' | 'context'
  unique (user_id, root_id)
);
create index on review_cards (user_id, due_at);

create table review_grades (
  id            bigserial primary key,
  card_id       uuid not null references review_cards(id) on delete cascade,
  grade         smallint not null,            -- 1-4
  mode          text not null,
  passage_id    uuid references passages(id), -- for 'context' mode
  graded_at     timestamptz not null default now()
);

-- jadhr-proposals
create table proposals (
  id            uuid primary key default gen_random_uuid(),
  word_id       uuid not null references words(id),
  sense_id      uuid not null references senses(id),
  proposer_id   uuid not null references users(id),
  current_text  text not null,                -- snapshot at proposal time
  proposed_text text not null,
  rationale     text not null,
  sources       text,
  status        text not null default 'open', -- 'open'|'approved'|'merged'|'declined'
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index on proposals (status, created_at desc);

create table proposal_decisions (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  reviewer_id   uuid not null references users(id),
  decision      text not null,                -- 'approve'|'decline'
  note          text,
  created_at    timestamptz not null default now(),
  unique (proposal_id, reviewer_id)            -- enforces no double-approve
);
```

The `unique (proposal_id, reviewer_id)` constraint is how "no double-approve" is enforced at the database level rather than in the UI. Add a check that `reviewer_id <> proposer_id` for no self-approve. The merge trigger is **two distinct `approve` decisions**.

```sql
-- ─── Graphs ───────────────────────────────────────────────────────────
create table graphs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users(id),
  title         text not null,
  doc           jsonb not null,               -- { nodes: [...], edges: [...] }
  doc_version   smallint not null default 2,  -- for the legacy-format fallback
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table published_graphs (
  slug          text primary key,
  graph_id      uuid not null references graphs(id),
  owner_id      uuid not null references users(id),
  title         text not null,
  description   text,
  doc           jsonb not null,               -- IMMUTABLE SNAPSHOT
  doc_version   smallint not null default 2,
  counts        jsonb not null,               -- { cards, roots, words }
  forked_from   text references published_graphs(slug),
  fork_count    integer not null default 0,
  cited_count   integer not null default 0,
  published_at  timestamptz not null default now()
);

create table graph_comments (
  id            uuid primary key default gen_random_uuid(),
  graph_id      uuid not null references graphs(id) on delete cascade,
  author_id     uuid not null references users(id),
  node_id       text,                          -- null = canvas comment
  anchor        text,                          -- the card's Arabic at comment time
  body          text not null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── Classroom ────────────────────────────────────────────────────────
create table cohorts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  instructor_id uuid not null references users(id),
  graph_id      uuid references graphs(id),   -- the shared workspace
  created_at    timestamptz not null default now()
);

create table cohort_members (
  cohort_id     uuid not null references cohorts(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null default 'learner',
  primary key (cohort_id, user_id)
);

create table lessons (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references cohorts(id) on delete cascade,
  title         text not null,
  passage_ids   uuid[] not null default '{}',
  root_ids      uuid[] not null default '{}',
  assigned_at   timestamptz,
  due_at        timestamptz
);
```

The classroom heat-map is a query over `lookup_events` grouped by `(user_id, root_id)` filtered to a cohort and lesson, with the `layer` selector choosing which `kind` to count. Materialise it if the cohort is large.

```sql
-- ─── Dataset releases (Data & API) ────────────────────────────────────
create table dataset_releases (
  version       text primary key,             -- 'v2026.09'
  doi           text,
  license       text not null,
  released_at   timestamptz not null default now(),
  artefacts     jsonb not null,               -- { json: url, tei: url, lmf: url, csv: url }
  changelog     jsonb not null                -- merged proposals in this release
);
```
Releases are **immutable and permanently retrievable** — published citations point at them.

---

## 7.4 Seeding

`prototypes/lexicon-data.js` is a complete, hand-written, linguistically correct seed set. Use it:

| In the file | Rows | Goes to |
|---|---|---|
| `ROOTS` | 6 | `roots` |
| `FORM_META` | 22 | `patterns` |
| `WORDS` | 35 | `words` + `senses` (each word has 1–3 senses) |
| `DICTS` | 9 | `dictionaries` (**license column needs real values**) |
| `BOOK` | 1 text, 3 chapters, 10 passages | `texts`/`chapters`/`passages`/`tokens` |
| `SCRIPTURE` | Qurʾān (2 sūras, 4 verses) + Bukhārī (2 ḥadīth) | same |
| `GLOSSARY` (in Reader v5) | ~30 | `glossary_terms` |
| `CORPORA` | 3 | corpus/era reference data |

Write it as a real migration, not a script run once. It is the fixture the test suite should use.

**`lexEntry()` in that file generates placeholder dictionary article text** — plausible classical Arabic prose of realistic length so the layout can be judged. It is **not real lexicon content**. Do not ship it. Real articles come from the licensed sources in `10-open-questions.md` §1.
