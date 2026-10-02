# 1 · Product, audiences, and information architecture

## 1.1 The four audiences and their entry points

| Audience | Entry | What success looks like |
|---|---|---|
| Casual explorer | Hub → **Explore**, or Reader `?mode=ask` | Asks about one word, understands it in under 30 seconds, follows a trail to a second word |
| Student | Hub → **Read**, Collections, Review | Reads a passage with the panel open, collects words, returns to a review deck that is due |
| Scholar | **Look up**, Concordance, Analyser, Data & API | Compares nine dictionaries on one word, exports a citation or the dataset |
| Contributor | Graph editor, Review Queue | Builds a root family, publishes it, proposes a sense edit, reviews someone else's |

The product deliberately **does not ask which one you are**. It opens in the plainest mode (Ask) for first-time visitors and reveals the scholarly depth progressively: plain card → layered panel → "For scholars" sections → apparatus view. The only persistent signal is the `Explain terms` preference (default on), which dots technical terms and offers plain-language cards.

## 1.2 Screen inventory

Eighteen screens. The two large ones (Reader, Editor) are roughly 60% of the implementation effort between them.

**Core**
1. **Hub** (`Jadhr.dc.html`) — landing, search box, context strip ("pick up where you left off"), local-first sign-in prompt, links to everything
2. **Lexicon Reader v5** (`Lexicon Reader v5.dc.html`) — the main surface. See `03-screen-reader.md`
3. **Lexicon Editor v5** (`Lexicon Editor v5.dc.html`) — the graph canvas. See `04-screen-editor.md`
4. **Split Shell** (`Shell.dc.html`) — Reader and Editor side by side in iframes, synchronised through shared context

**Research**
5. **Library** — shelf of texts, add by paste / URL / PDF
6. **Search** — unified search over words, roots, patterns, passages, with a three-letter root builder
7. **Concordance** — KWIC view and distribution view for one root
8. **Analyser** — morphological breakdown of arbitrary input text

**Explore & study**
9. **Collections** — word of the day, four curated sets, study swipe deck
10. **Notebook** — notes and a reading journal
11. **Review Queue** *(name overloaded — this is the editorial proposal queue, not the study review deck)*

**Community**
12. **Classroom** — cohort heat-map and shared workspace
13. **Published Graph** — public read-only page for a published graph, with fork
14. **Profile** — contributions, graphs, library, journal, data export/delete
15. **Data & API** — dataset downloads, API playground, changelog, citation formats

**Supporting / internal**
16. **Before & After** — design index comparing rounds (not a product screen; do not implement)
17. **UX Audit & Roadmap**, **Feature Explorations** — design artefacts (do not implement)
18. **Field / Card Field** — sub-components of the Editor, documented in `04-screen-editor.md`

The study **review deck** (root cards, "In context" mode) is not a separate page — it is a full-screen overlay inside the Reader. See `03-screen-reader.md` §9.

## 1.3 Routes and parameters

The prototypes are static files with query strings. Map them to real routes as follows.

| Prototype | Suggested route | Parameters (all optional) |
|---|---|---|
| `Jadhr.dc.html` | `/` | — |
| `Lexicon Reader v5.dc.html` | `/read` | `w=<wordId>` open that word in the panel · `mode=ask\|lookup\|review` · `q=<query>` prefill the ask box · `book=<textId>` |
| `Lexicon Editor v5.dc.html` | `/graph` | `view=<slug>` read-only published graph · `embed=1` chrome-less for iframes · `entry=0\|1` show entry sidebar · `folded=0\|1` start with cards folded · `theme=light\|dark` · `fork=<slug>` seed a new graph from a published one · `note=<text>` seed a note card · `from=shell` |
| `Shell.dc.html` | `/split` | — |
| `Library.dc.html` | `/library` | `add=1` open the add-text sheet |
| `Search.dc.html` | `/search` | `q=<query>` |
| `Concordance.dc.html` | `/concordance` | `root=<rootKey>` or `w=<wordId>` · `view=kwic\|dist` |
| `Analyser.dc.html` | `/analyse` | `q=<text>` |
| `Collections.dc.html` | `/explore` | `set=<setId>` |
| `Notebook.dc.html` | `/notebook` | `tab=notes\|journal` |
| `Review Queue.dc.html` | `/review` | `filter=Open\|Approved\|Merged\|Declined` |
| `Classroom.dc.html` | `/classroom` | `tab=assign\|shared` |
| `Published Graph.dc.html` | `/g/<slug>` | `g=<slug>` in the prototype |
| `Profile.dc.html` | `/me` | `tab=Contributions\|Graphs\|Library\|Journal` |
| `Data & API.dc.html` | `/data` | `tab=data\|api` |

