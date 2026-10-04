# 20 · Data & API coverage — P10 against the design inventory and the code

Audited 2026-10-04 against commit `76c4c0c` (branch `build/vision`). Scope: phase P10 "Data & API" of `docs/PLAN.md` — the 67 DAT items of inventory Part 4 §5 (research 05: DAT-01…55, DAT-Q01…Q08, DAT-H01…H04), from the baseline in research 18, measured against the code built in commits c8863f8, a5ed33e, e896c1d, e2df68f, 99d5fc1, c62081e, 2162945, f961e55, 125e99a, 355de2d, 50f2ce8, 9844bd1, bb80972, 63007a2, ccd3606 and 76c4c0c.

**Method.** Each item read in research 05, then the code that answers it: `pipeline/src/jadhr_pipeline/release.py` and `lexicon_xml.py`; `services/api/src/jadhr_api/releases.py`, `routes_releases.py`, `routes_public.py`, `apikeys.py`, the limits in `main.py`; `apps/web/src/components/data/DataScreen.tsx`, `lib/dataset.ts`, `app/[locale]/(site)/developers/page.tsx`, `components/contrib/Changelog.tsx`, the Reader's cite sheet in `components/reader5/Overlays.tsx`; `infra/compose.prod.yml` and `docs/DEPLOY.md`. A row is `done` only where a test or a screenshot read by eye shows it.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, the reason in DECISIONS or in the row. `bug-fixed` — a prototype defect the inventory flags that our code does not have. `removed` — a fake the inventory says may not ship, left out. `owner` — waits on a decision only the owner can take; named in §4.

**Evidence.** Pipeline: `pipeline/tests/test_release.py` (2 tests: every file against its manifest, RFC 4180 read back, NFC except the named source texts, holds per file, the bilingual reasons without internal references, Perseus's statement verbatim), `test_lexicon_xml.py` (20 tests: four valid files, the same bytes on every build, Jing and lxml refusing what the schemas refuse, each of our checks refusing what it guards, the pinned tools). API: `test_releases_api.py` (3: recorded once, never changed, served once published and not held, XML under its two-part name, the production mount), `test_public_api.py` (5: provenance on every answer, only the layers whose terms allow it, the analysis), `test_apikeys_api.py`. e2e: `data.spec.ts` (5 tests × desktop and phone: the dataset tab, the playground by GET and by POST with its curl run as copied, the developers' guide, and the exit ◆), `api-keys.spec.ts`. Release 2026.10.0 built and recorded in development (16 files, manifest sha256 `35f47413…`). Full runs at 76c4c0c: Python 677 passed; e2e 644 passed, 88 skipped, 0 failed. Screenshots at 1440 and 390 px in both themes and both languages, read: the release card, the exclusions opened, the playground on GET and on POST, the guide's analysis section.

## 1. Summary

| Status | Items |
|---|---|
| done | 36 |
| adapted | 20 |
| bug-fixed | 8 |
| removed | 2 |
| owner | 1 |
| open | 0 |
| **total** | **67** |

Counted from the table below, ranges expanded (DAT-19…21 is three items); every one of the 67 ids appears once.

The exit ◆ (P10.4, a citation copied from the site resolves to an immutable artefact): **done** — `data.spec.ts` copies each of the five forms from `/data`, follows the address to the release and its manifest, and compares the manifest's bytes with the hash the record keeps; with one byte of the manifest changed on disk the test fails (410).

## 2. The items

### Route and header (DAT-01…03)

