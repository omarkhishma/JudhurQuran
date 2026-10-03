# 14 · The editorial workbench (P3.0)

Date: 2026-10-03. Scope: PLAN P3.0 — "an internal, role-protected tool where the editorial board writes and reviews, with sources and two-person review, everything marked 'editorial' — root glosses, pattern functions and plain explanations, sense lists, sense ↔ source links, collections, glossary … records every change with its author and source. Candidates are pre-filled only by extraction from cited sources (never generated)." The design handoff has no screen for it (it is an internal tool); its visual language is the review queue's (RVQ).

## 1. What waits on the board today

Measured on the loaded dataset 2026.10.0 (one query per row, `content.*`):

| Worklist | Where it lives | Now | What the board does |
|---|---|---|---|
| Root English gloss (P3.4, RDR-474) | `roots.gloss_en` | 0 of 1,642 | writes a short English gloss, citing Lane and the corpus's word glosses |
| Root core idea (P3.4) | `roots.gist_ar` + `gist_source` | 1,485 of 1,642 extracted; 18 announce more uṣūl than were cut | confirms Ibn Fāris's statement, or corrects the cut; the 157 without one are written from Maqāyīs |
| Pattern function (P3.3) | `patterns.function_ar/_en` | 0 of 228 | quotes or states what the pattern does, from the sarf books' rows (`pattern_functions`, 172 rows) |
| Pattern plain explanation (P3.3) | `patterns.plain_ar/_en` | 0 of 228 | our own plain words (flagged as ours, like `terms.ts`) |
| Sense list per lemma (P3.1, D6) | `senses` | 0 lists for 4,832 lemmas | assembles numbered senses, each with its sources: al-Mufradāt on the word, al-Muyassar at its places, Lane, the wujūh books |
| Glossary (P2) | `glossary_terms` | 55 terms, unreviewed | reviews or rewrites each plain explanation |
| Rows extracted from books | `pattern_functions` 172, `particle_entries` 198, `mufradat_subentries` 5,624, `gharib_meanings` 11,384, `loanword_links` 122, `relation_candidates` 7,558 (wujūh 4,004 · near-synonyms 2,279 · furūq 920 · aḍdād 355), `entity_candidates` 107 | all `extracted` / `candidate` | a verdict per row: reviewed, corrected (with the correction), or rejected — each with a note |
| Collections (P5.2) | `data/collections.yaml` → `collections` | 6 sets | rules and copy reviewed (their membership is computed) |

P8.3 (topic graphs) and P8.4 (meaning graphs) need the relation candidates reviewed before a reader can see them as relations; P3.4a's sense ↔ source links are the sense list's sources.

## 2. Principles

- **Nothing generated (L2).** A candidate is a verbatim slice of a cited source, or a count from the corpus. The board writes; the tool never suggests wording of its own. Plain explanations are the board's own words and are labelled so wherever they are shown.
- **Two people.** An entry is in force only when an editor other than its author approves its current revision. The database refuses a self-decision and a second approval of one revision by one person, whatever the API does (as P7's queue).
- **Beside the source, never over it.** A reviewed row keeps the source's wording; a correction is shown as the board's, with the source's text still there. Nothing the board writes overwrites a content table.
- **Survives a release.** The loader replaces `content.*` at every dataset release; the board's work lives in its own schema (`editorial`), keyed by stable keys — a root's key, a pattern's or a lemma's slug, a glossary key, an extracted row's id (the pipeline's ids are deterministic: `shafiya:0051`, `nuzha:0001:s01`) — and is read beside the content at request time.
- **Every change recorded.** Each save, submission, decision and retirement is a row in the log with its actor, the revision and when.

## 3. Model

- `editorial.entries` — one row per piece of editorial work: `kind` (root_gloss · root_core · pattern_function · pattern_plain · sense_list · glossary · verdict), `target` (the stable key; a verdict's is `{layer}:{row id}`), `value` (jsonb in the kind's shape), `sources` (structured: work id, locator or page, quoted text when it is a quotation), `status` (draft · review · changes · approved · retired), `revision`, `author_id`, times. One open entry (draft, review, changes) per kind and target; the latest approved one is in force, an older one retired when a newer is approved.
- `editorial.reviews` — a decision on a revision: approve or request changes, with a note; one approval per reviewer and revision; never by the entry's author (trigger).
- `editorial.log` — the audit trail.

Shapes of `value`: root_gloss `{en}`; root_core `{ar, kept: "source"|"corrected"}`; pattern_function `{ar, en, rows: [row ids quoted]}`; pattern_plain `{ar, en}`; sense_list `{senses: [{ar, en, sources: [...]}]}`; glossary `{body_ar, body_en}`; verdict `{verdict: reviewed|corrected|rejected, note, correction?}`.