**Requirement:** every one of these parameters must survive as a real, shareable, linkable URL. The design uses them as the product's sharing mechanism — "Cite / share" in the Reader produces a `?w=` link, the editor's publish flow produces a `/g/<slug>` link, and the Concordance and Analyser are reachable with a preloaded query from the Reader's word panel. Do not collapse these into client-only state.

## 1.4 Shared shell

Every screen except the Reader, the Editor, and the Split Shell wears the same header, defined in `prototypes/jadhr-chrome.js`.

**Structure**, left to right, 52px tall, `background: var(--panel)`, `border-bottom: 1px solid var(--line)`:
- 18×18px `border-radius: 5px` logo mark in `--c-root` (`#a8682c`)
- Wordmark / page title
- Horizontal nav strip — **scrolls horizontally when it overflows; page actions stay pinned to the right.** This was a specific fix; do not let the nav push actions off-screen.
- Right side: page-specific actions, theme toggle

**Nav items** (label → destination), in order:
`Read` → Reader · `Explore` → Collections · `Library` · `Look up` → Reader `?mode=lookup` · `Concordance` · `Analyser` · `Graph` → Editor · `Notebook` · `Review queue` · `Classroom` · `Data & API`

**Nav item styling:** `padding: 5px 10px`, `border-radius: 7px`, `font-size: 12.5px`, `white-space: nowrap`.
- Inactive: `color: #4f4f5a`, no background
- Active: `background: #fff`, `color: #16161a`, `font-weight: 500`, `box-shadow: 0 1px 2px rgba(0,0,0,.06)`, and **`aria-current="page"`**

The Reader and Editor have their own bespoke headers (documented per screen) because both are full-bleed working surfaces where the generic nav would steal vertical space. On phones the Reader header collapses to: logo · title · **Ask** · **⋯** overflow menu (search, preferences, review, theme, graph, library) · **Dictionary** pinned.

## 1.5 Cross-screen journeys

These flows are the product. Each one crosses at least three screens and must work end to end.

**A · Curiosity → understanding → trail**
Ask box → result card → *Go deeper* → layered panel → click a cousin → *Where next?* → trail breadcrumb accumulates → **Map** shows the trail as a small graph → *Save trail* writes a Notebook note, or *Open in the editor* seeds a real graph.

**B · Reading → collecting → reviewing**
Library or Collections → Reader with a text → click words (each becomes `learning` automatically) → star words → the **Review** button in the header shows a due count → review deck drills the *root family*, not the single word → "In context" mode blanks family members inside a real passage → grades feed the scheduler.

**C · Scholarship → citation**
Look up → layered panel → *Old dictionaries* section → list / side-by-side / apparatus modes across nine lexica → *Cite* dialog → BibTeX / RIS / plain → or Data & API for the whole dataset with a DOI.

**D · Proposal → review → merge → credit**
Reader, *Suggest an edit* on a specific sense → proposal enters the Review Queue → needs **two distinct approvals** (no self-approve, no double-approve) → on merge the sense text is rewritten in the Reader **with a credit line** → the merge appears in the Data & API changelog → and on the contributor's Profile.

**E · Graph → publish → fork → cite**
Editor → build a root family → *Publish* → read-only `/g/<slug>` page which **embeds the real editor** in read-only mode (not a static image) → another user forks it, which seeds a new editable graph → fork count increments on the original.

**F · Teaching**
Classroom → assign a lesson → cohort heat-map shows which roots the cohort looked up, confirmed, or struggled with → shared workspace with a live activity feed → open the shared graph in the editor.
