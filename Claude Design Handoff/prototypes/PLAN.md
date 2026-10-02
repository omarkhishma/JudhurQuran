# Jadhr — build plan (all 42 explorations)

Working name: **Jadhr** (جَذْر). Originals (Reader v1/v2/v3, Editor v2/v3/v4) stay untouched; new work lands in v4/v5 + new pages. Shared data & storage: `lexicon-data.js` (ES module) — every page imports it; user data lives in localStorage under `jadhr-*` keys so pages see each other's state.

## Tranches
1. Hub `Jadhr.dc.html` — 5l landing · 5j shell nav + context strip · 4g local-first sign-in prompt · links to every page
2. `Lexicon Reader v4` batch 1 — books switcher with Qurʾān/Ḥadīth samples (2b) · Scripture tab (2a) · Lexica modes: list / side-by-side (2e) / apparatus (2f) · tashkīl toggle
3. `Lexicon Reader v4` batch 2 — word states (3c) · difficulty in contents (3d) · resume marker + progress (3e) · inline gloss on narrow (3h) · marginalia (5e) · suggest-an-edit on senses (4a) · cite/share sheet (4e) · first-run beats (5k) · ⌘K omnibox (5a) · inline analyser for unknown words (5c)
4. Pages — `Library` (3a paste/URL/PDF stub + 3b shelf) · `Concordance` (2c KWIC + 2d distribution) · `Search` (5b) · `Analyser` (5d)
5. Pages — `Notebook` (5f + 3f journal tab) · `Review Queue` (4b) · `Classroom` (4c heat-map + 4d shared workspace) · `Published Graph` (4f) · `Profile` (4h) · `Data & API` (5g/5h)
6. `Lexicon Editor v5` — 4d presence & comments · Publish → 4f · `Shell` split view (5i) · update Before & After index

Round-1 features (1a–1h) are already live in Reader v3 / Editor v4 and carry forward.

## Storage keys
prefs · word-states · marks · notes · progress · texts · sessions · context · account · proposals · published · onboarded (all prefixed `jadhr-`)


## Polishing stages
- **P1 Graph unification** ✔ — Editor v5 read-only mode (`?view=slug[&embed=1&entry=0|1&folded=0|1&theme=light|dark]`), full-fidelity publish (`doc`), legacy-format fallback, Published Graph + Classroom mount the real editor, fork counts.
- **P2 Reader v4 depth** — each tab/overlay audited against its exploration; narrow widths.
- **P3 Reading-site pages** — Library, Concordance, Search, Analyser.
- **P4 Community pages** — Review Queue, Notebook/Journal, Classroom, Profile, Data & API; propose → review → merge → changelog → profile end to end.
- **P5 Cross-cutting** — shared nav everywhere, dark parity, type scale, a11y, persistence, dead links.
- **P6 Final walk** — journeys from the hub; change log below.

## Change log
- P2 Reader v4: tabs 8→6 (Scripture folded into Sources with the timeline, single-row strip), sibling attestations in empty scripture state, root gloss in header chip, English glosses no longer spliced into Arabic lexicon text (italic LTR), Cite dialog semantics, TDZ crash fixed.
- P3 pages: Concordance context columns hug the keyword with clear ←/→ labels; Analyser columns fixed (segments/root/wazn were bleeding into each other), affix chips, harakat-only segments dropped, particles show —; Search meta shows Arabic root in Amiri.
- P4 community: review queue — seed approvals by a second reviewer, no double-approve, filter switching selects an item, decisions move selection on, per-filter empty copy; merged edits now rewrite the sense in the Reader with a credit line and appear in the Data changelog; Data & API re-reads on focus; Profile tolerant of legacy graphs; Classroom heat-map line boxes tightened.
- P5 cross-cutting: no dead links across pages; one shared theme key (`jadhr-theme`) so Reader and Editor agree and default light like the rest of the site; aria-current on shared nav.
- P6 final walk: hub → Reader → Editor → Split view → Notebook journeys checked; shared header no longer pushes page actions off-screen (nav strip scrolls, actions pinned).


## Round 6 — casual explorers → Reader v5 (`Lexicon Reader v5.dc.html`, copied from v4; v4 untouched)
Chosen: 6a plain-first entry · 6d layered panel · 6e curiosity trails · 6f trail graph · 6g collections · 6i phone reader · 6k plain-language layer. Not built: 6b/6c/6l (mode switches), 6h, 6j.

### Stage R1 — Plain front door (6a)
- New `mode: 'ask'` in the Reader: one question box + result card (meaning · audio · cousins · one attestation · "Go deeper").
- Hub "Explore" and Search's empty state route here; ⌘K stays for power users.
- "Go deeper" opens the existing panel on the same word.