| Item | Status | How |
|---|---|---|
| DAT-01 route, `?tab=api` | done | `/data` opens Dataset; `?tab=api` the playground, kept in the address when the tab changes (e2e). |
| DAT-02 tabs, licence line | adapted | Tabs «البيانات» · «مختبر الواجهة البرمجية»; the line says our derived layers are CC BY-SA 4.0 and every source is under its own licence, instead of one "CC BY-SA 4.0 · code MIT" (the code's licence is not decided, and one licence for the data would be false). |
| DAT-03 re-read on focus | done | The counts, the releases and the changelog are read again when the tab is shown again (the query library listens for it) or the window is focused beside another (a listener on the page); the e2e test focuses the window and waits for both requests, and fails with the listener taken out. |

### The dataset tab (DAT-04…27)

| Item | Status | How |
|---|---|---|
| DAT-04 title, description | adapted | «جذر — بيانات جذور القرآن» with a lead that claims only what is true: the redistributable layers are in the files, what is not is listed with why, the site shows the live data and a release is a fixed snapshot (ccd3606). |
| DAT-05 stat tiles from the data | done | Roots, lemmas, words and verses from `/api/v1/meta`; the e2e test compares each tile with the API. |
| DAT-06 "senses · sourced" (fake) | removed | No sense count is shown: the senses' sources were synthetic. |
| DAT-07 the current release | adapted | A card per release: each table with its rows, its files by format (JSONL, CSV, TEI Lex-0, LMF) with size and sha256, downloadable once published and not held, a held file with its reason in the reader's language; the DOI only when minted. The "merged this session" note is the live changelog below it. |
| DAT-08, DAT-09 past release rows | adapted | Only releases that were recorded are listed; the prototype's invented versions and DOIs are not. |
| DAT-10 past releases retrievable | done | Every recorded release is listed and served by version for good: the database refuses any change or deletion (c8863f8), and a release card reads its own version. |
| DAT-11 CSV download | done | RFC 4180, CRLF, UTF-8 without BOM, a header row; served as `jadhr-<version>-<file>`. |
| DAT-12 CSV quoting (bug) | bug-fixed | Quotes doubled and fields with commas, quotes or line breaks quoted; the test reads every record back, Lane's multi-paragraph articles included. |
| DAT-13 TEI and LMF (fake) | done | Real TEI Lex-0 0.9.5 and LMF (ISO 24613-4) for the Quranic lexicon and Lane, validated by Jing and lxml and by our own checks when the release is built (125e99a, research 19). |
| DAT-14 changelog label | done | «سجل التغييرات», the live log (P7.3). |
| DAT-15 changelog entries | done | Each merge with its contributor's name, what changed and where (P7.3). |
| DAT-16 empty copy | done | Said when nothing is merged (P7.3). |
| DAT-17 entries on one line (bug) | bug-fixed | A list, one entry per item (P7.3). |
| DAT-18 cite box, copy, toast | done | Format pills, the text in a box, "copy" with a word that shows for 1.8 s whether the copy worked or not (e2e). |
| DAT-19…21 templates | adapted | BibTeX, Chicago and APA name the release's version and its own address, or the DOI once minted — never the placeholder `10.5281/zenodo.0000000` (DECISIONS). |
| DAT-22 formats | done | The union of the design's and the docs': BibTeX, RIS, Chicago, APA and an Arabic form. |
| DAT-23 sources and licences | adapted | Each source the release uses, with its own licence, from the manifest and the sources register; no blanket "public domain" claim. |
| DAT-24 licence claim unresolved | done | Each source's terms as recorded; what is unresolved is held (`publication_hold`) or left out (`excluded`) with why, in English and Arabic (50f2ce8). |
| DAT-25 "Used by" (fake) | removed | Not shown until it can be counted; the e2e test asserts no "used by" and no placeholder DOI. |
| DAT-26 footer | adapted | Says what is true: every merge reaches this changelog under its contributor's name the day it merges. The design's "next release's changelog" is not so: releases do not carry contributions (B39 is the owner's). |
| DAT-27 toast only in Dataset (bug) | bug-fixed | The playground's curl copy says so in its own tab and clears itself (e2e). |

### The API playground (DAT-28…54)

| Item | Status | How |
|---|---|---|
| DAT-28 endpoint list | done | The public API's endpoints as `/api/v1/public` lists them, GET in green and POST in blue, the selected one framed. |
| DAT-29 lookup | done | `GET /quran/lookup?q=`: the six kinds of query (DAT-51). |
| DAT-30 roots | done | `GET /quran/roots/{root}`: the letters, spaced or not, or the transliteration. |
| DAT-31 words | adapted | `GET /quran/words/{location}` by place (2:255:3); senses with the lexica that attest them are not served (dictionary text is display only, D22). |
| DAT-32 patterns | done | `GET /quran/patterns/{slug}`. |
| DAT-33 concordance | adapted | `GET /quran/concordance?root=`, paged by cursor, over the Quran: the other texts come with P11. |
| DAT-34 lexica | adapted | Not served: the dictionaries' digital texts are for display only (D22); Lane's Lexicon is in the release as files. |
| DAT-35 analyse | done | `POST /quran/analyse` (bb80972): the corpus's analysis at its place where the text is the Quran's, ranked readings with their confidence otherwise, under a layer said to be machine-derived. |
| DAT-36 publish a graph | owner | Publishing waits for P8.5 (EDT-335), the owner's decision; the API will publish when the site does. |
| DAT-37 footer: version, keys, limits, spec | done | "v1", the limits read from the API (120 a minute per address, 600 with a key), the real OpenAPI document and the way to a key. |
| DAT-38 request area | done | The method and path, the description in the reader's language, the address with its editable parameter (or the body for POST), Send and curl. |
| DAT-39 defaults, lookup on load | done | Each endpoint's default value; علم looked up on load; the analysis's default text. |
| DAT-40 fake status (fake) | bug-fixed | The real status, time, type, dataset version and the limit left. |
| DAT-41 response box | done | Scrolls within 60 vh, reachable by keyboard. |
| DAT-42…44 response shapes | adapted | Stable shapes inside an envelope, documented in the guide and the OpenAPI document; no fields the sources do not allow (no glosses, no dictionary text). |
| DAT-45 provenance fields; curl toast (bug) | adapted | Provenance travels in `meta` (DAT-46), not as flat fields; the toast bug is DAT-27's. |
| DAT-46 envelope | done | `{meta: {dataset, dataset_version, release, layers, generated_at, docs}, data}` on every public answer. |
| DAT-47 public endpoints | done | lookup, roots, concordance (paged), releases and their files, and words, verses, patterns and analyse besides. |
| DAT-48 keys and limits | adapted | Reads without a key at 120 a minute per address; with a key at 600 a minute — above the design's 60, which was below its own anonymous limit (DECISIONS). |
| DAT-49 no silent fallback (bug) | bug-fixed | 404 `not_found` with the reason (e2e). |
| DAT-50 curl for POST (bug) | bug-fixed | The body sent with `-X POST`, its header and the text single-quoted; the e2e test runs the copied command and reads the answer (63007a2). |
| DAT-51 query detection (bug) | bug-fixed | Six kinds: Arabic word, transliteration, English, root, pattern, verse. |
| DAT-52 placeholder lexica (fake) | bug-fixed | No placeholder prose anywhere; the public API serves no dictionary text, the site shows the real articles with their sources. |
| DAT-53 concordance over prose only | done | Over the Quran. |
| DAT-54 phone and dark | done | Both tabs at 390 px and in the dark theme, read from screenshots; no page wider than the screen. |
| DAT-55 production | adapted | The immutable record, files served by version, `GET /changelog?since=`, the cadence said on the page, the release folder mounted read-only in production (355de2d); object storage is a deployment setting (D12); the DOI is the owner's (D14). |

### Quran adaptation notes (DAT-Q01…Q08)

| Item | Status | How |
|---|---|---|
| DAT-Q01 server | adapted | The release pipeline, the record, keys and limits are built; files are served from the release folder rather than object storage (D12); DOI registration is the owner's (D14). |
| DAT-Q02 licensing first | done | Every source's licence in the manifest and in every public answer, layer by layer; the corpus's block and Perseus's statement reproduced verbatim; what is unresolved held or left out. |
| DAT-Q03 provenance | done | Every layer names its source; a pattern says how it was derived (`pattern_method`); the analysis says it is machine-derived and gives each reading's confidence. |
| DAT-Q04 no invented numbers | done | No "used by", no download counts, no placeholder DOI. |
| DAT-Q05 formats | done | TEI Lex-0 and LMF for the lexicon, the morphology as a token table keyed surah:ayah:word:segment, RFC 4180 UTF-8 CSV; NFC except the sources' own texts, which the Quran's law keeps as they are (DECISIONS). |
| DAT-Q06 citation formats, ayah citations | done | Five forms on `/data`; the Reader's cite sheet cites a verse or a word with the dataset's version. |
| DAT-Q07 namespaced by product | done | `/api/v1/public/quran/…`; the dictionary, hadith and books join under their own names (P11). |
| DAT-Q08 client-side playground | done | The playground calls the real public API from the page; nothing needs an account. |

### Hard-won fixes (DAT-H01…H04)

| Item | Status | How |
|---|---|---|
| DAT-H01 re-read on focus | done | As DAT-03. |
| DAT-H02 version and licence on every answer | done | The public envelope; the site's own answers carry `X-Dataset-Version` and `X-Dataset-Release`. |
| DAT-H03 clipboard in try/catch | done | Citation and curl say whether the copy worked. |
| DAT-H04 changelog from live merges | done | P7.3. |

## 3. Faults found while auditing and building, fixed

- **No release had been recorded when the data page was checked**, so the holds and the exclusions never drew: the first real release showed the owner-facing English reasons on the Arabic page with their brackets jumping and their decision codes. The manifest now says why in English and in Arabic without internal references, and the page shows the reader's language (50f2ce8).
- **The counts and releases were not read again on focus**: the site's default freshness is an hour, so `refetchOnWindowFocus` did nothing for them, and the query library hears only the tab becoming visible, not a window focused beside another. Both fixed, with a test that fails without the fix.
- **Production could not serve a release**: neither the API nor the loader mounted `data/release`, so every file of a published release would have answered 410 (355de2d).
- **Two lines of copy overclaimed**: that merges appear in the next release's changelog, and that the files are "what the site shows" (ccd3606).
- **The playground had no POST**, so the design's analysis and a valid curl for POST were missing (bb80972, 63007a2).
- **The limits line ran into the OpenAPI link** with no separator (63007a2).
- **A file path broke mid-word on the phone** in the hash line (50f2ce8).

## 4. Open, and whose

- **Publishing release 2026.10.0** (the owner's go): its corpus files wait on D19 and D2, its verses on the Complex's answer (D19); Lane's files can be published at once, after the owner offers Perseus our modifications (its terms).
- **The DOI** (D14): the owner's Zenodo account.
- **Publishing a map through the API** (DAT-36): with P8.5.
- **Recording the release in production**: part of the deploy, the owner's go.
