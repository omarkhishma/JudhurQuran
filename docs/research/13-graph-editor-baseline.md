# 13 · Graph editor baseline — P8 against the design inventory and the code

Audited 2026-10-03 against commit `7caa827` (branch `build/vision`, clean tree). Scope: phase P8 "Graph platform" of `docs/PLAN.md` (§6 P8 with P8.1, P8.1a, P8.2–P8.6, P8.6a, P8.7; §7 "P8 | EDT 348 · QAN 25 · HWF 58 | 431") against `docs/research/05-design-inventory.md` Part 2 — §1 the editor, the split shell and the published graph (EDT-001…348), §2 the Quran adaptation notes (QAN-01…25), §3 the hard-won fixes and the defects not to copy (HWF-01…58): 431 items.

**Method.** Read in full: PLAN §0–§8 (P8 and its sub-steps word by word); every DECISIONS entry that touches the graph (DECISIONS:10 the approval of D1–D29, :20 seeds, :79 the canvas library, :103 and :107 the relation seeds, :138 the `searchParams` lesson, :186 prototype data); inventory Part 2 (lines 792–1358) and Part 1 §26, the hand-off sheet; audit 11's header, status rules, §1, §5 and §6 (the model for this report); research 06's per-layer summary and its Parts 1–3 on meaning relations, topics and verse relations. Code read in full: `components/graph/` (CardNode, GraphCanvas, GraphEditor, GraphHome, RootGraphView, SeedImport, SharedGraph — 1,069 lines) and `lib/graph/` (build, layout, persist, seed, seedCodec, types — 604 lines); the routes `graph/`, `graph/seed`, `graph/edit/[id]`, `graph/view`, `graph/root/[root]`, `split`, `g/[slug]` and `(app)/layout.tsx`; `reader5/GraphHandoff.tsx` and every graph entry point found by search (WordEntry, HoverCard, Family, InQuran, VerseDrawer, TrailMap, ExploreScreen, AnalyseScreen, ProfileScreen, destinations, NavLinks); `shell/Providers.tsx`; the graph parts of `account/SyncRunner.tsx` and `lib/sync/adapters.ts`; the `graph` namespace of `ar.json` and `en.json` (76 keys each); e2e `graph-handoff.spec.ts` in full and the graph tests in `analyse`, `root-usul`, `personal`, `regressions`, `entry-sections`, `explore`, `account-sync` and `profile`, and the page lists of `a11y.spec.ts`; the API's root, family, graph, occurrences, concordance, relations, dictionaries and verse-knowledge routes (`main.py`), `content.root_graph` and `root_occurrences`, `lexicon._family` and `root_family`, `knowledge.word_relations`, the relation tables in `loader.py` and migration 0008, the role and account migrations 0019–0021, `data/relations.yaml`; and, for behaviour the code delegates, @xyflow/react 12.12.0 and @xyflow/system 0.0.83 (defaults, delete order, measuring, accessible strings). Commands run, all read-only: `git rev-parse`; Python over `data/build/2026.10.0/*.jsonl` for the counts in §3; GET requests to this project's API (`/api/v1/roots/علم/family`) and production build (`localhost:3215`: the status of nine graph paths, and the root map's payload with `?focus=`). No browser, no test suite, no server started, no database connection. So every defect below was found by reading code — F1 and F2 traced through xyflow's source — and none was reproduced in a browser; the phone and dark claims rest on the code, not on screenshots.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, with the reason named (a DECISIONS entry, a code comment, a Quran note or a plain reason in the row). `bug-fixed` — a prototype defect the inventory flags that our code does not have. `n/a` — a prototype artefact with nothing to build. `open` — buildable in P8 and not built, or built with a fault that makes the item behave wrong; the row names what is missing and §3 places it in a sub-step. `waiting` — needs a later phase or an owner decision, named.

**Paths.** Bare component names (`GraphCanvas.tsx`, `CardNode.tsx`, `GraphEditor.tsx`, `GraphHome.tsx`, `RootGraphView.tsx`, `SeedImport.tsx`, `SharedGraph.tsx`) are in `apps/web/src/components/graph/`; `build.ts`, `layout.ts`, `persist.ts`, `seed.ts`, `seedCodec.ts`, `types.ts` in `apps/web/src/lib/graph/`; other `reader5/`, `shell/`, `account/` paths in `apps/web/src/components/`; `lib/…` is `apps/web/src/lib/…`; routes (`graph/…`, `split/page.tsx`, `g/[slug]/page.tsx`, `roots/[root]/page.tsx`, `(app)/layout.tsx`, `[locale]/layout.tsx`) under `apps/web/src/app/[locale]/`; `globals.css` is `apps/web/src/app/globals.css`; `ar.json`/`en.json` are `apps/web/src/messages/`; `main.py`, `content.py`, `lexicon.py`, `knowledge.py`, `loader.py`, `sync.py` in `services/api/src/jadhr_api/`; migrations in `services/api/alembic/versions/`; e2e specs in `apps/web/e2e/`; "xyflow index.mjs" is `apps/web/node_modules/@xyflow/react/dist/esm/index.mjs` (12.12.0) and "xyflow system index.mjs" `node_modules/.pnpm/@xyflow+system@0.0.83/node_modules/@xyflow/system/dist/esm/index.mjs`; `DECISIONS:n` is a line of `docs/DECISIONS.md`.

## 1. Summary

| Status | Items |
|---|---|
| done | 33 |
| adapted | 72 |
| bug-fixed | 6 |
| n/a | 4 |
| open | 315 |
| waiting | 1 |
| **total** | **431** |

Closed (done + adapted + bug-fixed + n/a): 115 of 431. Open: 315, all buildable in P8 and placed in its sub-steps in §3. Waiting: 1, the licence a published map carries (owner, §4).

What exists is a working root-family canvas built from the data, not the design's editor. Built and sound: the generated root map (root → lemmas → word forms with their first verse, more forms and every verse paged on demand), seeds from the reader, Explore and the Analyser with a dialog that counts what will be created, maps kept in IndexedDB and synced when signed in, labelled undo, export as JSON and as an image, share links that travel in the URL fragment, a right-to-left layout in both languages, and no pseudo-root for a particle anywhere. Most of the 72 `adapted` rows are xyflow's way of doing what the prototype hand-rolled (DECISIONS:79) and the seed decision that replaced proposal staging (DECISIONS:20). Not built: the library panel, the Details sidebar with Meaning, Settings and Comments, fields, frames, the context menu, map view, the keyboard model and its help, toasts, the pattern level of a root graph, topic and meaning graphs with data behind them, publish, fork, cite and embed, presence, the split view and a phone design.

Eighteen defects were found in the built code (§2). Four are serious: reopening a map can undo the work done since it was first opened (F1), deleting a card leaves its wires in the stored map (F2), verse text is drawn from the stored map, so a link or a file can show any words as a verse (F3, law L1), and uncertain readings of the reader's own text enter a map as fact (F4, law L3). The canvas also falls short of the accessibility bar (F14): unnamed zoom buttons, English screen-reader instructions in the Arabic interface, no keyboard way to link cards, small targets on phones, and no axe test of any graph page.

| Prefix | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|
| EDT | 348 | 22 | 63 | 2 | 2 | 258 | 1 |
| QAN | 25 | 2 | 0 | 0 | 0 | 23 | 0 |
| HWF | 58 | 9 | 9 | 4 | 2 | 34 | 0 |
| Total | 431 | 33 | 72 | 6 | 4 | 315 | 1 |

| Inventory subsection | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|
| 1.1 App shell and layout | 10 | 2 | 4 | 0 | 0 | 4 | 0 |
| 1.2 Header — edit mode (left → right) | 14 | 3 | 3 | 0 | 0 | 8 | 0 |
| 1.3 Header — read-only mode (published, non-embed) | 7 | 1 | 1 | 1 | 0 | 4 | 0 |
| 1.4 Library panel (left) — palette, roots, search | 16 | 0 | 1 | 0 | 0 | 15 | 0 |
| 1.5 Canvas — viewport, grid, pan, zoom, map view, fit, marquee | 17 | 1 | 7 | 0 | 0 | 9 | 0 |
| 1.6 Context menu and quick-add | 6 | 0 | 0 | 0 | 0 | 6 | 0 |
| 1.7 Toast surface | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| 1.8 Node kinds, lexicon model, default document | 11 | 0 | 5 | 0 | 0 | 6 | 0 |
| 1.9 Card anatomy | 19 | 1 | 5 | 0 | 0 | 13 | 0 |
| 1.10 Fields | 8 | 0 | 0 | 0 | 0 | 8 | 0 |
| 1.11 Extract and lexicon actions | 14 | 0 | 1 | 0 | 0 | 13 | 0 |
| 1.12 Edges and handles | 16 | 1 | 7 | 0 | 0 | 8 | 0 |
| 1.13 Frames (groups) | 10 | 0 | 0 | 0 | 0 | 10 | 0 |
| 1.14 Tidy (auto-layout) | 6 | 2 | 3 | 0 | 0 | 1 | 0 |
| 1.15 Selection, drag, keyboard navigation | 8 | 0 | 2 | 0 | 0 | 6 | 0 |
| 1.16 Details sidebar (right) — shell, header, breadcrumb, tabs | 6 | 0 | 0 | 0 | 0 | 6 | 0 |
| 1.17 Meaning tab (entry) | 12 | 0 | 0 | 0 | 0 | 12 | 0 |
| 1.18 Settings tab (editor) | 8 | 0 | 0 | 0 | 0 | 8 | 0 |
| 1.19 Comments | 5 | 0 | 0 | 0 | 0 | 5 | 0 |
| 1.20 Proposals (staged seed from Reader, Analyser, Collections, Shell) | 12 | 0 | 11 | 0 | 0 | 1 | 0 |
| 1.21 Undo / redo and labelled commits | 28 | 3 | 4 | 0 | 0 | 21 | 0 |
| 1.22 Toast copy (complete) | 14 | 0 | 1 | 0 | 0 | 13 | 0 |
| 1.23 Keyboard shortcuts — help modal (verbatim) and actual handling | 9 | 1 | 0 | 0 | 0 | 8 | 0 |
| 1.24 Autosave and save status | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| 1.25 Import / Export and document schema | 9 | 1 | 3 | 0 | 0 | 5 | 0 |
| 1.26 Publish flow | 6 | 0 | 0 | 0 | 0 | 6 | 0 |
| 1.27 Read-only / embed mode | 15 | 1 | 1 | 1 | 0 | 12 | 0 |
| 1.28 Fork, note seed, and inbound entry points | 6 | 0 | 1 | 0 | 1 | 4 | 0 |
| 1.29 Presence (Live) | 3 | 1 | 0 | 0 | 0 | 2 | 0 |
| 1.30 Dark mode and theming | 5 | 2 | 2 | 0 | 0 | 1 | 0 |
| 1.31 Phone and narrow-width behaviour | 3 | 0 | 1 | 0 | 0 | 2 | 0 |
| 1.32 Accessibility | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| 1.33 Persistence keys (prototype → production) | 6 | 2 | 0 | 0 | 0 | 4 | 0 |
| 1.34 Split Shell (`Shell.dc.html`, route `/split`) | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| 1.35 Published Graph page (`Published Graph.dc.html`, route `/g/<slug>`) | 18 | 0 | 0 | 0 | 1 | 16 | 1 |
| 1.36 API and data model mapping | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| 2. Quran adaptation notes | 25 | 2 | 0 | 0 | 0 | 23 | 0 |
| 3. Hard-won fixes (subtle rules found in code) | 42 | 9 | 9 | 0 | 0 | 24 | 0 |
| Defects not to copy (summary of [BUG] items) | 16 | 0 | 0 | 4 | 2 | 10 | 0 |

**The count.** The inventory's Part 2 bullets give 431 IDs — EDT 348, QAN 25, HWF 58 — exactly PLAN §7's figures for P8; the subsection of each ID is the inventory heading it sits under. Both tables and the status table were computed from §5 by the script in §6.

**Beyond the inventory.** P8.3 (topic graphs) and P8.4 (meaning graphs) close one inventory item each (QAN-09, QAN-10) because the design barely drew them; their measure is the vision (V5: "root-based (default), topic-based, meaning-based") and PLAN P8.3–P8.4, which §3 spells out. Five items of earlier audits also wait on P8 and close in §3's sub-steps without being counted here: RDR-239 "+ Add to graph" from a dictionary article (audit 08), HUB-25 the published-graphs destination and NTB-22 a note as a description card (audit 10), PRF-20 published graphs in the Profile and MAP-05's graph part (audit 11).

## 2. Defects in what is already built

Numbered F1…F18 (F for fault, so they cannot be mistaken for PLAN's decisions D1–D29). Where a defect makes an item behave wrong it is that item's reason for `open`; §3 names the sub-step that fixes each.

### Data loss and integrity

**F1 · Reopening a map in the same tab can undo the work done since it was first opened, and every opening rewrites the map.** The editor reads a map through React Query with `staleTime: Infinity` (GraphEditor.tsx:18), and the app's QueryClient keeps an unused query for an hour (shell/Providers.tsx:13-15). Nothing invalidates `["graph", id]`: not a save (persist.ts:26-34 only fires `jadhr:docs`), not a hand-off that adds cards into the map (SeedImport.tsx:25-31), not sync writing a newer copy from another device (account/SyncRunner.tsx:73 invalidates `["my-graphs"]` only). Reopening the map by a client-side link — My maps, the Profile's Maps tab, the hand-off's redirect — renders the copy loaded the first time. Saved cards carry no measured size (persist.ts:30), so xyflow measures them on mount and sends `dimensions` changes to `onNodesChange` (xyflow index.mjs:3483-3501, 3550-3561); `setNodes` makes a new array, `onChange` takes it for an edit (GraphEditor.tsx:74-78), and 800 ms later `saveGraph` writes the old cards over the stored ones (GraphEditor.tsx:33-41). A reader who adds a note, goes back to My maps and opens the map again loses the note; a hand-off "into" a map opened earlier in the session loses its new cards; a copy synced from another device is overwritten (sync keeps the loser 30 days). Even with a fresh read, every opening rewrites the map and moves `updatedAt`, so viewing reorders My maps and syncs as an edit. The e2e tests reload the page between steps (graph-handoff.spec.ts:84-92), so they cannot see it. Fix: read the map afresh on every mount (or invalidate on `jadhr:docs`), save only on the reader's changes (not `dimensions` or `select`), and refuse to write over a stored copy newer than the one loaded.

**F2 · Deleting a card that has wires keeps the wires in the stored map, in two undo steps.** xyflow's delete removes the connected wires first and the card second, synchronously (xyflow index.mjs:1129-1153). Both handlers commit from the same render's `nodes` and `edges` (GraphCanvas.tsx:257-278, 103-111): the wires' commit sets the old cards with the new wires, then the card's commit sets the new cards with the old wires, and the last write wins. The wires stay in the document — saved (persist.ts:31), exported (GraphCanvas.tsx:321-324), shared (persist.ts:56-64) — unseen, because xyflow draws no wire without both ends, and they come back when the card's id returns (ids are deterministic: a root added again, a hand-off into the map). Fix: one `onDelete` that commits cards and wires together.

**F3 · Verse text comes from the stored map, so a link or a file can show any words as a verse (law L1).** A verse card draws `data.verse.left / word / right` in the KFGQPC font with the sūra's name and the verse number (CardNode.tsx:84-89, 109-122). That text is a copy kept in the map and never read again from the hash-checked text: a share link decodes every card's data from the URL fragment (persist.ts:66-85; SharedGraph.tsx:17-26) and Import stores cards as given (GraphHome.tsx:28-37). A crafted link therefore shows any words as «البقرة: ٢٥٥» in the Quran's font under the site's header, and "Save a copy" and sync carry them on. Separately, occurrence cards keep five words each side of the word (GraphCanvas.tsx:226-228) and a word card's first verse five each side (content.py:699-700) with no «…» to say the verse was cut — the first-verse box only clamps its lines (CardNode.tsx:112) — so a fragment reads as the whole verse. Fix: keep only verse keys and word places in the map, draw the text from the API, and mark every excerpt.

**F4 · Uncertain readings of the reader's own text enter a map as fact (law L3).** The Analyser seeds a map with each token's chosen lemma whatever its confidence, including those it marks unsure on screen (AnalyseScreen.tsx:83-87; the marks at 163 and 173), and links straight to the editor without the hand-off dialog (190-194). `trailSeed` builds a lemma card and a root card for each with no confidence and no mark (seed.ts:105-149), linked to the phrase as if analysed. QAN-19 and HWF-22 ask that analysed text keep its confidence and that nothing enter unreviewed. Fix: carry the confidence in the seed, show the dialog with amber rows, and mark such cards and links as readings.

**F5 · Card ids differ by entry point, so one word or one verse can be on a map twice.** The root builder names a word `word:{lemma}:{form}` and an occurrence's verse `verse:{location}` (build.ts:21-25; GraphCanvas.tsx:215); the verse and trail seeds name a verse `verse:{key}` (seed.ts:81, 136); the palette names a word `word:{location}` and a verse `verse:{key}` (GraphEditor.tsx:118, 151). A verse seed added into a map made from a word of that verse gives two cards of one verse — the RDR-367 test checks that ids are unique (graph-handoff.spec.ts:97), which they are, not that the verse appears once — and two words of one verse opened from word cards give two cards of it. Lemma cards are keyed on the database's numeric lemma id (build.ts:22), which P1.3b does not promise to keep between releases; the slugs it does promise (`data/registry/lemma-slugs.tsv`) are the safer key for maps that are shared and published.

**F6 · "+n more forms" does nothing in the editor, and roots and verses added from search are dead ends.** The editor renders the canvas without the root payload (GraphEditor.tsx:64-93) and the lemma expansion needs it (GraphCanvas.tsx:197), so on every map made from a seed or saved from the root map the button the builder put there (build.ts:99; CardNode.tsx:131-137) is inert. A root card added from search or a verse seed cannot pull its family in, and a verse card added from search cannot link its words (EDT-111, EDT-117).

### Copy that says the wrong thing

**F7 · "Saved in this browser only" is false for a signed-in reader.** The editor's status, My maps and the lead say «محفوظة في هذا المتصفح فقط» (ar.json and en.json `graph.localOnly`, `graph.editorLead`; GraphEditor.tsx:85; GraphHome.tsx:85), while a signed-in reader's maps sync to the account (lib/sync/adapters.ts:259-266; persist.ts:8).

**F8 · My maps and the hand-off's list are up to an hour old.** `["my-graphs"]` (GraphHome.tsx:16; reader5/GraphHandoff.tsx:43) takes the app's one-hour `staleTime` (shell/Providers.tsx:14) and is invalidated only by delete, import and sync (GraphHome.tsx:39, 103; account/SyncRunner.tsx:73). Creating a map (GraphHome.tsx:22-26), saving a copy (RootGraphView.tsx:19-23; SharedGraph.tsx:31-33) and every edit do not, so a map just made is missing from My maps and from the hand-off's choices for the rest of the hour, and titles, counts and dates lag.

**F9 · Undo labels are wrong, and folding is an undo step.** A new link is labelled with the hint sentence «اسحب من نقطة طرف البطاقة إلى بطاقة أخرى لربطهما.» (GraphCanvas.tsx:280), a move «↔» (394), folding «طيّ البطاقة» whether it folds or unfolds (182-187) — and folding is undoable, against EDT-099 and EDT-210, so it floods the stack — editing a note «ملاحظة» (188-193), a wire's label «وصف الصلة (اختياري)» (373), deleting «حذف المحدد» with no count (261, 272), adding the bare nouns «جذر / كلمة / آية / ملاحظة» (GraphEditor.tsx:141, 158, 177, 196), expanding the button captions (GraphCanvas.tsx:201, 249). The Undo button's title shows them as «تراجع: ↔».

**F10 · Counts are not plural forms.** `graph.cards` «{n} بطاقة», `moreForms` «+{n} صيغة أخرى», `moreVerses` «+{n} موضعًا آخر», `trailTitle` «مسار قراءة ({n} خطوات)», and in English "{n} cards" and "+{n} more forms", read wrong for most numbers («٣ بطاقة», «١ خطوات», "1 cards"). The ICU forms and the `cnt` helper the Profile uses already exist (lib/format.ts:15; the `cardsCount` message, ar.json:1798). QAN-14, HWF-49.

**F11 · A missing map and an unknown slug say the wrong thing.** `/graph/edit/{id}` for a map not in this browser says «لا خرائط بعد. ابدأ خريطة جديدة…» (GraphEditor.tsx:20; `graph.noGraphs`), wrong when the reader has maps and silent about why (another device, signed out, deleted). `/g/{anything}` answers 200 with the "being built" frame (g/[slug]/page.tsx:11-14; checked by GET), acceptable until P8.5, when it must become a 404 with EDT-063's copy.

**F12 · Explore's "see the set as a map" draws a reading trail.** A curated set is sent as a trail seed (ExploreScreen.tsx:291, 335), so the map is titled «مسار قراءة (n خطوات)» and its words are chained by numbered links 1…n (seed.ts:150-154), an order the set does not have.

**F13 · Lemma cards are called «صيغة» / "Form" and wear the Form colour.** The design's Form is the pattern (وزن) and its Word is the lemma (QAN-01). `graph.kindLemma` «صيغة» and the Form colour (types.ts:49) on lemma cards teach that a lemma is a pattern, and will collide with pattern cards in P8.2.

### Accessibility and phone (law L7)

**F14 · The canvas falls short for keyboard and screen-reader users and on phones.** The zoom buttons are named "−" and "+" (GraphCanvas.tsx:413, 416). xyflow gives every card and wire an English instruction — "Press enter or space to select a node. Press delete to remove it and escape to cancel." — and the minimap "Mini Map" (xyflow system index.mjs:30, 33, 41), in the Arabic interface and on read-only views where nothing can be deleted; `ariaLabelConfig` is not passed (GraphCanvas.tsx:382-408). Cards take focus (xyflow `tabIndex = 0`, role `group`, index.mjs:2366) with no name, so a reader hears "group" and the card's whole text; ports cannot be focused, so there is no keyboard way to link two cards; the canvas's `aria-label` sits on a `div` with no role, where it is not announced (GraphCanvas.tsx:381). On phones the card controls are 24–26 px (CardNode.tsx:58, 132, 139, 144, 150) against the product's 40 px (44 for overlays), and the palette takes up to 42 dvh above a canvas squeezed under a wrapping toolbar (GraphEditor.tsx:163; GraphCanvas.tsx:331). No axe test visits a graph page (a11y.spec.ts:5, 21), and no e2e test uses the editor's tools on a phone.

**F15 · The dark canvas is xyflow's colour.** The pane draws xyflow's dark `#141414` (its `--xy-background-color-default`), not the design's `--canvas` `#0f0f12` (globals.css:50); nothing overrides it in the canvas (GraphCanvas.tsx:381-408). Minor.

### Smaller faults

**F16 · Import trusts the file, export loses the map's type, and the picker cannot pick the same file twice.** Import accepts any JSON with `nodes` and `edges` arrays and stores them as given (GraphHome.tsx:28-37): cards of unknown kinds, wires to missing cards, any text in any card (F3); one message for every failure (40-42). Export leaves `kind` out (GraphCanvas.tsx:322), so a root map comes back free (GraphHome.tsx:34). The file input is never reset (GraphHome.tsx:79).

**F17 · Read-only views keep editing tools.** The generated root map and a shared map show Tidy, Undo/Redo and the exports (GraphCanvas.tsx:343-359) and their ports, and let cards be dragged (xyflow's `nodesDraggable` is on by default); T re-lays out a shared composition from anywhere on the page (GraphCanvas.tsx:287-301). Nothing is saved, so no data is harmed, but it is not EDT-282's read-only mode.

**F18 · A failed occurrence page leaves the button doing nothing.** The verse expansion calls `fetch(…).then((r) => r.json())` with no status check and no catch (GraphCanvas.tsx:208-250); a 429 or a 500 rejects unhandled and the reader sees nothing.

### Checked and sound

Seeds are checked field by field, with lengths and patterns, and an unreadable one says so (seedCodec.ts:34-69; SeedImport.tsx:36-40). No particle gets a pseudo-root: the word seed gives a rootless word its own card (seed.ts:56-60), the verse seed skips rootless words (79), the trail and the palette leave `rootKey` empty (seed.ts:126-131; GraphEditor.tsx:126). The reader's notes are labelled «ملاحظة شخصية — ليست من المصادر» (CardNode.tsx:123), and no card text is generated: everything else comes from the API. Cards built from the API show the KFGQPC words verbatim: joining a verse's tokens with a space rebuilds its `text_qpc` exactly for 6,035 of 6,236 verses, and the other 201 differ only by the leading ۞ quarter mark, which the tokens leave out (computed from `data/build/2026.10.0`; the verse-number glyph is left out everywhere). Share links travel in the fragment and never reach the server (persist.ts:55-64), the image is drawn in the browser, and the canvas makes no third-party request (L5). The index of maps changes in one IndexedDB step (persist.ts:36-49, audit 11 F12). The first layout of a new map is not an undo step and an imported map keeps its positions (HWF-45). Read-only views write nothing (EDT-288). `/graph/root/{root}?focus=` renders per request (`Cache-Control: no-store` on GET, the focus in its payload), so the `searchParams` lesson (DECISIONS:138) does not bite this page.

### Stale or inconsistent lines elsewhere (not edited here)

- PLAN §6 still heads P8 with the lock mark for D5, but D5 was approved with the plan (DECISIONS:10): presence only, then soft locks, no CRDT.
- PLAN P8.4 says al-Furūq gives "211 Quranic root pairs" (research 06's figure before parsing); the built seeds hold 512 furūq rows with both ends mapped to Quranic roots, 456 distinct pairs of two roots and 51 rows within one root.
- PLAN P3.9's status counts "cross-references from Ibn Kathīr (5,979 citations)"; `verse_crossrefs.jsonl` holds 21,998 rows (20,246 high confidence, 5,218 distinct source verses). No count I tried gives 5,979; not reconciled.
- PLAN §3.2's Editor row says "labelled undo" and "import/export": the labels are partly wrong (F9), and import makes a new map rather than loading into the editor.
- The editor's maps have their own kind `free` (types.ts:30); PLAN P8.1a names three graph types (root · topic · meaning). P8.1a should say what a free map is.

## 3. Proposed build order for P8

Every open item closes in exactly one sub-step below (the script in §6 checks it). The order follows the dependencies: P8.0 first, because readers can already lose work and see unverified text in what is built; P8.1a next, because every later step writes the document; then the editor (P8.1 in five parts), then root graphs (P8.2), which need the pattern kind and the card anatomy; P8.3 and P8.4 need data that is not yet held or not yet reviewable and the editorial workbench P3.0, which is not built; P8.5 and P8.6 need P8.1-E's server document; P8.6a's mock-ups go to the owner at the checkpoint; P8.7 is the exit.

#### P8.0 · Fix what is built

- **Closes (23):** EDT-015, EDT-099, EDT-137, EDT-197, EDT-210, EDT-214, EDT-218, EDT-224, EDT-225, EDT-229, EDT-230, EDT-235, EDT-236, EDT-258, EDT-260, EDT-261, EDT-262, HWF-22, HWF-27, HWF-28, HWF-49, QAN-14, QAN-19
- **Fixes:** F1, F2, F3 (text drawn from the API by key, excerpts marked «…»; the rest of QAN-02 closes in P8.2), F4, F6 (EDT-112 itself closes in P8.2), F7, F8, F9, F10, F11 (the missing-map copy; the slug's 404 is P8.5), F12, F16, F18.
- **Depends on:** nothing.
- **Data and API:** exists — `/verses/{key}` with the verse's tokens, the KFGQPC words verbatim (§2 "Checked and sound"); `/analyse` with each token's confidence (AnalyseScreen.tsx:163, 173); `/roots/{root}/graph` for the editor's lemma expansion. Add — a bounded batch `GET /verses?keys=…` (a map can hold dozens of verse cards); a `set` seed kind (or `words` without step numbers) for Explore; the confidence in the trail seed.
- **Tests:** reopen a map by a client-side link after an edit and after a hand-off into it, and check the stored map; delete a card with wires and check the stored wires; a forged share link must not draw its text; plural forms in both languages; import a bad file.

#### P8.1a · The graph document, version 2

- **Closes (13):** EDT-072, EDT-073, EDT-078, EDT-127, EDT-128, EDT-135, EDT-243, HWF-15, HWF-16, HWF-17, QAN-01, QAN-05, QAN-11
- **Fixes:** F5, F13.
- **Depends on:** P8.0.
- **Model:** `doc_version: 2` with a migration of version-1 maps on read (in the browser and in records synced from other devices); `graphType` root · topic · meaning, and what a free map is (types.ts:30); kinds root · pattern · lemma · verse · note (the description card) · frame, a word's place kept as data on the lemma or verse card it belongs to; one id per data key — `root:{key}`, `pattern:{slug}`, `lemma:{slug}`, `verse:{s}:{a}` — using the stable slugs P1.3b promises (`data/registry/lemma-slugs.tsv`, `pattern-slugs.tsv`) rather than database ids; typed edges `rel` (derives, realises, attests, cites, describes, part-of-topic, near-in-meaning with its «فرق» note, opposite-of, wujūh sense, ḍidd, field member), each with an optional source; connection rules per graph type, relaxing root → root and verse → verse through typed relations (D17); a cycle rule per relation (derivation chains acyclic; meaning relations symmetric); the refusals explained in the product's words.
- **Data and API:** the relation types come from the seed tables (`relation_candidates.type`, 0008_knowledge_and_relations.py) and PLAN P8.1a; nothing new on the server.

#### P8.1 · Editor parity — A: the editor's frame, library, help and messages

- **Closes (43):** EDT-001, EDT-002, EDT-004, EDT-009, EDT-011, EDT-013, EDT-020, EDT-022, EDT-024, EDT-032, EDT-033, EDT-034, EDT-035, EDT-036, EDT-037, EDT-038, EDT-039, EDT-040, EDT-041, EDT-042, EDT-043, EDT-044, EDT-045, EDT-047, EDT-063, EDT-070, EDT-071, EDT-237, EDT-242, EDT-247, EDT-249, EDT-250, EDT-251, EDT-252, EDT-253, EDT-254, EDT-309, HWF-26, HWF-34, HWF-40, QAN-12, QAN-15, QAN-22
- **Depends on:** P8.1a.
- **What:** the editor's own header in `(app)/layout.tsx` (title with Enter and Escape, save status, Tidy · Fit, Undo · Redo, Import · Export, Reader · {word}, Publish, Details, theme, help); the library — card types with Arabic names and hints written for the Quran's objects, the roots on and off the map with their counts, find-a-card with Arabic folding (the normalisation spec) and verse references, drag and drop; empty states; the shortcuts modal and its keys; toasts with Undo; panel preferences kept on the device; a transliteration preference, off by default in Arabic.
- **Data and API:** exists — `/search` (normalised), `/roots?keys=` for root tiles, `/roots/{root}` and `/roots/{root}/family` for "{n} patterns · {n} words". Nothing to add.

#### P8.1 · Editor parity — B: canvas, wires, keyboard and accessibility

- **Closes (34):** EDT-051, EDT-056, EDT-058, EDT-059, EDT-060, EDT-061, EDT-062, EDT-064, EDT-065, EDT-066, EDT-067, EDT-068, EDT-069, EDT-131, EDT-132, EDT-134, EDT-158, EDT-159, EDT-160, EDT-161, EDT-162, EDT-163, EDT-233, EDT-256, EDT-307, EDT-308, HWF-02, HWF-03, HWF-04, HWF-12, HWF-36, HWF-37, HWF-54, QAN-20
- **Fixes:** F14 (on desktop), F15.
- **Depends on:** P8.1a.
- **What:** wheel pans and ⌘/Ctrl + wheel zooms; the zoom pill with its percentage and reset; map view below 0.35 with Arabic only in the Arabic interface, height measuring paused in it; fit capped at 100%; the context menus with quick-add; the design's keyboard model in place of xyflow's arrow-moves (parent, child, siblings, ⌥ nudge as an undo step, Enter folds, Escape, ⌘A); arrowheads, the hot and picked wire states with zoom compensation, the selected-wire pill with its relation and Unlink; an 8 px grid. Accessibility: `ariaLabelConfig` in both languages, a name on every card ("{kind}: {Arabic}, {count}") and wire ("{relation}: {from} → {to}"), a keyboard way to link two selected cards, focus returned after menus and dialogs, axe on every graph page in both themes.
- **Data and API:** none.

#### P8.1 · Editor parity — C: cards, fields, frames and descriptions

- **Closes (58):** EDT-080, EDT-081, EDT-082, EDT-083, EDT-088, EDT-089, EDT-092, EDT-093, EDT-094, EDT-096, EDT-098, EDT-101, EDT-102, EDT-103, EDT-104, EDT-105, EDT-106, EDT-107, EDT-108, EDT-109, EDT-119, EDT-120, EDT-122, EDT-140, EDT-141, EDT-142, EDT-143, EDT-144, EDT-145, EDT-146, EDT-147, EDT-148, EDT-149, EDT-154, EDT-186, EDT-188, EDT-189, EDT-213, EDT-216, EDT-217, EDT-219, EDT-220, EDT-221, EDT-222, EDT-226, EDT-228, EDT-231, EDT-232, EDT-245, EDT-246, EDT-265, EDT-266, EDT-292, HWF-29, HWF-30, HWF-46, HWF-52, HWF-57
- **Also closes (carried):** NTB-22 (a note as a description card, audit 10) and RDR-239 ("+ Add to graph" from a dictionary article as a description card quoting the article with its credit, audit 08).
- **Depends on:** P8.1a.
- **What:** the card anatomy — folded and open widths, a one-line folded summary, the stats strip, the fields section, "+ Description" and "Focus", double-click folding; the ten field kinds built from 04 §4.7 (D16) as one component with two densities; blank cards of every kind; descriptions attached to a card; frames with geometric membership; duplicate keeping the data keys; delete with its count and toast; the Notebook's note seed, decoded once. A verse card's text stays read-only (L1).
- **Data and API:** none for the editor. Audio, image and file fields are kept in IndexedDB on the device; a published map that carries them needs object storage (D12) — decide in P8.5 whether published maps may carry files at all.

#### P8.1 · Editor parity — D: the Details sidebar, Meaning and Settings

- **Closes (31):** EDT-138, EDT-164, EDT-165, EDT-166, EDT-167, EDT-168, EDT-169, EDT-170, EDT-171, EDT-172, EDT-173, EDT-174, EDT-175, EDT-176, EDT-177, EDT-178, EDT-179, EDT-180, EDT-181, EDT-182, EDT-183, EDT-184, EDT-185, EDT-187, EDT-223, EDT-248, HWF-31, HWF-38, HWF-50, QAN-17, QAN-18
- **Depends on:** P8.1a, P8.1-C (fields in Settings).
- **What:** the sidebar with its header, breadcrumb and tabs (proper tab roles); Meaning per kind — a root's core idea as Ibn Fāris's words with his page, not "our wording" (L2), the corpus count instead of typed attestations, the nine dictionaries in death-date order with the real articles, display-only and credited (D22), copy onto a card as a field with its citation; a lemma's own meanings (al-Muyassar, al-Mufradāt, the wujūh), not the root's; a verse's reference, sūra, Makki or Madani, translation and words. Settings: headword (not for verse text), fields, links, actions; read-only text for published copies (EDT-289, in P8.5). EDT-181's scan-and-corpus drop waits on P11 (D9a).
- **Data and API:** exists — `/roots/{root}` with counts and the dictionaries' articles per root (content.py:438, 717), `/roots/{root}/family` with `gist_ar` and its source, `/words/{slug}` (the panel's one-request payload), `/patterns/{slug}`, `/verses/{key}` and `/verses/{key}/knowledge` (main.py:198-208), `/lexicon/entries/{id}`, `/dictionaries` (main.py:401-406). The English root gloss is P3.4's (RDR-474): show nothing rather than a guess.

#### P8.1 · Editor parity — E: the server document, autosave and comments

- **Closes (10):** EDT-190, EDT-191, EDT-192, EDT-193, EDT-194, EDT-259, EDT-311, EDT-342, EDT-347, HWF-48
- **Depends on:** P8.0 (F1), P6 (accounts, built).
- **What:** a per-graph server document for the signed-in reader (`graphs`: id, owner, title, doc, doc_version, updated_at), `PUT /graphs/:id` debounced, revision history, a conflict check before writing; comments per graph with anchors, threads, resolve and mentions (`graph_comments`), shown on their cards. Without an account everything keeps working on the device (L6).
- **Decision to record first:** today a signed-in reader's maps go to the server as sealed sync records (sync.py:33; 0021_sealed_keys.py). A plain `graphs` table would weaken that. Recommended: private maps stay sealed sync records; a server document exists only for a map the reader shares for comments or publishes.
- **Data and API:** add migration (graphs, graph_revisions, graph_comments) and the endpoints of 08 §8.6 (EDT-342, EDT-347).

#### P8.2 · Root graphs from the full data

- **Closes (26):** EDT-086, EDT-090, EDT-091, EDT-110, EDT-111, EDT-112, EDT-114, EDT-115, EDT-116, EDT-117, EDT-118, EDT-121, EDT-123, EDT-215, EDT-240, EDT-348, HWF-51, QAN-02, QAN-03, QAN-04, QAN-06, QAN-07, QAN-08, QAN-21, QAN-24, QAN-25
- **Depends on:** P8.1a (pattern kind, ids), P8.1-C (card anatomy and stats), P8.1-B (map view for large roots).
- **What:** root → patterns → lemmas → verses, readable at every zoom; extract per kind with "to extract" counts from the corpus; verse cards in the Quran font, wider than word cards, one card per verse with every matching word marked, with its translation and recitation; "10 of 105 verses" pages with sūra and form filters; a verse's "link words / roots / both" with particles skipped by default and offered as "no root" cards; the generated graph shown read-only on every root page with "Save a copy" (QAN-21); the design's spacing (156 / 56) with more room in verse columns.
- **Data and API:** exists — `/roots/{root}/family` groups the lemmas by pattern with the pattern's slug, Arabic and form number (lexicon.py:132-165; for ع ل م, 14 lemmas in 14 pattern groups, read by GET), `/roots/{root}/graph` (content.py:658-707), `/roots/{root}/occurrences` paged by lemma and form with a total (content.py:473-534), `/concordance` with sūra, juzʾ, place, pattern, lemma and form filters and server totals (main.py:483-500), `/verses/{key}` with every word's lemma, root and part of speech, the two credited translations, word-timed recitations (`/recitations/{reciter}/verses/{key}`). Add — a root-graph payload v2: pattern groups (slug, Arabic full · bare · translit, form number, the function where editors have written it — `function_ar` is empty today, P3.3), lemmas (slug, part of speech, gloss, particle flag, counts), verse keys per lemma paged by verse rather than by occurrence; sūra and pattern filters on the occurrences endpoint (or the canvas reads `/concordance`).

#### P8.3 · Topic graphs

- **Closes (1):** QAN-09
- **Depends on:** P8.1a (topic type, `part-of-topic`), P8.1-C (frames as sub-topics, descriptions as headings), and the editorial workbench P3.0, which is not built (P7's roles and two-person review exist: member, reviewer, editor, instructor, admin in 0020_contributions.py).
- **What:** PLAN P8.3 in full — an editorial Arabic taxonomy (top level from La Beaume's public-domain index of 1878 merged with Quranpedia's roots), Quranpedia's assignments imported with credit and version, QSAC mapped in only as editor-side candidates for sūras 40–114 (D29), every verse–topic link with its source, version, reviewer and confidence, coverage per sūra reported; people and places from the P3.9 registry; the reader's own topics beside the editorial ones, never mixed in.
- **Data and API:** held — no topic data at all: `data/raw/` has no Quranpedia, QSAC or La Beaume files and the database no topic table. Usable now: 107 proper-noun entity candidates, 59 with Wikidata ids (`entity_candidates`, 0008); 21,998 verse cross-references from Ibn Kathīr, 20,246 of high confidence (`verse_crossrefs`); the reader's own topics in the browser (lib/reader/store.ts:267-268, 299-300, 380-390). Add — the downloads pinned with licence-register rows; tables `topics` (bilingual labels, Arabic canonical, parent, source) and `topic_links` (verse, topic, source, version, reviewer, confidence, status); `/topics`, `/topics/{id}`, `/verses/{key}/topics`; the coverage report. D19's question to Quranpedia (where its index comes from; commercial use) goes out under the owner's name; the non-commercial launch (D2) does not wait on it.

#### P8.4 · Meaning graphs

- **Closes (1):** QAN-10
- **Depends on:** P8.1a (typed relations), P3.0 (the workbench).
- **What:** PLAN P8.4 in full — an editorial relation table, one row per edge (near-synonym with its «فرق» note, contrast, antonym, wujūh sense, ḍidd, field member) with source work, locator, quote, verses, editor and review status; a meaning-graph layout (roots in one column, shared verses beside them); the reader's own links with a relation label. Near-synonymy plus the classical «فرق», never full synonymy. Arabic WordNet only as editor-side candidates and Qabas internal only (D27).
- **Data and API:** held (0008_knowledge_and_relations.py; `data/relations.yaml`; DECISIONS:103), all `extracted`, none reviewed: 4 works; 2,108 entries (Ibn al-Jawzī 321, al-Dāmaghānī 493, al-ʿAskarī 939, Ibn al-Anbārī 355); 7,558 candidates — wujūh senses 4,004, near-synonym candidates 2,279 (all with both ends mapped to Quranic roots, 1,698 distinct root pairs), furūq contrasts 920 (512 with both roots mapped: 456 distinct pairs, 51 within one root), aḍdād 355; 7,635 resolved quotations. Served only per lemma (`/words/{slug}/relations`, main.py:221-232; knowledge.py:126-237). Add — the editorial table seeded from the candidates, review in the workbench, `/roots/{root}/relations` and `/relations?roots=…` for the canvas. The seeds are CC BY-NC-SA 4.0 (D18), which bears on EDT-335.

#### P8.5 · Publish, read-only, fork, cite and embed

- **Closes (58):** EDT-021, EDT-025, EDT-026, EDT-027, EDT-030, EDT-238, EDT-239, EDT-244, EDT-257, EDT-269, EDT-270, EDT-271, EDT-272, EDT-273, EDT-274, EDT-275, EDT-276, EDT-277, EDT-279, EDT-280, EDT-282, EDT-283, EDT-284, EDT-285, EDT-286, EDT-287, EDT-289, EDT-290, EDT-291, EDT-302, EDT-312, EDT-324, EDT-325, EDT-326, EDT-327, EDT-328, EDT-329, EDT-330, EDT-331, EDT-332, EDT-333, EDT-334, EDT-336, EDT-338, EDT-339, EDT-340, EDT-341, EDT-343, EDT-344, EDT-345, EDT-346, HWF-11, HWF-24, HWF-32, HWF-42, HWF-53, HWF-56, QAN-23
- **Also closes (carried):** HUB-25 (audit 10), PRF-20 and MAP-05's graph part (audit 11).
- **Fixes:** F17, F11's 404.
- **Depends on:** P8.1-E (server document), P8.1-D (Meaning and a read-only Settings), EDT-335 (the licence, owner).
- **What:** publish with editable title, description and slug (Arabic letters kept, percent-encoded), an immutable snapshot, unpublish and versions; `/g/{slug}` rendered on the server with a real 404; `/embed/g/{slug}` without the header, its display options as parameters; the same editor component read-only with one guard; fork with its count, cite with its count in BibTeX, RIS and plain text; postMessage in and out with an origin allow-list; the `doc_version` fallback; verse text drawn from the API on published maps too (F3).
- **Data and API:** exists — accounts, bearer sessions and roles (0019_accounts.py; routes_me.py). Add — `published_graphs` (slug, graph, owner, title, description, doc, doc_version, counts, forked_from, fork_count, cited_count, published_at) and 08 §8.6's publish, published list and read, fork and cite endpoints.

#### P8.6 · Presence and the split view

- **Closes (15):** EDT-014, EDT-295, EDT-296, EDT-297, EDT-313, EDT-315, EDT-316, EDT-317, EDT-318, EDT-319, EDT-320, EDT-321, EDT-322, EDT-323, HWF-41
- **Depends on:** P8.1-E; EDT-295's other missing callers come from P8.1-C (the Notebook) and P8.5 (the published page); the Classroom's comes with P9.
- **What:** presence only, then soft locks, no CRDT (D5): who is on a map, ephemeral, last write wins on save; `/split` with the reader and the editor as components rather than frames, shared state instead of polling, "send word to graph" adding the word's real form, part of speech and root into the open map without a reload; dark and phone.
- **Data and API:** none of it exists — no WebSocket endpoint and no Redis in `services/api` or `infra/`. Add a WebSocket per graph behind Caddy (D12 sizing).

#### P8.6a · The phone editor (not in the design)

- **Closes (2):** EDT-304, EDT-306
- **Fixes:** F14 (on phones).
- **Depends on:** P8.1 A–D; mock-ups shown to the owner at the P8 checkpoint before building (PLAN P8.6a).
- **What:** full-screen canvas, palette and Details as bottom sheets, long-press for card actions, read-only by default with an explicit edit mode, 40 px controls and 44 px overlays.

#### P8.7 · Exit ◆

- **Closes (0):** — the checks that prove the rest
- Journey E end to end, including an embed on an external test page; e2e for every sub-step on desktop and phone; axe on `/graph`, `/graph/edit/{id}`, `/graph/root/{root}`, `/g/{slug}`, `/embed/g/{slug}` and `/split` in both themes; screens at 1440, 1024 and 390 px in both themes read side by side with the prototype; this report's script re-run with the new statuses.

## 4. Waiting

| ID | What | Who or which phase |
|---|---|---|
| EDT-335 | The licence a published map carries. The design prints CC BY-SA 4.0; a map can hold KFGQPC text, display-only lexicon text (D22) and CC BY-NC-SA relation seeds (D18). Needed before P8.5's stats line and citation can name a licence | Owner decision (a new D-number) |

Parts of open items that wait elsewhere: EDT-181's scan-and-corpus drop (P11, D9a) and EDT-295's Classroom caller (P9). Neither keeps P8 from closing its part.

## 5. All items

### §1.1 App shell and layout

| ID | status | evidence / notes |
|---|---|---|
| EDT-001 | open | The editor wears the shared site header (`(app)/layout.tsx:7-15`, whose comment says the editor gets its own header in P8) over [palette · canvas] (GraphEditor.tsx:61-95); no Details column (EDT-164) |
| EDT-002 | open | A wrapping toolbar row inside the canvas column (GraphCanvas.tsx:331-362), not a 52 px header; no embed mode to hide it in |
| EDT-003 | done | A `flex-1 min-h-0` row (GraphEditor.tsx:61) under a `100dvh − 52px` main (`(app)/layout.tsx:15`); its third column is EDT-164's |
| EDT-004 | open | None of the design props: cards start unfolded (no builder sets `folded`, types.ts:20), no transliteration preference (QAN-22), no arrows (GraphCanvas.tsx:407), no map threshold (EDT-058); curved wires are xyflow's default bezier |
| EDT-005 | adapted | The light tokens (globals.css:15-43), root, word and ring darker than the prototype's to pass AA (audit 11, SHR-07) |
| EDT-006 | adapted | The dark tokens (globals.css:50-74); the canvas pane itself draws xyflow's dark background #141414, not `--canvas` (F15) |
| EDT-007 | adapted | `KIND_COLOR` from the type tokens (types.ts:47-53), dot and label in the type colour on every card (CardNode.tsx:50-53); lemma cards wear the Form colour while there are no pattern cards (F13) |
| EDT-008 | adapted | Amiri (`ar-classical`) for roots and lemmas, the KFGQPC font (`quran`) for Quran words and verses (CardNode.tsx:85, 93), Plex for the interface |
| EDT-009 | open | No toast, help or menu motion; Tidy jumps — only the fit animates (GraphCanvas.tsx:118) |
| EDT-010 | done | `::selection` at 24% of the ring and a 2 px `:focus-visible` ring at 2 px offset, site-wide (globals.css:147-154) |

### §1.2 Header — edit mode

| ID | status | evidence / notes |
|---|---|---|
| EDT-011 | open | The shared header's logo links home (shell/SiteHeader.tsx); the editor's own header is P8.1 |
| EDT-012 | adapted | An always-editable title field named «إعادة التسمية» (GraphCanvas.tsx:332-338) instead of a button that turns into one — one control, reachable by Tab |
| EDT-013 | open | Built: changes save (GraphEditor.tsx:70-73), canvas keys stand down while typing (GraphCanvas.tsx:289-290), not an undo step. Missing: Enter to commit, Escape to cancel, trimming, and an empty title keeping the old one — it is saved as «خريطة بلا عنوان» while the field stays empty (GraphEditor.tsx:39) |
| EDT-014 | open | No presence (P8.6) |
| EDT-015 | open | Status with `aria-live="polite"`, green when saved and amber otherwise, «حُفظت / جارٍ الحفظ… / تغييرات غير محفوظة» (GraphEditor.tsx:81-87); it adds «محفوظة في هذا المتصفح فقط», false for a signed-in reader (F7) |
| EDT-016 | done | `ms-auto` group (GraphCanvas.tsx:343) |
| EDT-017 | done | «ترتيب» and «ملاءمة» with `aria-keyshortcuts` T and F (GraphCanvas.tsx:344-347, 296-297); visible words instead of tooltips |
| EDT-018 | done | Disabled when empty; title «تراجع: {label}» / «إعادة: {label}»; ⌘Z, ⇧⌘Z and Ctrl (GraphCanvas.tsx:291-295, 348-355); no "nothing to undo" title; several labels are wrong (F9, EDT-214…230) |
| EDT-019 | adapted | Export as JSON and as an image (GraphCanvas.tsx:303-324, 356-359); Import lives on My maps and always makes a new map (GraphHome.tsx:28-43, 79-80), so a file never replaces the open one; its validation is EDT-260 |
| EDT-020 | open | No way back to the reader at the word the map came from; cards carry «افتح في المصحف» to `/word/{location}` (CardNode.tsx:148-155) |
| EDT-021 | open | No publish; a share link carries the whole map in the URL fragment (GraphEditor.tsx:50-58, 88-92; persist.ts:56-64) — P8.5 |
| EDT-022 | open | No Details panel to toggle (EDT-164) |
| EDT-023 | adapted | The theme toggle is the shared header's (shell/SiteHeader.tsx:26; shell/ThemeToggle.tsx:8), one key for every screen (EDT-303) |
| EDT-024 | open | No help button or modal (EDT-249) |

### §1.3 Header — read-only mode

| ID | status | evidence / notes |
|---|---|---|
| EDT-025 | open | The read-only views — the generated root map and a shared link — carry the editing toolbar: Tidy, Fit, Undo/Redo, Image, JSON (GraphCanvas.tsx:343-359), plus «صفحة الجذر» and «احفظ نسخة في خرائطي» (RootGraphView.tsx:34-41; SharedGraph.tsx:27-38); no read-only pill, no Fold/Unfold all (F17) |
| EDT-026 | open | No fold-all |
| EDT-027 | open | No unfold-all |
| EDT-028 | done | «ملاءمة» and F in every mode (GraphCanvas.tsx:296, 346) |
| EDT-029 | adapted | «احفظ نسخة في خرائطي» copies the generated root map or a shared map into the reader's maps and opens the editor (RootGraphView.tsx:19-23; SharedGraph.tsx:28-37); forking a published graph, with its count, is EDT-290 and EDT-345 |
| EDT-030 | open | P8.5: read-only offers Fork, Cite and Open in editor (the union, D21) |
| EDT-031 | bug-fixed | Read-only views render the title as a heading, not a field (GraphCanvas.tsx:332-341; neither RootGraphView nor SharedGraph passes `onTitleChange`) |

### §1.4 Library panel

| ID | status | evidence / notes |
|---|---|---|
| EDT-032 | open | A 300 px palette on wide screens, stacked above the canvas at up to 42 dvh on phones (GraphEditor.tsx:163), edit-only; it cannot be hidden and keeps no open state |
| EDT-033 | open | No collapsed rail |
| EDT-034 | open | The palette's field searches the dataset to add cards («ابحث عن جذر أو كلمة أو آية (مثل ٢:٢٥٥)», GraphEditor.tsx:166-172); nothing finds a card already on the map |
| EDT-035 | open | No find-on-canvas (its folding: QAN-15) |
| EDT-036 | open | Not built |
| EDT-037 | open | Not built |
| EDT-038 | open | Not built |
| EDT-039 | open | Not built |
| EDT-040 | open | No card-types section |
| EDT-041 | open | Only a «ملاحظة» button (GraphEditor.tsx:173-182); roots, words and verses come only from search results (187-223); no draggable type tiles and no blank cards (EDT-081) |
| EDT-042 | open | No hints (to be written for the Quran's objects, QAN-01) |
| EDT-043 | open | A click adds at the centre of the view (GraphCanvas.tsx:159-171); no drag and drop |
| EDT-044 | open | Search lists roots with their Quran count only (GraphEditor.tsx:187-204); no roots list, no "forms · words" counts |
| EDT-045 | open | Adding a root already on the map changes nothing visible and still pushes an undo step (GraphCanvas.tsx:161-170); no "already on the canvas" state or message |
| EDT-046 | adapted | Every root of the dataset through search (GraphEditor.tsx:104-108) instead of six hard-coded ones; a particle never gets a pseudo-root (seed.ts:56-60) |
| EDT-047 | open | No shortcuts button |

### §1.5 Canvas

| ID | status | evidence / notes |
|---|---|---|
| EDT-048 | adapted | xyflow's dot background in `--dot`, tracking pan and zoom (GraphCanvas.tsx:409), gap 18 instead of 24; the dark pane colour is F15 |
| EDT-049 | adapted | xyflow's viewport (DECISIONS:79); a map opens on the reader's word and verse at a legible zoom (GraphCanvas.tsx:51-56, 124-139, 403-404) |
| EDT-050 | adapted | xyflow's SVG wire layer (DECISIONS:79) |
| EDT-051 | open | A plain wheel or two-finger scroll zooms: xyflow's defaults `zoomOnScroll = true`, `panOnScroll = false` (xyflow index.mjs:3767) are not overridden (GraphCanvas.tsx:382-408) |
| EDT-052 | adapted | Pinch and ⌘/Ctrl + wheel zoom at the pointer (xyflow); range 0.15–2 (GraphCanvas.tsx:401-402) |
| EDT-053 | adapted | Space + drag pans (xyflow `panActivationKeyCode = 'Space'`, reset on window blur: index.mjs:473, 3767); a plain drag on empty canvas pans too |
| EDT-054 | adapted | Shift + drag draws the selection box (xyflow `selectionKeyCode = 'Shift'`), since a plain drag pans; there is no Details panel to open (EDT-164) |
| EDT-055 | done | A click on empty canvas clears the selection (xyflow, `elementsSelectable`, GraphCanvas.tsx:399) |
| EDT-056 | open | Two buttons named "−" and "+" (GraphCanvas.tsx:412-419); no percentage, no reset; the names are not words (F14) |
| EDT-057 | adapted | A minimap on wide screens (GraphCanvas.tsx:410), which the design does not have; its accessible name is xyflow's English "Mini Map" (F14) |
| EDT-058 | open | No map view (QAN-20) |
| EDT-059 | open | Not built |
| EDT-060 | open | «ملاءمة» fits everything but zooms a small map up to 200% (no ≤ 100% clamp, GraphCanvas.tsx:296, 346); only the first view clamps to 0.6–1 (135) |
| EDT-061 | open | Not built (no search step, no comment jump) |
| EDT-062 | open | Not built (no arrow navigation) |
| EDT-063 | open | A new map opens on an empty canvas with no message (GraphHome.tsx:22-26); the missing-map and unknown-slug states are F11 |
| EDT-064 | open | No drop target |

### §1.6 Context menu and quick-add

| ID | status | evidence / notes |
|---|---|---|
| EDT-065 | open | No context menu; right-click opens the browser's |
| EDT-066 | open | Not built |
| EDT-067 | open | Not built |
| EDT-068 | open | Not built (no frames) |
| EDT-069 | open | Not built |
| EDT-070 | open | Palette clicks only (GraphEditor.tsx:173-223); no right-click "New …", no "+ Description" |

### §1.7 Toast surface

| ID | status | evidence / notes |
|---|---|---|
| EDT-071 | open | No toast on the canvas; the share button swaps its own label (GraphEditor.tsx:88-92) |

### §1.8 Node kinds, lexicon model, default document

| ID | status | evidence / notes |
|---|---|---|
| EDT-072 | open | Kinds root · lemma · word (a surface form) · verse · note (types.ts:4); no pattern card, no frame (QAN-01) |
| EDT-073 | open | A label and a colour per kind (ar.json `graph.kind*`; types.ts:47-53); no hint or child name |
| EDT-074 | adapted | No invented sample: a new map is empty or generated from the data (GraphHome.tsx:22-26; RootGraphView.tsx:14); the prototype's content is a UI fixture only (DECISIONS:186) |
| EDT-075 | adapted | As EDT-074: links come from the data (build.ts:103-108; seed.ts:94-96) |
| EDT-076 | adapted | Sentences are Quran verses from the corpus (seed.ts:61-66, 76-99; GraphCanvas.tsx:204-250) |
| EDT-077 | adapted | Cards carry data keys — `rootKey`, `lemmaId`, `form`, `verse.location` (types.ts:8-25) — instead of index pointers |
| EDT-078 | open | Ids from data keys (build.ts:21-25), but each entry point spells them differently, so one word or verse can sit on a map twice (F5) |
| EDT-079 | adapted | Notes `note:{12 hex}` (GraphEditor.tsx:177; persist.ts:51-53); wires `e:{source}->{target}` (build.ts:25) |
| EDT-080 | open | No fields on any card (EDT-092); QAN-16 replaces the typed attestation count with the corpus's |
| EDT-081 | open | No blank root, word or verse cards; notes only (GraphEditor.tsx:173-182) |
| EDT-082 | open | Every card starts unfolded |

### §1.9 Card anatomy

| ID | status | evidence / notes |
|---|---|---|
| EDT-083 | open | `w-max`, 200–340 px, radius 12, sized by xyflow's measuring (CardNode.tsx:39-47); no folded and open widths, no wider verse card (QAN-03) |
| EDT-084 | adapted | The spec's `outline: 2px solid var(--ring)` at 2 px offset (CardNode.tsx:42) rather than the prototype's halo (D21: the more visible of the two) |
| EDT-085 | adapted | Dot and type label in the type colour at the start, count and fold at the end (CardNode.tsx:49-68); no pill background and no capitals (Arabic) |
| EDT-086 | open | One Quran count per card (CardNode.tsx:55; build.ts:50, 75, 96), not child counts |
| EDT-087 | adapted | Arabic first and largest, `lang="ar"`: the KFGQPC font at 30 px / 1.8 for Quran words, Amiri at 28 px for roots and lemmas, roots letter-spaced (CardNode.tsx:90-99; build.ts:75) |
| EDT-088 | open | Folding hides the lower lines but keeps the headline and the whole verse (CardNode.tsx:84-102); no one-line summary |
| EDT-089 | open | A second line — transliteration for roots, part of speech and wazn for lemmas, the plain spelling for words (CardNode.tsx:104-108; build.ts:30-35); no gloss, though the root payload carries `gloss_en` (build.ts:14) |
| EDT-090 | open | Not built |
| EDT-091 | open | Not built (QAN-02 for verses) |
| EDT-092 | open | Not built |
| EDT-093 | open | Not built |
| EDT-094 | open | Not built |
| EDT-095 | adapted | On-demand buttons instead of one extract button — «+n صيغة أخرى», «المواضع (n)», «+n موضعًا آخر» (CardNode.tsx:130-142) — the bounded expansion of DECISIONS:79; the lemma one is dead in the editor (F6) |
| EDT-096 | open | No "+ Description" or "Focus" (our `focus` flag is the ring on the reader's path, CardNode.tsx:43) |
| EDT-097 | adapted | A 24 px chevron in the card's header with `aria-label` and `aria-expanded` (CardNode.tsx:56-66) instead of a bottom strip; below phone target size (F14) |
| EDT-098 | open | Double-click does not fold |
| EDT-099 | open | Folding is an undo step labelled «طيّ البطاقة» both ways (GraphCanvas.tsx:182-187) (F9) |
| EDT-100 | done | `nodrag` on every control inside a card (CardNode.tsx:58, 74, 132, 139, 144, 150) |
| EDT-101 | open | The reference anatomy — stats, fields, extract, actions — is not built |

### §1.10 Fields

| ID | status | evidence / notes |
|---|---|---|
| EDT-102 | open | No fields |
| EDT-103 | open | Not built |
| EDT-104 | open | Not built |
| EDT-105 | open | Not built |
| EDT-106 | open | Not built |
| EDT-107 | open | Not built |
| EDT-108 | open | Not built |
| EDT-109 | open | Not built; built from 04 §4.7 unless the owner exports the two missing files (D16, approved). The note's text area, saved on blur (CardNode.tsx:73-80), is the only field-like control |

### §1.11 Extract and lexicon actions

| ID | status | evidence / notes |
|---|---|---|
| EDT-110 | open | Expansion buttons are plain `.btn` (CardNode.tsx:132, 139); no filled primary in the type colour, no disabled or all-done look |
| EDT-111 | open | A generated root map arrives with every lemma (build.ts:77-109), but a root card from search or from a verse cannot pull its family in (GraphEditor.tsx:194; seed.ts:91) |
| EDT-112 | open | «+n صيغة أخرى» adds a lemma's remaining forms, then tidies and fits (build.ts:113-126; GraphCanvas.tsx:197-202) — on the root map only: in the editor it does nothing (F6) |
| EDT-113 | adapted | «المواضع (n)» pages a word's verses eight at a time from `/roots/{root}/occurrences` with «+n موضعًا آخر» (GraphCanvas.tsx:204-250; main.py:536-552) — QAN-06's bounded paging; it does not link the verse to other words already on the map; one card per occurrence (F5), no error path (F18) |
| EDT-114 | open | No all-done state |
| EDT-115 | open | Verse cards have no action |
| EDT-116 | open | Not built |
| EDT-117 | open | Only at creation: a verse seed builds root → lemma → word → verse for each word with a root (seed.ts:76-99); a verse card added from search stays unlinked |
| EDT-118 | open | Not built |
| EDT-119 | open | A note shows its text area and «ملاحظة شخصية — ليست من المصادر» (CardNode.tsx:71-83, 123); no attach hint |
| EDT-120 | open | No hand-made data cards (EDT-081) |
| EDT-121 | open | No E key |
| EDT-122 | open | Notes are added loose at the centre of the view (GraphEditor.tsx:173-182), never attached to a card |
| EDT-123 | open | Availability exists only for a lemma's remaining forms and a word's remaining verses (build.ts:99; GraphCanvas.tsx:235-246) |

### §1.12 Edges and handles

| ID | status | evidence / notes |
|---|---|---|
| EDT-124 | adapted | `{id, source, target, data: {label}}` with a free-text label (persist.ts:31; GraphCanvas.tsx:363-380); typed relations are P8.1a (QAN-10) |
| EDT-125 | adapted | Two ports in the reading direction — in on the right, out on the left (CardNode.tsx:26-30, 48, 160); always shown, read-only views included (F17) |
| EDT-126 | adapted | xyflow's connection line; a wire must end on a port, not anywhere on the card |
| EDT-127 | open | `addEdge` drops a duplicate silently and still pushes an undo step; no rules, no cycle check, no message (GraphCanvas.tsx:279-282) |
| EDT-128 | open | Any pair may be linked today; D17 (approved) asks for typed relations per graph type (P8.1a) |
| EDT-129 | adapted | Fixed right-in, left-out ports with the right-to-left layout (layout.ts:7-21) |
| EDT-130 | adapted | xyflow's bezier (GraphCanvas.tsx:407); no elbow option |
| EDT-131 | open | No arrowheads |
| EDT-132 | open | One wire style, `--edge` at 1.5 px (GraphCanvas.tsx:407); no hot or picked state, no zoom compensation (HWF-04) |
| EDT-133 | done | xyflow's 20 px transparent hit path (`interactionWidth = 20`, index.mjs:2587) |
| EDT-134 | open | A selected wire opens a label field under the toolbar (GraphCanvas.tsx:363-380); no relation text, no Unlink button |
| EDT-135 | open | No relation names (P8.1a) |
| EDT-136 | adapted | Backspace or Delete removes a selected wire as one undo step (GraphCanvas.tsx:268-278, 400); no Unlink button or toast |
| EDT-137 | open | Deleting a card leaves its wires in the stored map (F2) |
| EDT-138 | open | No Details panel |
| EDT-139 | adapted | Labels are drawn on wires: a trail's step numbers (seed.ts:150-154) and the reader's own labels — a trail's order has to be visible on the map |

### §1.13 Frames (groups)

| ID | status | evidence / notes |
|---|---|---|
| EDT-140 | open | No frames |
| EDT-141 | open | No frames |
| EDT-142 | open | No frames |
| EDT-143 | open | No frames |
| EDT-144 | open | No frames |
| EDT-145 | open | No frames |
| EDT-146 | open | No frames |
| EDT-147 | open | No frames |
| EDT-148 | open | No frames |
| EDT-149 | open | No frames |

### §1.14 Tidy (auto-layout)

| ID | status | evidence / notes |
|---|---|---|
| EDT-150 | adapted | ELK's layered layout following the links, right to left (layout.ts:10-35), rather than fixed type columns; a loose note sits in the first layer |
| EDT-151 | adapted | 120 px between layers (layout.ts:17) |
| EDT-152 | adapted | Brandes–Köpf placement, 36 px between cards (layout.ts:18-19) |
| EDT-153 | done | Measured sizes feed the layout (layout.ts:25-26; GraphCanvas.tsx:115, 124-139), so open cards never overlap; no 8 px snap (HWF-12), no glide (EDT-009) |
| EDT-154 | open | No frames |
| EDT-155 | done | «ترتيب» is one undo step followed by a fit (GraphCanvas.tsx:113-121); a new map's first layout is not an undo step (124-139); expansions re-tidy (201, 249) |

### §1.15 Selection, drag, keyboard navigation

| ID | status | evidence / notes |
|---|---|---|
| EDT-156 | adapted | A click selects; ⌘ or Ctrl + click adds (xyflow `multiSelectionKeyCode`, since Shift draws the box); no Details to open |
| EDT-157 | adapted | Dragging moves the selection, one undo step per drag (GraphCanvas.tsx:389-397) whose label is wrong (EDT-229); no 8 px snap (HWF-12) |
| EDT-158 | open | No ⌘A |
| EDT-159 | open | No parent, child or sibling steps; xyflow's arrow keys move the focused card instead |
| EDT-160 | open | Not built |
| EDT-161 | open | xyflow's arrows move a selected card a few pixels with no undo step; no ⌥ nudge |
| EDT-162 | open | No Escape handling |
| EDT-163 | open | Enter selects the focused card (xyflow); it does not fold |

### §1.16 Details sidebar

| ID | status | evidence / notes |
|---|---|---|
| EDT-164 | open | No Details sidebar |
| EDT-165 | open | Not built |
| EDT-166 | open | Not built |
| EDT-167 | open | Not built |
| EDT-168 | open | Not built |
| EDT-169 | open | Not built |

### §1.17 Meaning tab (entry)

| ID | status | evidence / notes |
|---|---|---|
| EDT-170 | open | No Meaning tab |
| EDT-171 | open | Not built |
| EDT-172 | open | Not built |
| EDT-173 | open | Not built |
| EDT-174 | open | Not built; Ibn Fāris's core idea is served (`gist_ar`, `/roots/{root}/family`, lexicon.py:602-611) and must be quoted as his words, not as "our wording" (L2) |
| EDT-175 | open | Not built (QAN-16) |
| EDT-176 | open | Not built |
| EDT-177 | open | Not built |
| EDT-178 | open | Not built; the nine dictionaries with editions, death dates and licences are served (`/dictionaries`, main.py:401-406) and per root (`/roots/{root}` → `lexicon`, content.py:438, 717) |
| EDT-179 | open | Not built |
| EDT-180 | open | Not built; the articles are real (QAN-18) |
| EDT-181 | open | Not built: copying an article onto a card, the transliteration toggle, copying text and credit per article are P8.1; dropping a scan or corpus file waits on P11 (D9a) |

### §1.18 Settings tab (editor)

| ID | status | evidence / notes |
|---|---|---|
| EDT-182 | open | No Settings tab |
| EDT-183 | open | Not built; a verse card's text must never be editable (L1) |
| EDT-184 | open | Not built |
| EDT-185 | open | Not built |
| EDT-186 | open | Only fold on the card and Backspace to delete; no Duplicate or "+ Description" |
| EDT-187 | open | Not built |
| EDT-188 | open | Not built (copies keep their data keys, HWF-46) |
| EDT-189 | open | Backspace or Delete removes the selection (GraphCanvas.tsx:257-267, 400) as «حذف المحدد», with no count and no toast, and the wires stay in the document (F2) |

### §1.19 Comments

| ID | status | evidence / notes |
|---|---|---|
| EDT-190 | open | No comments |
| EDT-191 | open | Not built |
| EDT-192 | open | Not built |
| EDT-193 | open | Not built; per graph, on the server (HWF-48, EDT-347) |
| EDT-194 | open | Not built: markers on cards, threads, resolve, mentions |

### §1.20 Proposals (staged seed)

| ID | status | evidence / notes |
|---|---|---|
| EDT-195 | adapted | A seed names data, not cards: base64url of UTF-8 JSON `{seed: word · root · verse · trail}` (seedCodec.ts:10-30), checked field by field (34-60) and built from the current dataset (seed.ts:157-168); an unreadable seed says so instead of being ignored (SeedImport.tsx:36-40) — DECISIONS:20; e2e graph-handoff.spec.ts:106-125 |
| EDT-196 | adapted | No proposal records: cards from data keys, de-duplicated by id when added to a map (seed.ts:187-207) |
| EDT-197 | open | Corpus seeds need no confidence (QAN-19), but the Analyser's readings of the reader's own text arrive with none (F4) |
| EDT-198 | adapted | The review point moved to the reader: the hand-off dialog lists what will be created, counted by the same builder, and where it goes (GraphHandoff.tsx:36-99; DECISIONS:20) |
| EDT-199 | adapted | As EDT-198 (GraphHandoff.tsx:63-78); the Analyser and Explore go straight to the editor without it (AnalyseScreen.tsx:190-194; ExploreScreen.tsx:335) |
| EDT-200 | adapted | One row per kind with names and a count (GraphHandoff.tsx:67-78; seed.ts:171-180) |
| EDT-201 | adapted | Cancel, or open the editor (GraphHandoff.tsx:89-96) |
| EDT-202 | adapted | No ghost cards: nothing is placed before the reader chooses (DECISIONS:20) |
| EDT-203 | adapted | Added cards go below the existing ones, right-aligned, nothing moved (seed.ts:182-207; e2e graph-handoff.spec.ts:83-104) |
| EDT-204 | adapted | Each card comes with its chain root → lemma → word → verse (seed.ts:86-97; build.ts:77-109) |
| EDT-205 | adapted | As EDT-204 |
| EDT-206 | adapted | Cancel in the dialog (GraphHandoff.tsx:92) |

### §1.21 Undo / redo and labelled commits

| ID | status | evidence / notes |
|---|---|---|
| EDT-207 | adapted | One `commit(label, nodes, edges)` (GraphCanvas.tsx:103-111), 81 snapshots, redo cleared, saved through `onChange`; deleting and linking are off when not editable (260, 271, 280), folding and expanding allowed in read-only as EDT-283 says; no refusal toast (EDT-244) |
| EDT-208 | done | A drag is recorded after the fact with the state before it (GraphCanvas.tsx:285, 389-397) |
| EDT-209 | done | Undo and redo restore cards and wires and carry the label across (GraphCanvas.tsx:141-157), by keys and buttons (288-301, 348-355); the selection is not restored and there is no toast |
| EDT-210 | open | Title and view stay outside undo; folding does not (F9) |
| EDT-211 | adapted | Import makes a new map (GraphHome.tsx:28-43): nothing to undo |
| EDT-212 | adapted | No proposals (DECISIONS:20) |
| EDT-213 | open | No note seed (NTB-22, P8) |
| EDT-214 | open | Expansions are labelled with their button captions «+n صيغة أخرى» and «المواضع (n)» (GraphCanvas.tsx:201, 249) (F9, F10) |
| EDT-215 | open | No link action on verse cards (EDT-117) |
| EDT-216 | open | No "+ Description" |
| EDT-217 | open | Adding is labelled with bare nouns «جذر», «كلمة», «آية», «ملاحظة» (GraphEditor.tsx:141, 158, 181, 196) (F9) |
| EDT-218 | open | «جذر», without the root (GraphEditor.tsx:196) (F9) |
| EDT-219 | open | No fields |
| EDT-220 | open | No fields; editing a note is labelled «ملاحظة» (GraphCanvas.tsx:188-193) |
| EDT-221 | open | No fields |
| EDT-222 | open | No fields |
| EDT-223 | open | No headword editing |
| EDT-224 | open | Removing a wire is «حذف المحدد» (GraphCanvas.tsx:272) (F9) |
| EDT-225 | open | «حذف المحدد», with no count (GraphCanvas.tsx:261) (F9) |
| EDT-226 | open | No duplicate |
| EDT-227 | done | «ترتيب» (GraphCanvas.tsx:114, 117) |
| EDT-228 | open | No frames |
| EDT-229 | open | A move is labelled «↔» (GraphCanvas.tsx:394) (F9) |
| EDT-230 | open | A new link is labelled with the hint sentence «اسحب من نقطة طرف البطاقة إلى بطاقة أخرى لربطهما.» (GraphCanvas.tsx:280) (F9) |
| EDT-231 | open | No frames |
| EDT-232 | open | No frames |
| EDT-233 | open | No nudge |
| EDT-234 | adapted | «تراجع: {label}» / «إعادة: {label}» as the buttons' title (GraphCanvas.tsx:349, 352; ar.json `graph.undoLabel`); case does not apply in Arabic |

### §1.22 Toast copy

| ID | status | evidence / notes |
|---|---|---|
| EDT-235 | open | One message, «تعذّر قراءة الملف», for every failure (GraphHome.tsx:40-42); a file with the right arrays and wrong cards is accepted (F16) |
| EDT-236 | open | «استُوردت الخريطة» with no counts (GraphHome.tsx:38); nothing is checked, so nothing is reported skipped (F16) |
| EDT-237 | open | No message |
| EDT-238 | open | P8.5 |
| EDT-239 | open | P8.5 |
| EDT-240 | open | No toast |
| EDT-241 | adapted | No proposals (DECISIONS:20) |
| EDT-242 | open | Silent (EDT-045) |
| EDT-243 | open | No wire messages (EDT-127) |
| EDT-244 | open | Read-only views turn deleting and linking off silently (GraphCanvas.tsx:260, 271, 280); a published copy needs the message (P8.5) |
| EDT-245 | open | No toast |
| EDT-246 | open | No frames |
| EDT-247 | open | No find-on-canvas |
| EDT-248 | open | The Meaning tab's "no root linked" message comes with EDT-173; "not wired up in this prototype" has nothing to build |

### §1.23 Keyboard shortcuts

| ID | status | evidence / notes |
|---|---|---|
| EDT-249 | open | No help modal |
| EDT-250 | open | Not built |
| EDT-251 | open | Not built |
| EDT-252 | open | Not built |
| EDT-253 | open | Not built |
| EDT-254 | open | Not built |
| EDT-255 | done | Keys stand down in INPUT, TEXTAREA and contentEditable (GraphCanvas.tsx:289-290); SELECT is not in the list, and no select exists on the editor's pages today |
| EDT-256 | open | F and T only (GraphCanvas.tsx:296-297); no + − 1 ? |
| EDT-257 | open | Delete is off when not editable (GraphCanvas.tsx:400), but T re-lays out a shared map and cards still drag (F17) |

### §1.24 Autosave and save status

| ID | status | evidence / notes |
|---|---|---|
| EDT-258 | open | Unsaved → saving → saved after 800 ms of quiet, to IndexedDB (GraphEditor.tsx:33-44; persist.ts:26-43), never in read-only views; but a map reopened in the same tab within the hour starts from its first-loaded copy and autosave writes that back over newer work, and every opening rewrites the map (F1) |
| EDT-259 | open | A signed-in reader's maps reach the server as sync records, the replaced version kept 30 days (lib/sync/adapters.ts:259-266; sync.py:33); no per-graph server document for publish, comments and presence, no revision history, no conflict handling in the open editor |

### §1.25 Import / Export and document schema

| ID | status | evidence / notes |
|---|---|---|
| EDT-260 | open | Any JSON with `nodes` and `edges` arrays is stored as given (GraphHome.tsx:28-37): unknown kinds, wires to missing cards and any card text pass (F16, F3); positions are kept, not re-laid out |
| EDT-261 | open | The file input is never reset (GraphHome.tsx:79), so the same file cannot be picked twice |
| EDT-262 | open | `{version, title, nodes, edges}`, 2-space indent, `map-{id}.json` (GraphCanvas.tsx:321-324; GraphEditor.tsx:80); `kind` is left out, so a re-imported root map comes back free (F16) |
| EDT-263 | adapted | `GraphDoc {version: 1, id, title, kind, nodes, edges, createdAt, updatedAt, pendingLayout?}` (types.ts:32-43) |
| EDT-264 | adapted | `{id, type: "card", position, data: {kind, ar, sub, count, rootKey, lemmaId, form, verse, text, folded, more, focus, expanded, cursor}}` (types.ts:8-27); no fields; the verse's text is stored in the card (F3) |
| EDT-265 | open | No frames |
| EDT-266 | open | No fields |
| EDT-267 | adapted | `{id, source, target, data?: {label}}` (persist.ts:31) |
| EDT-268 | done | Only id, type, position and data are stored for cards, and id, source, target, data and label for wires (persist.ts:26-34): no selection, measured size or viewport |

### §1.26 Publish flow

| ID | status | evidence / notes |
|---|---|---|
| EDT-269 | open | P8.5; keep Arabic letters, percent-encoded (QAN-23) |
| EDT-270 | open | P8.5, on the server |
| EDT-271 | open | P8.5 |
| EDT-272 | open | P8.5 |
| EDT-273 | open | P8.5 |
| EDT-274 | open | P8.5: editable title, description and slug, a confirm, unpublish, versions, copy link |

### §1.27 Read-only / embed mode

| ID | status | evidence / notes |
|---|---|---|
| EDT-275 | open | P8.5 |
| EDT-276 | open | P8.5 |
| EDT-277 | open | P8.5 (`version: 1` today, types.ts:33) |
| EDT-278 | adapted | The generated root map `/graph/root/{root}` is the sample that always exists (graph/root/[root]/page.tsx:23-30; RootGraphView.tsx) — QAN-21 |
| EDT-279 | open | `/g/{anything}` answers 200 with the "being built" frame (g/[slug]/page.tsx:11-14; checked by GET); a bad share link says «الرابط لا يحتوي خريطة صالحة.» (SharedGraph.tsx:20) (F11) |
| EDT-280 | open | P8.5 |
| EDT-281 | done | A shared map keeps its positions and opens on its focus cards (SharedGraph.tsx:22-26; GraphCanvas.tsx:88-90, 403-404); the generated root map is laid out (RootGraphView.tsx:30) |
| EDT-282 | open | Read-only views hide the palette and the save status and turn deleting and linking off, but keep Tidy, Undo/Redo, the exports, visible ports and card dragging (F17) |
| EDT-283 | open | Pan, zoom, select, fold and expand work in read-only views; no tabs, help or keyboard navigation yet |
| EDT-284 | open | P8.5 |
| EDT-285 | open | P8.5, with an origin check (HWF-56) |
| EDT-286 | open | P8.5 |
| EDT-287 | open | P8.5: post on folding and on selection (D21, the union) |
| EDT-288 | bug-fixed | Read-only views write nothing: the root map keeps changes in memory (RootGraphView.tsx:15, 33), a shared map has no `onChange` (SharedGraph.tsx:22-38) |
| EDT-289 | open | No Settings tab yet; build it read-only for published copies |

### §1.28 Fork, note seed, and inbound entry points

| ID | status | evidence / notes |
|---|---|---|
| EDT-290 | open | P8.5 (`POST /published/:slug/fork`) |
| EDT-291 | open | P8.5: accept both edge shapes once legacy records exist |
| EDT-292 | open | No note seed (NTB-22); decode once (HWF-52) |
| EDT-293 | adapted | Old `?w=` links (and `?verse=`, `?root=`, `?trail=`) become seeds that build the word's family around it (graph/page.tsx:20-22; seedCodec.ts:71-80; e2e graph-handoff.spec.ts:119-121) |
| EDT-294 | n/a | Seeds carry no `from`; there is nothing to ignore |
| EDT-295 | open | Built: the word panel, the hover card, Word family, In the Quran, the verse's Graph drawer and the trail map through the hand-off dialog (reader5/WordEntry.tsx:190-192; HoverCard.tsx:124; sections/Family.tsx:43-48; sections/InQuran.tsx:129-133; VerseDrawer.tsx:130-163; GraphHandoff.tsx:18-22), Explore's set (ExploreScreen.tsx:291, 335 — F12), the Analyser (AnalyseScreen.tsx:77-88, 190-194), the hub and the nav (destinations.ts:20; NavLinks.tsx:17). Missing: the Notebook, the split view and the published page; the Classroom's comes with P9 |

### §1.29 Presence (Live)

| ID | status | evidence / notes |
|---|---|---|
| EDT-296 | open | P8.6: real presence, no invented people |
| EDT-297 | open | P8.6 |
| EDT-298 | done | Decided: presence only, then soft locks, no CRDT (PLAN §4 D5, approved with the plan, DECISIONS:10) |

### §1.30 Dark mode and theming

| ID | status | evidence / notes |
|---|---|---|
| EDT-299 | adapted | `data-theme` on `<html>`, set before paint (`[locale]/layout.tsx:41, 53`) |
| EDT-300 | adapted | One key, `jadhr-theme` (lib/site.ts:11), for every screen |
| EDT-301 | done | The shared toggle (shell/ThemeToggle.tsx:8); e2e regressions.spec.ts:67-80 carries the reader's choice to `/graph` |
| EDT-302 | open | P8.5 (embed parameter and message) |
| EDT-303 | done | One key, light by default (`[locale]/layout.tsx:41`); the embed is EDT-302 |

### §1.31 Phone and narrow-width behaviour

| ID | status | evidence / notes |
|---|---|---|
| EDT-304 | open | On phones the palette stacks above the canvas at up to 42 dvh and the toolbar wraps (GraphEditor.tsx:61, 163; GraphCanvas.tsx:331) — never designed; P8.6a |
| EDT-305 | adapted | xyflow takes touch: pan, pinch, card drag, port-to-port links (DECISIONS:79); not tried on a device in this audit |
| EDT-306 | open | No editor breakpoints; card controls are 24–26 px (CardNode.tsx:58, 132, 139, 144, 150) against 40 and 44 px on phones (F14); P8.6a |

### §1.32 Accessibility

| ID | status | evidence / notes |
|---|---|---|
| EDT-307 | open | Present: a live save status (GraphEditor.tsx:82), the fold button's name and `aria-expanded` (CardNode.tsx:59-60), named title and palette fields (GraphCanvas.tsx:336; GraphEditor.tsx:163, 170), `lang="ar"` on Arabic (CardNode.tsx:85, 96, 112), the chevron hidden from readers. Wrong: zoom buttons named "−" and "+", xyflow's English instructions on every card and wire, "Mini Map" (F14) |
| EDT-308 | open | Cards take focus (xyflow `tabIndex = 0`, role `group`, index.mjs:2366) but have no name and English instructions; wires likewise; no keyboard way to link two cards; no axe test of any graph page (a11y.spec.ts:5, 21) (F14) |

### §1.33 Persistence keys

| ID | status | evidence / notes |
|---|---|---|
| EDT-309 | open | No panel preferences yet |
| EDT-310 | done | lib/site.ts:11 |
| EDT-311 | open | Comments per graph on the server (EDT-347) |
| EDT-312 | open | P8.5 |
| EDT-313 | open | P8.6: state shared by the split panes |
| EDT-314 | done | The map is written to IndexedDB on every change (persist.ts:26-49) and synced when signed in; undo stays per session, as designed |

### §1.34 Split Shell

| ID | status | evidence / notes |
|---|---|---|
| EDT-315 | open | `/split` is the "being built" frame (split/page.tsx:11-14); P8.6 |
| EDT-316 | open | P8.6 |
| EDT-317 | open | P8.6 |
| EDT-318 | open | P8.6 |
| EDT-319 | open | P8.6: send the word's real form, part of speech and root from the corpus, into the open map, without a reload |
| EDT-320 | open | P8.6: our reader, not a missing file |
| EDT-321 | open | P8.6 |
| EDT-322 | open | P8.6, with dark and phone |
| EDT-323 | open | P8.6 |

### §1.35 Published Graph page

| ID | status | evidence / notes |
|---|---|---|
| EDT-324 | open | `/g/[slug]` is the "being built" frame (g/[slug]/page.tsx:11-14); P8.5 |
| EDT-325 | open | P8.5 |
| EDT-326 | open | P8.5, the address following the chosen graph |
| EDT-327 | open | P8.5 |
| EDT-328 | open | P8.5 |
| EDT-329 | open | P8.5: the real editor, read-only |
| EDT-330 | open | P8.5 |
| EDT-331 | open | P8.5 |
| EDT-332 | open | P8.5: cite, counted, as BibTeX, RIS and plain text; the licence words follow EDT-335 |
| EDT-333 | open | P8.5, with the site's own origin |
| EDT-334 | open | P8.5 |
| EDT-335 | waiting | Owner: which licence a published map carries. The design prints CC BY-SA 4.0, but a map holds KFGQPC text, display-only lexicon text (D22) and CC BY-NC-SA relation seeds (D18, DECISIONS:103); the counts themselves are P8.5 |
| EDT-336 | open | P8.5 |
| EDT-337 | n/a | An invented sample with invented forks and citations; the generated root map is our sample (EDT-278), real counts are EDT-272 |
| EDT-338 | open | P8.5 |
| EDT-339 | open | P8.5 (D21) |
| EDT-340 | open | P8.5 (D21) |
| EDT-341 | open | P8.5: post `jadhr-fit`, dark chrome, a phone layout |

### §1.36 API and data model mapping

| ID | status | evidence / notes |
|---|---|---|
| EDT-342 | open | No graph endpoints or table; maps live in the browser and, for a signed-in reader, in `accounts.records` as sealed sync records (sync.py:33; 0019_accounts.py; 0021_sealed_keys.py) |
| EDT-343 | open | P8.5 |
| EDT-344 | open | P8.5 |
| EDT-345 | open | P8.5 |
| EDT-346 | open | P8.5 |
| EDT-347 | open | P8.1 |
| EDT-348 | open | The data is served — roots with counts and Ibn Fāris's core idea (`/roots/{root}`, `/roots/{root}/family`), patterns (`/patterns/{slug}`), lemmas with part of speech and gloss, forms and verses (`/roots/{root}/graph`, `/roots/{root}/occurrences`, `/verses/{key}`), the nine dictionaries per root — but the editor uses the root graph and the occurrences only (build.ts; GraphCanvas.tsx:204-250) |

### §2 Quran adaptation notes (QAN)

| ID | status | evidence / notes |
|---|---|---|
| QAN-01 | open | Root, verse and note match; our «صيغة» card is the lemma, not the pattern (F13); no pattern card, no frame |
| QAN-02 | open | Built: the reference through `citeVerse`, the sūra's name, the verse in the KFGQPC font with the word marked (CardNode.tsx:84-89, 120-122), «افتح في المصحف» (148-155). Missing: translation, recitation, stats; the text shown is the stored copy (F3); occurrence cards show five words each side with no mark of the cut (GraphCanvas.tsx:226-228) |
| QAN-03 | open | Line height 2.1 for verses and 2 for the excerpt (CardNode.tsx:85, 112), measured sizes in the layout (layout.ts:25-26); folded verse cards keep the whole text, every card shares a 340 px maximum (CardNode.tsx:41) |
| QAN-04 | open | Root → lemmas → surface forms with their first verse, counts from the corpus (build.ts:54-111; content.py:658-712); no pattern level, though `/roots/{root}/family` already groups the lemmas by pattern (lexicon.py:132-165) |
| QAN-05 | open | `root:`, `lemma:`, `word:{lemma}:{form}`, `verse:` (build.ts:21-25), spelled differently by the palette and the seeds (F5); no pattern ids |
| QAN-06 | open | Verses page eight at a time with what remains (GraphCanvas.tsx:204-250; CardNode.tsx:131-142); no sūra or form filter, no "10 of 105" label |
| QAN-07 | open | Only when a verse seed is built (seed.ts:76-99), not as an action on a verse card (EDT-117) |
| QAN-08 | open | Particles are skipped when a verse is linked (seed.ts:79) and never get a pseudo-root (seed.ts:56-60); no choice to include them as "no root" cards |
| QAN-09 | open | «خريطة موضوع» opens an empty canvas (GraphHome.tsx:22-26, 51-59): no topic data, headings or frames (P8.3) |
| QAN-10 | open | A free-text label on a wire (GraphCanvas.tsx:363-380) and a hint that a field is not synonymy (ar.json `graph.meaningHint`); no typed relations; the classical seeds in the database are not offered (P8.4) |
| QAN-11 | open | `kind: root · topic · meaning · free` is stored (types.ts:30-36) and changes only a hint (GraphEditor.tsx:183) |
| QAN-12 | open | Every built string is Arabic first (ar.json and en.json `graph`, 76 keys each); xyflow's English strings remain (F14); the unbuilt items need their copy |
| QAN-13 | done | The map reads right to left in both languages: layout direction LEFT (layout.ts:7-16), ports in the reading direction (CardNode.tsx:48, 160), cards `dir="rtl"` aligned to the start (CardNode.tsx:41, 46), the palette on the start side (GraphEditor.tsx:163) |
| QAN-14 | open | Digits follow the locale (CardNode.tsx:55, 134-140), but «{n} بطاقة», «+{n} صيغة أخرى», «+{n} موضعًا آخر», «({n} خطوات)» and "{n} cards" are not plural forms (F10) |
| QAN-15 | open | Adding searches `/search` (GraphEditor.tsx:104-108), which folds per the normalisation spec and reads verse references; nothing searches the cards on a map |
| QAN-16 | done | Counts on roots, lemmas and words are the corpus's (build.ts:50, 75, 96; CardNode.tsx:55), and no typed attestation sits beside them; "n times in the Quran" in Meaning comes with EDT-175 |
| QAN-17 | open | No Meaning tab; the data is served — the core idea (`gist_ar`), a lemma's meanings (the word payload), a verse's knowledge (`/verses/{key}/knowledge`, main.py:198-208) |
| QAN-18 | open | No dictionaries in the editor; the real articles are served per root (EDT-178) |
| QAN-19 | open | Seeds name slugs, places and verse keys (seedCodec.ts:10-14) and use the corpus's analysis; the Analyser's readings of the reader's own text lose their confidence (F4) |
| QAN-20 | open | No map view |
| QAN-21 | open | The root map is generated on demand on the same canvas and becomes the reader's copy on request (graph/root/[root]/page.tsx:23-30; RootGraphView.tsx:19-23); the root page links to it (roots/[root]/page.tsx:94-97) instead of showing it (P8.2) |
| QAN-22 | open | Root cards show the transliteration in both languages (CardNode.tsx:104-107); no preference |
| QAN-23 | open | P8.5 |
| QAN-24 | open | 120 and 36 px instead of 156 and 56 (layout.ts:17-18), no 8 px grid; folded verse cards are not one line |
| QAN-25 | open | Served: roots with letters, counts and core idea; patterns; lemmas with part of speech, gloss and meanings; tokens; two translations; counts; dictionary articles per root. Missing: the English root gloss (P3.4, RDR-474); the editor's payloads carry little of it (EDT-348) |

### §3 Hard-won fixes (HWF-01…42)

| ID | status | evidence / notes |
|---|---|---|
| HWF-01 | done | Layout with measured sizes after `useNodesInitialized` (GraphCanvas.tsx:83, 124-139; layout.ts:25-26); Tidy reads the measured cards (115) |
| HWF-02 | open | No map view |
| HWF-03 | open | No map view |
| HWF-04 | open | A fixed 1.5 px (GraphCanvas.tsx:407) |
| HWF-05 | done | xyflow's separate 20 px hit path (index.mjs:2587); clicking a wire never starts a selection box |
| HWF-06 | done | `nodrag` (CardNode.tsx:58, 74, 132, 139, 144, 150) |
| HWF-07 | adapted | xyflow resets held keys on window blur (index.mjs:473) |
| HWF-08 | done | GraphCanvas.tsx:289-290; xyflow ignores its own keys inside fields |
| HWF-09 | done | One `commit` (GraphCanvas.tsx:103-111), 81 snapshots, redo cleared, the label in the buttons' title (349-353); the labels themselves are F9 |
| HWF-10 | done | xyflow starts a drag only once the card moves, so a click records nothing (GraphCanvas.tsx:389-397) |
| HWF-11 | open | No single guard: `editable` checks in three handlers (GraphCanvas.tsx:260, 271, 280) and `deleteKeyCode` (400); ports shown and cards draggable in read-only views (F17) |
| HWF-12 | open | No snap (`snapToGrid` unset) |
| HWF-13 | adapted | Ports fixed in the reading direction with a right-to-left layout (CardNode.tsx:48, 160; layout.ts:16) |
| HWF-14 | adapted | xyflow's bezier (GraphCanvas.tsx:407) |
| HWF-15 | open | No cycle check; a duplicate is dropped silently (GraphCanvas.tsx:279-282) |
| HWF-16 | open | Nothing is refused yet (P8.1a) |
| HWF-17 | open | Expansions and hand-offs skip cards already present (GraphCanvas.tsx:198-216; seed.ts:193-197), but ids differ by entry point (F5) |
| HWF-18 | done | An expansion adds the cards, re-lays out and fits (GraphCanvas.tsx:113-121, 201, 249) |
| HWF-19 | adapted | The verse seed builds root → lemma → word → verse for each word with a root (seed.ts:86-97), at creation rather than as an action (EDT-117) |
| HWF-20 | adapted | No proposals: every card arrives with its chain (seed.ts:86-97; DECISIONS:20) |
| HWF-21 | adapted | No proposals (DECISIONS:20) |
| HWF-22 | open | Uncertain readings are not marked (F4) |
| HWF-23 | done | base64url of UTF-8 through TextEncoder and TextDecoder (seedCodec.ts:22-30, 62-69); e2e graph-handoff.spec.ts:34, 43-68 with Arabic |
| HWF-24 | open | P8.5 |
| HWF-25 | done | As EDT-281 |
| HWF-26 | open | No toasts |
| HWF-27 | open | F16 |
| HWF-28 | open | GraphHome.tsx:79 |
| HWF-29 | open | No frames |
| HWF-30 | open | No frames |
| HWF-31 | open | No frames |
| HWF-32 | open | P8.5 |
| HWF-33 | adapted | One `data-theme` on `<html>` before paint (`[locale]/layout.tsx:41, 53`) |
| HWF-34 | open | No preferences yet |
| HWF-35 | adapted | Pointer-anchored wheel and pinch (xyflow), centre-anchored buttons (GraphCanvas.tsx:413-418), 0.15–2 |
| HWF-36 | open | Fit has no ≤ 100% clamp (GraphCanvas.tsx:296, 346) |
| HWF-37 | open | No context menu |
| HWF-38 | open | No Details panel |
| HWF-39 | adapted | Added cards never cover existing ones (seed.ts:198-205) |
| HWF-40 | open | GraphEditor.tsx:39, 70-73 (EDT-013) |
| HWF-41 | open | P8.6 |
| HWF-42 | open | P8.5 |

### §3 Defects not to copy (HWF-43…58)

| ID | status | evidence / notes |
|---|---|---|
| HWF-43 | bug-fixed | Card links go to routes that exist: `/word/{location}` and `/roots/{key}` (CardNode.tsx:143-155) |
| HWF-44 | bug-fixed | As EDT-031 and EDT-288 |
| HWF-45 | bug-fixed | The first layout is not an undo step (GraphCanvas.tsx:124-139); an imported map keeps its positions (GraphHome.tsx:32-37) |
| HWF-46 | open | No duplicate yet (copies keep their data keys); the same symptom — a card that cannot extract — is today's dead lemma expansion in the editor (F6) |
| HWF-47 | n/a | No proposals (DECISIONS:20) |
| HWF-48 | open | Comments per graph (EDT-347) |
| HWF-49 | open | F10 |
| HWF-50 | open | Count from the payload's `letters` (build.ts:5) when the Meaning tab is built |
| HWF-51 | open | Stats not built |
| HWF-52 | open | Note seed not built |
| HWF-53 | open | Fork not built |
| HWF-54 | open | No "1" key |
| HWF-55 | n/a | No invented sample (EDT-337) |
| HWF-56 | open | P8.5 |
| HWF-57 | open | Check once fields and double-click folding exist |
| HWF-58 | bug-fixed | One source: every card is built from the API (build.ts; seed.ts; GraphEditor.tsx:104-160) |

## 6. How the counts were checked

The script below reads the inventory and this file. It takes the in-scope IDs from the bullets of the inventory's Part 2 and the heading each one sits under, and checks that PLAN §7's figures hold (EDT 348, QAN 25, HWF 58). It fails unless every in-scope ID has exactly one row in §5 and no row is outside the scope, every status is one of the six, the counts it computes per prefix and per inventory subsection equal both tables of §1 (items and every status column, totals included) and the status table at the top of §1, every defect §5 cites is described in §2 and §2 numbers them without a gap, every `open` item closes in exactly one sub-step of §3 and each sub-step's stated count matches the IDs it lists, and §4 lists exactly the `waiting` rows, each naming the owner or a phase. It prints `P8-BASELINE-COUNTS-VERIFIED` only when every check passes; failures print `MISMATCH` lines and exit 1.

```python
import re, sys
from collections import Counter

STAT = ["done", "adapted", "bug-fixed", "n/a", "open", "waiting"]
ID = r"(?:EDT|QAN|HWF)-\d+"

inv_path, rep_path = sys.argv[1], sys.argv[2]
inv = open(inv_path, encoding="utf-8").read().splitlines()
rep = open(rep_path, encoding="utf-8").read()
bad = []

# the scope: every bullet of inventory Part 2, with the heading it sits under
start = next(i for i, l in enumerate(inv) if l.startswith("## Part 2"))
end = next(i for i, l in enumerate(inv) if l.startswith("## Part 3"))
heading, section, scope = None, {}, []
for l in inv[start:end]:
    if m := re.match(r"^#{3,4} (.+)$", l):
        heading = m.group(1).strip()
    if m := re.match(rf"^- \*\*({ID})\*\*", l):
        scope.append(m.group(1))
        section[m.group(1)] = heading
per_prefix = Counter(i.split("-")[0] for i in scope)
print(f"inventory Part 2: {len(scope)} items {dict(per_prefix)}")
if len(set(scope)) != len(scope):
    bad.append("MISMATCH duplicate IDs in the inventory")
if dict(per_prefix) != {"EDT": 348, "QAN": 25, "HWF": 58}:
    bad.append(f"MISMATCH inventory counts {dict(per_prefix)} differ from PLAN §7 (EDT 348, QAN 25, HWF 58)")

parts = re.split(r"^## ", rep, flags=re.M)
sec = {p.split(".")[0]: p for p in parts if re.match(r"\d\.", p)}

# §5: exactly one row per item, known statuses
rows = re.findall(rf"^\| ({ID}) \| ([a-z/-]+) \|", sec["5"], flags=re.M)
ids = [r[0] for r in rows]
for i, n in Counter(ids).items():
    if n > 1:
        bad.append(f"MISMATCH {i} has {n} rows")
for i in sorted(set(scope) - set(ids)):
    bad.append(f"MISMATCH {i} has no row")
for i in sorted(set(ids) - set(scope)):
    bad.append(f"MISMATCH {i} is not in scope")
for i, s in rows:
    if s not in STAT:
        bad.append(f"MISMATCH {i} has unknown status {s}")
print(f"report: {len(ids)} rows in §5")

def tally(key):
    t = {}
    for i, s in rows:
        t.setdefault(key(i), Counter())[s] += 1
    return t

def check_table(t):
    for label, c in t.items():
        line = re.search(rf"^\| {re.escape(label)} \|(.*)$", sec["1"], flags=re.M)
        if not line:
            bad.append(f"MISMATCH no §1 row for {label}")
            continue
        cells = [x.strip().strip("*") for x in line.group(1).split("|")][:7]
        want = [str(sum(c.values()))] + [str(c[s]) for s in STAT]
        if cells != want:
            bad.append(f"MISMATCH §1 {label}: table {cells} computed {want}")

by_prefix = tally(lambda i: i.split("-")[0])
total = sum(by_prefix.values(), Counter())
by_prefix["Total"] = total
check_table(by_prefix)
check_table(tally(lambda i: section[i]))
for s in STAT:
    m = re.search(rf"^\| {re.escape(s)} \| (\d+) \|", sec["1"], flags=re.M)
    if not m or int(m.group(1)) != total[s]:
        bad.append(f"MISMATCH status table {s}: {m and m.group(1)} computed {total[s]}")
m = re.search(r"^\| \*\*total\*\* \| \*\*(\d+)\*\* \|", sec["1"], flags=re.M)
if not m or int(m.group(1)) != len(ids):
    bad.append("MISMATCH status table total")

# §2: every defect cited in §5 is described, numbered without gaps
defined = [int(x) for x in re.findall(r"^\*\*F(\d+) ·", sec["2"], flags=re.M)]
if defined != list(range(1, len(defined) + 1)):
    bad.append(f"MISMATCH defects in §2 are numbered {defined}")
for f in sorted({int(x) for x in re.findall(r"\bF(\d+)\b", sec["5"])}):
    if f not in defined:
        bad.append(f"MISMATCH §5 cites F{f}, which §2 does not describe")

# §3: every open item closes in exactly one sub-step, and each sub-step's count is right
opened = {i for i, s in rows if s == "open"}
listed = []
for n, body in re.findall(r"^- \*\*Closes \((\d+)\):\*\* (.*)$", sec["3"], flags=re.M):
    got = re.findall(ID, body)
    if int(n) != len(got):
        bad.append(f"MISMATCH a sub-step says {n} items and lists {len(got)}")
    listed += got
for i, n in Counter(listed).items():
    if n > 1:
        bad.append(f"MISMATCH {i} closes in {n} sub-steps")
if set(listed) != opened:
    bad.append(f"MISMATCH §3 lists {sorted(set(listed) - opened)} not open; misses {sorted(opened - set(listed))}")

# §4: exactly the waiting rows, each naming the owner or a phase
waiting = re.findall(rf"^\| ({ID}) \|(.*)$", sec["4"], flags=re.M)
if {i for i, _ in waiting} != {i for i, s in rows if s == "waiting"} or len(waiting) != total["waiting"]:
    bad.append(f"MISMATCH §4 lists {sorted(i for i, _ in waiting)}")
for i, rest in waiting:
    if not re.search(r"Owner|P\d+", rest):
        bad.append(f"MISMATCH waiting {i} names neither the owner nor a phase")

if bad:
    print("\n".join(bad))
    sys.exit(1)
print(f"counts {dict(total)}; closed {total['done'] + total['adapted'] + total['bug-fixed'] + total['n/a']} of {len(ids)}")
print(f"§3: {len(listed)} open items in {len(re.findall(r'^- \*\*Closes', sec['3'], flags=re.M))} sub-steps; §2: {len(defined)} defects")
print("P8-BASELINE-COUNTS-VERIFIED")
```

Run on this file (`python3 check_p8.py docs/research/05-design-inventory.md docs/research/13-graph-editor-baseline.md`, the script kept outside the repository), exit 0:

```
inventory Part 2: 431 items {'EDT': 348, 'QAN': 25, 'HWF': 58}
report: 431 rows in §5
counts {'open': 315, 'done': 33, 'adapted': 72, 'bug-fixed': 6, 'n/a': 4, 'waiting': 1}; closed 115 of 431
§3: 315 open items in 14 sub-steps; §2: 18 defects
P8-BASELINE-COUNTS-VERIFIED
exit=0
```

Run on a copy with one status changed (EDT-016 `done` → `open`, one exact edit asserted to match once), exit 1:

```
inventory Part 2: 431 items {'EDT': 348, 'QAN': 25, 'HWF': 58}
report: 431 rows in §5
MISMATCH §1 EDT: table ['348', '22', '63', '2', '2', '258', '1'] computed ['348', '21', '63', '2', '2', '259', '1']
MISMATCH §1 Total: table ['431', '33', '72', '6', '4', '315', '1'] computed ['431', '32', '72', '6', '4', '316', '1']
MISMATCH §1 1.2 Header — edit mode (left → right): table ['14', '3', '3', '0', '0', '8', '0'] computed ['14', '2', '3', '0', '0', '9', '0']
MISMATCH status table done: 33 computed 32
MISMATCH status table open: 315 computed 316
MISMATCH §3 lists [] not open; misses ['EDT-016']
exit=1
```

Run on a copy with the HWF-58 row removed, exit 1:

```
inventory Part 2: 431 items {'EDT': 348, 'QAN': 25, 'HWF': 58}
report: 430 rows in §5
MISMATCH HWF-58 has no row
MISMATCH §1 HWF: table ['58', '9', '9', '4', '2', '34', '0'] computed ['57', '9', '9', '3', '2', '34', '0']
MISMATCH §1 Total: table ['431', '33', '72', '6', '4', '315', '1'] computed ['430', '33', '72', '5', '4', '315', '1']
MISMATCH §1 Defects not to copy (summary of [BUG] items): table ['16', '0', '0', '4', '2', '10', '0'] computed ['15', '0', '0', '3', '2', '10', '0']
MISMATCH status table bug-fixed: 6 computed 5
MISMATCH status table total
exit=1
```

Both copies were deleted after the runs.

## 7. After P8.0 (2026-10-03)

The table in §5 is the baseline at `7caa827` and is left as it was. P8.0 closed its 23 items, each now `done`: EDT-015, EDT-099, EDT-137, EDT-197, EDT-210, EDT-214, EDT-218, EDT-224, EDT-225, EDT-229, EDT-230, EDT-235, EDT-236, EDT-258, EDT-260, EDT-261, EDT-262, HWF-22, HWF-27, HWF-28, HWF-49, QAN-14, QAN-19. The faults it took are fixed: F1, F2, F3 (QAN-02's remainder stays with P8.2), F4, F6 (EDT-112 itself stays with P8.2), F7, F8, F9, F10, F11 (the slug's 404 stays with P8.5), F12, F16, F18. Still open from §2: F5 and F13 (P8.1a), F14 and F15 (P8.1-B, phones in P8.6a), F17 (P8.5). Counts after P8.0: 431 items — 56 done, 72 adapted, 6 bug-fixed, 4 n/a, 292 open, 1 waiting. Commits `01dd40d`…`e53a833`; evidence in PLAN P8.0.

## 8. After P8.1a (2026-10-03)

P8.1a closed its 13 items, each now `done`: EDT-072, EDT-073, EDT-078, EDT-127, EDT-128, EDT-135, EDT-243, HWF-15, HWF-16, HWF-17, QAN-01, QAN-05, QAN-11; F5 and F13 are fixed. Counts after P8.1a: 431 items — 69 done, 72 adapted, 6 bug-fixed, 4 n/a, 279 open, 1 waiting. Commits `e440ed0`, `ab40734`; evidence in PLAN P8.1a.

## 9. After P8.1-A (2026-10-03)

P8.1-A closed 36 of its 43 items: EDT-001, 002, 009, 011, 013, 020, 022, 024, 032–045, 047, 063 (the unknown slug's 404 is P8.5's), 071, 237, 242, 247, 249, 309, HWF-26, 34, 40, QAN-12, 15, 22. Part-built, the rest named where it lands: EDT-004 (map-view zoom, P8.1-B), EDT-070 (right-click "New…", P8.1-B; "+ Description", P8.1-C), EDT-250, 251, 252, 253, 254 (the help lists the keys that work; the rest join as P8.1-B and P8.1-C build them). Counts after P8.1-A: 431 items — 105 done, 72 adapted, 6 bug-fixed, 4 n/a, 243 open (7 of them part-built), 1 waiting. Commits `1b48009`, `44d9c51`.

## 10. After P8.1-B (2026-10-03)

P8.1-B closed its 34 items: EDT-051, 056, 058, 059, 060, 061, 062, 064, 065, 066, 067, 068 (the frame's menu items wait for frames, P8.1-C; the menu itself is built), 069, 131, 132, 134, 158, 159, 160, 161, 162, 163, 233, 256, 307, 308, HWF-02, 03, 04, 12, 36, 37, 54, QAN-20; F14 (desktop) and F15 are fixed. It also finished four of P8.1-A's part-built items: EDT-004, 252, 253, 254. Still part-built: EDT-070 ("+ Description" on the card and in the sidebar), EDT-250 and 251 (duplicate and groups), all with P8.1-C. Counts after P8.1-B: 431 items — 143 done, 72 adapted, 6 bug-fixed, 4 n/a, 205 open (3 of them part-built), 1 waiting.

## 11. After P8.1-C (2026-10-03)

P8.1-C closed its 58 items and the three P8.1-A left part-built (EDT-070, 250, 251). Done (43): EDT-070, 083, 092, 093, 094, 096, 098, 102–109, 119, 140–144, 146, 147, 148, 154, 216, 217, 219–222, 226, 228, 231, 232, 245, 246, 250, 251, 265, 266, HWF-29, 30. Adapted (13), each with its reason in DECISIONS: EDT-080 (no field seeded with the dataset's values), 081 (no blank cards of the dataset's kinds), 082 (fold defaults by where a card comes from), 088 and 089 (no English gloss line, L2), 101 (the count still to extract comes with P8.1-D's Extract tab), 122 (an attached note holds its text, not a «Body» field), 145 (xyflow's resizer, no tooltip on its handles), 149 (a group's name kept as one undo step), 186 and 188 (duplicate copies notes and groups, never a card of the dataset), 213 and 292 (a Notebook note travels by its id, not its text). Bug-fixed (4): EDT-189 (a group deleted alone is named a group), HWF-46, HWF-52, HWF-57. Not applicable (1): EDT-120 (no hand-made cards of the dataset's kinds). Carried and closed beside them: NTB-22 (a Notebook note, or a verse's, as a description card) and RDR-239 (a dictionary's article quoted on a note by its id, with its credit, never stored — D22). Counts after P8.1-C: 431 items — 186 done, 85 adapted, 10 bug-fixed, 5 n/a, 144 open, 1 waiting.

## 12. After P8.1-D (2026-10-03)

P8.1-D closed its 31 items. Done (19): EDT-164, 165, 166, 167, 170, 172, 173, 176, 177, 178, 179, 182, 184, 185, 187, 223, HWF-31, HWF-38, QAN-17. Adapted (11), each with its reason in DECISIONS: EDT-138 (a picked wire opens its link panel rather than "Nothing selected"), 168 and 169 (Meaning and Settings; Comments come with P8.1-E, and there are no proposals), 171 (no gloss line but the corpus's, credited), 174 (Ibn Fāris's core idea in place of an editorial summary, L2), 175 (the corpus count in place of a typed one, QAN-16), 180 and 181 (real entries; "+" quotes an entry by id in a note, D22; no machine transliteration; dropping a scan or corpus file waits on P11, D9a), 183 (a card of the dataset's headword is shown, not edited), 248 (a particle says it has no root; nothing is left unwired), QAN-18 (death-date order kept, entries quoted by id). Bug-fixed (1): HWF-50 (a root's letters are counted as letters). Counts after P8.1-D: 431 items — 205 done, 96 adapted, 11 bug-fixed, 5 n/a, 113 open, 1 waiting.

## 13. After P8.2 (2026-10-03)

P8.2 closed its 26 items. Done (21): EDT-090, 091, 110, 112, 114, 115, 116, 118, 121, 123, 215, 240, 348, QAN-03, 04, 06, 07, 08, 21, 24, 25. Adapted (4), each with its reason in DECISIONS: EDT-086 (the counts in the stats strip rather than a line of their own), 111 (after an extraction the view shows the card and what it brought, not the whole map), 117 (a verse's words and roots: the root linked to its word, not through its pattern), QAN-02 (the verse card has its recitation; its translation and plain explanation are in the details). Bug-fixed (1): HWF-51 (a root's patterns are counted, not every link from it). Counts after P8.2: 431 items — 226 done, 100 adapted, 12 bug-fixed, 5 n/a, 87 open, 1 waiting.

## 14. After P8.1-E (2026-10-04)

P8.1-E closed its 10 items. Done (5): EDT-190, 191, 192, 311, 347. Adapted (3), each with its reason in DECISIONS: EDT-194 (threads, resolve, mentions and the card's marker built; notifications are in the product — My maps counts new comments and mentions — not e-mail), 259 (a private map persists in the browser and syncs sealed; a shared map is saved whole to the server at each save, ~800 ms after the last change, with its history; a private map's history is the browser's), 342 (the graphs table and its endpoints hold shared maps only, by the decision of 2026-10-03). Bug-fixed (2): EDT-193 and HWF-48 (comments per map, on the server, not one global list). Counts after P8.1-E: 431 items — 231 done, 103 adapted, 14 bug-fixed, 5 n/a, 77 open, 1 waiting.

## 15. After P8.4 (2026-10-04)

P8.4 closed its one item, QAN-10, adapted with its reasons in DECISIONS: the meaning map draws the classical books' own relations between roots once the editorial board has reviewed them (al-ʿAskarī's furūq, the wujūh books' senses named by another word), each link carrying its book and the relation's id; the extracted relations are listed as such and can be put on the map only as the reader's own dashed links; related roots come in one column beside the root, and a pair's shared verses beside them on request; semantic fields from al-Thaʿālibī's Fiqh al-Lugha and Ibn Sīda's al-Mukhaṣṣaṣ, a field one card its members join (research 15 §8). Counts after P8.4: 431 items — 231 done, 104 adapted, 14 bug-fixed, 5 n/a, 76 open, 1 waiting.

## 16. After P8.3 (2026-10-04)

P8.3 closed its one item, QAN-09, adapted with its reasons in DECISIONS: a topic map starts blank or from a topic — a verse's topic in the reader, a topic found by name in the library, a verse's topics in its Meaning — with topics as heading cards named as the taxonomy in force names them, whose they are said on the card (Quranpedia's with its data's version, or the editorial board's) and read-only, verses gathered under them ten at a time in the mushaf's order and sub-topics under them; frames stay the reader's way to group sub-topics. P8.3b built the rest of this report's §3 entry for the step: the taxonomy in the workbench (La Beaume's chapters adopted under the board's Arabic names, Quranpedia's topics renamed or placed, the board's own topics), QSAC's tags on the verses Quranpedia leaves without a topic as a workbench layer the board places or rejects, each link's provenance on screen, the P3.9 registry's proper names as headings, the reader's own topics beside the sources', and coverage per sūra in `docs/DATA-VALIDATION.md`. Counts after P8.3: 431 items — 231 done, 105 adapted, 14 bug-fixed, 5 n/a, 75 open, 1 waiting.

## 17. After P8.6 (2026-10-04)

P8.6 closed its 15 items. Done (9): EDT-014, 296, 297, 316, 317, 318, 322, 323, HWF-41. Adapted (4), reasons in DECISIONS: EDT-313 (the reader's reading context in its own store, read by storage events, not a polled key), EDT-315 (the header in both themes, not light-only), EDT-321 (events, not an 800 ms poll), EDT-295 (the split view's caller added; the published page's and the classroom's come with P8.5 and P9). Bug-fixed (2): EDT-319 (the word's real pattern, part of speech, root and place, no reload), EDT-320 (the panes are the real reader and editor; the design's reader file was missing). The panes are frames of this site rather than components (DECISIONS). Counts after P8.6: 431 items — 240 done, 109 adapted, 16 bug-fixed, 5 n/a, 60 open (P8.5's 58, P8.6a's 2), 1 waiting.

## 18. After P8.5 and P8.7 (2026-10-04)

P8.5 closed its 58 items (commits ac6229e API, f7c851b web, 9a92914 F17; DECISIONS 2026-10-04). Done (41): EDT-021, EDT-025, EDT-026, EDT-027, EDT-030, EDT-238, EDT-244, EDT-257, EDT-271, EDT-272, EDT-273, EDT-274, EDT-276, EDT-277, EDT-279, EDT-280, EDT-282, EDT-283, EDT-284, EDT-287, EDT-289, EDT-290, EDT-302, EDT-312, EDT-327, EDT-328, EDT-329, EDT-331, EDT-333, EDT-334, EDT-336, EDT-338, EDT-339, EDT-340, EDT-341, EDT-344, HWF-11, HWF-24, HWF-32, HWF-42, QAN-23. Adapted (12), reasons in DECISIONS: EDT-239 (the copy's notice in the editor's save pill, where the editor says what happened to the map, not a toast), EDT-269 (no "you/" prefix — the product has no user names — the address made from the title by the API's rules, Arabic letters kept, editable and checked as it is typed), EDT-270 (a server record, each publish an immutable version, the author's own name), EDT-275 (`/embed/g/{slug}` and `/g/{slug}/map` for the prototype's `view=` and `embed=1`), EDT-324 (the page rendered on the server from the API; no built-in sample with invented counts, EDT-337), EDT-325 (the site's own header; the address under the title, not in it), EDT-326 (the author's other maps and the gallery, each a link, the address following), EDT-330 (the caption under the frame, where it covers nothing), EDT-332 (five citation forms by the version's own address, a copy counted once per reader an hour; the licence words wait on EDT-335), EDT-343 (`POST /published` and `POST /published/{slug}/versions`, the owner's local id keeping their copy and the published one one map), EDT-345 and EDT-346 (the copy made and the citation written in the reader's browser, local-first; the API counts them). Bug-fixed (5): EDT-285 and HWF-56 (messages taken only from the frame's parent and its origin), EDT-286 (sent only to the parent's origin, never "*"), EDT-291 and HWF-53 (a link written as a [source, target] pair read like any other). F17 fixed for every read-only view, not only the published copy (a root's map, a map in a link, a shared map: fold, unfold and fit; no tidy, undo, ports or dragging); F11's 404 answered. Carried and closed: HUB-25 (audit 10), PRF-20 and MAP-05's maps (audit 11). EDT-335 stays the owner's: the page says what holds in the meantime. P8.7: journey E end to end on desktop and phone (`journey-e.spec.ts`), every card in a page of another origin where its author left it. Counts after P8.5: 431 items — 281 done, 121 adapted, 21 bug-fixed, 5 n/a, 2 open (P8.6a's EDT-304 and EDT-306, waiting on the owner's answers to the phone mock-ups), 1 waiting (EDT-335).
