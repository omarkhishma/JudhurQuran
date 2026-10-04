# 23 · Foundations coverage — P1 and the shell (SHL) against the plan, the inventory and the code

Audited 2026-10-04 against commit `0e7d424`, then updated at `8032395` for the rows fixed the same day. Scope: phase P1 "Foundations for parity" of `docs/PLAN.md` (P1.1–P1.9, every clause of their bullets) and every SHL item of the design inventory (`docs/research/05-design-inventory.md` Part 3 §1 and the SHL-D/F/Q/S ids elsewhere). Earlier audits settled some SHL rows (09, 10, 11); each was re-read against the code, and where the code has moved the row says so. Paths: **W/** `apps/web/src/`, **E/** `apps/web/e2e/`, **A/** `services/api/src/jadhr_api/`, **M/** `services/api/alembic/versions/`, **T/** `services/api/tests/`, **P/** `pipeline/src/jadhr_pipeline/`.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, the reason in DECISIONS or in the row. `bug-fixed` — the prototype's bug the item names is fixed. `n/a` — prototype plumbing with no product meaning. `open` — not built, or not as described, with what is missing. `waiting` — needs the owner.

## 1. Summary

| Scope | Rows | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|
| P1 clauses | 68 | 53 | 6 | 0 | 0 | 5 | 4 |
| SHL items | 78 | 49 | 16 | 6 | 5 | 2 | 0 |
| **Total** | **146** | **102** | **22** | **6** | **5** | **7** | **4** |

Counted from §2's rows. Fixed since the audit read the code (1d1cab6): next steps seeded by word and dataset version (P1.3), the basmala strip tested (P1.8, and with it P1.9's "P1.8 closed"), the header omnibox's `dir="auto"` (SHL-F08); the dead "being built" frame and a false "coming soon" line removed. Built alongside: D7's vowel-marks switch (1875674), which report 3 found missing.

**Open (7):** P1.3 the `{full, bare, translit}` envelope on the remaining Arabic fields; P1.3 `?in_text=`; P1.5 the design-system audit as a document; P1.7a `dict:` and `user:` identifiers; SHL-Q05 and SHL-Q10 a digits preference. Closed since the audit: P1.3a (918d5bb), P1.9's sweep, SHL-Q07 (8e311ad), SHL-Q09 (df469d3).

**Waiting on the owner (4):** the phone layouts were not shown before they were built, except the editor's (P1.7: offered now for review after the fact, screenshots at 390 px in every phase's audit); the phone editor (P8.6a); the lexica's legal basis (D22); research 07's findings (D2, D19, D22).

## 2. The rows

### P1 clauses

| Clause | Status | How |
|---|---|---|
| P1.1 generic model texts → chapters → passages → tokens | done | M/0007_generic_text_model.py:23-121, A/loader.py:53-58, P/generic.py; 45 texts (1 Quran, 7 hadith, 37 books), 384,315 passages |
| P1.1 Quran migrated into it | adapted | Projected, not moved: the Quran's passages carry keys and no text (M/0007:68), the mushaf stays in `verses.text_qpc` for the hash check (L1) |
| P1.1 existing Quran routes keep working | done | /quran/{s}, /quran/{s}/{a}, /word/{loc}, /read; E/journey.spec.ts, E/reader.spec.ts |
| P1.2 patterns catalogue | done | M/0007:72-86, M/0009; function and plain text from the board (A/lexicon.py) |
| P1.2 senses | done | M/0007:146-158; the board's lists (A/board.py) in the payload with their status |
| P1.2 dictionaries | done | M/0003, M/0010; GET /dictionaries; 10 works |
| P1.2 dict_articles by root and by word | adapted | By root for every work; by word where the source is cut by word (al-Mufradāt, the gharīb) and, since P3.1 (0e7d424), Lane's paragraph on each word |
| P1.2 glossary to the database and API | done | M/0007:132-144; GET /glossary |
| P1.2 collections | done | M/0018; GET /collections |
| P1.2 corpora/eras for the timeline | done | M/0007:123-130; GET /corpora |
| P1.2 root English gloss and Arabic core idea | done | gist_ar on 1,485 of 1,642 roots; gloss_en from the board only |
| P1.2 per-passage difficulty | adapted | A lexical level per verse and sūra (M/0014); DECISIONS 2026-10-03 "Verse difficulty (P3.6) is a lexical profile" |
| P1.2 migrations and loaders | done | M/0007…0043; A/loader.py |
| P1.3 API envelope {full, bare, translit} | open | `lexicon.ar()` covers the lemma, its pattern, the occurrence's surface, family members and patterns; sūra names, articles' headwords, concordance lines, Analyser tokens, the texts' payloads and the public API go out as plain strings (report 3) |
| P1.3 word payload v2 with every panel section | done | One request (A/lexicon.py word_payload); T/test_lexicon_api.py |
| P1.3 `?in_text=` | open | No "In this text" for a word in a hadith, a book or the reader's text |
| P1.3 next steps seeded by word + dataset version | done | A/lexicon.py `_next_steps` (1d1cab6) |
| P1.3a one normalisation spec | done | packages/arabic-spec |
| P1.3a Python + TypeScript, 30 vectors, TypeScript in CI | done | vectors.json, both test suites, .github/workflows/ci.yml |
| P1.3a used by every matcher | done | Search, Ask, the rail, the Notebook and the map's find; the glossary matcher since 918d5bb (W/lib/termDetect.ts: the spec's folding classes, marks and tatweel between letters) |
| P1.3b stable, collision-free slugs | done | P/slugs.py, data/registry/*.tsv, pipeline/tests/test_slugs.py |
| P1.4 OpenSearch in dev and prod | done | docker-compose.yml, infra/compose.prod.yml |
| P1.4 indices from Postgres, counted, aliases flipped | done | A/searchindex.py (eight indices now) |
| P1.4 reindex after each release | done | A/loader.py |
| P1.4 the Arabic analyser follows the spec | done | A/searchindex.py |
| P1.4 falls back to Postgres | done | A/search.py |
| P1.4 ten assertions | done | T/test_search_engine.py |
| P1.5 the design-system audit itself | open | No document records it; the code holds the pieces below |
| P1.5 tokens reconciled with contrast fixes | adapted | Five colours darker than design 02 and a dark amber, for AA (L7); W/app/globals.css:13 still calls them "verbatim values" |
| P1.5 type roles | done | W/lib/fonts.ts; globals.css |
| P1.5 component recipes | done | globals.css |
| P1.5 motion | done | globals.css, reduced motion |
| P1.5 breakpoints 1200/900/390 | done | 900 for the shell, 1200 for the wide reader, 390 as a test width |
| P1.5 accessibility floor | done | Focus ring, skip link, 40/44 px targets, Esc; E/a11y.spec.ts |
| P1.6 shared shell in Arabic | done | W/components/shell/SiteHeader.tsx in (site) and (chrome) |
| P1.6 the nav's labels in order | done | NavLinks.tsx; المعجم · الحديث · الكتب added after «ابحث في المعجم» |
| P1.6 scrolling nav with pinned actions | done | globals.css; NavLinks.tsx |
| P1.6 context strip | done | W/components/home/ContextStrip.tsx |
| P1.6 sign-in | done | W/components/account/AccountButton.tsx |
| P1.6 routes for all 15 screens | done | Every screen a page.tsx under W/app/[locale] |
| P1.6 real URL parameters | adapted | Kept where the design names them; a text's own route for `book`, `/g` and `/embed/g` for the editor's `view`/`embed`, a lesson's `?tab=map` |
| P1.6 written back on every change (SHL-S04) | done | Search, Concordance, Analyser, Notebook, Review, Profile, Data, the lesson, the reader |
| P1.6 old Reader v4 links mapped (SHL-S02) | done | Concordance lines, search rows, context chips |
| P1.7 phone layouts for every screen | done | The header's menu under 900 px, sheets, every spec on a 412 px phone; the no-overflow check in 16 specs |
| P1.7 phone layouts shown to the owner before building | waiting | Not shown before building, except the editor's (P8.6a); each phase's audit carries its 390 px screenshots for the owner's review after the fact |
| P1.7 phone editor (P8.6a) | waiting | Mock-ups with the owner since 2026-10-04 |
| P1.7 44 px targets | adapted | 40 px for controls and 44 px in overlays, per design 02 §2.6; checked for the reader (E/phone-targets.spec.ts) |
| P1.7 dark mode for the eleven screens | done | Dark tokens including amber, dark scrims |
| P1.7a Quran identifiers | done | quran:2:255:3 and its parents |
| P1.7a hadith identifiers | done | hadith:{collection}… |
| P1.7a book identifiers | done | book:{work}; the CTS keys |
| P1.7a dictionary identifiers | open | Articles are integer ids; no `dict:` namespace (B58 proposes `dict:entry`) |
| P1.7a the reader's text identifiers | open | Browser ids only; no `user:` identifier |
| P1.8 editors' footnotes stripped from four tafsirs | done | P/works.py; pipeline/tests/test_works_apparatus.py |
| P1.8 no-pause-marks file, marks file pinned | done | data/sources.yaml |
| P1.8 basmala stripped in the join | done | P/texts.py |
| P1.8 basmala strip with a test | done | pipeline/tests/test_basmala.py (1d1cab6): 112 first verses lose exactly al-Fātiḥa's four words, letter for letter (Tanzil marks 95's apart), and the verses' word counts match the build |
| P1.8 the corpus's Tanzil 1.0.2 labelled | done | P/release.py |
| P1.8 research 02 identifiers corrected | done | docs/research/02 |
| P1.8 tafsirs and translations against their terms | done | P/works.py; research 07 |
| P1.8 every source re-read, clauses verbatim, a test on a missing entry | done | data/licences.yaml; pipeline/tests/test_licences.py; P/licence_check.py |
| P1.8 research 07's engineering fixes | done | The release's copyright block, labels and holds |
| P1.8 the lexica's legal basis | waiting | D22 |
| P1.8 findings put to the owner | waiting | Research 07 under D2/D19/D22 |
| P1.9 every route in both languages and themes at three widths | done | E/routes-sweep.spec.ts (e35a71a): 41 routes × 2 languages × 2 themes × 1440/1024/390 px, 492 pages — status, main landmark, no error boundary, no sideways scroll, the language, the theme after hydration; checked against a missing page |
| P1.9 the word payload carries every section | done | T/test_lexicon_api.py; E/entry-sections.spec.ts |
| P1.9 search assertions green | done | T/test_search_engine.py; E/search.spec.ts |
| P1.9 the P1.8 audit closed | done | Everything fixed or with the owner (the basmala test, 1d1cab6) |

### SHL items

| ID | Status | How |
|---|---|---|
| SHL-D01 | n/a | Prototype seed sizes; the product reads the dataset |
| SHL-D02 | done | Roots with key, letters, spaced, translit, gloss_en, gist_ar, occurrences |
| SHL-D03 | adapted | Root keys are the Arabic letters, Arabic first |
| SHL-D04 | done | Slug, envelope, pos, root, pattern, gloss, senses, frequency |
| SHL-D05 | done | The pattern catalogue |
| SHL-D06 | n/a | Sample-book fixture; the books are P11.3 |
| SHL-D07 | n/a | Sample-Quran fixture; the KFGQPC text is served |
| SHL-D08 | n/a | Sample-hadith fixture; the collections are P11.2 |
| SHL-D09 | n/a | Prototype token encoding; tokens are rows |
| SHL-D10 | done | The shared normalisation spec, which also strips Quranic marks and folds waṣla |
| SHL-D11 | adapted | Corpus analysis for the Quran, the shared rules elsewhere (DECISIONS 2026-10-03, 2026-10-04) |
| SHL-D12 | done | `jadhr-*` stores on storage that never throws |
| SHL-D13 | adapted | One shape for the reading context; what it lacks is SHL-Q09 |
| SHL-01 | done | One header reading one nav list |
| SHL-02 | adapted | 52 px, sticky as the hub's header was (DECISIONS 2026-10-03) |
| SHL-03 | adapted | The mark and «جذر» in Amiri, linking home (D1) |
| SHL-04 | adapted | 15 items: the design's 11, Ask after Read, المعجم · الحديث · الكتب |
| SHL-05 | done | 13.5 px in Arabic; `aria-current` |
| SHL-06 | done | Horizontal scroll with pinned actions |
| SHL-07 | done | SiteHeader.tsx |
| SHL-08 | adapted | Page actions in each page's own title bar (audit 09, LIB-01) |
| SHL-09 | done | Search shows the nav with no item active |
| SHL-10 | done | Segmented control |
| SHL-11 | done | Chips |
| SHL-12 | done | Buttons |
| SHL-13 | adapted | Colours as tokens, darkened for AA |
| SHL-14 | adapted | Links take their recipe's colour, not a global blue |
| SHL-15 | done | Focus ring |
| SHL-16 | done | Label caps |
| SHL-17 | done | Data rendered on the server; an error boundary |
| SHL-18 | adapted | The hub wears the shared header (DECISIONS 2026-10-03) |
| SHL-19 | adapted | Read, Ask, Look up and Graph in the nav; Review a hub tile and a reader button |
| SHL-20 | adapted | The header's search opens the omnibox, with ⌘K and «/» |
| SHL-21 | done | Sign in and the avatar (was "waiting" in audit 10) |
| SHL-22 | done | The context strip, and a "roots due" chip (B30) |
| SHL-23 | bug-fixed | The text chip opens the reader where the reader was |
| SHL-24 | bug-fixed | The word chip opens `/read?w=` |
| SHL-25 | done | The root chip → the concordance |
| SHL-26 | done | `dir="auto"` and `lang` on chips |
| SHL-27 | adapted | Clear forgets the place shown, not the reading (DECISIONS 2026-10-03) |
| SHL-28 | done | Only the hub renders the strip |
| SHL-29 | done | The theme toggle |
| SHL-30 | done | /search wears the shared header |
| SHL-31 | adapted | DECISIONS 2026-10-03 "The hub wears the shared header" |
| SHL-32 | done | Ask in the nav; Search the header button and ⌘K |
| SHL-33 | bug-fixed | No Reader v4 target remains |
| SHL-34 | done | `<html lang dir>` per language; Arabic runs carry `lang="ar"` |
| SHL-35 | done | Esc closes overlays |
| SHL-36 | done | Fonts |
| SHL-37 | done | The menu under 900 px |
| SHL-38 | bug-fixed | The hub has no sideways scroll (E/hub.spec.ts) |
| SHL-39 | done | Dark tokens |
| SHL-40 | adapted | A footer on every page with Contribute and the dataset version; "Audit" and "Explorations" not built (design 01 §1.2) |
| SHL-Q01 | adapted | Arabic RTL by default; the language is the address (/ and /en), not a stored preference (DECISIONS 2026-10-02) |
| SHL-Q02 | done | Logical properties; the few physical ones deliberate (KWIC columns, canvas corners) |
| SHL-Q03 | done | المعجم · الحديث · الكتب in the nav |
| SHL-Q04 | done | Fonts per script |
| SHL-Q05 | open | No digits preference: digits follow the language (W/lib/format.ts); the server renders numbers, and with no cookie it cannot know a preference before the page is drawn |
| SHL-Q06 | done | The toggle and one theme key before paint; the embed from its address |
| SHL-Q07 | done | The header omnibox adds the dictionary's roots, the hadith, the books' paragraphs and the reader's own texts (8e311ad; E/omnibox.spec.ts) |
| SHL-Q08 | done | The header's parts |
| SHL-Q09 | done | A word looked up in a hadith or a book carries its place; the hub's strip leads back to it when newer than the last verse read (df469d3; E/hadith.spec.ts) |
| SHL-Q10 | open | Everything the item lists exists but the digits preference (SHL-Q05) |
| SHL-F01 | done | The nav's scroll |
| SHL-F02 | done | `aria-current` |
| SHL-F03 | done | One theme key for the site, the reader and the editor; default light |
| SHL-F04 | done | Every hub tile answers under 400; unknown paths a real 404 |
| SHL-F05 | done | Storage that never throws; a warning when it fails |
| SHL-F06 | done | Matching by the spec; display vowelled |
| SHL-F07 | done | Arabic and glosses in separate elements |
| SHL-F08 | done | `dir="auto"` on the hub field, Search, the chips, the reader's omnibox and now the header omnibox (1d1cab6) |
| SHL-F09 | done | The seed codec |
| SHL-S01 | done | The study deck |
| SHL-S02 | done | Old Reader v4 links mapped |
| SHL-S03 | done | Dark, theme, lang, Esc and phone on the research screens |
| SHL-S04 | done | URL write-back |
| SHL-S05 | bug-fixed | ة/ى/ؤ/ئ folding in search |
| SHL-S06 | bug-fixed | A real pattern filter in the concordance |

## 3. Report 3 — the `{full, bare, translit}` envelope

Where it exists: `lexicon.ar()` wraps the lemma, its pattern and the occurrence's surface in the word payload, family members and same-pattern words, the pattern next step, /patterns, search patterns, collections and review. What is plain: the occurrence's standard spelling, sūra names, the dictionaries' headwords and titles, the timeline's titles, Postgres word hits (a different shape from OpenSearch's), the root map's patterns (`{full, translit}` without `bare`), concordance lines, the Analyser's tokens, the texts' payloads (hadith, books, dictionary), topics and names, and the public API. The vowel-marks switch (D7) does not need the field: the browser takes the marks off with the shared spec's `displayBare`. The envelope remains the design's contract for the API's consumers.

## 4. Noticed, not acted on

- The Quran's 77,429 generic-model token rows are loaded and read by no endpoint.
- Data & API has no hub tile of its own (the "API" tile goes to /developers).
- The footer credits only the Quran-side sources, not the dictionaries, the hadith or the books.
- The numbers' font (IBM Plex Mono) is loaded in Latin only; Arabic-Indic digits styled with it fall back to another font.
