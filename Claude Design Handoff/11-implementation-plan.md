# 11 · Implementation plan

---

## 1 · Stack

The stack choice was left open. Here is the recommendation and, more usefully, the constraints that should drive it if you choose differently.

### Recommended
| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript** | Every URL parameter in `01-product-and-ia.md` §1.3 must be a real shareable route; published graphs and word pages need SSR for crawlability and link previews; the Reader needs client-heavy interactivity on the same stack |
| Styling | **Tailwind with the tokens in `02-design-tokens.md` as theme values**, or CSS modules with custom properties | Tokens are already a flat, nameable set. Use **logical properties** throughout (`padding-inline`, `margin-inline-start`) — see `10-open-questions.md` §7 |
| Backend | **Next.js route handlers for the app API + a separate Node service for workers** (indexing, ingestion, dataset builds) | One deployable for the product, one for the jobs that must not run in a request |
| Database | **Postgres + Prisma** (or Drizzle) | The schema in `07-data-model.md` is relational; JSONB only for graph documents |
| Search | **OpenSearch 2.x** | Chosen. `09-search-architecture.md` |
| Cache/queue | **Redis** | Analysis cache, rate limits, outbox worker queue |
| Object storage | **S3-compatible** | Dataset artefacts, audio, uploaded PDFs |
| Realtime | **WebSocket presence channel** (Phase 3) | `10-open-questions.md` §5 — presence only |
| Morphology | **Lexicon-driven analyser in-app; Python CAMeL service later** | `09-search-architecture.md` §9.5 |

### Constraints for any alternative
1. **SSR or SSG is required.** Published graph pages and word pages must be server-rendered for citation, crawling, and link unfurling. A pure SPA fails this.
2. **The frontend must handle heavy client state well.** The Reader holds ~25 pieces of interacting state across five modes; the Editor is a graph canvas with undo. This is not a content site.
3. **Postgres or equivalent relational store.** Do not use a document database — senses, tokens, proposals, and decisions are relational and the moderation rules are enforced by constraints.
4. **Arabic text handling must be tested in the chosen environment.** Verify NFC normalisation, `dir` handling, and Amiri rendering before committing.

If **Supabase** is preferred: it gives auth, Postgres, storage, and realtime in one, and would save real time on Phases 0 and 3 — but you still operate OpenSearch separately, and row-level-security policies would have to encode the moderation rules that §07 puts in constraints. A reasonable trade.

---

## 2 · Effort shape

Rough proportions, not estimates:

```
Reader v5              ████████████████████  28%
Editor v5              ██████████████        20%
Backend + schema + API ███████████████       21%
Search + morphology    ████████              11%
The other 14 screens   ████████████          15%
Ingestion pipeline     ███                    5%
```

The two big screens are half the frontend work. **Do not start with them.**

---

## 3 · Phases

### Phase 0 — Foundations (start here)
- Schema from `07-data-model.md` as real migrations
- Seed migration from `lexicon-data.js` — all 6 roots, 22 patterns, 35 words with senses, 9 dictionary records, 3 texts fully tokenised, ~30 glossary terms
- Tokens as rows, with the three Arabic string forms and generated columns
- OpenSearch cluster, analyser chain, mappings, and the **reindex command**
- The five Arabic search assertions from `09-search-architecture.md` §9.6 in CI
- Design tokens implemented; Amiri + IBM Plex loaded and verified rendering Arabic with tashkīl
- Shared shell and nav; routing skeleton for all 15 product routes
- `GET /words/:slug` and `GET /passages/:id` working against real data

**Exit criterion:** you can `curl` the full word-panel payload for `maktaba` and it contains the family, the attestations, the timeline, and the next steps.

### Phase 1 — Read and look up
- Reading surface: passages, interactive tokens, grammar data, tashkīl and transliteration toggles, text size
- Layered panel: all six sections, plus the tabs preference
- Word states, reading progress, resume marker, contents with difficulty
- Ask mode with the result card
- Omnibox, Search page (with the root builder), Analyser (lexicon-driven), Concordance (both views)
- Library with **Paste** ingest only
- Plain-language layer and term cards
- Dark theme across everything built so far
- **Phone pass at 390px** — sheet, long-press tools, ⋯ menu, swipe cards

**Exit criterion:** a user can read a text, look up every word, compare dictionaries, and find any word four different ways — with no account.

