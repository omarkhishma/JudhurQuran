# 17 · Classroom coverage — P9 against the design inventory and the code

Audited 2026-10-04 against commit `00b63ee` (branch `build/vision`). Scope: phase P9 "Classroom" of `docs/PLAN.md` — the 57 CLS items of inventory Part 4 (research 05: CLS-01…46, CLS-Q01…Q07, CLS-H01…H04) and DEF-11, measured against the code built in commits f8e67b3, 1126380, 8d9cb70, fd27167, 9896d99, 75c793b, dac6c62, 0533f1d, 747f903, d1b71a7 and 00b63ee, from the baseline in research 16.

**Method.** Each item read in research 05, then the code that answers it read: `services/api/src/jadhr_api/classroom.py`, `routes_classroom.py`, `shared_maps.py` (the class gate), `presence.py`, migrations 0028 and 0029; `apps/web/src/components/classroom/*` (`ClassroomHome`, `JoinClass`, `ClassPage`, `LessonPage`, `LessonMap`, `ClassroomSignals`, `LessonStrip`, `shared`), `lib/classroom.ts`, `lib/classroomSignals.ts`, and the frame receiver `components/graph/SplitReceiver.tsx`. A row is `done` only where a test or a screenshot read by eye shows it.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, the reason in DECISIONS or in the row. `bug-fixed` — a prototype defect the inventory flags that our code does not have. `n/a` — the item describes the prototype's own code.