## 4. Who

Roles already exist (P7): member · reviewer · editor · instructor · admin. The board is editor and admin; only they open the workbench, write and decide. Appointing the board is the owner's (D15); until then the tool is exercised with test accounts in the test suites only.

## 5. Read path

The content API reads what is in force and serves it beside the source: a root's English gloss and a corrected core idea (with the board's credit), a pattern's function and plain explanation, a lemma's sense list (numbered, with sources) in place of "not yet assembled", the glossary's reviewed bodies, and on every extracted row its review state — "reviewed by the board", "corrected by the board" with the correction, or left out when rejected — where the reader says "extracted, not reviewed" today.

## 6. Build order

- **P3.0a — the store and its rules (API):** migration 0023 (`editorial` schema, entries, reviews with the no-self trigger and one approval per reviewer and revision, log); `jadhr_api.editorial` (worklists with counts, entries by kind and state, an entry with its candidates and history, save a draft, submit, decide, withdraw, retire); candidates per kind from the cited sources; endpoints under `/api/v1/editorial/*`, board only, no cache. Tests: members refused; a draft submitted and approved by another editor comes into force; self-approval refused by the API and by the database; changes requested, revised, approved; a newer approval retires the older; a verdict's row read back.
- **P3.0b — the workbench (web):** `/workbench`, for the board only (others are told what it is and who it is for): worklists with counts; a list per kind ordered by frequency in the Quran, filtered by state; the entry view — candidates from the sources on one side, the form on the other (fields of the kind, sources picked from the candidates or typed as work and page), save, submit, the history; the review view — the revision against what is in force, approve or request changes with a note; extracted rows in a table with a verdict each, a note, a correction when corrected, submitted in batches and approved in batches by another editor. Both themes, desktop and phone, axe.
- **P3.0c — the read path:** the content API overlays what is in force (§5); the reader shows the root gloss, the pattern's function and plain explanation, the sense list, the glossary bodies and the review marks. Tests read the in-force values back through the public API and on screen.

## 7. Not in this step

The editorial program itself — the board's appointment, the advisors (D15), the work of writing 1,642 glosses and 4,832 sense lists — is the owner's to staff. The workbench is built and tested so that it can start the day the board is appointed.

## 8. Status (2026-10-04)

The tool is built, end to end; the editorial program itself waits on the board (§7, D15).

- **P3.0a — the store and its rules** (commit d0f228f): migration 0023, `jadhr_api.editorial`, `/api/v1/editorial/*` as §6 says, with candidates per kind read verbatim from the sources (Maqāyīs and Lane on a root, the corpus's word glosses, the sarf books' rows on a pattern, al-Mufradāt, al-Muyassar and the wujūh books on a word).
- **P3.0b — the workbench** (commit dae1cd7): `/workbench` for the board, as §6 says, in both themes and on the phone (a picker in place of the side list).
- **P3.0c — the read path** (commit 3aedb59): `jadhr_api.board` reads what is in force beside the content on every payload that shows it — the word, the root, its family, a pattern and the patterns' list, the glossary — and the reader shows it where §5 says:

| Board's work | Where the reader sees it | How it is said |
|---|---|---|
| Root English gloss | the root page's header; Word family; the map editor's Meaning | "English gloss by the editorial board, from {works}" |
| Root core idea | the root page; Word family; the map editor's Meaning | the board's cut in place of the extracted one when corrected, and a line saying it reviewed or corrected the cut |
| Pattern function, plain explanation | Shapes' pattern view; the map editor's Meaning | "From the sarf books, approved by the editorial board, from {works}"; "In the editorial board's words" |
| Sense list | Meanings (in place of "not yet assembled"); the map editor's Meaning | numbered, each sense with its works; "The editorial board's sense list, each sense with its sources" |
| Verdicts on extracted rows | al-Mufradāt's passages, al-Muyassar's meaning here, the particle works, loanwords, the sarf books' rows (Shapes and the map editor) | "Reviewed by the editorial board", or "Corrected by the editorial board: {correction}" with the note — the book's words stay; a rejected row is left out; each section says how many of its rows the board has reviewed |
| Glossary bodies | the glossary and every term's popover | the reviewed body, with its date in the payload |

Settled while building it (DECISIONS 2026-10-04): the public payloads name the board, never its members; an approval clears the API's short cache of the small kinds, asks the web to expire its pages and changes every content ETag; a source names its work by the content tables' id, the API gives the reader the title, and the workbench offers the known ids and flags an unknown one.
