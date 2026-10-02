# 3 · Lexicon Reader v5

`prototypes/Lexicon Reader v5.dc.html` · 3,064 lines · the largest screen in the product and the one everything else routes into.

Earlier versions (`Lexicon Reader.dc.html`, `v2`, `v3`, `v4`, `- Research`) are kept in the bundle **for comparison only**. **v5 is the specification.** v4 is the last version before the casual-explorer work (Ask mode, layered panel, trails, plain-language layer, phone sheet) and is useful only to see what changed.

---

## 3.1 Modes

The Reader is one screen with five mutually exclusive top-level modes. `mode` in state, `?mode=` in the URL.

| Mode | Trigger | What is shown |
|---|---|---|
| `ask` | Default **for first-time visitors**; header **Ask** button; `?mode=ask`; Hub "Explore"; Search's empty state | Plain question box + result card. Panel closed. |
| `empty` | Returning visitor with no word selected | Reading surface with a quiet prompt to pick a word |
| `word` | Any word clicked, or `?w=<id>` | Reading surface + dictionary panel on that word |
| `index` | `?mode=lookup`; **Look up** in the shared nav | Panel shows the A–Z / root index instead of an entry |
| `review` | Header **Review** button; `?mode=review` | Full-screen review deck overlay (§3.9) |

First-visit detection: ask mode is chosen when there is no `mode`, no `w`, no `book`, no stored reading progress, and no `onboarded` flag.

---

## 3.2 Layout

Three columns under a 52px header, `height: 100vh`, `display: flex`, `overflow: hidden`.

```
┌──────────────────────────────────────────────────────────────┐
│ header 52px  (progress hairline pinned to its top edge)      │
├─────────┬──────────────────────────────┬─────────────────────┤
│ rail    │ reading surface              │ dictionary panel    │
│ 240px   │ flex:1, scrolls, --paper     │ ~420px, resizable   │
│ --panel │ max-width ~72ch centred      │ --card, scrolls     │
└─────────┴──────────────────────────────┴─────────────────────┘
```

- **Rail** — 240px, `background: var(--panel)`, `border-right: 1px solid var(--line)`. Toggled by the hamburger. Below 1200px it overlays the surface with a `rgba(10,10,16,.28)` scrim starting at `top: 52px`.
- **Reading surface** — `background: var(--paper)`, scrolls independently, content capped around 72 characters and centred.
- **Panel** — docked right, `background: var(--card)`, `border-left: 1px solid var(--line)`, width persisted, drag-resizable. Below 900px it becomes a bottom sheet (§3.10).
- **Reading-progress hairline** — 2px, absolutely positioned across the top of the header, width = fraction of the current text read, in `var(--ring)`.

### Header contents (left → right)
1. Rail toggle — 28×28, `border-radius: 8px`, three-line icon
2. 18×18 logo mark, `border-radius: 5px`, `background: var(--c-root)`
3. **Title block** — Arabic book title in Amiri 15px (`dir="rtl"`, ellipsised, `max-width: 260px`) over an 11px `--t3` line reading `<book meta> · <state counts>`
4. Spacer
5. `A− · <percent> · A+` control group *(≥1200px only)*
6. **Ask** button — always visible, `aria-pressed` reflects ask mode
7. **Search** button — `⌕ Search ⌘K`, `min-width: 120px`, the `⌘K` in a bordered mono badge *(wide only)*
8. **Review** button — calendar icon + "Review" + due-count badge in mono on `--card-2` *(wide only)*
9. **Reading** — preferences popover *(wide only)*
10. **Theme** toggle — 32×30 *(wide only)*
11. **Graph** link → Editor *(wide only)*
12. **⋯** overflow *(below 900px only)* — 40×40 minimum
13. **Dictionary** — panel toggle, **always visible and always last**

### Reading preferences popover
268px wide, `max-height: calc(100vh - 64px)`, scrolls, anchored `top: 48px; right: 14px`.
- Label: "READING PREFERENCES"
- Four toggles, each with a one-line hint: **Transliteration** · **Tashkīl** · **Sense tint** · **Panel as tabs**
- Divider
- "DICTIONARIES SHOWN" + count in mono
- Nine dictionary toggles, each: switch · English name · one-line hint · Arabic name in Amiri, RTL

---

## 3.3 Ask mode (the plain front door)

The most important screen for the largest audience. Everything here is deliberately jargon-free.

**Composition**, centred, single column, generous vertical rhythm:
1. One large question input. Placeholder is a plain-language prompt, shortened on narrow widths. A hint line below appears **only once the user starts typing** — not before.
2. **Matches** — a short list of candidate words as the user types, Arabic in Amiri + transliteration + short English gloss.
3. **Result card** — for the chosen word:
   - Headword in Amiri at 36–56px, `dir="rtl"`
   - Transliteration, then a plain one-line meaning
   - **Audio** button — pronunciation (prototype uses `speechSynthesis`; production needs real audio, see `10-open-questions.md` §2)
   - **Root** chip in `--c-root` + up to 3–4 **cousins** (same-root words) as clickable chips
   - **One** attestation — a single real passage, Arabic + English, with its reference. One, not a list.
   - Actions: **Go deeper** (opens the layered panel on this word) · **Read a text** · **Save**