**Evidence.** API: `services/api/tests/test_classroom_api.py` (8 tests: consent, the floor and "few", the matrix by choice, minors, notes, reminders, the lesson's map gate, proposals, the feed). e2e: `classroom.spec.ts` (6), `classroom-map.spec.ts` (1), `journey-f.spec.ts` (journey F on desktop and phone). Screenshots of every view at 1440 and 390 px in both themes, read.

## 1. Summary

| Status | Items |
|---|---|
| done | 36 |
| adapted | 13 |
| bug-fixed | 7 |
| n/a | 1 |
| open | 0 |
| **total** | **57** |

DEF-11 (the legend fixed while layers change; side tabs that do nothing; confirmations that never reach the embed; numbers that disagree): **bug-fixed** — every one of its five items is closed below (CLS-05, 32, 35, 23, 18).

Journey F (design 01 §1.5): **done** — `journey-f.spec.ts`, desktop and phone.

## 2. The items

### Assignment: the passage view (CLS-01…26)

| Item | Status | How |
|---|---|---|
| CLS-01 route and `?tab=` | adapted | `/classroom` lists the reader's classes; a class has lessons; a lesson's page `/classroom/lesson/{id}` holds the design's two tabs, `?tab=map` opening the map. The design's one page was one lesson of one class. |
| CLS-02 course label, tabs | adapted | The lesson's header names the class (breadcrumb), the lesson, its verses and its due date; tabs «أثر الصف» · «خريطة الدرس» (a member: «الدرس» · «خريطة الدرس»). |
| CLS-03 legend swatches | done | `Legend`: 1–3, 4–8, 9+ for lookups, one hue light to dark under the words. |
| CLS-04 layers | adapted | Lookups · notes · confirmed · struggling (DECISIONS: time is the lesson's median minutes, not a word's layer). |
| CLS-05 legend fixed (bug) | bug-fixed | The legend follows the layer: its words and its steps (`STEPS`), and the table's legend its own. |
| CLS-06 synthetic lookups | done | Counts the members' readers send for an open lesson's verses (P9.2a). |
| CLS-07 synthetic notes and time | adapted | Notes counted per verse (a note is written on a verse); time per lesson, never per word. |
| CLS-08 thresholds | done | ≥9 dark, ≥4 mid, ≥1 light for lookups; 1, 2, 4 for the rarer kinds (DECISIONS). |
| CLS-09 passage label and meta | adapted | Each verse: its place, and "N words, K looked up by the class" once the floor is met; "of 18 finished" is not kept per verse (a lesson is finished, not a verse). |
| CLS-10 tokens as buttons, tooltip | done | Each word a button with its heat, its numbers and transliteration on hover and in its accessible name. |
| CLS-11 translation under the passage | done | The reader's own translation when their reader shows one (English by default), credited, footnotes behind a fold. |
| CLS-12 every occurrence highlighted | done | The word in focus underlines its other occurrences (same lemma) in the root's colour. |
| CLS-13 focus card numbers | done | How many of the class looked it up and how often each on average; notes on its verse; confirmed; struggling — "few" below three learners. |
| CLS-14 focus sub-line | adapted | Part of speech, verb form and derivation from the reader's entry, the lemma, the root (a link), the transliteration; "worth a pause in class" at the darkest step — "Friday" is the lesson's due date, shown on the notes. |
| CLS-15 add to lesson notes | done | «أضفها إلى ملاحظات الدرس», then «في ملاحظات الدرس». |
| CLS-16 class tiles | done | Members, opened, finished, median minutes — computed. |
| CLS-17 most looked-up roots | done | The four roots most looked up in the lesson's verses, bars and counts, "few" below three learners. |
| CLS-18 roots over more passages (bug) | bug-fixed | Computed over the lesson's own verses only. |
| CLS-19 lesson notes rows | done | A word as the mushaf writes it, its place, a root, a line; the class's lookups beside a word; the due date in the heading. |
| CLS-20 notes not kept (bug) | bug-fixed | Saved, reworded, moved up and down, removed; they go with the lesson's file and page. |
| CLS-21 needs a nudge | done | Not opened, finished in under three minutes — named only by the member's own choice, never in a class for minors; "remind" is a notice on the member's page. |
| CLS-22 footer copy | done | The privacy said beneath the panel, with the floor and the "few" rule; a different text for a class of minors. |
| CLS-23 numbers disagree (bug) | bug-fixed | One source for every number. |
| CLS-24 matrix vs text | done | Both views (D13): the text, and the table of learners who chose by the lesson's roots, a cell focusing its pair. |
| CLS-25 layer model | adapted | The union that can be measured honestly (DECISIONS); the table has lookups, confirmed and struggling (a note has no root). |
| CLS-26 lesson builder | done | Ranges of verses (one to ten, 300 verses at most), roots, a due date. |

### Shared graph (CLS-27…42)

| Item | Status | How |
|---|---|---|
| CLS-27 the real editor mounted | done | The instructor edits the lesson's map in the editor framed in the page; a member reads it framed (the shared view). |
| CLS-28 the class-copy pill | adapted | In a bar above the frame, not over the canvas (DECISIONS). |
| CLS-29 open in the editor | done | «افتحها في المحرر»: the instructor's own copy, a member's draft or the shared view. Journey F ends there. |
| CLS-30 presence (fake) | done | Real presence on the map (P8.6) in the frame's header: who is there now, by name. |
| CLS-31 side tabs | done | Activity · Proposals · Topics · Notes. |
| CLS-32 tabs do nothing (bug) | bug-fixed | Each shows its own content (tablist, panels). |
| CLS-33 awaiting confirmation | done | Each proposal's cards dashed in amber, with its author, its note and its links; Confirm, Decline; a member takes back their own. |
| CLS-34 a confirmation in the feed | done | "تأكيد اقتراح {name}: …" at the top. |
| CLS-35 confirming never reaches the graph (bug) | bug-fixed | The cards go into the instructor's open editor as one undoable step and are kept — written and pushed to the shared copy — before the decision is recorded (d1b71a7). |
| CLS-36 the seeded feed | adapted | No seed: the feed is what happened (the instructor's saves, proposals made and decided, comments). |
| CLS-37 a feed entry's anatomy | done | A coloured dot, the name in bold, what happened, the time under it. |
| CLS-38 colour by kind, not person | done | The dot is the kind of card touched (root, pattern, word, verse, note); a comment is a ring. |
| CLS-39 the product's vocabulary | done | Verbal nouns after the name — «إضافة بطاقتين: …»، «اقتراح ر ح م» — never a gendered verb (DECISIONS). |
| CLS-40 the comment form | done | The map's comment box, with @ to mention anyone in the class; an empty one is not sent. |
| CLS-41 comments not kept (bug) | bug-fixed | Kept as the map's comments (P8.1-E), mentions resolved. |
| CLS-42 dead code | n/a | The prototype's own. |

### The model and the platform (CLS-43…46)

| Item | Status | How |
|---|---|---|
| CLS-43 endpoints | adapted | `/api/v1/classroom/…` in our own shape: classes, joining, lessons, the pack, counts, progress, heat, matrix, notes, nudges, the map, proposals, activity (research 16 §5). |
| CLS-44 tables | adapted | Schema `classroom`; counts per word, kind and day — never a trail of events (research 16 §2). |
| CLS-45 one graph or one per learner | done | One map per lesson (D13); a member's draft is their own copy in their browser until they send it. |
| CLS-46 phone and dark | done | Every view at 390 px and in dark, read; journey F on a phone. |

### Questions and hints (CLS-Q01…Q07, CLS-H01…H04)

| Item | Status | How |
|---|---|---|
| CLS-Q01 server | done | Accounts, roles, the API, presence. |
| CLS-Q02 privacy first | done | Consent before joining (its version kept), a floor of five, "few" below three, detail by the member's choice, a class for minors with no detail at all, counts deleted 90 days after the due date. Whether a parent's agreement asked on screen suffices for minors is the owner's legal question (research 16 §6). |
| CLS-Q03 ayah ranges, heat on the words, the docs' layers | done | |
| CLS-Q04 legibility | done | Heat under the words, never on the letters; the e2e checks the letters' colour is unchanged. |
| CLS-Q05 gently and privately | done | |
| CLS-Q06 moderated, inside the class | adapted | Members propose, the instructor confirms; the map is read by the class only, the link opening nothing for anyone else. The way out to the public is the instructor's own map, published by them — P8.5, which waits on the owner. |
| CLS-Q07 lesson pack | done | A file opened with no account; a noted word carries its text. |
| CLS-H01 the real editor in a frame | done | |
| CLS-H02 tight line boxes | done | |
| CLS-H03 aggregates by default | done | |
| CLS-H04 pills that let clicks through | adapted | Nothing sits over the canvas (CLS-28). |

## 3. Faults found while building, fixed

- F1 The classroom's pages showed an API refusal's English message to Arabic readers (dac6c62).
- F2 A confirmed proposal could be lost when the instructor left the page at once (d1b71a7).
- F3 A confirmed proposal's link was counted as the instructor's own edit in the feed (75c793b, before commit).
- F4 The notes' heat sat on the verse number as a capsule that read as a mark on the text; it now sits under the whole verse (9896d99, before commit).

## 4. Open, and whose

- The owner: whether a class for minors with a parent's agreement asked on screen is enough before launch (CLS-Q02, research 16 §6).
- The owner: P8.5 (publishing), the public way out for a class's map (CLS-Q06).
- Noted, not a CLS item: the feed is read again every half minute and on focus rather than pushed; the presence socket could carry it (proposal B47 in PLAN §8).