### Phase 2 — Accounts, study, contribution
- Auth, anonymous→account migration, Profile with export and delete
- Spaced repetition: root cards, "In context" mode, due counts, scheduler
- Collections: word of the day, four sets, study swipe deck
- Notebook: notes and journal
- Trails: breadcrumb, next steps, trail map, save-to-notebook
- Proposals end to end: suggest an edit → Review Queue → two approvals → merge → credit line → changelog → Profile
- Library **URL** ingest

**Exit criterion:** journeys B and D in `01-product-and-ia.md` §1.5 work end to end for a signed-in user.

### Phase 3 — Graph, publish, community
- Editor: canvas, five node kinds, frames, edges, palette, entry sidebar, fields, fold, labelled undo, tidy/fit, import/export
- Autosave, comments
- Publish → immutable snapshot → public `/g/<slug>` page mounting the real editor read-only
- Fork, cite, embed, `doc_version` fallback
- Presence (WebSocket, presence only)
- Classroom: cohorts, lessons, heat-map, activity feed, shared workspace
- Split Shell

**Exit criterion:** journeys E and F work; a published graph renders identically to what its author built, in an iframe on a third-party page.

### Phase 4 — Scholarly surface and launch readiness
- Dataset release pipeline: pre-generated JSON/TEI/LMF/CSV artefacts, versioned, archived, DOI
- Public data API with keys and its own rate limits
- Data & API page: downloads, playground, changelog, citation formats
- **Licensing resolved and displayed per source** (`10-open-questions.md` §1)
- Real audio for curated sets + high-frequency words
- Accessibility audit against `02-design-tokens.md` §2.7
- Performance: panel payload under 200ms p95, reading surface interaction under 50ms
- Offline scope decided and implemented

---

## 4 · A defensible first release

If the timeline compresses, this is the cut that preserves the product's identity:

**Ship:** Ask mode · reading with the layered panel · Search + omnibox · Concordance · Analyser · Library (paste) · word states + progress · accounts with local-first migration · Collections · review deck · Notebook · Profile · full dark theme and phone support.

**Defer:** the graph editor and everything downstream of it (publish, fork, Published Graph, Classroom, Split Shell) · the public data API and dataset releases · PDF ingest · realtime presence.

**Rationale:** what ships is a complete, coherent reading-and-lookup product for three of the four audiences, and it stands alone. The graph editor is the most differentiated feature but also the most expensive, and it is the one part that genuinely does nothing for a first-time visitor. Defer it as a whole rather than shipping it half-built — a graph editor that loses work is worse than no graph editor.

**Do not cut:** the plain-language layer, the phone pass, dark theme, or the two-approval moderation rule. Each is small, and each is load-bearing for a specific audience the product is explicitly for.

---

## 5 · First-week checklist for Claude Code

1. Read `README.md`, then `10-open-questions.md`. Raise §1 (licensing) with the product owner **before writing code** — it can change what gets built.
2. Serve `prototypes/` and walk the journey in `README.md` §4. Click everything. The prototypes are the most precise specification available.
3. Scaffold the app, implement the tokens from `02-design-tokens.md`, and get Amiri rendering vocalised Arabic correctly at reading size. **Verify this before anything else** — if the type is wrong, the whole design is wrong.
4. Write the schema and the seed migration from `lexicon-data.js`. Do not hand-copy the data; write a script that parses the file.
5. Stand up OpenSearch, implement the analyser chain, and get the five Arabic assertions green.
6. Build `GET /words/:slug` complete. Everything in the Reader hangs off it.
7. Then start the Reader — reading surface first, panel second, Ask mode third.

**Two pieces of advice about this codebase specifically.** First, the prototypes encode a large number of hard-won fixes — the RTL gloss separation, the KWIC context hugging, the analyser column bleed, the header action pinning, the fully-folded panel re-opening, the review-queue selection behaviour. They look like small details and they are individually recorded in `PLAN.md`'s change log alongside the prototypes. When something in this documentation seems fussily specific, it is because it was got wrong once already.

Second, this product's audience will judge it on linguistic correctness before anything else. A rounded corner in the wrong place costs nothing; a wrong root attribution costs the project its credibility. When in doubt between speed and correctness on anything linguistic, choose correctness and surface the uncertainty in the UI — the design already has patterns for saying "we're not sure" (confidence scores, candidate lists, `—` for particles). Use them.