### Stage R2 — Layered panel (6d)
- Replace the six tabs with collapsible sections in one scroll: Meanings · Word family · In texts · Across the centuries · For scholars (sources · apparatus · patterns · cite).
- Section open/closed state persists (`jadhr-panel-layers`). Defaults: first two open.
- Tabs remain available as a preference ("Panel: layers / tabs") for scholars who prefer them.

### Stage R3 — Plain-language layer (6k)
- One glossary (~40 terms) in `lexicon-data.js`; `<term>` renderer marks dotted terms in the panel, patterns table, lexica, analyser.
- Tap → explanation card with "show me more" (jumps to the pattern table filtered) — header toggle "Explain terms" (default on; off persists).

### Stage R4 — Curiosity trails (6e + 6f)
- Trail state: ordered steps (word/root/pattern/passage), breadcrumb in the panel header.
- Every entry ends with "Where next?" — a cousin, a verse, the shape (chosen deterministically from data).
- Trail graph: read-only editor embed fed by the trail (postMessage) in a collapsible drawer; "Save trail" → Notebook; "Open in editor" → seed.

### Stage R5 — Collections (6g)
- `Collections.dc.html`: word of the day (deterministic by date), 4 curated sets from prototype data, streak-free progress. Items open the ask-mode card.
- Hub links to it.

### Stage R6 — Phone-first reader (6i)
- Under 700px: rail and toolbars collapse; long-press passage for tools; sheet at half height on tap, full on swipe up; targets ≥44px.
- Audit every overlay (omnibox, cite, suggest, onboarding) at 390px.

### Stage R7 — Polish & verify
- Same audit-fix-verify method as P1–P6; change log below.

### R log
- R1 ✔ Ask view (`?mode=ask[&q=]`, header "Ask", default for first-time visitors): question box · matches · result card (meaning, audio via speech synthesis, root + cousins, one attestation) · Go deeper / Read a text / Save.
- R2 ✔ Layered panel: six tab bodies reused unchanged inside collapsible sections (Meanings · Word family · Shapes · Old dictionaries · Across the centuries · In this text); open state persists (`layerOpen`), first two open by default; "Panel as tabs" preference restores the tab strip.
- R3 ✔ Plain-language layer: 30-term glossary; dotted terms in the entry meta line, grammar band, family group headers and pattern headers open a dark explanation card with a jump ("Show me the shapes" opens that section); "Explain terms" preference (default on, off persists); Esc closes.
- R4 ✔ Curiosity trails: every entry ends with "Where next?" (a cousin · a verse or the text · the shape); trail breadcrumb under the header with a Map toggle — a small read-only trail graph (dashed = current), Save to Notebook, Open in the editor (seed), Start a new trail. Trail persists (`jadhr-trail`).
- R5 ✔ Collections page: word of the day (deterministic by date), progress without streaks, four curated sets from prototype data; each set is a guided list with Open (→ Ask card) and Keep (word state), roots chips, "See the set as a map" (editor seed). Hub and shared nav gain Ask / Explore; Read now points at v5.
- R6 ✔ Phone-first: under 900px the dictionary is a sheet at half height (tap a word), grabber swipes up to full / down to close; passage tools hide until a long-press (420ms); action buttons ≥40px on touch; ask placeholder shortens.
- R6 fix: phone header collapses to logo · title · Ask · ⋯ menu (search, preferences, review, theme, graph, library) · Dictionary pinned; sheet controls (back/forward/index/close, section headers, tabs) ≥44px on narrow.
- NEXT: R7 polish & verify pass over R1–R6.
- R7 polish: ask hint hidden until typing; trail records URL-opened words and needs 2 distinct words before showing; layer defaults merge with stored state and a fully-folded panel re-opens Meanings.
- R7 ✔ complete. Reader v5 is the current reader; v4 kept for comparison. Review links point at v5.

## R8–R10 — remaining explorations
- R8 ✔ 6j: on phones the Ask result is four swipeable cards in fixed order (Meaning · Cousins · Heard in · The shape), dots track position, "Go deeper" below; desktop keeps the 6a card.
- R9 ✔ 6h: "Study this set" opens a swipe deck over the collection — front: word + audio, tap/space to flip, swipe or ←/→ (Skip/Keep); Keep marks *learning* + stars the word so its root family enters the review deck; end card links to Review.
- R10 ✔ 1b: review deck "In context" mode — passage with the due root shown with family members blanked; type to check, reveal on demand; revealed words listed with lexicon line and attestations; grades feed the same scheduler as the root card.
