# 09 · Research screens coverage — Search, Concordance, Analyser and Library against the built code

Audited 2026-10-03 against commit `40601be` (branch `build/vision`; read in the worktree branch `worktree-agent-a8ce9f23ab1344df8` at the same commit, no other change). Scope: every item of `docs/research/05-design-inventory.md` Part 3 for the four research screens of phase P4 — Library (LIB, §4), Search (SRC, §5), Concordance (CON, §6), Analyser (ANA, §7) — with each section's Quran adaptation notes (LIB-Q, SRC-Q, CON-Q, ANA-Q) and the screens' hard-won fixes in §8 (LIB-F, SRC-F, CON-F, ANA-F), which PLAN §7 counts in the 219 items of P4; judged with PLAN §4 (D1–D29), the PLAN P4 section and `docs/DECISIONS.md`. The shared-shell items these screens depend on are listed after the open items.

**Method.** Read in full: inventory Part 3 §0, §1, §4–§9; PLAN §0, §3, §5, P4 and §7; DECISIONS; research 08 (the model for this report); every file in `apps/web/src/components/search/`, `concordance/`, `analyse/`, `library/`; their routes under `apps/web/src/app/[locale]/(site)/` (search, concordance, analyse, library, library/text/[id]) and the site layout; `components/shell/` and `components/ui/Dialog.tsx`, `Segmented.tsx`; `lib/analyse.ts`, `lib/concordance.ts`, `lib/library/*`, `lib/graph/seedCodec.ts`, `lib/store/analyseChoices.ts`, `lib/format.ts`; the research-screen rules of `apps/web/src/app/globals.css`; the `search`, `concordance`, `analyse`, `library` and `nav` namespaces of `messages/ar.json` and `en.json`; the API modules `search.py`, `search_os.py`, `concordance.py`, `analyse.py` and the routes of `main.py`; the e2e specs search, concordance, analyse, library and a11y. Read in part: `content.py` (roots list, root resolution), `lexicon.py` (texts), `searchindex.py` (mappings, documents), `packages/arabic-py` (`normalize.py`, `roots.py`), `lib/reader/store.ts`, `reader5/Overlays.tsx` (the reader's omnibox), `reader5/AskView.tsx`, `pipeline/.../build.py` (how root letters are stored), the API tests `test_search_engine.py` and `test_analyse.py`. Nothing was run — no server, build or test — and nothing was fetched. Evidence is a file and line read in this audit, or the title of a test that exercises the item; a test title shows the coverage exists, not that it passed today. Every count below is computed from the item rows, and the rows were checked one to one against the inventory's own IDs for the four prefixes.

**Status rules** (research 08's, unchanged). `done` — built as the design says, or better. `adapted` — built differently on purpose, with the reason named (a decision, a Quran note, or a plain reason). `bug-fixed` — a defect the inventory flags (BUG) that our build fixes or cannot have. `n/a` — cannot apply to the Quran product (prototype seed outputs, the heuristic analyser the corpus replaces). `open` — not built, or built only in part; the row names the missing part. `owner` — needs the product owner's decision. A missing function, state, control, data field or accessibility property makes an item `open`; pixel sizes, colours and copy wording do not (every string is rewritten in Arabic by design). Items for texts not yet loaded (hadith, books — P11) are `open` with that phase, not `n/a`. "(minor)" marks a small open item.

**Paths.** Bare component names are in `apps/web/src/components/{search,concordance,analyse,library}/`; `shell/`, `ui/` and `reader5/` are in `apps/web/src/components/`; `lib/…` is `apps/web/src/lib/…`; route files (`search/page.tsx` …) are under `apps/web/src/app/[locale]/(site)/`; `globals.css` is `apps/web/src/app/globals.css`; `*.py` files are in `services/api/src/jadhr_api/` unless a path is given; `normalize.py` and `roots.py` are in `packages/arabic-py/src/jadhr_arabic/`. Quoted e2e titles come from `apps/web/e2e/*.spec.ts`.

> **Since this audit (2026-10-03):** every group A item and every fault below has been built and tested (commits from `b17160c` to `8966f04` on `build/vision`; PLAN P4.5). Group B stands as listed. The tables below are the audit as it was found.

## Summary

| Status | Items |
|---|---|
| done | 125 |
| adapted | 37 |
| bug-fixed | 15 |
| n/a | 3 |
| open | 39 |
| owner | 0 |
| **total** | **219** |

Closed (done + adapted + bug-fixed + n/a): 180 of 219. Open: 39 — 22 buildable in these screens now (group A), 17 waiting on other phases or content (group B: P7, P11, P11.2, P11.3a). Owner: 0.

| Screen | Items | done | adapted | bug-fixed | n/a | open | owner | closed |
|---|---|---|---|---|---|---|---|---|
| Search | 53 | 26 | 10 | 2 | 1 | 14 | 0 | 39 of 53 |
| Concordance | 54 | 32 | 6 | 6 | 1 | 9 | 0 | 45 of 54 |
| Analyser | 53 | 32 | 10 | 2 | 1 | 8 | 0 | 45 of 53 |
| Library | 59 | 35 | 11 | 5 | 0 | 8 | 0 | 51 of 59 |
| **Total** | **219** | **125** | **37** | **15** | **3** | **39** | **0** | **180 of 219** |

| § | Inventory section | Items | done | adapted | bug-fixed | n/a | open | owner |
|---|---|---|---|---|---|---|---|---|
| 5.1 | Search — Header and detection bar (SRC-01…11) | 11 | 3 | 6 | 1 | 0 | 1 | 0 |
| 5.2 | Search — Facet sidebar (SRC-12…16) | 5 | 2 | 0 | 0 | 0 | 3 | 0 |
| 5.3 | Search — Results (SRC-17…26) | 10 | 3 | 1 | 1 | 0 | 5 | 0 |
| 5.4 | Search — States (SRC-27…30) | 4 | 1 | 2 | 0 | 1 | 0 | 0 |
| 5.5 | Search — URL, persistence, keyboard (SRC-31…33) | 3 | 2 | 0 | 0 | 0 | 1 | 0 |
| 5.6 | Search — Phone and dark mode (SRC-34…35) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 5.7 | Search — Cross-check against 05 §5.2, 08 §8.3, 09 (SRC-36…43) | 8 | 6 | 1 | 0 | 0 | 1 | 0 |
| 5.8 | Search — Quran adaptation notes (SRC-Q01…Q07) | 7 | 4 | 0 | 0 | 0 | 3 | 0 |
| 8 | Search — Hard-won fixes (SRC-F01…F03) | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| | **Search subtotal** | **53** | **26** | **10** | **2** | **1** | **14** | **0** |
| 6.1 | Concordance — Header and filter bar (CON-01…05) | 5 | 3 | 1 | 0 | 0 | 1 | 0 |
| 6.2 | Concordance — KWIC view (CON-06…19) | 14 | 9 | 2 | 3 | 0 | 0 | 0 |
| 6.3 | Concordance — Distribution view (CON-20…25) | 6 | 3 | 1 | 2 | 0 | 0 | 0 |
| 6.4 | Concordance — Export (CON-26…27) | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| 6.5 | Concordance — Data, URL, persistence, keyboard (CON-28…32) | 5 | 2 | 1 | 0 | 1 | 1 | 0 |
| 6.6 | Concordance — Phone and dark mode (CON-33…34) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 6.7 | Concordance — Cross-check against 05 §5.3, 08, 09 (CON-35…39) | 5 | 2 | 1 | 0 | 0 | 2 | 0 |
| 6.8 | Concordance — Quran adaptation notes (CON-Q01…Q09) | 9 | 4 | 0 | 0 | 0 | 5 | 0 |
| 8 | Concordance — Hard-won fixes (CON-F01…F06) | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| | **Concordance subtotal** | **54** | **32** | **6** | **6** | **1** | **9** | **0** |
| 7.1 | Analyser — Header and input (ANA-01…06) | 6 | 3 | 3 | 0 | 0 | 0 | 0 |
| 7.2 | Analyser — Table view (ANA-07…24) | 18 | 11 | 4 | 1 | 1 | 1 | 0 |
| 7.3 | Analyser — Interlinear view (ANA-25…27) | 3 | 2 | 0 | 0 | 0 | 1 | 0 |
| 7.4 | Analyser — Export (ANA-28…30) | 3 | 1 | 0 | 1 | 0 | 1 | 0 |
| 7.5 | Analyser — URL, persistence, keyboard, states (ANA-31…34) | 4 | 3 | 1 | 0 | 0 | 0 | 0 |
| 7.6 | Analyser — Phone and dark mode (ANA-35…36) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 7.7 | Analyser — Cross-check against 05 §5.4, 08 §8.3, 09 §9.5 (ANA-37…41) | 5 | 4 | 1 | 0 | 0 | 0 | 0 |
| 7.8 | Analyser — Quran adaptation notes (ANA-Q01…Q07) | 7 | 3 | 0 | 0 | 0 | 4 | 0 |
| 8 | Analyser — Hard-won fixes (ANA-F01…F05) | 5 | 3 | 1 | 0 | 0 | 1 | 0 |
| | **Analyser subtotal** | **53** | **32** | **10** | **2** | **1** | **8** | **0** |
| 4.1 | Library — Header and filter (LIB-01…02) | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| 4.2 | Library — Continue (LIB-03…05) | 3 | 2 | 0 | 1 | 0 | 0 | 0 |
| 4.3 | Library — Shelf (LIB-06…16) | 11 | 6 | 1 | 3 | 0 | 1 | 0 |
| 4.4 | Library — Add-a-text sheet (LIB-17…36) | 20 | 12 | 4 | 1 | 0 | 3 | 0 |
| 4.5 | Library — States, URL, persistence, keyboard (LIB-37…40) | 4 | 2 | 1 | 0 | 0 | 1 | 0 |
| 4.6 | Library — Phone and dark mode (LIB-41…42) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 4.7 | Library — Cross-check against 05 §5.1 and 10 §3 (LIB-43…48) | 6 | 4 | 2 | 0 | 0 | 0 | 0 |
| 4.8 | Library — Quran adaptation notes (LIB-Q01…Q08) | 8 | 5 | 0 | 0 | 0 | 3 | 0 |
| 8 | Library — Hard-won fixes (LIB-F01…F03) | 3 | 2 | 1 | 0 | 0 | 0 | 0 |
| | **Library subtotal** | **59** | **35** | **11** | **5** | **0** | **8** | **0** |
| | **Total** | **219** | **125** | **37** | **15** | **3** | **39** | **0** |

## Defects found while auditing

Beyond parts not yet built, reading the code found these faults in what is built:

- **A pattern result leads back to itself, and no search lists a pattern's words** (SRC-20, SRC-22): a pattern row links to `/search?q={pattern}` (SearchScreen.tsx:340); that search finds the same pattern again, and its words query looks at word forms and lemmas only (search_os.py:36-60), never at the `pattern_slug` every word carries in the index (searchindex.py:106). The reader's omnibox opens Shapes on the pattern (reader5/Overlays.tsx:127-137); the search page does not.
- **The root builder cannot find hamza roots** (SRC-15): each box keeps the letter as typed (SearchScreen.tsx:135) and `/roots?l1…` compares it with the stored radicals unfolded (content.py:453-456), while radicals are stored as ء and ي (roots.py:4, 31; `pipeline/src/jadhr_pipeline/build.py:356`). So أ، إ، آ، ؤ، ئ — the way a hamza radical is usually typed, and the way the product itself writes it («أ م ن») — and a final ى return no root. With a query present, a matched root survives only if it is among the 60 most frequent roots with those letters (SearchScreen.tsx:83, 117-122).
- **Search counts and lists stop at the request limit** (SRC-12, SRC-21, SRC-23): the page asks the API for 30 results per kind (SearchScreen.tsx:74), shows each kind's count as the number that came back and sums them into "{n} results" (126-127, 218), then lists 20 ayat, 12 words, 6 roots and 6 patterns (272, 293, 322, 338) with nothing leading further. A common word reads "30 ayat" whatever the true number.
- **The Analyser reads punctuation as part of the word** (ANA-F05): tokens are whitespace runs (analyse.py:68, 317) and the matching key is `normalize`, which strips marks and folds letters but keeps punctuation (normalize.py:92-94). «بالتعلم.» or «العلمَ،» comes back "no Quranic word matches it", and a Quranic phrase pasted with a comma is not placed in its verse (analyse.py:270-293). The Library takes edge punctuation off before it calls the API (lib/library/segment.ts:7, 32-37); the Analyser's own endpoint does not.
- **Verb readings after the article** (ANA-F05, minor): once «ال» is taken off, every content reading of the stem is kept, verbs included (analyse.py:203-207), though a word with the article cannot be a verb.
- **CoNLL-U is not UD-tokenised** (ANA-Q06, ANA-30): DECISIONS says the export "follows UD Arabic", but words go out whole, with no multiword-token ranges for their clitics, and participles go out as NOUN or ADJ with no `VerbForm=Part` (lib/analyse.ts:47-64, 101-115).
- **Pending words share one React key** (the reader's text page, minor): `read.data?.[i++]` short-circuits while the analysis loads, so `i` stays 0 and every pending word gets `key={0}` (UserTextReader.tsx:101-104).
- **Two "known" measures on one shelf** (LIB-11, LIB-Q04, minor): the Quran card counts every lemma marked known against all 4,832 lemmas, particles and pronouns included (LibraryScreen.tsx:41, 109; lexicon.py:550), while a reader's text counts content lemmas only (AddTextSheet.tsx:71-72).
- **The Postgres fallback is a different search** (SRC-40): when OpenSearch is down, Latin queries are a substring match on transliterations that carry macrons, so «kitab» finds nothing (search.py:306-328); a root query returns the root without its family (search.py:243-251); patterns and highlighted passages are absent. The response names the engine (search.py:203) but the screen does not tell the reader.
- **Latin digits in the Arabic UI** (SHL-Q05, minor): verse keys and Quran locations print in Latin digits on all four screens (SearchScreen.tsx:282; ConcordanceScreen.tsx:276; AnalyseScreen.tsx:128 through the message's `{ref}`, and 284) while counts use Arabic-Indic digits and `verseRef` exists for this (lib/format.ts:10-12).
- **No axe run on the Analyser or the Library** (apps/web/e2e/a11y.spec.ts:4, 20): the axe pages include `/search` and `/concordance` in both themes but not `/analyse`, `/library` or `/library/text/{id}`, which PLAN's UI rule requires.
- **Stale PLAN lines** (not edited here): §3.2 marks Library ⬜ ("Shelf, continue, add text") and Analyser ⬜ though both are built (their P4.3 and P4.4 status lines say so), and Search 🟡 "Missing: kinds with counts, sources filter, root builder in the sidebar, patterns as results, design layout" though all five shipped in `0f73246`; the P4 heading is still ⬜ and P4.1 has no status line.
- **Noticed outside these screens** (not counted): the reader still has no Analyse verse tool and Ask no "Analyse it anyway" path (RDR-150, RDR-172) — research 08 placed both on P4.3, which has shipped, and no `/analyse` link exists outside the Analyser and the Library; the site-wide omnibox lists no patterns (search/Omnibox.tsx:34-84) where the reader's omnibox does.

## Open and owner items

No item needs an owner decision. Group A is work in these four screens and their API that can be built now; group B waits on a later phase the approved plan already names, and goes before the owner at the P4.5 checkpoint ("inventory sections closed") as exceptions with their phase.

### A · Buildable now in these screens — 22 items

| ID | Missing | Files it would touch | Waits on |
|---|---|---|---|
| SRC-09 | a pattern class in detection («maf3uul», «مَفْعُول» → "pattern {wazn}") | search.py:43-54, 92-136 (match the patterns table by transliteration and bare form); SearchScreen.tsx:33-43 (note) | now |
| SRC-12 | counts of the matches, not of the 30 results fetched per kind | search_os.py (OpenSearch `hits.total` per kind); search.py (a count per kind); SearchScreen.tsx:126-127 | now |
| SRC-15 | hamza seats and ى folded to the stored ء and ي; letters narrowing Words; no top-60 cut when a query is present | SearchScreen.tsx:80-88, 117-122, 134-140; content.py:443-469 (fold as roots.py:31 does) | now |
| SRC-18 | each root's meaning: the Arabic core idea, which exists | search.py:139-144 and search_os.py:194-200 (select `gist_ar`); SearchScreen.tsx:319-334 | now (English gloss: P3.4) |
| SRC-20 | a pattern row that leads to its words (Shapes on the pattern, as the reader's omnibox does), not to a search for itself | SearchScreen.tsx:340; reader5/Overlays.tsx:127-137 (the same path) | now (function text: P3.3) |
| SRC-21 | the words beyond the first 12; the "words on this pattern" state | SearchScreen.tsx:290-318 | now |
| SRC-22 | a pattern query that returns the words on the pattern | search_os.py:149-179 (a `pattern_slug` terms query when the query names a pattern); SearchScreen.tsx | now |
| SRC-23 | the ayat beyond 20, and "open as concordance" | SearchScreen.tsx:269-289; main.py:630-640 (an offset) | now |
| SRC-31 | the kinds and the root letters in the URL | SearchScreen.tsx:67-68, 90-96; search/page.tsx | now |
| SRC-41 | a pattern class; transliteration and English gloss told apart | search.py:43-54, 92-136 | now |
| SRC-Q01 | a range's verses listed and opened | search.py:231-238; SearchScreen.tsx:110-112, 129-130 | now |
| SRC-Q03 | dictionary entries (the index exists); the reader's own texts as a source | search_os.py:159-179 (query `dict_articles`); SearchScreen.tsx (a group per kind); lib/library/texts.ts (search in the browser) | now (hadith, books: P11) |
| CON-Q03 | a sūra range and a juzʾ range | ConcordanceScreen.tsx:191-208; concordance.py:39-50; main.py:436-457 | now (corpus: P11) |
| CON-Q08 | the stored morphological features in the CSV | concordance.py:298-333 (`w.features`) | now |
| ANA-22 | the phrase as a sentence card in the graph seed | AnalyseScreen.tsx:77-86; lib/graph/seedCodec.ts:10-14; lib/graph/seed.ts | now |
| ANA-25 | a transliteration line in the interlinear view | analyse.py:78-94, 233-241 (`w.translit`); AnalyseScreen.tsx:155-169 | now |
| ANA-30 | `VerbForm=Part` for participles | lib/analyse.ts:56-78 | now |
| ANA-Q06 | UD multiword tokens for clitics | lib/analyse.ts:101-115 (segments → ranges); lib/analyse.test.ts | now |
| ANA-F05 | punctuation taken off before a word is read; no verb reading after the article | analyse.py:68-75, 116-128, 203-216 | now |
| LIB-13 | a reading position for the reader's own texts, and their bar | UserTextReader.tsx; lib/reader/store.ts:380 (setProgress by text id); LibraryScreen.tsx:198-214 | now |
| LIB-39 | loading and error states for the sūra list and the reader's shelf | LibraryScreen.tsx:35-36, 114-158 | now |
| LIB-Q01 | a juzʾ, ḥizb and page entry into the Quran from the Library | LibraryScreen.tsx:133-158; `/divisions` (main.py:265-269) | now |

### B · Waiting on other phases or content — 17 items

| ID | Missing | Files it would touch | Waits on |
|---|---|---|---|
| SRC-13 | hadith and book sources | SearchScreen.tsx:154-162; search_os.py | P11 |
| SRC-Q07 | hadith and book passage indices | searchindex.py | P11 |
| CON-03 | the Texts filter | ConcordanceScreen.tsx; concordance.py | P11 |
| CON-28 | other texts and the reader's own texts in the corpus | concordance.py; text model | P11 |
| CON-37 | distribution per text and per era | concordance.py:232-295; ConcordanceScreen.tsx:371-464 | P11 |
| CON-38 | the Texts filter | as CON-03 | P11 |
| CON-Q04 | the historical-era view | concordance.py; ConcordanceScreen.tsx | P11 |
| CON-Q06 | hadith matn/isnād, collection and grade filters | concordance.py; hadith model | P11.2 |
| CON-Q09 | hadith structure | hadith model | P11.2 |
| ANA-Q04 | choices fed to review and proposals | lib/store/analyseChoices.ts; review API | P7 |
| ANA-Q05 | hadith phrases among the Try chips | AnalyseScreen.tsx:18 | P11.2 |
| ANA-Q07 | a morphology service for non-Quranic Arabic | analyse.py; a service (D28) | P11 |
| LIB-22 | URL import | AddTextSheet.tsx; intake pipeline | P11.3a |
| LIB-23 | PDF and photo import with preview-and-correct | AddTextSheet.tsx; intake pipeline (D9a) | P11.3a |
| LIB-36 | the reader's texts in the reader's rail and the concordance | reader5/Rail.tsx; concordance | P11 |
| LIB-Q02 | hadith and book shelves | LibraryScreen.tsx; `/texts` | P11.2, P11.3 |
| LIB-Q08 | hadith and book structure in the catalogue | lexicon.py:544-566; text model | P11 |

## Shared-shell items these screens depend on that look open

Read against `components/shell/`, the site layout and the four screens; not a full SHL audit (that is P1.6's inventory).

| ID | What looks open | Evidence | Waits on |
|---|---|---|---|
| SHL-32 | No Ask in the nav; Search only as the header's search button, though the research screens hand off to both (SRC-39, the omnibox) | shell/NavLinks.tsx:8-20; shell/SiteHeader.tsx:21 | now |
| SHL-34 | (minor) One Arabic run without `lang` in the English UI: the sūra name in a search verse row | SearchScreen.tsx:283 | now |
| SHL-Q03 | No Dictionary, Hadith or Books in the nav | shell/NavLinks.tsx:8-20 | P11 |
| SHL-Q05 | No digits preference: numbers follow the UI language, and verse keys print in Latin digits in the Arabic UI (defects) | lib/format.ts:1-12 | now |
| SHL-Q07 | The site omnibox has no patterns (the reader's has) and no other corpora | search/Omnibox.tsx:34-84 | now (corpora: P11) |
| SHL-Q09 | The cross-page context holds word, root and verse but no corpus or text id; the concordance reads its root | lib/reader/store.ts:330; ConcordanceScreen.tsx:38-40 | P11 |
| SHL-Q10 | The digits preference (SHL-Q05); auth state | lib/format.ts:1-12 | now; P6 |
| SHL-S04 | Search's kinds and root letters are not in the URL; the Concordance and the Analyser write theirs | SearchScreen.tsx:90-96 | now |

Checked and built: SHL-29 and SHL-Q06 theme toggle on the shared `jadhr-theme` (shell/ThemeToggle.tsx); SHL-30 and SRC-42 the nav on Search; SHL-33 and SHL-S02 every Reader link mapped to our routes; SHL-Q01 `lang` and `dir` on `<html>` (app/[locale]/layout.tsx:52) and `lang` on the Arabic runs of these screens but the one above — the language switch is a link between `/` and `/en` rather than a stored preference, by the decision that keeps Arabic URLs canonical (DECISIONS 2026-10-02); SHL-35 Esc on every modal (ui/Dialog.tsx:38-43; shell/MobileMenu.tsx:20-26; search/Omnibox.tsx:110); SHL-36 and SHL-Q04 fonts; SHL-37 and SHL-Q08 the phone header (nav hidden below 900px, a menu instead); SHL-39 and SHL-S03 dark tokens on all four screens; SHL-F01 and SHL-F02 the scrolling nav with pinned actions and `aria-current`; SHL-F09 seeds as UTF-8 base64url (lib/graph/seedCodec.ts:20-28); SHL-S05 and SHL-S06 (SRC-40, CON-36).

## All items

### Search

| ID | status | evidence / reason |
|---|---|---|
| SRC-01 | adapted | The shared header (SRC-42) instead of a bespoke one; the page's search bar holds the icon, an input with `dir="auto"` and a label, a placeholder, and the live total (SearchScreen.tsx:198-219) |
| SRC-02 | adapted | Results follow typing after 160 ms (one server query per pause) and the address bar follows every change, not only Enter (SearchScreen.tsx:66, 72-78, 90-96); Enter on a reference opens it (SRC-05) |
| SRC-03 | done | "Understood as" + pill + note from the API's `detected` (SearchScreen.tsx:220-229; search.py:330-334); a root pill in the root colour (globals.css:2248-2259); e2e "search: what the query was understood as, and Enter on a reference goes to the verse (SRC-03/05, SRC-Q01)" |
| SRC-04 | done | "—" and "type a query" (SearchScreen.tsx:222-223) |
| SRC-05 | bug-fixed | «رقم آية», "press Enter to go to the verse", a "Go to {ref}" button, and Enter navigates (SearchScreen.tsx:129-130, 198-205, 224-228); same e2e as SRC-03 |
| SRC-06 | adapted | Letters typed apart («ك ت ب», 2–5 single letters) are a root, noted "also matches every word built on it" (search.py:123-128); three letters written together are read as a word, and the root of those letters is listed too (search.py:283-297) |
| SRC-07 | adapted | "Arabic word" / "Arabic phrase", noted "diacritics and hamza spelling ignored" (search.py:129-131; SearchScreen.tsx:39-40); a vowelled query is not labelled as such but ranks its exact form first (search.py:171-185; services/api/tests/test_search_engine.py:54) |
| SRC-08 | done | `r-h-m` (Latin letters, ʿ/ʾ) → root, every existing reading listed (search.py:132-135, 243-251); e2e "search: transliterated root" |
| SRC-09 | open | (minor) Chat input is folded (3→ʿ, doubled vowels long, search.py:57-67) and patterns match by transliteration (search_os.py:72-81, 144-148), but detection has no pattern class: «maf3uul» is "Latin text" and «مَفْعُول» "Arabic word" (search.py:43-54, 92-136) |
| SRC-10 | adapted | One class, "Latin text", noted "searches transliteration and English glosses" (search.py:136; SearchScreen.tsx:41) |
| SRC-11 | adapted | Same class as SRC-10 |
| SRC-12 | open | Five kinds (ayat, words, roots, patterns, sūras) as checkboxes, counts shown while unchecked (SearchScreen.tsx:146-152). Each count is of the results fetched — the page asks for 30 per kind (SearchScreen.tsx:74, 126) — not of the matches (defects) |
| SRC-13 | open | One source, the Quran, with its count; it toggles the ayat (SearchScreen.tsx:154-162); hadith and books are said to come later (P11) |
| SRC-14 | done | Three boxes, Amiri 18px, `dir="rtl"`, `lang="ar"`, placeholder "·", labelled «الحرف ١/٢/٣»; each keeps the last letter typed (SearchScreen.tsx:134-138, 163-192; globals.css:2294-2307) |
| SRC-15 | open | Positional, as the spec asks (SRC-37), through `/roots?l1&l2&l3` (main.py:396-411). Missing: a hamza radical typed on its seat (أ إ آ ؤ ئ) or a final ى finds nothing — the boxes send the letter as typed and roots store ء and ي (SearchScreen.tsx:135; content.py:453-456; packages/arabic-py/src/jadhr_arabic/roots.py:4, 31); the letters narrow Roots only, not Words; with a query and one or two letters, a matched root outside the 60 most frequent with those letters is dropped (SearchScreen.tsx:83, 117-122) |
| SRC-16 | done | Letters with no query list the roots only (SearchScreen.tsx:118-122, 239, 322) |
| SRC-17 | adapted | Ayat first, then Words, Roots, Patterns, Sūras (SearchScreen.tsx:269-365) — SRC-Q03's Quran-first order |
| SRC-18 | open | Rows: spaced root, transliteration, occurrences, → `/concordance?root=`; group link to the concordance (SearchScreen.tsx:319-334). Missing: what the root means — no English gloss yet (P3.4), and the Arabic core idea that exists (`gist_ar`, P3.4) is neither sent nor shown (search.py:139-144; search_os.py:194-200) |
| SRC-19 | done | Roots index on normalised Arabic (with prefix), transliteration and English gloss; plus the roots of the words found and of the typed letters (search_os.py:63-69, 188-201; search.py:283-297) |
| SRC-20 | open | Row: pattern, transliteration, "{n} words" (SearchScreen.tsx:335-350). The row links to `/search?q={pattern}` (line 340), which returns the same pattern again — its words are never reached (defects); the reader's omnibox opens Shapes on the pattern instead (reader5/Overlays.tsx:127-137). No function text (P3.3) |
| SRC-21 | open | (minor) Up to 12 words: dot, Arabic, transliteration · part of speech (Arabic UI) or gloss (English UI), the root in Amiri; → the entry `/read?w=` (SearchScreen.tsx:290-305); word forms as chips (306-316). Missing: a way to the rest when more come back (the header counts up to 30, line 291); the "words on this pattern" state (SRC-22) |
| SRC-22 | open | Matching on form, lemma, transliteration and English, with the article or a conjunction taken off (search_os.py:36-60); a root returns its whole family (search_os.py:151-157; services/api/tests/test_search_engine.py:59). Missing: a pattern query does not return the words on that pattern — the words index carries `pattern_slug` (searchindex.py:106) and no query reads it |
| SRC-23 | open | (minor) Ayat with the keyword marked, the verse key and sūra, → `/quran/{s}/{a}` (SearchScreen.tsx:269-289); e2e "search: live results, kind facets with counts, and hiding a kind removes it from the total (SRC-12/26)" checks the `<mark>`. Missing: only 20 of up to 30 fetched are listed, with no paging and no "open as concordance" link |
| SRC-24 | done | Passages matched on imlāʾī and Uthmani text and the English translation (search_os.py:84-97); a reference pins its verse (SearchScreen.tsx:110-112); the reader's texts are not searched, as in the design (their part is SRC-Q03) |
| SRC-25 | done | One-line rows, 44px, Arabic min-width 80px, ellipsised secondary text, auto-fill grids of 260px, ayat full width (globals.css:2319-2343; SearchScreen.tsx:292-301) |
| SRC-26 | bug-fixed | The total sums only the kinds shown (SearchScreen.tsx:127); same e2e as SRC-23 |
| SRC-27 | adapted | Detection "—" / "type a query", a hint and seven example queries as chips instead of an empty root list (SearchScreen.tsx:32, 239-250) |
| SRC-28 | adapted | "Nothing matches «q»" with what to try, and Ask mode with the query (SearchScreen.tsx:261-268; SRC-39) |
| SRC-29 | n/a | The prototype's outputs on its six-root seed. The Quran's equivalents are the API assertions (services/api/tests/test_search_engine.py) and the e2e "search: Arabic without marks", "… pasted from the mushaf", "… root letters", "… transliterated root", "… verse reference", "… English meaning" |
| SRC-30 | done | Loading skeleton, error with retry, `aria-busy` (SearchScreen.tsx:238, 251-260) |
| SRC-31 | open | (minor) `?q=` read on the server and written on every change (search/page.tsx:20-21; SearchScreen.tsx:90-96); the kinds and the root letters are not in the URL (SHL-S04) |
| SRC-32 | done | Nothing stored |
| SRC-33 | done | Enter submits; letter boxes advance on typing and step back on Backspace (SearchScreen.tsx:139, 174-176); e2e "search: the root builder is positional, first radical on the right (SRC-14/37, SRC-Q04)" |
| SRC-34 | done | Below 900px the facets fold behind a "Filters" button and results take the width (globals.css:2344-2361; SearchScreen.tsx:230-237) |
| SRC-35 | done | Tokens only; theme toggle in the shared header (shell/ThemeToggle.tsx); e2e "axe dark: /search?q=صبر" |
| SRC-36 | adapted | Checkboxes kept, as the inventory advises, for their counts and native semantics |
| SRC-37 | done | Positional with the first radical in the right-hand box, advance and Backspace (SRC-14, SRC-33); letter folding is SRC-15 |
| SRC-38 | done | `<mark>` around the keyword from the index's highlight, bidi-safe markers (SearchScreen.tsx:45-53, 278; search_os.py:166-178) |
| SRC-39 | done | Empty → «اسأل عنها في وضع السؤال», `/read?mode=ask&q=` (SearchScreen.tsx:265), read by Ask (reader5/AskView.tsx:32); e2e "search: an empty result offers Ask mode (SRC-39)" |
| SRC-40 | done | On the OpenSearch engine: vocalised ↔ bare, Latin without diacritics, hamza variants, exact form first, root → family (services/api/tests/test_search_engine.py:38-63), with ة/ى/ؤ/ئ folded (normalize.py:54-70). The Postgres fallback fails two of the five (defects) |
| SRC-41 | open | (minor) `detected` comes back with Arabic and English labels (search.py:330-334); classes verse reference, juzʾ/ḥizb/page, sūra, root, Arabic word/phrase, Latin (search.py:43-54) — no pattern class, and transliteration and English gloss are one class |
| SRC-42 | done | Shared header with the nav (app/[locale]/(site)/layout.tsx:10-16; shell/SiteHeader.tsx:10-31) |
| SRC-43 | done | The Source facet with its count (SearchScreen.tsx:156-160); further sources are SRC-13 |
| SRC-Q01 | open | (minor) Parses `2:255`, Arabic-Indic digits, sūra names in Arabic, transliteration or English with an āya, juzʾ/ḥizb/page, and ranges (search.py:24-41, 92-122); Enter or the button goes there (SRC-05). A range lists and opens only its first verse (search.py:231-238) |
| SRC-Q02 | done | Uthmani marks, ٱ, small letters and waqf signs stripped; mushaf text matched on its own shadow (search.py:218-219; normalize.py:31-94, 105-129); e2e "search: Arabic pasted from the mushaf" |
| SRC-Q03 | open | Ayat first, Words, Roots, Patterns, Sūras (SearchScreen.tsx:30, 269-365). Missing: dictionary entries — the `dict_articles` index is built (searchindex.py:131-135, 308-324) but never queried (search_os.py:159-179); the reader's own texts as a source (in the browser, lib/library/texts.ts); hadith and book passages (P11) |
| SRC-Q04 | done | First box on the right in an RTL group, advance in logical order; the main box takes root letters with or without spaces or hyphens (SearchScreen.tsx:165; search.py:123-135, 283-286); e2e as SRC-33 |
| SRC-Q05 | done | «فُهِم على أنه» with Arabic labels, English in the English UI; sūra names recognised (search.py:43-54, 76-89, 114-122) |
| SRC-Q06 | done | English searched in Saheeh International (QuranEnc, re-publishable) with highlights; Latin folding and the chat alphabet (search_os.py:38-47, 84-89; search.py:57-67); e2e "search: English meaning" |
| SRC-Q07 | open | Words, roots, patterns, passages, per-occurrence and dictionary indices, sūra names, translations, the letters endpoint and the classifier exist (searchindex.py:102-137; main.py:396-411; search.py:92-136). Hadith and book passage indices wait on P11 |
| SRC-F01 | done | See SRC-03 |
| SRC-F02 | done | The root in Amiri in each word row (SearchScreen.tsx:301) |
| SRC-F03 | done | 3→ʿ, 2→ʾ, 7→ḥ, doubled vowels long (search.py:57-67), patterns matched on transliteration (search_os.py:72-75); services/api/tests/test_search_engine.py:101 |

### Concordance

| ID | status | evidence / reason |
|---|---|---|
| CON-01 | adapted | «الفهرس السياقي» active in the shared nav (shell/NavLinks.tsx:13); KWIC/Distribution and Export CSV in the page's top bar (ConcordanceScreen.tsx:117-132), as on every research screen (LIB-01) |
| CON-02 | done | Root pills — the current root, then eight Quranic roots — pressed and in the root colour when chosen; a pick clears every filter (ConcordanceScreen.tsx:23, 25, 109-112, 135-142); plus a typed root and the root index (143-155, 335-369) |
| CON-03 | open | No Texts filter: the Quran is the only text (P11) |
| CON-04 | done | "{hits} · {translit} · {n} words" with the server's filtered total (ConcordanceScreen.tsx:157-161); e2e "concordance: arriving with no root shows ع ل م, every hit counted by the server, paged (CON-05, CON-Q01)" |
| CON-05 | done | `?root`, then the root of `?w` (concordance/page.tsx:27-31), then the reading context's root and the trail (ConcordanceScreen.tsx:31-53), then علم (line 73); e2e "concordance: arriving from a word opens its root; …" and "concordance: with no root in the address, the root the reader was last on opens (CON-05)" |
| CON-06 | done | Sort (mushaf · preceding · following) and chip rows with "any (n)" first and counts, most used first — part of speech, word (lemma), pattern (wazn) (ConcordanceScreen.tsx:169-180, 210-230, 314-332; concordance.py:126-161) |
| CON-07 | done | Source · preceding · keyword · following with Arabic labels and arrows pointing away from the keyword (ConcordanceScreen.tsx:253-264; globals.css:2412-2420) |
| CON-08 | adapted | Each line is a link on one shared grid, not a button; its tooltip is the verse in the reader's translation in the English UI and lemma · pattern in the Arabic UI (ConcordanceScreen.tsx:269-274); e2e "concordance (English): each line's tooltip is its verse in the reader's translation, with the work credited (CON-08)" |
| CON-09 | done | Verse key and sūra name; preceding, keyword (bold, word colour) and following each in `<bdi>`, "—" when empty (ConcordanceScreen.tsx:275-281; globals.css:2559-2582) |
| CON-10 | done | One grid with `subgrid` rows: the keyword column as wide as the widest keyword, both contexts hugging it (globals.css:2513-2532; DECISIONS lesson on KWIC grids); e2e "concordance: the keywords stand on one axis and the preceding words sit on their right in Arabic (CON-10/11, CON-Q02)" |
| CON-11 | bug-fixed | The preceding cell is laid out LTR and loses its far (right) end, so the words nearest the keyword stay (globals.css:2565-2576); same e2e as CON-10 |
| CON-12 | done | Server sort on the folded following text, then mushaf order (concordance.py:117-119) — code-point order of the folded letters is the alphabetical order; e2e "concordance: sorting by the following context reorders the lines as the server does (CON-12, CON-Q03)" |
| CON-13 | done | Preceding words reversed, nearest first (concordance.py:120-122) |
| CON-14 | bug-fixed | "Source" order is mushaf order, numeric by sūra, āya and word (concordance.py:72, 123) |
| CON-15 | adapted | The lemma filter is called "word"; the wazn and the surface form are separate filters (ConcordanceScreen.tsx:217-244; concordance.py:39-50) — SHL-S06 |
| CON-16 | bug-fixed | A line opens `/quran/{s}?w={lemma}&at={location}#v{a}` with that word selected (ConcordanceScreen.tsx:270); e2e "concordance: a line opens the reader with that hit selected (CON-19)" |
| CON-17 | done | "No attestations of this root with these filters" (ConcordanceScreen.tsx:286) |
| CON-18 | done | Footer hint, with the translation's credit in English (ConcordanceScreen.tsx:292-295) |
| CON-19 | done | Paged: 60 lines and "More ({shown} of {total})" (ConcordanceScreen.tsx:90-99, 287-291; concordance.py:179-196); e2e as CON-04 |
| CON-20 | done | `repeat(auto-fit, minmax(340px, 1fr))` panes (globals.css:2589-2603) |
| CON-21 | adapted | By sūra, hits per 100 words of the sūra, coloured Meccan or Medinan (CON-Q04) (ConcordanceScreen.tsx:396-429; concordance.py:247-264); per text comes with P11 (CON-37) |
| CON-22 | bug-fixed | The distribution takes the lines' filters except the sūra, which it distributes over (ConcordanceScreen.tsx:100; concordance.py:239) |
| CON-23 | done | Content words within two words, particles and pronouns left out by tag, top 20, sized by frequency, with a tooltip; each opens its lines (concordance.py:22-28, 268-294; ConcordanceScreen.tsx:444-460); e2e "concordance: a form in the distribution and a collocate each filter the lines, and can be removed (CON-23/24, CON-Q05)" |
| CON-24 | done | Forms with bars and counts, the chosen one marked; a click filters the lines and returns to KWIC (ConcordanceScreen.tsx:302, 430-443); same e2e as CON-23 |
| CON-25 | bug-fixed | Grouped by the surface form (`text_imlaei`), not the lemma (concordance.py:248-251, 293) |
| CON-26 | done | Every line under the filters and sort, every field quoted (concordance.py:304-340; main.py:494-510); e2e "concordance: the CSV export carries the filters, a BOM, a header and one row per hit (CON-26/27, CON-Q08)" |
| CON-27 | bug-fixed | UTF-8 BOM, an ASCII file name from the transliteration, columns for sūra, āya, position, location, surface, lemma, root, pattern, part of speech and a credited translation (concordance.py:298-340); a plain download link, so the browser gives the feedback. Full features: CON-Q08 |
| CON-28 | open | The corpus is the Quran; other texts and the reader's own texts join in P11 (PLAN P4.4 Open) |
| CON-29 | n/a | The prototype's seed counts |
| CON-30 | done | Root, view, sort and every filter written to the address bar on change (ConcordanceScreen.tsx:77-86); e2e "concordance: word and Makki/Madani filters narrow the lines, survive a reload, and the total is the server's (CON-14…18)" |
| CON-31 | adapted | Reads the reading context and the trail from the personal store (ConcordanceScreen.tsx:31-53); the reader's texts join with P11 (CON-28) |
| CON-32 | done | Lines are links in an ordered list (Tab, Enter); chips and segments are buttons with `aria-pressed` (ConcordanceScreen.tsx:266-285, 314-332) |
| CON-33 | done | Below 900px the source takes its own line and the KWIC line keeps three columns; chip rows scroll in one line (globals.css:2638-2673); e2e "concordance (English): same lines, English controls, no horizontal scroll" |
| CON-34 | done | Tokens only; e2e "axe dark: /concordance?view=dist" |
| CON-35 | done | Two views, hugging columns, direction labels, both sorts, lines to the reader, counts in mono (CON-06…19) |
| CON-36 | done | Pattern (wazn) filter (ConcordanceScreen.tsx:224-230; concordance.py:42) |
| CON-37 | open | Per sūra (chapter) built (CON-21); per text and across eras wait on P11 |
| CON-38 | open | Mushaf (source) order, collocates, by form and CSV built; the Texts filter waits on P11 |
| CON-39 | adapted | Contexts split on the server from the stored display tokens (concordance.py:99-114); the sort keys are computed per request over the root's hits rather than read from the occurrences index's precomputed `left_sort`/`right_sort` (searchindex.py:296-303) — the same order |
| CON-Q01 | done | Mushaf order by default, following and preceding as alternatives (ConcordanceScreen.tsx:75, 169-180; concordance.py:22, 72) |
| CON-Q02 | done | DOM order source · preceding · keyword · following inside `dir="rtl"` in both UI languages, Arabic labels (ConcordanceScreen.tsx:251-264); e2e as CON-10 |
| CON-Q03 | open | Lemma, wazn, part-of-speech, sūra, juzʾ and Meccan/Medinan filters (ConcordanceScreen.tsx:181-230; concordance.py:34-74); e2e "concordance: part of speech chips and the juzʾ list filter the lines with the server's counts (CON-Q03)". Missing: a sūra or juzʾ range (one of each only); the corpus filter (P11) |
| CON-Q04 | open | Per sūra per 100 words, the Meccan/Medinan split, revelation order (ConcordanceScreen.tsx:388-429); e2e "concordance: the distribution can follow the order of revelation (CON-Q04)". The historical-era view waits on P11 |
| CON-Q05 | done | See CON-23 |
| CON-Q06 | open | Hadith matn/isnād and collection/grade filters (P11) |
| CON-Q07 | done | Server totals and paging (CON-19) |
| CON-Q08 | open | (minor) BOM, ASCII name, columns for sūra, āya, position, surface, lemma, root, pattern, preceding, following and translation (concordance.py:298-340). "gram" is the part-of-speech tag only: case, mood, person and the other stored features (`content.words.features`) are not exported |
| CON-Q09 | open | Tokens with lemma, root, pattern and features, sort keys, per-sūra word counts, Meccan/Medinan and revelation order, translations (concordance.py:61-74, 240-246). Hadith structure waits on P11 |
| CON-F01 | done | See CON-07, CON-10 |
| CON-F02 | done | `<bdi>` around every context and keyword (ConcordanceScreen.tsx:279-281) |
| CON-F03 | done | See CON-13; folded with `normalize` (concordance.py:119-122) |
| CON-F04 | done | See CON-05 |
| CON-F05 | done | `csv.QUOTE_ALL` (concordance.py:311) |
| CON-F06 | done | The same look-behind on «. ؟ ! ؛ ۔» cuts the reader's texts into passages with the punctuation kept (lib/library/segment.ts:6); those texts reach the concordance in P11 (CON-28) |

### Analyser

| ID | status | evidence / reason |
|---|---|---|
| ANA-01 | adapted | «المحلّل» active in the nav (shell/NavLinks.tsx:14); Table/Interlinear and Copy CoNLL-U in the page's top bar (AnalyseScreen.tsx:92-99), as LIB-01 |
| ANA-02 | done | Textarea `dir="rtl"`, `lang="ar"`, 2 rows, vertical resize, Amiri 24px, line-height 1.8, right-aligned, placeholder, labelled, focus border (AnalyseScreen.tsx:101-110; globals.css:3019-3036) |
| ANA-03 | done | `?q=` else the design's sample (analyse/page.tsx:21; lib/analyse.ts:41); e2e "the design's sample: particles, a word from the Quran, a clitic reading marked for review, and the counts" |
| ANA-04 | adapted | Try chips: two Quranic phrases, a verse reference and the design's sample, each cut to three words + "…" (AnalyseScreen.tsx:18, 111-117) — ANA-Q05 |
| ANA-05 | done | "words {n} · roots {r} · to review {k}" from the server's counts (AnalyseScreen.tsx:88, 119; analyse.py:327-335); same e2e as ANA-03 |
| ANA-06 | adapted | Re-analysed 250 ms after typing stops (one request per pause); the server splits on whitespace, 60 words at most, and says when it cut (AnalyseScreen.tsx:45-52, 132; analyse.py:32, 317, 326) |
| ANA-07 | done | Word · Segments · Root · pattern · Analysis · Confidence with `role` table/row/columnheader/cell; fixed 140/190/130/1fr/64 columns (AnalyseScreen.tsx:142-153; globals.css:3046-3058) |
| ANA-08 | done | Rows under 0.8 tinted amber (AnalyseScreen.tsx:236, 247; globals.css:3059-3061; lib/analyse.ts:44) |
| ANA-09 | adapted | The word in its own RTL cell, in the KFGQPC font when Quranic (AnalyseScreen.tsx:248-250) — ANA-Q03 replaces the LTR trick |
| ANA-10 | done | Prefix and suffix chips apart from the stem, each with its grammatical label under it and as its title; harakāt-only pieces dropped; logical order in RTL (AnalyseScreen.tsx:195-226) |
| ANA-11 | adapted | Order per ANA-Q03: logical order, the prefix first on the right |
| ANA-12 | done | One grey chip, "particle or function word, not segmented" (AnalyseScreen.tsx:198; globals.css:3090-3093) |
| ANA-13 | done | Root in Arabic (a link) and the pattern; "—" for particles and words with no reading, and no fallback pattern invented (AnalyseScreen.tsx:252-261) |
| ANA-14 | done | Particles: "particle or function word · {pos}"; nothing found: "no Quranic word matches it"; otherwise the grammatical summary (with its glossary term), the lemma, the English gloss on its own line, how it was found with the count, the Quranic place and an "entry" link to `/read?w=` (AnalyseScreen.tsx:262-293) |
| ANA-15 | done | "choose among {n} readings" opens a listbox of every candidate with root, lemma or pattern, part of speech and confidence (AnalyseScreen.tsx:294-314); e2e "choosing among candidates is remembered, the view and phrase live in the address bar, and CoNLL-U is copied" |
| ANA-16 | done | Two decimals in the UI's numerals, green ≥ 0.8, amber below; particles and Quranic words 1.00 (AnalyseScreen.tsx:22, 318-320; analyse.py:201, 252, 262) |
| ANA-17 | adapted | No hand list: a word is a function word when the corpus tags its Quranic occurrences so (top reading not a content part of speech, no root), decided in the service (analyse.py:35, 200-201, 253-254) — ANA-40 |
| ANA-18 | adapted | Counts non-particle, non-Quranic words under 0.8, including words nothing reads, which the prototype tints but does not count (analyse.py:328-330); the difference is not recorded as a decision |
| ANA-19 | done | Distinct top roots (analyse.py:327) |
| ANA-20 | done | "Type a phrase above." (AnalyseScreen.tsx:134) |
| ANA-21 | done | Legend for the affix chips and the review tint, the counts, "Build a graph from this →", and a note naming the method (AnalyseScreen.tsx:171-188) |
| ANA-22 | open | (minor) Quranic text seeds its verse or verses; other text seeds its words as a trail (AnalyseScreen.tsx:77-86, 181-185); e2e "the phrase seeds the graph editor". The phrase itself is not carried as a sentence card, as the design's seed does — the seed has no sentence kind (lib/graph/seedCodec.ts:10-14) — so a non-Quranic phrase reaches the editor as loose words |
| ANA-23 | n/a | The prototype heuristic's output on its sample |
| ANA-24 | bug-fixed | The heuristic is gone: words are read against the Quran's own occurrences and patterns, with the method and confidence shown (analyse.py:1-18; DECISIONS 2026-10-03 the Analyser); same e2e as ANA-03 |
| ANA-25 | open | (minor) Cards with the word, its English gloss (or "(particle)" or "?"), the root and the confidence (AnalyseScreen.tsx:155-169); no transliteration line, and the payload carries none (analyse.py:78-94) |
| ANA-26 | done | One foot under both views (AnalyseScreen.tsx:171-187) |
| ANA-27 | done | Confidence and the unsure tint on every card (AnalyseScreen.tsx:160, 164; globals.css:3123-3126) |
| ANA-28 | done | `navigator.clipboard.writeText` of the CoNLL-U (AnalyseScreen.tsx:67-75; lib/analyse.ts:88-115); same e2e as ANA-15 |
| ANA-29 | bug-fixed | "copied" or "copying failed" in a status line (AnalyseScreen.tsx:67-75, 121-125) |
| ANA-30 | open | (minor) Fixed: particles carry no Pattern, Root and Pattern sit in MISC, a `sent_id`, a blank line ends each sentence (lib/analyse.ts:101-115; unit tests "toConllu (ANA-28, ANA-Q06)" in lib/analyse.test.ts). Not fixed: participles export as NOUN or ADJ with no `VerbForm=Part`, because the derivation feature is not mapped (lib/analyse.ts:47-64) |
| ANA-31 | done | `?q=` and `?view=` read on the server and written on change (analyse/page.tsx:21-22; AnalyseScreen.tsx:55-63); same e2e as ANA-15 |
| ANA-32 | adapted | The reader's choice per written form kept on the device (`jadhr-analyse-choices`, lib/store/analyseChoices.ts:10-18) — ANA-Q04 |
| ANA-33 | done | No shortcuts; chips, choose and its options are buttons |
| ANA-34 | done | Sample on first visit, empty message, unsure rows, plus loading and error (AnalyseScreen.tsx:134-140) |
| ANA-35 | done | Below 760px each word becomes a card and the header row goes (globals.css:3128-3144); e2e as ANA-03 checks no horizontal scroll on phones |
| ANA-36 | done | Tokens only (globals.css:3011-3127). /analyse is not in the axe runs (a11y.spec.ts:4, 20) |
| ANA-37 | done | Prefilled input, view toggle, fixed widths, affix chips, harakāt-only pieces dropped, "—" for particles, confidence shown (ANA-02…16) |
| ANA-38 | done | Segments with visible labels, every candidate with its confidence in the choose list, pattern, grammatical summary (ANA-10, 14, 15) |
| ANA-39 | done | Roots link to the concordance (AnalyseScreen.tsx:254), lemmas to their entry (line 290) |
| ANA-40 | done | Ranked, one per root, three at most; particles return `candidates: []` with the particle apart; confidence always present — decided in the service (analyse.py:178-188, 196-202); harakāt-only segments are dropped in the client (AnalyseScreen.tsx:200); services/api/tests/test_analyse.py:53 |
| ANA-41 | adapted | No search stemmer: the service reads the Quran's own words (analyse.py:97-128); responses are cached per URL with the dataset ETag (main.py:59-76, 562-567) rather than per word; the morphology service is P11 (ANA-Q07) |
| ANA-Q01 | done | Quranic text — a reference, a range of up to ten verses, a phrase found in one verse — is the corpus's analysis at confidence 1.0 with its place; other text is ranked (analyse.py:231-337); e2e "a verse reference is read from the corpus, every word at confidence 1, linked to its place" |
| ANA-Q02 | done | Matched on both `norm` and `norm_uthmani` after marks are stripped and ٱ folded (analyse.py:71-75, 100) |
| ANA-Q03 | done | The word at the right in the Arabic UI, segments in logical order in `dir="rtl"`, Arabic grammar labels with English in the English UI (AnalyseScreen.tsx:24-28, 203-212; globals.css:3037-3045) |
| ANA-Q04 | open | Every candidate with confidence, the pick remembered per form (ANA-15, ANA-32); feeding choices to review and proposals waits on P7 |
| ANA-Q05 | open | Āyāt and a reference among the Try chips, a typed reference loads the verse analysed (AnalyseScreen.tsx:18; analyse.py:301-315); hadith phrases wait on P11 |
| ANA-Q06 | open | (minor) Root and Pattern in MISC, one sentence per verse, a range of up to ten verses exportable (lib/analyse.ts:82-115; analyse.py:33). Words go out whole: UD Arabic splits clitics into syntactic words under a multiword-token range, and the corpus segments it needs are in the payload (lib/analyse.ts:103-113) |
| ANA-Q07 | open | `GET /analyse` and `POST /analyse/tokens`, gold annotations, ids, Arabic and English labels, function words from the corpus, the editor seed (main.py:556-567; lib/graph/seedCodec.ts). A morphology service for non-Quranic Arabic waits on P11 (D28) |
| ANA-F01 | done | See ANA-07 |
| ANA-F02 | done | See ANA-10, 12, 13 |
| ANA-F03 | done | Confidence always shown, the tint, and how each reading was found with its count (AnalyseScreen.tsx:279-280) |
| ANA-F04 | adapted | Logical order in RTL replaces the reversed-LTR trick (ANA-Q03) |
| ANA-F05 | open | An affix comes off only when two letters remain; one candidate per root, three at most (analyse.py:116-128, 178-188). Missing: punctuation is not taken off — tokens are whitespace runs and the key strips marks, not punctuation (analyse.py:68, 71-75, 317; normalize.py:92-94) — so «بالتعلم.» or «العلمَ،» reads as nothing found; and a verb reading is still offered after the article comes off (analyse.py:207 keeps every content part of speech) |

### Library

| ID | status | evidence / reason |
|---|---|---|
| LIB-01 | adapted | «المكتبة» active in the shared nav (shell/NavLinks.tsx:11, 46). The filter is a segmented control in the page's own title bar (LibraryScreen.tsx:69-73), not in the header: the shared header holds the site-wide search, language and theme controls and folds into a menu on phones (SHL-Q08). Options come from what exists: All · Quran · Mine {n} (LibraryScreen.tsx:60-64; LIB-44) |
| LIB-02 | adapted | Filters drawn from the catalogue (LIB-44, LIB-Q02): Quran when the catalogue has it, Mine once the reader has texts (LibraryScreen.tsx:60-65, 101, 114); not in the URL, as designed. The Scripture/Classical groups for hadith and books come with P11 (LIB-Q02) |
| LIB-03 | done | Shown only when the Quran has a stored position (`progress.quran`, LibraryScreen.tsx:58-59, 75), the one text that records progress; e2e "nothing measured is never '100% known': a reader who has marked nothing is told so" checks it is absent without progress |
| LIB-04 | done | Green cover, «سورة …», "verse {n} of {m} · {date}" in the UI language, progress bar, «تابع القراءة» (LibraryScreen.tsx:78-90; globals.css:3187-3201) |
| LIB-05 | bug-fixed | Opens the reader at the sūra and verse, `/quran/{s}#v{a}` (LibraryScreen.tsx:78); e2e "the shelf: the Quran's card counts known words by unique lemma, resumes at the sūra and verse, and lists the sūras with progress" |
| LIB-06 | done | "Shelf" + "texts {n} · words known {k}", k = every word state marked known (LibraryScreen.tsx:41, 65, 94-99) |
| LIB-07 | done | `repeat(auto-fill, minmax(220px, 1fr))`, gap 12 (globals.css:3163-3167); the Quran first, then the reader's texts by creation date (lib/library/texts.ts:28-30) |
| LIB-08 | done | Green gradient cover for the Quran; a bordered block labelled «نصّك» for the reader's texts (globals.css:3192-3213; LibraryScreen.tsx:104, 204) |
| LIB-09 | done | Arabic title in Amiri, RTL; the English title is added in the English UI (LIB-43) (LibraryScreen.tsx:106-107) |
| LIB-10 | bug-fixed | Per-kind meta lines: the Quran "{114} sūras · {6,236} verses" (LibraryScreen.tsx:108), a reader's text "pasted · words {n} · to review {r}" (207); no generic "{n} chapters" string remains to be mis-pluralised |
| LIB-11 | adapted | "You know {k} of {total} words" by unique lemma, with no percentage or colour tiers (LibraryScreen.tsx:174-185, 201, 208-210) — LIB-Q04 and DECISIONS 2026-10-03 (the reader's own texts) |
| LIB-12 | bug-fixed | Nothing measured is never "100% known": no line when a text has no measurable words, "no words marked known yet" when none are marked, "no Quranic words in it" for a text without them (LibraryScreen.tsx:178-181, 209); e2e "nothing measured is never '100% known': …" |
| LIB-13 | open | (minor) The Quran's bar is verses read over 6,236 (LibraryScreen.tsx:57, 110). A reader's own text always shows "new": reading it records no position (UserTextReader.tsx writes no progress; LibraryScreen.tsx:211) |
| LIB-14 | bug-fixed | The Quran card opens `/read` (resume), a reader's text `/library/text/{id}` (LibraryScreen.tsx:103, 203) |
| LIB-15 | done | Dashed tile "+ · Add a text · paste Arabic text" opening the sheet (LibraryScreen.tsx:120-128; globals.css:3237-3246); the mode line names paste, the one mode offered (LIB-48) |
| LIB-16 | done | Rename and delete with a confirm step on the text's page (UserTextReader.tsx:45-89); e2e "adding a text: a live preview read against the Quran, saved privately, read word by word, renamed and deleted". Reorder, sort and shelf search are recorded as absent in the prototype and asked for by no spec line |
| LIB-17 | done | `ui/Dialog.tsx`: scrim, 900px max, scrolls inside, Esc and the scrim close, focus moved in, trapped and returned (ui/Dialog.tsx:33-88; AddTextSheet.tsx:87-93); opened by the tile or `?add=1` (LibraryScreen.tsx:34, 47-55); e2e "adding a text: …" opens it from `?add=1` |
| LIB-18 | adapted | Title and close only; no Paste · URL · PDF switch, because paste is the one mode offered until the import pipeline (P11.3a) can do URL and PDF with preview-and-correct (DECISIONS 2026-10-03 the reader's own texts; LIB-48) (AddTextSheet.tsx:89-93, 122) |
| LIB-19 | done | Two panes in `repeat(auto-fit, minmax(300px, 1fr))`, stacking when narrow (globals.css:3269-3274; AddTextSheet.tsx:94-167) |
| LIB-20 | done | «نصّك» label (AddTextSheet.tsx:102-103) |
| LIB-21 | done | Textarea `dir="rtl"`, `lang="ar"`, 6 rows, vertical resize, Amiri 19px, line-height 1.9, placeholder (AddTextSheet.tsx:104; globals.css `.add-text-input`) |
| LIB-22 | open | URL import is not offered (P11.3a) |
| LIB-23 | open | PDF and photo import are not offered (P11.3a, D9a) |
| LIB-24 | done | "words {n} · vowelled" / "· no vowels", a prompt when empty; harakāt U+064B–U+0652 detected (AddTextSheet.tsx:106-108; lib/library/segment.ts:40) |
| LIB-25 | adapted | No "add tashkīl": no vowels are added to anyone's text (AddTextSheet.tsx:31-32) — D9a for OCR output and PLAN §5 ("no model writes analyses"): automatic vocalisation would be generated text; LIB-Q05 forbids it for the Quran and hadith in any case |
| LIB-26 | done | Title input `dir="rtl"`, Amiri 16px, placeholder (AddTextSheet.tsx:109-112) |
| LIB-27 | done | Enabled only with more than 10 characters of text and a title, and not while saving (AddTextSheet.tsx:54, 113-115) |
| LIB-28 | done | "Preview" + "{pct} of words found": good ≥ 80%, mid ≥ 50%, low otherwise, "—" before any (AddTextSheet.tsx:124-131; globals.css:3310-3318) |
| LIB-29 | done | First 80 words in Amiri 24px RTL; found → dotted underline, to review → amber wash and inset line, not found → grey (AddTextSheet.tsx:13, 132-149; globals.css:3297-3309) |
| LIB-30 | done | Tooltips: root and English gloss; "root {r}? (confidence {c})"; "particle or function word"; "no Quranic word matches it" (AddTextSheet.tsx:141) |
| LIB-31 | done | Up to three review rows: the word, the root and confidence, «حلّلها» → `/analyse?q=` (AddTextSheet.tsx:150-160); e2e "adding a text: …" |
| LIB-32 | done | "roots · entries · to review · not found", plus "in the first 80 words" when the text is longer (AddTextSheet.tsx:161-166) |
| LIB-33 | adapted | Classified by how the server read each word (analyse.py:344-409): found = a Quranic form at ≥ 0.8 or a particle; to review = a clitic or pattern reading or a form under 0.8; not found = nothing (AddTextSheet.tsx:26, 48-50). The prototype's score bands belong to the heuristic analyser the corpus replaces |
| LIB-34 | adapted | IndexedDB instead of localStorage: id, title, text, passages, word count, distinct lemmas, review and unknown counts over the whole text, dates (AddTextSheet.tsx:56-84; lib/library/texts.ts:10-48; DECISIONS 2026-10-03 the reader's own texts); the sheet closes and the filter switches to Mine (LibraryScreen.tsx:163-167) |
| LIB-35 | bug-fixed | Review counted over the whole text (up to 20,000 words), not the preview (AddTextSheet.tsx:62-75) |
| LIB-36 | open | A reader's text is read only on its own page (`/library/text/{id}`, UserTextReader.tsx); it is not in the reader's rail or the concordance (P11; PLAN P4.4 Open) |
| LIB-37 | done | `?add=1` opens the sheet; closing removes the parameter (library/page.tsx:21; LibraryScreen.tsx:47-55) |
| LIB-38 | adapted | Reads texts from IndexedDB and word states, progress, verses read and sessions from the personal store; writes texts (LibraryScreen.tsx:35-42; lib/library/texts.ts) |
| LIB-39 | open | (minor) No Continue without progress, a message for an empty Mine (LibraryScreen.tsx:75, 130), save and preview failures shown (AddTextSheet.tsx:116-120, 134-135). The sūra list and the reader's shelf have no loading or error state: a failed `/surahs` fetch or IndexedDB read leaves them silently absent (LibraryScreen.tsx:35-36, 114-119, 133) |
| LIB-40 | done | Text and title sit in a form, so Enter in the title saves (AddTextSheet.tsx:95-101); the rename form submits on Enter (UserTextReader.tsx:72-82) |
| LIB-41 | done | Shelf and sūra grid wrap to one column, the sheet's panes stack at 300px, the filter sits in the page bar (globals.css:3163-3167, 3247-3251, 3269-3274); e2e "the shelf: …" checks no horizontal scroll on phones |
| LIB-42 | done | Every colour is a token except the Quran cover's green gradient, kept in both themes (globals.css:3155-3335, 3202-3204). /library is not in the axe runs (a11y.spec.ts:4, 20) |
| LIB-43 | done | Kind label, Arabic title, English title in the English UI, sūras · verses, verses-read bar, words known and words looked at (LibraryScreen.tsx:104-110, 182). No type dot: the cover carries the kind (cosmetic) |
| LIB-44 | done | Filters from the kinds present (LibraryScreen.tsx:60-64) |
| LIB-45 | done | Cut into passages at blank lines and after a sentence end past 600 characters; words with edge punctuation off (lib/library/segment.ts:6-37); unit test "a pasted text into passages and words (LIB-45)" (lib/library/segment.test.ts) |
| LIB-46 | adapted | The shelf is never empty — the Quran is always on it — so the add tile is the prompt, with the one mode offered (LibraryScreen.tsx:101-128) |
| LIB-47 | adapted | Continue, known, the live preview and the review rows kept; "add tashkīl" left out (LIB-25) |
| LIB-48 | done | Paste only; URL and PDF said to come with the import pipeline (AddTextSheet.tsx:122); private by default and said so (AddTextSheet.tsx:121; D9a); size cap 200,000 characters (AddTextSheet.tsx:14) |
| LIB-Q01 | open | (minor) The Quran has its own card and a 114-sūra grid with Meccan/Medinan and per-sūra progress (LibraryScreen.tsx:133-158); no juzʾ, ḥizb or page entry from the Library (only in the reader's rail) |
| LIB-Q02 | open | Only القرآن الكريم and نصوصي; hadith collections and books join with P11. Labels are Arabic and data-driven (LibraryScreen.tsx:60-64) |
| LIB-Q03 | done | Resumes at sūra:āya and names the sūra (LibraryScreen.tsx:78-83); e2e "the shelf: … resumes at the sūra and verse …" |
| LIB-Q04 | done | Unique lemmas: the Quran's 4,832 (lexicon.py:550), a text's distinct content lemmas (AddTextSheet.tsx:71-72); no measurable words → no claim (LibraryScreen.tsx:178, 209). The two denominators differ (defects) |
| LIB-Q05 | done | No vocalisation path exists for any text (LIB-25) |
| LIB-Q06 | done | Pasted Uthmani text is matched on the mushaf shadow (`norm_uthmani`) after marks are stripped and ٱ folded (analyse.py:356-362; packages/arabic-py/src/jadhr_arabic/normalize.py:31-94); the stored text stays as pasted (lib/library/segment.ts:2-4) |
| LIB-Q07 | done | Bars fill from `inset-inline-start` (globals.css:3229-3236) |
| LIB-Q08 | open | `GET /texts` gives kind, Arabic and English titles, chapter and passage counts and the Quran's lemma count; `/texts/{slug}` its chapters (main.py:367-379; lexicon.py:544-566); progress and texts kept in the browser; the paste pipeline built. Hadith and book structure (books and numbers, chapters and pages) waits on P11 |
| LIB-F01 | done | Save disabled until > 10 characters and a title; the filter switches to Mine after saving (AddTextSheet.tsx:54; LibraryScreen.tsx:163-167) |
| LIB-F02 | done | Preview capped at 80 words and debounced 400 ms (AddTextSheet.tsx:13, 42-45) |
| LIB-F03 | adapted | URL and PDF are not offered rather than stubbed; one line says they come with the import pipeline (AddTextSheet.tsx:122) |