**On phones the result card becomes four swipeable cards** in fixed order — **Meaning · Cousins · Heard in · The shape** — with position dots and *Go deeper* below the deck. Desktop keeps the single card.

---

## 3.4 Reading surface

- Text is a sequence of **passages**; each passage is a sequence of **tokens**.
- Tokens that resolve to a known word are interactive: hover raises a subtle tint, click selects and drives the panel. Clicking a word **automatically marks it `learning`** if it has no state yet.
- Each token carries grammatical information (case, definiteness, person/number, form) shown in the panel's grammar band.
- **Sense tint** (preference): interactive tokens carry a faint wash in the color of their dominant sense.
- **Word states** are visible in the text: `learning` · `known` · `starred`. The header's `stateCounts` summarises them.
- **Inline gloss on narrow widths**: rather than opening the panel, a tapped word can show its gloss inline.
- **Marginalia**: notes anchored to a passage, shown in the margin on wide screens.
- **Passage tools** (cite, note, concordance, analyse, copy) appear on hover on desktop. **On touch they are hidden until a 420ms long-press** — this keeps the reading surface clean and prevents accidental activation while scrolling.
- **Resume marker** — the last-read passage is remembered per text and marked on return.

### Rail
Top section "LIBRARY" with an `all →` link, then the available texts: type dot · Arabic title in Amiri 15px RTL · kind label (`Qurʾān`, `Ḥadīth`, `prose`). Below: **contents** — chapters and passages, each with a **difficulty indicator** and the resume marker.

Texts added through the Library page appear here automatically.

---

## 3.5 The layered panel

**The default panel is layers, not tabs.** Six collapsible sections in one continuous scroll. Open/closed state persists per section; the first two are open by default. A fully-folded panel re-opens *Meanings* on next load so the panel is never empty.

Order and content:

1. **Meanings** — the numbered senses. Each sense: number, sense text, optional sense color dot, and a **Suggest an edit** affordance (§3.7).
2. **Word family** — every word sharing the root, grouped by pattern, each with its pattern name and a plain-language description of what that pattern does. Group headers carry dotted plain-language terms.
3. **Shapes** — the pattern (*wazn*) table: the pattern, its transliteration, its function ("noun of place", "Form II causative verb"), and the words in this family that use it.
4. **Old dictionaries** — the nine historical lexica. **Three display modes**: `list` (stacked articles), `side-by-side` (two columns for comparison), `apparatus` (dense critical-edition layout). Filter chips: `All 9 · Earliest · General · Root-semantic · Interpretive · English`. Each article shows the dictionary's Arabic name, English name, author, and death date.
5. **Across the centuries** — a timeline from 550 to 1920 CE, plotting which dictionaries and which corpora (pre-Islamic poetry 580 · Qurʾān 632 · Ṣaḥīḥ al-Bukhārī 846) attest this word.
6. **In this text** — occurrences of this word in the text currently open, with references, plus sibling attestations from other texts when the current text has none.

**Panel header** (above the sections): the headword in Amiri, a root chip showing the root's gloss, the transliteration, the part of speech, the pattern, a corpus-frequency figure, back/forward history arrows, an index button, and a close button. Below it: the **trail breadcrumb** (§3.8).

**Tabs remain available** as the "Panel as tabs" preference for scholars who prefer the v4 behaviour — the same six bodies in a tab strip. Both must be implemented; the tab bodies are identical content.

---

## 3.6 Plain-language layer

A ~30-term glossary. Technical terms are marked with a **dotted underline** wherever they appear: the entry meta line, the grammar band, family group headers, pattern headers, the lexica, and the analyser.

Tapping a dotted term opens a **dark explanation card** (dark in both themes — it reads as an aside): term name, category, a 2–3 sentence plain explanation, and a **jump** action ("Show me the shapes" opens and scrolls to that section). `Esc` closes. Position flips above the term when there is no room below.

Controlled by the **Explain terms** header toggle, **default on**; "off" persists.

---

## 3.7 Suggest an edit

On any individual sense. Opens a dialog: the current sense text, an editable proposal, a required rationale, and the sources the proposer is relying on. Submitting writes a proposal keyed to `{wordId, senseIndex}` and it appears in the Review Queue.

Once a proposal for that sense has been **merged**, the Reader shows the **new sense text with a credit line** naming the contributor. The Reader re-reads proposals on window focus so a merge in another tab appears without a reload.

---

## 3.8 Curiosity trails

