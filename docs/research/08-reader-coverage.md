# 08 · Reader coverage — RDR-001…615 against the built reader

Audited 2026-10-03 against commit `7d596a7` (branch `build/vision`). While the audit ran, commits `19ef50c`, `0f73246` and `91a937d` landed (licence fixes, the search screen, the concordance API) and concordance work sat uncommitted in the tree; of the files cited here they change only the recitation credit in `audio/AudioBar.tsx` (its line refs are given as at `91a937d`) and add lines to `globals.css`, `main.py` and `content.py` after every line cited; the reader components, `lib/reader`, `lib/store`, the reader e2e specs and the `rd` messages are unchanged. Scope: every item of `docs/research/05-design-inventory.md` Part 1 (the Reader, RDR-001…615), judged with PLAN §4 (decisions D1–D29), the PLAN P2 section and `docs/DECISIONS.md`.

**Method.** Read in full: inventory Part 1, PLAN, DECISIONS; every file in `apps/web/src/components/reader5/` (with `sections/`), `components/ui/`, `components/terms/`, `components/audio/`, `lib/reader/`, `lib/store/`; the reader rules of `apps/web/src/app/globals.css`; the `rd` namespace of `messages/ar.json` and `messages/en.json`; the routes under `app/[locale]/(reader)/`; the e2e specs reader, terms, perf, a11y, personal and journey. Read in part, to check what the reader relies on: the API modules it calls (`main.py`, `lexicon.py`, `content.py`, `search.py`, `search_os.py`), `lib/termDetect.ts`, `lib/fonts.ts`, `components/graph/GraphHome.tsx` (where the reader's graph links land) and the built dataset `data/build/2026.10.0` (root glosses, pattern texts, dictionaries, corpora, how the text attaches waqf signs). Nothing was run — no server, no test. Evidence is a file and line read in this audit, or the title of an e2e test that exercises the item; a test title shows the coverage exists, not that it passed today.

**Status rules.** `done` — built as the design says, or better. `adapted` — built differently on purpose, with the reason named (a decision, a Quran-adaptation item RDR-541…576, or a plain reason). `bug-fixed` — a defect the inventory flags (RDR-516…540 and the BUG items elsewhere) that our build fixes or cannot have. `n/a` — cannot apply to the Quran product (prototype placeholders, sample data, the heuristic analyser the corpus replaces). `open` — not built, or built only in part; the row names the missing part. `owner` — needs the product owner's decision. Strictness: a missing function, state, control, data field or accessibility property makes an item `open`; pixel sizes, colour percentages and copy wording do not (every string is rewritten in Arabic by design, RDR-542). Items for other texts (ḥadīth, books, pasted texts) are `open` with their phase, not `n/a`, because the plan keeps the multi-text reader (RDR-575, P4.4, P11). "(minor)" marks a small open item.

**Paths.** Bare file names are in `apps/web/src/components/reader5/` (`sections/…` below it); `ui/`, `terms/` and `audio/` are in `apps/web/src/components/`; `store.ts` is `apps/web/src/lib/reader/store.ts`; `lib/…` is `apps/web/src/lib/…`; `globals.css` is `apps/web/src/app/globals.css`; `*.py` files are in `services/api/src/jadhr_api/`. Quoted e2e titles come from `apps/web/e2e/*.spec.ts`.

## Summary

| Status | Items |
|---|---|
| done | 256 |
| adapted | 137 |
| bug-fixed | 40 |
| n/a | 12 |
| open | 170 |
| owner | 0 |
| **total** | **615** |

Closed (done + adapted + bug-fixed + n/a): 445 of 615. Open: 170 — 95 buildable in the reader now, 35 waiting on content phases (P3), 40 scheduled in later phases (P4, P5, P7, P8, P11). Owner: 0.

| § | Inventory section | Items | done | adapted | bug-fixed | n/a | open | owner |
|---|---|---|---|---|---|---|---|---|
| 1 | Global shell, layout and breakpoints (RDR-001…015) | 15 | 11 | 3 | 0 | 0 | 1 | 0 |
| 2 | Header (RDR-016…031) | 16 | 11 | 3 | 0 | 0 | 2 | 0 |
| 3 | Reading preferences popover (RDR-032…045) | 14 | 9 | 5 | 0 | 0 | 0 | 0 |
| 4 | Dictionaries shown (RDR-046…059) | 14 | 7 | 1 | 1 | 0 | 5 | 0 |
| 5 | Rail (library, contents, roots on this page) (RDR-060…074) | 15 | 2 | 6 | 1 | 0 | 6 | 0 |
| 6 | Modes and first-visit logic (RDR-075…088) | 14 | 4 | 7 | 1 | 0 | 2 | 0 |
| 7 | Reading surface (paper, chapter header, passages) (RDR-089…099) | 11 | 4 | 7 | 0 | 0 | 0 | 0 |
| 8 | Tokens and word states (RDR-100…116) | 17 | 7 | 8 | 0 | 0 | 2 | 0 |
| 9 | Hover card (desktop word preview) (RDR-117…122) | 6 | 0 | 0 | 0 | 0 | 6 | 0 |
| 10 | Unknown-word popover (“no entry · analysed”) (RDR-123…135) | 13 | 0 | 8 | 0 | 5 | 0 | 0 |
| 11 | Grammar band, inline gloss, resume marker, progress hairline, inline notes, marks row (RDR-136…142) | 7 | 1 | 2 | 0 | 0 | 4 | 0 |
| 12 | Passage tools and long-press (RDR-143…159) | 17 | 2 | 5 | 0 | 0 | 10 | 0 |
| 13 | Ask mode (the plain front door) (RDR-160…188) | 29 | 16 | 5 | 1 | 0 | 7 | 0 |
| 14 | Dictionary panel chrome (RDR-189…202) | 14 | 4 | 5 | 0 | 1 | 4 | 0 |
| 15 | Layered panel mechanics (RDR-203…210) | 8 | 5 | 1 | 1 | 0 | 1 | 0 |
| 16 | Meanings section (RDR-211…220) | 10 | 2 | 1 | 0 | 1 | 6 | 0 |
| 17 | Word family section (RDR-221…225) | 5 | 1 | 0 | 0 | 0 | 4 | 0 |
| 18 | Shapes (patterns) section (RDR-226…232) | 7 | 2 | 0 | 1 | 0 | 4 | 0 |
| 19 | Old dictionaries section (RDR-233…253) | 21 | 7 | 0 | 1 | 2 | 11 | 0 |
| 20 | Across the centuries section (RDR-254…267) | 14 | 3 | 6 | 0 | 0 | 5 | 0 |
| 21 | In this text section (RDR-268…271) | 4 | 0 | 2 | 1 | 0 | 1 | 0 |
| 22 | Plain-language layer (Explain terms) (RDR-272…310) | 39 | 30 | 5 | 0 | 0 | 4 | 0 |
| 23 | Suggest an edit, propose a sense, report an error (RDR-311…325) | 15 | 8 | 3 | 0 | 0 | 4 | 0 |
| 24 | Curiosity trails (Where next, breadcrumb, trail map) (RDR-326…343) | 18 | 7 | 8 | 0 | 0 | 3 | 0 |
| 25 | Review deck (study) (RDR-344…360) | 17 | 0 | 0 | 0 | 0 | 17 | 0 |
| 26 | Graph hand-off sheet (“Hand off to the graph editor”) (RDR-361…370) | 10 | 0 | 0 | 0 | 0 | 10 | 0 |
| 27 | Omnibox (⌘K) (RDR-371…382) | 12 | 7 | 3 | 1 | 0 | 1 | 0 |
| 28 | Cite / share dialog (RDR-383…399) | 17 | 6 | 6 | 3 | 0 | 2 | 0 |
| 29 | Onboarding beats (RDR-400…408) | 9 | 5 | 3 | 1 | 0 | 0 | 0 |
| 30 | Phone behaviour (< 900px) (RDR-409…421) | 13 | 8 | 1 | 2 | 0 | 2 | 0 |
| 31 | Keyboard (RDR-422…428) | 7 | 4 | 1 | 0 | 0 | 2 | 0 |
| 32 | Persistence (keys and shapes as implemented) (RDR-429…444) | 16 | 2 | 8 | 1 | 0 | 5 | 0 |
| 33 | URL parameters (RDR-445…450) | 6 | 4 | 1 | 0 | 0 | 1 | 0 |
| 34 | Empty, loading and error states; toasts (RDR-451…458) | 8 | 3 | 1 | 2 | 0 | 2 | 0 |
| 35 | Accessibility (as implemented, and gaps) (RDR-459…468) | 10 | 9 | 0 | 0 | 0 | 1 | 0 |
| 36 | Dark mode (RDR-469…473) | 5 | 2 | 1 | 2 | 0 | 0 | 0 |
| 37 | Data the Reader needs (entities, from the code) (RDR-474…485) | 12 | 4 | 1 | 0 | 1 | 6 | 0 |
| 38 | Cross-check summary — spec (01/02/03) vs prototype code (RDR-486…515) | 30 | 12 | 12 | 0 | 0 | 6 | 0 |
| 39 | Prototype bugs not to copy (consolidated) (RDR-516…540) | 25 | 0 | 0 | 20 | 0 | 5 | 0 |
| 40 | Quran adaptation notes (RDR-541…576) | 36 | 27 | 2 | 0 | 0 | 7 | 0 |
| 41 | Hard-won fixes and subtle rules (keep these) (RDR-577…615) | 39 | 20 | 6 | 0 | 2 | 11 | 0 |
| | **Total** | **615** | **256** | **137** | **40** | **12** | **170** | **0** |

## Re-audit 2026-10-04

Re-audited against `96185bb` by reading the code again (every item research 08 left open, and 66 closed items spot-checked across 26 sections — none had regressed); then the ten items still open were built or adapted (`3949306`…`01c4d36`). The tables below supersede this file's earlier statuses for the items they name; the "All items" table at the foot keeps the 2026-10-03 statuses.

| Status | 2026-10-03 | Re-audit | Now |
|---|---|---|---|
| done | 256 | 350 | 353 |
| adapted | 137 | 165 | 172 |
| bug-fixed | 40 | 47 | 47 |
| n/a | 12 | 12 | 12 |
| open | 170 | 10 | 0 |
| waiting (the editorial board's content, D15) | — | 31 | 31 |
| **total** | **615** | **615** | **615** |

### The ten open at the re-audit, now closed

| ID | Now | How |
|---|---|---|
| RDR-063 | adapted | The rail's Texts view lists the Quran, the hadith collections, the books and the reader's own texts, each opening in its own reader with the word panel, and the way back to where the reader stopped (Rail.tsx TextsList; e2e reader-batch5) |
| RDR-064 | adapted | Choosing a text opens its reader, so the sūra's selection, focus root and drawers are left behind; the overlay rail closes (Rail.tsx) |
| RDR-442 | adapted | The reader's own texts are read in their own reader with the word panel beside them, as the hadith and the books (UserTextReader.tsx, P11.3; DECISIONS "A reader's own text is read in the same reader…"); the Quran reader's layers are the Quran's |
| RDR-146 | adapted | No count on Related: nearly every verse shares a root with hundreds of others, so the number says nothing; the drawer lists the four sharing the rarest roots (DECISIONS) |
| RDR-158 | adapted | A word in the verse's map preview selects itself in the verse; two columns, roots and words, because the editor builds no pattern cards from a verse (VerseDrawer.tsx GraphDrawer; e2e reader-batch5) |
| RDR-183 | done | The deck's ▶ is 44 px (globals.css `.ask-deck-card .listen-btn`; e2e reader-batch5) |
| RDR-186 | done | The shape card's line: the pattern's transliteration • «the mould this word was poured into» (AskView.tsx; e2e reader-batch5) |
| RDR-398 | adapted | «Embed…» in the cite dialog opens the published maps (/g), the way a word, root or verse is framed on another site (Overlays.tsx; e2e reader-batch5) |
| RDR-450 | adapted | As RDR-398: the outbound link to the published maps |
| RDR-569 | done | The in-context card offers the verse recited as a hint (ReviewDeck.tsx ContextCard; e2e reader-batch5) |

Found by the re-audit and fixed: the hover card's "full entry" and "open in the map" now open the panel when the reader has closed it (`32ed9cd`).

### Waiting on the editorial board (31)

All need the board's work in the workbench (built, P3.0); the board waits on the owner appointing it (D15). The code that shows each is built unless said.

| Waits on | IDs |
|---|---|
| P3.4 the English root gloss (0 of 1,642 roots have one) | RDR-474 (the data), 221 (shown by Word family once it exists), 154, 184, 197 (a few lines each once it exists) |
| P3.1 sense lists | RDR-475 (the data), 212, 213, 216 (Meanings.tsx renders them), 174 (the Ask card's «also: …», a few lines) |
| P3.3 pattern functions and plain explanations | RDR-476 (the data), 223, 225 (rendered by PatternFunction and the pattern view) |
| P3.4a sense ↔ source alignment | RDR-479 (the data), 234, 245–247, 248–252, 254, 258–261, 304, 607, 608 |

### Status changes at the re-audit (160, every one open → something)

| ID | Now | Evidence |
|---|---|---|
| RDR-012 | done | Term card portalled to the body at z 75, above the header's 40 (terms/Term.tsx:105-117; globals.css:357-358); e2e reader-polish |
| RDR-025 | done | The badge counts roots due now, with the deck behind it (ReaderHeader.tsx:39-40, 151-161; lib/review/due.ts:47-50); e2e review-deck |
| RDR-028 | done | With a word selected, Graph opens the hand-off with a word seed (ReaderHeader.tsx:109-111, 188-199); e2e graph-handoff |
| RDR-047 | done | Dictionaries in compiler death order (lexicon.py:261-262; data/lexica.yaml sort_order); e2e reader |
| RDR-048 | done | Kitāb al-ʿAyn loaded (data/lexica.yaml) |
| RDR-049 | done | Tahdhīb al-Lugha loaded (data/lexica.yaml) |
| RDR-054 | done | al-Qāmūs loaded (data/lexica.yaml) |
| RDR-055 | done | Tāj al-ʿArūs loaded (data/lexica.yaml) |
| RDR-062 | adapted | Text kinds label the Library's shelves (library/LibraryScreen.tsx; LIB-Q02) |
| RDR-065 | adapted | Import lives in the Library: paste, a web page or a PDF (library/AddTextSheet.tsx; P4.4, P11.3c); e2e library |
| RDR-071 | done | Each sūra row shows where the reader stopped and a read bar (Rail.tsx; store.ts); e2e reader |
| RDR-073 | done | Every root reachable, each with its transliteration (Rail.tsx); e2e reader |
| RDR-082 | done | `?mode=review` opens the real deck (ReaderShell.tsx:54; ReviewDeck.tsx) |
| RDR-087 | done | Full-screen review overlay at z 92; onboarding hidden while it is open (ReviewDeck.tsx; Overlays.tsx; globals.css) |
| RDR-106 | done | A word set back to "new" is marked new again (ReadingSurface.tsx); e2e reader |
| RDR-113 | adapted | Each lookup writes the reading context and today's session (WordEntry.tsx; store.ts); no automatic "learning" (D20); e2e reader |
| RDR-117 | done | Hover card after a mouse rest, centre clamped, flipped below near the top (ReadingSurface.tsx; HoverCard.tsx); e2e hover-card |
| RDR-118 | done | 284 px card (globals.css) |
| RDR-119 | done | Dictionary form, transliteration, root, the meaning here and grammar (HoverCard.tsx) |
| RDR-120 | adapted | State control only in study mode, per D20 (HoverCard.tsx; WordEntry.tsx) |
| RDR-121 | done | Full entry, and Open in graph to the hand-off (HoverCard.tsx) |
| RDR-122 | done | 160/120 ms hand-off; Esc, a click or a scroll closes it (ReadingSurface.tsx); e2e hover-card |
| RDR-136 | done | The grammar band reads a word with no lemma by its place (GrammarBand.tsx); e2e reader |
| RDR-137 | done | Inline gloss for a word with no lemma (InlineGloss.tsx); e2e reader |
| RDR-138 | done | Resume marker hidden on the verse in hand, with "resume here" (ReadingSurface.tsx); e2e reader |
| RDR-142 | done | Marks row for links and topics (ReadingSurface.tsx); e2e verse-links |
| RDR-144 | done | Recite shows as pressed and stops playback (ReadingSurface.tsx); e2e reader-polish |
| RDR-145 | done | Badge with the verse's distinct-root count (SurahText.tsx); e2e verse-links |
| RDR-147 | done | Icons on every tool; badges hidden at 0 (globals.css); e2e reader-batch3 |
| RDR-150 | done | Concordance, Analyse, Links, Topic and Cite added (ReadingSurface.tsx; VerseDrawer.tsx); e2e reader-batch3 |
| RDR-155 | adapted | Empty and error states (VerseDrawer.tsx); related verses from the whole Quran, rarity-weighted (RDR-555) |
| RDR-156 | adapted | Link by typed reference or suggested related verses; incoming links shown; keys quran:s:a (VerseDrawer.tsx); e2e verse-links |
| RDR-157 | adapted | The reader's own topics, with the sources' topics beside them (VerseDrawer.tsx); the five fixed labels dropped (RDR-555/576); e2e verse-links |
| RDR-169 | done | Vowelled form, then exact letters, nouns before verbs, then frequency (search.py); e2e ask-and-search |
| RDR-172 | done | "Analyse it anyway →" goes to /analyse (AskView.tsx) |
| RDR-185 | done | ▶ plays the verse on phone card 3 (AskView.tsx); e2e ask-and-search |
| RDR-193 | done | Panel-search rows with part of speech and root; loading, error and no-result rows; arrow keys (Panel.tsx); e2e ask-and-search |
| RDR-198 | done | Open in graph goes to the hand-off; 44 px on phones (WordEntry.tsx; globals.css); e2e reader |
| RDR-201 | done | Each tab carries its count (WordEntry.tsx); e2e reader |
| RDR-209 | done | A jump keeps its tab in tabs mode (store.ts); e2e reader |
| RDR-214 | adapted | A merged edit above the source's wording with its credit, never replacing it (sections/Meanings.tsx; DECISIONS "Contributions never overwrite a source") |
| RDR-215 | adapted | Merged senses numbered after the sourced lines; pending ones under «ما اقترحته» (Meanings.tsx; L2); e2e reader-batch3 |
| RDR-220 | done | "Select the word in the text" state (Meanings.tsx); e2e entry-sections |
| RDR-222 | bug-fixed | A real root seed (Family.tsx); e2e graph-handoff |
| RDR-227 | adapted | "{k} of 10 verb forms": the closed list is the ten verb forms (Shapes.tsx); e2e entry-sections |
| RDR-228 | adapted | Unattested verb forms as "not attested" rows (Shapes.tsx) |
| RDR-230 | adapted | "Show all 10 / Hide unattested" (Shapes.tsx) |
| RDR-231 | done | All roots / In this sūra chips, current row tinted, the full list (Shapes.tsx); e2e entry-sections |
| RDR-235 | done | Articles in compiler death order; the label is true (content.py; sections/Dictionaries.tsx); e2e reader |
| RDR-239 | done | "+" quotes the article onto a map (sections/Dictionaries.tsx); by its identifier since P1.7a |
| RDR-269 | adapted | Inflection and a graph seed at that place on each concordance row (sections/InQuran.tsx; RDR-265/558); e2e entry-sections |
| RDR-274 | done | Dotted terms in the grammar band and the dictionaries (GrammarBand.tsx; sections/Dictionaries.tsx); e2e reader-batch3 |
| RDR-306 | done | `sense` term (data/glossary.yaml; Meanings.tsx); e2e reader-batch3 |
| RDR-309 | done | `corpus` term (data/glossary.yaml; Meanings.tsx); e2e reader-batch3 |
| RDR-322 | adapted | Drafts and queued proposals under «ما اقترحته» (contrib/WordContributions.tsx; research 12) |
| RDR-323 | adapted | Credit line beside the source, never over it (WordContributions.tsx) |
| RDR-324 | done | Merges and the reader's proposals re-read on window focus (WordContributions.tsx; audit 12 F2, P7.5) |
| RDR-325 | adapted | The two-approval rule enforced by the server and the database (research 12) |
| RDR-329 | done | The cousin door says "same shape" or "shaped as {pattern}" (sections/WhereNext.tsx); e2e entry-sections |
| RDR-332 | done | The shape door opens Shapes on the pattern with "{n} more like it" (WhereNext.tsx; store.ts); e2e entry-sections |
| RDR-341 | done | Trail seed through the hand-off (TrailMap.tsx); e2e graph-handoff |
| RDR-344 | done | Review entry points; End and Esc close it (ReaderHeader.tsx; ReviewDeck.tsx) |
| RDR-345 | done | Queue from starred and known words, else the sūra's roots (ReviewDeck.tsx); e2e review-deck |
| RDR-346 | done | The badge is a due count (lib/review/due.ts); e2e review-deck |
| RDR-347 | done | Overlay frame with focus trapped and returned (ReviewDeck.tsx; ui/useFocusTrap.ts) |
| RDR-348 | done | Changing mode resets the card (ReviewDeck.tsx) |
| RDR-349 | adapted | Ibn Fāris's statement where the English root gloss would go (ReviewDeck.tsx; research 10) |
| RDR-350 | done | Hidden rows, Reveal, then Entry (ReviewDeck.tsx); e2e review-deck |
| RDR-351 | done | Space flips; four grades on keys 1–4 (ReviewDeck.tsx); e2e review-deck |
| RDR-352 | done | The verse with blanks and a side column that drops below at 760 px (ReviewDeck.tsx; globals.css) |
| RDR-353 | bug-fixed | One of the five verses richest in the root, so it never dead-ends (research 10) |
| RDR-354 | done | Numbered blanks with a hint on each (ReviewDeck.tsx); e2e review-deck |
| RDR-355 | done | Mushaf or everyday spelling accepted (ReviewDeck.tsx); e2e review-deck |
| RDR-356 | done | "Revealed so far" (ReviewDeck.tsx) |
| RDR-357 | done | Check, then one button graded by the score (ReviewDeck.tsx) |
| RDR-358 | done | Session summary (ReviewDeck.tsx) |
| RDR-359 | done | SM-2 scheduler (lib/store/review.ts; review.test.ts) |
| RDR-360 | done | Starred and known words enter the deck; Keep stars the word (DECISIONS); e2e explore, journey-b |
| RDR-361 | done | Hand-off from the entry, root, hover card, verse drawer, occurrence row, trail and header |
| RDR-362 | done | 520 px shared Dialog (GraphHandoff.tsx) |
| RDR-363 | done | Sub-line per seed (GraphHandoff.tsx) |
| RDR-364 | adapted | Rows counted from the cards the editor will create (GraphHandoff.tsx; DECISIONS); e2e graph-handoff |
| RDR-365 | adapted | Verse seed = the verse card with its words' lemmas and roots (seed.ts verseSeed; P8.1a); e2e graph-handoff |
| RDR-366 | adapted | An occurrence hands over a word seed at that place (InQuran.tsx) |
| RDR-367 | done | Footnote; add to a new or existing graph, nothing moved (GraphHandoff.tsx); e2e graph-handoff |
| RDR-368 | done | Copy seed JSON, Cancel, Open graph editor (GraphHandoff.tsx); e2e graph-handoff |
| RDR-369 | adapted | `/graph/seed?s=` carries the seed; the editor builds the cards (DECISIONS) |
| RDR-370 | adapted | The copied JSON is the seed, not expanded cards (GraphHandoff.tsx) |
| RDR-377 | done | Omnibox pattern rows open Shapes on that pattern (Overlays.tsx); e2e entry-sections |
| RDR-385 | done | Cite scope: word, root or verse (Overlays.tsx); e2e reader-batch3 |
| RDR-415 | done | Phone sheet targets at 44/40 px (globals.css); e2e reader |
| RDR-420 | done | Review overlay laid out for phones (globals.css) |
| RDR-427 | done | Enter checks the in-context answers (ReviewDeck.tsx) |
| RDR-428 | done | Arrow keys in panel search, Space to flip, Alt+P (Panel.tsx; ReviewDeck.tsx; Overlays.tsx); e2e ask-and-search |
| RDR-432 | done | Verse links and topics stored under quran:s:a keys (store.ts); e2e verse-links |
| RDR-437 | adapted | Sessions kept in jadhr-personal; a count of lookups, not invented minutes (store.ts) |
| RDR-441 | adapted | Reading context kept in jadhr-personal with word, root, verse and place (store.ts) |
| RDR-444 | done | Storage writes cannot throw, and the reader is told once (lib/store/safeStorage.ts); e2e reader-polish |
| RDR-451 | done | Error states in the rail, tafsir, drawers, In the Quran and panel search, and a loading row |
| RDR-453 | done | "No articles of this kind" (sections/Dictionaries.tsx) |
| RDR-461 | done | ⋯ menu and Reading popover return focus on Esc; the review overlay traps focus (ReaderHeader.tsx); e2e reader-polish |
| RDR-483 | adapted | The reader's topics and the sources' topics replace the fixed list (store.ts; SourceTopics.tsx) |
| RDR-484 | done | Sessions, links and topics added (store.ts) |
| RDR-495 | adapted | Notes stay inline at every width (DECISIONS "Verse notes stay inline…") |
| RDR-496 | done | As RDR-150 |
| RDR-497 | done | As RDR-071 |
| RDR-505 | done | As RDR-274 |
| RDR-508 | done | As RDR-346, 351 and 359 |
| RDR-509 | done | As RDR-360 |
| RDR-524 | bug-fixed | The hover card flips below near the top (HoverCard.tsx); e2e hover-card |
| RDR-528 | bug-fixed | Seeds reach the editor, and the dialog's rows equal the cards created; e2e graph-handoff |
| RDR-535 | bug-fixed | As RDR-106 |
| RDR-536 | bug-fixed | Scheduler, due count, no dead end (research 10) |
| RDR-540 | bug-fixed | Long-press timer cleared on unmount (ReadingSurface.tsx) |
| RDR-547 | adapted | Sajda sign beside its word, ḥizb outside, waqf signs on their letter, each explained (VerseLines.tsx; DECISIONS); e2e reader-batch4, mushaf-signs |
| RDR-555 | done | Links and Topic tools built |
| RDR-557 | done | Translation chosen and credited (ReadingPrefs.tsx; InlineLines.tsx); e2e reader |
| RDR-567 | done | Gloss and morphology-tag proposals go to the review queue (Meanings.tsx); e2e reader-batch4 |
| RDR-573 | done | Long lists paged from the server, off-screen rows skipped (globals.css); e2e reader-batch3, perf |
| RDR-575 | done | The multi-text model: hadith with isnād/matn and gradings, books (P11.3b), the reader's shelf |
| RDR-583 | done | Hover card centre clamped (HoverCard.tsx); e2e hover-card |
| RDR-584 | done | As RDR-122 |
| RDR-589 | done | As RDR-209 |
| RDR-592 | done | As RDR-138 |
| RDR-596 | adapted | As RDR-322…324 |
| RDR-601 | done | Seed encoded as base64url of UTF-8 (lib/graph/seedCodec.ts); e2e graph-handoff |
| RDR-602 | done | As RDR-169 |
| RDR-611 | done | As RDR-355 |
| RDR-612 | done | `dictOff` keeps only the dictionaries switched off (ReadingPrefs.tsx); e2e reader-polish |
| RDR-154, 174, 184, 197, 212, 213, 216, 221, 223, 225, 234, 245–252, 254, 258–261, 304, 474–476, 479, 607, 608 | waiting | The editorial board's content (table above) |

Research 12 relabelled three closed items (RDR-311 done → adapted, 312 done → bug-fixed, 317 done → adapted); the counts above keep research 08's labels for them.

## Defects found while auditing

Beyond parts not yet built, reading the code found these faults in what is built:

- **Graph hand-offs land nowhere** (RDR-028, 158, 198, 341, 361…370, 450, 528, 601): the reader links to `/graph?w=`, `/graph?verse=` and `/graph?trail=`, but `components/graph/GraphHome.tsx` reads no query parameter, so the editor opens empty.
- **Tabs mode drops jumps** (RDR-209, 589): `jumpTo` adds the target to `layerOpen` and sets `scrollTo`; about 80ms later `scrollTo` is cleared (WordEntry.tsx:55) and the active tab falls back to the first open section in order (WordEntry.tsx:275-276), so a jump to any later section is lost. The e2e test covers layers mode only.
- **Dictionary order contradicts its label** (RDR-047, 235): the list says "by compiler death date" but follows the curated `sort_order` (content.py:674; lexicon.py:479-489).
- **Explicit "new" is unmarked in study mode** (RDR-106, 535): ReadingSurface.tsx:210 marks only words with no state.
- **Lemma-less words** (free pronouns, Quranic initials): the grammar band stays on an empty placeholder and the phone inline gloss renders nothing, because both fetch by lemma slug, which is empty (RDR-136, 137).
- **Rail roots stop at 60** (RDR-073, Rail.tsx:123): 81 of 114 sūras use more roots than that (al-Baqara 585), so most are never listed.
- **The Review badge counts saved words**, not due cards (RDR-025, 346).
- **The translation cannot be chosen** and the inline translation line shows no translator credit (RDR-557).
- **Phone sheet buttons below 44px**: star, Cite and Open in graph are 40px (RDR-198, 415).
- **Stale PLAN lines** (not edited here): P2.1 lists the mushaf position on the hairline and the rail auto-close rules as open (both built); P2.3 lists the chat alphabet as open (built in 21a61fd); P2.6 lists the header toggle, API terms, jumps, the Arabic rewrite and Unicode detection as open (all built); P2.10 lists the translator credit on copy as open (built).

## Open and owner items

No item needs an owner decision: every open item is either reader work that can be built now or work the approved plan already places in a later phase. Groups B and C are the exceptions to put to the owner at the P2.11 checkpoint ("RDR coverage 100% or each exception approved by the owner").

### A · Reader work that can be built now — 95 items

| ID | Missing | Files it would touch | Waits on |
|---|---|---|---|
| RDR-012 | term card z-order (equal to onboarding; under the header inside the phone sheet) | globals.css (.term-card, .reader-sheet); terms/Term.tsx (portal the card to body) | now |
| RDR-028 | the editor reading ?w= (the word never arrives) | components/graph/GraphHome.tsx (read ?w and seed); ReaderHeader.tsx:100 | now |
| RDR-047 | order by compiler death date | services/api/src/jadhr_api/lexicon.py:479-489 (order by death); ReadingPrefs.tsx | now |
| RDR-071 | resume marker and progress per sūra | Rail.tsx (read usePersonal().progress) | now |
| RDR-073 | the full root list (cut at 60) and the transliteration | Rail.tsx:123-140 | now |
| RDR-106 | the "new" mark for an explicitly stored new state | ReadingSurface.tsx:210 | now |
| RDR-113 | the context record and session log on selection | lib/reader/store.ts (openWord); new context and session writers | now |
| RDR-117 | the hover card | new reader5/HoverCard.tsx; ReadingSurface.tsx (pointer handlers); globals.css | now |
| RDR-118 | the hover-card box | new reader5/HoverCard.tsx; globals.css | now |
| RDR-119 | the hover-card content | new reader5/HoverCard.tsx (useWord) | now |
| RDR-120 | the hover-card state control | new reader5/HoverCard.tsx | now |
| RDR-121 | the hover-card actions | new reader5/HoverCard.tsx | now |
| RDR-122 | hover-card timing and dismissal | new reader5/HoverCard.tsx; ReadingSurface.tsx | now |
| RDR-136 | the band for lemma-less words | ReadingSurface.tsx:381; GrammarBand.tsx (fetch by location) | now |
| RDR-137 | the inline gloss for lemma-less words | InlineGloss.tsx; ReadingSurface.tsx:385-389 | now |
| RDR-138 | hiding the marker on the selected verse; a resume action | ReadingSurface.tsx:430-437 | now |
| RDR-142 | the marks row (links, topics) | SurahText.tsx (slot); ReadingSurface.tsx; lib/reader/store.ts | now |
| RDR-144 | a playing state and stop on the Recite tool | SurahText.tsx; ReadingSurface.tsx (aria-pressed from useAudio) | now |
| RDR-145 | the distinct-root count badge | SurahText.tsx (server-rendered distinct-root count) | now |
| RDR-146 | the Links and Topic tools; count badges | ReadingSurface.tsx:477-500; VerseDrawer.tsx; lib/reader/store.ts | now |
| RDR-147 | tool icons and count badges | SurahText.tsx; ReadingSurface.tsx; globals.css | now |
| RDR-150 | Links, Topic, Concordance and Analyse verse tools | ReadingSurface.tsx:477; VerseDrawer.tsx | now (Analyse: P4.3) |
| RDR-154 | transliteration, root gloss and Quran-wide count per root | VerseDrawer.tsx (RootsDrawer); /verses/{key} payload | now (gloss: P3.4) |
| RDR-155 | an empty-state line in the Related drawer | VerseDrawer.tsx:64-83 | now |
| RDR-156 | the Links drawer | VerseDrawer.tsx; lib/reader/store.ts (links keyed by quran:s:a) | now |
| RDR-157 | the Topic drawer with user topics | VerseDrawer.tsx; lib/reader/store.ts | now (themes: P8.3) |
| RDR-158 | Patterns and Words columns, footnote, a seed the editor reads | VerseDrawer.tsx; components/graph/GraphHome.tsx | now |
| RDR-169 | nouns before verbs in the ranking | services/api/src/jadhr_api/search_os.py (lemma ranking); search.py | now |
| RDR-185 | a ▶ to hear the verse | AskView.tsx (PhoneDeck card 3, useAudio.playVerse) | now |
| RDR-193 | part of speech and root in the result rows | Panel.tsx (PanelSearch) | now |
| RDR-198 | a graph hand-off the editor reads; 44px phone buttons | WordEntry.tsx:178-190; components/graph/GraphHome.tsx; globals.css (.btn in the sheet) | now |
| RDR-201 | tab count badges | WordEntry.tsx (Tabs) | now |
| RDR-209 | tabs mode keeping the jumped-to tab | WordEntry.tsx (Tabs active state); lib/reader/store.ts (jumpTo) | now |
| RDR-215 | proposed senses shown in Meanings | sections/Meanings.tsx (read usePersonal().proposals) | now (display), P7 (merge) |
| RDR-220 | a state for an entry opened without a place | sections/Meanings.tsx:105 | now |
| RDR-221 | a Graph-the-root button; the English root gloss | sections/Family.tsx; graph root link | now (button), P3.4 (gloss) |
| RDR-222 | a root seed for the editor | sections/Family.tsx; components/graph | now |
| RDR-227 | the root header with patterns attested | sections/Shapes.tsx | now |
| RDR-228 | unattested rows | sections/Shapes.tsx; /patterns API | now |
| RDR-230 | the show-all / hide-unattested toggle | sections/Shapes.tsx | now |
| RDR-231 | All roots / In this sūra chips; current-word tint; the full list | sections/Shapes.tsx; /patterns/{slug} | now |
| RDR-235 | a true death-date order (the label is false now) | services/api/src/jadhr_api/content.py:674 (order by death_ce); sections/Dictionaries.tsx | now |
| RDR-269 | a per-occurrence Graph seed; the inflection per row | sections/InQuran.tsx; attestations API (features) | now |
| RDR-274 | dotted terms in the grammar band and the dictionaries | GrammarBand.tsx; sections/Dictionaries.tsx | now |
| RDR-306 | a "sense" term | data/glossary.yaml | now |
| RDR-309 | a "corpus" term | data/glossary.yaml | now |
| RDR-322 | pending edits and proposed senses in the entry | sections/Meanings.tsx | now |
| RDR-329 | a correct cousin reason (same or other shape) and gloss | sections/WhereNext.tsx; lexicon.py _next_steps (send the pattern) | now |
| RDR-332 | Shapes opened on that pattern; "{n} more like it" | sections/WhereNext.tsx; sections/Shapes.tsx (view from the store) | now |
| RDR-341 | a trail seed the editor reads | TrailMap.tsx:110; components/graph/GraphHome.tsx | now |
| RDR-361 | the hand-off sheet and its triggers | new reader5/HandoffSheet.tsx; components/graph (seed reader) | now |
| RDR-362 | the sheet frame | new reader5/HandoffSheet.tsx | now |
| RDR-363 | the word-seed sub-line | new reader5/HandoffSheet.tsx | now |
| RDR-364 | the card rows | new reader5/HandoffSheet.tsx | now |
| RDR-365 | the verse seed | new reader5/HandoffSheet.tsx | now |
| RDR-366 | the occurrence seed | new reader5/HandoffSheet.tsx | now |
| RDR-367 | the footnote | new reader5/HandoffSheet.tsx | now |
| RDR-368 | the sheet's actions | new reader5/HandoffSheet.tsx | now |
| RDR-369 | a seed URL the editor reads | components/graph/GraphHome.tsx; components/graph/GraphEditor.tsx | now |
| RDR-370 | the word-seed JSON | new reader5/HandoffSheet.tsx | now |
| RDR-377 | pattern rows opening Shapes on the pattern | Overlays.tsx; sections/Shapes.tsx | now |
| RDR-385 | a scope control; a root citation | Overlays.tsx (CiteDialog); WordEntry.tsx | now |
| RDR-398 | Export JSON, Embed and the licence label | Overlays.tsx (CiteDialog) | now (Embed: P8.5) |
| RDR-415 | 44px star, Cite and Open in graph; 40px Suggest | globals.css (.reader-sheet .btn); sections/Meanings.tsx | now |
| RDR-428 | panel-search arrow keys; Space to flip; a panel-toggle shortcut | Panel.tsx (PanelSearch); ReadingSurface.tsx | now |
| RDR-432 | verse links and topics storage | lib/reader/store.ts | now |
| RDR-437 | the session log | lib/reader/store.ts | now |
| RDR-441 | the reading-context record | lib/reader/store.ts (openWord / openVerse) | now |
| RDR-444 | catching storage write errors | lib/reader/store.ts; lib/store/*.ts (storage wrapper with try/catch) | now |
| RDR-450 | graph parameters read by the editor; review-queue and Embed links | components/graph/GraphHome.tsx; Overlays.tsx | now (graph), P7/P8.5 |
| RDR-451 | error states (rail, tafsir, drawers, In the Quran, panel search); panel-search loading | Rail.tsx; TafsirSection.tsx; VerseDrawer.tsx; sections/InQuran.tsx; Panel.tsx | now |
| RDR-453 | a message for a filter with no articles | sections/Dictionaries.tsx | now |
| RDR-461 | focus return for the ⋯ menu and Reading popover | ReaderHeader.tsx (MoreMenu); ReadingPrefs.tsx | now |
| RDR-483 | user topics; curated themes | lib/reader/store.ts; verse tools | now (user), P8.3 (curated) |
| RDR-484 | sessions, verse links, topics | lib/reader/store.ts | now |
| RDR-495 | margin notes on wide screens | ReadingSurface.tsx:439-454; globals.css (.margin-note) | now |
| RDR-496 | the union of verse tools | ReadingSurface.tsx | now |
| RDR-497 | the rail resume marker | Rail.tsx | now |
| RDR-505 | dotted terms in the band and the dictionaries | GrammarBand.tsx; sections/Dictionaries.tsx | now |
| RDR-524 | a hover card that flips (none yet) | new reader5/HoverCard.tsx | now |
| RDR-528 | any seed to the editor | graph hand-off | now |
| RDR-535 | marking an explicit "new" state | ReadingSurface.tsx:210 | now |
| RDR-540 | clearing the long-press timer on unmount | ReadingSurface.tsx:284-293 | now |
| RDR-547 | waqf and sajda signs as non-interactive furniture, with explanations | VerseLines.tsx (wrap the marks in non-interactive spans without altering the text); data/glossary.yaml | now (explanations: P3.9) |
| RDR-555 | the Links and Topic verse tools | ReadingSurface.tsx; VerseDrawer.tsx; lib/reader/store.ts | now |
| RDR-557 | a translation selector; a visible translator credit | ReadingPrefs.tsx; InlineLines.tsx | now |
| RDR-567 | gloss and morphology proposals; the review queue | Overlays.tsx (SuggestForm); WordEntry.tsx; sections/Meanings.tsx | now (forms), P7 (queue) |
| RDR-573 | virtualised long lists | sections/InQuran.tsx; IndexBody.tsx; sections/Shapes.tsx | now |
| RDR-583 | hover-card clamping | new reader5/HoverCard.tsx | now |
| RDR-584 | the hover hand-off | new reader5/HoverCard.tsx | now |
| RDR-589 | the tabs-mode jump | WordEntry.tsx (Tabs) | now |
| RDR-592 | hiding the marker on the selected verse | ReadingSurface.tsx:430-437 | now |
| RDR-601 | seed encoding | graph hand-off | now |
| RDR-602 | nouns before verbs | search_os.py | now |
| RDR-612 | a compact dictOff map | ReadingPrefs.tsx:64 | now |

### B · Waiting on content phases (P3: senses, dictionaries, patterns, root records, sense-to-source alignment) — 35 items

| ID | Missing | Files it would touch | Waits on |
|---|---|---|---|
| RDR-048 | Kitāb al-ʿAyn | pipeline lexicon split; data/lexica.yaml; DICT_KIND in sections/Dictionaries.tsx | P3.2 |
| RDR-049 | Tahdhīb al-Lugha | pipeline lexicon split; data/lexica.yaml | P3.2 |
| RDR-054 | al-Qāmūs al-Muḥīṭ | pipeline lexicon split; data/lexica.yaml | P3.2 |
| RDR-055 | Tāj al-ʿArūs | pipeline lexicon split; data/lexica.yaml | P3.2 |
| RDR-174 | "also: second sense" (needs sense lists) | AskView.tsx (DesktopCard) | P3.1 |
| RDR-183 | "Also:" senses; a 44px ▶ | AskView.tsx (PhoneDeck); globals.css (.listen-btn) | P3.1 |
| RDR-184 | the root gloss as the card title | AskView.tsx; root records | P3.4 |
| RDR-186 | the pattern's function text; a transliteration sub-line | AskView.tsx; pattern records | P3.3 |
| RDR-197 | the root gloss beside the chip | WordEntry.tsx; pipeline root records | P3.4 |
| RDR-212 | numbered sense lists with sources and a pending state | sections/Meanings.tsx; sense data | P3.1/P7 |
| RDR-213 | sense meta lines | sections/Meanings.tsx | P3.1/P7 |
| RDR-216 | a reachable suggest (needs senses); 40px on phones | sections/Meanings.tsx; globals.css | P3.1 |
| RDR-223 | pattern function texts | pattern records; sections/Family.tsx | P3.3 |
| RDR-225 | a plain description of each pattern | pattern records; pipeline | P3.3 |
| RDR-234 | one line from each dictionary | sections/Dictionaries.tsx | P3.4a |
| RDR-245 | the per-sense grid with agreement | sections/Dictionaries.tsx (Compare) | P3.4a |
| RDR-246 | per-sense cells | sections/Dictionaries.tsx | P3.4a |
| RDR-247 | the uniqueness legend | sections/Dictionaries.tsx | P3.4a |
| RDR-248 | apparatus base chips | sections/Dictionaries.tsx | P3.4a |
| RDR-249 | the apparatus text | sections/Dictionaries.tsx | P3.4a |
| RDR-250 | agreement colours | sections/Dictionaries.tsx | P3.4a |
| RDR-251 | apparatus notes | sections/Dictionaries.tsx | P3.4a |
| RDR-252 | the apparatus legend | sections/Dictionaries.tsx | P3.4a |
| RDR-254 | the Lanes / Streams switch and meta | sections/Centuries.tsx | P3.4a |
| RDR-258 | per-sense lanes; a dot opening its own article | sections/Centuries.tsx | P3.4a |
| RDR-259 | the streams view | sections/Centuries.tsx | P3.4a |
| RDR-260 | stream labels | sections/Centuries.tsx | P3.4a |
| RDR-261 | the streams caption | sections/Centuries.tsx | P3.4a |
| RDR-304 | an "apparatus" term | data/glossary.yaml | P3.4a |
| RDR-474 | root English gloss and Arabic core idea | pipeline roots; content.roots | P3.4 |
| RDR-475 | Arabic definitions, sense lists, noun glosses | pipeline lemmas and senses | P3.1 |
| RDR-476 | pattern function and plain explanation | pipeline patterns | P3.3 |
| RDR-479 | sense-to-source links | editorial workbench | P3.4a |
| RDR-607 | apparatus thresholds | sections/Dictionaries.tsx | P3.4a |
| RDR-608 | stream labels | sections/Centuries.tsx | P3.4a |

### C · Scheduled in later phases (P4 Analyser/Library, P5 review deck, P7 review queue, P8 editor, P11 other texts) — 40 items

| ID | Missing | Files it would touch | Waits on |
|---|---|---|---|
| RDR-025 | a due count and the deck behind the button | ReaderHeader.tsx:140-148; Overlays.tsx (ReviewOverlay); a scheduler store | P5.3 |
| RDR-062 | kind labels for other shelves | Rail.tsx; text-model client; /texts API | P11 |
| RDR-063 | other texts in the rail | Rail.tsx; services/api texts endpoints | P4.4/P11 |
| RDR-064 | switching texts | Rail.tsx; ReaderShell.tsx | P11 |
| RDR-065 | pasted-text import | Library add-a-text; morphology service; Rail.tsx | P4.4/P11.3a |
| RDR-082 | the deck behind ?mode=review | ReaderShell.tsx:54; Overlays.tsx (ReviewOverlay) | P5.3 |
| RDR-087 | the full-screen review overlay | Overlays.tsx (ReviewOverlay); new review components | P5.3 |
| RDR-172 | an "Analyse it anyway" path | AskView.tsx; Analyser screen | P4.3 |
| RDR-214 | merged-edit credit lines | sections/Meanings.tsx; review API | P7 |
| RDR-239 | + Add to graph | sections/Dictionaries.tsx; graph editor | P8 |
| RDR-323 | merge credit lines | sections/Meanings.tsx | P7 |
| RDR-324 | re-reading proposals on focus | lib/reader/store.ts; sections/Meanings.tsx | P7 |
| RDR-325 | review-queue statuses | review queue; API | P7 |
| RDR-344 | the review deck behind its entry points | Overlays.tsx; new review deck | P5.3 |
| RDR-345 | the review queue | review deck | P5.3 |
| RDR-346 | a due count | ReaderHeader.tsx; scheduler | P5.3 |
| RDR-347 | the review overlay frame | review deck | P5.3 |
| RDR-348 | the Root card / In context switch | review deck | P5.3 |
| RDR-349 | the root card | review deck | P5.3 |
| RDR-350 | root-card rows | review deck | P5.3 |
| RDR-351 | grading | review deck | P5.3 |
| RDR-352 | the in-context card | review deck | P5.3 |
| RDR-353 | the in-context verse choice | review deck | P5.3 |
| RDR-354 | blanks | review deck | P5.3 |
| RDR-355 | answer checking | review deck | P5.3 |
| RDR-356 | the side panel | review deck | P5.3 |
| RDR-357 | in-context grading | review deck | P5.3 |
| RDR-358 | the session-complete card | review deck | P5.3 |
| RDR-359 | the scheduler | scheduler; storage | P5.3 |
| RDR-360 | deck entry rules | review deck; Collections | P5.2/P5.3 |
| RDR-420 | a phone layout for the review overlay | review deck | P5.3 |
| RDR-427 | review keyboard | review deck | P5.3 |
| RDR-442 | user texts | Library; reader | P4.4 |
| RDR-508 | review per the spec | review deck | P5.3 |
| RDR-509 | deck entry rules | review deck | P5.2/P5.3 |
| RDR-536 | the scheduler and due count | review deck | P5.3 |
| RDR-569 | the review deck | review deck | P5.3 |
| RDR-575 | the multi-text reader | reader; text model | P11 |
| RDR-596 | proposals re-read and shown | sections/Meanings.tsx; lib/reader/store.ts | P7 |
| RDR-611 | in-context answer checking | review deck | P5.3 |

## All items

Statuses as of 2026-10-03; the re-audit above changes 170 of them.

| ID | status | evidence / reason |
|---|---|---|
| RDR-001 | done | `.reader-v5` full-viewport flex column on `--canvas`, 12.5px; body font stack and antialiasing (globals.css:501-508, 124-132) |
| RDR-002 | adapted | Fonts self-hosted through next/font, so no Google preconnect: KFGQPC Uthmanic Hafs for the mushaf (RDR-543), Amiri 400/700, Plex Sans Arabic, Plex Sans, Plex Mono (lib/fonts.ts:1-45); Amiri italic not loaded (no Arabic italic in the UI) |
| RDR-003 | done | matchMedia breakpoints: wide ≥ 1200, desktop ≥ 900, phone below, live on change (lib/reader/media.ts:15-23) |
| RDR-004 | done | Header, then `.reader-row`: rail · surface (flex 1, min-width 0) · docked panel or the 36px strip (ReaderShell.tsx:65-90; globals.css:613-618) |
| RDR-005 | done | Rail 232px, `--panel`, inline-end border, own scroll (globals.css:628-638); the prototype's width kept over the spec's 240 |
| RDR-006 | done | Below 1200 the rail is an overlay over a 28% scrim that closes it (ReaderShell.tsx:69-74; globals.css:619-625, 639-647); overlay width min(300px, 86vw) |
| RDR-007 | done | The overlay state is separate from the docked preference: below 1200 the rail starts closed, the saved `railOpen` returns at ≥ 1200, a sūra pick closes the overlay (ReaderShell.tsx:61-72; ReaderHeader.tsx:82-85; Rail.tsx:92). PLAN P2.1 still lists this as open — stale |
| RDR-008 | done | `.reader-surface`: flex 1, min-width 0, own scroll, canvas, centred paper (globals.css:722-740) |
| RDR-009 | done | Docked panel default 420 (spec), min 320, max calc(100vw − 420px), or − 652px beside a docked rail; `--panel` with inline-start border (store.ts:182; Panel.tsx:62; globals.css:1031-1044) |
| RDR-010 | done | 7px handle on the inner edge; pointer drag (mouse and touch) with an RTL-aware sign and a cap that keeps 420px for reading; keyboard arrows; role=separator; none on phones (Panel.tsx:94-136; globals.css:1045-1058) |
| RDR-011 | done | 36px strip with chevron and the vertical "Dictionary" label while the panel is closed (ReaderShell.tsx:79-84; globals.css:1185-1210) |
| RDR-012 | open | (minor) Stacking differs from the design: the term card has z 60, the same as the onboarding card, and on phones it renders inside the sheet's stacking context (z 36), so a card flipped above a term paints under the header (z 40). Found by reading the CSS, not reproduced on screen |
| RDR-013 | adapted | Global `:focus-visible` ring on every element, textareas included (closes the prototype gap); selection at 24%; links inherit the text colour; native thin scrollbars (globals.css:137-153, 663-670) |
| RDR-014 | done | `dc-pop`, `dc-rise`, `dc-fade`; `dc-rise` uses translateY only, so popovers and the toast do not jump (globals.css:105-116) |
| RDR-015 | adapted | Fallbacks live in DEFAULT_PREFS (size 1, tint on); theme light by the head script; translation and transliteration default by locale, off in Arabic (RDR-557) (store.ts:168-189; app/[locale]/layout.tsx:41) |
| RDR-016 | done | 52px header (56 on phones), flex, gap 10, padding 0 14, `--panel`, bottom border, z 40 (globals.css:509-525) |
| RDR-017 | done | Rail toggle · logo · title · spacer · A−/A+ · Ask · Search · Review · Reading · explain-terms toggle (spec) · Theme · Graph · ⋯ (phone) · Dictionary last (ReaderHeader.tsx:103-237) |
| RDR-018 | done | Every wide item shows at ≥ 900 (`wide = bp !== "phone"`, ReaderHeader.tsx:44), A−/A+ included |
| RDR-019 | done | 28×28 rail toggle with aria-label, title and aria-expanded (ReaderHeader.tsx:104-106; globals.css:551-557); its three lines are equal length (cosmetic) |
| RDR-020 | adapted | 18×18 `--c-root` mark, made a link home with an aria-label (ReaderHeader.tsx:107-109) |
| RDR-021 | adapted | «سورة …» in Amiri 15 with ellipsis; meta = Makki/Madani · verses · juzʾ, plus known/learning only in study mode (RDR-574, D20) (ReaderHeader.tsx:95-115) |
| RDR-022 | adapted | A− · percent · A+ group with disabled ends; step 0.1 within [0.8, 1.6], the spec's step (ReaderHeader.tsx:16-17, 74-76, 117-127) |
| RDR-023 | done | "Ask" with title and aria-pressed, on/off styles (ReaderHeader.tsx:128-130; globals.css:545-550) |
| RDR-024 | done | Search pill with icon, label and ⌘K badge, min-width 120; opens the omnibox with the input focused (ReaderHeader.tsx:131-139; Overlays.tsx:110); the badge still reads ⌘K on Windows/Linux (aria-keyshortcuts names both) |
| RDR-025 | open | The button and its badge exist, but the badge counts saved words (no scheduler, so no due count) and the deck behind it is a placeholder dialog |
| RDR-026 | done | Sliders icon + "Reading", aria-expanded, pressed style while open (ReaderHeader.tsx:149-157) |
| RDR-027 | done | 32×30 theme button with aria-pressed; labels name the target theme; writes `jadhr-theme` (ReaderHeader.tsx:77-81, 170-174); the icon shows the target theme (moon in light) — cosmetic inversion |
| RDR-028 | open | The link carries the word (`/graph?w={slug}`, ReaderHeader.tsx:100), but the graph editor's home reads no query parameter, so the word never reaches the editor |
| RDR-029 | done | Phone-only ⋯, min 40×40, aria-label "More", aria-expanded (ReaderHeader.tsx:181-202; globals.css:564-569) |
| RDR-030 | done | Book icon + "Dictionary", always last, aria-pressed, 40px on phones; from Ask it returns to the text with the panel (ReaderHeader.tsx:203-218) |
| RDR-031 | done | No site nav in the reader header; outbound links: logo → home, Graph, ⋯ Graph editor and Library, rail "all texts →" (ReaderHeader.tsx:107, 175-180, 295-300; Rail.tsx:62) |
| RDR-032 | done | Popover under its button at inline-end, 280px (prototype 268), max-height calc(100dvh − 70px), scrolls, popover recipe with dc-pop (globals.css:295-301, 1837-1880) |
| RDR-033 | done | Opens from "Reading" (wide) or ⋯ → Reading preferences (phone); Esc and an outside tap close it; focus moves in (ReadingPrefs.tsx:22-35; ReaderHeader.tsx:189-200) |
| RDR-034 | done | "Reading preferences" in label-caps (ReadingPrefs.tsx:45) |
| RDR-035 | done | The whole row is a role=switch button with aria-checked; 28×16 track, 12px knob, label 13, hint 11.5, hover `--card-2` (ui/Switch.tsx:4-16; globals.css:438-478) |
| RDR-036 | adapted | "Translation", on by default in English and off in Arabic (RDR-557); null means the locale default (ReadingPrefs.tsx:39, 46; store.ts:142) |
| RDR-037 | adapted | "Transliteration" with a per-verse line from the API; off by default in Arabic (RDR-557) (ReadingPrefs.tsx:38, 49; InlineLines.tsx:35-39) |
| RDR-038 | done | "Tint the root family", default on (ReadingPrefs.tsx:50; store.ts:174) |
| RDR-039 | done | "Grammar band", default off (ReadingPrefs.tsx:51; store.ts:175) |
| RDR-040 | adapted | No tashkīl toggle on the mushaf (D7, RDR-545); a labelled "Standard spelling" line instead (ReadingPrefs.tsx:48; e2e "standard spelling is a labelled line under the mushaf text, never instead of it (D7)") |
| RDR-041 | adapted | "Word states" is "Study mode", off by default (D20) (ReadingPrefs.tsx:52; store.ts:147, 176; e2e "study mode: words are marked only by the reader, and the rail shows each sūra's coverage (D20, RDR-552/571)") |
| RDR-042 | done | "Panel as tabs", default off (ReadingPrefs.tsx:53) |
| RDR-043 | done | "Explain terms", default on, stored as `explainTerms` (ReadingPrefs.tsx:54; store.ts:178) |
| RDR-044 | adapted | Union of the spec's four and the prototype's eight (D21): Translation, al-Muyassar (Arabic UI), Standard spelling, Transliteration, Tint, Grammar band, Study mode, Tabs, Explain; tashkīl replaced per D7 (ReadingPrefs.tsx:46-54) |
| RDR-045 | done | Divider, then the dictionaries block (ReadingPrefs.tsx:55) |
| RDR-046 | done | "Dictionaries shown" + "{on} of {all}" over the real list (ReadingPrefs.tsx:56-59) |
| RDR-047 | open | Rows are switches named in the UI language with author · death AH/CE (adapted per RDR-560), but they come in the curated `sort_order` (al-Mufradāt, Maqāyīs, Lisān, al-Ṣiḥāḥ, Lane, Ibn Qutayba), not by compiler death date |
| RDR-048 | open | Kitāb al-ʿAyn is not in the dataset (no root-split open edition; the P3.2 parser) |
| RDR-049 | open | Tahdhīb al-Lugha is not in the dataset (P3.2) |
| RDR-050 | done | al-Ṣiḥāḥ loaded, tag "selective" (data/lexica.yaml `sihah`; sections/Dictionaries.tsx:17) |
| RDR-051 | done | Maqāyīs al-Lugha loaded, kind root-semantic (data/lexica.yaml `maqayis`; sections/Dictionaries.tsx:18) |
| RDR-052 | done | al-Mufradāt loaded, kind interpretive ("Quranic vocabulary") (sections/Dictionaries.tsx:19) |
| RDR-053 | done | Lisān al-ʿArab loaded, tag "comprehensive" (sections/Dictionaries.tsx:21) |
| RDR-054 | open | al-Qāmūs al-Muḥīṭ is not in the dataset (P3.2 split and alignment) |
| RDR-055 | open | Tāj al-ʿArūs is not in the dataset (P3.2) |
| RDR-056 | done | Lane's Lexicon loaded, kind English (sections/Dictionaries.tsx:24); Ibn Qutayba's Gharīb added as a sixth work (sections/Dictionaries.tsx:20) |
| RDR-057 | adapted | Death dates AH first with CE second in Arabic («ت ٧١١هـ / ١٣١١م»), CE with AH in English (RDR-560) (sections/Dictionaries.tsx:28-35; ReadingPrefs.tsx:66-70) |
| RDR-058 | done | A dictionary switched off leaves the list, the filter-chip counts, the section meta, side by side and the timeline; an empty state when all are off (sections/Dictionaries.tsx:49-53; WordEntry.tsx:236-241; sections/Centuries.tsx:23) |
| RDR-059 | bug-fixed | No gist list, apparatus or cite-source list ignores the toggles; side by side and the timeline filter by them (sections/Dictionaries.tsx:49, 81; sections/Centuries.tsx:23); the suggest dialog offers every work on purpose (a proposal may cite a hidden one) |
| RDR-060 | adapted | The rail opens with "Contents" + "all texts →" to /library: the library rail becomes the sūra index (RDR-541) (Rail.tsx:60-63) |
| RDR-061 | adapted | Rows are sūras: number, Arabic name, Makki/Madani · verses; the current one on card + border + shadow (Rail.tsx:88-108; globals.css:671-687) |
| RDR-062 | open | No kind labels: the reader reads only the Quran; ḥadīth, book and personal shelves come with the multi-text reader (RDR-575) |
| RDR-063 | open | The rail lists sūras only; no other texts (ḥadīth, books, user texts) |
| RDR-064 | open | No switching between texts (one text); a sūra change is a page navigation |
| RDR-065 | open | No pasted-text import |
| RDR-066 | adapted | "Contents" header with a Sūras / Juzʾ / Page switch (Rail.tsx:60-75) |
| RDR-067 | adapted | A sūra row replaces the chapter card; the difficulty bar is a vocabulary-coverage bar shown in study mode (RDR-571) (Rail.tsx:93-104; globals.css:2116-2124) |
| RDR-068 | adapted | Coverage = the share of the sūra's lemmas marked known; no easy/comfortable/stretch labels (RDR-571) (Rail.tsx:32-41) |
| RDR-069 | adapted | Meta is Makki/Madani · verse count, plus "You know N%" in study mode; judgement labels, new-root and minute estimates dropped (RDR-571) (Rail.tsx:96-104) |
| RDR-070 | bug-fixed | A sūra pick is a page navigation (top of the sūra, or its resume point) and closes the overlay rail (Rail.tsx:92; ReadingSurface.tsx:92-100) |
| RDR-071 | open | The rail carries no resume marker or reading progress per sūra (the spec; PLAN P2.1 "contents with … progress") |
| RDR-072 | done | "Roots in this sūra" (renamed per RDR-541) + "Clear" only while a focus root is set, hover `--bad` (Rail.tsx:114-121) |
| RDR-073 | open | Rows sorted by count with Arabic root, bar and "{n}×", toggling the focus root (Rail.tsx:122-143), but the list stops at the first 60 roots (Rail.tsx:123) while 81 of 114 sūras use more (al-Baqara 585, counted in data/build/2026.10.0/words.jsonl), and no transliteration is shown |
| RDR-074 | done | The focus root underlines (1.6px) and tints every word of the root; session only; also set from the Roots drawer (ReadingSurface.tsx:192; globals.css:892-899; e2e "verse tools: Roots drawer underlines the root in the sūra; Esc closes it") |
| RDR-075 | adapted | `mode` ∈ empty · word · verse · index · surah with `ask` and `review` flags, all written to the URL (P2.0) (store.ts:10, 28-45; ReadingSurface.tsx:108-137) |
| RDR-076 | done | Starts empty, Ask off, panel open by preference (store.ts:69-86, 181) |
| RDR-077 | adapted | Ask on arrival when no mode, word or verse is named, the reader never visited and has no progress — an explicit flag (ReaderShell.tsx:43-59) |
| RDR-078 | bug-fixed | An explicit `visited` flag is set on every visit (ReaderShell.tsx:55-58; store.ts:275; e2e "a returning reader is never sent back to Ask (RDR-516); a first visit lands in Ask") |
| RDR-079 | adapted | ?mode=ask opens Ask; the panel is not drawn while Ask is on; ?q prefills; the input is focused after 60ms; onboarding waits until Ask is left instead of being suppressed for the session (ReaderShell.tsx:47; AskView.tsx:30-38; Overlays.tsx:40) |
| RDR-080 | adapted | ?w= (with ?at=) takes the same openWord path as a tap: history, trail, selection, panel (RDR-539); no automatic learning state (D20) (ReadingSurface.tsx:79-91; e2e "a ?w= deep link takes the same path as a tap (RDR-539) and is recorded in the trail (RDR-587)") |
| RDR-081 | done | ?mode=lookup opens the index with the panel (ReaderShell.tsx:48-50) |
| RDR-082 | open | ?mode=review opens the review overlay, which is a placeholder until the deck exists (ReaderShell.tsx:54) |
| RDR-083 | adapted | Texts are addressed by path (/quran/{s}, /quran/{s}/{a}, /word/{loc}) instead of ?book= (RDR-566) (app/[locale]/(reader)/…) |
| RDR-084 | done | A word → word mode; Index toggles index ↔ word or empty; back/forward → word (store.ts:88-117; Panel.tsx:74) |
| RDR-085 | done | Entering Ask hides the panel and focuses the input after 60ms; leaving reopens the panel (ReaderHeader.tsx:86-93; AskView.tsx:35-38) |
| RDR-086 | adapted | Ask replaces the reading column and the strip; the rail stays; the Dictionary button leaves Ask for the text with the panel open, instead of opening the panel beside Ask (ReaderShell.tsx:75-84; ReaderHeader.tsx:207-213) |
| RDR-087 | open | Onboarding hides while review is open (Overlays.tsx:347), but the full-screen review overlay is not built (a placeholder dialog) |
| RDR-088 | adapted | Empty-mode body as at RDR-194 (Panel.tsx:223-249) |
| RDR-089 | done | Paper max-width 760 × min(size, 1.25), centred, padding 34 30 80, gap 8, `--paper`, side borders, min-height 100% (globals.css:730-740) |
| RDR-090 | adapted | Chapter head: "N / 114", «سورة …» scaled with cap 1.25, transliteration and English name in the English UI, "About this sūra", place · verses · pages, basmala (RDR-574) (SurahText.tsx:26-41) |
| RDR-091 | done | `.passage` with data-verse, gap 10, padding 16 18 18, radius 12; hot = card, border, shadow (SurahText.tsx:44; globals.css:770-787) |
| RDR-092 | done | Mono verse key + hairline rule (SurahText.tsx:45-48; globals.css:794-809) |
| RDR-093 | adapted | Order: label (resume marker inside) · tools · verse · grammar band · optional lines · inline gloss · note · drawer; recitation is the global audio bar; the marks row is missing (RDR-142) (SurahText.tsx:45-62) |
| RDR-094 | adapted | The verse is one RTL paragraph of inline word buttons (copy and justification stay natural) at 29 × size, 25 on phones, not a flex row with scaled gaps (VerseLines.tsx:9-38; globals.css:867-874) |
| RDR-095 | adapted | Per-verse transliteration from the API, mono 10.5 × min(size, 1.15); off by default in Arabic (RDR-557) (InlineLines.tsx:39, 66; globals.css:917-926) |
| RDR-096 | adapted | Translation line 13.5 × min(size, 1.2), t2, pretty wrap, on by default only in English; al-Muyassar's Arabic line as the Arabic option (RDR-557) (InlineLines.tsx:36-37, 67-72; globals.css:943-954) |
| RDR-097 | done | "End of Sūrat {name}" with previous/next sūra links (SurahText.tsx:66-72) |
| RDR-098 | adapted | The whole sūra is server-rendered with `content-visibility: auto` per verse; the extra tools are drawn only into the active verse (P2.10a) (globals.css:774-776; e2e "al-Baqara stays inside its budget") |
| RDR-099 | adapted | scrollIntoView on the target verse or section after a short delay, with a hold while sections above still load (ReadingSurface.tsx:93-100; WordEntry.tsx:47-74) |
| RDR-100 | adapted | Each word button carries data-w (s:a:w), data-w2, data-l (lemma slug), data-r (root); grammar comes from the occurrence's corpus features, not a free-text string (VerseLines.tsx:20-30) |
| RDR-101 | adapted | Mushaf font (KFGQPC) at 29 × size, padding .06em .1em, radius 5, background transition; only the recited word drops its transition (RDR-543) (globals.css:867-916) |
| RDR-102 | adapted | No function-word class: every word is interactive (RDR-548) (VerseLines.tsx:20) |
| RDR-103 | adapted | No unknown-word candidates on the Quran: every word has a corpus entry (RDR-548/549) |
| RDR-104 | done | t1, pointer, underline offset .42em, 1px (1.6px when related), transparent unless related, t3 on hover (globals.css:875-899) |
| RDR-105 | adapted | Learning wash (amber 13%) only in study mode (D20) (ReadingSurface.tsx:209; globals.css:900-902) |
| RDR-106 | open | The study-mode "new" underline is drawn only for words with no state; a word the reader explicitly set to "new" gets no mark (`!st`, ReadingSurface.tsx:210) |
| RDR-107 | done | Known words carry no mark (ReadingSurface.tsx:207-211) |
| RDR-108 | done | Selected word: ring 22% + inset ring underline (globals.css:906-911) |
| RDR-109 | done | Recited word in `--c-root` 26%, transition off (audio/AudioEngine.tsx:59-70; globals.css:912-916) |
| RDR-110 | done | Stars are not drawn in the text (as in the prototype; D20 keeps the mushaf unpainted) |
| RDR-111 | done | Family underline from the selected word's root when Tint is on, plus the focus root (ReadingSurface.tsx:190-192) |
| RDR-112 | done | A tap opens the word at its location (ReadingSurface.tsx:313-322) |
| RDR-113 | open | openWord records history, trail, onboarding beat, selection, mode, panel and the half sheet (store.ts:88-102), but writes no reading-context record and no session log (needed by Hub, Concordance, Notebook — RDR-437/441) |
| RDR-114 | adapted | No automatic learning state at all (D20, RDR-552) |
| RDR-115 | adapted | No display stripping of the mushaf (D7, RDR-545); the standard-spelling line instead |
| RDR-116 | adapted | A−/A+ and ⋯ both step 0.1 within [0.8, 1.6]; paper, title, transliteration and translation scale under their caps (ReaderHeader.tsx:16-17, 74-76; globals.css:731, 755, 919, 944) |
| RDR-117 | open | No word hover card on desktop; only the grammar band follows the pointer |
| RDR-118 | open | Hover-card box not built |
| RDR-119 | open | Hover-card content (lemma, transliteration, root, gloss, this occurrence's grammar) not built |
| RDR-120 | open | New / Learning / Known control in the card not built (study mode only, per D20) |
| RDR-121 | open | "Full entry" and "Open in graph" card actions not built |
| RDR-122 | open | Hover delays, hand-off into the card and Esc not built |
| RDR-123 | adapted | No unknown-word popover on the Quran: every word has a corpus analysis; it returns for non-Quran text with the morphology service (P4.3/P11) (RDR-549) |
| RDR-124 | adapted | As RDR-123 |
| RDR-125 | adapted | The segmentation chips moved into the entry header, fed by corpus morphology (RDR-549) (WordEntry.tsx:138-160) |
| RDR-126 | adapted | The analysis line is the "Grammar here" block from corpus features (sections/Meanings.tsx:122-157) |
| RDR-127 | adapted | No candidate roots: the corpus gives the root; other attributions are stored as root variants (DECISIONS "Morphology") |
| RDR-128 | adapted | As RDR-123 |
| RDR-129 | adapted | No "Propose entry" path for the Quran (every word has an entry); proposals go through Suggest (RDR-311) |
| RDR-130 | adapted | Ask's no-match opens no popover (see RDR-172) |
| RDR-131 | n/a | The prototype's heuristic analyser is replaced by corpus morphology on the Quran (RDR-549); analysing arbitrary text belongs to the Analyser and the morphology service (P4.3, PLAN §5) |
| RDR-132 | n/a | As RDR-131 |
| RDR-133 | n/a | As RDR-131 |
| RDR-134 | n/a | As RDR-131 |
| RDR-135 | n/a | As RDR-131 |
| RDR-136 | open | Band built: a dashed box under each verse with the hovered (140ms intent) or selected word's form and corpus features, a hint when empty (GrammarBand.tsx:12-31; ReadingSurface.tsx:369-382; globals.css:955-984); a selected word with no lemma (free pronoun, Quranic initials) leaves the band on an empty placeholder |
| RDR-137 | open | On phones the gloss stands under the verse once the sheet is put away (InlineGloss.tsx; e2e "phone: putting the sheet away keeps the word, with its gloss under the verse (RDR-605); the word stays above the sheet (RDR-416)"), but nothing renders for a lemma-less word (slug "") |
| RDR-138 | open | (minor) Marker with a dot and «توقفت هنا · date» on the last verse read, from verse 2 on (ReadingSurface.tsx:65-68, 430-437; e2e "/read resumes on the last verse read with the resume marker (RDR-572/592)"); it is not hidden when that verse holds the selection and has no "resume" action |
| RDR-139 | adapted | Progress advances on reading (scroll) as well as taps; the reader scrolls to the marker on return; verse 1 never shows it (RDR-572) (ReadingSurface.tsx:94, 215-233); no rail marker (RDR-071) |
| RDR-140 | adapted | 2px `--c-root` hairline on the header's bottom edge, width = position in the sūra, with page N of 604 and the mushaf share in aria-valuetext (RDR-572) (ReaderHeader.tsx:46-72, 219-237; e2e "the hairline reports the reading position in the sūra and the mushaf") |
| RDR-141 | done | A saved verse note shows under its verse with a root-coloured edge and opens the note drawer (ReadingSurface.tsx:439-454; globals.css:2074-2095; e2e "a verse note shows under its verse (marginalia)") |
| RDR-142 | open | No marks row: verse links and topics do not exist |
| RDR-143 | adapted | One non-wrapping tools row that scrolls sideways on phones, so words never move under a tap (DECISIONS lesson); Recite and Roots always, six more on reveal (SurahText.tsx:49-56; ReadingSurface.tsx:477-500; globals.css:820-831) |
| RDR-144 | open | (minor) "Recite" plays the verse with real recitation (ReadingSurface.tsx:326) but shows no playing state and offers no stop |
| RDR-145 | open | "Roots" opens its drawer (ReadingSurface.tsx:347) but carries no count badge |
| RDR-146 | open | More tools: Tafsir, Related, Copy, Cite, Note, Graph; "Links" and "Topic" are missing (RDR-555 keeps both); no count badges |
| RDR-147 | open | (minor) Style, active state and phone size match (globals.css:832-866), but tools have no icons and no count badges |
| RDR-148 | done | Tools show for the hovered (mouse), keyboard-focused, long-pressed, drawer-open or hot verse (ReadingSurface.tsx:391-394, 456) |
| RDR-149 | done | 420ms long-press, cancelled by touchmove or touchend; the hot verse always shows its tools (ReadingSurface.tsx:283-293) |
| RDR-150 | open | The P2.0 union is incomplete: Links, Topic, Concordance and Analyse are missing from the verse tools |
| RDR-151 | adapted | One drawer at a time across the sūra (not one per verse), closed by its tool, its Close button or Esc; caption in label-caps (ReadingSurface.tsx:55, 242, 347; VerseDrawer.tsx:18-33; globals.css:985-993) |
| RDR-152 | adapted | Copy gives «﴿verse﴾ [sūra: n]» plus the shown translation with its credit; a failure toast (RDR-555) (ReadingSurface.tsx:333-346; e2e "copy puts the reference after the verse text (RDR-555)") |
| RDR-153 | adapted | Real recitation with word highlighting from timings, one engine, speed 1× / 0.75× / 0.5× persisted, repeat, in a global bar (RDR-554) (audio/AudioEngine.tsx; audio/AudioBar.tsx; lib/store/audio.ts:10, 127; e2e "recitation speed cycles 1×, 0.75×, 0.5× and repeat toggles (RDR-554)") |
| RDR-154 | open | Rows toggle the focus root with "{n} here" (VerseDrawer.tsx:39-62), but show no transliteration, no root gloss and no Quran-wide count |
| RDR-155 | open | (minor) Related verses over the whole Quran, rarity-weighted, top 4, with shared roots and the verse text, each opening its verse (VerseDrawer.tsx:64-83; content.py related_verses); no empty-state line in the drawer |
| RDR-156 | open | No Links drawer |
| RDR-157 | open | No Topic drawer (user topics now, curated themes later — RDR-555) |
| RDR-158 | open | The drawer shows root chips and counts and links to /graph?verse= (VerseDrawer.tsx:110-127); no Patterns or Words columns, no footnote, and the editor ignores ?verse= |
| RDR-159 | adapted | One note per verse with its own draft (fixes RDR-525): textarea, "Private · anchored to {ref}", Save; saving it empty deletes it; @-links wait for the Notebook (P5.4) (VerseDrawer.tsx:85-108; lib/store/saved.ts:35-41) |
| RDR-160 | done | Ask column on canvas, centred, clamp padding, gap 20, in place of the text (AskView.tsx:59; globals.css:1705-1716) |
| RDR-161 | done | «عن أي كلمة تتساءل؟», clamp size, 600, centred, pretty wrap (AskView.tsx:60; globals.css:1717-1729) |
| RDR-162 | done | 560px form, 56 high, 1.5px ring border, radius 14, glow; search icon; dir=auto 24px input with aria-label (AskView.tsx:61-83; globals.css:1730-1760) |
| RDR-163 | done | Long and phone placeholders (AskView.tsx:76) |
| RDR-164 | done | Script hint only while typing: Arabic with or without marks, transliteration, English (AskView.tsx:48-56, 82) |
| RDR-165 | adapted | "Try" chips with Quranic words عِلْم · رَحْمَة · صَبْر · قَلْب + "knowledge" (RDR-564) (AskView.tsx:19, 84-93) |
| RDR-166 | done | Server normalisation (the one spec, P1.3a) and the chat alphabet: 3→ʿ, 2→ʾ, aa→ā (services/api/src/jadhr_api/search.py:56-65) |
| RDR-167 | done | Exact forms first, candidates without a leading article or conjunction, transliteration matches (search.py:220-265; search_os.py:36-61) |
| RDR-168 | adapted | Loose matches through the shared search (prefix forms, transliteration, English gloss, root letters), up to 6 lemmas (AskView.tsx:40-45) |
| RDR-169 | open | Ranking is match score × frequency; the design's nouns-before-verbs rule is not applied (عِلْم can rank under عَلِمَ) |
| RDR-170 | done | "{n} words match — pick one…" with up to 6 pills, the shown one marked (AskView.tsx:95-107) |
| RDR-171 | done | Enter picks the first match (AskView.tsx:63-66) |
| RDR-172 | open | The no-match line is shown (AskView.tsx:94), with no "Analyse it anyway →" path |
| RDR-173 | done | 640px card, radius 16, open shadow, dc-rise .18s, bands (AskView.tsx:158; globals.css:1766-1796) |
| RDR-174 | open | Headword 46, contextual meaning (Arabic gharīb line or English corpus gloss) with its credit, transliteration · POS, 40px recited "Hear it" (AskView.tsx:159-175); "also: {second sense}" waits for sense lists |
| RDR-175 | adapted | "Built on the root …" with the Maqāyīs core meaning in place of an English root gloss; up to 4 cousin chips (Arabic + transliteration) that swap the card (AskView.tsx:176-196) |
| RDR-176 | adapted | "Heard in": the first occurrence as a KWIC line with sūra, key and count — deterministic, not an editorial "well-known" pick (RDR-564) (AskView.tsx:197-207) |
| RDR-177 | done | "Want more?" + Go deeper (primary) + Read it in place + ☆ Save / ★ Saved with aria-pressed (AskView.tsx:208-221) |
| RDR-178 | done | Leaves Ask and opens the entry at its place (AskView.tsx:133-137; e2e "Ask finds a word without vowels and Go deeper opens its full entry") |
| RDR-179 | done | Opens the first verse with the word selected (?w=&at=), fixing the unselected token (AskView.tsx:138, 213-217) |
| RDR-180 | done | Save stars the lemma in the shared saved list (lib/store/saved.ts:51-55) |
| RDR-181 | adapted | The recited slice of the verse, never synthesised speech (D10, RDR-554) (Listen.tsx:9-18) |
| RDR-182 | done | Snap rail of 86% cards, min-height 300, radius 18; dots from scrollLeft ÷ (0.86w + 10); full-width 44px "Go deeper — the full entry" (AskView.tsx:226-339; globals.css:1797-1834) |
| RDR-183 | open | Cap, headword 44, meaning, sub-line, recited ▶ and Save (AskView.tsx:248-264); no "Also: other senses" (P3.1), and ▶ is 40px, not 44 |
| RDR-184 | open | Root, sub-line, up to 3 rows (44px) and "See the whole family" (AskView.tsx:265-288); no root gloss as the title (no root glosses in the data, P3.4) |
| RDR-185 | open | The verse and "Read it in place" (AskView.tsx:289-302); no ▶ to hear the verse |
| RDR-186 | open | Pattern, function ("pending" for every noun pattern — no pattern texts yet), count and "Show me the shapes" (AskView.tsx:303-317); no transliteration sub-line |
| RDR-187 | bug-fixed | The deck is keyed by the word and scrolled back to card 1 for each new word (AskView.tsx:121, 238-240) |
| RDR-188 | done | Ask query, pick and card index are session state (AskView.tsx:30-31, 231) |
| RDR-189 | done | Phone grabber: full width, 24px, 44×4 pill, touch-action none, expand/shrink labels, a tap toggles (Panel.tsx:138-162; globals.css:1078-1095) |
| RDR-190 | done | Back/forward (26px, 44 in the sheet) with labels and disabled ends; a title per mode (entry, all entries, verse, about, dictionary); Index with aria-pressed; ✕ "Hide the panel" (Panel.tsx:42-80; globals.css:1096-1135) |
| RDR-191 | done | History capped at 30, forward entries dropped on a new selection (store.ts:67, 88-117; e2e "panel history: back and forward between entries (RDR-590)") |
| RDR-192 | done | type=search with placeholder and aria-label, ring on focus (Panel.tsx:180-195; globals.css:1142-1153) |
| RDR-193 | open | Dropdown of up to 9 from the shared search; Esc clears; Enter opens the first; a no-results row (closes the RDR-453 gap) (Panel.tsx:166-221); rows show no part of speech and no root |
| RDR-194 | adapted | Empty body: title, Quran-worded paragraph, legend root · pattern · word · verse, "Start from a root" with this sūra's roots — a chip underlines the root in the text instead of opening its first word (Panel.tsx:223-249) |
| RDR-195 | adapted | Index: first-letter picker (the spec's A–Z root index) → roots with lemma counts → lemmas with POS and frequency (IndexBody.tsx:15-66); no sticky group headers, no English column |
| RDR-196 | adapted | Headword 40, transliteration, chips POS · pattern · Form · "{n} in the Quran", plus this occurrence (place, segments, corpus gloss); the English gloss sits in the occurrence box, Arabic first (RDR-561) (WordEntry.tsx:101-161) |
| RDR-197 | open | The root chip opens and scrolls to Word family, fixing the prototype bug (WordEntry.tsx:162-171); no root gloss beside it — no root has an English gloss or Arabic core idea yet (0 of 1,642 in data/build/2026.10.0/roots.jsonl) |
| RDR-198 | open | Cite and the star (aria-pressed) work; "Open in graph editor" links to /graph?w=, which the editor ignores; on phones all three are 40px, not 44 |
| RDR-199 | n/a | Prototype dead code (copyWord, panelModes) |
| RDR-200 | adapted | role=tablist/tab with aria-selected, aria-controls and a tabpanel (better than the prototype), roving tabindex, RTL-aware arrows with wrap, 44px in the sheet (WordEntry.tsx:272-316; globals.css:1251-1284); count badges: RDR-201 |
| RDR-201 | open | Tabs carry no count badges (only the active tab's meta line shows a count) |
| RDR-202 | adapted | Body padding 14; order: breadcrumb, trail map, entry header, sections, Where next (WordEntry.tsx:80-85) |
| RDR-203 | done | Layers by default; tabs mode renders only the active section (WordEntry.tsx:253-270) |
| RDR-204 | done | Card sections with aria-expanded heads, meta and an RTL-aware rotating chevron; 48px heads in the sheet (WordEntry.tsx:256-265; globals.css:1213-1250) |
| RDR-205 | done | Meanings and Word family open by default; open state persisted in jadhr-prefs (store.ts:185, 196-203) |
| RDR-206 | done | Folding the last open layer keeps Meanings open (store.ts:197-203; e2e "folding the last open layer keeps Meanings open (RDR-577)") |
| RDR-207 | done | One order in both layouts, the spec's: Meanings, Family, Shapes, Dictionaries, Centuries, In the Quran (store.ts:13; WordEntry.tsx:28) |
| RDR-208 | adapted | Titles and meta with honest counts («ما تقوله المصادر» until senses exist; "{n} have an article"); tabs use the same titles (WordEntry.tsx:219-244) |
| RDR-209 | open | Links open and scroll in layers mode (e2e "links into a folded section open and scroll to it (RDR-527/589)"), but in tabs mode the jumped-to tab falls back to the first open section about 80ms later, when `scrollTo` is cleared (WordEntry.tsx:55 with 275-276) |
| RDR-210 | bug-fixed | Root chip, pattern chip, term jumps, doors and timeline dots all use jumpTo, which opens and scrolls (store.ts:131-134; WordEntry.tsx:125, 164) |
| RDR-211 | adapted | Tabs mode shows the active section's meta line in place of a sub-label (WordEntry.tsx:309-312) |
| RDR-212 | open | Numbered sense rows exist in code (sections/Meanings.tsx:52-67), but no lemma has a sense list (P3.1); no dashed pending state, no source meta per sense |
| RDR-213 | open | Sense meta (reviewed · sources / pending / edited by) not built |
| RDR-214 | open | Merged edits replacing a sense with a credit line not built (no review queue) |
| RDR-215 | open | Proposed senses are stored locally (store.ts:277-278) but never shown in Meanings |
| RDR-216 | open | (minor) Per-sense "Suggest an edit" exists (sections/Meanings.tsx:60-62) but appears only once senses exist, and has no 40px phone height |
| RDR-217 | done | Where next closes every entry, outside Meanings, in both layouts (WordEntry.tsx:267, 313) |
| RDR-218 | done | "+ Propose a sense" and "Report an error" (sections/Meanings.tsx:97-104) |
| RDR-219 | n/a | Prototype placeholder disclaimer, replaced by the honest pending note (sections/Meanings.tsx:94-96) |
| RDR-220 | open | (minor) "Grammar here" shows this occurrence's form and features with dotted terms and "as it appears in {ref}" (sections/Meanings.tsx:122-157), but nothing when the entry is opened without a place (family chip, search): the "select the word in the text" state is missing (sections/Meanings.tsx:105) |
| RDR-221 | open | Root card: root, transliteration, the Maqāyīs core meaning with its source, counts (sections/Family.tsx:46-60); no "Graph the root" button, no English root gloss (P3.4) |
| RDR-222 | open | No root seed to the editor; a generated root graph exists at /graph/root/{root}, but nothing in the entry links to it |
| RDR-223 | open | Pattern groups with the Arabic pattern, transliteration and word chips with counts, the current one marked (sections/Family.tsx:62-82); the pattern's function shows as pending for every noun pattern (0 of 228 patterns have texts) |
| RDR-224 | done | "Same pattern, other roots" with note and chips (sections/Family.tsx:83-93) |
| RDR-225 | open | Dotted terms in the group headers work; a plain description of what each pattern does needs the P3.3 catalogue |
| RDR-226 | done | Segmented This root / This pattern, session state (sections/Shapes.tsx:16-28) |
| RDR-227 | open | No root header with "{k} of N patterns attested" in the root view |
| RDR-228 | open | The root table lists the root's attested patterns with function and every family word (sections/Shapes.tsx:29-62); no "not attested" rows from a closed pattern list |
| RDR-229 | bug-fixed | Every family word on a pattern is listed (sections/Shapes.tsx:53-57) |
| RDR-230 | open | No "Show all patterns / Hide unattested" toggle |
| RDR-231 | open | Pattern view with the pattern, its function, counts and up to 60 members with gloss and root (sections/Shapes.tsx:70-101); no "All roots / In this sūra" chips, the current word is not tinted, and the list stops at 60 |
| RDR-232 | done | Shows the last chosen pattern, else the word's own (sections/Shapes.tsx:17) |
| RDR-233 | done | One by one · Side by side · Apparatus, persisted `lexMode` (sections/Dictionaries.tsx:56-65) |
| RDR-234 | open | No "One line from each" gist list (needs a gist per dictionary) |
| RDR-235 | open | The label says "by compiler death date" (sections/Dictionaries.tsx:75), but articles come in `sort_order` (content.py:674): al-Mufradāt (d. 1108), Maqāyīs (1004), Lisān (1311), al-Ṣiḥāḥ (1003), Lane, Ibn Qutayba (889) — the label is false |
| RDR-236 | bug-fixed | Filter chips count the shown dictionaries, "All" included; empty kinds dim to .45; the selected chip is tinted (sections/Dictionaries.tsx:52, 68-74) |
| RDR-237 | done | Kinds: earliest, general, root-semantic, interpretive (al-Mufradāt, Ibn Qutayba), English (sections/Dictionaries.tsx:14-26) |
| RDR-238 | done | Article header: Arabic title (Amiri 19), English title in the English UI, tag pill, author · death (sections/Dictionaries.tsx:97-120) |
| RDR-239 | open | Copy (⧉) works (sections/Dictionaries.tsx:138-144, 164-166) and Cite was added; "+ Add to graph" is missing |
| RDR-240 | done | Arabic articles RTL in Amiri (spec 02), Lane LTR; long articles fade until expanded (sections/Dictionaries.tsx:148-155; globals.css:1379-1387) |
| RDR-241 | done | "Full article ({n} characters)" / "Show less", fetching the full text on demand (sections/Dictionaries.tsx:135-160) |
| RDR-242 | n/a | Prototype placeholder footer; each article shows its real attribution and "display only" where it applies (sections/Dictionaries.tsx:124-127) |
| RDR-243 | done | Arabic name, author and death date on every article, plus the tag pill (sections/Dictionaries.tsx:97-103) |
| RDR-244 | done | Chips for the shown works, at most 3 with the oldest dropped, default al-Mufradāt · Maqāyīs · Lisān, persisted `compare` (sections/Dictionaries.tsx:172-192; store.ts:184) |
| RDR-245 | open | Side by side shows whole articles in columns (sections/Dictionaries.tsx:194-209); the per-sense grid with agreement notes needs sense alignment |
| RDR-246 | open | Per-sense cells, "—" absences and the uniqueness tint not built |
| RDR-247 | open | The uniqueness legend is not built (a note says alignment is pending, sections/Dictionaries.tsx:193) |
| RDR-248 | open | Apparatus shows an honest pending note (sections/Dictionaries.tsx:82-84); base chips not built |
| RDR-249 | open | Apparatus text not built |
| RDR-250 | open | Agreement colours not built |
| RDR-251 | open | Apparatus notes not built |
| RDR-252 | open | Apparatus legend not built (its "1–2 others" wording bug must not be copied) |
| RDR-253 | n/a | The prototype's hash mapping; never shipped (RDR-560); real alignment is P3.4a (tracked at RDR-245…252 and 479) |
| RDR-254 | open | No Lanes / Streams switch or per-sense meta: one axis of dictionaries (sections/Centuries.tsx:16-64) |
| RDR-255 | done | Legend: round dot "lexicon article", square "text attestation" (sections/Centuries.tsx:28-31) |
| RDR-256 | done | Linear 550–1920 axis with ticks 600…1800 (sections/Centuries.tsx:8, 50-54; lexicon.py:247-248) |
| RDR-257 | adapted | Corpora come from the data: the Quran (632) only; poetry hidden (RDR-559); ḥadīth with P11 (data/build/2026.10.0/corpora.jsonl; lexicon.py:246) |
| RDR-258 | open | No per-sense lanes; dots mark dictionaries with an article on the root, and a click opens the dictionaries section, not that article (sections/Centuries.tsx:37-48) |
| RDR-259 | open | Streams view not built |
| RDR-260 | open | Stream labels not built |
| RDR-261 | open | Streams caption not built |
| RDR-262 | adapted | An honest caption: which sense each dictionary records appears once senses are linked (sections/Centuries.tsx:61) |
| RDR-263 | adapted | "In scripture" became the In the Quran section (RDR-559); one corpus, so a sūra filter and a Makki/Madani split replace corpus chips (sections/InQuran.tsx:64-96) |
| RDR-264 | done | Form chips with counts toggle a filter (sections/InQuran.tsx:97-109) |
| RDR-265 | adapted | Rows are KWIC lines hugging the keyword, each linking to the verse with the word selected, paged (RDR-558); no full verse, translation or grammar line per row (sections/InQuran.tsx:111-129) |
| RDR-266 | adapted | Every lemma comes from the corpus, so it always occurs; the whole-root switch replaces the "attested on this root" chips (sections/InQuran.tsx:50-63) |
| RDR-267 | adapted | All occurrences live in In the Quran (RDR-559) |
| RDR-268 | adapted | "{n} occurrences in {k} sūras — {here} in {sūra}" (sections/InQuran.tsx:64-66) |
| RDR-269 | open | Each row links to its verse with the word selected (sections/InQuran.tsx:114-116); no per-occurrence "Graph" seed and no inflection per row |
| RDR-270 | adapted | Cannot be empty: every lemma is attested |
| RDR-271 | bug-fixed | Occurrences are computed on the server per text (/words/{slug}/attestations; lexicon.py word_attestations) |
| RDR-272 | done | Union: header toggle with aria-pressed, the preferences switch, a ⋯ menu item, "Stop explaining terms" on the card (ReaderHeader.tsx:158-169, 305-314; ReadingPrefs.tsx:54; terms/Term.tsx:136-138; e2e "a term card jumps into the entry's section, and can stop explaining terms (RDR-278/279, P2.6)") |
| RDR-273 | done | One pattern, longest first, escaped, with Unicode-aware edges `(?<![\p{L}\p{M}])…` (lib/termDetect.ts:9-25; lib/termDetect.test.ts) |
| RDR-274 | open | Dotted terms in family headers, Shapes meanings and note, Grammar here, and the entry meta (POS, Form, segments, root) (sections/Family.tsx:12-20; WordEntry.tsx:122-169; sections/Meanings.tsx:114-139); none in the passage grammar band or the dictionaries section |
| RDR-275 | done | Inline button with a dotted underline and help cursor (terms/Term.tsx:101-103; globals.css:323-338); terms keep the text colour rather than the ring colour |
| RDR-276 | done | Fixed card, dark in both themes, max 300px (100vw − 24), role=dialog named by the term (terms/Term.tsx:104-141; globals.css:340-365); z-order: RDR-012 |
| RDR-277 | done | Below the term, above when space is short, clamped to 12px gutters; follows the term and closes when it leaves the screen (terms/Term.tsx:17-23, 68-72) |
| RDR-278 | done | Category + name, ✕ Close, body, jump pill, "Read more" link, "Stop explaining terms" (terms/Term.tsx:115-139) |
| RDR-279 | done | A jump label per section; the jump opens and scrolls to the section (terms/Term.tsx:31-38, 126-130; e2e "a term card jumps into the entry's section, and can stop explaining terms (RDR-278/279, P2.6)") |
| RDR-280 | done | ✕, Esc (focus returns), an outside tap, or scrolling the term off screen (terms/Term.tsx:53-83; e2e "a dotted term opens a plain-language card; Esc closes it, returns focus and leaves the entry open") |
| RDR-281 | done | 52 bilingual terms served by the API (data/glossary.yaml → /glossary), Arabic written for Arabic readers, incl. Form III, participles, jussive, definite/indefinite; "noun of quality", "stative" and "causative" have no entry and no screen uses them |
| RDR-282 | done | `root`, jump family (data/glossary.yaml) |
| RDR-283 | done | `wazn` labelled "Pattern (wazn)", jump patterns |
| RDR-284 | adapted | Merged into the same `wazn` entry |
| RDR-285 | done | `formOne`, jump patterns |
| RDR-286 | done | `form2` from the sarf source, jump patterns (e2e "a derived verb form explains itself, with its source") |
| RDR-287 | done | `form4` |
| RDR-288 | done | `form5` |
| RDR-289 | done | `form10` |
| RDR-290 | done | `activeParticiple` |
| RDR-291 | done | `passiveParticiple` |
| RDR-292 | done | `verbalNoun` "Verbal noun (maṣdar)" |
| RDR-293 | adapted | Merged into `verbalNoun` |
| RDR-294 | done | `nounOfPlace` "Noun of place and time" |
| RDR-295 | done | `perfect` |
| RDR-296 | done | `imperfect` |
| RDR-297 | done | `accusative` (and subjunctive) |
| RDR-298 | done | `nominative` (and indicative) |
| RDR-299 | done | `genitive` |
| RDR-300 | done | `tashkeel` (writing) |
| RDR-301 | done | `lexicon`, jump lexica; the body no longer limits the works to the 8th–14th centuries |
| RDR-302 | adapted | Merged into `lexicon` (one Arabic word, المعجم) |
| RDR-303 | adapted | Covered by `occurrences` (المواضع, jump usage) |
| RDR-304 | open | No "apparatus" term (the apparatus view is not built either) |
| RDR-305 | done | `concordance`, jump usage |
| RDR-306 | open | No "sense" term |
| RDR-307 | done | `gloss` |
| RDR-308 | done | `transliteration` |
| RDR-309 | open | No "corpus" term (the Quranic Arabic Corpus is credited on many lines) |
| RDR-310 | adapted | Merged into `tashkeel` "Vowel marks (tashkīl)" |
| RDR-311 | done | Suggest an edit per sense (when senses exist), Propose a sense, Report an error, each opening the dialog with its kind (sections/Meanings.tsx:60-62, 97-104); "Propose entry" does not apply (RDR-129) |
| RDR-312 | done | The shared Dialog: scrim closes it, role=dialog, label, focus moved in, trapped and returned (ui/Dialog.tsx:13-89) |
| RDR-313 | done | Three titles (Overlays.tsx:288) |
| RDR-314 | done | "Current" read-only box (Overlays.tsx:302-307) |
| RDR-315 | done | "Your wording" 3-row textarea, autofocused (Overlays.tsx:308-311) |
| RDR-316 | done | "Why · source *" required input with a placeholder (Overlays.tsx:312-315) |
| RDR-317 | done | Source chips for every dictionary in the dataset (Overlays.tsx:316-322) |
| RDR-318 | adapted | P2.0 rule: wording and a rationale required, sources optional; an edit must differ from the current text (Overlays.tsx:287) |
| RDR-319 | done | Cancel and "Submit for review", primary only when valid, otherwise disabled (Overlays.tsx:323-326) |
| RDR-320 | adapted | The footnote says the proposal stays on this device until sign-in and needs two reviewers; no review-queue link until P7 (Overlays.tsx:327) |
| RDR-321 | adapted | Stored in jadhr-personal.proposals {id, kind, slug, label, ordinal, current, text, why, sources, status pending, ts}; the dialog closes; a toast (store.ts:218-230, 277-278; Overlays.tsx:294-299) |
| RDR-322 | open | Pending edits and proposed senses are not shown in the entry |
| RDR-323 | open | Merge credit lines not built |
| RDR-324 | open | Proposals are not re-read on focus |
| RDR-325 | open | No review queue; no status beyond pending |
| RDR-326 | adapted | The trail lives in jadhr-personal.trail with words, verses and roots (RDR-568); consecutive duplicates skipped, cap 40, ?w= recorded (store.ts:251, 264-269) |
| RDR-327 | adapted | "Where next?" + rule + "{n} steps in your trail" (distinct steps) (sections/WhereNext.tsx:22-27) |
| RDR-328 | done | auto-fit grid (140px); doors with a 3px top border in the door colour, cap, Arabic, reason (sections/WhereNext.tsx:28-56; globals.css:1544-1575) |
| RDR-329 | open | (minor) The cousin door prefers an unvisited family member (sections/WhereNext.tsx:17-38), but its reason always reads "same root, another shape" — false when the cousin shares the pattern — and gives no gloss |
| RDR-330 | adapted | The verse door shows the key and opens that verse with the word selected (In the Quran is the scripture view) (sections/WhereNext.tsx:40-47) |
| RDR-331 | adapted | Not needed: every word has a Quran verse |
| RDR-332 | open | The shape door opens the Shapes section (sections/WhereNext.tsx:48-54), but in the root view, not "This pattern" on that pattern, and with no "{n} more like it" |
| RDR-333 | done | The breadcrumb shows only with an open word and ≥ 2 distinct steps, at the top of the body (Trail.tsx:18-19; WordEntry.tsx:81) |
| RDR-334 | adapted | "Trail" + the last 6 steps (Arabic headwords, verse keys, root letters), › separators, last t1/500, "Map · {n}" / "Hide map" (Trail.tsx:9-48) |
| RDR-335 | done | A click truncates the trail, then opens the step (trailSteps.ts:34-48; e2e "the trail records verses and roots as steps (RDR-568)") |
| RDR-336 | adapted | Map card on a dot grid: the last 8 steps in 2–4 columns by panel width with type, number, Arabic and transliteration, the current node dashed, "Back to …" (TrailMap.tsx:20-98; globals.css:1583-1633) |
| RDR-337 | done | Edges between consecutive nodes, root colour when both share a root, the last edge dashed (TrailMap.tsx:51-70) |
| RDR-338 | done | Legend pill (TrailMap.tsx:97) |
| RDR-339 | done | Save trail · Open in the editor · Start a new trail (TrailMap.tsx:99-124) |
| RDR-340 | adapted | Saved to jadhr-personal.savedTrails for the Notebook (P5.4); toast "Trail saved" (store.ts:273; TrailMap.tsx:100-108) |
| RDR-341 | open | "Open in the editor" links /graph?trail=…, which the editor ignores (no seed) |
| RDR-342 | done | Clears the trail and closes the map (TrailMap.tsx:114-123) |
| RDR-343 | adapted | Verses and roots are steps too (RDR-568) |
| RDR-344 | open | Entry points exist (header, ⋯, ?mode=review; Esc closes) but open a placeholder dialog (Overlays.tsx:404-418) |
| RDR-345 | open | No review queue |
| RDR-346 | open | The badge shows the saved-word count, not a due count (ReaderHeader.tsx:38, 144-146) |
| RDR-347 | open | Full-screen review overlay not built |
| RDR-348 | open | Mode switch not built |
| RDR-349 | open | Root card not built |
| RDR-350 | open | Root-card rows not built |
| RDR-351 | open | Grading not built (P2.0: the spec's four grades and Space to flip, keeping the per-word reveal) |
| RDR-352 | open | In-context card not built |
| RDR-353 | open | In-context verse choice not built (verses from the whole Quran; no dead end) |
| RDR-354 | open | Blanks not built (rendered respectfully, RDR-569) |
| RDR-355 | open | Answer checking not built |
| RDR-356 | open | Side panel not built |
| RDR-357 | open | In-context grading not built |
| RDR-358 | open | Session-complete card not built |
| RDR-359 | open | No scheduler (SM-2 style required) |
| RDR-360 | open | Deck entry rules (stars, learning → confirmed, Collections "Keep") not built |
| RDR-361 | open | No hand-off sheet: the triggers link straight to /graph (WordEntry.tsx:179; VerseDrawer.tsx:124; TrailMap.tsx:110) and the editor ignores their parameters |
| RDR-362 | open | Sheet frame not built |
| RDR-363 | open | Word-seed sub-line not built |
| RDR-364 | open | "Cards that will be created" rows not built |
| RDR-365 | open | Verse seed not built |
| RDR-366 | open | Occurrence seed not built |
| RDR-367 | open | Footnote not built |
| RDR-368 | open | Copy seed JSON / Cancel / Open graph editor not built |
| RDR-369 | open | No seed URL, and the editor reads none (it must receive sentences and description cards, not only words) |
| RDR-370 | open | Word-seed JSON not built |
| RDR-371 | done | ⌘K / Ctrl+K anywhere, header Search, ⋯ item; the input autofocused (Overlays.tsx:24-33, 110; e2e "omnibox: Ctrl+K, a verse reference, Enter opens the verse (RDR-565)") |
| RDR-372 | done | Top-aligned 640px Dialog with scrim, role=dialog, combobox + listbox semantics (Overlays.tsx:107-153) |
| RDR-373 | done | dir=auto input with a label, a placeholder with Quran forms, the detected-type pill (Overlays.tsx:109-137) |
| RDR-374 | adapted | The detected type comes from the server: verse reference, juzʾ, ḥizb, page, sūra, root, word, phrase, Latin (search.py:91-136) |
| RDR-375 | adapted | Root rows (≤ 3) with counts open the root's own page rather than its first word in the panel (Overlays.tsx:98-99) |
| RDR-376 | done | Word rows (≤ 5) with transliteration · gloss and "{n} in the Quran" open the entry (Overlays.tsx:96-97) |
| RDR-377 | open | Pattern rows (≤ 2) go to the search page instead of opening Shapes on that pattern (Overlays.tsx:100-101) |
| RDR-378 | adapted | "In texts" became Verses (Arabic text and English translation full text) and Sūras, verses first (RDR-565) (Overlays.tsx:81-95; search_os.py:84-97) |
| RDR-379 | done | Rows with type dot, Arabic, sub-line, meta; group titles (Overlays.tsx:142-151; globals.css:1881-1892) |
| RDR-380 | done | "Nothing matches" and "Try: …" states (Overlays.tsx:140-141) |
| RDR-381 | done | Footer: ↵ open first · esc close · All results → /search?q= (Overlays.tsx:154-159) |
| RDR-382 | bug-fixed | Arrow keys and Enter (spec); Esc handled by the Dialog in the capture phase, so it works from the input (Overlays.tsx:116-127; ui/Dialog.tsx:38-57) |
| RDR-383 | done | Cite from the entry, the verse tool, verse mode and each dictionary article (the spec's passage trigger included); Chicago by default (WordEntry.tsx:183; ReadingSurface.tsx:332; VerseEntry.tsx:38; sections/Dictionaries.tsx:104-119; Overlays.tsx:176) |
| RDR-384 | done | 480px Dialog, role=dialog "Cite this", title + ✕ (Overlays.tsx:240-246) |
| RDR-385 | open | No scope control inside the dialog: the trigger fixes the scope, and a root citation is unreachable (no trigger sets kind "root") |
| RDR-386 | done | "Permalink · versioned" box with the URL and dataset version + Copy (Overlays.tsx:247-251) |
| RDR-387 | bug-fixed | Copy copies the scope's own URL (/word/2:255:3, /quran/2/255, /roots/…) (Overlays.tsx:183-193, 250; e2e "cite: a dialog with a versioned permalink and the real access date; Esc returns focus (RDR-461/522)") |
| RDR-388 | done | Chicago · APA · MLA · BibTeX · RIS · Plain, the P2.0 union (Overlays.tsx:164, 220-230) |
| RDR-389 | adapted | Titles follow Quran conventions: «﴿…﴾ [البقرة: ٢٥٥]» / Q 2:255, a word «…» [طه: ١١٤، الكلمة ١٧], an article «ابن منظور، لسان العرب، مادة (ع ل م)» (RDR-566) (Overlays.tsx:200-217) |
| RDR-390 | bug-fixed | The citation URL is the permalink itself and keeps verse and word (Overlays.tsx:193) |
| RDR-391 | adapted | Chicago with the product name, the dataset version from /meta and the real date (Overlays.tsx:221-224) |
| RDR-392 | adapted | APA with the real year and version (Overlays.tsx:225) |
| RDR-393 | adapted | MLA (Overlays.tsx:226) |
| RDR-394 | adapted | BibTeX keyed by slug or key (Overlays.tsx:219, 227) |
| RDR-395 | bug-fixed | The real access date (Overlays.tsx:194; e2e "cite: a dialog with a versioned permalink and the real access date; Esc returns focus (RDR-461/522)") |
| RDR-396 | done | pre-wrap box; Copy citation copies from state; a success or failure toast (Overlays.tsx:231-238, 257-258) |
| RDR-397 | adapted | No "Sources behind this entry" list (RDR-560: no sense-to-source claims yet); a note sends readers to cite each article, which has its own Cite (Overlays.tsx:259) |
| RDR-398 | open | No "Export JSON", no "Embed…" link and no licence label in the footer |
| RDR-399 | done | Targets: a word (at its place or as a lemma), a verse, a dictionary article (the spec's article target) (store.ts:14-25) |
| RDR-400 | adapted | Shown until Skip or Got it; hidden during review and while Ask is on, then shown — a first-time visitor meets it after Ask (Overlays.tsx:40, 336-347) |
| RDR-401 | done | Fixed card 340 (max 100vw − 24), popover recipe, bottom-start (after a docked rail), top 64 on phones, role=dialog (Overlays.tsx:350; globals.css:1893-1912) |
| RDR-402 | done | "Beat {n} of 3", three dashes, Skip (Overlays.tsx:351-360) |
| RDR-403 | adapted | Beat 1 opens عِلْمًا in 20:114 (RDR-570) (Overlays.tsx:366-371; e2e "onboarding: the demo word is عِلْمًا in Ṭā Hā 20:114 (RDR-570)") |
| RDR-404 | adapted | Beat 2 "Many words, one root." without the "Family tab" drift; opens the family (Overlays.tsx:372-374) |
| RDR-405 | done | Beat 3 "Got it" sets onboarded (Overlays.tsx:375) |
| RDR-406 | done | Choosing any word on beat 1 moves to beat 2 (store.ts:100) |
| RDR-407 | done | Skip sets onboarded (Overlays.tsx:359) |
| RDR-408 | bug-fixed | No "Family tab" wording (messages rd.beat2Body); beat 3 still points at the verse Graph tool, which shows only on the verse being read |
| RDR-409 | done | Phone header: rail toggle · logo · title · Ask · ⋯ · Dictionary, 40px (ReaderHeader.tsx:103-218; globals.css:521-578) |
| RDR-410 | done | ⋯ menu: popover at inline-end, min 220, 44px items, role=menu, Esc and an outside tap close it, focus moved in (ReaderHeader.tsx:242-303; globals.css:1837-1870) |
| RDR-411 | done | Search · Reading preferences · Text larger · Text smaller (the menu stays open) · Review · Explain terms · Theme · Graph editor · Library (ReaderHeader.tsx:275-301) |
| RDR-412 | done | Bottom sheet min(52%, 460px) or full, `--panel`, radius 16 16 0 0, z 36, height transition .22s (globals.css:1059-1077) |
| RDR-413 | bug-fixed | The sheet lives in the row under the header, so full height never slides under it (globals.css:1060-1076; e2e "phone: the sheet opens at half height, under the header, and grows to full (RDR-532/605)") |
| RDR-414 | done | A tap toggles half/full; swipe up > 40 → full, down > 40 → half or close; a word tap drops it to half (Panel.tsx:146-157; store.ts:100) |
| RDR-415 | open | Back/forward, Index and ✕ are 44, tabs 44, heads 48, tools 40 (e2e "phone: touch targets meet the design's sizes (RDR-586)"); the star, Cite and Open-in-graph buttons are 40px (`.btn`), not 44, and "Suggest an edit" has no 40px height |
| RDR-416 | bug-fixed | The tapped word is scrolled above the half sheet; a persisted open panel never covers the text on load (ReadingSurface.tsx:178-186; Panel.tsx:40; e2e "phone: putting the sheet away keeps the word, with its gloss under the verse (RDR-605); the word stays above the sheet (RDR-416)") |
| RDR-417 | done | Tools on a 420ms long-press or on the open verse; the inline gloss once the sheet is closed (ReadingSurface.tsx:283-293, 385-389) |
| RDR-418 | done | Overlay rail with scrim, min(300px, 86vw) (globals.css:639-647) |
| RDR-419 | done | Short placeholder and the four-card deck (AskView.tsx:76, 108) |
| RDR-420 | open | Dialogs fit 390px (ui/Dialog.tsx:67-79); the review overlay and its in-context card need a phone layout when they are built |
| RDR-421 | adapted | No hover-only feature on phones: the grammar band follows the selection and tools come by long-press (ReadingSurface.tsx:370-382) |
| RDR-422 | adapted | Esc closes the innermost layer only (DECISIONS lesson): dialogs, term card, popovers, panel search, then a drawer, then the entry (ui/Dialog.tsx:39-43; terms/Term.tsx:56-61; ReadingSurface.tsx:240-245) |
| RDR-423 | done | ⌘K / Ctrl+K with preventDefault (Overlays.tsx:24-33) |
| RDR-424 | done | Enter opens the active row (Overlays.tsx:123-126) |
| RDR-425 | done | Enter picks the first match (AskView.tsx:63-66) |
| RDR-426 | done | RTL-aware arrows with wrap and focus (WordEntry.tsx:295-303) |
| RDR-427 | open | Review in-context keys not built |
| RDR-428 | open | Built: focusable words with arrows, ↑/↓ between verses, Alt+↑/↓ between sūras, omnibox arrows (ReadingSurface.tsx:236-281; e2e "keyboard: arrows move between words in reading order"); missing: arrow keys in panel-search results, Space to flip review cards (P5.3), a panel-toggle shortcut |
| RDR-429 | adapted | Keys by owner: jadhr-prefs (prefs + layers, the spec's name), jadhr-personal, jadhr-saved, jadhr-audio (store.ts:205-209, 280; lib/store/saved.ts:46; lib/store/audio.ts:127) |
| RDR-430 | adapted | zustand persist merges saved values over defaults (`migrate` spreads DEFAULT_PREFS); the rail overlay is not persisted (store.ts:205-209) |
| RDR-431 | bug-fixed | Stars in jadhr-saved (kind lemma), read by Saved and the Review count (DECISIONS 2026-10-03; e2e "a starred word appears in Saved and in the Review count, and stays after a reload (RDR-520)") |
| RDR-432 | open | No verse links or topics stored |
| RDR-433 | adapted | jadhr-personal.wordStates new / learning / known, set only by the reader (store.ts:233, 263) |
| RDR-434 | adapted | Verse notes in jadhr-saved.notes keyed by verse {verse, text, at}, one per verse; saved trails kept apart (lib/store/saved.ts:10, 35-41) |
| RDR-435 | adapted | jadhr-personal.progress.quran {chapter, passage, at}, written while reading (store.ts:216, 274; ReadingSurface.tsx:215-233) |
| RDR-436 | adapted | jadhr-personal.proposals (store.ts:218-230) |
| RDR-437 | open | No session log (day, words, roots, lookups) for Notebook, Classroom and Profile |
| RDR-438 | adapted | jadhr-personal.trail with step kinds (store.ts:215, 264-271) |
| RDR-439 | adapted | jadhr-personal.onboarded, set by Skip and Got it (store.ts:276; Overlays.tsx:359, 375) |
| RDR-440 | done | One `jadhr-theme` key written by both theme controls (ReaderHeader.tsx:77-81; lib/site.ts:11) |
| RDR-441 | open | No reading-context record (word, root, verse) for Hub, Concordance and the shell |
| RDR-442 | open | No user texts to read |
| RDR-443 | done | Ask query, focus root, drawers, expansions, filters, view modes and the selection are session state (store.ts:69-86; component state) |
| RDR-444 | open | (minor) Unavailable storage falls back to memory (zustand createJSONStorage), but a write error such as a full quota is not caught |
| RDR-445 | done | `w` (+ `at`) opens the entry (ReadingSurface.tsx:79-91) |
| RDR-446 | done | `mode` = ask · lookup · review · about (ReaderShell.tsx:46-54) |
| RDR-447 | done | `q` prefills Ask (AskView.tsx:30); /read passes it on (ResumeRedirect.tsx:22-25) |
| RDR-448 | adapted | Verses and words have their own paths (/quran/2/255, /word/2:255:3), plus ?v= and #v — the gap is closed (app/[locale]/(reader)/…; ReadingSurface.tsx:81-92) |
| RDR-449 | done | Every change writes the address bar as a history entry (ReadingSurface.tsx:108-137; e2e "browser back and forward step through what was opened (P2.2)") |
| RDR-450 | open | Outbound /search?q= and /library work; the graph links carry ?w=, ?verse=, ?trail= that the editor ignores; no review-queue or Embed link |
| RDR-451 | open | Skeletons for the entry, location entry, sūra card, verse knowledge, juzʾ list and pattern view (WordEntry.tsx:89-99; LocationEntry.tsx:27; SurahAbout.tsx:30); no error state for the rail lists, tafsir, drawers, In the Quran pages or panel search, and no loading row in panel search |
| RDR-452 | done | Empty states: panel empty mode, no sourced lines, all dictionaries hidden, no articles, no family, no roots in the verse, no related, Ask no match, omnibox none, timeline none (Panel.tsx:223; sections/Meanings.tsx:89; sections/Dictionaries.tsx:50-51; sections/Family.tsx:43; VerseDrawer.tsx:48; VerseEntry.tsx:63; AskView.tsx:94; Overlays.tsx:141; sections/Centuries.tsx:59) |
| RDR-453 | open | (minor) Panel-search no-results and all-dictionaries-off states exist; a dictionary filter with no articles shows an empty list and no message |
| RDR-454 | done | Fixed bottom pill, status / polite, z 96, 1.9s, the newest replaces (Overlays.tsx:384-402; globals.css:479-494) |
| RDR-455 | bug-fixed | `dc-rise` animates translateY only and the toast centres by margin, so nothing jumps (globals.css:109-112, 479-494) |
| RDR-456 | adapted | Toasts exist for the features built (verse copied, copy failed, note saved/deleted, proposal saved, trail saved, permalink, citation, article copied); the rest belong to open features |
| RDR-457 | bug-fixed | Copy failures show "Could not copy" (ReadingSurface.tsx:339-344; Overlays.tsx:231-238); an article copy shows no false success (sections/Dictionaries.tsx:138-144) |
| RDR-458 | done | No placeholder or "phase 2" wording in the reader; honest pending notes instead (messages rd.sensesPending, rd.apparatusPending, rd.timelineSensesPending) |
| RDR-459 | done | Labels on the rail toggle, size buttons, theme, ⋯, Back / Forward / Hide, panel search, Ask, omnibox, copy, timeline dots, term ✕, cite ✕, Hear it, the sheet grabber (ReaderHeader.tsx; Panel.tsx; Overlays.tsx; Listen.tsx) |
| RDR-460 | done | aria-pressed (Ask, theme, Dictionary, explain, star, tools), aria-expanded (rail, Reading, ⋯, layer heads, trail map, terms), role=switch, tablist/tab/tabpanel, disabled ends (ReaderHeader.tsx; WordEntry.tsx:283-312) |
| RDR-461 | open | (minor) Every modal uses the shared Dialog with role, label, focus trap and return; the term card and onboarding are labelled dialogs; the ⋯ menu and Reading popover move focus in but do not return it to their button when they close |
| RDR-462 | done | Toast status / polite; audio bar now-playing polite and error alert (Overlays.tsx:394; audio/AudioBar.tsx:83, 128) |
| RDR-463 | done | Icons aria-hidden and unfocusable (components/Icon.tsx:42-60) |
| RDR-464 | done | Global :focus-visible ring, textareas included (globals.css:140-144) |
| RDR-465 | done | lang and dir on Arabic and English runs (VerseLines.tsx:9; InlineLines.tsx:62-72; sections/Meanings.tsx:58-59; terms/Term.tsx:112-113) |
| RDR-466 | done | Words are buttons with a roving tabindex (VerseLines.tsx:20; ReadingSurface.tsx:71-75, 471-475; e2e "keyboard: arrows move between words in reading order") |
| RDR-467 | done | Reading aria-expanded, Dictionary aria-pressed, star aria-pressed, drawer tools aria-pressed (ReaderHeader.tsx:151, 206; WordEntry.tsx:187; ReadingSurface.tsx:196-201) |
| RDR-468 | done | Amber and every token retuned for dark (globals.css:26, 56); axe clean in light and dark on reader pages (e2e "axe: /quran/1", "axe dark: /quran/2/255") |
| RDR-469 | adapted | data-theme on <html> with the dark token set (t3 #9a9aa8 for contrast) instead of `.dark` on html and body (globals.css:39-66; app/[locale]/layout.tsx:41, 52) |
| RDR-470 | bug-fixed | Only the shared jadhr-theme key exists (ReaderHeader.tsx:77-81) |
| RDR-471 | done | Term card dark in both themes, white switch knobs, primary buttons invert (globals.css:225-233, 340-365, 466-471) |
| RDR-472 | bug-fixed | Amber is a token with a dark value, used by the learning wash and the coverage bar; scrims stay dark-tinted, which reads on both grounds (globals.css:26, 56, 900-902, 2116-2124) |
| RDR-473 | done | Paper on canvas with side borders; Ask on canvas (globals.css:722-740, 1705) |
| RDR-474 | open | Root records have key, letters, spaced form, transliteration and counts; the English gloss and Arabic core idea are empty for all 1,642 roots (data/build/2026.10.0/roots.jsonl); the Maqāyīs core meaning is shown where it exists |
| RDR-475 | open | Lemmas have slug, Arabic, transliteration, POS, root, pattern and counts; no Arabic definitions or numbered senses (no senses file in the build); English glosses mostly for verbs only |
| RDR-476 | open | 228 patterns with Arabic, transliteration and form number; none has a function or plain explanation (data/build/2026.10.0/patterns.jsonl) |
| RDR-477 | done | Dictionary records with id, titles, authors, AH/CE death years, edition, licence (lexicon.py:479-489); six works loaded, the nine tracked at RDR-048…056 |
| RDR-478 | adapted | Real articles from cited editions, an excerpt with the full text on demand (content.py root_lexicon; /lexicon/entries/{id}) |
| RDR-479 | open | No sense-to-dictionary or sense-to-corpus links |
| RDR-480 | done | content.corpora (id, labels, year) (lexicon.py:491-492) |
| RDR-481 | done | Generic text model texts → chapters → passages → tokens in the database and the /texts API (P1.1) (main.py:357-370; data/build/2026.10.0/texts.jsonl) |
| RDR-482 | done | Occurrence, distribution and verse-root indexes precomputed on the server (/words/{slug}/attestations, /surahs/{n}/roots, /verses/{key}/related) |
| RDR-483 | open | No topics (the fixed list is dropped per RDR-576; user topics and curated themes not built) |
| RDR-484 | open | Word states, stars, notes, progress, proposals, trail, saved trails and prefs exist; sessions, verse links and topics do not |
| RDR-485 | n/a | Prototype sample texts |
| RDR-486 | adapted | One mode field plus Ask and review flags, written to the URL (see RDR-075) |
| RDR-487 | done | Explicit visited flag (see RDR-078) |
| RDR-488 | adapted | Rail 232 (prototype), panel 420 (spec), `--panel`, A−/A+ at ≥ 900 |
| RDR-489 | adapted | Bottom edge, `--c-root`, position in the sūra + page of 604 (see RDR-140) |
| RDR-490 | adapted | Union of toggles (see RDR-044) |
| RDR-491 | adapted | Step 0.1 within [0.8, 1.6] (see RDR-116) |
| RDR-492 | adapted | States opt-in, stars not drawn (D20) |
| RDR-493 | done | Both: the optional band in the text and "Grammar here" in the entry (GrammarBand.tsx; sections/Meanings.tsx:122-157) |
| RDR-494 | adapted | The inline gloss appears once the sheet is put away (RDR-605) |
| RDR-495 | open | P2.0 resolved marginalia as notes in the margin on wide screens and inline on narrow; notes are inline at every width |
| RDR-496 | open | The union of verse tools is incomplete: Links, Topic, Concordance, Analyse missing (see RDR-150) |
| RDR-497 | open | The rail has the roots section (renamed) but no resume marker (see RDR-071) |
| RDR-498 | adapted | Top bar, search and word header as in the prototype, with this occurrence added; root gloss pending (RDR-197) |
| RDR-499 | done | One order, the spec's (see RDR-207) |
| RDR-500 | done | Where next closes every entry (see RDR-217) |
| RDR-501 | adapted | Breadcrumb at the top of the body |
| RDR-502 | done | A–Z root index (see RDR-195) |
| RDR-503 | adapted | In the Quran holds every occurrence (see RDR-267) |
| RDR-504 | done | Header toggle and the rest (see RDR-272) |
| RDR-505 | open | Dotted terms everywhere the spec names: the grammar band and the dictionaries are missing (see RDR-274) |
| RDR-506 | done | Jumps open and scroll (see RDR-279) |
| RDR-507 | adapted | Rationale required, sources optional (see RDR-318) |
| RDR-508 | open | Review per the spec not built (see §25) |
| RDR-509 | open | Deck entry rules not built (see RDR-360) |
| RDR-510 | done | Arrow keys + Enter (see RDR-382) |
| RDR-511 | done | Six formats, versioned permalinks, a verse-tool trigger, the article target (see RDR-383…399) |
| RDR-512 | adapted | jadhr-prefs, jadhr-personal, jadhr-saved, jadhr-audio (see RDR-429) |
| RDR-513 | done | URLs written and read (see RDR-449) |
| RDR-514 | done | Articles in Amiri; lang attributes (see RDR-240 and 465) |
| RDR-515 | done | 52 terms (see RDR-281) |
| RDR-516 | bug-fixed | Explicit visited flag (e2e "a returning reader is never sent back to Ask (RDR-516); a first visit lands in Ask") |
| RDR-517 | bug-fixed | Every index is per text and computed on the server; grammar comes from the occurrence itself (lexicon.py word_attestations; content.py related_verses) |
| RDR-518 | bug-fixed | No base-book keys: notes and progress are keyed by verse and text. Caution: notes use bare "2:255" keys and need the `quran:` namespace (P1.7a) before a second text arrives (lib/store/saved.ts:35-41) |
| RDR-519 | bug-fixed | No stop-list; every word is interactive (RDR-548) |
| RDR-520 | bug-fixed | One saved list (e2e "a starred word appears in Saved and in the Review count, and stays after a reload (RDR-520)") |
| RDR-521 | bug-fixed | Only jadhr-theme (ReaderHeader.tsx:77-81) |
| RDR-522 | bug-fixed | Scope-correct permalink and URL, consistent numbering, the real date, copy from state (Overlays.tsx:183-238; e2e "cite: a dialog with a versioned permalink and the real access date; Esc returns focus (RDR-461/522)") |
| RDR-523 | bug-fixed | Keyframes without a hard-coded translate (globals.css:109-112) |
| RDR-524 | open | No hover card yet (RDR-117); when built it must flip below near the top |
| RDR-525 | bug-fixed | Each verse's note keeps its own draft (VerseDrawer.tsx:90) |
| RDR-526 | bug-fixed | Counts follow the shown dictionaries; side by side respects them; no gist list or apparatus legend copied (sections/Dictionaries.tsx:49-53) |
| RDR-527 | bug-fixed | In layers mode a link opens and scrolls its folded section (e2e "links into a folded section open and scroll to it (RDR-527/589)"); a separate tabs-mode defect is at RDR-209 |
| RDR-528 | open | No seed reaches the editor at all (see RDR-361…370) |
| RDR-529 | bug-fixed | Every word per pattern (sections/Shapes.tsx:53-57) |
| RDR-530 | bug-fixed | The deck resets per word (AskView.tsx:121, 238-240) |
| RDR-531 | bug-fixed | A sūra change is a navigation; the overlay rail closes (Rail.tsx:92) |
| RDR-532 | bug-fixed | The sheet stays under the header and is never open on load (e2e "phone: the sheet opens at half height, under the header, and grows to full (RDR-532/605)") |
| RDR-533 | bug-fixed | The Dialog handles Esc in the capture phase (ui/Dialog.tsx:38-43) |
| RDR-534 | bug-fixed | Failure toasts (see RDR-457) |
| RDR-535 | open | An explicitly stored "new" state is not marked new in the text (ReadingSurface.tsx:210) — the same class of bug |
| RDR-536 | open | No scheduler, due count or in-context deck |
| RDR-537 | bug-fixed | "Grammar here" always shows the selected occurrence; there is no hover card to blank it (sections/Meanings.tsx:105) |
| RDR-538 | bug-fixed | No saved book index: the sūra comes from the URL |
| RDR-539 | bug-fixed | ?w= takes the tap path (e2e "a ?w= deep link takes the same path as a tap (RDR-539) and is recorded in the trail (RDR-587)") |
| RDR-540 | open | (minor) The long-press timer is cleared on touchmove and touchend but not on unmount |
| RDR-541 | done | Muṣḥaf / sūra / āya / word s:a:w; "Roots in this sūra"; the rail is the sūra index + juzʾ / ḥizb / page (Rail.tsx; e2e "rail: ajzāʾ and a mushaf page take the reader where they begin (P2.1)"); other shelves: RDR-063 |
| RDR-542 | done | RTL mirroring: rail at the start, panel at the end, flipped chevrons, inner-edge resize with an inverted drag, English isolated with dir=ltr, Arabic copy written natively (Panel.tsx:102-107; components/Icon.tsx:40-43; messages/ar.json rd) |
| RDR-543 | adapted | KFGQPC Uthmanic Hafs V22 for the mushaf (lib/fonts.ts:7-13); counts in Arabic-Indic digits while verse keys stay in Western digits as identifiers — implemented, not recorded in DECISIONS |
| RDR-544 | done | KFGQPC text verbatim and hash-checked; no flow targets the text (DECISIONS "Display text"; the suggest form targets senses only, Overlays.tsx:277-331) |
| RDR-545 | done | No regex stripping; a stored standard-spelling line (D7) (InlineLines.tsx:61-65) |
| RDR-546 | done | One normalisation spec with Quranic marks and alef wasla; imlāʾī and Uthmani shadows (PLAN P1.3a; DECISIONS "Two Arabic search shadows") |
| RDR-547 | open | Medallion drawn from Arabic-Indic digits, ḥizb ۞ non-interactive, the basmala rule, Quranic initials as tokens with entries (VerseLines.tsx:10-37; SurahText.tsx:23; LocationEntry.tsx); waqf signs and the sajda sign ۩ sit inside the word buttons (the text attaches them, e.g. 2:2 and 32:15 in tokens.jsonl), so they are interactive and unexplained |
| RDR-548 | done | Every word opens an entry: particles by lemma, pronouns and initials by location with "no root" (e2e "every word opens an entry: the Quranic initials and free pronouns by location (RDR-547/548)") |
| RDR-549 | done | This occurrence's segments prefix · stem · suffix from the corpus, with the stem's lemma and root (WordEntry.tsx:138-160) |
| RDR-550 | done | Contextual meaning first, this place, the root with Quran counts, lemma count, family, verses sharing the root (sections/Meanings.tsx:21-48; WordEntry.tsx:138-176; sections/InQuran.tsx) |
| RDR-551 | done | Grammar here from corpus features with Arabic labels, English in the English UI (sections/Meanings.tsx:122-157); iʿrāb is B10 / D23 |
| RDR-552 | done | Opt-in study mode, off by default, no state on tap (e2e "study mode: words are marked only by the reader, and the rail shows each sūra's coverage (D20, RDR-552/571)") |
| RDR-553 | done | Family underline and the sūra's roots in the rail (ReadingSurface.tsx:190-192; Rail.tsx:122-143) |
| RDR-554 | done | Human recitation, reciter choice, word timings, speed, repeat, continuous play with follow-along; no TTS (audio/AudioEngine.tsx; audio/AudioBar.tsx; e2e "recitation speed cycles 1×, 0.75×, 0.5× and repeat toggles (RDR-554)") |
| RDR-555 | open | Recite, Roots, Related (whole Quran, rarity-weighted), Copy with reference and translator credit, Graph, Note, plus Tafsir and Cite (ReadingSurface.tsx:325-348, 477); Links and Topic are missing |
| RDR-556 | done | Tafsir tool and verse mode: seven tafsirs, side by side, translations, recitation, knowledge layers (VerseEntry.tsx; TafsirSection.tsx; e2e "tafsir side by side: up to three works at once (P2.10)") |
| RDR-557 | open | Arabic UI: translation off with al-Muyassar as an option, transliteration off (InlineLines.tsx); the English translation cannot be chosen (no control sets `translation`, store.ts:157, 186) and the inline line shows no translator credit |
| RDR-558 | done | Every occurrence, whole-root switch, forms, sūra filter, Makki/Madani, paged, go to verse (e2e "In the Quran: the whole root and a sūra filter (RDR-558)") |
| RDR-559 | done | The Quran (632) as the anchor, In the Quran as the main block, no poetry lane (sections/Centuries.tsx; sections/InQuran.tsx) |
| RDR-560 | done | al-Mufradāt, Lisān, Maqāyīs, Lane, plus al-Ṣiḥāḥ, Ibn Qutayba's Gharīb and the wujūh books in Meanings; Arabic titles, AH/CE; no unaligned agreement shown (sections/Dictionaries.tsx; sections/Wujuh.tsx) |
| RDR-561 | done | Arabic lines first, English second (sections/Meanings.tsx:21-48) |
| RDR-562 | done | Family and Shapes restricted to Quranic lemmas with counts; wazn per lemma by the three-layer method (DECISIONS "Morphological pattern"); "all Arabic" waits for P11.1 |
| RDR-563 | done | Arabic term texts written for Arabic readers; Unicode-aware detection (data/glossary.yaml; lib/termDetect.ts) |
| RDR-564 | adapted | Arabic heading and placeholder, Quranic Try words, lemma lookup through search, the chat alphabet (search.py:56-65), the four-card deck; "Heard in" is the first occurrence rather than a chosen well-known verse (AskView.tsx) |
| RDR-565 | done | Verse references in every form, sūra names, juzʾ, ḥizb and page, root letters, translation text; verses first (search.py:91-136; e2e "omnibox: a juzʾ number opens the reader where it begins (RDR-565)") |
| RDR-566 | done | Quran citation forms, word location, the Arabic dictionary citation, /quran/{s}/{a}, /word/{s:a:w}, /roots/{root}, written to the address bar (DECISIONS 2026-10-03; e2e "cite a dictionary article by the Arabic convention (RDR-566)") |
| RDR-567 | open | Suggest covers senses and error reports, stored locally; no gloss or morphology-tag proposals and no review queue |
| RDR-568 | done | Verses and roots are trail steps (e2e "the trail records verses and roots as steps (RDR-568)") |
| RDR-569 | open | Review deck not built |
| RDR-570 | done | Arabic copy and عِلْمًا 20:114 (e2e "onboarding: the demo word is عِلْمًا in Ṭā Hā 20:114 (RDR-570)") |
| RDR-571 | done | Coverage per sūra without labels (e2e "study mode: words are marked only by the reader, and the rail shows each sūra's coverage (D20, RDR-552/571)") |
| RDR-572 | done | Last verse, progress on reading, /read resume, the hairline in the sūra and the mushaf (e2e "/read resumes on the last verse read with the resume marker (RDR-572/592)"; "the hairline reports the reading position in the sūra and the mushaf") |
| RDR-573 | open | Indexes are precomputed and al-Baqara is inside its budget (e2e "al-Baqara stays inside its budget"); long lists are paged, not virtualised (PLAN P2.10a open) |
| RDR-574 | done | Sūra, Makki/Madani, verses, juzʾ; "N / 114"; the end-of-sūra line (ReaderHeader.tsx:95-115; SurahText.tsx:27, 67) |
| RDR-575 | open | Multi-text reader (ḥadīth with isnād/matn, books, a personal shelf) not built |
| RDR-576 | done | None of the listed wrongs is present: no TTS, no default paint, no auto-learning, no placeholders, no stripping, every word clickable, copy with reference, Arabic first, Quran labels, no difficulty labels, no fixed topics |
| RDR-577 | done | e2e "folding the last open layer keeps Meanings open (RDR-577)" (store.ts:197-203) |
| RDR-578 | done | English in its own LTR elements with lang; Arabic with dir=rtl; dir=auto on mixed inputs and crumbs (InlineLines.tsx; AskView.tsx:78; Overlays.tsx:134; Trail.tsx:35; sections/WhereNext.tsx:44) |
| RDR-579 | done | Arabic and English senses as separate elements (sections/Meanings.tsx:58-59, 76-82) |
| RDR-580 | done | Longest-first escaped pattern with Unicode edges, a fresh regex per call (lib/termDetect.ts:9-25) |
| RDR-581 | done | Terms are buttons and never sit inside another clickable row (terms/Term.tsx:101) |
| RDR-582 | done | Flip, clamp and width cap; dark in both themes (terms/Term.tsx:17-23; globals.css:340-349) |
| RDR-583 | open | No hover card to clamp (RDR-117); the unknown-word popover does not apply |
| RDR-584 | open | Hover hand-off delays not built (RDR-117) |
| RDR-585 | done | 420ms, cancelled by touchmove; the open verse always shows its tools (ReadingSurface.tsx:283-293, 391-394) |
| RDR-586 | done | e2e "phone: touch targets meet the design's sizes (RDR-586)" (header 40, panel controls 44, heads 48, tools 40, ⋯ items 44) |
| RDR-587 | done | e2e "a ?w= deep link takes the same path as a tap (RDR-539) and is recorded in the trail (RDR-587)"; store.ts:264-270 |
| RDR-588 | done | sections/WhereNext.tsx:17-31 |
| RDR-589 | open | Works in layers mode; in tabs mode the target tab falls back (see RDR-209) |
| RDR-590 | done | e2e "panel history: back and forward between entries (RDR-590)"; back and forward restore each entry's own place |
| RDR-591 | adapted | No automatic learning at all (D20) |
| RDR-592 | open | (minor) Hidden on verse 1 (ReadingSurface.tsx:67), not on the verse holding the selection |
| RDR-593 | done | CSS max-width keeps 420px for reading and 320 for the panel, with the cap during drag (globals.css:1034-1044; Panel.tsx:103-107) |
| RDR-594 | done | See RDR-007 |
| RDR-595 | adapted | zustand persist writes on each change (no debounce) and merges over defaults; a saved-chapter check does not apply (store.ts:191-211) |
| RDR-596 | open | Proposals are neither re-read on focus nor shown (see RDR-322…324) |
| RDR-597 | adapted | Wording + rationale required (P2.0) (Overlays.tsx:287) |
| RDR-598 | adapted | One shared key; data-theme on <html> (see RDR-469) |
| RDR-599 | adapted | The server sends an excerpt and the full length, so nothing is measured after render; mask fade (sections/Dictionaries.tsx:136-153) |
| RDR-600 | adapted | scrollIntoView on targets after a short delay, with a hold while sections load (WordEntry.tsx:47-74; ReadingSurface.tsx:93-100) |
| RDR-601 | open | No seed is encoded or sent (see RDR-369) |
| RDR-602 | open | Hint after typing, exact first, frequency, chat digits and doubled vowels (AskView.tsx:48-56; search.py:56-65); nouns before verbs missing (see RDR-169) |
| RDR-603 | done | Matching normalisation folds; the mushaf is never display-stripped (packages/arabic-spec; D7) |
| RDR-604 | done | ReaderShell.tsx:75-84; ReaderHeader.tsx:86-93 |
| RDR-605 | done | e2e "phone: putting the sheet away keeps the word, with its gloss under the verse (RDR-605); the word stays above the sheet (RDR-416)" |
| RDR-606 | done | sections/Dictionaries.tsx:179-183 (and the tafsir comparison, TafsirSection.tsx:42-46) |
| RDR-607 | open | No apparatus |
| RDR-608 | open | No streams view |
| RDR-609 | done | Caps 1.15 / 1.2 / 1.25 (globals.css:731, 755, 919, 944, 949) |
| RDR-610 | done | min-width 0 + ellipsis on the title; Dictionary always last (ReaderHeader.tsx:110-115, 203-218) |
| RDR-611 | open | No in-context review |
| RDR-612 | open | (minor) Notes drop empty entries (lib/store/saved.ts:38-39), but `dictOff` keeps `false` entries instead of deleting them |
| RDR-613 | done | One audio element; frames cancelled on stop; the recited word drops its transition (audio/AudioEngine.tsx:42-80; globals.css:912-916) |
| RDR-614 | n/a | No unknown-word analysis on the Quran (RDR-549) |
| RDR-615 | n/a | Prototype comment metadata |