- Every panel entry ends with a **"Where next?"** block offering up to three doors, chosen deterministically from the data: **a cousin** (same root, different pattern) · **a verse or a passage** where the word occurs · **the shape** (its pattern, with other words using it). Each door shows a caption, the Arabic, and a one-line *why*.
- Words visited accumulate into a **trail** — ordered steps, capped at 40, persisted. Words opened via `?w=` are recorded too.
- The **breadcrumb** sits under the panel header, showing the last 6 steps. Clicking an earlier step truncates the trail to that point. It appears only once the trail has **2 or more distinct words** — no breadcrumb on a single lookup.
- **Map** toggle → a small read-only trail graph in a collapsible drawer: nodes laid out in rows of 3, the current node dashed, edges connecting consecutive steps. Actions: **Save trail** (writes a dated Notebook note listing the words) · **Open in the editor** (seeds a real graph from the trail) · **Start a new trail**.

---

## 3.9 Review deck (study)

A full-screen overlay, reached from the header **Review** button or `?mode=review`. **The unit of review is the root family, not the isolated word** — this is the pedagogical claim of the whole product.

**Two modes:**

**Root card** — front: the root and its core idea; flip (tap or `space`) to the family. Grade with the standard again/hard/good/easy affordances; grades feed a spaced-repetition scheduler. Due count shows in the header badge.

**"In context"** — a real passage is shown with the due root's family members **blanked out**. The learner types to check, or reveals on demand. Revealed words are then listed with their lexicon line and attestations. Grades feed the same scheduler.

Words enter the deck by being starred, or by being marked `learning` and then confirmed. Marking `Keep` in the Collections study deck marks the word `learning` **and** stars it, so its whole root family enters the review deck.

---

## 3.10 Phone behaviour (< 900px)

- **Dictionary is a bottom sheet**, not a column. Tap a word → sheet rises to **half height**. A grabber handle at the top: swipe up → full height, swipe down → close. Top corners `border-radius: 16–18px`, `box-shadow: var(--sh-open)`.
- Sheet controls — back / forward / index / close, section headers, tab strip — are all **≥ 44px**.
- Header collapses to: logo · title · **Ask** · **⋯** · **Dictionary**. The ⋯ menu carries search, text size, review, theme, graph editor, library.
- Passage tools require a **420ms long-press**.
- Ask placeholder shortens; the Ask result becomes the four-card swipe deck.
- Rail becomes a scrimmed overlay.
- Every overlay was audited at **390px**: omnibox, cite, suggest, onboarding, term card, review deck, trail map.

---

## 3.11 Overlays

| Overlay | Trigger | Notes |
|---|---|---|
| **Omnibox** | `⌘K` / `Ctrl+K`, header Search | Searches words, roots, patterns, passages in one list; arrow keys + Enter; `Esc` closes |
| **Cite / share** | Passage tools, panel actions | BibTeX · RIS · plain text · a `?w=` permalink. Semantics differ per target (word vs passage vs dictionary article) |
| **Suggest an edit** | Per sense | §3.7 |
| **Term card** | Dotted term | §3.6 |
| **Onboarding** | First visit only | A short sequence of beats, dismissible, sets the `onboarded` flag |
| **Review deck** | Header Review | §3.9 |
| **Trail map** | Breadcrumb **Map** | §3.8 |

---

## 3.12 State and persistence

Reader state, all persisted (prototype keys shown — replace with server-side user state plus a local cache):

| Concern | Key | Shape |
|---|---|---|
| Word states | `jadhr-word-states` | `{ [wordId]: 'learning' \| 'known' \| 'starred' }` |
| Notes | `jadhr-notes` | `[{ id, body, tags, wordId?, passageKey?, ts }]` |
| Reading progress | `jadhr-progress` | `{ [textId]: { ch, pi, at } }` |
| Proposals | `jadhr-proposals` | see `07-data-model.md` |
| Sessions | `jadhr-sessions` | lookup log, feeds Classroom + Profile |
| Trail | `jadhr-trail` | `[{ kind: 'word', id, ts }]`, max 40 |
| Panel layers | `jadhr-panel-layers` | `{ [sectionId]: boolean }` |
| Preferences | `jadhr-prefs` | transliteration, tashkīl, tint, panel mode, explain-terms, text size, dictionaries shown, rail/panel open, panel width |
| Onboarded | `jadhr-onboarded` | boolean |
| Theme | `jadhr-theme` | `'light' \| 'dark'` — **shared with the Editor** |
| Cross-page context | `jadhr-context` | `{ root, word, passage }` — read by Concordance, Shell, Hub |

**Implementation note:** in production, word states, notes, progress, proposals, sessions, and preferences are **server-side per user**, with a local cache for offline reading. The trail, panel layers, and theme can stay client-only. `jadhr-context` becomes in-app routing state. Anonymous users keep everything locally and it must **migrate on sign-in** — see `10-open-questions.md` §4.
