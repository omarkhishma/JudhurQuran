# 05 · Design inventory — every element of the handoff, itemised for parity

Written 2026-10-02 from a full reading of `Claude Design Handoff/` (the 15 product prototypes, `lexicon-data.js`, `jadhr-chrome.js` and the spec documents 01–11). Each part was produced by reading its prototype files line by line and cross-checking them against the spec documents; counts marked "computed" were produced by running the prototype's own data and logic, not copied from the docs.

**Why this file exists.** The owner's vision and this handoff are the measure of done (`docs/PLAN.md` §0). Every element, state, interaction, copy string, breakpoint rule, persistence key and known defect of every prototype has an ID here. Each phase in the plan names the parts it must close, and coverage is reported as "items verified / items in scope". An item leaves scope only with the owner's approval, recorded in `docs/DECISIONS.md`.

**How to read an item.** Copy in quotes is the prototype's verbatim (English) UI text — the product is Arabic-first, so each string needs native Arabic copy, written for Arabic readers rather than translated. Each part keeps its own tag legend; the common tags are: spec and prototype disagree (`SPEC≠CODE`, `[GAP]`, `[≠]`), a prototype defect that must not be copied (`BUG`, `[BUG]`), a simulated value that must never ship as real (`[FAKE]`), and the Quran adaptation notes that say how a generic element becomes a Quran element. The product name used inside the handoff (Jadhr, `jadhr-*` storage keys, `jadhr.org`) is the design's working name; the real name waits for decision D1.

**Reconciliation rule** (proposed in the plan, for the owner's confirmation): where the spec and the prototype disagree, we build the union when both describe something useful (e.g. citation formats: Chicago, APA, MLA, BibTeX, RIS and plain text), and otherwise the more complete or more accessible of the two; every resolution is written next to the item when its phase starts.

## Counts (computed from this file: 1850 item IDs, all unique)

| Prefix | Area | Items |
|---|---|---|
| RDR | Reader | 615 |
| EDT | Graph editor | 348 |
| QAN | Editor — Quran adaptation notes | 25 |
| HWF | Editor — hard-won fixes | 58 |
| SHL | Shared shell and seed data | 78 |
| HUB | Hub | 61 |
| COL | Collections / Explore | 63 |
| LIB | Library | 59 |
| SRC | Search | 53 |
| CON | Concordance | 54 |
| ANA | Analyser | 53 |
| SHR | Community — shared chrome and storage | 25 |
| RVQ | Review queue | 101 |
| NTB | Notebook | 69 |
| CLS | Classroom | 57 |
| PRF | Profile | 44 |
| DAT | Data & API | 67 |
| DEF | Community — consolidated defects | 14 |
| MAP | Community — accounts vs local-first map | 6 |
| — | Content and data model (Part 5, narrative, no item IDs) | — |

## Parts

1. Reader — RDR (§§1–41, including the spec-vs-code summary, the prototype bugs not to copy, the Quran adaptation notes and the hard-won fixes)
2. Graph editor, Split shell, Published graph — EDT, QAN, HWF
3. Hub, Collections, Library, Search, Concordance, Analyser, shared shell — SHL, HUB, COL, LIB, SRC, CON, ANA
4. Community screens — SHR, RVQ, NTB, CLS, PRF, DAT, DEF, MAP
5. Content and data model — every export of the prototype data module, verbatim content tables, and which fields our data already has

## Part 1 — Reader (Lexicon Reader v5)

_Original heading: Lexicon Reader v5 — feature and parity inventory_

Source of truth read in full: `prototypes/Lexicon Reader v5.dc.html` (3,063 lines: template lines 1–1350, data and logic 1351–3061), `prototypes/lexicon-data.js` (300 lines), `prototypes/jadhr-chrome.js` (13 lines). Cross-checked against `01-product-and-ia.md`, `02-design-tokens.md`, `03-screen-reader.md`. The Reader does **not** import `lexicon-data.js` or `jadhr-chrome.js`: it embeds an identical copy of the data module (FORM_META, ROOTS, WORDS, DICTS, FILTERS, TAILS, BOOK, SCRIPTURE, analyse) and renders its own bespoke header; the shared modules matter only for the cross-page persistence keys noted below.

Conventions used in every bullet: copy in “quotes” is verbatim UI text; `{x}` is an interpolated value; **SPEC≠CODE** marks a place where `03-screen-reader.md` (or 01/02) says something different from what the prototype actually does — the bullet states what the code does; **BUG** marks prototype behaviour that should not be copied. Breakpoint words: *wide* = viewport ≥ 900px (the code's `!narrow`), *mid* = < 1200px, *phone/narrow* = < 900px.

### 1. Global shell, layout and breakpoints

- **RDR-001** Shell — `position:fixed; inset:0; display:flex; flex-direction:column; background:var(--canvas); color:var(--t1)`; base font stack `'IBM Plex Sans','IBM Plex Sans Arabic',ui-sans-serif,system-ui,sans-serif` at 12.5px, `-webkit-font-smoothing:antialiased`. Data: none.
- **RDR-002** Fonts — Google Fonts with preconnect to fonts.googleapis.com and fonts.gstatic.com: Amiri (400, 700, 400 italic), IBM Plex Sans 400/500/600, IBM Plex Mono 400/500, IBM Plex Sans Arabic 400/500/600, `display=swap`.
- **RDR-003** Breakpoints — computed on mount and on every window `resize`: `narrow = innerWidth < 900`, `mid = innerWidth < 1200`. Only two flags exist; "wide" in the header means ≥ 900px.
- **RDR-004** Layout row — under the 52px header a single flex row: rail (optional) · reading surface or Ask view (`flex:1; min-width:0`) · docked panel or the 36px collapsed-panel strip.
- **RDR-005** Rail size — 232px wide, `background:var(--panel)`, `border-right:1px solid var(--line)`, scrolls independently. **SPEC≠CODE**: spec says 240px.
- **RDR-006** Rail as overlay (< 1200px) — `position:absolute; left:0; top:52px; bottom:0; z-index:35; box-shadow:var(--sh-open)` plus a scrim `rgba(10,10,16,.28)` from `top:52px` (z 34); clicking the scrim closes the rail.
- **RDR-007** Rail open rules — on load below 1200px the rail is forced closed regardless of the saved value; at ≥ 1200px the saved `railOpen` is restored (default open). On resize, crossing from ≥ 1200 into < 1200 closes it once (only on the transition), so a user who reopens it at mid width keeps it.
- **RDR-008** Reading column — `flex:1; min-width:0; overflow-y:auto; background:var(--canvas)` holding a centred paper (see §7).
- **RDR-009** Docked panel width — `max(320, min(panelW, innerWidth − (232 if rail docked) − 420))` px; default `panelW` 400; persisted. **SPEC≠CODE**: spec says ~420px and `background:var(--card)`; code uses `background:var(--panel)` with `border-left:1px solid var(--line)`.
- **RDR-010** Panel resize — 7px invisible handle at `left:-3px`, full height, `cursor:col-resize`, title “Drag to resize”; mousedown tracks window mousemove; width = start width + (startX − currentX) clamped to [320, cap] where cap = `max(320, innerWidth − rail(232 if open and not mid) − 420)` so the reading column always keeps ≥ 420px; listeners removed on mouseup. Hidden on phone. No touch or keyboard resize.
- **RDR-011** Collapsed panel strip — when the panel is closed (and Ask is off): 36px column, `--panel` bg, left border; a 26×26 chevron button (title “Show the dictionary panel”) and the vertical label “Dictionary” (`writing-mode:vertical-rl`, 11px uppercase, letter-spacing .14em, t3).
- **RDR-012** Z-index stack — header 40 (progress hairline 41), ⋯ menu 45, rail scrim 34, rail overlay 35, phone sheet 36, hover card 70, unknown-word popover 70, term card 72, onboarding 80, graph hand-off sheet 90, review overlay 92, omnibox / cite / suggest / toast 95.
- **RDR-013** Global CSS — links `var(--ring)` no underline, hover `--t1`; `::selection` = ring at 28%; WebKit scrollbars 9px, thumb `--line-2` radius 9, transparent track; `button, a, input :focus-visible` → `outline:2px solid var(--ring); outline-offset:2px` (textarea is not covered).
- **RDR-014** Keyframes — `dcRise` (opacity 0→1 with `translate(-50%,-100%) translateY(6px)` → `translate(-50%,-100%)`, built for popovers anchored above a point), `dcPop` (opacity + scale .98→1), `dcFade` (opacity). Used: dcPop .12s menus/dialogs, dcRise .12s popovers / .16s toast / .18s Ask card / .2s onboarding, dcFade .1–.15s scrims.
- **RDR-015** Design-tool props (fallbacks only when the user has no saved value) — `theme` light|dark default light; `textSize` 0.85–1.6 step 0.05 default 1; `showTranslation` true; `showTransliteration` true; `tintRelated` true; preview frame 1440×900.

### 2. Header

- **RDR-016** Header bar — 52px, `display:flex; align-items:center; gap:10px; padding:0 14px; background:var(--panel); border-bottom:1px solid var(--line); position:relative; z-index:40`.
- **RDR-017** Order left→right as rendered — 1 rail toggle · 2 logo mark · 3 title block · 4 spacer · 5 A− / size / A+ (wide) · 6 Ask (always) · 7 Search (wide) · 8 Review (wide) · 9 Reading (wide) · 10 Theme (wide) · 11 Graph link (wide) · 12 ⋯ (phone only) · 13 Dictionary (always, last).
- **RDR-018** Visibility thresholds — every "wide" item (5, 7–11) is shown at ≥ 900px. **SPEC≠CODE**: spec says the A−/A+ group is ≥ 1200px only.
- **RDR-019** Rail toggle — 28×28, radius 8, `--card` bg, 1px `--line`, `--t2` icon of three lines (middle shorter), title “Show or hide contents”, aria-label “Toggle contents”, hover border ring and text t1. Toggles `railOpen`.
- **RDR-020** Logo mark — 18×18, radius 5, `var(--c-root)`; not a link in the Reader.
- **RDR-021** Title block — column, max-width 260px, shrinkable. Line 1: current book's Arabic title, Amiri 15px, `dir="rtl"`, t1, ellipsis. Line 2: 11px t3 ellipsis “{book English title} · {35} entries · {6} roots · {N} known · {N} learning”. The entries/roots figures are global lexicon counts (not per book); known/learning count all stored word states.
- **RDR-022** Text-size group (wide) — control-group wrapper (`--card-2`, 1px line, radius 9, padding 2, gap 1): “A−” (11.5px, title and aria-label “Smaller text”), mono 11.5px t3 percentage (min-width 34px, e.g. “100%”), “A+” (13.5px, title and aria-label “Larger text”). Header step 0.05 within [0.85, 1.6].
- **RDR-023** Ask button — label “Ask”, title “Ask about a word — the plain way in”, `aria-pressed` = Ask on; on style ring 14% over card + ring border, off card + line border; 12.5px, padding 5×11. Toggles Ask mode (§6).
- **RDR-024** Search button (wide) — “⌕” + “Search” (flex 1, left-aligned) + bordered mono badge “⌘K” (10.5px, radius 4); min-width 120px; t3 text; title “Search everything (⌘K)”; opens the omnibox and focuses its input after 30ms. Badge is hard-coded ⌘K even on Windows/Linux.
- **RDR-025** Review button (wide) — calendar icon + “Review” + mono 11px badge on `--card-2` radius 5 showing the due figure (§25); title “Review the roots you have met, family by family”; starts the review deck.
- **RDR-026** Reading button (wide) — sliders icon + “Reading”, title “Reading preferences”; pill style is "on" while the popover is open (ring 16% bg + ring border); toggles the popover. No `aria-expanded`.
- **RDR-027** Theme button (wide) — 32×30, sun icon in light / crescent icon in dark (stroke 1.1); title and aria-label “Switch to the dark theme” / “Switch to the light theme”; `aria-pressed` = dark. Writes `jadhr-theme` and the local override (§36).
- **RDR-028** Graph link (wide) — graph icon + “Graph”; href to the Editor, plus `?w={id}&tr={tr}&ar={ar}` when a word is selected; title “Open {tr} in the graph editor” or “Open the graph editor”.
- **RDR-029** ⋯ button (phone only) — min 40×40, 16px “⋯”, aria-label “More”, `aria-expanded`; toggles the ⋯ menu and closes the reading popover (§30).
- **RDR-030** Dictionary button — book icon + “Dictionary”, title “Show or hide the dictionary panel”; pill "on" while the panel is open; min-height 40 on phone; toggles `panelOpen`; always the last item. No `aria-pressed`/`aria-expanded`.
- **RDR-031** No shared site nav in the Reader header (bespoke per 01 §1.4); the only outbound header links are Graph and, inside ⋯, Graph editor and Library.

### 3. Reading preferences popover

- **RDR-032** Placement — absolute inside the header, `top:48px; right:14px; width:268px; max-height:calc(100vh - 64px); overflow-y:auto; padding:10px`, card bg, `--line-2` border, radius 12, `--sh-open`, dcPop .12s.
- **RDR-033** Open/close — header “Reading” (wide) or ⋯ → “Reading preferences” (phone); closes on the same button or Esc. No outside-click close, no focus trap, no focus move on open.
- **RDR-034** Label — “Reading preferences” (11px uppercase t3, letter-spacing .09em).
- **RDR-035** Toggle row recipe — the whole row is a `<button role="switch" aria-checked>`; track 28×16 radius 99 padding 2 (on `--ring`, off `--line-2`, background transition .12s), knob 12×12 (#fff on, `--card` off); label 13px t1; hint 11.5px t3 line-height 1.35; row hover `--card-2`, radius 8, padding 7×6.
- **RDR-036** Toggle 1 “Translation” — hint “English under each passage”; default on (prop `showTranslation`); state `trOn`.
- **RDR-037** Toggle 2 “Transliteration” — hint “Latin line under each passage”; default on (prop `showTransliteration`); state `tlOn`.
- **RDR-038** Toggle 3 “Tint the root family” — hint “Words sharing the open word’s root get a solid underline”; default on (prop `tintRelated`); state `tintOn`.
- **RDR-039** Toggle 4 “Grammar band” — hint “Inflection of the hovered or selected word, under each passage”; default off; state `gramAll`.
- **RDR-040** Toggle 5 “Tashkīl” — hint “Show the vowel marks on the text”; default on; state `tashkil`.
- **RDR-041** Toggle 6 “Word states” — hint “Tint learning words amber, mark new words”; default on; state `wordStatesOn`.
- **RDR-042** Toggle 7 “Panel as tabs” — hint “Six tabs instead of stacked sections that unfold”; default off (layers); state `panelMode` 'layers'|'tabs'.
- **RDR-043** Toggle 8 “Explain terms” — hint “Dotted grammar words open a one-line explanation”; default on; stored inverted as `explainOff`.
- **RDR-044** Toggle count — **SPEC≠CODE**: spec lists four toggles (Transliteration · Tashkīl · Sense tint · Panel as tabs); code has the eight above in that order, and "Sense tint" is really "Tint the root family" (root underline, not a sense-colour wash).
- **RDR-045** Divider — 1px `--line`, margin 6px 4px, then the Dictionaries-shown block (§4).

### 4. Dictionaries shown

- **RDR-046** Header row — uppercase label “Dictionaries shown” + mono 11px count “{on} of 9”.
- **RDR-047** Row recipe — switch · English name 13px (t1 when on, t3 off) · hint “{author} · d. {year CE}” 11.5px t3 · Arabic name Amiri 14 `dir="rtl"` (t2 on, t3 off). Order = DICTS order (by compiler death date).
- **RDR-048** Dictionary 1 — “Kitab al-Ayn” / كتاب العين / al-Khalil ibn Ahmad al-Farahidi · d. 786 / tag “earliest” / kind earliest / id `ayn`.
- **RDR-049** Dictionary 2 — “Tahdhib al-Lugha” / تهذيب اللغة / al-Azhari · d. 980 / tag “general” / kind general / id `tahdhib`.
- **RDR-050** Dictionary 3 — “al-Sihah” / الصحاح / al-Jawhari · d. 1003 / tag “selective” / kind general / id `sihah`.
- **RDR-051** Dictionary 4 — “Maqayis al-Lugha” / مقاييس اللغة / Ibn Faris · d. 1004 / tag “root-semantic” / kind root / id `maqayis`.
- **RDR-052** Dictionary 5 — “Mufradat al-Quran” / المفردات / al-Raghib al-Isfahani · d. 1108 / tag “interpretive” / kind interpretive / id `mufradat`.
- **RDR-053** Dictionary 6 — “Lisan al-Arab” / لسان العرب / Ibn Manzur · d. 1311 / tag “comprehensive” / kind general / id `lisan`.
- **RDR-054** Dictionary 7 — “al-Qamus al-Muhit” / القاموس المحيط / al-Fayruzabadi · d. 1414 / tag “concise” / kind general / id `qamus`.
- **RDR-055** Dictionary 8 — “Taj al-Arus” / تاج العروس / Murtada al-Zabidi · d. 1791 / tag “encyclopedic” / kind general / id `taj`.
- **RDR-056** Dictionary 9 — “Lane's Lexicon” / معجم لين / Edward William Lane · d. 1893 / tag “english” / kind english / id `lane`.
- **RDR-057** Dates — only CE death years are stored and shown; no AH dates anywhere.
- **RDR-058** Effect of switching a dictionary off — hides its article in list mode, removes it from filter-chip counts, the Lexica tab count, the Sources tab count, the “{n} say something” meta and the timeline (lanes, streams and the streams' dictionary labels). Persisted as `dictOff = { [dictId]: true }`. All nine may be switched off (no minimum, no empty-state copy).
- **RDR-059** Places that ignore the toggles (**BUG**/inconsistency) — the “One line from each” gist list, the Side-by-side chips and columns, the Apparatus (always “against 8 others”), cite “Sources behind this entry”, suggest-dialog source chips, the hand-off sheet “Description” count (always 9) and the seed JSON `lexica` list.

### 5. Rail (library, contents, roots on this page)

- **RDR-060** Library header — uppercase “Library” + right link “all →” (11px t3) to the Library page.
- **RDR-061** Book rows — full-width buttons, padding 6×8, radius 8; current book: `--card` bg + `--line-2` border; 7px type dot (base prose book `--c-root`, Qurʾān `--c-sentence`, every other book `--c-form`); Arabic title Amiri 15 `dir="rtl"` right-aligned ellipsis; kind label 10.5px t3.
- **RDR-062** Kind labels — base book “Prose” (fallback when a book has no kind; **SPEC≠CODE** spec writes `prose`), “Qurʾān”, “Ḥadīth”, pasted texts “Yours”.
- **RDR-063** Books list — base prose book, Qurʾān sample, Ṣaḥīḥ al-Bukhārī sample, then every text from `jadhr-texts` (Library) appended on mount if its id is not already present.
- **RDR-064** Selecting a book — sets `bookIdx`, chapter 0, clears the selected token, the focus root and every passage drawer. Does not close the overlay rail at < 1200px (chapters do) and does not reset the scroll position.
- **RDR-065** Pasted-text import — split on whitespace following `. ؟ ! ، : ؛` or on newlines; trim; first 40 sentences become passages; ref “{short} · {n}”; transliteration empty; English = the text's `gloss` or “Your text — no translation yet.”; each whitespace token analysed (§10) and, if a lexicon word is recognised, stored as `surface|wordId|gram-or-pos`; book `{ id, ar: title, en: title, kind: 'Yours' }` with one chapter `{ ar: title, en: “Pasted {locale date}” }`.
- **RDR-066** Contents label — “Contents” (11px uppercase) under a divider.
- **RDR-067** Chapter card — mono 11px index “01”; Arabic chapter title Amiri 16 `dir="rtl"`; English title 12px t2; difficulty bar 4px (stacked gradient: known `--c-sentence`, learning `#e0b071`, new `--c-word`) + percent label; meta 11px t3. Current chapter: `--card` bg, `--line-2` border, `--sh`; others transparent with `--line` border; radius 10, padding 9×10.
- **RDR-068** Difficulty rule — pct = round(known interactive tokens ÷ interactive tokens × 100) (100 when none); label ≥ 90 “easy”, ≥ 75 “comfortable”, else “stretch”; pct colour `--good` / `#b45309` / `--bad`.
- **RDR-069** Chapter meta copy — “{easy|comfortable|stretch} · {n} new · {k} new roots · ~{m} min” where n = interactive tokens neither known nor learning (token count, not distinct words), k = distinct roots of tokens with no stored state, m = max(1, round(tokens ÷ 8)).
- **RDR-070** Selecting a chapter — sets `ch`, clears the selected token, closes the rail at < 1200px. The reading column is not scrolled to top (**BUG**).
- **RDR-071** No resume marker in the rail — **SPEC≠CODE**: spec says contents carry the resume marker; it exists only inside the text (§11).
- **RDR-072** “Roots on this page” header — uppercase label + “Clear” button only while a focus root is set (title “Clear the highlight”; hover border/text `--bad`).
- **RDR-073** Root rows — one per root used in the current chapter, sorted by token count desc: Arabic root Amiri 17 letter-spacing .06em, mono transliteration right, 3px bar proportional to the max count (`--c-root` vs `--line`), “{n}×”; title “Highlight every word on this page built on {tr}”; selected: card bg + root border; click toggles the focus root.
- **RDR-074** Focus root effect — every token of that root on the page gets a 1.6px `--c-root` underline (it overrides the selected word's tint root). Not persisted. Also settable from the passage Roots drawer.

### 6. Modes and first-visit logic

- **RDR-075** State model — `mode` ∈ 'empty' | 'word' | 'index'; Ask is a separate boolean `ask` that replaces the reading column; review is a separate overlay object. **SPEC≠CODE**: spec models five values of one `mode` (ask/empty/word/index/review).
- **RDR-076** Initial state — `mode:'empty'`, `ask:false`, panel open (or the saved value).
- **RDR-077** First-visit rule (code) — Ask opens when `?mode=ask`, or when there is no `mode`, no `w`, no `book`, the saved chapter is falsy, and `jadhr-onboarded` is not true.
- **RDR-078** First-visit **BUG** — saved chapter 0 is falsy, and Ask mode never sets `jadhr-onboarded`, so a returning user still on chapter 1 lands in Ask on every visit. Use an explicit "has visited / has progress" flag.
- **RDR-079** Entering Ask at load — `ask:true`, `panelOpen:false`, `onb:-1` (onboarding suppressed for this session), prefill the question from `?q=`, focus the Ask input after 60ms.
- **RDR-080** `?w={wordId}` — if the id exists: `sel`, mode 'word', panel open, history `[id]`, and the word is appended to the trail (consecutive-dedupe, cap 40). It does **not** go through select(): no learning state, no session log, no progress, no `jadhr-context` write, no selected token.
- **RDR-081** `?mode=lookup` — mode 'index' and panel open.
- **RDR-082** `?mode=review` — starts the review deck after 400ms.
- **RDR-083** `?book={id}` — if found at index > 0: `bookIdx`, chapter 0 (the base book cannot be addressed; unknown ids are ignored).
- **RDR-084** Mode transitions — any word selection → 'word'; panel “Index” toggles 'index' ↔ ('word' if a word is selected, else 'empty'); back/forward → 'word'.
- **RDR-085** Ask toggle (header) — entering: `ask:true`, panel closed, pick cleared, input focused after 60ms; leaving: `ask:false`, panel reopened.
- **RDR-086** While Ask is on — the reading column and the collapsed-panel strip are not rendered; the rail still renders if open, and the panel can be opened beside Ask with the Dictionary button.
- **RDR-087** Review overlay — covers everything (z 92); onboarding is hidden while review is open.
- **RDR-088** Empty-mode panel body — see §14 (“Tap any word in the text”).

### 7. Reading surface (paper, chapter header, passages)

- **RDR-089** Paper — `max-width: round(760 × min(size, 1.25))px`, centred, padding 34 30 80, gap 8, `background:var(--paper)`, 1px `--line` borders left and right, min-height 100%. (Spec: "~72ch".)
- **RDR-090** Chapter header — mono 11.5px uppercase t3 “Chapter {n} of {N}”; Arabic chapter title Amiri `36 × min(size,1.25)` px, line-height 1.3, `dir="rtl"`; English title 14px t2; “{n} passages” 12px t3; bottom border, padding-bottom 22.
- **RDR-091** Passage wrapper — `data-passage="{ci}.{pi}"`, column gap 10, padding 16 18 18, radius 12; "hot" (contains the selected token): `--card` bg, `--line` border, `--sh`; otherwise transparent.
- **RDR-092** Passage label row — mono 11.5px t3 label: the passage `ref` when present (“2:31”, “Bukhārī 71”, “{short} · 3”), else “Ch. {c} · passage {p}”; a hairline fills the rest of the row.
- **RDR-093** Passage block order — resume marker · label row · tools row · audio bar · Arabic line · grammar band · transliteration · translation · open drawer · inline notes · inline gloss (phone) · marks row.
- **RDR-094** Arabic line — `dir="rtl"`, flex-wrap, `column-gap: 7 × size px`, `row-gap: 16 × size px`, padding 2 0; one span per token (§8).
- **RDR-095** Transliteration line (pref) — the passage `tr` in IBM Plex Mono at `10.5 × min(size, 1.15)` px, t3, line-height 1.65, letter-spacing .01em. Passage-level only (no per-word transliteration).
- **RDR-096** Translation line (pref) — passage `en` at `13 × min(size, 1.2)` px, t2, line-height 1.6, `text-wrap:pretty`.
- **RDR-097** Chapter footer — “end of chapter {n}” 11.5px t3 centred between two rules.
- **RDR-098** Rendering — the whole chapter is rendered at once; no pagination or virtualisation.
- **RDR-099** Scroll helpers — `scrollToPassage` waits 110ms then smooth-scrolls the nearest actually-scrollable ancestor so the passage top sits 28px from the top; `scrollToEntry` does the same for lexicon articles with 12px; both debounce with clearTimeout.

### 8. Tokens and word states

- **RDR-100** Token data — raw string “surface|wordId|gram”; `gram` is free text such as “noun · genitive, definite” or “verb · Form II perfect + 2 pl. + 1 pl. obj.”; tokens without a wordId are plain text tokens.
- **RDR-101** Token typography — Amiri `27 × size` px, line-height 1.18, padding 2×4, radius 5; transition background .1s (disabled while audio is playing).
- **RDR-102** Function words — no entry and (stripped length ≤ 2 or in the stop-list): colour t2, not interactive.
- **RDR-103** Unknown-word candidates — no entry, stripped length > 2, not in the stop-list `و ف في من إلى على لا ما إن أن إلا ثم هو هي قال كان إنما كل هنا حين بين لم قد عن ذي`: t2, pointer, dashed underline (transparent until hover, then t3, offset 5×size px). Click opens the unknown-word popover (§10).
- **RDR-104** Interactive tokens — t1, pointer, underline offset `5 × size` px, thickness 1px (1.6px when related to the active root), underline colour transparent unless related (then `--c-root`); hover shows the underline in t3.
- **RDR-105** State "learning" (Word states on, token not selected) — background `#b45309` at 13%.
- **RDR-106** State "new" / no state (Word states on, not selected) — `box-shadow: inset 0 -2px 0` `--c-word` at 45%.
- **RDR-107** State "known" — no decoration.
- **RDR-108** Selected token — background ring 22% + `inset 0 -2px 0 var(--ring)`, t1.
- **RDR-109** Spoken token (passage audio) — background `--c-root` at 26%.
- **RDR-110** Starred words — no mark in the text. **SPEC≠CODE**: spec lists `starred` as a visible word state; in code a star is a separate `marks` map (§16 star button) and word states are only new / learning / known.
- **RDR-111** Active root — focus root if set; otherwise, when “Tint the root family” is on and a word is selected, that word's root.
- **RDR-112** Click on an interactive token — `select(wordId, "{ci}.{pi}.{ti}")`.
- **RDR-113** select() side effects, in order — write `jadhr-context`; push history (truncate forward, cap 30); if the word has no state set it to 'learning' and save; append to trail (skip if equal to last, cap 40 by dropping oldest); if a token key was given save progress `{ch, pi, at}` for this book; log the session; advance onboarding beat 0→1; close the unknown popover; set `sel`, `selTok`, mode 'word', clear panel search, clear hover, open panel, and on phone (when called from a token) drop the sheet to half height.
- **RDR-114** Auto-learning rule — a click never downgrades: 'known' stays 'known'. The only way back to 'new' is the hover card.
- **RDR-115** Tashkīl off — display strips U+064B–U+0652 and U+0670 (dagger alif) but not tatweel U+0640 (matching strips tatweel too and folds أ إ آ → ا).
- **RDR-116** Text size — header A−/A+ ±0.05 within [0.85, 1.6]; ⋯ menu “Text larger”/“Text smaller” ±0.1 within [0.8, 1.5]; label `round(size×100)%`. Scales token size, gaps, underline offset, paper width (cap 1.25), chapter title (cap 1.25), transliteration (cap 1.15), translation (cap 1.2). Panel and overlays do not scale. **SPEC≠CODE**: spec says floor 0.8, step 0.1 everywhere.

### 9. Hover card (desktop word preview)

- **RDR-117** Trigger — mouseenter on an interactive token; fixed position, x = token centre clamped to [160, innerWidth − 160], y = token top − 10, `transform:translate(-50%,-100%)` (always above; no flip when the token is near the top — **BUG**).
- **RDR-118** Box — 284px, padding 11×12, `--card`, `--line-2` border, radius 12, `--sh-open`, dcRise .12s, z 70.
- **RDR-119** Content — Arabic dictionary form Amiri 24; mono transliteration 11.5 t3; root in Arabic Amiri 15 `--c-root` letter-spaced at the right; English gloss 13px; this occurrence's gram string 11.5px t3.
- **RDR-120** State control — segmented “New” · “Learning” · “Known”; current segment: card bg with border `--c-word` / `#b45309` / `--good`; click writes the word state immediately.
- **RDR-121** Actions — “Full entry” (select with this token) and “Open in graph” (select, then open the graph hand-off sheet for the word).
- **RDR-122** Dismissal — leaving the token hides after 160ms; entering the card cancels the timer; leaving the card hides after 120ms; Esc; any selection clears it. No touch-specific path (on touch it may flash on tap).

### 10. Unknown-word popover (“no entry · analysed”)

- **RDR-123** Placement — fixed, x clamped to [200, innerWidth − 200], y = token top − 10, translate(−50%,−100%), width 360 (max `calc(100vw − 24px)`), padding 12×13, `--card`, `--line-2`, radius 12, `--sh-open`, dcRise .12s, z 70.
- **RDR-124** Header — surface form Amiri 24; amber label “no entry · analysed” (10.5px uppercase 600 `#b45309`); ✕ 22×22 with aria-label “Close”.
- **RDR-125** Segmentation — label “Segmentation”; RTL chips Amiri 21: stem (card bg, `--c-root` border), affixes (`--c-form` 12% fill, form-coloured text and 40% border); each chip's title is its gloss (e.g. “conj.”, “def. art.”).
- **RDR-126** Analysis line — “{affix glosses joined ' · ' — or the word's pos — or 'unanalysed'} · pattern {pattern}”.
- **RDR-127** Candidate roots — label “Candidate roots”; up to 3 rows: Arabic root Amiri 18 `--c-root`, root English gloss, mono score with two decimals; first row has a root-coloured border; click → select the first lexicon word of that root and set tab 'family'.
- **RDR-128** No candidates — “No root in the prototype lexicon matches this stem — propose it and it enters the review queue.”
- **RDR-129** Actions — “Propose entry” (primary; writes a proposal `kind:'entry'`, text “New entry for {surface}[ under {root}]”, why “Encountered in {book en}; analysed as {gram}”, wordId null; toast “Submitted for review”) and “Analyser →” linking to `Analyser?q={surface}`.
- **RDR-130** Also opened from Ask's “Analyse it anyway →” (centred horizontally, y 200).
- **RDR-131** Analyser heuristic: cleaning — strip `، . : ؛ ! ؟`; lexicon hit when the stripped surface equals a word, or equals it after removing `ال`, or after removing `(و|ف|ب|ل|ك)?ال`; if the surface is definite prefer a non-verb hit.
- **RDR-132** Analyser heuristic: prefixes (first match only, remainder must be > 1 letter) — وَ conj. · فَ conj. · بِ prep. · لِ prep. · كَ prep. · ال def. art. · سَ future · يُ impf. 3 m. · passive · يَ impf. 3 m. · تَ impf. 2/3 f. · نَ impf. 1 pl. · أَ impf. 1 sg. · مُ participle · مَ noun of place / pass. part. · اِسْتَ Form X.
- **RDR-133** Analyser heuristic: suffixes (first match only) — ُونَ m. pl. nom. · ِينَ m. pl. obl. · َاتِ f. pl. · َاتُ f. pl. · ُهُ + his · ُهَا + her · ُهُمْ + their · ِهِ + his · نِي + me · نَا + us · ةً f. acc. · ةٌ f. nom. · ةِ f. gen. · ةُ f. · ةَ f. · ً acc. indef. · ٌ nom. indef. · ٍ gen. indef. · َ acc. · ُ nom. · ِ gen. · ْ juss.
- **RDR-134** Analyser heuristic: root scoring — skeleton (stem minus ا و ي) equals the root → 0.92; all root letters present and stem ≤ root length + 3 → 0.7 − 0.05 × (length difference); two of three letters → 0.3; top 3; an exact lexicon hit is prepended at 0.99; dedupe by root; confidence = top score.
- **RDR-135** Analyser heuristic: pattern guess — the hit's pattern, else prefix مَ → مَفْعُول, مُ → مُفَعِّل, imperfect prefix (ي ت ن أ) → يَفْعَلُ, else فَعَلَ.

### 11. Grammar band, inline gloss, resume marker, progress hairline, inline notes, marks row

- **RDR-136** Grammar band (pref “Grammar band”, default off) — under each passage's Arabic line: dashed-border `--card-2` box, min-height 38, radius 8: the Arabic surface (Amiri 21) and mono 12px tag of the hovered token in this passage, else the selected token in this passage. Tag = gram, or “dictionary form” (entry without gram), or “particle / function word”. Empty copy: “Hover or select a word to see its inflection”. Dotted glossary terms are not applied here.
- **RDR-137** Inline gloss (phone only) — shown in a passage when narrow AND the selected token is in this passage AND the panel is closed: full-width `--card-2` button, dcPop: Arabic dictionary form Amiri 21, English gloss 13.5px, sub “{tr} · {gram or pos} · {root Arabic}”, a 32×32 “›” box; tap opens the panel. **SPEC≠CODE**: spec phrases it as "rather than opening the panel"; in code it only appears once the user has closed the sheet.
- **RDR-138** Resume marker — above the label row when the stored progress for this book has `ch` = current chapter, `pi` = this passage, `pi > 0`, and the passage is not hot: `--c-root` mono 10.5px uppercase row: 7px dot + “You stopped here · {locale date}” + 40%-opacity rule + “resume”.
- **RDR-139** Resume limits — progress is written only when a word in the text is clicked (not on scroll or dwell); there is no auto-scroll to the marker on return and no marker in the rail; passage 1 never shows it.
- **RDR-140** Progress hairline — absolutely positioned at the header's bottom edge (`bottom:-1px`), 2px tall, z 41, `pointer-events:none`, `--c-root` gradient width = (current chapter + 1) ÷ chapters. **SPEC≠CODE**: spec says top edge, `--ring`, fraction of the text read.
- **RDR-141** Inline notes — when a passage has notes and its Note drawer is closed: rows on `--card-2` with a 2px `--c-root` left border, radius 0 8 8 0, 12.5px t2: “Note ·” (t3) + body. **SPEC≠CODE**: spec calls these marginalia "shown in the margin on wide screens"; code shows them inline under the passage at all widths.
- **RDR-142** Marks row — under the passage, dotted-underlined 11.5px t3 buttons: “{n} link” / “{n} links” (title “Open the linked passages”) and one “Topic · {topic}” per topic (title “Open the topics”); each opens its drawer.

### 12. Passage tools and long-press

- **RDR-143** Tools row — under the label, min-height 28, wrap, gap 5. Two always-visible primary tools, then six secondary tools hidden until revealed.
- **RDR-144** Primary “Audio” — speaker icon; hint “Read the passage word by word” (or “Stop” while playing); active style while playing.
- **RDR-145** Primary “Roots” — branching icon; badge = number of distinct roots in the passage; hint “Every root this passage is built on”; opens the Roots drawer.
- **RDR-146** Secondary tools in order — “Related” (badge = related passages; hint “Passages standing on the same roots”), “Links” (badge = links; “Bind this passage to another by hand”), “Topic” (badge = topics; “Gather this passage under a topic”), “Copy” (“Copy this passage”), “Graph” (“Preview the graph this passage would build”), “Note” (badge = notes; “Write a note anchored to this passage”).
- **RDR-147** Tool button style — 11.5px, padding 3×7, radius 7, card bg, `--line` border, t3, nowrap; active (its drawer open or audio playing): ring 15% over card, ring border, t1; on phone 12.5px, padding 9×12, min-height 40. Mono 11px badge hidden when 0. 12px stroked icon, stroke 1.1, `aria-hidden`.
- **RDR-148** Reveal rule — revealed = (pointer over the passage OR the passage holds the selected token) AND NOT (phone AND not long-pressed AND not hot). Rendered with `display:contents` + dcFade .2s when revealed, `display:none` otherwise.
- **RDR-149** Long-press (phone) — touchstart starts a 420ms timer that sets `pressP` and `hoverP` to this passage; touchend or touchmove before 420ms cancels (so scrolling never reveals tools). Once revealed it stays until another passage is long-pressed. The passage containing the selected word always shows its tools.
- **RDR-150** Tool set vs spec — **SPEC≠CODE**: spec lists cite, note, concordance, analyse, copy; code has Audio, Roots, Related, Links, Topic, Copy, Graph, Note and no Cite/Concordance/Analyse on passages.
- **RDR-151** Drawer model — at most one open drawer per passage (same tool closes it, another tool swaps it); several passages may each have one open; not persisted; switching book clears all. Drawer style: column gap 6, top border, padding 11 0 3; caption 11px uppercase t3 .09em.
- **RDR-152** Copy — clipboard text “{Arabic tokens joined by spaces}\n{English}”; toast “Passage copied”. No reference is included.
- **RDR-153** Audio — simulated (no sound): highlights one token every `round(780 ÷ speed)` ms; row with a 24px ring-coloured round pause button (title “Pause”), 2px progress bar in `--c-root`, mono “word {i} / {n}”, and a speed button (title “Playback speed”) cycling “1×” → “0.75×” → “0.5×” → “1×” (speed persisted). Stops at the end or when Audio is pressed again; only one passage plays at a time.
- **RDR-154** Roots drawer — caption “Roots this passage is built on”; rows: Arabic root Amiri 19 `--c-root` (min-width 72), mono transliteration, English root gloss, mono “{n}× here · {corpus} in corpus”; title “Underline every word on this page grown from {tr}”; click toggles the focus root (row tinted root 12% when on).
- **RDR-155** Related drawer — passages of the base book (only) that share ≥ 1 root, sorted by number shared, top 4; caption “Passages built on the same roots” or “No other passage shares these roots”; row: mono ref, shared roots in Arabic joined “  ·  ” (`--c-root`), English, “Open” button (switches chapter only — no scroll, no book switch; wrong when another book is open — **BUG**).
- **RDR-156** Links drawer — caption “Passages you have linked to this one” / “Pick a passage to bind it to this one”; linked rows: mono ref, English (ellipsis), “Open”, “Unlink” (underlined t3); picker chips for every other base-book passage, mono label “{c}·{p}”, title “{ref} — {English}”, ring tint when linked; click toggles. Links are one-directional, stored on the source passage key `{ci}.{pi}` with no book namespace (**BUG**: collides across books).
- **RDR-157** Topic drawer — caption “Gather this passage under a topic”; fixed chips “Knowledge”, “Writing”, “Teaching”, “The library”, “Uprightness”; toggle on = `--c-root` 14% fill + root border; stored per passage key (no book namespace). No way to create a topic.
- **RDR-158** Graph drawer — caption “Graph preview · {r} roots · {p} patterns · {w} words” + mini button “Open in editor →” (opens the hand-off sheet with a passage seed); three columns: “Roots” (`--c-root`, Amiri 19, title “{tr} — {en}”), “Patterns” (`--c-form`, Amiri 17, title = pattern meaning), “Words” (`--c-word` buttons, Amiri 17, title “{tr} — {en}”, click selects the word); footnote with a green dot: “plus one passage card wired to every word above. The editor receives these as proposals you accept one by one.”
- **RDR-159** Note drawer — caption “Note on this passage”; existing notes as cards (left `--c-root` border): body 13px, locale date, “Delete” (hover `--bad`); textarea 3 rows, placeholder “Write here — @ to link a root, entry or lexicon (Notebook resolves links)”; footer “Private · anchored to {passage label}” + primary “Save note”. Save requires a non-empty trimmed body; toast “Note saved · see Notebook”; draft cleared. The draft is a single field shared by all passages (**BUG**).

### 13. Ask mode (the plain front door)

- **RDR-160** Container — `--canvas` bg, centred column, padding `clamp(24px,6vh,64px) 20px 80px`, gap 20, scrolls; replaces the reading column while on.
- **RDR-161** Heading — “What word are you wondering about?”; `clamp(24px,3.2vw,32px)`, weight 600, letter-spacing −.02em, centred, line-height 1.15, `text-wrap:pretty`.
- **RDR-162** Input — form `width:min(560px,100%)`, height 56, 1.5px `--ring` border, radius 14, card bg, ring-tinted glow shadow; leading “⌕” 18px t3; input `data-ask`, `dir="auto"`, Amiri/IBM Plex Sans 24px, aria-label “What word are you wondering about?”.
- **RDR-163** Placeholder — wide “a word, in Arabic, English, or how it sounds”; phone “a word…”.
- **RDR-164** Script hint — inside the input at the right, only when the query is non-empty: Arabic with harakat → “Arabic”; Arabic without → “Arabic · no vowels needed”; contains ā ī ū ʿ ʾ → “transliteration”; otherwise “English or how it sounds”. (The empty-query string “Arabic, English, or how it sounds” exists but is never displayed.)
- **RDR-165** Try row — “Try” + pill chips (Amiri/Plex 14px, `--card`, `--line`, hover ring): “علم”, “knowledge”, “3ilm”, “كتاب”, “مدرسة”; click fills the query and clears the pick.
- **RDR-166** Query normalisation — Arabic: strip tashkīl and tatweel, fold أ إ آ → ا, remove spaces. Latin "chat alphabet": `3`→ʿ, `2`→ʾ, `aa`→ā, `ii`→ī, `uu`→ū; lower-case.
- **RDR-167** Exact matches — normalised Arabic equals the word; or equal after dropping a leading ال on both sides; or transliteration equals the raw query or the chat form.
- **RDR-168** Loose matches — Arabic contains the query (≥ 2 letters); transliteration contains the chat form; English gloss contains the query; or a 3-letter Arabic query equals the root letters (returns the whole family).
- **RDR-169** Ranking — exact group first, then loose; inside each: non-verbs before verbs, then by frequency (rank = (verb ? 1 : 0) − min(0.9, freq ÷ 200)).
- **RDR-170** Matches row — when > 1 match and nothing picked: “{n} words match — pick one, or the first is shown:” + up to 6 pills (Arabic Amiri 17 + English 12px t3); the shown word's pill has a `--c-word` border. The first match's card renders immediately.
- **RDR-171** Submit (Enter) — picks the first match.
- **RDR-172** No match — “Nothing in the prototype's six root families matches “{q}”.” + inline link button “Analyse it anyway →” (leave Ask, open the panel, open the unknown-word popover with the analysis).
- **RDR-173** Desktop result card — `width:min(640px,100%)`, card bg, radius 16, `--sh-open`, dcRise .18s; four bands separated by rules.
- **RDR-174** Card band 1 — headword Amiri 46 `dir="rtl"`; English gloss 19px/600; sub 13px t3 “{tr} · {pos}[ · also: {second sense}]”; round 40px “▶” button, title and aria-label “Hear it”.
- **RDR-175** Card band 2 — “Built on the root {root Arabic Amiri 16 --c-root} — {root English, 500}. These are its cousins:” or “… It is the only word on this root in the prototype.”; up to 4 cousin chips (Arabic Amiri 20 `--c-word`, transliteration t3 + English t2); clicking a cousin replaces the query and shows that word (stays in Ask).
- **RDR-176** Card band 3 (only when attested) — label “Heard in”; one attestation: Arabic Amiri 22 line-height 1.7 + 12px t3 “{ref} — {English}”. Source order: first scripture occurrence, else the first passage in any loaded book containing the word. Exactly one, never a list.
- **RDR-177** Card footer (`--card-2`) — “Want more?” + primary pill “Go deeper — sources, shapes, timeline” (t1 fill, canvas text) + “Read a text with this word” + “☆ Save” / “★ Saved”.
- **RDR-178** Go deeper — leaves Ask and selects the word (panel opens on it in the user's panel mode).
- **RDR-179** Read a text with this word — leaves Ask, closes the panel, switches to the book and chapter of the first passage containing the word, scrolls to that passage. The token is not selected, so the passage is not highlighted.
- **RDR-180** Save — toggles the star (`marks[wordId]`), which feeds the review deck.
- **RDR-181** Pronunciation — `speechSynthesis` with lang `ar-SA`, rate 0.85, preferring any installed voice whose lang starts with `ar`; toasts “Audio is not available in this browser”, “No Arabic voice installed — using the default voice”, “Audio failed”.
- **RDR-182** Phone deck — horizontal rail, `scroll-snap-type:x mandatory`, hidden scrollbar; cards 86% wide, `scroll-snap-align:center`, min-height 300, padding 16×18, radius 18, `--sh-open`; four cards in fixed order; position dots below (active 18×6 t1, others 6×6 `--line-2`, width transition .15s) derived from `scrollLeft ÷ (clientWidth × 0.86 + 10)`; full-width primary button “Go deeper — the full entry” (min-height 44) under the dots.
- **RDR-183** Phone card 1 — cap “Meaning · 1 of 4”; Arabic Amiri 44; title = gloss; sub “{tr} · {pos}”; body “Also: {senses 2…n joined '; '}.” (empty with one sense); 44×44 “▶” (aria “Hear it”); action “☆ Save” / “★ Saved”.
- **RDR-184** Phone card 2 — cap “Cousins · 2 of 4”; root Arabic Amiri 32 `--c-root` letter-spaced; title = root gloss; sub “the root — three letters, one idea”; body “Words built on the same letters:” or “The only word on this root in the prototype.”; up to 3 rows (Arabic 19 `--c-word`, transliteration, English right; min-height 44) that switch the Ask word; action “See the whole family” → leave Ask, select, open the Word family layer and tab.
- **RDR-185** Phone card 3 — cap “Heard in · 3 of 4”; Arabic Amiri 22 line-height 1.8; title = ref or “No attestation yet”; sub = English or “The full corpora arrive with phase 2.”; ▶ speaks the passage; action “Read it in place” → leave Ask, close panel, go to the passage.
- **RDR-186** Phone card 4 — cap “The shape · 4 of 4”; pattern Arabic Amiri 36 `--c-form`; title = pattern meaning (e.g. “verbal noun”); sub “{pattern transliteration} · the mould this word was poured into”; body “Drop any root into this shape and you get a word with the same job. {n} words in the lexicon share it.”; action “Show me the shapes” → leave Ask, select, open the Shapes layer and tab.
- **RDR-187** Deck state **BUG** — the active-card index is not reset when the word changes (except via the cousin list, which sets it to 0 without scrolling the rail back), so dots and scroll position can disagree.
- **RDR-188** Not persisted — the Ask query, pick and card index are session-only.

### 14. Dictionary panel chrome

- **RDR-189** Phone grabber — first child on phone only: full-width 24px transparent button with a 44×4 `--line-2` pill, `cursor:grab`, `touch-action:none`; aria-label “Expand the dictionary sheet” / “Shrink the dictionary sheet”; tap toggles half/full; swipe rules in §30.
- **RDR-190** Top bar — back “‹” and forward “›” (24×24, 44×44 on phone; aria-labels “Back”/“Forward”; disabled at the ends, colour `--line-2`); title 13px/500 ellipsis: “Entry · {tr}” (word), “All entries” (index), else “Dictionary”; “Index” button (title “Browse every entry”; ring tint when index mode; min-height 44 on phone); “✕” (aria-label and title “Hide the panel”; 26×26, 44×44 on phone).
- **RDR-191** History — array of word ids capped at 30 with a pointer; a new selection truncates forward history; back/forward set the word, mode 'word' and clear the selected token.
- **RDR-192** Panel search — `type="search"`, placeholder “Arabic (with or without tashkīl), transliteration or English…”, aria-label “Look up a word or a root”, 13.5px, radius 9, ring border on focus.
- **RDR-193** Panel search results — absolute dropdown 40px below, max-height 320 scroll, `--line-2` border, `--sh-open`; up to 9 rows: Arabic Amiri 19 (min-width 76), English 12.5 ellipsis, mono “{tr} · {pos}”, root transliteration at right. Matching: tashkīl-stripped Arabic contains (hamza not folded here, unlike Ask/omnibox), transliteration contains, English contains, root transliteration contains, root letters contain. Selecting clears the query; Esc clears the query. No arrow-key navigation, no empty-result message.
- **RDR-194** Empty-mode body — title “Tap any word in the text” (14.5px/500); paragraph “Nearly every word is an entry. Opening one shows its root, the family of words built on that root, what the classical lexica say, and where it occurs in this book — and hands the whole family to the graph editor in one step.”; legend of 9px dots “root”, “pattern”, “word”, “passage”; rule; label “Start from a root”; chips for all six roots (Arabic Amiri 17 spaced + mono transliteration, title = root gloss) → select the root's first word and set tab 'family'.
- **RDR-195** Index-mode body — one group per root with a sticky header (`--panel` bg): Arabic root Amiri 16, mono transliteration, “{n} entries”; rows: Arabic Amiri 19 (min-width 92, right-aligned), part of speech 12px t3, English 12.5px ellipsis, mono tabular frequency; click selects. Root-grouped only. **SPEC≠CODE**: spec says “A–Z / root index”.
- **RDR-196** Word header — Arabic headword Amiri 40; mono transliteration 12.5px t2; chips (11px uppercase 600, 14% tint of the colour): part of speech (`--c-word`), pattern transliteration e.g. “faʿala” (`--c-form`), “{freq} in corpus” (`--c-desc`); English gloss 16px line-height 1.5.
- **RDR-197** Root chip — button with root tint 12% and 40% border: Arabic root Amiri 17 spaced + mono transliteration; title “Open the root family for {tr}”; beside it the root's English gloss (12px t3). Click only sets tab 'family' — in layers mode it neither opens nor scrolls to Word family (**BUG**).
- **RDR-198** Word actions — “Open in graph editor” (flex 1, graph icon, title “Seed the graph editor with this word's family”), “Cite” (title “Cite or share this entry”), star button 34px “☆” / “★” (title “Save to your list” / “Remove from your list”, `--c-root` border and text when on). All ≥ 44px on phone.
- **RDR-199** Unused in template — `copyWord` (clipboard “{ar} ({tr}) — {en}\nRoot {root ar} · {root tr}\n1. …”, toast “Entry copied”) and a Layers/Tabs segmented control (`panelModes`) are defined but never rendered.
- **RDR-200** Tab strip (tabs mode only) — `role="tablist"`, horizontal scroll with hidden scrollbar; six `role="tab"` buttons with `aria-selected` and a mono count badge: “Senses”, “Family”, “Patterns”, “Lexica”, “Sources”, “Usage”; ArrowLeft/ArrowRight cycle with wrap-around and move focus; active tab `--card` bg, `--line-2` border, t1/500; phone padding 11×10, min-height 44. No `aria-controls`/`tabpanel`.
- **RDR-201** Tab counts — Senses = senses; Family = words on the root; Patterns = distinct patterns used by the family; Lexica = dictionaries switched on; Sources = shown dictionaries that attest any sense + scripture occurrences; Usage = occurrences in the base book.
- **RDR-202** Scroll body — padding 14, gap 8 (layers) or 14 (tabs); order: trail breadcrumb, trail map, then the sections.

### 15. Layered panel mechanics

- **RDR-203** Default mode — layers: six collapsible cards in one continuous scroll. Tabs mode renders only the active section, without section heads, with section wrappers set to `display:contents`.
- **RDR-204** Section card — `--card`, `--line` border, radius 12, overflow hidden; head button (aria-expanded): title 13.5px/500, meta 11.5px t3, chevron “▾” rotating −90° when closed (.15s); padding 11×14, or 14×14 with min-height 48 on phone; body padding 0 14 14, gap 14.
- **RDR-205** Default open set — Meanings and Word family open, the other four closed; per-section open state persisted as `layerOpen = { senses, family, patterns, lexica, timeline, usage }`.
- **RDR-206** Never-empty rule — at render, if every section is closed, Meanings is forced open (a fully-folded panel reopens Meanings).
- **RDR-207** Rendered order of layer cards — Meanings · Word family · Old dictionaries · Across the centuries · Shapes (patterns) · In this text. **SPEC≠CODE**: spec and the tab strip use Meanings · Word family · Shapes · Old dictionaries · Across the centuries · In this text; pick one order for both.
- **RDR-208** Section titles and meta — “Meanings” · “{n} sense(s)”; “Word family” · “{n} words · {k} shapes”; “Shapes (patterns)” · “{k} on this root”; “Old dictionaries” · “{n} say something”; “Across the centuries” · “timeline · scripture”; “In this text” · “{n} place(s)”. Tab labels differ: Senses, Family, Patterns, Lexica, Sources, Usage.
- **RDR-209** Cross-links into a section — Where-next doors, term-card jumps and Ask cards set both `layerOpen[k] = true` and `tab = k`, so they work in both modes, but nothing scrolls the panel to the opened section.
- **RDR-210** Tab-only links (**BUG** in layers mode) — root chip, omnibox root/pattern rows, “Start from a root”, timeline dictionary dots (→ lexica) and scripture sibling chips (→ timeline) set only `tab`, so in layers mode they have no visible effect when that section is folded.

### 16. Meanings section

- **RDR-211** Tabs-mode sub-label — “Senses” with a rule (layers mode uses the section head instead).
- **RDR-212** Sense row — card bg, radius 10, padding 10×12, `--line` border (dashed `#b45309` when the user has a pending edit on it); mono “01” number; English sense 15px line-height 1.55; Arabic definition line (IBM Plex Sans Arabic 15, t2, `dir="rtl"`, line-height 1.8) only on sense 1 = “{arDef}.”; meta 11px.
- **RDR-213** Sense meta copy — pending edit: “your edit pending review · {locale date}” (amber); merged edit: “edited by {by} · reviewed · sources: {up to 3 dictionary names}”; otherwise “reviewed · sources: {up to 3 dictionary names}” (the dictionaries mapped as attesting that sense, in date order).
- **RDR-214** Merged edits — the newest merged proposal (`kind:'edit'`, same wordId and senseIdx, by ts) replaces the sense text; this is the credit line.
- **RDR-215** Added senses — proposals `kind:'sense'` for this word with status pending or merged are appended after the real senses with continued numbering: meta “added by {by} · reviewed” (merged) or “proposed by {by} · pending review” (amber, dashed border, opacity .9); their Suggest button does nothing.
- **RDR-216** “Suggest an edit” — per sense, title “Propose a change to this sense”, 11px (12px with min-height 40 on phone), opens the suggest dialog (§23).
- **RDR-217** “Where next?” block — rendered here, after the senses (§24). **SPEC≠CODE**: spec says every entry ends with it; in code it lives inside Meanings, so it disappears when Meanings is folded and appears only on the Senses tab in tabs mode.
- **RDR-218** Contribution buttons — “+ Propose a sense” and “Report an error” (12px, card bg, line border).
- **RDR-219** Disclaimer — “Editorial summary written for this prototype — placeholder wording, not any lexicon's text.”
- **RDR-220** “Grammar here” block — label + rule; card: surface form Amiri 22 (the selected token's surface, else the dictionary form); gram line with dotted glossary terms: the selected occurrence's gram, else “dictionary form”, else “dictionary form — no passage selected”; blank while any hover card is open; ref line “as it appears in chapter {c}, passage {p}” or “select the word in the text to see its inflection”. The gram lookup only works for base-book occurrences (**BUG** for scripture and pasted books).

### 17. Word family section

- **RDR-221** Root card — Arabic root Amiri 30 `--c-root` letter-spacing .08em; mono transliteration; button “Graph the root” (title “Seed the graph with this whole root”); root English gloss 13.5px; Arabic gist “يدلُّ على {arGist}.” in IBM Plex Sans Arabic 13.5px `dir="rtl"`.
- **RDR-222** “Graph the root” wiring — calls the same word seed as “Open in graph editor”; there is no root-only seed (**BUG**/gap).
- **RDR-223** Patterns on this root — label “Patterns on this root”; one card per distinct pattern in the family (order of first appearance in the lexicon): header on `--card-2` with the pattern Amiri 19 `--c-form`, mono transliteration, and the pattern meaning right-aligned with dotted glossary terms; body: word chips (Arabic Amiri 19 + English 11.5px; current word: ring 14% fill + ring border; title “{tr} — {en}”) → select.
- **RDR-224** Same pattern, other roots — label “Same pattern, other roots”; note “Other roots poured into {pattern transliteration} — the pattern carries its own meaning across the lexicon.”; chips for every lexicon word with the current word's pattern on other roots (same chip style) → select.
- **RDR-225** Spec wording — **SPEC≠CODE**: spec says "group headers carry dotted plain-language terms" (true) and "a plain-language description of what that pattern does" (only the short FORM_META label such as “noun of place”, not a sentence).

### 18. Shapes (patterns) section

- **RDR-226** Mode control — segmented “This root” / “This pattern” (session only).
- **RDR-227** This root header — Arabic root Amiri 28 `--c-root`, mono transliteration, “{k} of 21 patterns attested”.
- **RDR-228** This root table — one row per FORM_META pattern (21), attested rows only by default: pattern button Amiri 18 `--c-form` (title “Every word on this pattern, across roots”; click switches to This pattern on it); mono transliteration; meaning 11.5px with dotted terms; right cell = the family word on that pattern (Arabic 20 + English 11; the current word highlighted with ring) → select; unattested rows show italic “not attested” at opacity .6.
- **RDR-229** One word per pattern — if two family words share a pattern, the row shows only the first (**BUG**/gap).
- **RDR-230** Unattested toggle — “Show all 21 patterns” / “Hide unattested patterns” (session only).
- **RDR-231** This pattern view — pattern Arabic Amiri 36 `--c-form` + mono transliteration; note with dotted terms “{meaning} — {n} words across {k} roots in the lexicon.”; chips “All roots” / “In this book” (book = base-book occurrences); rows: Arabic Amiri 21 `--c-word` (min 96), English 12.5px, mono “{tr} · {pos}[ · {n} in this book]”, root Arabic `--c-root` at right; current word row tinted ring 10%; click selects.
- **RDR-232** Pattern choice — This pattern shows the last chosen pattern, else the current word's pattern. The spec describes only the root table; the This pattern view is an addition in code.

### 19. Old dictionaries section

- **RDR-233** Mode control — segmented “One by one” (list, default) · “Side by side” · “Apparatus”; persisted `lexMode`. **SPEC≠CODE**: spec names them list / side-by-side / apparatus.
- **RDR-234** One line from each — label “One line from each”; bordered list of all nine dictionaries (ignores the shown toggles): English name 12px/500 (min 96), mono “d. {year}”, one-line gist (placeholder: sense i mod n), title “Jump to this entry”; click → filter All, expand that article, scroll to it.
- **RDR-235** Classical lexica header — label “Classical lexica” + rule + “by compiler death date”.
- **RDR-236** Filter chips (list mode only) — “All 9”, “Earliest {n}”, “General {n}”, “Root-semantic {n}”, “Interpretive {n}”, “English {n}”; counts over shown dictionaries; chips with 0 drop to opacity .45 but stay clickable; selected chip ring tint; not persisted. “All 9” stays “9” even when dictionaries are hidden (**BUG**).
- **RDR-237** Filter kinds — earliest = Kitab al-Ayn; general = Tahdhib, Sihah, Lisan, Qamus, Taj; root-semantic = Maqayis; interpretive = Mufradat; english = Lane.
- **RDR-238** Article header — `data-lex="{dictId}:{wordId}"`, top border `--line-2`; Arabic dictionary name Amiri 19; English name 13px/500; tag pill (11px uppercase 600, `--card-2`): earliest, general, selective, root-semantic, interpretive, comprehensive, concise, encyclopedic, english; “{author} · d. {year}” 12px t3.
- **RDR-239** Article actions — “+” 26×26 (title “Add this entry to the graph as a description card”, aria-label “Add to graph”) → toast “{dict} queued as a description card” (no real effect); “⧉” (title and aria-label “Copy this entry”) → copies the article text, toast “{dict} entry copied”.
- **RDR-240** Article body — Arabic articles `dir="rtl"` IBM Plex Sans Arabic 14 line-height 2.0; Lane `dir="ltr"` IBM Plex Sans 13 line-height 1.6; t2; collapsed to max-height 118px with a 46px fade to `--panel` when it overflows (overflow measured after render). **SPEC≠CODE**: 02 says dictionary text is Amiri; code uses IBM Plex Sans Arabic.
- **RDR-241** Show more — “Show more · {chars} characters · ~{words} words” / “Show less”, shown only when overflowing or expanded; expanded state per article id (session only).
- **RDR-242** Article footer — right-aligned “placeholder entry · dummy data for layout”.
- **RDR-243** Spec fields satisfied — every article shows the Arabic name, English name, author and death date as the spec requires, plus a tag pill.
- **RDR-244** Side by side: chips — all nine dictionaries (on = root 14% tint + root border); max three; adding a fourth drops the oldest (FIFO); default `['ayn','sihah','lisan']`; persisted `cmp`.
- **RDR-245** Side by side: grid — columns “Sense” (110px) + one per chosen dictionary (header: English name 12px/600, “{author} · {year}”); one row per sense: English sense + agreement note “all agree” (`--good`), “none of these” (amber), “{dict} only” (amber), or the last word of each agreeing dictionary's name joined “ · ” (t3).
- **RDR-246** Side by side: cells — the Arabic wording when available (sense 1 = “{headword}: {arDef}.”; other senses only if `arSenses` exists) in IBM Plex Sans Arabic right-aligned; otherwise the English sense in italic with `direction:ltr; text-align:left`; absent = “—” in `--line-2`; a cell present in only one chosen column is tinted root 12%.
- **RDR-247** Side by side: legend — tinted square + “text unique to that lexicon · italic = editorial English gloss where the lexicon's Arabic wording is not yet transcribed”.
- **RDR-248** Apparatus: base — label “Base” + chips for the last four non-English dictionaries (Mufradat al-Quran, Lisan al-Arab, al-Qamus al-Muhit, Taj al-Arus); default Lisan al-Arab (not persisted); “against 8 others”.
- **RDR-249** Apparatus: text — one RTL paragraph (IBM Plex Sans Arabic 15, line-height 2.15) of the base's attested senses as spans, each with a 12% tint and 2px underline in its agreement colour, followed by a mono superscript number; English fallback spans are `direction:ltr; unicode-bidi:isolate`, italic IBM Plex Sans 13.
- **RDR-250** Apparatus: agreement colour — shared by ≥ 60% of the other 8 (i.e. ≥ 5) → `--good`; 1–4 → `#b45309`; 0 → `--bad`.
- **RDR-251** Apparatus: notes — per span: coloured number, English sense, “{share} / 8”, and “Also in {names}.” or “Unique to {base} — this sense first appears here.”
- **RDR-252** Apparatus: legend — “■ shared by most”, “■ 1–2 others”, “■ unique to base”. The middle label disagrees with the rule (amber covers 1–4) (**BUG**).
- **RDR-253** Sense-to-dictionary mapping — deterministic placeholder (`dictAttests`: sense 1 always attested; others by a modulo hash). Real per-sense alignment data is required before any of list gists, compare, apparatus, timeline or cite sources can be truthful.

### 20. Across the centuries section

- **RDR-254** Mode control — segmented “Lanes” / “Streams” (session only, default Lanes) + mono meta “{n} lexica · 3 corpora · {s} senses”.
- **RDR-255** Legend — round `--c-root` dot “lexicon entry (compiler d.)”; square `--c-sentence` “corpus attestation”.
- **RDR-256** Axis — linear 550–1920 CE; ticks at 600, 800, 1000, 1200, 1400, 1600, 1800 (last labelled “1800 CE”), mono 10.5px with a left rule. Matches the spec's 550–1920 range; there is no tick beyond 1800.
- **RDR-257** Corpora (fixed) — “Pre-Islamic poetry” 580, “Qurʾān” 632, “Ṣaḥīḥ al-Bukhārī” 846; which sense each attests is a placeholder hash (`corpusAttests`).
- **RDR-258** Lanes — one row per sense: mono “01” + sense text; 20px track with a grey span from earliest to latest source; corpus squares 11px at the corpus year (title “{corpus} · attested (placeholder)”; click toast “{corpus} — corpus attestations arrive with phase 2”); dictionary circles 13px `--c-root` with a card-coloured ring at the death year (title “{dict} · {author} · d. {year}”; hover scale 1.35; click → tab lexica, filter All, expand and scroll to that article); meta “{n} lexica · {m} corpus source(s) · first in {dict} ({year})”.
- **RDR-259** Streams — 250px stacked-area SVG (viewBox 100×100, `preserveAspectRatio="none"`); samples at 550, each corpus year, each shown dictionary's year and 1920; band thickness = cumulative number of sources attesting that sense by that year; band colours cycle `--c-root`, `--c-form`, `--c-word`, `--c-sentence`, `--c-desc` at .82 opacity.
- **RDR-260** Streams labels — at each band's right end “{n} · {sense}” white 11.5px/500 with text-shadow, hidden when the band is < 6% tall; title “{sense} — {n} sources by 1900”; click → Lanes. Corpus marks across the top (green, stacked 16px apart); every other shown dictionary labelled at the bottom “{name without al-/Kitab } {year}”; tick axis below.
- **RDR-261** Streams caption — “Band height is the number of sources attesting a sense at that date — not frequency of use. Click a band to see its senses in the lane view.”
- **RDR-262** Shared caption — “Which lexicon carries which sense is a placeholder mapping until entries are aligned; the dates are real. Click a dot to open that entry.”
- **RDR-263** In scripture: filters — label “In scripture”; chips “All {n}”, “The Qurʾān {n}”, “Ṣaḥīḥ al-Bukhārī {n}” (ring tint when on; changing it clears the form filter); meta “{n} attestation(s)”.
- **RDR-264** In scripture: form chips — label “Form in text” + one chip per distinct surface form in the filtered occurrences with its count (Amiri 15, `dir="rtl"`; on = `--c-word` border); toggles a filter.
- **RDR-265** In scripture: rows — card: mono ref (“2:32”), chapter label (“al-Baqara · 2”), button “Open in reader” (switch book and chapter, scroll to the verse); full verse Arabic Amiri 22 line-height 1.9 right-aligned; English; gram line 11.5px t3.
- **RDR-266** In scripture: empty — “No attestation in the selected text.” (the word occurs elsewhere) or “Not attested in the loaded scripture samples — the full Qurʾān and Ṣaḥīḥ al-Bukhārī arrive with phase 2.”; plus “Attested on this root” chips for same-root words that do occur (“{ar} {n}”, `--c-word`) → select that word + tab timeline.
- **RDR-267** Spec placement — **SPEC≠CODE**: spec puts “sibling attestations from other texts” in *In this text*; code puts them here under In scripture.

### 21. In this text section

- **RDR-268** Note — “{n} occurrence(s) of {ar} in this book, with the inflection recorded for each.”
- **RDR-269** Occurrence card — mono “Ch. {c} · passage {p} · {gram}”; “Go to passage” (title “Scroll the page to this passage”; sets the chapter, selects that token, clears the focus root, scrolls); “Graph” (title “Seed the graph with this passage”; opens the hand-off sheet with sub “This passage becomes one sentence card linked to every token it uses.” and rows Sentence / Word / Root); full passage Arabic Amiri 21 line-height 1.9; English 12.5px.
- **RDR-270** Empty — “This word is in the lexicon but does not appear in the sample text.”
- **RDR-271** **BUG** — occurrences come from the base book only but are indexed into the currently open book, so with the Qurʾān sample open the cards show the wrong passages (or fail). Occurrences must be computed per open text.

### 22. Plain-language layer (Explain terms)

- **RDR-272** Control — “Explain terms” in Reading preferences (default on, `explainOff` persisted) and “Stop explaining terms” on the term card. **SPEC≠CODE**: spec calls it a header toggle; there is none in the header.
- **RDR-273** Detection — one case-insensitive global regex of all glossary keys, sorted longest first, metacharacters escaped, wrapped in `\b…\b`; `lastIndex` reset before each run; text split into plain runs and term runs.
- **RDR-274** Where terms are dotted (code) — pattern meanings in Word family group headers, the Shapes root-table meanings, the Shapes pattern note, and the “Grammar here” gram line. **SPEC≠CODE**: spec also lists the entry meta line, the passage grammar band, the lexica and the analyser — none are wired.
- **RDR-275** Term style — inline `<button>` with `border-bottom:1.5px dotted var(--ring)`, ring-coloured text, `cursor:help`, transparent background, inherits font; click stops propagation.
- **RDR-276** Term card box — fixed, width 320 (max `calc(100vw − 24px)`), padding 12×14, background `#16161a` and white text in both themes, radius 12, shadow `0 12px 30px -12px rgba(0,0,0,.5)`, dcRise .12s, z 72; `role="dialog"`, aria-label “Term explanation”.
- **RDR-277** Term card position — x = term centre clamped to [170, innerWidth − 170] with translateX(−50%); placed 8px below the term, or 8px above (translateY(−100%)) when term bottom + 150 > innerHeight.
- **RDR-278** Term card content — title 13.5px/600; “{category} term” 11px at .7 opacity; ✕ (aria-label “Close”); body 13px line-height 1.55 at .92 opacity; jump pill (white 14% fill) when the entry has a target; outline pill “Stop explaining terms”.
- **RDR-279** Jump labels — patterns → “Show me the shapes”; lexica → “Show the dictionaries”; timeline → “Show where it appears”; family → “Show the family”; senses → “Show the meanings”. Jump closes the card, opens that layer, sets the tab and opens the panel; it does not scroll to the section. **SPEC≠CODE**: spec says it "opens and scrolls".
- **RDR-280** Dismissal — ✕ or Esc; no outside-click close.
- **RDR-281** Glossary size — 29 entries (spec says ~30); categories used: grammar, writing, sources, meaning. Gaps: no entry for Form III (used by “Form III verbal noun”), noun of quality, intensive noun, participle, stative, causative, definite/indefinite, jussive; the “lexicon” body says 8th–14th centuries although Tāj (1791) and Lane (1893) are listed.
- **RDR-282** Term `root` — “Root” · grammar · “Three (sometimes four) consonants that carry a core idea. Arabic builds whole families of words from one root by pouring it into different shapes.” · jump family.
- **RDR-283** Term `pattern` — “Pattern (wazn)” · grammar · “A mould. Drop a root into it and you get a word with a predictable job — the doer, the thing done, the place, the tool. Scholars call it a wazn.” · jump patterns.
- **RDR-284** Term `wazn` — “Wazn” · grammar · “The Arabic word for pattern — literally “weight” or “measure”. Same thing as pattern here.” · jump patterns.
- **RDR-285** Term `form i` — “Form I” · grammar · “The plain verb: “he wrote”, “he knew”. Every other verb form is a variation on it.” · jump patterns.
- **RDR-286** Term `form ii` — “Form II” · grammar · “A verb made stronger or made to cause something: from “know” you get “teach” (make someone know).” · jump patterns.
- **RDR-287** Term `form iv` — “Form IV” · grammar · “A verb that makes something happen: from “to be safe” you get “to submit / to make safe”.” · jump patterns.
- **RDR-288** Term `form v` — “Form V” · grammar · “A verb turned on oneself: from “teach” you get “learn” (get yourself taught).” · jump patterns.
- **RDR-289** Term `form x` — “Form X” · grammar · “A verb of asking or seeking: from “know” you get “to enquire”.” · jump patterns.
- **RDR-290** Term `active participle` — “Active participle” · grammar · “The word for the one who does it. From “write” you get “writer”; from “know”, “one who knows”. Usually looks like فَاعِل.” · jump patterns.
- **RDR-291** Term `passive participle` — “Passive participle” · grammar · “The word for the thing something was done to. From “write” you get “written”; from “know”, “known”. Usually looks like مَفْعُول.” · jump patterns.
- **RDR-292** Term `verbal noun` — “Verbal noun (maṣdar)” · grammar · “The idea of the action as a thing: writing, knowing, learning. Scholars call it the maṣdar.” · jump patterns.
- **RDR-293** Term `maṣdar` — “Maṣdar” · grammar · “The idea-word of a verb — “writing” from “to write”. English calls it a verbal noun.” · jump patterns.
- **RDR-294** Term `noun of place` — “Noun of place” · grammar · “Where the action happens: from “write” you get “desk / office”; from “sit”, “council”.” · jump patterns.
- **RDR-295** Term `perfect` — “Perfect” · grammar · “The done form of a verb — “he wrote”. Not about perfection; it just means finished.” · no jump.
- **RDR-296** Term `imperfect` — “Imperfect” · grammar · “The ongoing form — “he writes / is writing”. Unfinished, hence the name.” · no jump.
- **RDR-297** Term `accusative` — “Accusative” · grammar · “The ending a noun takes when it is the object of an action — the thing being written, known, seen. Often a fatḥa or -an.” · no jump.
- **RDR-298** Term `nominative` — “Nominative” · grammar · “The ending a noun takes when it is the doer or the subject — usually a ḍamma.” · no jump.
- **RDR-299** Term `genitive` — “Genitive” · grammar · “The ending after “of” or after a preposition — usually a kasra.” · no jump.
- **RDR-300** Term `tashkīl` — “Tashkīl” · writing · “The small marks above and below letters that show the short vowels. Most everyday Arabic leaves them out.” · no jump.
- **RDR-301** Term `lexicon` — “Lexicon” · sources · “A dictionary — here, one of the great classical Arabic dictionaries, written between the 8th and 14th centuries.” · jump lexica.
- **RDR-302** Term `lexica` — “Lexica” · sources · “Dictionaries — the plural. This site lines up several classical ones so you can see where they agree.” · jump lexica.
- **RDR-303** Term `attestation` — “Attestation” · sources · “A real place where the word actually appears — a verse, a saying, a line of a book. Evidence, not opinion.” · jump timeline.
- **RDR-304** Term `apparatus` — “Apparatus” · sources · “A view that shows one dictionary’s wording and marks which parts the others share. Borrowed from how scholars compare manuscripts.” · jump lexica.
- **RDR-305** Term `concordance` — “Concordance” · sources · “A list of every place a word appears, each shown with a few words on either side.” · no jump.
- **RDR-306** Term `sense` — “Sense” · meaning · “One meaning of a word. “Knowledge” and “a mark, a sign” are two senses of the same root.” · jump senses.
- **RDR-307** Term `gloss` — “Gloss” · meaning · “A short translation or explanation of a word.” · no jump.
- **RDR-308** Term `transliteration` — “Transliteration” · writing · “Arabic written in Latin letters so you can read the sound — ʿilm, kitāb.” · no jump.
- **RDR-309** Term `corpus` — “Corpus” · sources · “A body of texts that has been searched and counted — here, the texts loaded into the reader.” · no jump.
- **RDR-310** Term `diacritics` — “Diacritics” · writing · “Another word for tashkīl — the vowel marks.” · no jump.

### 23. Suggest an edit, propose a sense, report an error

- **RDR-311** Entry points — per-sense “Suggest an edit” (`kind:'edit'`, current = the sense text, wording prefilled with it); “+ Propose a sense” (`kind:'sense'`, current “(new sense)”, wording empty); “Report an error” (`kind:'error'`, current “{headword} — {gloss}”, wording empty). The unknown-word popover's “Propose entry” writes `kind:'entry'` directly without the dialog.
- **RDR-312** Dialog frame — scrim `rgba(10,10,16,.4)` (click closes), centred card 440px (max 100%), padding 18, gap 12, radius 14, `--line-2`, `--sh-open`, dcPop .12s, z 95. No `role="dialog"`, no aria-label, no focus management (**gap**).
- **RDR-313** Title — “Suggest an edit · sense {NN}” (two-digit) / “Propose a new sense” / “Report an error”.
- **RDR-314** Field “Current” — read-only box on `--card-2` with the current text.
- **RDR-315** Field “Your wording” — textarea 3 rows, resizable vertically, ring border, 13.5px.
- **RDR-316** Field “Why · source *” (red asterisk) — input, placeholder “e.g. Lisān s.v. ع ل م gives … as the primary gloss”.
- **RDR-317** Source chips — the first six dictionaries (Kitab al-Ayn, Tahdhib al-Lugha, al-Sihah, Maqayis al-Lugha, Mufradat al-Quran, Lisan al-Arab) as toggles (on = `--c-root` border); Qāmūs, Tāj and Lane are not offered.
- **RDR-318** Validation — “Submit for review” is enabled only when the wording is non-empty AND (the why field is non-empty OR at least one source chip is on). **SPEC≠CODE**: spec says "a required rationale"; code accepts sources alone. No check that an edit actually differs from the current text.
- **RDR-319** Buttons — “Cancel” (flex 1) and “Submit for review” (flex 2; primary t1 fill when valid, else `--card-2` + t3 with default cursor and `disabled`).
- **RDR-320** Footnote — “Only you see this until two reviewers approve. Track it in the review queue.” with “review queue” linking to the Review Queue page.
- **RDR-321** Submission record — appended to `jadhr-proposals`: `{ id:'p'+timestamp, status:'pending', by:'you', ts, kind, wordId, wordAr, senseIdx, current, text, why, sources:[dictIds] }`; dialog closes; toast “Submitted for review”.
- **RDR-322** Pending display — the sense row turns dashed amber with “your edit pending review · {date}”; pending new senses appear as extra numbered senses.
- **RDR-323** Merge display (credit line) — merged edit text replaces the sense with meta “edited by {by} · reviewed · sources: …”; merged new sense shows “added by {by} · reviewed”.
- **RDR-324** Cross-tab freshness — proposals are re-read from storage on every window `focus`, so a merge in the Review Queue tab appears without reload.
- **RDR-325** Two-approval rule — enforced in the Review Queue page, not here; the Reader only reads statuses `pending` / `merged` (other statuses such as approved/declined are ignored).

### 24. Curiosity trails (Where next, breadcrumb, trail map)

- **RDR-326** Trail data — `jadhr-trail` array of `{ kind:'word', id, ts }`; appended on every select and on `?w=` when the id differs from the last step (consecutive duplicates skipped, non-consecutive repeats kept); capped at 40 by dropping the oldest.
- **RDR-327** Where next header — uppercase “Where next?” + rule + 11.5px t3 meta “{n} word(s) · {k} root(s)” (distinct words and roots in the whole trail).
- **RDR-328** Where next grid — `repeat(auto-fit, minmax(150px, 1fr))`, gap 8; door card: padding 10×12, `--line` border with a 3px top border in the door colour, radius 10; cap 10.5px uppercase 600 in the door colour; Arabic (Amiri/Plex 19, `dir="auto"`); why 11.5px t2. At most three doors, in this order.
- **RDR-329** Door 1 “A cousin” (`--c-word`) — the first same-root word that is not the current word and not yet in the trail, else the first same-root word other than the current; why “{gloss} — same root, same shape” or “{gloss} — same root, shaped as {pattern meaning, lower-case}”; click selects it.
- **RDR-330** Door 2 “A verse” (`--c-sentence`) — when the word has a scripture occurrence: Arabic slot shows the ref (e.g. “2:32”), why = “{first 70 chars of the English}…” in curly quotes; click opens the Across the centuries layer/tab with the scripture filter set to that book.
- **RDR-331** Door 2 fallback “In the text” (`--c-sentence`) — otherwise the first passage in any loaded book containing the word: Arabic slot shows the ref, why = first 80 chars of the English; click switches book and chapter, keeps the panel open on desktop (closes it on phone), scrolls to the passage.
- **RDR-332** Door 3 “The shape” (`--c-form`) — Arabic slot shows the pattern; why “{pattern meaning}[ — {n} more like it: {up to 3 words joined '، '}]”; click opens the Shapes layer/tab in This pattern mode on that pattern.
- **RDR-333** Breadcrumb visibility — only when a word is open AND the trail holds ≥ 2 distinct word ids; placed at the top of the panel scroll body (above the sections), not in the fixed header.
- **RDR-334** Breadcrumb content — “Trail” + the last 6 steps as transliterations (`dir="auto"`, 12px), separated by “›” (`--line-2`); the last step t1/500, earlier t3; right-aligned toggle “Map · {trail length incl. repeats}” / “Hide map” (11.5px bordered).
- **RDR-335** Breadcrumb click — truncates the trail right after the clicked step, saves it, and selects that word (select does not re-append because it equals the last step).
- **RDR-336** Trail map drawer — bordered card (radius 12); 260px canvas with a 16px dot-grid background; the last 8 steps as absolutely placed node buttons in rows of 3 (x = 10 + col×120, y = 12 + row×78, width 110), each: uppercase “word” type label, mono step number, Arabic Amiri 17, “{tr} · {gloss}” 10.5px ellipsis; border 1.5px `--c-word`, dashed for the current (last) node; title “Back to {tr}”; click = truncate + select.
- **RDR-337** Trail map edges — SVG lines between consecutive node centres, stroke 1.3: `--c-root` when both steps share a root, `--line-2` otherwise; the last edge dashed “4 3”.
- **RDR-338** Trail map legend — pill at bottom-left: “dashed = where you are · tap a card to go back”.
- **RDR-339** Trail map actions — footer on `--card-2`: “Save trail to Notebook”, link “Open in the editor”, and at the right “Start a new trail” (t3, hover `--bad`).
- **RDR-340** Save trail — appends to `jadhr-notes`: `{ id:'n'+ts, title:'Trail: {first 3 transliterations joined ' › '}', body:'Trail · {locale date}\n@{tr} — {gloss}\n…' (distinct words), tags:['trail'], ts, roots:[distinct root keys] }`; toast “Trail saved · see Notebook”.
- **RDR-341** Open in the editor — Editor URL `?from=trail&seed={base64(UTF-8 JSON)}` with `{ words:[{ ar, tr, en, pos, form:{ ar, tr, en }, root:{ ar, tr, en } }], sentence:null }` for the distinct trail words.
- **RDR-342** Start a new trail — clears `jadhr-trail` and closes the map.
- **RDR-343** Trail scope — word steps only (no passages, roots or patterns are recorded as steps although the map labels each node with a type).

### 25. Review deck (study)

- **RDR-344** Entry points — header “Review” (wide), ⋯ “Review roots you met” (phone), `?mode=review` (after 400ms). Esc or “End session” closes.
- **RDR-345** Queue — distinct roots of starred words (`marks`); if nothing is starred, the roots used in the current chapter. Empty → toast “Nothing to review yet — read a chapter or star some words”. Words marked "learning" do not enter the queue.
- **RDR-346** Header badge (“due”) — number of distinct starred roots, else the number of roots in the current chapter; it is a queue size, not a due count, and is never zero on a chapter with words (**SPEC≠CODE**: spec says due count from the scheduler).
- **RDR-347** Overlay frame — fixed full-screen, `--canvas`, dcFade .14s, z 92; own 52px header: logo mark, “Review” 13.5px/500, meta “roots of your starred words” or “roots on this page — star words to build your own set”, segmented “Root card” / “In context”, 120×4 progress bar (`--c-root`, at ÷ queue), mono “{current} / {total}”, “End session”.
- **RDR-348** Mode switch — changing mode resets answers, reveal state and check state for the current card; the chosen mode is remembered for the session (`rvMode`, not persisted).
- **RDR-349** Root card — 560px card: mono uppercase `--c-root` cap “Root · {n} words in the lexicon”; root Arabic Amiri 52 letter-spacing .08em; mono “{tr} · {root gloss}”; instruction “Name the words built on this root, then reveal each one.”
- **RDR-350** Root card rows — one per family word: hidden = dashed `--line-2` row with two grey placeholder bars, hint “{pattern meaning} — {pos}”, button “Reveal”; shown = Arabic Amiri 22 `--c-word`, mono transliteration, gloss, button “Entry” (title “Open the entry”; closes review and selects the word).
- **RDR-351** Root card grading — three buttons: “Forgot family” (`--bad` text), “Partial”, “Knew all” (primary). Grading appends `{ root, grade }` and advances. **SPEC≠CODE**: spec says flip with tap or `space`, then again/hard/good/easy; code has per-word Reveal, three grades and no keyboard flip.
- **RDR-352** In context card — 820px two-column grid (main + 260px side): mono ref “{ref} · {book English}” and “root {Arabic}” cap; the passage in Amiri 30 line-height 2 RTL with family members blanked; English translation below.
- **RDR-353** In context passage choice — from the base book only: the passage containing the most tokens of the due root. None → note “No passage in this book uses {tr} — switch to the root card.” and the button does nothing (dead end) (**BUG**).
- **RDR-354** In context blanks — each blanked token shows a numbered gap (min-width 84px, 2px `--c-word` underline, mono number under it); per blank an input (`dir="rtl"`, Amiri 22, 190px, placeholder “…”, aria-label “Blank {n}”); Enter in any input checks; message before check “hint: {pattern meaning}”.
- **RDR-355** In context checking — compares tashkīl-stripped, hamza-folded answer with the surface minus `، . :`; after check: correct “✓ {gram or 'correct'}” (`--good`), wrong “expected {surface} — {gram}” (`--bad`), empty “skipped — {surface}” (t3); the blanks reveal the real words (green if right).
- **RDR-356** In context side panel — “Revealed so far”: after checking, a card per blank with Arabic Amiri 22, transliteration, gloss, meta “{gram or 'dictionary form'} · {n} in this book”; note before check “{n} member(s) of this root is/are blanked. Type each, with or without tashkīl. Lexicon lines and attestations appear on reveal, not before.”; after “{score} of {n} recalled in context. Grade the family, then move on.”
- **RDR-357** In context grading — single button: “Check” → then auto-grade by score: all → “Knew all · next”, some → “Partial · next”, none → “Forgot · next”.
- **RDR-358** Session complete — 520px card: “Session complete”; “{k} of {n} families fully recalled. Forgotten ones come back first next time.”; rows root Arabic `--c-root` + gloss + grade (Knew all `--good`, Partial t2, Forgot `--bad`); “Back to reading”.
- **RDR-359** Scheduler — **none implemented**: grades live only in the session object and are discarded; nothing is persisted, nothing is reordered, the “come back first next time” promise is not kept. 07-data-model.md defines `interval_days` and `ease 2.5` (SM-2 style) — that is the production requirement.
- **RDR-360** Entry into the deck (spec vs code) — **SPEC≠CODE**: spec says words enter by being starred or by learning → confirmed, and that Collections “Keep” stars; in code only stars count, and Collections “Keep” cycles word state learning → known → none and never stars.

### 26. Graph hand-off sheet (“Hand off to the graph editor”)

- **RDR-361** Triggers — “Open in graph editor” and “Graph the root” (word seed), hover card “Open in graph” (word seed), passage Graph drawer “Open in editor →” (passage seed), In this text “Graph” (passage seed variant).
- **RDR-362** Frame — scrim `rgba(10,10,16,.5)` (click closes), centred 520px card (max-height 100%, scrolls), radius 16, `--sh-open`, dcPop .14s, z 90; title “Hand off to the graph editor”; sub text; ✕ (aria-label “Close”).
- **RDR-363** Word seed sub — “The graph opens with {tr} at the centre: its root, the patterns built on it, every sibling word, and the passages in this book that use them.”
- **RDR-364** Word seed rows — label “Cards that will be created”; rows (type dot, type, detail ellipsis, mono count): Root “{root Arabic} — {root gloss}” 1; Form “{patterns joined '  ·  '}” {n}; Word “{family words}” {n}; Sentence “passages citing {ar}” or “no passages in this chapter” {occurrences}; Description “lexica entries attached to {ar}” 9.
- **RDR-365** Passage seed (drawer) — title “Passage {n}”; sub “The passage becomes one sentence card, linked to every word, pattern and root it uses.”; rows Sentence (English) 1, Word, Form, Root; JSON `{ seed:'passage', chapter, passage, words, roots }`.
- **RDR-366** Passage seed (In this text) — sub “This passage becomes one sentence card linked to every token it uses.”; rows Sentence, Word, Root (no Form row); JSON without roots.
- **RDR-367** Footnote — “Links are drawn root → pattern → word → passage, exactly as the editor's own layout expects. Nothing already on the canvas is replaced.”
- **RDR-368** Actions — “Copy seed JSON” (copies the seed JSON pretty-printed; toast “Seed JSON copied”), “Cancel”, and the primary ring-coloured link “Open graph editor”.
- **RDR-369** Editor URL — `Editor?from=reader[&w={id}&tr={tr}&ar={ar}]&seed={base64(UTF-8 JSON)}`; seed `{ words:[{ ar, tr, en, pos, form:{ ar, tr, en }, root:{ ar, tr, en } }], sentence:{ ar, tr, en, src:'Ch. {c} · passage {p}' } | null }`. Word seeds send only the family words (no sentences or description cards despite the rows shown) (**gap**).
- **RDR-370** Word seed JSON (copy) — `{ seed:'word', word, root, forms, words, lexica:[9 ids] }`.

### 27. Omnibox (⌘K)

- **RDR-371** Open — ⌘K / Ctrl+K anywhere (prevents default; resets the query), header Search, ⋯ “Search everything”; focuses `input[data-omni]` after 30ms.
- **RDR-372** Frame — scrim `rgba(10,10,16,.4)` (click closes), top padding 70px, 640px card, radius 14, `--line-2`, `--sh-open`, dcPop .12s, z 95. No `role="dialog"` / listbox semantics.
- **RDR-373** Input — “⌕” + input (`dir="auto"`, Amiri/Plex 22px, aria-label “Search everything”), placeholder “Word, root, k-t-b, مَفْعُول, 2:255, or an English gloss”; right pill shows the detected query type.
- **RDR-374** Detected-type labels — empty “type to search”; `^\d+:\d+$` “verse reference”; Arabic with harakat “Arabic · with tashkīl”; Arabic of exactly 3 letters “Arabic · root letters?”; other Arabic “Arabic · no tashkīl”; `x-y-z` Latin “root · transliterated”; contains ā ī ū ʿ ʾ ḍ ṣ ṭ ẕ ḥ “transliteration”; else “English or transliteration”.
- **RDR-375** Group “Roots” (≤ 3) — match: root letters equal the query (spaces removed), transliteration equals (“k-t-b”), gloss contains, or root letters contain a ≥ 2-letter Arabic query; row: root dot, Arabic, gloss, meta “{n} words · {corpus} in corpus”; click → select the root's first word + tab family.
- **RDR-376** Group “Words” (≤ 5) — stripped Arabic contains, transliteration contains, or gloss contains; row: word dot, Arabic, “{tr} · {gloss}”, meta “{freq} in corpus”; click → select.
- **RDR-377** Group “Patterns” (≤ 2) — stripped pattern equals the query, or pattern transliteration equals it (also ignoring ʿ ʾ and the chat digits 3 and '); row: pattern dot, Arabic, meaning, “{n} words”; click → select the first word on that pattern, tab patterns, This pattern mode.
- **RDR-378** Group “In texts” (≤ 5, across all loaded books) — passage Arabic contains the query, ref equals it exactly (“2:255”), or English contains; row: sentence dot, Arabic truncated to 40 chars + “…”, English, meta “{ref or 'Ch. c·p'} · {book English}”; click → switch book and chapter, close drawers, scroll to the passage.
- **RDR-379** Row style — full-width, padding 8×16, gap 12: 8px type dot, Arabic Amiri 20 (min 90, right-aligned), English 13px ellipsis, meta 11.5px t3; group titles mono 10.5px uppercase.
- **RDR-380** Empty states — query with no hits: “Nothing in the prototype data matches “{q}”.”; empty query: “Try: عِلْم · k-t-b · مَفْعُول · 2:255 · library”.
- **RDR-381** Footer — “↵ open first”, “esc close”, and right link “All results →” to `Search?q={query}`.
- **RDR-382** Keys — Enter opens the first row of the first group. **SPEC≠CODE**: spec promises arrow-key navigation — none exists. The input's key handler calls `stopPropagation()` on every key, which in React 18 also stops the native event before the window-level Esc handler, so Esc typed in the (auto-focused) input likely does not close the omnibox (**BUG**, verify; handle Esc in the input).

### 28. Cite / share dialog

- **RDR-383** Entry — panel “Cite” (only when a word is open); defaults scope “This entry”, format Chicago. **SPEC≠CODE**: spec lists passage tools as a trigger; no passage tool opens it.
- **RDR-384** Frame — scrim `rgba(10,10,16,.4)` (click closes), centred 460px card (max-height 100%, scrolls), radius 14, `role="dialog"`, aria-label “Cite this entry”, z 95; title “Cite this” + ✕ (aria-label “Close”).
- **RDR-385** Scope control — segmented “This entry” / “Root” / “Passage”.
- **RDR-386** Permalink block — label “Permalink · stable, versioned”; mono box “jadhr.org/w/{wordId} · v2026.09” / “jadhr.org/r/{rootKey} · v2026.09” / “jadhr.org/p/{bookId or 'base'}/{ci}.{pi} · v2026.09” (0-based indices of the selected token's passage, else `{ch}.0`); “Copy” button.
- **RDR-387** Permalink copy **BUG** — “Copy” always copies `https://jadhr.org/w/{wordId}` whatever the scope; toast “Permalink copied”.
- **RDR-388** Citation formats — pills “Chicago” · “APA” · “MLA” · “BibTeX”. **SPEC≠CODE**: spec (and 01, 06, 08) say BibTeX · RIS · plain text; code has no RIS and no plain.
- **RDR-389** Citation title `{t}` — entry: “{tr} ({ar})”; root: “{root tr} ({root ar})”; passage: “passage {c}.{p}, {book English}” (1-based).
- **RDR-390** Citation URL `{url}` — `https://jadhr.org/w/{id}` | `https://jadhr.org/r/{rootKey}` | `https://jadhr.org/p/{bookId}` (passage URL drops the passage index, unlike the permalink — **BUG**).
- **RDR-391** Chicago template — `“{t}.” Jadhr — Arabic Root Lexicon, version 2026.09. Accessed {d}. {url}.`
- **RDR-392** APA template — `Jadhr. (2026). {t}. In Arabic Root Lexicon (v2026.09). {url}`
- **RDR-393** MLA template — `“{t}.” Jadhr: Arabic Root Lexicon, v2026.09, {url}. Accessed {d}.`
- **RDR-394** BibTeX template — `@misc{jadhr_{rootKey for root scope, else wordId},\n  title = {{t}},\n  howpublished = {Jadhr — Arabic Root Lexicon, v2026.09},\n  url = {{url}},\n  year = {2026}\n}` (passage scope reuses the word id as key).
- **RDR-395** Access date — hard-coded “18 September 2026” (`{d}`); must be the real date in production.
- **RDR-396** Citation box — 13px, `white-space:pre-wrap`, `--card-2`; “Copy citation” copies it (prototype finds the element by its pre-wrap style — fragile; copy from state); toast “Citation copied”.
- **RDR-397** Sources block — label “Sources behind this entry · cite them, not us”; up to 3 rows (dictionaries mapped as attesting sense 1): root-coloured bullet + “{author}, {dictionary English}, s.v. {root Arabic}” + “copy” link (toast “Source copied”).
- **RDR-398** Footer — “Export JSON” (copies `{ id, ar, tr, en, pos, root:{…full root object}, form, senses, dataset:'v2026.09', license:'CC-BY-SA-4.0' }` pretty-printed; toast “Entry JSON copied”), link “Embed…” to the Published Graph page, and “CC BY-SA 4.0” at the right.
- **RDR-399** Semantics per target — **SPEC≠CODE**: spec mentions a "dictionary article" target; code offers entry / root / passage only.

### 29. Onboarding beats

- **RDR-400** When shown — `onb` starts at 0 unless `jadhr-onboarded` is true; hidden while the review overlay is open; suppressed (−1) for the session when Ask opens at load (so true first-time visitors in Ask never see it; it appears for not-onboarded users arriving with `?w=`, `?book=` or saved progress).
- **RDR-401** Card — fixed, width 340 (max `calc(100vw − 40px)`), padding 16×18, radius 14, `--line-2`, `--sh-open`, dcRise .2s, z 80; desktop: bottom 20px, left = (232 if rail docked else 0) + 20px; phone: top 64px, left 20px. No `role`.
- **RDR-402** Header — mono 10.5px uppercase `--c-root` “Beat {n} of 3 · {the word | the root | the graph}”; three 16×4 progress dashes (filled `--c-root` up to the current beat); “Skip” (12px t3).
- **RDR-403** Beat 1 — title “Tap any word.”; body “Nearly every word in the text is an entry. Tap one — the dictionary opens beside you with its root, its family and what the classical lexica say.”; button “Show me” (selects the demo word عِلْم `ilm` and advances).
- **RDR-404** Beat 2 — title “Four words, one root.”; body “Words sharing the open word’s root are now underlined. Arabic builds families this way; the dictionary follows the family, not the alphabet. The Family tab lists every member.”; button “Open the family” (sets tab family and advances).
- **RDR-405** Beat 3 — title “Put the family on a canvas.”; body “The Graph action on a passage previews its roots, patterns and words; “Open in editor” hands them to the canvas as proposals you accept one by one.”; button “Got it” (sets `jadhr-onboarded` true and hides).
- **RDR-406** Advancing by doing — selecting any word while beat 1 is showing jumps to beat 2.
- **RDR-407** Skip — sets `jadhr-onboarded` true and hides.
- **RDR-408** Copy drift — beat 2 says “The Family tab” but the default panel has no tabs (layers); beat 3 refers to the Graph passage tool, which is hidden until hover/long-press.

### 30. Phone behaviour (< 900px)

- **RDR-409** Header on phone — rail toggle · logo · title block · spacer · “Ask” · “⋯” · “Dictionary” (min-height 40). Everything else moves into ⋯.
- **RDR-410** ⋯ menu frame — absolute `top:50px; right:12px`, min-width 210, `--card`, `--line-2`, radius 12, `--sh-open`, padding 6, gap 2, dcPop .12s, z 45; items min-height 44, padding 0 12, 14px t1, meta 12px t3 right-aligned, hover `--card-2`. No scrim, no outside-click close (Esc closes).
- **RDR-411** ⋯ items in order — “Search everything” (meta “⌕”; opens omnibox), “Reading preferences” (“Aa”; opens the popover), “Text larger” (“A+”; +0.1 up to 1.5, menu stays open), “Text smaller” (“A−”; −0.1 down to 0.8, menu stays open), “Review roots you met” (no meta; starts review), “Dark theme” / “Light theme” (switches and writes `jadhr-theme`), “Graph editor” (“→”; navigates to the Editor), “Library” (“→”; navigates to Library).
- **RDR-412** Dictionary as bottom sheet — `position:absolute; left:0; right:0; bottom:0`, height `min(52%, 460px)` (half) or `calc(100% − 8px)` (full), `--panel`, top border `--line-2`, radius 16px 16px 0 0, `--sh-open`, z 36, `transition:height .22s cubic-bezier(.2,.7,.2,1)`.
- **RDR-413** Full-height overlap — the full sheet's top sits 8px from the viewport top, under the 52px header (z 40 > 36), which can hide the grabber and top bar (**BUG**, verify on device; cap full height below the header or raise the sheet above it).
- **RDR-414** Sheet gestures (grabber only) — tap toggles half/full; swipe (touchstart→touchend delta) up > 40px → full; down > 40px → half if full, else close the panel. Selecting a word from the text drops the sheet back to half.
- **RDR-415** Sheet touch targets — back/forward 44×44, Index min-height 44, ✕ 44×44 (15px glyph), star min 44×44, Cite and “Open in graph editor” min-height 44, tabs min-height 44, section heads min-height 48, “Suggest an edit” min-height 40, passage tools min-height 40.
- **RDR-416** Reading under the sheet — the half sheet covers the lower half of the text; nothing scrolls the tapped passage above the sheet (**gap**). Panel open state is persisted, so a phone user can land with the sheet already up.
- **RDR-417** Passage tools on phone — hidden until a 420ms long-press (or until the passage holds the selected word); the inline gloss appears only after the sheet is closed.
- **RDR-418** Rail on phone — 232px overlay with scrim (same as mid width).
- **RDR-419** Ask on phone — short placeholder “a word…” and the four-card swipe deck.
- **RDR-420** 390px audit claim — 02/03 say every overlay was audited at 390px; in code the overlays rely on `max-width:100%` / `calc(100vw − 24/40px)` and 20px scrim padding; the review In-context card is a two-column grid with a fixed 260px side column (no phone layout) and the review overlay's 52px header bar crams logo, title, meta, mode control, progress and “End session” into 52px with no wrapping — both need a real phone layout.
- **RDR-421** Hover-only features on phone — hover card and hover-revealed underline/tools have no touch equivalent other than long-press for tools.

### 31. Keyboard

- **RDR-422** Esc (global, window keydown) — closes in one go: graph hand-off sheet, reading popover, hover card, panel search query, review overlay, omnibox, unknown-word popover, cite, suggest, term card, ⋯ menu. It does not close the trail map, Ask mode, onboarding, passage drawers or the rail overlay.
- **RDR-423** ⌘K / Ctrl+K — opens the omnibox with an empty query (preventDefault).
- **RDR-424** Omnibox Enter — opens the first result.
- **RDR-425** Ask Enter — form submit picks the first match.
- **RDR-426** Tabs — ArrowLeft / ArrowRight move between tabs with wrap and move focus (tabs mode only).
- **RDR-427** Review In-context — Enter in any blank checks the answers; inputs stop key propagation.
- **RDR-428** Not implemented — no arrow-key navigation in omnibox or panel search results, no Space to flip review cards, no keyboard access to word tokens (they are `<span>`s with click handlers, not focusable), no shortcut for next/previous passage, chapter, word or panel toggle.

### 32. Persistence (keys and shapes as implemented)

- **RDR-429** `lexicon-reader-v5` — one JSON object of the PERSIST fields: `explainOff, panelMode, layerOpen, wordStatesOn, bookIdx, lexMode, cmp, tashkil, themeOverride, size, trOn, tlOn, tintOn, gramAll, railOpen, panelOpen, panelW, dictOff, ch, marks, links, topics, speed`. Saved 250ms after any setState touching one of them (functional setState saves all). **SPEC≠CODE**: spec names this `jadhr-prefs` and lists `jadhr-panel-layers` separately; both live in this one key in code.
- **RDR-430** Restore rules — on mount, saved values that are null/undefined are skipped (defaults and props apply); saved `ch` is dropped if the current book has no such chapter; `railOpen` forced false below 1200px.
- **RDR-431** `marks` (stars) — `{ [wordId]: true|false }` inside `lexicon-reader-v5`. **BUG (cross-page)**: the Hub and Notebook read stars from `jadhr-marks` (KEYS.marks in lexicon-data.js), which the Reader never writes, so stars made in the Reader are invisible elsewhere.
- **RDR-432** `links` — `{ ['{ci}.{pi}']: ['{ci}.{pi}', …] }` (no book id). `topics` — `{ ['{ci}.{pi}']: [topicLabel, …] }` (no book id). Both inside `lexicon-reader-v5`.
- **RDR-433** `jadhr-word-states` — `{ [wordId]: 'learning' | 'known' | 'new' }` ('new' can be stored explicitly from the hover card). **SPEC≠CODE**: spec shape is `'learning' | 'known' | 'starred'`.
- **RDR-434** `jadhr-notes` — passage note `{ id:'n'+ts, book:bookId|'base', bookAr, key:'{ci}.{pi}', ref, anchor:'{first 4 tokens}…', body, roots:[rootKeys], word: selected word id|null, ts }`; trail note `{ id, title, body, tags:['trail'], ts, roots }`. **SPEC≠CODE**: spec shape is `{ id, body, tags, wordId?, passageKey?, ts }`.
- **RDR-435** `jadhr-progress` — `{ [bookId|'base']: { ch, pi, at } }`, written on token clicks only.
- **RDR-436** `jadhr-proposals` — array of `{ id, status, by, ts, kind:'edit'|'sense'|'error'|'entry', wordId, wordAr, senseIdx, current, text, why, sources }` (status written 'pending'; Review Queue moves it on).
- **RDR-437** `jadhr-sessions` — array (last 60) of `{ day:'YYYY-MM-DD', book, bookAr, words:[ids], roots:[keys], opened, minutes }`, one per day per book; every lookup adds the word and root, `opened += 1`, `minutes = min(180, minutes + 1)` (a lookup-count proxy, not time). Read by Notebook, Classroom, Profile.
- **RDR-438** `jadhr-trail` — `[{ kind:'word', id, ts }]`, max 40.
- **RDR-439** `jadhr-onboarded` — boolean, written by Skip / Got it only.
- **RDR-440** `jadhr-theme` — 'light' | 'dark', shared with the Editor; written by both theme toggles.
- **RDR-441** `jadhr-context` — written on every select: `{ book: bookArabicTitle, bookId, word, wordAr, wordTr, root, rootAr }`; read by Hub, Concordance, Shell. **SPEC≠CODE**: spec shape `{ root, word, passage }` — no passage is written.
- **RDR-442** `jadhr-texts` — read-only here: `[{ id, title, short, text, gloss?, ts }]` from the Library.
- **RDR-443** Not persisted — Ask query, focus root, drawers, expanded articles, lexicon filter, apparatus base, timeline mode, patterns mode and wazn filter, show-unattested, scripture filters, history, review mode and results, selected token.
- **RDR-444** Storage failure — every read/write is wrapped in try/catch and silently ignored.

### 33. URL parameters

- **RDR-445** Inbound `w` — word id; opens the entry (see §6 for what it skips).
- **RDR-446** Inbound `mode` — `ask` (Ask mode, uses `q`), `lookup` (index), `review` (deck after 400ms). Any other value is ignored.
- **RDR-447** Inbound `q` — prefills the Ask box (only honoured on the Ask path; ignored otherwise).
- **RDR-448** Inbound `book` — text id (non-base only), opens chapter 1. No `ch`/passage/verse parameter exists, so a verse cannot be deep-linked (**gap**; the omnibox and permalinks talk about `p/` and `2:255` but nothing reads them).
- **RDR-449** URL is never written — the Reader does not update the address bar when the word, book, chapter or mode changes, so the back button and sharing do not reflect state. **SPEC≠CODE** with 01 §1.3 ("every parameter must survive as a real, shareable URL").
- **RDR-450** Outbound — Editor `?w=&tr=&ar=` (header Graph), Editor `?from=reader[&w&tr&ar]&seed=` (hand-off), Editor `?from=trail&seed=` (trail map), `Analyser?q=` (unknown word), `Search?q=` (omnibox All results), `Library` (rail “all →”, ⋯), `Review Queue` (suggest footnote), `Published Graph` (cite “Embed…”).

### 34. Empty, loading and error states; toasts

- **RDR-451** Loading — none; all data is synchronous. Production needs loading skeletons for the text, panel sections, lexica articles, search results and the review queue, plus error states for each.
- **RDR-452** Empty states present — panel empty mode (“Tap any word in the text” …); In this text empty; In scripture empty + root siblings; Related “No other passage shares these roots”; Links “Pick a passage to bind it to this one”; Ask no match; omnibox no hits / empty hint; unknown word no candidates; Shapes “not attested”; Side by side “—” and “none of these”; review nothing-to-review toast; In-context no passage note.
- **RDR-453** Missing empty states — panel search with no results (dropdown just doesn't appear), all dictionaries switched off (sections render empty), lexicon filter with 0 entries, chapter with no interactive words.
- **RDR-454** Toast — bottom 22px centred pill, `--card`, `--line-2`, `--sh-open`, 13px, `role="status"` `aria-live="polite"`, z 95, auto-hides after 1.9s, one at a time (newer replaces older).
- **RDR-455** Toast animation **BUG** — the toast uses dcRise, whose keyframes include `translate(-50%,-100%)`, while the toast's own transform is `translate(-50%,0)`: it animates one toast-height too high then jumps down when the animation ends. Same pattern on the term card when placed below the term. Use per-anchor keyframes.
- **RDR-456** Toast messages — “Passage copied”, “Note saved · see Notebook”, “Submitted for review”, “Trail saved · see Notebook”, “Permalink copied”, “Citation copied”, “Source copied”, “Entry JSON copied”, “Seed JSON copied”, “{dict} entry copied”, “{dict} queued as a description card”, “{corpus} — corpus attestations arrive with phase 2”, “Nothing to review yet — read a chapter or star some words”, “Audio is not available in this browser”, “No Arabic voice installed — using the default voice”, “Audio failed”, and unused “Entry copied”.
- **RDR-457** Clipboard errors — `navigator.clipboard.writeText` failures are swallowed and the success toast still shows (**BUG**).
- **RDR-458** Placeholder disclosures in UI — “placeholder entry · dummy data for layout”, “Editorial summary written for this prototype — placeholder wording, not any lexicon's text.”, timeline placeholder captions, “phase 2” promises, “in the prototype” wording in Ask — all must be removed or replaced by real data states.

### 35. Accessibility (as implemented, and gaps)

- **RDR-459** Labels present — rail toggle “Toggle contents”; “Smaller text” / “Larger text”; theme button label; ⋯ “More”; panel “Back”, “Forward”, “Hide the panel”; panel search “Look up a word or a root”; Ask input; omnibox “Search everything”; lexicon “Add to graph”, “Copy this entry”; timeline dots (aria-label = hint); term card and unknown-word “Close”; cite “Close”; hand-off sheet “Close”; “Hear it”; review blanks “Blank {n}”; sheet grabber expand/shrink labels.
- **RDR-460** State attributes present — `aria-pressed` on Ask and Theme; `aria-expanded` on ⋯ and on layer heads; `role="switch"` + `aria-checked` on all 17 preference and dictionary toggles; `role="tablist"`/`role="tab"` + `aria-selected` on tabs; `disabled` on back/forward and Submit.
- **RDR-461** Dialog semantics — only the term card (`role="dialog"`, “Term explanation”) and cite (`role="dialog"`, “Cite this entry”). Missing on omnibox, suggest, hand-off sheet, review overlay, onboarding, ⋯ menu, reading popover, hover card and unknown-word popover. No focus trap or focus return anywhere.
- **RDR-462** Live regions — toast only (`role="status"`, `aria-live="polite"`).
- **RDR-463** Decorative SVGs — all carry `aria-hidden="true"`.
- **RDR-464** Focus ring — `:focus-visible` 2px ring offset 2px on button, a, input; textareas (note, suggest) lack it.
- **RDR-465** Language attributes **gap** — Arabic elements carry `dir="rtl"` but no `lang="ar"`; English glosses carry no `lang="en"`. 02 §2.7 requires both.
- **RDR-466** Tokens not focusable **gap** — words in the text are spans with onClick; no keyboard or screen-reader access to the core interaction.
- **RDR-467** Missing state on toggles — “Reading” and “Dictionary” header buttons have no `aria-expanded`/`aria-pressed`; star button has no `aria-pressed`; drawer tool buttons have no `aria-expanded`.
- **RDR-468** Contrast notes — hard-coded amber `#b45309` text on dark cards (pending meta, unknown label, apparatus) is not re-tuned for dark mode; `--line-2` used as text colour for disabled arrows and “—” cells is below text contrast.

### 36. Dark mode

- **RDR-469** Application — `.dark` toggled on both `<html>` and `<body>`; dark token set as in 02 §2.2 (canvas #0f0f12, card #1a1a20, card-2 #22222a, card-3 #2b2b34, panel #15151a, paper #16161b, line rgba(255,255,255,.08), line-2 .16, t1 #f2f2f7, t2 #b0b0be, t3 #8d8d9b, ring #7aa2f7, edge #4d4d5b, dot #2a2a33, bad #f07178, good #79d68b, root #e0a361, form #ab92f2, word #7aa2f7, sentence #6fce88, desc #9a9aa8, inset-highlight shadows).
- **RDR-470** Theme resolution — `themeOverride` (persisted in `lexicon-reader-v5`) → `jadhr-theme` → prop → light. **BUG**: because the Reader's own override wins over the shared key, a theme change made in the Editor is ignored by the Reader after the Reader has ever toggled; read the shared key only.
- **RDR-471** Fixed-colour exceptions — term card is #16161a with white text in both themes (intentional aside); toggle knobs #fff; primary buttons use `--t1` fill with `--canvas` text (they invert in dark); hand-off “Open graph editor” white on `--ring`; stream band labels white with shadow.
- **RDR-472** Hard-coded light-only values — amber `#b45309` (learning wash, pending borders/meta, unknown label, apparatus, chapter %, hover state border), learning bar `#e0b071`, scrims rgba(10,10,16,.28/.4/.5); none are re-chosen for dark grounds.
- **RDR-473** Paper vs canvas — in dark, `--paper` #16161b sits on `--canvas` #0f0f12 with `--line` side borders; the Ask view uses `--canvas`.

### 37. Data the Reader needs (entities, from the code)

- **RDR-474** Root — `key`, `ar` (letters separated by spaces), `bare` (letters joined), `tr` (hyphenated, e.g. “ʿ-l-m”), `en` (gloss), `arGist` (Arabic core-meaning phrase), `corpus` (occurrence count). Six in the sample: ك ت ب 319, د ر س 144, ع ل م 854, ق ر أ 88, ج ل س 41, ق و م 660.
- **RDR-475** Word (lexeme) — `id` (slug), `ar` (vocalised), `tr`, `en` (short gloss), `pos` (verb | noun | participle; tokens also use adjective), `root`, `form` (pattern in Arabic), `arDef` (Arabic definition), `freq` (corpus count), `senses[]` (English), optional `arSenses[]`. 35 in the sample.
- **RDR-476** Pattern metadata (FORM_META, 21) — فَعَلَ faʿala “Form I — base verb”; فَعِلَ faʿila “Form I — stative verb”; فَعَّلَ faʿʿala “Form II — causative verb”; أَفْعَلَ afʿala “Form IV — causative verb”; فَاعِل fāʿil “active participle”; مُفَعِّل mufaʿʿil “Form II participle”; مُسْتَفْعِل mustafʿil “Form X participle”; مَفْعُول mafʿūl “passive participle”; مَفْعُولَة mafʿūla “passive participle (fem.)”; مَفْعَل mafʿal “noun of place”; مَفْعِل mafʿil “noun of place”; مَفْعَلَة mafʿala “noun of place (fem.)”; فِعَال fiʿāl “verbal noun”; فِعَالَة fiʿāla “verbal noun (fem.)”; فَعْل faʿl “verbal noun”; فِعْل fiʿl “verbal noun”; فَعَالَة faʿāla “noun of quality”; فَاعَل fāʿal “noun”; فَعُّول faʿʿūl “intensive noun”; تَفْعِيل tafʿīl “Form II verbal noun”; مُفَاعَلَة mufāʿala “Form III verbal noun”.
- **RDR-477** Dictionary — `id, ar, en, by, d (death year CE), tag, kind`; nine (§4).
- **RDR-478** Lexicon article — per (dictionary, word): text, direction; the prototype generates placeholder text from templates plus repeated filler sentences (TAILS) to reach realistic lengths.
- **RDR-479** Sense attestation — per (word, sense, dictionary) and per (word, sense, corpus): booleans (placeholder hashes in the prototype); needed by sources meta, compare, apparatus, timeline, cite sources.
- **RDR-480** Corpus — `id, label, year` (three fixed).
- **RDR-481** Text/book — `id, ar, en, kind, chapters[{ ar, en, meta?, passages[{ ref?, tr, en, toks[] }] }]`; token “surface|wordId|gram”.
- **RDR-482** Occurrence indexes — base-book occurrences per word `{ ci, pi, ti, gram, ar }`; scripture occurrences per word `{ book, bookEn, kind, ref, ar (whole verse), en, gram, surface, chapter }`; passage → roots list.
- **RDR-483** Topics — fixed list of five labels.
- **RDR-484** User data — word states, stars, notes, progress, proposals, sessions, trail, passage links, passage topics, preferences (§32).
- **RDR-485** Sample texts — base prose book “كِتَابُ العِلْمِ وَالمَكْتَبَة” / “The Book of Knowledge and the Library”: 3 chapters (“فِي المَكْتَبَة” In the Library, 4 passages; “الدَّرْسُ وَالطَّرِيق” The Lesson and the Road, 3; “العِلْمُ عَلَامَة” Knowledge is a Mark, 3). Qurʾān sample: al-Baqara 2:31, 2:32, 2:255 (chapter meta “Medinan · 286 verses”) and Ṭā Hā 20:114 (“Meccan · 135 verses”). Bukhārī sample: Kitāb al-ʿIlm 71 and 79 (“The Book of Knowledge · 76 ḥadīth”).

### 38. Cross-check summary — spec (01/02/03) vs prototype code

- **RDR-486** Modes — spec: one `mode` with five values; code: `mode` (empty/word/index) + `ask` flag + `review` overlay.
- **RDR-487** First visit — spec rule matches in intent, but code tests "saved chapter is truthy", so chapter 1 counts as no progress, and Ask never sets `onboarded`.
- **RDR-488** Layout numbers — rail 240 → 232px; panel ~420 → 400 default, `--card` → `--panel`; A−/A+ ≥ 1200 → ≥ 900.
- **RDR-489** Progress hairline — spec: top edge, `--ring`, fraction of text read; code: bottom edge, `--c-root`, chapter index ÷ chapters.
- **RDR-490** Reading preferences — spec: four toggles incl. "Sense tint"; code: eight toggles; tint is a root-family underline, there is no sense-colour wash on tokens.
- **RDR-491** Text size — spec: floor 0.8, step 0.1; code: header 0.05 steps in [0.85, 1.6], ⋯ menu 0.1 steps in [0.8, 1.5].
- **RDR-492** Word states — spec: learning/known/starred visible in text; code: new/learning/known in text, stars stored separately and not shown in text.
- **RDR-493** Grammar — spec: shown in the panel's grammar band; code: optional per-passage band in the text plus “Grammar here” inside Meanings.
- **RDR-494** Inline gloss — spec: instead of opening the panel; code: only when the phone sheet is closed.
- **RDR-495** Marginalia — spec: margin on wide screens; code: inline under the passage.
- **RDR-496** Passage tools — spec: cite, note, concordance, analyse, copy; code: Audio, Roots (always) + Related, Links, Topic, Copy, Graph, Note.
- **RDR-497** Rail — spec: contents carry the resume marker, kind label `prose`; code: no rail resume marker, label “Prose”, plus an unspecified “Roots on this page” section.
- **RDR-498** Panel header — spec: headword, root chip with gloss, transliteration, POS, pattern, frequency, history arrows, index, close; code: same fields but split into a top bar (arrows, title, Index, ✕), a search field, and a word header (headword, translit, POS/pattern/frequency chips, gloss, root chip + gloss, Graph/Cite/star).
- **RDR-499** Layer order — spec: Meanings, Word family, Shapes, Old dictionaries, Across the centuries, In this text; code renders Shapes fifth (tabs keep the spec order).
- **RDR-500** Where next — spec: ends every entry; code: inside Meanings only.
- **RDR-501** Breadcrumb — spec: under the panel header; code: top of the scrolling body.
- **RDR-502** Index — spec: A–Z / root index; code: root-grouped only.
- **RDR-503** In this text — spec: includes sibling attestations from other texts; code: those live in Across the centuries → In scripture.
- **RDR-504** Explain terms — spec: header toggle; code: preference + “Stop explaining terms”.
- **RDR-505** Dotted terms — spec: meta line, grammar band, family headers, pattern headers, lexica, analyser; code: family headers, Shapes meanings and note, “Grammar here” only.
- **RDR-506** Term jump — spec: opens and scrolls; code: opens only.
- **RDR-507** Suggest an edit — spec: required rationale; code: rationale or a source chip.
- **RDR-508** Review — spec: flip with tap/space, again/hard/good/easy, scheduler, due count; code: per-word reveal, three grades, no scheduler, queue-size badge.
- **RDR-509** Deck entry — spec: starred or learning→confirmed, Collections “Keep” stars; code: stars only; “Keep” never stars.
- **RDR-510** Omnibox — spec: arrow keys + Enter; code: Enter only.
- **RDR-511** Cite — spec: BibTeX · RIS · plain + `?w=` permalink, triggered from passage tools too, dictionary-article target; code: Chicago · APA · MLA · BibTeX, `jadhr.org/w|r|p` permalinks, panel only, entry/root/passage targets.
- **RDR-512** Persistence names — spec: `jadhr-prefs`, `jadhr-panel-layers`, notes `{ id, body, tags, wordId?, passageKey?, ts }`, context `{ root, word, passage }`; code: `lexicon-reader-v5` holds prefs + layers + marks + links + topics, note and context shapes as in §32.
- **RDR-513** URLs — 01 requires shareable URLs for state; the Reader reads `w/mode/q/book` once and never writes the URL; no verse/chapter parameter.
- **RDR-514** Typography — 02: dictionary text in Amiri, `lang` attributes on Arabic/English; code: IBM Plex Sans Arabic for articles and senses' Arabic lines, no `lang` attributes.
- **RDR-515** Glossary — spec ~30 terms; code 29.

### 39. Prototype bugs not to copy (consolidated)

- **RDR-516** Chapter 1 counted as "no progress" (falsy 0) → endless Ask on return; Ask never sets the onboarded flag.
- **RDR-517** Base-book-only indexes used against the open book — In this text cards, “Grammar here” gram, Related, Links picker, In-context review passage, Usage “Graph” seed sentence.
- **RDR-518** Passage-keyed user data without a book namespace — links and topics collide across books.
- **RDR-519** Stop-list compares hamza-folded text against hamza spellings (إلى, إلا, إنما), so those particles are treated as unknown words with a dashed hover and the analyser popover.
- **RDR-520** Stars saved in `lexicon-reader-v5.marks`, while Hub and Notebook read `jadhr-marks`.
- **RDR-521** Reader theme override outranks the shared `jadhr-theme` key, so Reader and Editor can disagree.
- **RDR-522** Cite: permalink “Copy” ignores scope; passage citation URL drops the passage; permalink uses 0-based passage indices while the title uses 1-based; access date hard-coded; copy reads the DOM.
- **RDR-523** Toast and below-anchored term card animate with a keyframe that hard-codes `translate(-50%,-100%)`, causing a jump at animation end.
- **RDR-524** Hover card always opens above the word (clipped near the top); no flip.
- **RDR-525** Note draft shared between passages.
- **RDR-526** Lexica: “All 9” label static; gists, Side by side, Apparatus, cite sources and suggest sources ignore the Dictionaries-shown toggles; Apparatus legend says “1–2 others” but amber covers 1–4.
- **RDR-527** Tab-only navigation (root chip, omnibox root/pattern, Start from a root, timeline dots, scripture siblings) does nothing visible in layers mode when the target section is folded; no link scrolls to its section.
- **RDR-528** “Graph the root” sends a word seed; word seeds send only words to the Editor despite showing Sentence and Description rows.
- **RDR-529** Shapes root table shows only one word per pattern.
- **RDR-530** Ask phone deck index not reset when the word changes.
- **RDR-531** Chapter change does not scroll to top; selecting a book at mid width leaves the rail overlay open.
- **RDR-532** Phone full-height sheet slides under the header; persisted `panelOpen` can open the sheet over the text on load.
- **RDR-533** Omnibox input (and review blanks) stop key propagation, which likely blocks the global Esc handler while focused (verify; handle Esc locally).
- **RDR-534** Clipboard failures still show success toasts.
- **RDR-535** Explicitly stored 'new' state is not counted as new in chapter meta (`!state` test); the header counts only known/learning.
- **RDR-536** Review: no scheduler or persistence; “due” badge is a queue size; In-context dead end when no passage uses the root.
- **RDR-537** “Grammar here” blanks whenever any hover card is open.
- **RDR-538** A saved `bookIdx` pointing at a pasted text that has since been deleted makes the current book undefined (crash).
- **RDR-539** `?w=` bypasses select(): no learning state, session, progress or context write.
- **RDR-540** `componentWillUnmount` is defined twice (second wins) and the long-press timer is never cleared.

### 40. Quran adaptation notes

- **RDR-541** Vocabulary mapping — text/book → the Muṣḥaf (المصحف); chapter → sūra (سورة); passage → āya (آية); token → word occurrence keyed `sūra:āya:word`; "page" → muṣḥaf page (604) — rename “Roots on this page” to avoid colliding with real page navigation; "Library" rail → sūra index (114) plus juzʾ/ḥizb/page navigation, with other works (tafsīr, ḥadīth, dictionary, books) as separate shelves of the ecosystem.
- **RDR-542** Arabic-default chrome — mirror the whole layout in RTL: rail on the right, dictionary panel on the left, header order reversed, back/forward chevrons flipped, the panel resize handle on its inner (right) edge with the drag sign inverted; English becomes the embedded run (isolate it with `dir="ltr"`/`<bdi>`). Every English string in this inventory needs native Arabic copy — the plain-language voice must be written in Arabic, not translated.
- **RDR-543** Muṣḥaf typography — the Qurʾān needs a muṣḥaf font with full Uthmani support (small high letters, dagger alif, alif waṣla, Uthmani sukūn, waqf signs) such as KFGQPC Uthmanic Hafs or Amiri Quran; plain Amiri is for classical prose. Decide Arabic-Indic vs Western digits for the Arabic UI; IBM Plex Mono has no Arabic-Indic digits, so counts and refs need a digit-capable font.
- **RDR-544** Text integrity — use a verified Uthmani text (e.g. Tanzil or KFGQPC; verify the licence — Tanzil's terms forbid altering the text) tokenised to the Quranic Arabic Corpus word positions; the text is immutable: suggest/report flows must never target it, and the pasted-text pipeline must never touch it.
- **RDR-545** Tashkīl toggle for the Qurʾān — do not strip Uthmani marks with a regex (it yields non-standard spellings like الصلوة); switch to a stored imlāʾī/simple edition instead, or keep tashkīl always on for Qurʾān text and offer the toggle only for other books.
- **RDR-546** Search normalisation for Qurʾānic text — extend stripping to the Qurʾānic mark ranges (U+0610–061A, U+064B–065F, U+0670, U+06D6–06DC, U+06DF–06E8, U+06EA–06ED, U+08D3–08FF), fold alif waṣla ٱ (U+0671) and hamza-carrying alifs to ا for matching only, and map Uthmani ↔ imlāʾī spellings (ٱلصَّلَوٰة ~ الصلاة, ٱلرَّحْمَٰن ~ الرحمن) so Ask, omnibox and panel search find words typed in everyday spelling.
- **RDR-547** Verse furniture — āya-end marker ۝ with Arabic-Indic number after each verse; waqf signs (ۚ ۖ ۗ ۛ ۘ ۙ), sajda ۩ and rubʿ al-ḥizb ۞ are non-interactive; basmala shown before each sūra except al-Tawba and counted as āya 1 only in al-Fātiḥa; the muqaṭṭaʿāt (الم، حم…) are tokens with special entries and no root.
- **RDR-548** Every word clickable — drop the function-word stop-list: particles (في، من، إنّ، لا…) need entries (lemma, function, no root). The panel needs a no-root layout for particles and pronouns.
- **RDR-549** Clitic-fused words — Qurʾānic words fuse clitics (وَبِٱلْءَاخِرَةِ = wa + bi + al + stem); the panel should show the segments of this occurrence (prefix/stem/suffix) and resolve the stem's lemma and root — the unknown-word popover's Segmentation chips are the right UI, fed by corpus morphology instead of the heuristic.
- **RDR-550** Word tap → panel content for the Qurʾān — contextual meaning of this occurrence (word-by-word gloss) first, then lemma vs surface form, root with its Qurʾān occurrence count, lemma count, family, and verses sharing the root; the prototype's headword shows only the lexeme, so add the surface form and its location.
- **RDR-551** “Grammar here” for the Qurʾān — fill from corpus morphology: POS, person/gender/number, case/mood, definiteness, voice, aspect, verb form (I–X), segment features; optionally iʿrāb. Grammar labels must exist in Arabic (مرفوع، منصوب، مجرور، فعل ماضٍ…) with the English set for the English UI.
- **RDR-552** Word states over the Muṣḥaf — automatic "learning" on every tap is wrong for a reader who taps to understand, and amber washes / blue underlines across Qurʾān text are visually and devotionally inappropriate by default. Make word states an opt-in study mode, default “Word states” off for Qurʾān text, keep selection and family underlines subtle.
- **RDR-553** Root-family tint — keep and promote: "underline every ع ل م in this sūra" is a core Qurʾān feature; the rail's root list per sūra/page drives it.
- **RDR-554** Audio — replace both the simulated word highlighter and speechSynthesis with real human recitation (choice of reciter, per-verse audio with word-level timestamps); the prototype's word-by-word highlight and 1× / 0.75× / 0.5× control map directly to timestamped playback with `playbackRate`; add repeat and continuous play with follow-along scroll. Never synthesise Qurʾān audio with TTS.
- **RDR-555** Verse tools — keep Audio (تلاوة), Roots, Related (verses sharing roots, computed over the whole Qurʾān, ideally weighted by root rarity), Links (user-bound verses → user graphs), Topic (user-defined topics plus curated themes; the five fixed prototype topics go), Copy (with reference, e.g. “﴿…﴾ [البقرة: ٢٥٥]”, optional translation with translator credit), Graph, Note (tadabbur notes).
- **RDR-556** Tafsīr — the brief's "verse → tafsir" has no counterpart in the prototype. Add a Tafsīr verse tool and a verse-selection state (tap the verse number): the panel switches to a verse mode with sources (e.g. al-Muyassar, Ibn Kathīr, al-Ṭabarī, al-Saʿdī, al-Jalālayn) as layers or tabs, reusing the layered-panel mechanics.
- **RDR-557** Translation line — Arabic UI: default off, or show a plain Arabic explanation (e.g. al-Muyassar) instead of English; English UI: selectable translation with credit. Per-verse transliteration is rarely useful for Arabic readers — default off in the Arabic UI; consider an optional word-by-word gloss line under each word.
- **RDR-558** In this text → “في القرآن” — every occurrence of the lemma (toggle: whole root) across the Qurʾān, grouped by surface form (reuse the “Form in text” chips), with sūra filter and Meccan/Medinan split, paginated or virtualised (ع ل م has 854 occurrences); “Go to verse”.
- **RDR-559** Across the centuries — keep as a scholar layer; its Qurʾān marker (632) becomes the anchor and “In scripture” becomes the primary “In the Qurʾān” block, with ḥadīth as a later corpus. Hide the pre-Islamic-poetry lane until real attestations exist.
- **RDR-560** Old dictionaries for the Qurʾān — keep Mufradāt (al-Rāghib), Lisān, Maqāyīs, Lane; consider Qurʾān-specific works (ʿUmdat al-Ḥuffāẓ, Gharīb al-Qurʾān, al-Wujūh wa-l-Naẓāʾir). Arabic UI: Arabic titles first, death dates in AH with CE secondary (e.g. ت ٧١١هـ / 1311م). Compare, apparatus, timeline and cite sources must stay hidden until real per-sense alignment exists — never show hashed placeholder mappings against Qurʾānic words.
- **RDR-561** Meanings language order — the prototype makes English senses primary with one Arabic line; the Arabic-default product should lead with Arabic definitions and show English senses as the second language.
- **RDR-562** Word family and shapes — restrict by default to lemmas attested in the Qurʾān (with occurrence counts per member) and offer "all Arabic" once the dictionary ecosystem lands; wazn data for nominal patterns needs a source (corpus morphology gives verb forms and derivation types, not full noun patterns).
- **RDR-563** Plain-language layer in Arabic — rewrite the 29 entries for Arabic readers (many know جذر/وزن/مصدر; explanations should target what they don't); term detection over Arabic text needs Unicode-aware boundaries (JS `\b` is ASCII-only; use `(?<![\p{L}\p{M}])…(?![\p{L}\p{M}])` with the `u` flag).
- **RDR-564** Ask mode — Arabic heading/placeholder, Qurʾānic “Try” words (e.g. عِلْم، رَحْمَة، صَبْر، قَلْب), clitic-aware and Uthmani-aware matching via lemma lookup, “Heard in” = one well-known verse with reference, the phone deck as المعنى · الأقارب · في القرآن · الوزن; keep the chat-alphabet input for the English UI.
- **RDR-565** Omnibox — detect verse refs in all forms (“2:255”, “٢:٢٥٥”, “البقرة 255”, sūra names with/without ال, juzʾ and page numbers), root letters with or without spaces, lemmas, translation full-text; order groups Verses, Words, Roots, Patterns for the Qurʾān.
- **RDR-566** Citation and permalinks — Qurʾān conventions (“[البقرة: ٢٥٥]”, “Q 2:255”), word-level location (2:255:3), dictionary citations in Arabic (“ابن منظور، لسان العرب، مادة ع ل م”); URL scheme such as `/quran/2/255`, `/quran/2/255?w=3`, `/root/علم`, written to the address bar on every navigation (the prototype never writes the URL).
- **RDR-567** Suggest an edit — limit to lexicon senses, word-by-word glosses and morphology tags; morphology corrections route to the review queue with the two-approval rule and a credit line; no flow may propose changes to the Qurʾānic text.
- **RDR-568** Trails — record verses and roots as steps too (word → verse → tafsīr → root is the natural Qurʾān journey); the map already labels node types.
- **RDR-569** Review deck — root-family review fits Qurʾānic vocabulary study; In-context cloze should draw from verses the learner has read across the whole Qurʾān, render blanks respectfully (underline, keep the reference, never present altered text outside the exercise), offer recitation as a hint, and feed a real SM-2 style scheduler with genuine due counts.
- **RDR-570** Onboarding — Arabic copy and a Qurʾānic demo word (e.g. عِلْمًا in 20:114 «رَبِّ زِدْنِي عِلْمًا»); fix the “Family tab” reference for the layered panel.
- **RDR-571** Rail difficulty per sūra — reframe as vocabulary coverage (“you know 78% of the words in al-Mulk”) and drop “stretch / comfortable / easy” labels that read as judgements of a sūra.
- **RDR-572** Progress and resume — khatma-style progress (last verse read, % of the Muṣḥaf), resume should open on the last verse (the prototype only marks it), and progress should advance on reading/scroll, not only on word taps; the hairline should show position in the sūra or the Muṣḥaf.
- **RDR-573** Scale — al-Baqara has 286 verses and ~6,100 words; whole-chapter rendering, per-render recomputation of occurrence indexes and unvirtualised lists (index, occurrences, family) will not scale; precompute indexes server-side and virtualise.
- **RDR-574** Header meta — replace “{book} · 35 entries · 6 roots · …” with sūra name, Meccan/Medinan, verse count, juzʾ; “Chapter N of M” → sūra number; “end of chapter N” → end-of-sūra marker.
- **RDR-575** Ḥadīth and other books — keep the multi-book model for the ecosystem but make the Qurʾān the default and visually separate; ḥadīth needs isnād/matn split, collection/book/chapter/number references and grading; pasted “Yours” texts stay in a personal shelf.
- **RDR-576** Wrong for Qurʾān content (summary) — TTS recitation; amber/blue word-state paint on the Muṣḥaf; auto-learning on tap; placeholder lexicon articles and hashed sense/corpus mappings; regex stripping of Uthmani marks; unclickable particles; Copy without reference; English-first senses and grammar strings; prose labels (“Chapter”, “passage”, “Prose”); difficulty labels on sūras; the fixed topic list; blanking verses without care.

### 41. Hard-won fixes and subtle rules (keep these)

- **RDR-577** Never a fully-folded panel — if every layer is closed, Meanings is forced open at render (code comment “never a fully-folded panel”).
- **RDR-578** Bidi separation — English is never placed inside an RTL Arabic run: English glosses live in their own LTR elements (compare cells get `direction:ltr; text-align:left; font-style:italic`; apparatus fallbacks get `direction:ltr; unicode-bidi:isolate`), Arabic elements carry `dir="rtl"` on the element itself, and mixed-script inputs/labels use `dir="auto"` (Ask input, omnibox input, Try chips, breadcrumb crumbs, Where-next Arabic slot that may hold a Latin ref like “2:32”).
- **RDR-579** Senses render English and Arabic as separate stacked elements (never concatenated in one run).
- **RDR-580** Glossary regex built longest-first so “form ii”/“form iv” win over “form i”, `\b` keeps “perfect” from matching inside “imperfect”, keys are regex-escaped, and the shared global regex's `lastIndex` is reset before each use.
- **RDR-581** Dotted terms are buttons that stop click propagation, so a term inside a clickable row opens the card without triggering the row.
- **RDR-582** Term card flips above when there is < 150px below the term, clamps its centre to [170, width − 170] so a 320px card never leaves the viewport, caps width at `calc(100vw − 24px)` for 390px phones, and is dark in both themes so it reads as an aside.
- **RDR-583** Popover clamping — hover card centre clamped to [160, width − 160], unknown-word popover to [200, width − 200].
- **RDR-584** Hover hand-off — 160ms hide delay after leaving a word, cancelled when the pointer enters the card, 120ms after leaving the card, so users can move into the card to use it.
- **RDR-585** Long-press 420ms, cancelled by touchmove, so passage tools never appear while scrolling; the passage holding the selected word always shows its tools.
- **RDR-586** Touch targets grow on phone — tools 40px, panel controls and tabs 44px, layer heads 48px, ⋯ items 44px, Ask buttons 44px.
- **RDR-587** Trail hygiene — consecutive duplicates are not appended; cap 40 with oldest dropped; breadcrumb only when ≥ 2 distinct words; clicking a crumb or map node truncates first, then selects, so the click is not re-appended; words opened by `?w=` are recorded.
- **RDR-588** Cousin door prefers a family member not yet visited in the trail, falling back to any member, to avoid loops.
- **RDR-589** Links into sections (doors, term jumps, Ask cards) set both `layerOpen[k]` and `tab`, so they work in layers and tabs mode alike.
- **RDR-590** History capped at 30 with forward history truncated on a new selection; back/forward clear the token selection.
- **RDR-591** Auto-learning never downgrades: a click marks a word 'learning' only if it has no state.
- **RDR-592** Resume marker hidden on the first passage and on the passage currently holding the selection (no redundant marker).
- **RDR-593** Panel width clamp keeps ≥ 420px for reading and ≥ 320px for the panel, re-evaluated on every render and during drag.
- **RDR-594** Rail auto-closes only on the transition into < 1200px and is forced closed on load below 1200px; chapter picks close the overlay rail.
- **RDR-595** Persistence: 250ms debounced save, only when a persisted field changes; restore skips null/undefined so defaults and props still apply; a saved chapter index is validated against the current book.
- **RDR-596** Proposals re-read on window focus so merges from the Review Queue tab appear without reload; the newest merged edit wins; pending edits show a dashed amber frame.
- **RDR-597** Suggest validation — wording required plus a rationale or at least one source.
- **RDR-598** One shared theme key (`jadhr-theme`) written on every toggle, and `.dark` applied to both `<html>` and `<body>`.
- **RDR-599** Lexicon article overflow — measured after `requestAnimationFrame`, only while collapsed, guarded by `isConnected`, and state updated only when the boolean changes (prevents render loops); the fade gradient ends in `--panel` to match the panel background.
- **RDR-600** Scrolling helper finds the nearest ancestor that is actually scrollable (overflow auto/scroll and taller than its box), so the same code scrolls the docked panel, the phone sheet and the reading column; it waits 110ms for the render and debounces.
- **RDR-601** Seeds passed to the Editor are base64 of UTF-8 JSON (`btoa(unescape(encodeURIComponent(json)))`) — plain `btoa` throws on Arabic.
- **RDR-602** Ask: the script hint appears only after the user starts typing; exact matches rank above loose ones; nouns before verbs; frequency breaks ties; chat-alphabet digits (3, 2) and doubled vowels are understood.
- **RDR-603** Normalisation split — matching strips tashkīl and tatweel and folds أ إ آ → ا; display stripping (tashkīl toggle) never folds hamza.
- **RDR-604** Ask toggling closes the panel on entry and reopens it on exit, keeping the front door uncluttered.
- **RDR-605** Selecting a word from the text on phone drops the sheet to half height so the text stays visible; the inline gloss covers the case where the sheet was dismissed.
- **RDR-606** Side-by-side keeps at most three columns, dropping the oldest when a fourth is added (FIFO), so the grid never overflows.
- **RDR-607** Apparatus agreement thresholds — ≥ 60% of the others = shared, ≥ 1 = partial, 0 = unique to the base.
- **RDR-608** Streams labels are hidden when a band is < 6% tall so labels never overlap.
- **RDR-609** Secondary lines scale less than Arabic — transliteration capped at 1.15×, translation at 1.2×, paper width and chapter title at 1.25× — so large Arabic text does not blow up the Latin lines or the measure.
- **RDR-610** Title block uses `min-width:0` + ellipsis so a long Arabic title never pushes header actions off-screen; the Dictionary button is always last.
- **RDR-611** In-context answers are compared after stripping tashkīl and folding hamza on both sides and removing punctuation from the expected surface, so “with or without tashkīl” is true.
- **RDR-612** `put()` deletes keys whose value is null/undefined/empty array, keeping persisted maps (links, topics, dictOff) compact.
- **RDR-613** Audio timer is cleared on restart and unmount; only one passage plays at a time; transitions are disabled on tokens while playing so the highlight tracks exactly.
- **RDR-614** Unknown-word analysis is offered only for tokens longer than two letters that are not common particles, so short function words don't trigger the analyser.
- **RDR-615** Design-round tags in code comments map features to the Before & After rounds: 1b In-context review, 1c/1d timeline lanes/streams, 1e/1f patterns root/wazn, 2a scripture, 2e/2f lexica compare/apparatus, 4e cite, 5a omnibox, 5c unknown word, 5k onboarding, 6a Ask, 6d layered panel, 6e/6f trails.

---

## Part 2 — Graph editor, Split shell, Published graph

_Original heading: Graph editor — feature and parity inventory_

Scope: `prototypes/Lexicon Editor v5.dc.html` (2,627 lines, read in full), `prototypes/Shell.dc.html` (64 lines), `prototypes/Published Graph.dc.html` (81 lines), `prototypes/jadhr-chrome.js` (13 lines), `prototypes/lexicon-data.js` (300 lines; parts used: `KEYS`, `load`, `SCRIPTURE` model). Cross-checked against `04-screen-editor.md`, `06-screens-community.md` §6.6 and §6.9, `08-api-contract.md` §8.6, plus `01` §1.3 (route params), `02` §2.6–2.7, `07` graph tables, `10` §5. Screenshots read: `04-editor.png` (≈924px wide, dark, 34% zoom, map view), `Editor 01.png` (4062×2060, dark, 72%, root selected), `13-published-graph.png` (light; iframe not captured).

Conventions: `Lnnn` = line in the editor file unless another file is named. `[GAP]` = prototype and spec disagree or a spec requirement is missing. `[BUG]` = prototype defect that must not be copied. Copy in "quotes" is verbatim. `{x}` = interpolated value.

Missing from the bundle (affects parity): `Card Field.dc.html` and `Field.dc.html` (imported via `<dc-import name="Card Field">` at L267/L612/L629 and described in spec §4.7) are not in `prototypes/` — field-row behaviour below is reconstructed from spec §4.7 and `Editor 01.png`. `Lexicon Reader v4.dc.html` (target of the editor's Reader link L2070 and of the Shell's reader iframe) is also not in the bundle; only Reader v5 exists.

---

### 1. Inventory

#### 1.1 App shell and layout

- **EDT-001** Shell — full-viewport fixed column: header, then a row of [library panel | canvas | details sidebar]; font stack 'IBM Plex Sans','IBM Plex Sans Arabic',ui-sans-serif; base 12.5px; antialiased (L49, L2405).
- **EDT-002** Header bar — height 52px (spec §4.1 says 48px) [GAP]; bg `--panel`; bottom border `--line`; gap 10px; padding 0 14px; `overflow-x:auto` so the header scrolls sideways on narrow widths (scrollbar visible in `04-editor.png`); hidden entirely (`display:none`) when `embed=1` (L2425).
- **EDT-003** Body row — `flex:1; min-height:0; display:flex` holding the three columns (L107).
- **EDT-004** Design props (prototype tweakables, L711) — `startFolded` bool default true; `showTransliteration` bool default true; `edgeStyle` "curve"|"elbow" default "curve"; `theme` "light"|"dark" default "dark" (overridden by prefs; product default is light); `edgeArrows` bool default true; `mapZoom` range 0.30–0.90 step 0.05 default 0.35 (code fallback 0.65 when prop absent, L1118/L2075); preview 1440×900.
- **EDT-005** Light tokens (L15–24) — canvas #eeeef1, card #ffffff, card-2 #f5f5f8, card-3 #ecedf1, line #e5e5ea, line-2 #d3d3dc, t1 #16161a, t2 #4f4f5a, t3 #71717c, ring #2f6ae0, edge #b7b7c3, dot #d5d5dd, bad #c02626, good #15803d, panel #f8f8fa, shadows `--sh` and `--sh-open`.
- **EDT-006** Dark tokens (L25–34, class `.dark`) — canvas #0f0f12, card #1a1a20, card-2 #22222a, card-3 #2b2b34, line rgba(255,255,255,.08), line-2 rgba(255,255,255,.16), t1 #f2f2f7, t2 #b0b0be, t3 #8d8d9b, ring #7aa2f7, edge #4d4d5b, dot #2a2a33, bad #f07178, good #79d68b, panel #15151a, inset-highlight shadows.
- **EDT-007** Type colours light/dark — root #a8682c/#e0a361, form #6f55c4/#ab92f2, word #2f6ae0/#7aa2f7, sentence #177a44/#6fce88, description #6f6f7c/#9a9aa8; the colour is the type (no other visual type marker at a glance).
- **EDT-008** Fonts — Amiri 400/700/400i (Arabic headwords, lexicon roots, dictionary names), IBM Plex Sans 400/500/600 (UI), IBM Plex Mono 400/500 (transliteration, counts, kbd, notes), IBM Plex Sans Arabic 400/500/600 (palette Arabic names, dictionary stub text) (L13).
- **EDT-009** Motion — `dcRise` (toast: fade + 8px rise, .18s), `dcPop` (scale .97→1: help .16s, context menu .12s), Tidy card glide .38s cubic-bezier(.22,.61,.36,1), port hover .12s (L45–46, L2139).
- **EDT-010** Global styles — 9px rounded scrollbars in `--line-2`; text selection ring 28%; focus-visible 2px ring outline offset 2px on button/a/input/textarea/select (L40–44).

#### 1.2 Header — edit mode (left → right)

- **EDT-011** Logo mark — 18×18, radius 5, `--c-root`; not a link in the editor (L52).
- **EDT-012** Title button — shows the graph title (default "Arabic lexicon graph"); tooltip "Rename"; transparent border that turns `--line-2` on hover; cursor text; min 80px, max 180px, ellipsis (L57, L891).
- **EDT-013** Title edit input — 200px, bg `--card-2`, 1px `--ring` border, radius 6, 13.5px/500; text auto-selected on open; Enter blurs (commits); Escape cancels; blur commits trimmed draft, empty draft keeps the old title; keydown does not reach canvas shortcuts; not an undo commit; triggers save queue (L54, L2409–2412).
- **EDT-014** Presence block (edit only) — "Live" 11.5px t3 with 6px `--good` dot, then overlapping avatar stack (see 1.27) (L61).
- **EDT-015** Save status pill (edit only) — `role="status" aria-live="polite"`; 5px dot + text "saved" / "saving…" / "unsaved" (lowercase in code; spec §4.1 writes "Saved / Saving… / Unsaved") [GAP]; dot `--good` when idle else `--ring`; pill bg card, 1px line, radius 99, 12px t3 (L62, L2273–2275).
- **EDT-016** Spacer (flex 1) (L66).
- **EDT-017** Segmented group [Tidy | Fit] — Tidy tooltip "Re-layout the whole graph (T)", aria-label "Tidy layout"; Fit tooltip "Fit everything in view (F)", aria-label "Fit to view"; group bg card-2, 1px line, radius 9, 2px inset, 1px×16px separators; buttons 13px/500 padding 5×11, hover bg card (L68–72).
- **EDT-018** Segmented group [Undo | Redo] — `disabled` when the stack is empty; tooltip "Undo {last label, lowercased} (⌘Z)" or "Nothing to undo yet"; "Redo {label} (⇧⌘Z)" or "Nothing to redo"; disabled text t3 cursor default, enabled t1; aria-labels "Undo"/"Redo" (L73–77, L2445–2450).
- **EDT-019** Segmented group [Import | Export] — Import tooltip "Load a graph from a JSON file" (clicks hidden `<input type="file" accept="application/json,.json" aria-label="Import graph JSON">`); Export tooltip "Download the graph as JSON" (L78–83).
- **EDT-020** Reader link — book icon + label "Reader", or "Reader · {tr}" when the editor was opened with `?w=&tr=`; tooltip "Back to the reader" / "Back to the reader at {tr}"; href `./Lexicon%20Reader%20v4.dc.html[?w={id}]` — points at a file not in the bundle [BUG] (L84–87, L2064–2071, L2413–2417).
- **EDT-021** Publish button — tooltip "Publish a read-only, embeddable copy of this graph"; card bg, line border, t2, hover ring (L88).
- **EDT-022** Details toggle (both modes) — label "Details", tooltip "Show or hide the details panel"; pressed look when sidebar open (bg card-2, border line-2, t1) (L100, L2555).
- **EDT-023** Theme toggle (both modes) — 30×28; tooltip and aria-label "Switch to the light theme" / "Switch to the dark theme"; `aria-pressed` = dark; moon icon in dark, sun icon in light (L101–103, L2419–2421).
- **EDT-024** Help button "?" (both modes) — 28×28, tooltip "Keyboard shortcuts (?)", aria-label "Keyboard shortcuts"; opens the shortcuts modal (L104).

#### 1.3 Header — read-only mode (published, non-embed)

- **EDT-025** Read-only header order — logo, title, pill "Published · read-only" (11px uppercase, letter-spacing .08em, radius 99, padding 2px 9px), spacer, [Fold | Unfold | Fit], Fork, Details, theme, "?". No presence, save status, Tidy, Undo/Redo, Import/Export, Reader, Publish (L59, L90–99).
- **EDT-026** Fold — tooltip "Fold every card to its headline" → folds every card (frames untouched) (L92, L2429).
- **EDT-027** Unfold — tooltip "Unfold every card" (L94).
- **EDT-028** Fit — tooltip "Fit everything in view (F)" (L96).
- **EDT-029** Fork — filled dark link (bg t1, text canvas colour) "Fork", tooltip "Copy this graph into your own editor", href editor `?fork={slug}` (L98, L2430).
- **EDT-030** [GAP] Spec §4.1 says read-only replaces the edit actions with "Fork, Cite, Open in editor"; the prototype editor header has Fold/Unfold/Fit + Fork only. Cite lives on the Published Graph page; "Open in editor" exists nowhere except Classroom's overlay link.
- **EDT-031** [BUG] Read-only title is still click-to-rename (no `ro` guard on `startTitleEdit`/`commitTitle`); production must render it static.

#### 1.4 Library panel (left) — palette, roots, search

- **EDT-032** Panel — width 238px, bg panel, right border; edit mode only (never rendered in read-only, not even the rail); open state persisted as `leftOpen` (default open) (L118–119, L2428).
- **EDT-033** Collapsed rail — 36px; chevron button tooltip "Show the library panel"; vertical label "Library" (rendered uppercase; 11px, letter-spacing .14em, `writing-mode:vertical-rl`) (L109–116).
- **EDT-034** Search field — `type="search"`, placeholder "Find a card…", aria-label "Find a card"; card bg, line border, focus border ring; next to it a chevron button tooltip "Hide this panel" (L122–125).
- **EDT-035** Search matching — case-insensitive substring over `ar + tr + en + every field value` (`String(value)`, so tag arrays match as comma-joined text); query trimmed; no Arabic normalisation (diacritics/alef-sensitive) (L1187–1191).
- **EDT-036** Search results row (only when query non-empty) — "{n} of {total} cards match"; "↑" tooltip "Previous match (⇧Enter)" aria "Previous match"; "↓" tooltip "Next match (Enter)" aria "Next match"; "✕" tooltip "Clear search" aria "Clear search" (hover red) (L127–134, L2454).
- **EDT-037** Search keys inside the input — Enter → next match; Shift+Enter → previous; Escape → clear; key events stop there (L2475–2479).
- **EDT-038** Step match — cycles matching cards in document order from the current single selection; selects, opens Details, centres the card, toast "Match {i} of {n}"; no matches → toast "Nothing matches that search" (L1780–1789).
- **EDT-039** Search on canvas — non-matching cards opacity .22; matching cards get border mix(ring 55%, line) and a 3px ring halo (18%); frames and edges unaffected (L2084–2085, L2134–2137).
- **EDT-040** "Card types" header — a button (aria-expanded, tooltip "Show or hide the card types") with "Card types" left (rendered uppercase) and "Hide"/"Show" right; collapsed state persisted as `paletteHelp` (true = list hidden; inverted naming) (L139–142, L2431–2433).
- **EDT-041** Card-type tile (×5) — dot in type colour, English label 12.5px/500, Arabic name right (RTL, Plex Arabic 12.5px: Root "جَذْر", Form "وَزْن", Word "كَلِمَة", Sentence "جُمْلَة", Description "وَصْف"), one-line hint 11.5px with ellipsis, full hint as tooltip; card bg, line border, radius 10, padding 8×9; hover ring border + shadow; cursor grab; draggable (L145–155, L2455–2461).
- **EDT-042** Card-type hints — Root "The consonantal skeleton a whole family of words grows from."; Form "A pattern the root is poured into — فَاعِل, مَفْعَل, تَفْعِيل."; Word "A realised lexeme: root plus form, with its own gloss."; Sentence "A citation. Draws its links from every root, form and word it uses."; Description "A free note. Attaches to a card of any type." (L721–725).
- **EDT-043** Card-type add — drag (dataTransfer `text/plain` = type) and drop at the pointer; or click → adds at world point ((−tx+320)/k, (−ty+220)/k) i.e. a fixed offset inside the current viewport (L2459–2460).
- **EDT-044** "Roots in the lexicon" list (heading rendered uppercase) — one tile per lexicon root: spaced Arabic letters (Amiri 19px, letter-spacing .06em, RTL), transliteration (mono 11px, right), English gloss (11.5px), counts "{F} forms · {W} words" (no singular: "1 forms · 1 words" for ف ي) [BUG] (L160–173, L2462–2464).
- **EDT-045** Lexicon root tile state — already on canvas → opacity .55 and tooltip "Already on the canvas"; else tooltip "Drag onto the canvas to start from this root"; drag payload "lex:{i}"; click adds at the viewport offset; if already present → selects it + toast "That root is already on the canvas" (L1322–1329, L2465–2469).
- **EDT-046** Lexicon content in prototype — ك ت ب k-t-b "writing, inscribing, recording" (8 forms · 9 words); د ر س d-r-s "studying, learning by repetition" (7·7); ع ل م ʿ-l-m "knowing, marking, signing" (8·8); ق ر أ q-r-ʾ "reading, reciting aloud" (3·3); ج ل س j-l-s "sitting, being seated" (3·3); ف ي f-y "in, at, within" (1·1, particle pseudo-root "carried here so a sentence can link every token it uses, function words included") (L757–824).
- **EDT-047** Keyboard-shortcuts footer button — "Keyboard shortcuts" + "?" kbd chip; opens the help modal (L175–178).

#### 1.5 Canvas — viewport, grid, pan, zoom, map view, fit, marquee

- **EDT-048** Canvas pane — flex 1, overflow hidden, bg `--canvas`; dot grid `radial-gradient(circle at 1px 1px, var(--dot) 1.1px, transparent 0)` with size 24×k px and position (tx, ty) so dots track the world (L2527–2530).
- **EDT-049** World layer — `transform: translate(tx,ty) scale(k)`, origin 0 0; initial tx 60, ty 60, k 1 (L887, L2531).
- **EDT-050** Edge layer — one 24000×24000 SVG offset by −12000 (so wires render at negative coordinates), pointer-events none except wire hit paths (L185–199).
- **EDT-051** Plain wheel / two-finger trackpad drag pans (deltaX, deltaY); Shift+wheel pans horizontally (L1589–1590).
- **EDT-052** Ctrl/⌘ + wheel (and trackpad pinch, which emits ctrl-wheel) zooms anchored at the pointer: k × 0.99^deltaY, clamped 0.12–2.4 (L1582–1587).
- **EDT-053** Space-drag or middle-button drag pans; cursor "grab" while space held, "grabbing" while panning; Space ignored when focus is on a button or link; space state released on keyup and on window blur (L1616–1623, L1855–1858, L1078–1079).
- **EDT-054** Marquee — left-drag on empty canvas draws ring-bordered box (ring 12% fill, radius 4); counts as a drag after >3px; cards hit when intersecting; frames hit only when fully enclosed; Shift keeps and extends the existing selection; release opens Details when the selection is non-empty (L1624–1636, L1686–1690, L1713, L2541–2543).
- **EDT-055** Click on empty canvas — clears card selection, wire selection, field menu, extract menu, context menu (L1626–1628).
- **EDT-056** Zoom control (bottom-right, z 45) — "−" tooltip "Zoom out (−)" aria "Zoom out"; centre label "{round(k×100)}%" tooltip "Reset to 100% (1)" aria "Reset zoom to 100 percent"; "+" tooltip "Zoom in (+)" aria "Zoom in"; steps ×/÷1.25 anchored at pane centre; reset → 1 anchored at centre (L392–396, L2514–2516, L2545).
- **EDT-057** No minimap — neither the prototype nor the spec has one; the zoom pill and the map-view badge are the only viewport chrome.
- **EDT-058** Map view (level of detail) — when k < `mapZoom` (0.35): every card shows an overlay (absolute, radius 18, bg card, z 1, padding 0 22px) with Arabic Amiri 50px (sentence 34px; root letter-spacing .08em; nowrap ellipsis) and a row of 11px dot + mono 26px transliteration (or English when no tr / transliteration off), cut to 26 chars; card detail becomes `visibility:hidden` (not removed); ports hidden (L215–223, L2086, L2109–2114).
- **EDT-059** Map-view badge (bottom-left, z 45) — ring dot + "Map view — zoom in for card detail" (L397–401).
- **EDT-060** Fit (F, header Fit, ctx "Fit to view", after extract/accept/import) — re-measures card heights, takes the bbox of all nodes including frames, padding factor 1.1, k = clamp(0.34, fitted, 1) so it never zooms above 100% and the minimum lands just under map threshold, then centres (L1560–1571).
- **EDT-061** Centre-on — used by search step and comment jump; keeps k, centres the card (L1601–1605).
- **EDT-062** Ensure-visible — used by arrow-key navigation; pans the minimum needed to keep the card ≥44px inside the pane (L1606–1615).
- **EDT-063** Empty canvas state — centred dashed box (max 290px, radius 16, card 72% bg): edit "Nothing on the canvas" / "Drag a root in from the library, or drop a card type to start from scratch. Right-click anywhere to add one here."; read-only "This published graph has no cards" / "The author published an empty canvas."; unknown slug "Graph not found" / "It may have been unpublished, or the link is from another device. Published graphs live with their author’s account." (L363–370, L2426–2427).
- **EDT-064** Drop target — canvas accepts HTML5 drops of "lex:{i}" (lexicon root) or a type name (blank card) at the pointer's world coordinates; dragover always allowed (L1750–1757).

#### 1.6 Context menu and quick-add

- **EDT-065** Context menu container — min-width 200, bg card, 1px line-2, radius 11, `--sh-open`, dcPop .12s, z 60; each item = label (ellipsis) + mono 11px key hint; danger items in `--bad`; position clamped inside the pane (x ≤ width−214, y ≤ height−250, ≥6) (L372–381, L1835–1846, L2380–2385).
- **EDT-066** Empty-canvas menu (quick-add) — "New root", "New form", "New word", "New sentence", "New description" (each creates a blank unfolded card at the right-click world point), "Tidy layout" key "T", "Fit to view" key "F" (L2375–2379).
- **EDT-067** Card menu — right-click selects the card first if not selected; items "Unfold card"/"Fold card" key "↵"; the card's extract label when enabled (e.g. "Extract 5 forms") key "E"; "Attach description"; "Duplicate" key "⌘D"; "Group {n} cards" key "⌘G" (only when >1 selected); "Delete card" or "Delete {n} cards" key "⌫" (danger) (L2367–2374, L2115).
- **EDT-068** Frame menu (right-click the group bar) — "Select cards inside"; "Ungroup" key "⇧⌘G"; "Delete group" key "⌫" (danger) (L2363–2366, L2177).
- **EDT-069** Menu dismissal — any keydown except Escape closes it (Escape closes via the global handler), item click, canvas mousedown, any commit; disabled entirely in read-only (browser menu also suppressed) (L1836, L1852, L1397).
- **EDT-070** Quick-add inventory — palette click/drag, lexicon-root click/drag, right-click "New …", "+ Description" (card, sidebar, ctx "Attach description"). No double-click-to-create on empty canvas.

#### 1.7 Toast surface

- **EDT-071** Toast — absolute bottom 56px centred pill, z 50, bg card, line-2 border, `--sh`, 13px, `role="status" aria-live="polite"`, dcRise; optional "Undo" button inside when the action is undoable; auto-dismiss 5.2s if undoable else 2.6s; a new toast replaces the old (L383–390, L1436–1440).

#### 1.8 Node kinds, lexicon model, default document

- **EDT-072** Card kinds — `root`, `form`, `word`, `sentence`, `description`; plus non-semantic `frame` (`kind:"frame"`) (L712, L1767).
- **EDT-073** META per type — label, Arabic name, colour, childName (root "forms", form "words", word "sentences", sentence "links", description "attachments"), hint (L720–726).
- **EDT-074** Default document (edit mode, and `view=sample`) — root ك ت ب (k-t-b, "writing, inscribing, recording", unfolded, Semantic field tags writing/records/script, Attestations 214); forms فَاعِل fāʿil "active participle", مَفْعَلَة mafʿala "noun of place (fem.)", فِعَال fiʿāl "verbal noun"; words كَاتِب kātib "writer, clerk", مَكْتَبَة maktaba "library, bookshop", كِتَاب kitāb "book"; sentences "قَرَأْتُ كِتَابًا فِي المَكْتَبَةِ." and "الكَاتِبُ يَجْلِسُ إِلَى مَكْتَبِهِ."; description "وَصْف الجَذْر" (waṣf al-jaḏr, "Root note") with Body = root note and Reference link "https://en.wikipedia.org/wiki/Semitic_root" — 10 cards, 10 edges (L853–885).
- **EDT-075** Default-document edges — root→each form, form→its word, root→description, and word→sentence for every cited word already on the canvas (s0 ← kitāb, maktaba; s1 ← kātib) (L866–884).
- **EDT-076** Sentence corpus (prototype) — 10 sentences `{ar, tr, en, ment[] (cited word transliterations), src}` with src "Modern Standard" / "Colloquial" / "Literary" / "Proverb" (L826–837).
- **EDT-077** Lexicon pointer `src` — root `{i}`, form `{i,j}`, word `{i,j,k}`, sentence `{q}`; `null` for hand-made, duplicated, accepted-proposal and description cards (L857–860, L1461, L1053).
- **EDT-078** Deterministic lexicon ids — root "r{i}", form "r{i}f{j}", word "r{i}f{j}w{k}", sentence "s{q}"; used to know what is "already on the canvas" and to avoid duplicates (L1196–1204).
- **EDT-079** Generated ids — prefix + sequence + 3 random base36 chars: manual "m…", description "d…", accepted proposal "p…", frame "g…", edge "e…", field "f…" (L718).
- **EDT-080** Seed fields per type — root: Tags "Semantic field" + Number "Attestations"; form: Select "Productivity" [common, restricted, rare] = common; word: Select "Part of speech" [noun, verb, adjective, particle] = pos or noun + Audio "Pronunciation"; sentence: Short text "Source" = src + Select "Register" [formal, neutral, literary, colloquial] = neutral; description: Notes "Body" (L843–849).
- **EDT-081** Blank card headwords — root "ج ذ ر", form "وَزْن", word "كَلِمَة", sentence "جُمْلَة", description "وَصْف"; tr and en empty; unfolded; snapped to 8px; selected; commit "Add {Type}"; blocked in read-only (L1313–1321).
- **EDT-082** Fold defaults — extracted/imported-legacy cards follow `startFolded` (folded); unfolded on creation: seeded root, palette/ctx new cards, lexicon roots from the library, "+ Description" cards, `note=` seed card (L854, L862, L1235, L1318, L1326, L1307, L1020).

#### 1.9 Card anatomy

- **EDT-083** Card box — absolute at (x, y); width 248 folded / 344 open; height auto and measured (estimates 112 / 360 until measured); bg card; radius 18 (spec §4.2 says 12) [GAP]; 1px line border; shadow `--sh` folded / `--sh-open` open; z 10, open 20, selected 30; cursor grab; user-select none; `data-card={id}`; `data-screen-label="{Type} {tr or ar}"` (L713, L2089, L2132–2139).
- **EDT-084** Selected look — border `currentColor` + `0 0 0 3.5px` halo of type colour at 22% (spec says `outline: 2px solid var(--ring)`) [GAP] (L2134–2136).
- **EDT-085** Header row — type pill (5px dot + uppercase 11px/600 label, letter-spacing .1em, bg type colour 12%, radius 99) on the left; counts on the right (11px t3, nowrap) (L226–233).
- **EDT-086** Counts copy — root "{n} form(s) · {n} word(s)" (words = all descendant words); form "{n} word(s) · {n} sentence(s)" (descendant sentences); word "{n} sentence(s)"; sentence "{n} link(s)" (incoming edges); description "attached to {n}"; singular handled (e.g. "1 word · 1 sentence", "2 links") (L1979–1990).
- **EDT-087** Arabic headword — `dir="rtl"`, Amiri, `text-align:left`; folded 23px single line ellipsis; open 31px (sentence 25px) wrapping with `text-wrap:pretty` and `word-break:break-word`; root letter-spacing .08em; line-height 1.45 (L234, L2129–2131).
- **EDT-088** Folded summary line — "{tr} · {en}" (tr dropped when transliteration off) or "—"; 11.5px t2 ellipsis (L235–237, L2093).
- **EDT-089** Open text — transliteration mono 12px t3 (only when shown and non-empty); English 13px t2 line-height 1.5 ("—" when empty) (L238–245, L2092).
- **EDT-090** Open stats strip — divider, then 2–3 stats (value 14px/500 tabular-nums, uppercase 11px label) with 16px gap (L248–258).
- **EDT-091** Stats per type — root [forms (non-description children), words (descendants), to extract]; form [words, sentences (descendants), to extract]; word [sentences (sentence children), parents, to extract]; sentence [linked (parents), words (whitespace tokens of the Arabic), to link (words + roots available)]; description [attached to, fields] (L1953–1978).
- **EDT-092** Open fields section — label "Fields" (rendered uppercase) + rule + "+ Add" (tooltip "Add a field of any type"; hidden in read-only) → 2-column menu of the 10 field kinds (L260–279, L2127).
- **EDT-093** Card field rows — Card Field component at card density (22px hint), label + value editor + "×" remove; labels are not editable on the card (only in Settings) (L266–268, L2098).
- **EDT-094** Empty fields copy — "No fields yet. Add any input type — text, notes, number, select, tags, audio, image, file, link, date." (L270).
- **EDT-095** Primary action — extract button (+ optional caret, options list, note) — see 1.11 (L281–302).
- **EDT-096** Card action row — "+ Description" (tooltip "Attach a note to this card") and "Focus" (tooltip "Select this card and its children" → selects card + its non-description children) (L303–307, L2104–2107).
- **EDT-097** Fold strip — 22px bar at the bottom; down chevron when folded (tooltip "Unfold to see everything and extract related cards"), up chevron when open (tooltip "Fold this card"); click toggles; hover t1 (L312–319, L2097).
- **EDT-098** Double-click anywhere on a card toggles fold (L214).
- **EDT-099** Fold is not an undo step; it queues a save, re-measures heights and closes the card's field/extract menus (L1385–1392).
- **EDT-100** Inner buttons swallow mousedown so they never start a card drag (L264, L283, L305, L2128).
- **EDT-101** Reference render (`Editor 01.png`) — open root shows "3 forms · 3 words"; stats "3 FORMS / 3 WORDS / 5 TO EXTRACT"; Semantic field chips "writing ×", "records ×", "script ×" with an "add tag" input; Attestations input "214"; per-row "×"; filled root-colour "Extract 5 forms"; "+ Description" and "Focus"; folded forms show "1 word · 1 sentence"; sentences "1 link"/"2 links"; description "attached to 1".

#### 1.10 Fields

- **EDT-102** Field kinds and menu labels — text "Short text", notes "Notes", number "Number", select "Select", tags "Tags", audio "Audio", image "Image", file "File", link "Link", date "Date" (L736–742).
- **EDT-103** Field defaults — tags [], number 0, notes "", text "", select "one" with options ["one","two","three"], audio/image/file/link/date "" (L743, L1337).
- **EDT-104** Add field — new label = the kind's menu label; commit "Add {label lowercased} field"; closes both menus (L1332–1342).
- **EDT-105** Edit value — commit "Edit field"; `fileName` kept unless a new one is supplied (file/image/audio uploads) (L1343–1351).
- **EDT-106** Rename label — commit "Rename field"; Settings sidebar only (L1352–1360, L2237).
- **EDT-107** Remove field — commit "Remove field" (L1361–1366).
- **EDT-108** Field model passed to the component — `{id, kind, label, value, options, fileName, commit(value, fileName), remove(), onLabel(value) | null}` (L1945–1952).
- **EDT-109** Field component behaviour (spec §4.7, file absent) — local draft; commit on blur or Enter; revert on Esc; editable-label variant; tag input with removable chips; two densities (Field 280×60, Card Field 300×64) → build as one controlled component with two density variants.

#### 1.11 Extract and lexicon actions

- **EDT-110** Extract button style — flex 1, radius 7, 12.5px/500, centred; enabled = filled in type colour with text `var(--card)`; disabled = transparent, t3, dashed line-2 border (no source / description) or solid line border (all done) (L1995, L2001, L2045, L2054).
- **EDT-111** Root — "Extract {n} forms", tooltip "Extract the related forms from the lexicon (E)"; adds missing forms at (x+344+156, y + q×130), links root→form; commit "Extract {n} forms"; toast "Extracted {n} forms" (undoable); then Tidy + Fit (L1239–1267).
- **EDT-112** Form — "Extract {n} words" (form→word), same flow (L1253–1257).
- **EDT-113** Word — "Extract {n} sentences": adds sentences that cite the word; links word→sentence and also every other cited word already on canvas → sentence (L1258–1263).
- **EDT-114** All done — "All forms extracted" / "All words extracted" / "All sentences extracted", disabled, tooltip "Nothing left to pull in" (L2042–2047).
- **EDT-115** Sentence primary + caret — primary label = first option ("Link {n} word(s)" if any cited word is unlinked, else "Extract {n} root(s)"), tooltip "{label} from the lexicon (E)"; caret 32px outlined in type colour, tooltip "Choose what to pull in — words, their roots, or both", toggles the options list (L2010–2040, L285–287).
- **EDT-116** Sentence options list — "Link {n} words" with sub-line of Arabic words joined "  ·  "; "Extract {n} roots" with sub-line of root Arabic; "Link words and roots" (only when both exist) with both lists; each option a card-style button (label 12px/500, Amiri 14px sub) (L2019–2031, L290–299).
- **EDT-117** Sentence link-words — for each cited word missing, ensures root (x−460, empty tags, attestations 0) → form (x−300) → word (x−160) and links root→form→word→sentence; roots mode links root→sentence; commit "Link {phrase}", toast "Linked {phrase}" (undoable) where phrase = "{n} word(s)" / "{m} root(s)" / "{n} words and {m} roots"; closes menu; Tidy + Fit (L1269–1301).
- **EDT-118** Sentence all linked — "All words and roots linked", disabled, tooltip "Nothing left to link" (L2013–2017).
- **EDT-119** Description — "Attached note", disabled, tooltip "Descriptions have no children", note "Link this note to any card by dragging from one of its four edge dots." (L1998–2003).
- **EDT-120** Hand-made card — "No lexicon entry", disabled, tooltip "This card was created by hand", note "Cards made by hand have nothing to extract from. Fill in the headword, then link children yourself." (L2004–2009).
- **EDT-121** "E" key — extracts on the single selected card (sentence: words if any unlinked, else roots) (L1874–1877, L1241).
- **EDT-122** "+ Description" — new description card (ar "وَصْف", en "New note", fields [Notes "Body" empty]) unfolded at (x+24, y+180), edge card→description, selected; commit "Add description" (L1302–1312).
- **EDT-123** Availability rules — forms not yet on canvas; words not yet on canvas; sentences citing the word's tr not yet on canvas; cited words not on canvas or not linked to this sentence; distinct roots of cited words not tied (either direction) to the sentence (L1194–1232).

#### 1.12 Edges and handles

- **EDT-124** Edge record — `{id, source, target}`; directed; no stored label or relation type (L866, L1735).
- **EDT-125** Ports — four per card (n, e, s, w), 10px circles, 2px `currentColor` border, bg card, z 2; opacity .32 idle, 1 when the card is selected or any wire is being dragged; hover scale 1.5 + filled; cursor crosshair; tooltip "Drag out to link · drop a wire here to receive one"; hidden in map view and in read-only (L322–324, L2116–2123).
- **EDT-126** Connect drag — dashed preview in screen space (ring, 1.6px, dash "5 4") from the port point, curving out along the port normal toward the pointer; drop on any part of a card or on a port (`data-handle="{id}|{side}"`) (L353–357, L1673–1680, L1719–1724, L2533–2540).
- **EDT-127** Connect validation order — same card → ignored; existing same-direction edge → toast "Those cards are already linked"; disallowed pair → toast "{Source type} cannot link to {target type, lowercase} — try a description"; would create a cycle → toast "That would make a loop"; else commit "Link {Source} → {Target}" (L1726–1737).
- **EDT-128** Allowed links (ALLOW) — root → form, sentence, description; form → word, sentence, description; word → sentence, description; sentence → description; description → root, form, word, sentence. Nothing else (no root→word, no reverse spine, no description→description, nothing → root except description) (L728–734). [GAP] spec §4.2 says "any pair may be linked".
- **EDT-129** Port sides are not stored — computed each render: horizontal (e→w or w→e) when horizontal gap ≥24px and vertical gap <24px; vertical (s→n / n→s) for the reverse; otherwise by the dominant axis (L1896–1907).
- **EDT-130** Curve geometry — cubic Bézier; control offset = clamp(34, distance×0.42, 150) along each port normal; "elbow" prop variant = orthogonal 3-segment path through the midpoint (L1908–1923).
- **EDT-131** Arrowhead — marker at the target end (5×5 stroke units, `context-stroke` fill, auto-start-reverse) when `edgeArrows` is on (default) (L187–189, L2152).
- **EDT-132** Wire states — idle `--edge` 1.25px, opacity .68 light / .80 dark; hot (touches selection) source-type colour 1.9px, .95; picked `--ring` 2.4px dashed "7 5", opacity 1; widths × 1/clamp(k, .4, 1) so wires keep screen weight when zoomed out (L2143–2159).
- **EDT-133** Wire hit target — duplicate transparent 18px stroke path; click selects the wire (clears card selection and field menu); mousedown swallowed so it never starts a marquee (L192–194, L2157–2158).
- **EDT-134** Selected-wire pill — at the curve midpoint (Bézier t=.5), z 40: relation text 12px t2 + "✕ Unlink" button (red, tooltip "Delete this wire (⌫)") (L343–350, L2388–2402).
- **EDT-135** Relation copy — root>form "root → pattern · derives"; form>word "pattern → word · realises"; word>sentence "word → passage · attested in"; sentence>word "passage → word · cites"; sentence>root "passage → root · cites"; root>word "root → word · derives"; anything → description "describes"; else "{a} → {b}" lowercase; fallback "link" (L2393–2395).
- **EDT-136** Delete wire — ⌫/Delete with a wire selected, or "✕ Unlink": commit "Remove link", toast "Wire deleted" (undoable); Settings Links "✕": commit "Remove link" without toast (L1373–1382, L1864).
- **EDT-137** Deleting a card removes its incident edges (L1447).
- **EDT-138** Wire selected → Details shows "Nothing selected" (no edge inspector) (L2158, L2196).
- **EDT-139** Spec §4.2 — edges "never carry labels" on the canvas; the prototype shows a relation label only in the selected-wire pill (consistent).

#### 1.13 Frames (groups)

- **EDT-140** Frame record — `{id "g…", kind "frame", label, x, y, w, h}`; default label "Group"; no type, no fields (L1767).
- **EDT-141** Group — ⌘G or ctx "Group {n} cards": needs ≥2 non-frame cards else toast "Select two or more cards to group them"; bbox + 24px sides/bottom + 44px top (room for the bar), snapped; commit "Group {n} cards"; selects the frame; opens Details on Settings; toast "Grouped {n} cards — name it in Details" (undoable) (L1759–1772).
- **EDT-142** Ungroup — ⇧⌘G, ctx or Settings: removes selected frames only (cards stay); commit "Ungroup"; toast "Group released" (undoable); nothing selected → toast "Select a group to release it" (L1773–1778).
- **EDT-143** Frame look — 1.5px dashed line-2 border (selected: 2px solid ring), radius 16, bg card at 35%, z 1, pointer-events only on bar and handles (L2172–2173).
- **EDT-144** Group bar — 26px, bg card-2, bottom border, 12.5px t2; label (500, ellipsis) + "{n} card(s)"; tooltip "Group “{label}” — drag the bar to move it and the {n} cards inside."; drag moves frame + all fully-contained cards; double-click selects the cards inside (L201–206, L2170–2178).
- **EDT-145** Resize handles — 8 (n/s/e/w strips inset 16px, 4 corner squares 13px drawn only when selected), tooltip "Resize group", cursors ns/ew/nwse/nesw; min 64px; snapped 8px; release with movement pushes undo "Resize group" (L207–209, L1645–1653, L1691–1699, L2165–2183, L1714).
- **EDT-146** Membership — geometric: cards whose rect lies fully inside the frame, computed live; not stored in the document (L1637–1644).
- **EDT-147** Frames excluded from cards(), counts, fold-all, search, Meaning tab; included in ⌘A, Export/Import counts and Fit bounds (L1168, L1563).
- **EDT-148** Selecting a frame switches Details to the Settings tab (L1670–1671).
- **EDT-149** Frame Settings — header "Group · {label or 'untitled'}", neutral badge "Group"; "Group name" section label (both rendered uppercase) above the input (placeholder "Untitled group", aria "Group name"; renames live per keystroke, not undoable, queues save); note "{n} cards sit inside. Dragging the group bar moves them all together." (singular "1 card sits"); actions "Select inside" (tooltip "Select the cards in this group"), "Ungroup" (tooltip "Release this group (⇧⌘G)"), "Delete" (danger, tooltip "Delete the group frame (⌫)") (L652–658, L2197–2216).

#### 1.14 Tidy (auto-layout)

- **EDT-150** Columns by type — root 0 → form 1 → word 2 → sentence 3; a description takes its anchor's column (first incoming edge's source, else first outgoing edge's target), offset +28px right, stacked under the anchor (L1491–1500, L1528–1533, L1540).
- **EDT-151** Column x — cumulative (widest card in column + 156px gap) (L1505–1508).
- **EDT-152** Vertical placement — each parent centred on the span of its children (first and last placed child centres); never above the column cursor; 56px vertical gap; visit order by rank then current y (stable relative order) (L1509–1527).
- **EDT-153** Uses live measured heights (`offsetHeight`) so open cards never overlap; normalises top to y=0; snaps to 8px; animates left/top .38s (state `animating` ~460ms) (L1484–1490, L1534–1556).
- **EDT-154** Frames re-wrap their previous members after layout (24px sides/bottom, 40px top) (L1544–1552).
- **EDT-155** Undo — pushes "Tidy layout"; also runs automatically 200ms after mount (edit mode, `view=sample`, legacy publishes), after Extract/Link, after Accept, after Import — always followed by Fit (L1101, L1267, L1300, L1065, L957).

#### 1.15 Selection, drag, keyboard navigation

- **EDT-156** Click a card — selects only it unless it is already part of a multi-selection (then the drag moves all); Shift+click toggles membership; selecting always opens the Details panel (L1654–1672).
- **EDT-157** Drag — moves the selection (selected frames bring their contents), snapped 8px; undo "Move card" / "Move {n} cards" recorded only if something moved (L1700–1705, L1715–1718).
- **EDT-158** ⌘A — selects all nodes including frames; opens Details (L1860).
- **EDT-159** Arrow navigation with a selection — → first non-description child, else first description; ← first parent; ↑/↓ cycle siblings under the first parent (or all cards of the same type when parentless); selects, opens Details, ensure-visible (L1810–1825).
- **EDT-160** Arrows without a selection — pan 56px (Shift 160px) (L1792–1799).
- **EDT-161** ⌥+arrows — nudge selection 8px (⇧ 32px); commit "Nudge selection" per keypress (L1800–1809).
- **EDT-162** Escape — clears selection, wire selection, field and extract menus, context menu, help modal (L1886).
- **EDT-163** Enter — single card toggles fold; multi-selection sets all to the opposite of the first card's state (frames ignored) (L1867–1873).

#### 1.16 Details sidebar (right) — shell, header, breadcrumb, tabs

- **EDT-164** Sidebar — width `clamp(380px, 30vw, 560px)`, bg panel, left border; present in both modes; open state persisted (L413–414).
- **EDT-165** Collapsed rail — 36px, chevron tooltip "Show the details panel", vertical "Details" label (rendered uppercase) (L404–411).
- **EDT-166** Sidebar header — text 13px/500 ellipsis: "Nothing selected" | "{Type} · {tr or ar}" | "{n} cards selected" | "Group · {label}"; badge (type-coloured pill, colour 14% bg; or neutral "Group", rendered uppercase); "✕" tooltip "Hide this panel" (L415–421, L2196–2260).
- **EDT-167** Breadcrumb — single card with parents: chips for the first-parent chain (root first, max 8 hops) "{Type} · {tr or ar}", tooltip "Select this {type}", click selects (L423–429, L1826–1834, L2224–2231).
- **EDT-168** Tabs — "Meaning", "Settings", "Comments · {n}" (edit mode only; plain "Comments" when 0), "Proposals · {pending}" (only while proposals exist); equal-width buttons; active bg card + line-2 border + t1, inactive transparent t3 (L431–435, L2277–2279, L2558–2561).
- **EDT-169** Tab switching rules — default Meaning; selecting a frame → Settings; Group action → Settings; seed proposals → Proposals; "Discard all" → Meaning (L1671, L1770, L993, L2616).

#### 1.17 Meaning tab (entry)

- **EDT-170** No single card — "Select a card on the canvas to read its entry." or "{n} cards selected. Pick a single card to read its entry." (L439–441, L2281–2286).
- **EDT-171** Hero — Arabic 42px Amiri RTL; transliteration mono 12.5px (or "—"); grammar line right-aligned 12px t3; gloss 13.5px t1 ("No gloss written yet." when empty) (L444–452, L2308–2313).
- **EDT-172** Grammar line — word "{Part of speech value or 'lexeme'} · from {root tr}" or "… · root not linked"; root "{n}-letter root · {k} forms on canvas" (n = space-separated tokens of the Arabic); form "morphological pattern"; sentence "citation"; description "editorial note" (L2310–2312).
- **EDT-173** Root row — root Arabic 21px (letter-spacing .08em) + transliteration + 26px "+" button; root found by walking parents up to depth 8, else the card's lexicon pointer; tooltip "Select the root card" / "Add this root to the canvas" / "No root linked to this card yet"; action selects / adds from lexicon at the viewport offset / toast "This card has no root linked yet" (L454–459, L2288–2320).
- **EDT-174** Editorial summary — caption "Editorial summary — our wording, not a lexicographer's."; body = lexicon root note (via the card's root index) else first Notes field else "No editorial summary written for this card yet — add a Notes field or type one in Settings." (L461–463, L2321).
- **EDT-175** Attestation line — first Number field when >0 → "{n} attestations recorded in this lexicon"; else "No attestation count recorded yet." (L464, L2322).
- **EDT-176** "View in dictionaries" pill — 3-bar glyph, tooltip "Open the dictionary list below"; opens the list (does not scroll) (L465–472, L2323).
- **EDT-177** Dictionaries header — "Dictionaries and lexica" (13px/600) with chevron (tooltip "Show or hide the list"); sub "Public-domain classical lexica, ordered by compiler death date."; pill "About these labels" (tooltip "What the labels mean") toggling the box "Nine lexica, the same set the reader shows. Labels describe each lexicon’s scope and transmission as catalogued by modern editors — not a ranking of authority." (L475–492, L2329).
- **EDT-178** Dictionary list (death-date order, tag chip) — كتاب العين Kitab al-Ayn, al-Khalil ibn Ahmad al-Farahidi · d. 786, "earliest"; تهذيب اللغة Tahdhib al-Lugha, al-Azhari · d. 980, "general"; الصحاح al-Sihah, al-Jawhari · d. 1003, "selective"; مقاييس اللغة Maqayis al-Lugha, Ibn Faris · d. 1004, "root-semantic"; المفردات Mufradat al-Quran, al-Raghib al-Isfahani · d. 1108, "interpretive"; لسان العرب Lisan al-Arab, Ibn Manzur · d. 1311, "comprehensive"; القاموس المحيط al-Qamus al-Muhit, al-Fayruzabadi · d. 1414, "concise"; تاج العروس Taj al-Arus, Murtada al-Zabidi · d. 1791, "encyclopedic"; معجم لين Lane's Lexicon, Edward William Lane · d. 1893, "english" (L745–755).
- **EDT-179** Dictionary row — Arabic name Amiri 20px (min-width 112) + English 13px/600 + chevron (tooltip "Show or hide this entry"); meta "{author} · d. {year}" + tag chip (11px, line border, radius 99); first two entries open by default; open state per dictionary kept for the session across card selections (L496–514, L2330–2347).
- **EDT-180** Open entry — left-ruled block: stub = the root's Arabic (Plex Arabic 13.5px, line-height 2, RTL) + mono note "entry text for {root tr or ar} — drop a public-domain scan or corpus file here to import it"; tool buttons "+" (tooltip "Copy this entry onto the card"), "Aa" ("Show transliteration"), "⧉" ("Copy the entry text") — each only toasts "{tooltip} — not wired up in this prototype"; source line "no source file linked yet" (L515–527, L2332–2348).
- **EDT-181** Import affordances implied by the copy — drop a public-domain scan or corpus file per entry; copy entry onto the card (becomes a field); transliteration toggle; copy text; per-entry source attribution.

#### 1.18 Settings tab (editor)

- **EDT-182** Nothing selected — "Select a card to edit it. Cards start folded — click the chevron at the bottom edge, or double-click a card, to open it." + "Open a Root to extract its forms, a Form to extract its words, a Word to extract the sentences it appears in. A Sentence links the words it cites, their roots, or both." + graph totals with type dots: "Roots", "Forms", "Words", "Sentences", "Descriptions" (L591–605, L2546).
- **EDT-183** Single card "Headword" section (label rendered uppercase) — three field rows: "Arabic" (text), "Translit." (text), "English gloss" (notes); each commits "Edit headword" (L609–614, L2232–2236).
- **EDT-184** Single card "Fields" section (uppercase) — "+ Add" (tooltip "Add a field") → 2-column kind grid; field rows with editable labels; empty "No fields on this card yet." (L615–634).
- **EDT-185** Single card "Links" section (uppercase) — incoming rows ("from") then outgoing ("to"): type dot, direction (36px), "{Type} · {tr or ar}" (tooltip "Select this card"), "✕" (tooltip "Remove this link"); empty "Not linked to anything yet. Drag from any of the four edge dots on a card onto another card. Click a wire to select it, ⌫ to delete." (L635–648, L2242–2251).
- **EDT-186** Single card actions — "Fold"/"Unfold" (tooltip "Toggle this card (Enter)"), "Duplicate" ("Duplicate (⌘D)"), "+ Description" ("Attach a note"), "Delete" (danger, "Delete (⌫)"); read-only shows only Fold/Unfold (L2252–2258).
- **EDT-187** Multi-selection — "Fold or delete them together, or tidy the graph to re-flow everything by type." + per-type breakdown (dot, label, count; zero rows hidden); actions "Fold all" ("Fold every selected card"), "Unfold all" ("Unfold every selected card"), "Tidy" ("Re-layout the graph (T)"), "Delete" ("Delete (⌫)") (L660–671, L2259–2269).
- **EDT-188** Duplicate — copies selected nodes with new ids "m…", `src` cleared (lexicon link lost), offset +24/+24, selects the copies; edges are not duplicated; commit "Duplicate {n} card(s)" (L1452–1465).
- **EDT-189** Delete — removes selected nodes (frames included) and incident edges; commit "Delete {n} card(s)"; toast "Deleted {n} card(s)" (undoable); deleting a frame alone still says "card" [BUG] (L1441–1451).

#### 1.19 Comments

- **EDT-190** Comments tab (edit mode only) — list newest first: 20px avatar in the comment colour; "{who} on {anchor}" where anchor is a button (Amiri 15px, ring colour, RTL) that selects and centres the card if it still exists ("canvas" for canvas comments); body 13px t2; time `toLocaleString()` 11px t3 (L541–543, L2565).
- **EDT-191** Comments empty — "No comments yet. Select a card and write below — comments anchor to the card and travel with it." (L544).
- **EDT-192** Composer — target line "Anchored to {type lowercase} {Arabic}" (single selection) or "Select a card to anchor, or comment on the whole canvas"; input placeholder "Comment or @mention…"; Enter sends; dark "Send" button; blank input ignored; keys don't reach canvas shortcuts (L546, L2567–2569).
- **EDT-193** Comment record — `{id "c{ts}", who "You", text, nodeId | null, anchor (card Arabic or "canvas"), ts, color "var(--c-root)"}`; appended and saved to `jadhr-comments` (one global list, not per graph) [BUG for production] (L995–1002).
- **EDT-194** [GAP] Spec §4.4 says comments are "marked on their cards"; the prototype has no on-card marker, no threads, no resolve, no @mention parsing, no notifications (API: `GET/POST /graphs/:id/comments`, `PATCH /comments/:id` resolve; table `graph_comments` with `resolved_at`).

#### 1.20 Proposals (staged seed from Reader, Analyser, Collections, Shell)

- **EDT-195** Seed intake — `?seed=` = base64 of UTF-8 JSON `{words:[{ar, tr, en, pos, form:{ar,tr,en}, root:{ar,tr,en}}], sentence:{ar, tr, en, src} | null}`; parsed 320ms after mount, edit mode only; invalid or empty → silently ignored (L964–970, L1075).
- **EDT-196** Proposal record — `{key "{type}:{ar}", type, ar, tr, en, pos, src, parentKey, existing (id of a canvas card with same type+Arabic), conf, state "pending"|"matched"|"accepted"|"skipped", note, sentKey?, acceptedId?}`; deduplicated by key (L971–982).
- **EDT-197** Confidence rules — matched existing card → 1 and state "matched"; root in lexicon 0.98 note "in the lexicon", unknown root 0.7 note "not in the lexicon — check the root"; form 0.95; word 0.98 when its tr is in the lexicon else 0.72, note = pos; sentence 0.99, note = src; confident threshold 0.8 (L979–990, L2591).
- **EDT-198** Activation — only when ≥1 pending; opens Details on Proposals; title "Extracted from {sentence.src or 'a passage'}" or "Extracted from the reader"; source line = sentence Arabic (L992–993).
- **EDT-199** Proposals tab header — title 14px/600 + "{n} pending" (mono 11px); source Arabic Amiri 17px right-aligned; copy "Nothing enters the graph unreviewed. Dashed cards on the canvas are these proposals — click one to accept it." (L552–561).
- **EDT-200** Proposal row — type dot, Arabic (Amiri 20px, min 78px, right-aligned), line "{type} · {tr} · confidence {nn}%" (confidence only while pending), note (amber #b45309 when pending and conf <0.8; "already on the canvas" when matched); buttons "Accept" and "Skip" while pending, otherwise the state word ("accepted"/"matched" green, "skipped" t3); pending low-confidence rows tinted amber 8%; skipped rows opacity .55 (L563–579, L2595–2606).
- **EDT-201** Proposals footer — "Discard all" (hover red; clears proposals, back to Meaning, toast "Proposals discarded"); primary "Accept {n} confident · review {m}" / "Accept {n} confident" / disabled "Nothing confident left" (L581–584, L2607–2616).
- **EDT-202** Ghost cards — one per pending proposal: 248px wide, padding 12×14, radius 18, dashed 1.5px border (amber #b45309 when conf <0.8, else type colour), opacity .85 (hover 1 + solid border), z 9; type pill + amber "Proposed" (rendered uppercase); Arabic 26px (sentence 19px); "{tr} · {en}" line; tooltip "Proposed {type} · confidence {nn}% — click to accept"; click accepts (L328–341, L2573–2587).
- **EDT-203** Ghost placement — right of existing content: x = rightmost edge + 180 + column×290 (root 0, form 1, word 2, sentence/description 3); y = topmost card + row×118 per column (L1023–1037).
- **EDT-204** Accept one — accepts the whole pending ancestor chain (root → form → word); new folded cards (id "p…", `src` null) at ghost positions; edges parent→child, word→sentence when the sentence is accepted, and a newly accepted sentence links already-accepted words; commit "Accept {Type of clicked card}"; toast "Accepted {n} card(s)" (undoable); selects the accepted card; then Tidy + Fit (L1038–1066).
- **EDT-205** Accept confident — iterates confident pending items in order sentence, root, form, word; toast "Accepted {n} proposals" (undoable) (L2610–2615).
- **EDT-206** Skip — marks the item and all its pending descendants "skipped"; no toast; not undoable (L1067–1073).

#### 1.21 Undo / redo and labelled commits

- **EDT-207** Single mutation path `commit(label, mutator)` — deep-clones `{nodes, edges, sel, label}` onto the undo stack (max 60), clears redo, applies the mutation, queues a save, closes the context menu; in read-only it refuses with toast "This is a published copy — fork it to edit" (L1395–1404).
- **EDT-208** `pushUndo(pre, label)` — records gestures after the fact (move, resize, tidy, import) with a pre-gesture snapshot (L1405–1408).
- **EDT-209** Undo/redo — restore nodes, edges and selection; label carried to the opposite stack; both queue a save; ⌘Z / ⇧⌘Z (Ctrl on non-Mac), header buttons, toast "Undo" button (L1418–1435, L1859).
- **EDT-210** Not undoable — fold/unfold, graph title, frame rename, proposals state, comments, UI prefs, search, viewport, fork load (L1385–1392, L2411, L2204–2208, L1019).
- **EDT-211** Commit label "Import" (pushUndo) (L954).
- **EDT-212** Commit label "Accept {Root|Form|Word|Sentence}" (L1048).
- **EDT-213** Commit label "Add note card" (`?note=` seed) (L1020).
- **EDT-214** Commit labels "Extract {n} forms" / "Extract {n} words" / "Extract {n} sentences" (L1244).
- **EDT-215** Commit labels "Link {n} word(s)" / "Link {m} root(s)" / "Link {n} words and {m} roots" (L1278).
- **EDT-216** Commit label "Add description" (L1305).
- **EDT-217** Commit labels "Add Root" / "Add Form" / "Add Word" / "Add Sentence" / "Add Description" (L1317).
- **EDT-218** Commit label "Add root {tr}" e.g. "Add root k-t-b" (L1325).
- **EDT-219** Commit labels "Add short text field" / "Add notes field" / "Add number field" / "Add select field" / "Add tags field" / "Add audio field" / "Add image field" / "Add file field" / "Add link field" / "Add date field" (L1334).
- **EDT-220** Commit label "Edit field" (L1344).
- **EDT-221** Commit label "Rename field" (L1353).
- **EDT-222** Commit label "Remove field" (L1362).
- **EDT-223** Commit label "Edit headword" (L1368).
- **EDT-224** Commit label "Remove link" (unlink from Settings, ⌫ on wire, "✕ Unlink") (L1374, L1379).
- **EDT-225** Commit labels "Delete 1 card" / "Delete {n} cards" (L1445).
- **EDT-226** Commit labels "Duplicate 1 card" / "Duplicate {n} cards" (L1455).
- **EDT-227** Commit label "Tidy layout" (pushUndo) (L1555).
- **EDT-228** Commit label "Resize group" (pushUndo) (L1714).
- **EDT-229** Commit labels "Move card" / "Move {n} cards" (pushUndo) (L1717).
- **EDT-230** Commit label "Link {Source} → {Target}" e.g. "Link Root → Form" (L1734).
- **EDT-231** Commit label "Group {n} cards" (L1766).
- **EDT-232** Commit label "Ungroup" (L1776).
- **EDT-233** Commit label "Nudge selection" (L1805).
- **EDT-234** Tooltip rendering of labels — lowercased, e.g. "Undo extract 5 forms (⌘Z)", "Redo link root → form (⇧⌘Z)" (L2445–2446).

#### 1.22 Toast copy (complete)

- **EDT-235** Import errors — "Not valid JSON"; "No \"nodes\" array in this file" (L946–947).
- **EDT-236** Import success — "Imported {n} cards · {m} links" + " · {k} unknown skipped" when any (undoable) (L959).
- **EDT-237** Export — "Exported {n} cards" (count includes frames) (L1473).
- **EDT-238** Publish — "Published — opening the public page" (L1013).
- **EDT-239** Fork — "Forked “{title}” — it is yours now" (L1019).
- **EDT-240** Extract/link — "Extracted {n} {forms|words|sentences}" and "Linked {phrase}" (undoable) (L1266, L1299).
- **EDT-241** Accept — "Accepted {n} card(s)" and "Accepted {n} proposals" (undoable); discard — "Proposals discarded" (L1063, L2614, L2616).
- **EDT-242** Library — "That root is already on the canvas" (L1324).
- **EDT-243** Wires — "Wire deleted" (undoable); "Those cards are already linked"; "{Type} cannot link to {type} — try a description"; "That would make a loop" (L1381, L1728–1733).
- **EDT-244** Read-only guard — "This is a published copy — fork it to edit" (L1396).
- **EDT-245** Delete — "Deleted {n} card(s)" (undoable) (L1450).
- **EDT-246** Groups — "Select two or more cards to group them"; "Grouped {n} cards — name it in Details" (undoable); "Select a group to release it"; "Group released" (undoable) (L1761–1777).
- **EDT-247** Search — "Nothing matches that search"; "Match {i} of {n}" (L1782, L1788).
- **EDT-248** Meaning — "This card has no root linked yet"; "{tool tooltip} — not wired up in this prototype" (L2319, L2348).

#### 1.23 Keyboard shortcuts — help modal (verbatim) and actual handling

- **EDT-249** Help modal — fixed scrim (canvas colour 58%) click-to-close, z 90; dialog 560px max 100%, radius 16, `--sh-open`, dcPop; title "Keyboard & pointer"; close "✕" aria-label "Close shortcuts"; 2-column grid of four groups; key chips mono 11.5px on card-2 (L686–708).
- **EDT-250** Help group "Canvas" — "two-finger drag" — "pan the canvas"; "⌘ + scroll" — "zoom to the pointer"; "space + drag" — "pan with a mouse"; "drag empty" — "marquee-select cards"; "F · 1 · ± " — "fit · 100% · zoom step" (L2484–2490).
- **EDT-251** Help group "Cards" — "double-click" — "fold or unfold a card"; "↵" — "fold or unfold the selection"; "E" — "extract the related cards"; "⌘D" — "duplicate the selection"; "⌘G · ⇧⌘G" — "group · release a group"; "⌫" — "delete the selection or wire" (L2491–2498).
- **EDT-252** Help group "Moving around" — "← →" — "step to parent · to child"; "↑ ↓" — "step between siblings"; "⌥ + arrows" — "nudge 8px (⇧ for 32px)"; "arrows" — "pan when nothing is selected"; "right-click" — "context menu, anywhere" (L2499–2505).
- **EDT-253** Help group "Links & search" — "drag edge dot" — "link two cards"; "click wire" — "select it — ⌫ cuts it"; "↵ in search" — "jump to the next match"; "T" — "tidy the whole layout"; "?" — "open this list" (L2506–2512).
- **EDT-254** Keys handled but missing from the help — ⌘Z undo, ⇧⌘Z redo, ⌘A select all, Esc clear/close, ⇧↵ in search previous match, Esc in search clear, middle-button pan, Shift+click / Shift+marquee add to selection, Shift+wheel horizontal pan (L1859–1886, L2475–2478).
- **EDT-255** Key guard — shortcuts ignored while focus is in INPUT/TEXTAREA/SELECT/contentEditable (after closing any context menu) (L1852–1853).
- **EDT-256** "+"/"=" zoom in ×1.25 and "-"/"_" zoom out ÷1.25 (centre-anchored); "1" sets k=1 without re-centring (unlike the zoom pill reset) [BUG-ish]; "F" fit; "T" tidy; "?" toggles help and closes ctx (L1878–1885).
- **EDT-257** Read-only key filter — Delete/Backspace, ⌘/Ctrl + Z/D/A/V/X, and T/E/G (any case) do nothing; Enter (fold), arrows, F, 1, ±, ?, Esc still work (L1851).

#### 1.24 Autosave and save status

- **EDT-258** Save queue — any commit/fold/rename/undo sets "unsaved" immediately; after 800ms of quiet "saving…"; 380ms later "saved"; debounced (timers reset); never runs in read-only (L1409–1417).
- **EDT-259** [GAP] The prototype never persists the graph document — it lives in memory; a reload returns the seed graph. Production: `PUT /graphs/:id` debounced ~800ms sending the whole document (08 §8.6), server-side revision history (04 §4.6).

#### 1.25 Import / Export and document schema

- **EDT-260** Import — file picker → FileReader → JSON.parse; keeps nodes with an `id` and either `kind:"frame"` or a known `type`; keeps edges whose source and target both survive (an edge without id gets one; an existing id is kept); title from file else current; resets measured heights; pushUndo "Import"; queues save; re-measures at 60ms and Tidy + Fit at 200ms (author positions overwritten) (L941–962).
- **EDT-261** File input reset — value cleared after each pick so the same file can be re-imported (L2424).
- **EDT-262** Export — downloads `{title, nodes, edges}` pretty-printed (2 spaces), MIME application/json, filename = title with whitespace → "-" and lowercased + ".json" (no other sanitising) (L1466–1474).
- **EDT-263** Document — `{ title: string, nodes: (Card | Frame)[], edges: Edge[] }` (export) / `{ nodes, edges }` (published `doc`, 07 `graphs.doc` jsonb with `doc_version` smallint default 2).
- **EDT-264** Card node fields — `id` string; `type` "root"|"form"|"word"|"sentence"|"description"; `src` lexicon pointer or null; `x`, `y` world px (8px grid); `folded` bool; `ar` string; `tr` string; `en` string; `fields` Field[] (L857–860).
- **EDT-265** Frame node fields — `id`; `kind` "frame"; `label`; `x`; `y`; `w`; `h` (L1767).
- **EDT-266** Field fields — `id`; `kind` (10 kinds); `label`; `value` (string | number | string[]); `options` string[] | null; `fileName?` (L842, L1347).
- **EDT-267** Edge fields — `id`; `source`; `target` (L1735).
- **EDT-268** Not in the document — port sides, measured heights, selection, viewport, fold animation, proposals, comments (comments separate store).

#### 1.26 Publish flow

- **EDT-269** Publish (header button) — no dialog: slug = "you/" + title lowercased with every run of chars outside [a-z0-9 and U+0600–U+06FF] → "-", trimmed, + "-" + last 4 base36 chars of `Date.now()` (L1003–1005).
- **EDT-270** Published record — `{slug, title, by:"you", ts, updated (locale "d MMM yyyy"), desc, counts:{cards, roots, words}, doc:{nodes, edges} deep clone incl. positions/folds/frames, forks:0, cited:0}` appended to `jadhr-published` (L1006–1012).
- **EDT-271** Auto description — "{words} words on the root {Arabic}" when exactly one root, else "{words} words on {n} roots", + " — published from the graph editor." (L1009).
- **EDT-272** Counts — cards = non-frame nodes; roots = root cards; words = word cards (L1010).
- **EDT-273** After publish — toast "Published — opening the public page", redirect after 700ms to Published Graph `?g={slug}` (production `/g/<slug>`) (L1013–1014).
- **EDT-274** [GAP] No editable publish metadata (title/description/slug), no confirm, no unpublish, no republish/versioning (each publish = new slug), no "copy link"; API has `POST /graphs/:id/publish {slug?, description?}` with immutable snapshot (08 §8.6).

#### 1.27 Read-only / embed mode

- **EDT-275** Activation — `view={slug}` → read-only; `embed=1` → no header; looks up slug in `jadhr-published` (L899–903).
- **EDT-276** Record with `doc` → cloned nodes/edges + title (full fidelity) (L905–906).
- **EDT-277** Legacy record (no `doc`, has `nodes`) — rebuild cards `{id, type, ar, tr, en, x, y}` with seed fields, folded; edges accepted as `[source, target]` arrays or `{source, target}` objects; flagged legacy (L907–911).
- **EDT-278** `view=sample` (not in store) — keeps the built-in default graph (used by Published Graph sample and Classroom) (L912).
- **EDT-279** Unknown slug — title "Graph not found", empty canvas with the not-found copy (EDT-063) (L912).
- **EDT-280** `folded=1` folds every card on load; `entry=0` starts with Details closed (any other value → open); library always closed; selection empty; `theme=dark` → dark else light (URL is the only theme source in read-only) (L913–915).
- **EDT-281** Initial view — read-only fits (keeps the author's composition) except `sample` and legacy records, which run Tidy + Fit (L1101).
- **EDT-282** Hidden or inert in read-only — library panel, presence, save status, Tidy/Undo/Import/Export/Reader/Publish, Comments tab, Proposals, ports, context menu, card "+ Add" field button, card drag (selection still works), resize, connect; all mutations blocked by the commit guard (L2121, L2127, L1684, L1836, L2561).
- **EDT-283** Still active in read-only — pan, zoom, marquee, select (opens Details), fold/unfold (double-click, chevron, Enter, header Fold/Unfold), Meaning and Settings tabs, keyboard navigation, theme toggle, help (L1385, L1851).
- **EDT-284** Embed (`embed=1`) — whole header hidden, so Fold/Unfold/Fit/Fork are not reachable inside the frame; the Details rail still shows on the right when closed; clicking a card reopens Details even with `entry=0` (L2425, L404, L1671).
- **EDT-285** postMessage in (read-only only) — `{type:"jadhr-fit"}` → fit; `{type:"jadhr-fold", folded:boolean}` → fold/unfold all cards; `{type:"jadhr-theme", dark:boolean}` → apply theme (not persisted); no origin check [security gap] (L1102).
- **EDT-286** postMessage out — on card fold toggle via double-click or the fold chevron, only when read-only and inside an iframe: `{type:"jadhr-card", id, ar, tr, type2: <card type>}` to `parent` with target "*" (L2125).
- **EDT-287** [GAP] Spec §4.5 says `jadhr-card` is posted when a card is "folded/unfolded or selected"; the prototype posts only on toggle via card/chevron — not on selection, not on Enter, not on the sidebar Fold button, not on header Fold/Unfold.
- **EDT-288** [BUG] Read-only still writes: UI prefs (`lexicon-editor-v5-ui`, via the setState override) and `jadhr-theme` (theme toggle); spec §4.6 "Read-only mode must never write" (L937–940, L2438).
- **EDT-289** [BUG] Settings tab in read-only renders editable Headword/field inputs and a "+ Add" menu whose commits bounce with the guard toast; production must render read-only text.

#### 1.28 Fork, note seed, and inbound entry points

- **EDT-290** `?fork={slug}` (edit mode, 260ms after mount) — finds the record in `jadhr-published`; deep-clones `doc` (or rebuilds legacy); title "{title} (fork)"; clears selection; increments the original's `forks` and writes the store; toast "Forked “{title}” — it is yours now"; Fit after 200ms; not pushed to undo; unknown slug → default graph silently (L1016–1019).
- **EDT-291** [BUG] Fork's legacy path reads edges only as objects (`e.source`), while the view path also accepts `[source, target]` arrays — array-form legacy edges break on fork (L1019 vs L910).
- **EDT-292** `?note={text}` — adds a description card (ar "وَصْف", en = text) unfolded at (80, 80), selected; commit "Add note card"; used by Notebook "card" links; value is decoded twice (`decodeURIComponent` on an already-decoded param) so text with "%" can throw and be silently dropped [BUG] (L1020).
- **EDT-293** `?w=&tr=&ar=` — "came from" word: only changes the Reader link label/tooltip/href (L2058–2071).
- **EDT-294** `?from=` (shell, analyser, collection, trail, reader) — passed by callers, ignored by the editor (no behaviour).
- **EDT-295** Inbound callers — Reader word panel (`?w&tr&ar`), Reader seed sheet (`from=reader&w&tr&ar&seed` with sentence `src` "Ch. {n} · passage {m}"), Reader curiosity trail "Open in the editor" (`from=trail&seed`), Collections "See the set as a map" (`from=collection&seed`), Analyser (`from=analyser&seed`), Notebook (`note=`), Shell "Send word to graph" (`from=shell&w&tr&ar&seed&t`), Classroom (`view=sample&embed=1&entry=0`, "Open in the editor →" = `fork=sample`), Published Graph (`view&embed=1&entry&folded&theme`, `fork=`), Hub/nav links (plain).

#### 1.29 Presence (Live)

- **EDT-296** Presence avatars — three static 20px circles: "You" (`--c-root`), "Layla" (`--c-form`), "Omar" (`--c-word`); 2px `--panel` border; −7px overlap; name as tooltip; simulated (L2564).
- **EDT-297** "Live" indicator — static green dot + "Live" (L61).
- **EDT-298** Production decision (10 §5) — recommended "presence only" first (WebSocket per graph, ephemeral; last-write-wins on save); CRDT would change the doc format and autosave path — decide before building.

#### 1.30 Dark mode and theming

- **EDT-299** Theme application — `.dark` class toggled on both `<html>` and `<body>` (L1113–1117).
- **EDT-300** Theme sources (edit mode) — prop default → `lexicon-editor-v5-ui.theme` → `jadhr-theme` (shared product key wins) (L890, L924–925).
- **EDT-301** Theme toggle — writes `jadhr-theme` immediately and UI prefs (debounced) and applies the class (L2435–2440).
- **EDT-302** Read-only theme — from `theme` URL param only; live switch via `jadhr-theme` postMessage (L915, L1102).
- **EDT-303** Product rule — one shared theme key across Reader and Editor, including when embedded; default light (02 §2.2, README).

#### 1.31 Phone and narrow-width behaviour

- **EDT-304** No responsive rules in the editor — header scrolls horizontally; library 238px and Details min 380px stay fixed; at ≈924px (`04-editor.png`) the library is collapsed to its rail and Details takes ~40% of the width.
- **EDT-305** Mouse-only input — all canvas interactions use mouse events (mousedown/move/up, wheel, dblclick, contextmenu, HTML5 drag-drop); no touch/pointer handling, so touch pan, pinch-zoom, card drag, marquee, connect and palette drag-drop do not work on phones/tablets [GAP].
- **EDT-306** Product breakpoints to honour (02 §2.6) — ≥1200 full; 900–1200 rail collapses to overlay, panel docked narrower; <900 phone mode (targets ≥40px, overlays ≥44px); 390px audited floor; the editor canvas is the stated exception to fluid layout, but its chrome must still adapt.

#### 1.32 Accessibility

- **EDT-307** Present — `aria-live="polite"` on save status and toast; aria-labels on icon/short buttons (Tidy layout, Fit to view, Undo, Redo, Import graph JSON, Keyboard shortcuts, theme, Previous/Next match, Clear search, Find a card, Zoom in/out, Reset zoom to 100 percent, Close shortcuts, Group name); `aria-expanded` on Card types; `aria-pressed` on theme; `aria-hidden` on decorative SVGs; focus-visible ring; Esc closes help/menus.
- **EDT-308** Missing [GAP] — cards are non-focusable divs (no tab stop, no role, no accessible name beyond `data-screen-label`); tabs lack `role="tab"`/`aria-selected`; context menu lacks `role="menu"`; help lacks `role="dialog"`/focus trap/return focus; Arabic elements lack `lang="ar"` (02 §2.7 requires `lang` and `dir`); wires are not keyboard-selectable; no keyboard way to create a link.

#### 1.33 Persistence keys (prototype → production)

- **EDT-309** `lexicon-editor-v5-ui` — `{sidebarOpen, leftOpen, paletteHelp, theme}`; read in edit mode only; written debounced 200ms whenever one of those keys changes (L933–940) → client-local prefs.
- **EDT-310** `jadhr-theme` — "light"|"dark"; shared across product (L925, L2438) → client-local, shared.
- **EDT-311** `jadhr-comments` — global comment array (L918, L1000) → server, per graph.
- **EDT-312** `jadhr-published` — published records; read by view/fork, Published Graph (via `lexicon-data.js` `KEYS.graphs` + `load`), Profile; written by publish and fork count (L903, L1012, L1019) → server, by slug.
- **EDT-313** `jadhr-context` — `{book, bookId, word, wordAr, wordTr, root (key), rootAr}` written by the Reader on word select, polled by the Shell every 800ms (Shell L37–38; Reader L1858) → shared app state.
- **EDT-314** Not persisted in the prototype — the graph document, undo history, proposals.

#### 1.34 Split Shell (`Shell.dc.html`, route `/split`)

- **EDT-315** Header 52px light-only (#f8f8fa) — logo + "Jadhr" (14px/600) + "· split view" (12px t3), linking to the hub (Shell L15–16).
- **EDT-316** Pane toggles — segmented "Text + dictionary" and "Graph"; active = white with line-2 border, 500 weight; clicking a visible pane hides it unless it is the only visible pane (never zero panes) (Shell L17, L50).
- **EDT-317** Context strip — "Context" label + chips (book with sentence-green dot; "{wordAr} · {wordTr}" with word-blue dot; root Arabic with root-brown dot; `dir="auto"`, Amiri 14px); empty → "select a word in the text" (Shell L19, L45–47).
- **EDT-318** "Send word to graph →" — disabled (grey) until the context has a word; enabled dark (Shell L20, L51).
- **EDT-319** Send action — builds seed `{words:[{ar: wordAr, tr: wordTr, en:"", pos:"noun", form:{ar:"فَعْل", tr:"", en:""}, root:{ar: rootAr, tr: <root key>, en:""}}], sentence:null}` (placeholder form/pos, root key used as tr) [BUG], sets editor src `?from=shell&w&tr&ar&seed&t={now}` (cache-bust forces reload, losing the in-memory graph) [BUG], and forces the graph pane visible (Shell L53).
- **EDT-320** Panes — reader iframe (title "Reader", src Reader v4 — missing file [BUG]) flex 1.15 with right border #d3d3dc when both visible; graph iframe (title "Graph editor", initial `?from=shell`) flex 1 (Shell L22–28, L33, L56–58).
- **EDT-321** Sync — polls `jadhr-context` every 800ms and updates only on change (JSON compare) (Shell L37–38).
- **EDT-322** No dark mode, no phone layout (two iframes always side by side) [GAP].
- **EDT-323** Production (06 §6.9) — replace polling with shared app state; keep the split view as the power-user surface; "send to graph" should stage proposals into the open graph without a reload.

#### 1.35 Published Graph page (`Published Graph.dc.html`, route `/g/<slug>`)

- **EDT-324** Data load — dynamic imports of `lexicon-data.js` (`KEYS.graphs`, `load`) and `jadhr-chrome.js` (`navModel`, `chip`); list = [built-in SAMPLE] + `jadhr-published`; current = `?g=` slug if found else sample (PG L51).
- **EDT-325** Header 52px — logo + "Jadhr" (to hub); full shared nav (Read, Explore, Library, Look up, Concordance, Analyser, Graph, Notebook, Review queue, Classroom, Data & API) via `navModel('')` (no item marked current) in a scrolling strip; right: mono "jadhr.org/g/{slug}" (PG L15–19; chrome L2–9).
- **EDT-326** Graph list bar — "Published graphs" + one chip per graph (`chip(active)`: active #eef3fd bg, ring border) + right link "Publish one from the editor →"; chip click switches graph (iframe reloads; URL not updated [GAP]) (PG L21, L67).
- **EDT-327** Main grid — `minmax(0,1fr) 300px`; left: title 20px/600, byline, description 13.5px max 560px; framed graph (1px line, radius 12, min-height 480) (PG L22–25).
- **EDT-328** Byline — "by {by or 'you'} · updated {updated or date(ts)} · {cards} cards" + " · {roots} roots" when >0 (word count not shown); description fallback "Published from the graph editor." (PG L66).
- **EDT-329** Embedded graph — iframe (title "Published graph") of the real editor `?view={slug}&embed=1&entry={0|1}&folded={0|1}&theme={light|dark}`; not a screenshot (PG L26, L69).
- **EDT-330** Caption pill over the graph — "read-only · the same cards as the editor · double-click a card to unfold · drag to pan" (PG L27).
- **EDT-331** Actions column (bg panel) — "Fork into my editor" (dark, → editor `?fork={slug}`); "Cite"; "Download JSON" (whole published record, filename slug with "/" → "-" + ".json") (PG L31–32, L70–73).
- **EDT-332** Cite — copies "{by or 'You'}. “{title}.” Jadhr graph, {updated or '2026'}. https://jadhr.org/g/{slug}. CC BY-SA 4.0." and flashes "Citation copied"; does not increment `cited` (API `POST /published/:slug/cite` increments and returns BibTeX/RIS/plain) [GAP] (PG L72).
- **EDT-333** Embed block — "Embed" mono label (rendered uppercase); snippet `<iframe src="https://jadhr.org/embed/g/{slug}?entry={0|1}&folded={0|1}&theme={light|dark}" width="100%" height="520" style="border:0"></iframe>`; "Copy" → "Embed code copied" (PG L34–36, L63–64, L71).
- **EDT-334** Display options (checkboxes, map to embed params) — "details panel open (click a card)" (entry, default on), "start folded to headlines" (folded, default off), "dark theme" (dark, default off); toggling updates the snippet and the iframe src (reload) and also posts `jadhr-fold` / `jadhr-theme` (PG L37, L56, L74).
- **EDT-335** Stats line — "Forked {n} times · cited in {n} papers · CC BY-SA 4.0 · version history public" (PG L39, L75).
- **EDT-336** Toast — green 12px text in the actions column, 1.8s (PG L40, L55).
- **EDT-337** Built-in sample record — slug "sample", title "Arabic lexicon graph — sample", by "Jadhr", updated "3 Mar 2026", desc "The editor’s built-in root families, published as they appear in the graph editor: roots, patterns, words, sentences and a description card, with the classical lexica per sense.", counts {cards 24, roots 6, words 12}, forks 14, cited 2 — counts are hard-coded and do not match the graph the sample renders (10 cards, 1 root, 3 words) [BUG] (PG L46).
- **EDT-338** Legacy tolerance — counts computed from `doc.nodes` (frames excluded) or legacy `nodes` when the record has no `counts` (PG L61–62).
- **EDT-339** [GAP] Selected-card strip (06 §6.6) — the page listens for `jadhr-card` and stores it in state, but nothing renders it.
- **EDT-340** [GAP] "Open in editor" action (06 §6.6) — absent; only Fork exists.
- **EDT-341** Never sends `jadhr-fit`; light-only page chrome; fixed 300px side column (no phone layout) [GAP].

#### 1.36 API and data model mapping

- **EDT-342** Graph list/create/read/update/delete — `GET /graphs`, `POST /graphs {title, doc}`, `GET /graphs/:id`, `PUT /graphs/:id {title?, doc?}` (autosave, whole doc, ~800ms debounce), `DELETE /graphs/:id`; table `graphs(id, owner_id, title, doc jsonb, doc_version default 2, updated_at, created_at)`.
- **EDT-343** Publish — `POST /graphs/:id/publish {slug?, description?} → {slug}`, immutable snapshot; table `published_graphs(slug pk, graph_id, owner_id, title, description, doc, doc_version, counts jsonb {cards, roots, words}, forked_from, fork_count, cited_count, published_at)`.
- **EDT-344** Public read — `GET /published` (sidebar list), `GET /published/:slug` → `{title, description, owner, doc, doc_version, counts, fork_count, cited_count, published_at}`, no auth; must honour `doc_version` (legacy fallback).
- **EDT-345** Fork — `POST /published/:slug/fork → {graph_id}` increments `fork_count`, records `forked_from`.
- **EDT-346** Cite — `POST /published/:slug/cite` increments `cited_count`, returns BibTeX/RIS/plain.
- **EDT-347** Comments — `GET/POST /graphs/:id/comments`, `PATCH /comments/:id` resolve; table `graph_comments(id, graph_id, author_id, node_id null=canvas, anchor, body, resolved_at, created_at)`.
- **EDT-348** Lexicon data the editor needs per card — root: Arabic letters, transliteration, gloss, editorial note, forms list; form: pattern Arabic/tr/function, words list; word: Arabic/tr/gloss/POS; sentence: Arabic/tr/translation/source, cited word ids; dictionaries: id, Arabic/English name, author, death year, tag, entry text per root, source; currently hard-coded inside the editor (separate copy from `lexicon-data.js`, which differs: 6th root ق و م instead of ف ي, different glosses) [GAP].

---

### 2. Quran adaptation notes

- **QAN-01** Card kinds → Quran objects — root = جذر (Quranic root); form = وزن/صيغة (pattern and verb form I–X); word = كلمة/lemma (lemma id, POS); sentence = آية (verse card); description = ملاحظة (note/topic heading); frame = مجموعة (topic cluster). Keep the five type colours and the type pill; rename labels in Arabic.
- **QAN-02** Verse card content — surah:ayah reference ("٢:٣١"), surah name, verse text in a Quran font with full tashkeel, the occurring token(s) highlighted, optional translation, reciter audio (Audio field), link back to the reader at that verse; stats "linked · words · to link" become "كلمات مرتبطة · كلمات الآية · للربط".
- **QAN-03** Verse readability — verses are much longer than prototype sentences: folded shows one line with ellipsis plus the highlighted word; open wraps fully; consider a wider open width for verse cards (e.g. 420 instead of 344) and line-height ≥1.9 for diacritised Quran text (prototype 1.45 would clip marks); Tidy must keep using live heights so long verses never overlap.
- **QAN-04** Default root-family graph from real data — root → patterns (group the root's lemmas by pattern/verb form) → lemmas → verses (occurrences); the "Extract N forms/words/sentences" counts and "to extract" stats come from the corpus, not a hand-coded table.
- **QAN-05** Deterministic ids from data keys — e.g. `root:{rootId}`, `pattern:{rootId}:{patternId}`, `lemma:{lemmaId}`, `verse:{s}:{a}` replace "r{i}f{j}w{k}"/"s{q}" so "already on canvas", dedupe, proposals matching and forks stay correct.
- **QAN-06** High-frequency words — extracting verses for a lemma with dozens or hundreds of occurrences must page or filter (by surah, by form, first N + "more"), otherwise cards become unreadable; show "Extract 10 of 105 verses" style labels.
- **QAN-07** Verse → words/roots linking — the sentence options ("Link N words", "Extract N roots", "Link words and roots") map directly to verse tokens with lemma/root annotations; `lexicon-data.js` `SCRIPTURE` tokens ("surface|wordId|grammar") are the right model for the verse→token→lemma mapping.
- **QAN-08** Function words — the prototype's particle pseudo-root (ف ي) shows the need: Quranic particles have no root; default to skipping them when linking a verse, with an option to include.
- **QAN-09** User topic graphs — start blank or from a topic; verse cards are the main content, description cards act as topic headings, frames as sub-topics; current ALLOW forbids verse→verse and description→description, so decide: add a "topic" kind or relax ALLOW for topic graphs.
- **QAN-10** Meaning graphs (different roots, close meanings, e.g. خوف / خشية / وجل / رهب) — ALLOW forbids root→root today; either allow root↔root with a typed relation or use a meaning-hub card (description→root is already allowed); recommend storing an optional `edge.rel` (derives, realises, attested in, cites, describes, close in meaning, contrast) shown in the selected-wire pill.
- **QAN-11** Graph types as a document field — store `graphType` ("root" | "topic" | "meaning") so Tidy, ALLOW and the palette can adapt (e.g. meaning graphs lay roots in one column with shared verses beside them).
- **QAN-12** Arabic-default UI copy — every string in this inventory needs an Arabic version (e.g. "Find a card…" → "ابحث عن بطاقة…", "Map view — zoom in for card detail" → "عرض الخريطة — قرّب لترى تفاصيل البطاقات"); English becomes secondary.
- **QAN-13** RTL mirroring — header, library and Details swap sides in Arabic UI; menus/toasts mirror; Tidy columns should flow right-to-left (root on the right, verses on the left); arrow-key navigation follows visual direction; card Arabic text must align to start (prototype uses `text-align:left` with `dir=rtl`).
- **QAN-14** Arabic plurals and digits — counts like "3 forms · 3 words" need ICU plural categories (وزن / وزنان / أوزان / وزنًا) and a digit preference (Arabic-Indic or Western); the prototype's "1 forms" bug shows plurals must be centralised.
- **QAN-15** Search normalisation — strip tashkeel and tatweel, unify alef forms, ya/alef maqsura, ta marbuta/ha; also match verse refs ("2:255"), root letters, lemma, translation text.
- **QAN-16** Counts from the corpus — replace the user-typed "Attestations" number with computed Quran occurrence counts (root, lemma, pattern) shown in stats and Meaning ("{n} مرة في القرآن"); keep user fields separate from computed facts.
- **QAN-17** Meaning tab per kind — root: Arabic core meaning (like `arGist` in `lexicon-data.js`) + gloss; lemma: its own senses (not the root note, which the prototype reuses for every descendant); verse: text, translation, surah meta (Meccan/Medinan, verse count), words with roots.
- **QAN-18** Dictionaries — keep the nine-lexicon list with tags and death-date order; Mufradat al-Raghib is Quran-specific and should lead for Quran use; entries must be real licensed text (10 §1); "+ copy onto card" creates a Notes field with source citation.
- **QAN-19** Proposals from the Quran reader — "send to graph" seeds a verse plus its words with root/pattern from morphology; corpus-annotated tokens get confidence 1, user-analysed text lower; key proposals on lemma id, not Arabic surface (homographs collide on "{type}:{ar}").
- **QAN-20** Map view — essential for large roots (e.g. ق و ل, ك و ن); Arabic-only LOD text in Arabic UI; keep the 0.35 threshold and the Fit floor of 0.34.
- **QAN-21** Generated vs saved graphs — the default root graph can be generated on demand from data and embedded read-only on root pages (same component, `view` of a generated graph); editing forks it into the user's own saved graph.
- **QAN-22** Transliteration — default off in Arabic UI (`showTransliteration` prop), still available as a preference.
- **QAN-23** Slugs and citation — publish slug already keeps Arabic letters (U+0600–U+06FF); percent-encode in URLs; citation string and embed must work with Arabic titles.
- **QAN-24** Spacing for readability — keep GAPX 156 / GAPY 56, 8px grid and live-height Tidy; consider larger GAPY for verse columns; never let folded verse cards exceed one line.
- **QAN-25** Data needed — roots (letters, gloss, core meaning), patterns, lemmas (POS, gloss, senses), tokens (surah, ayah, position, lemma, root, pattern, POS), translations, counts per root/lemma/pattern, dictionary entries per root with source.

---

### 3. Hard-won fixes (subtle rules found in code)

- **HWF-01** Measure real card heights (ResizeObserver + ref callback + double requestAnimationFrame) and lay out with live `offsetHeight`; estimates (112/360) are only fallbacks — otherwise open cards overlap after Tidy (L1083–1099, L1141–1161, L1484–1490, L1929–1942).
- **HWF-02** Skip height measurement while in map view — the LOD overlay would corrupt heights (L1085).
- **HWF-03** Hide card detail with `visibility:hidden` in map view, not `display:none`, so card heights stay stable across zoom levels (L2111).
- **HWF-04** Scale wire stroke by 1/clamp(k, .4, 1) so wires stay visible when zoomed out (L2143).
- **HWF-05** Separate 18px transparent hit path from the visual wire; swallow mousedown on it so clicking a wire never starts a marquee (L192–194, L2157).
- **HWF-06** Every button inside a card stops mousedown propagation so it never starts a card drag (L264, L283, L305, L312, L2128).
- **HWF-07** Release the space-pan state on keyup and on window blur, and ignore Space on buttons/links so it still activates them (L1078–1079, L1855–1857).
- **HWF-08** Canvas shortcuts must be ignored while typing in any input/textarea/select/contentEditable; title, search and comment inputs stop key propagation (L1853, L2412, L2478, L2568).
- **HWF-09** One `commit(label, mutator)` choke point with deep-cloned snapshots, a 60-entry cap, and redo cleared on new work; the label feeds the Undo tooltip (L1395–1404).
- **HWF-10** Gesture undo (move/resize) is recorded only if something actually moved — plain clicks create no undo entries (L1693, L1702, L1714–1718).
- **HWF-11** Read-only guard lives in `commit()` so every mutation is blocked in one place, backed by hidden ports, suppressed context menu, a read-only key filter and blocked drag/resize/connect in `handleMove` (L1396, L1684, L1836, L1851, L2121).
- **HWF-12** Snap all positions (move, nudge, drop, frames, Tidy) to the 8px grid (L713, L715).
- **HWF-13** Choose port sides with a 24px clearance rule before falling back to the dominant axis, so wires don't cut through cards in tight layouts (L1896–1907).
- **HWF-14** Bézier control offset clamped 34–150px (0.42×distance) so short wires don't kink and long ones don't balloon (L1912).
- **HWF-15** Block cycles with a reachability check before linking; duplicate same-direction links refused with a clear toast (L1728, L1733, L1740–1749).
- **HWF-16** Explain refused links in product terms ("Root cannot link to word — try a description") instead of silently failing (L1729–1731).
- **HWF-17** Deterministic lexicon ids make extraction idempotent and power the "already on the canvas" checks for library roots and proposals (L1196–1204, L1324).
- **HWF-18** Extract places new children to the right first, then runs Tidy + Fit so the new family is visible immediately (L1250, L1267).
- **HWF-19** Sentence linking builds the missing root → form → word chain, not just the word, so the spine stays intact (L1282–1294).
- **HWF-20** Accepting a proposal accepts its pending ancestors too, and "Accept confident" runs in sentence → root → form → word order so every edge finds both ends (L1040–1043, L2611–2613).
- **HWF-21** Skipping a proposal cascades to its pending descendants (a skipped root takes its form and words with it) (L1069–1072).
- **HWF-22** Low-confidence (<0.8) proposals render amber both on the ghost border and in the list; nothing enters the graph unreviewed (L2584, L2599–2603).
- **HWF-23** UTF-8 safe base64 for seeds: encode `btoa(unescape(encodeURIComponent(json)))`, decode `decodeURIComponent(escape(atob(raw)))` — plain `btoa` breaks on Arabic (L968; Shell L53).
- **HWF-24** Published records store the full document, not a rendering; keep a legacy-format fallback (stripped `nodes` + array or object edges) because published graphs are citable (L905–911).
- **HWF-25** Read-only view fits instead of re-laying-out so the author's composition is preserved; only sample and legacy records (no trustworthy positions) are re-laid-out (L1101).
- **HWF-26** Toasts for undoable actions stay 5.2s with an inline Undo; others 2.6s (L1439).
- **HWF-27** Import keeps only known node types/frames and only edges whose endpoints survived, and reports how many unknown nodes were skipped (L948–952, L959).
- **HWF-28** Reset the file input after each pick so re-importing the same file fires `change` (L2424).
- **HWF-29** Frame membership is geometric and computed at drag start; dragging the bar moves the frame and everything fully inside it (L1663–1667).
- **HWF-30** Marquee picks a frame only when fully enclosed, so sweeping over grouped cards does not grab the group (L1633).
- **HWF-31** Selecting a frame jumps Details to Settings because frames have no Meaning entry (L1670–1671).
- **HWF-32** The `jadhr-card` message uses `type2` for the card type because `type` is the message type (L2125).
- **HWF-33** Apply the theme class to both `<html>` and `<body>` (L1115–1116).
- **HWF-34** UI prefs saved with a 200ms debounce from a `setState` override that watches only the pref keys (L933–940).
- **HWF-35** Zoom anchored at the pointer (wheel) or pane centre (buttons) with the same formula; clamp 0.12–2.4 (L1584–1585, L1597–1598).
- **HWF-36** Fit clamps zoom to ≤100% (never blows up a small graph) and ≥0.34 (lands in map view for very large graphs) (L1569).
- **HWF-37** Context menu clamped inside the pane so it never opens off-screen; right-click on an unselected card selects it first so menu actions target what the user clicked (L1840–1841, L2115).
- **HWF-38** Selecting anything (click, search step, keyboard nav, marquee) reopens Details so the entry is always visible (L1671, L1713, L1786, L1823).
- **HWF-39** Ghost proposals are drawn to the right of all real content so they never cover existing cards (L1023–1036).
- **HWF-40** Title commit trims and refuses an empty title (keeps the previous one) (L2411).
- **HWF-41** Shell prevents hiding both panes (Shell L50) and compares context JSON before re-rendering on each 800ms poll (Shell L37).
- **HWF-42** Published Graph is tolerant of records without `counts` and of legacy `nodes` (computes counts, excludes frames) (PG L61–62).

#### Defects not to copy (summary of [BUG] items)

- **HWF-43** Reader link and Shell reader iframe point to `Lexicon Reader v4.dc.html`, which is not in the bundle (L2070; Shell L56).
- **HWF-44** Read-only mode writes UI prefs and the theme key, and allows title rename (L937–940, L2438, L2409).
- **HWF-45** Tidy on load pushes a "Tidy layout" undo entry, so Undo is enabled before the user does anything; Import also overwrites the file's positions with Tidy (L1101, L1555, L957).
- **HWF-46** Duplicate drops the lexicon link (`src: null`) and the edges; accepted proposals also get `src: null`, so their Extract is disabled ("No lexicon entry") (L1461, L1053).
- **HWF-47** Proposals state is outside undo — undoing an accept leaves the proposal marked "accepted" (L1061–1062).
- **HWF-48** Comments are one global list (`jadhr-comments`), not per graph (L998–1000).
- **HWF-49** "1 forms · 1 words" pluralisation; deleting a frame toasts "Deleted 1 card" (L2464, L1450).
- **HWF-50** Root "{n}-letter root" counts whitespace tokens, so a root typed without spaces ("كتب") reads "1-letter root" (L2306, L2311).
- **HWF-51** Root stat "forms" counts every non-description child (a sentence linked straight from a root counts as a form) (L1955).
- **HWF-52** `?note=` is decoded twice; text containing "%" is silently dropped (L1020).
- **HWF-53** Fork's legacy path ignores array-form edges (L1019).
- **HWF-54** Key "1" sets zoom to 100% without re-centring, unlike the zoom-pill reset (L1885 vs L2516).
- **HWF-55** Published Graph sample counts are hard-coded (24 / 6 / 12) and wrong for the graph it shows (PG L46).
- **HWF-56** postMessage handlers accept any origin and post with target "*" (L1102, L2125; PG L52, L56).
- **HWF-57** Double-clicking inside a card's field input also bubbles to the card's double-click fold handler (no guard on L214) — verify in the build.
- **HWF-58** The editor keeps its own lexicon copy that diverges from `lexicon-data.js` (different 6th root and glosses) — production must use one source (L757–824 vs lexicon-data.js L26–33).

---

## Part 3 — Hub, Collections, Library, Search, Concordance, Analyser, shared shell

_Original heading: Parity inventory — Hub, Collections, Library, Search, Concordance, Analyser, shared shell_

Sources read in full: `prototypes/Jadhr.dc.html`, `Collections.dc.html`, `Library.dc.html`, `Search.dc.html`, `Concordance.dc.html`, `Analyser.dc.html`, `jadhr-chrome.js`, `lexicon-data.js` (all 300 lines), `prototypes/PLAN.md`; docs `01-product-and-ia.md`, `02-design-tokens.md`, `05-screens-research.md`, `06-screens-community.md`, `09-search-architecture.md`, plus the relevant parts of `03-screen-reader.md` §3.12, `07-data-model.md` §7.3, `08-api-contract.md` §8.2–8.3, `10-open-questions.md` §1–3, `11-implementation-plan.md`; screenshots `01-hub`, `05-collections`, `06-library`, `07-search`, `08-concordance`, `09-analyser`.

Method notes: numbers marked "computed" were produced by running the seed data in `lexicon-data.js` through the prototypes' own selection logic in Node (not copied from docs). Phone and dark-mode notes are derived from the inline CSS — the prototypes were not run in a browser for this inventory, so phone notes are "inferred from CSS" unless a screenshot shows them. Verbatim copy is in double quotes; `{x}` marks an interpolated value.

Legend: **[GAP]** spec says it, prototype lacks it · **[BUG]** prototype behaviour that is wrong or fragile · **[DEAD]** link target absent from the handoff bundle · **[EXTRA]** prototype has it, spec does not mention it.

---

### 0. Seed data and helpers these screens depend on (`lexicon-data.js`)

- SHL-D01 Seed sizes (computed): 6 roots, 35 words, 21 patterns in `FORM_META`, 9 dictionaries in `DICTS`.
- SHL-D02 `ROOTS` fields: `key`, `ar` (spaced letters, e.g. "ك ت ب"), `bare` ("كتب"), `tr` ("k-t-b"), `en` gloss, `arGist` (Arabic gist), `corpus` (a corpus frequency number: ktb 319, drs 144, ilm 854, qra 88, jls 41, qwm 660).
- SHL-D03 Root keys used across URLs: `ktb`, `drs`, `ilm`, `qra`, `jls`, `qwm`; `ilm` is the universal default root.
- SHL-D04 `WORDS` fields: `id` (ASCII slug, e.g. `maktaba`), `ar` (vocalised), `tr` (diacritic transliteration), `en`, `pos` (`verb`/`noun`/`participle`), `root` (root key), `form` (Arabic wazn string, the key into `FORM_META`), `arDef`, `freq`, `senses[]` (English).
- SHL-D05 `FORM_META[wazn] = [transliteration, English function]`, e.g. `'مَفْعَلَة': ['mafʿala', 'noun of place (fem.)']`; Search's pattern detection and Analyser/Collections labels read it.
- SHL-D06 `BOOK` (prose, id `base`, kind `Classical`): "كِتَابُ العِلْمِ وَالمَكْتَبَة" / "The Book of Knowledge and the Library", 3 chapters, 10 passages, 95 tokens, 45 tagged (computed); BOOK passages have no `ref`, so screens fall back to "Ch. {c}·{p}".
- SHL-D07 `SCRIPTURE[0]` id `quran`, kind `Qurʾān`, "القُرْآنُ الكَرِيم" / "The Qurʾān": 2 suras (al-Baqara · 2 "Medinan · 286 verses"; Ṭā Hā · 20 "Meccan · 135 verses"), 4 passages (2:31, 2:32, 2:255, 20:114), 38 tokens, 6 tagged (computed).
- SHL-D08 `SCRIPTURE[1]` id `bukhari`, kind `Ḥadīth`, "صَحِيحُ البُخَارِي" / "Ṣaḥīḥ al-Bukhārī": 1 chapter (Kitāb al-ʿIlm "The Book of Knowledge · 76 ḥadīth"), 2 passages (Bukhārī 71, Bukhārī 79), 22 tokens, 2 tagged (computed).
- SHL-D09 Token encoding `surface|wordId|gram` parsed by `parseTok()` → `{ ar, word, gram }`; untagged tokens are plain surfaces.
- SHL-D10 `stripDia(t)` removes U+064B–U+0652, U+0670, U+0640 and folds أ إ آ → ا (matching only); used by Search, Concordance sort/collocates, Analyser, Library.
- SHL-D11 `analyse(surface)` → `{ surface, segments[{t,g,kind:'pre'|'stem'|'suf'}], candidates[{root,score,word?}], word|null, pattern, gram, confidence }`; strips one prefix from `AFFIX_PRE` (15 entries) and one suffix from `AFFIX_SUF` (22 entries); lexicon hit → score 0.99; skeleton = root → 0.92; all root letters within ≤3 extra letters → 0.7 − 0.05·extra; 2 of 3 letters → 0.3; candidates deduped by root, max 3 + the lexicon hit.
- SHL-D12 `KEYS` (localStorage, all `jadhr-` prefixed): `prefs`, `word-states`, `marks`, `notes`, `progress`, `texts`, `sessions`, `context`, `account`, `proposals`, `published`, `onboarded`; `load(k,d)`/`save(k,v)` are try/catch wrapped and fall back to the default.
- SHL-D13 Cross-page context written by Reader v5 to `jadhr-context`: `{ book (Arabic title), bookId, word, wordAr, wordTr, root, rootAr }` — note `03-screen-reader.md` §3.12 documents a different shape `{ root, word, passage }` (doc drift).

---

### 1. Shared shell (`jadhr-chrome.js` + per-page header templates) — 01 §1.4

#### 1.1 Structure and items
- SHL-01 `jadhr-chrome.js` is data only: `NAV`, `navModel(current)`, colour map `C`, and style helpers `dot(c)`, `chip(on)`, `seg(on)`; every page renders the header from its own template (comment: "Shared header model for Jadhr pages (data only — each page renders it from its template).").
- SHL-02 Header bar: 52px tall, `flex:none`, `gap:12px`, `padding:0 16px`, background `#f8f8fa` (`--panel`), `border-bottom:1px solid #e5e5ea`; not sticky on the shared-shell pages.
- SHL-03 Logo: 18×18px square, `border-radius:5px`, `#a8682c` (`--c-root`), plus wordmark "Jadhr" (14px/600); whole group links to `Jadhr.dc.html` (Hub); `flex:none`.
- SHL-04 Nav items and order (11): "Read" → Reader v5 · "Explore" → Collections · "Library" · "Look up" → Reader v5 `?mode=lookup` · "Concordance" · "Analyser" · "Graph" → Editor v5 · "Notebook" · "Review queue" · "Classroom" · "Data & API".
- SHL-05 Nav item style: `padding:5px 10px`, `border-radius:7px`, `font-size:12.5px`, `white-space:nowrap`; inactive `color:#4f4f5a`; active `background:#fff`, `color:#16161a`, `font-weight:500`, `box-shadow:0 1px 2px rgba(0,0,0,.06)` and `aria-current="page"`.
- SHL-06 Nav track: `display:flex; gap:1px; padding:2px; background:#ecedf1; border-radius:9px; overflow-x:auto; scrollbar-width:none; min-width:0; flex:0 1 auto` — the strip scrolls horizontally and shrinks; scrollbar hidden.
- SHL-07 Spacer `flex:1` between nav and page actions; page actions sit at the right edge and stay visible while the nav scrolls (screenshots 05/06/08/09 show the strip clipped at "Clas"/"Notebook" with actions still visible).
- SHL-08 Page actions by screen: Collections "Ask about a word" link; Library All/Scripture/Classical/Mine segmented filter; Concordance KWIC/Distribution segmented + "Export CSV"; Analyser Table/Interlinear segmented + "Copy CoNLL-U"; Search has no actions (results count text only).
- SHL-09 Active item per page: Collections → "Explore", Library → "Library", Concordance → "Concordance", Analyser → "Analyser"; Search calls `navModel('')` but never renders the nav.
- SHL-10 Segmented control `seg(on)`: `font-size:12.5px; padding:4px 11px; border-radius:7px; white-space:nowrap`; on = `border:1px solid #d3d3dc; background:#fff; color:#16161a; font-weight:500`; off = transparent border/background, `color:#71717c`, weight 400; wrapper `gap:2px; padding:2px; background:#ecedf1; border-radius:9px`.
- SHL-11 Chip `chip(on)`: `font-size:12px; padding:3px 10px; border-radius:99px; cursor:pointer; color:#16161a`; on = `background:#eef3fd; border:1px solid #2f6ae0`; off = `background:#fff; border:1px solid #e5e5ea`.
- SHL-12 Type dot `dot(c)`: 8×8px, radius 99px, `flex:none`, background = type colour.
- SHL-13 Colour map `C`: root `#a8682c`, form `#6f55c4`, word `#2f6ae0`, sentence `#177a44`, desc `#6f6f7c`, amber `#b45309`, good `#15803d`, bad `#c02626`, t1 `#16161a`, t2 `#4f4f5a`, t3 `#71717c`, line `#e5e5ea`, line2 `#d3d3dc`, card2 `#f5f5f8`, panel `#f8f8fa`.
- SHL-14 Global page CSS: `body` background `#eeeef1` (canvas; Hub uses `#fffffe`), `a{color:#2f6ae0}` with hover `#16161a`, fonts IBM Plex Sans (UI), Amiri (Arabic), IBM Plex Mono (counts/labels), `-webkit-font-smoothing:antialiased`.
- SHL-15 Focus ring on buttons/links/inputs (and textareas where present): `outline:2px solid #2f6ae0; outline-offset:2px` on `:focus-visible`.
- SHL-16 Uppercase section-label recipe used on all six screens: IBM Plex Mono 10.5px (or Sans 11px), `letter-spacing:.09em`, uppercase, `#71717c`.
- SHL-17 Data loading: each page `import()`s `lexicon-data.js` and `jadhr-chrome.js` on mount and renders empty arrays until loaded (no loading indicator anywhere).

#### 1.2 Hub-only shell parts (context strip, sign-in)
- SHL-18 Hub has its own bespoke header, not the shared one: 56px, `position:sticky; top:0; z-index:20`, logo 20×20 radius 6, wordmark "Jadhr" 15px/600 plus "جَذْر" (Amiri 17px, `#71717c`, `dir="rtl"`).
- SHL-19 Hub header mode strip (4 items, not the 11-item NAV): "Read" (title "Read a text with the dictionary beside it") → `Lexicon Reader v4.dc.html` **[DEAD]**, "Look up" ("Open the dictionary") → Reader v5 `?mode=lookup`, "Graph" ("Root-family canvas") → Editor v5, "Review" ("Recall the roots you met") → Reader v5 `?mode=review`; style `padding:5px 12px`, no active state, no overflow scrolling.
- SHL-20 Hub header search: `⌕` glyph, input placeholder "Search", `aria-label="Search the lexicon"`, `⌘K` mono badge; width `min(260px,30vw)`, height 30px; submit → `Search.dc.html?q={q}` (empty/whitespace query ignored).
- SHL-21 Sign-in button (signed out): "Sign in" (white, `border:1px solid #e5e5ea`, hover border `#2f6ae0`) opens the sign-in sheet; signed in: 28px brown avatar circle linking to `Profile.dc.html` with `title={account name}`.
- SHL-22 "Where you were" context strip: 40px row under the header, white, `overflow-x:auto`, label "Where you were", up to 3 pill chips, spacer, "Clear" text button; rendered only when at least one chip exists.
- SHL-23 Context chip 1 (book): green dot `#177a44`, label = `ctx.book` (Arabic title, Amiri 15px), href `Lexicon Reader v4.dc.html` with no `book` param **[DEAD]** **[BUG: ignores `ctx.bookId`]**.
- SHL-24 Context chip 2 (word): blue dot, label "{wordAr} · {wordTr}" (Amiri 15px), href `Lexicon Reader v4.dc.html?w={word}` **[DEAD]**.
- SHL-25 Context chip 3 (root): brown dot, label `rootAr` (Amiri 15px, `letter-spacing:.06em`), href `Concordance.dc.html?root={root}`.
- SHL-26 Chips use `dir="auto"` per label so mixed Arabic/Latin labels order correctly (screenshot 01: "maktaba · مَكْتَبَة").
- SHL-27 "Clear" writes `null` to `jadhr-context` and hides the strip immediately.
- SHL-28 The strip only exists on the Hub; the shared-shell pages have no context strip.

#### 1.3 Shell gaps and cross-checks
- SHL-29 [GAP] 01 §1.4 specifies a theme toggle on the right side of the header; none of the six pages has one, and none reads `jadhr-theme`.
- SHL-30 [GAP] Search page omits the nav strip entirely (logo + search field + result count only), contradicting "every screen except the Reader, the Editor, and the Split Shell wears the same header".
- SHL-31 [GAP] Hub is not exempted by 01 §1.4 but uses a different header (4 modes, header search, sign-in) — decide whether Hub keeps a bespoke header.
- SHL-32 [GAP] "Search" and "Ask" are not in NAV; PLAN R5 says "Hub and shared nav gain Ask / Explore" — NAV gained Explore only; Ask appears only as Collections' page action.
- SHL-33 [BUG] Many in-page links target `Lexicon Reader v4.dc.html`, which is not in the bundle (Hub mode "Read", context chips, Library shelf/continue, Search word/pattern/passage rows, Concordance rows, Analyser "entry") — PLAN P5 claims "no dead links"; PLAN R5 says "Read now points at v5" — regression in the handoff copy; production must route all of these to the Reader.
- SHL-34 [GAP] No `lang`/`dir` on `<html>`; Arabic runs carry `dir="rtl"` but never `lang="ar"` (02 §2.7 requires `lang="ar"` on Arabic and `lang="en"` on glosses).
- SHL-35 [GAP] No overlay on these screens closes on `Esc` (Hub sign-in sheet, Library add sheet) — 02 §2.7 "Esc closes every overlay, without exception".
- SHL-36 [GAP] No `IBM Plex Sans Arabic` is loaded on these screens although 02 §2.3 reserves it for Arabic UI chrome and Arabic inputs (prototype inputs use Amiri).
- SHL-37 Phone (inferred from CSS): shared header has no breakpoint; at 390px the nav strip shrinks toward zero width and scrolls, page actions keep their width; pages with wide actions (Library's 4-segment filter, Concordance's 2 segments + Export CSV) leave almost no visible nav.
- SHL-38 Phone (inferred from CSS): Hub header has no overflow handling — logo + 4 modes + 30vw search + Sign in exceed 390px (est. ~640px) and the 56px row will overflow horizontally.
- SHL-39 Dark mode: none; every colour in the six pages and in `navModel`/`chip`/`seg` is a literal hex in inline styles; parity requires tokenising (02 §2.2 dark set exists: canvas `#0f0f12`, card `#1a1a20`, panel `#15151a`, t1 `#f2f2f7`, ring `#7aa2f7`, c-root `#e0a361`, etc.).
- SHL-40 Footer (Hub only): 40px bar — "Grant-funded · CC BY-SA data · MIT code", spacer, "v2026.09", links "Contribute" → Review Queue, "API" → Data & API, "Audit" → `UX Audit & Roadmap.dc.html` **[DEAD]**, "Explorations" → `Feature Explorations.dc.html` **[DEAD]** (01 §1.2: design artefacts, do not implement).

#### 1.4 Quran adaptation notes (shared shell)
- SHL-Q01 Arabic is the default: `<html lang="ar" dir="rtl">`; English via a persisted language toggle (server-side preference when signed in, local otherwise); every Arabic run `lang="ar"`, every English run `lang="en"`.
- SHL-Q02 Use CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline`, `text-align:start`) so the header, chips, progress bars, chevrons ("‹ All collections") and arrows ("concordance →", "Build graph from this →") mirror automatically; arrows that carry meaning (KWIC labels) must be re-derived per direction.
- SHL-Q03 Nav for the ecosystem, Arabic labels first, order to decide: Quran reader · Explore · Library · Dictionary (Arabic lexicon) · Hadith encyclopedia · Books · Concordance · Analyser · Graph · Notebook · Review queue · Classroom · Data & API; keep SHL-F01 (scroll + pinned actions) and in RTL start the scroll at the right and scroll the active item into view.
- SHL-Q04 Fonts: IBM Plex Sans Arabic for Arabic chrome and inputs; Amiri for classical prose; a Quran-specific font for Uthmani text (licence to verify); keep Plex Mono only for Latin counts or switch counts to a digits preference.
- SHL-Q05 Digits preference (Arabic-Indic ٠–٩ vs Western 0–9) applied to counts, refs and dates; reference parsers accept both.
- SHL-Q06 Theme toggle in the header and full dark token set from 02 §2.2 (one shared `theme` preference across all apps in the ecosystem, including embeds).
- SHL-Q07 Global ⌘K omnibox on every screen (Hub's shortcut generalised), searching Quran refs, words, roots and the other corpora.
- SHL-Q08 Phone: collapse the shared header like the Reader's (logo · title · primary action · ⋯ menu) instead of a near-zero-width scrolling strip.
- SHL-Q09 Cross-page context generalises to the ecosystem: `{ corpus, textId, ref (surah:ayah / hadith no. / page), word, root }` held in app routing state, not localStorage polling.
- SHL-Q10 Data needed: user preferences (language, theme, digits, transliteration on/off), auth state, cross-page context, destination catalogue.

---

### 2. Hub (`Jadhr.dc.html`, route `/`) — 06 §6.1

#### 2.1 Layout and elements
- HUB-01 Page background `#fffffe` (paper), full-height column: bespoke header (SHL-18…21), optional context strip (SHL-22…27), centred hero column, footer (SHL-40), sign-in sheet overlay.
- HUB-02 Hero glyph "ع ل م" — Amiri 36px, `#a8682c`, `letter-spacing:.12em`, `dir="rtl"` (static, not linked).
- HUB-03 Headline h1 "Read Arabic by its roots." — `clamp(28px,4vw,36px)`, 600, `letter-spacing:-.02em`.
- HUB-04 Lede "Tap any word in a text and see its root, the whole family built on it, what nine classical lexica say — then map it on a canvas. Free and open, for learners and scholars." (16px, `#4f4f5a`, `text-wrap:pretty`, max 640px).
- HUB-05 Hero search form: `width:min(560px,100%)`, 12px radius, `--sh` shadow, `⌕` glyph 18px, input placeholder "Try a word, a root, k-t-b, or 2:255", `aria-label="Search"`, `dir="auto"`, Amiri/Plex 20px, submit button "↵" (mono badge style).
- HUB-06 Three "door" cards (grid `repeat(auto-fit,minmax(200px,1fr))`, max 640px): type dot + label + sub-line; hover border `#2f6ae0`.
- HUB-07 Door "Read" — green dot — "Qurʾān, ḥadīth, classical prose — or paste your own." → `Library.dc.html`.
- HUB-08 Door "Look up" — brown dot — "6 roots · 9 lexica · patterns and timelines (prototype data)." → Reader v5 `?mode=lookup` (hard-coded counts).
- HUB-09 Door "Map" — purple dot — "Build and publish root-family graphs." → Editor v5.
- HUB-10 Section label "Everything on the platform" (mono uppercase) above a grid `repeat(auto-fill,minmax(150px,1fr))`, gap 6px, of 17 tiles: dot · label (ellipsis) · mono tag; tile `title` = one-line hint; hover border `#2f6ae0`.
- HUB-11 Tile 1 "Ask" · tag "6a" · blue · hint "One word, five minutes — the plain way in" → Reader v5 `?mode=ask`.
- HUB-12 Tile 2 "Explore" · "6g" · brown · "Word of the day · curated sets" → Collections.
- HUB-13 Tile 3 "Read" · "Reader v5" · green · "Books, scripture, your own texts — with the dictionary beside" → Reader v5.
- HUB-14 Tile 4 "Library" · "3a·3b" · green · "Shelf, progress, add a text" → Library.
- HUB-15 Tile 5 "Dictionary" · "Lookup" · brown · "Roots, patterns, lexica, timelines" → Reader v5 `?mode=lookup`.
- HUB-16 Tile 6 "Concordance" · "2c·2d" · green · "Every attestation of a root" → Concordance.
- HUB-17 Tile 7 "Analyser" · "5d" · purple · "Morphology of any surface form" → Analyser.
- HUB-18 Tile 8 "Graph" · "Editor" · purple · "Root-family canvas" → Editor v5.
- HUB-19 Tile 9 "Split view" · "5i" · purple · "Text · dictionary · graph side by side" → Shell.
- HUB-20 Tile 10 "Review" · "1a·1b" · brown · "Root-family recall" → Reader v5 `?mode=review`.
- HUB-21 Tile 11 "Notebook" · "5f·3f" · blue · "Notes and reading journal" → Notebook.
- HUB-22 Tile 12 "Search" · "5b" · blue · "Results with facets" → Search.
- HUB-23 Tile 13 "Review queue" · "4b" · amber `#b45309` · "Proposals awaiting approval" → Review Queue.
- HUB-24 Tile 14 "Classroom" · "4c·4d" · green · "Assignments and the shared graph" → Classroom.
- HUB-25 Tile 15 "Published graphs" · "4f" · purple · "Read-only, embeddable" → Published Graph.
- HUB-26 Tile 16 "Profile" · "4h" · brown · "Contributions, data export" → Profile.
- HUB-27 Tile 17 "Data & API" · "5g·5h" · grey `#6f6f7c` · "Releases, licences, playground" → Data & API.
- HUB-28 Tile tags are design-exploration codes (6a, 3a·3b, …) — internal; do not ship them as user-facing labels.

#### 2.2 Sign-in sheet (local-first prompt)
- HUB-29 Opens only from the header "Sign in" button; scrim `rgba(10,10,16,.35)`, sheet aligned to the bottom (`align-items:flex-end`, padding 28px), `width:min(520px,100%)`, radius 14, `--sh-open`, `dcRise .16s` entrance.
- HUB-30 Title is data-driven: "You have {n} starred word{s} and {m} note{s} on this device" when `jadhr-marks` or `jadhr-notes` has anything, else "Sign in to sync and contribute" (correct singular/plural).
- HUB-31 Body copy "Your reading, notes and stars live in this browser. Sign in to keep them across devices and to propose edits to the lexicon. Reading, lookups and the graph editor never require an account."
- HUB-32 Close button "✕" with `aria-label="Close"` (24×24).
- HUB-33 Three provider buttons, equal width: "Continue with email", "ORCID", "Institution" — all call the same fake sign-in.
- HUB-34 Footer row: link "Export my data instead" → Profile · "·" · "No tracking, no ads — grant-funded, open licence" · spacer · "Not now" (closes).
- HUB-35 Fake sign-in writes `jadhr-account` = `{ name:'Amal Haddad', affiliation:'Lexicography · Univ. of Jordan', orcid:'0000-0002-1825-0097', since:'2025' }` and swaps the button for the avatar (placeholder identity; never ship).
- HUB-36 Closing: backdrop click, "✕", "Not now"; clicks inside the sheet stop propagation; no Esc (SHL-35).

#### 2.3 Interactions, keyboard, URL, persistence
- HUB-37 `⌘K` / `Ctrl+K` anywhere: `preventDefault()` then focuses the input with `aria-label="Search"` — the hero input, not the header input (which is labelled "Search the lexicon").
- HUB-38 Both search inputs share one `q` state (typing in one mirrors into the other); Enter or "↵" submits → `Search.dc.html?q={encoded}`.
- HUB-39 URL params: none read.
- HUB-40 Persistence read: `jadhr-account`, `jadhr-context`, `jadhr-marks` (count of keys), `jadhr-notes` (array length); written: `jadhr-account` (sign-in), `jadhr-context` (Clear → null).
- HUB-41 States: first visit = no context strip, "Sign in" button, generic sheet title; returning = context strip + data-aware sheet title; signed in = avatar.
- HUB-42 No loading, error, or empty states beyond hiding the strip.

#### 2.4 Phone and dark mode
- HUB-43 Phone (inferred from CSS): hero padding `clamp(28px,6vw,60px) 20px`; doors stack to one column; "Everything" grid becomes 2 columns at 390px (150px min); sign-in sheet behaves as a bottom sheet; header overflows (SHL-38).
- HUB-44 Dark mode: none (literal colours); hero glyph colour, tile dots and footer would need dark tokens.

#### 2.5 Cross-check against 06 §6.1 and 01 §1.2
- HUB-45 [GAP] Masthead should present "the name جَذْر with its meaning" and the family premise; prototype shows the wordmark only in the header and never states that جَذْر means "root".
- HUB-46 [GAP] Spec label "pick up where you left off", built from cross-page context **and reading progress**; prototype labels it "Where you were" and ignores `jadhr-progress` (no passage/position, no resume).
- HUB-47 [GAP] Spec destination cards carry a visible one-line purpose each; prototype shows purposes only as `title` tooltips on the 17 tiles (invisible on touch); only the 3 doors show visible copy.
- HUB-48 [GAP] Spec sign-in prompt "states plainly that everything works without an account" as a prompt on the page; prototype only shows that copy after the user clicks "Sign in".
- HUB-49 [EXTRA] Footer (licence, version, Contribute/API links) and the 17-tile index are not in the spec.
- HUB-50 [EXTRA] Hub uses type colours (root/word/sentence/form) to colour-code destinations; 02 §2.1 says type colours classify linguistic objects only — decide whether destinations may use them.

#### 2.6 Quran adaptation notes (Hub)
- HUB-Q01 Arabic-default chrome: `<html lang="ar" dir="rtl">`, header and hero mirror; English becomes a language toggle (persisted preference), not the default.
- HUB-Q02 Hero premise rewritten for Quran-first: reading the Quran by its roots; hero glyph should be a live "root of the day" (shared with Collections' word of the day) rather than a static "ع ل م".
- HUB-Q03 Search placeholder must teach Quran-first queries: Arabic word, root letters, surah:ayah (`2:255`, Arabic-Indic `٢:٢٥٥`, "البقرة 255", surah names in Arabic and transliteration).
- HUB-Q04 Context strip shows last surah:ayah (with surah name), last word, last root; resume deep-links to the exact ayah; needs reading position per user (`surah`, `ayah`, `at`) plus the `{word, root}` context.
- HUB-Q05 Destinations restructured for the ecosystem: Quran reader, roots dictionary, concordance, analyser, collections, Arabic dictionary, hadith encyclopedia, book reader, notebook — counts in door sub-lines computed from data (never hard-coded like "6 roots · 9 lexica").
- HUB-Q06 Drop exploration tags; keep visible one-line purposes (Arabic first) on every destination.
- HUB-Q07 Sign-in sheet copy in Arabic; ORCID/Institution options are scholar-oriented — keep only if the auth plan supports them; local-first promise and "export my data" path stay.
- HUB-Q08 Data needed: auth state, local counts (stars, notes), reading position, cross-page context, destination catalogue with counts, search endpoint.

---

### 3. Collections / Explore (`Collections.dc.html`, route `/explore`, `?set=`) — 06 §6.2

#### 3.1 Header
- COL-01 Shared header with "Explore" active; page action "Ask about a word" → Reader v5 `?mode=ask` (white button style).

#### 3.2 Home view (no `?set`)
- COL-02 Container max 1100px, padding `28px clamp(16px,4vw,40px) 60px`, gap 24px; top row grid `minmax(0,1fr) minmax(220px,260px)` (word of the day + progress card).
- COL-03 Word-of-the-day card: whole card is a link; gradient `linear-gradient(135deg,#a8682c,#6b3f14)`, white text, radius 16, hover `filter:brightness(1.05)`.
- COL-04 WOTD label "Word of the day · {date}" (11px uppercase; date via `toLocaleDateString(undefined,{day:'numeric',month:'short'})`, browser locale — screenshot "SEP 18").
- COL-05 WOTD headword: Arabic 46px Amiri RTL, then "{tr} — {en}" (16px) in a separate LTR span.
- COL-06 WOTD blurb: "Also: {senses[1]}. Built on {root.tr} — {root.en}." (the "Also:" sentence is omitted when the word has one sense).
- COL-07 WOTD pills (non-interactive spans): "Open" and "root {root.ar}".
- COL-08 WOTD link target: Reader v5 `?mode=ask&q={transliteration}` (Ask card).
- COL-09 WOTD selection logic (deterministic by date): `day = Math.floor(Date.now() / 864e5)`; `word = WORDS[day % WORDS.length]` — same word for everyone on the same UTC day, 35-day cycle with the seed; verified: 2026-09-18 → qāma (matches screenshot), 2026-10-02 → darasa (computed).
- COL-10 [BUG] Day index uses the UTC day but the label uses the local date — for UTC+3 users the label flips at local midnight while the word flips at 03:00 local; pick one timezone for both.
- COL-11 Progress card: label "Your progress", big number "{met}" + "words met", line "{known} known · {learning} learning · {roots} roots touched", footer "No streaks, no guilt — the words wait."
- COL-12 Progress math: `met` = number of keys in `jadhr-word-states` (any state); `known`/`learning` = counts of those values; roots touched = distinct roots of those words.
- COL-13 Progress without streaks is deliberate (06 §6.2: no streak counter, no loss-aversion mechanic — do not add one).
- COL-14 Section header "Collections" (15px/600) + sub-line "each opens as a small guided walk · built from the prototype data".
- COL-15 Set cards grid `repeat(auto-fill,minmax(220px,1fr))`, gap 12; each card is a `<button>`: 3px top border in the set colour, title, meta "{n} words · {r} roots", sample = first 3 Arabic items joined " · " (Amiri 17px, right-aligned), status line.
- COL-16 Card status: "new" (grey) when none met; "{kept} of {n} met" amber when partial, green `#15803d` when all met.
- COL-17 [BUG] Meta never singularises — screenshot shows "8 words · 1 roots".
- COL-18 Card click: `history.replaceState` to `Collections.dc.html?set={id}` and opens the set view (replace, not push — browser Back leaves the page instead of returning to the list).

#### 3.3 The four curated sets (verbatim)
- COL-19 Set `know` — "Ways of knowing" — colour `#a8682c` — intro "One root, ʿ-l-m, and the whole spectrum from a mark on the ground to the world itself. Watch how each shape changes the job of the word." — why "The single best demonstration of how Arabic builds meaning: same three letters, four shapes, four ideas that still rhyme." — rule: `root === 'ilm'`.
- COL-20 Set `know` items (computed, capped at 8 of 9 matches): عَلِمَ ʿalima · عَلَّمَ ʿallama · عِلْم ʿilm · عَالِم ʿālim · عَالَم ʿālam · مُعَلِّم muʿallim · تَعْلِيم taʿlīm · عَلَامَة ʿalāma — مَعْلُومَة maʿlūma silently dropped by the cap; 1 root.
- COL-21 Set `doers` — "The ones who do it" — `#6f55c4` — intro "Every word here is shaped as فَاعِل — the doer. Writer, scholar, reader, teacher: once you see the shape you can guess a hundred more." — why "Pattern recognition is the fastest win for a beginner. This set trains one pattern across many roots." — rule: `form === 'فَاعِل'`.
- COL-22 Set `doers` items (computed): كَاتِب kātib · عَالِم ʿālim · قَارِئ qāriʾ · جَالِس jālis — 4 words, 4 roots.
- COL-23 [BUG] `doers` intro promises "teacher" but teachers (مُدَرِّس, مُعَلِّم) are مُفَعِّل and not in the set; the 4th item is "seated" — copy/data mismatch.
- COL-24 Set `places` — "Where it happens" — `#177a44` — intro "Desk, school, council: the noun-of-place shape turns an action into the room it happens in." — why "Place nouns are everywhere in city signs and book titles; they are also the friendliest introduction to the مَفْعَل pattern." — rule: form matches `^مَفْع[َِ]ل` OR `pos === 'place'` OR English gloss matches desk/school/council/office/place/library.
- COL-25 Set `places` items (computed): مَكْتَب maktab · مَكْتَبَة maktaba · مَدْرَسَة madrasa · مَجْلِس majlis — 4 words, 3 roots (`pos === 'place'` never matches the seed).
- COL-26 Set `known` — "Words you may already know" — `#2f6ae0` — intro "Kitāb, ʿilm, madrasa — words that travelled into Turkish, Persian, Urdu and Swahili. Meet them at home." — why "Recognition before learning: if a word already lives in your other languages, the root behind it is a free gift." — rule: transliteration in {kitāb, ʿilm, madrasa, kātib, ʿālim, maktab, dars, majlis, qalam, kalima}.
- COL-27 Set `known` items (computed, seed order): كَاتِب · مَكْتَب · كِتَاب · مَدْرَسَة · دَرْس · عِلْم · عَالِم · مَجْلِس — 8 words, 4 roots (qalam, kalima absent from seed).
- COL-28 Items per set capped at 8 (`slice(0, 8)`); set definitions carry an unused `roots` field.

#### 3.4 Set view (`?set={id}`)
- COL-29 Layout: grid `minmax(0,1fr) 300px`; main column on `#fffffe`, side panel `#f8f8fa` with left border.
- COL-30 Title row: back button "‹ All collections" (replaceState to `Collections.dc.html`), set title (20px/600), meta "{n} words".
- COL-31 Intro paragraph (14px, max 600px, `text-wrap:pretty`).
- COL-32 Item row (white card, radius 12, wraps): mono number "01"…, Arabic headword (Amiri 28px, blue `#2f6ae0`, min-width 110px, right-aligned), English gloss (14.5px), sub-line "{tr} · {pattern function}" (e.g. "kātib · active participle"), root in Arabic (Amiri 15px brown, plain text, not a link), actions.
- COL-33 Item action "Open" → Reader v5 `?mode=ask&q={tr}` (Ask card).
- COL-34 Item action Keep cycle (one button): no state → label "Keep" (black fill, white text) → click → `learning`, label "Learning" (amber border/text) → click → `known`, label "Known ✓" (green) → click → state removed; saved to `jadhr-word-states` immediately.
- COL-35 [BUG] A word starred in the Reader (`'starred'` state) renders as "Learning" and the next click overwrites it to `learning`.
- COL-36 Side panel: label "Why this set", why copy, divider, label "Roots in this set", root pills (Amiri 17px brown, white pill) → `Concordance.dc.html?root={key}`.
- COL-37 Side CTA "See the set as a map" (black button) → `Lexicon Editor v5.dc.html?from=collection&seed={base64(JSON{ words:[{ar,tr,en,pos,form:{ar,tr,en},root:{ar,tr,en}}], sentence:null })}`; UTF-8-safe base64 (`btoa(unescape(encodeURIComponent(…)))`), falls back to a plain editor link on error.
- COL-38 Side CTA "Review kept words" (white button) → Reader v5 `?mode=review`.

#### 3.5 Study swipe deck (spec only)
- COL-39 [GAP] "Study this set" button and swipe deck are absent from `Collections.dc.html` and from every file in the bundle, although PLAN R9 marks it done ✔ and 06 §6.2 / 01 §1.2 / 11 Phase list require it.
- COL-40 Spec — front: the word + audio button; tap or `Space` flips to the meaning.
- COL-41 Spec — swipe, or `←` / `→`: "Skip" / "Keep".
- COL-42 Spec — Keep marks the word `learning` **and** stars it, which pulls its whole root family into the review deck (03 §9 note repeats this).
- COL-43 Spec — end card links to Review.
- COL-44 Spec — audio: 10 §2 says browser `speechSynthesis` is not acceptable as default; hide the button when `audio_url` is null.

#### 3.6 States, URL, persistence, keyboard
- COL-45 URL: `?set={know|doers|places|known}` opens that set; unknown ids fall back to home; all set changes use `replaceState`.
- COL-46 Persistence: reads/writes `jadhr-word-states` only.
- COL-47 States: no data yet → home shows "0 words met", sets "new"; no loading or error state; no empty state for a set with zero items (cannot happen in seed).
- COL-48 Keyboard: set cards are buttons (Enter/Space); items' Open is a link, Keep a button; no shortcuts on this page.

#### 3.7 Phone and dark mode
- COL-49 Phone (inferred from CSS): home top row never stacks — at 390px the WOTD card gets ~120px next to the 220px progress card; set view's fixed 300px side panel leaves the main list ~60px wide; both need a breakpoint that stacks columns.
- COL-50 Dark mode: none; the WOTD gradient and the set colours are literals and need dark variants.

#### 3.8 Cross-check against 06 §6.2
- COL-51 [GAP] Spec WOTD shows "one attestation"; prototype shows the second sense and the root gist instead.
- COL-52 [GAP] Spec "Root chips are shown per item"; prototype shows the item's root as plain text and the chips only in the side panel.
- COL-53 [EXTRA] Keep cycles to Known and back to none (spec only says Keep marks `learning`).
- COL-54 Spec progress "words met and sets advanced": words met ✓, sets advanced only via per-card "{k} of {n} met".

#### 3.9 Quran adaptation notes (Collections)
- COL-Q01 Word/root of the day chosen from Quranic vocabulary (frequency-weighted pool), deterministic by date in one declared timezone, cached and shareable via `GET /word-of-the-day?date=`; label in Arabic with optional Hijri date.
- COL-Q02 "One attestation" becomes one ayah (surah:ayah, Uthmani text, translation) linking into the Quran reader at that ayah.
- COL-Q03 Curated sets rebuilt from Quran data and stored in the DB (`GET /collections`): e.g. high-frequency Quranic roots, a single root's family across the Quran, one wazn across roots, names/attributes, words that travelled into other languages; set copy authored in Arabic first; every claim in intro copy must match the set's actual items (see COL-23).
- COL-Q04 Progress can show coverage — share of Quran word occurrences covered by known words — still with no streaks.
- COL-Q05 Study deck needs per-word recitation audio (licensed source, nullable) and the review-deck integration (star → root family).
- COL-Q06 Arabic UI: back chevron and arrows mirror in RTL; Keep/Learning/Known labels in Arabic; English transliteration lines become optional per preference.
- COL-Q07 Data needed: words with Quran frequency, root, wazn, glosses (ar/en), one attestation per word, audio URL, set definitions, per-user word states, editor seed endpoint.

---

### 4. Library (`Library.dc.html`, route `/library`, `?add=1`) — 05 §5.1

#### 4.1 Header and filter
- LIB-01 Shared header with "Library" active; page action = segmented filter "All" · "Scripture" · "Classical" · "Mine" ("Mine {n}" once the user has texts).
- LIB-02 Filter rules: Scripture = kind `Qurʾān` or `Ḥadīth`; Classical = kind `Classical` (the prose book); Mine = user texts; default All; filter is not in the URL.

#### 4.2 Continue
- LIB-03 "Continue" section shown only when some text has progress with a timestamp; picks the most recent `jadhr-progress[textId].at`.
- LIB-04 Continue card (link, `--sh` shadow, hover border blue): 44×60 cover gradient, Arabic title (Amiri 20px), meta "ch. {ch+1} · passage {pi+1} · {date}" (`toLocaleDateString()`, screenshot "9/18/2026"), 4px progress bar in `#a8682c`, black pill "Resume".
- LIB-05 Continue link → `Lexicon Reader v4.dc.html?book={id}` **[DEAD]** (should be the Reader at the saved passage).

#### 4.3 Shelf
- LIB-06 Section label "Shelf" + right meta "{shown} texts · {known} words known" (known = global count of `known` word states, not per filter).
- LIB-07 Grid `repeat(auto-fill,minmax(210px,1fr))`, gap 12; built-ins first (prose book, Qurʾān, Bukhārī), then user texts in save order.
- LIB-08 Card cover 64px: built-ins get gradients (base brown `#a8682c→#6b3f14`, quran green `#177a44→#0d4a29`, bukhari purple `#6f55c4→#3d2d7a`); user texts get a bordered `#f5f5f8` block labelled "yours".
- LIB-09 Card title: Arabic (Amiri 19px, RTL, right-aligned); no English title shown.
- LIB-10 Card sub-line: built-ins "{n} chapters · {kind}" (screenshot "1 chapters · Ḥadīth" — no singular) **[BUG]**; user texts "pasted · {n} words · {r} to review".
- LIB-11 Card known line: "{k}% known", coloured green ≥90, amber ≥75, red otherwise; k = share of tagged token occurrences whose word state is `known`.
- LIB-12 [BUG] Texts with zero recognised words report "100% known" (green) — `knownPct` returns 100 when there are no ids.
- LIB-13 Card progress bar (3px, cover colour) + label "{p}%" or "new"; p = `((ch + (pi+1)/passagesInChapter) / chapters) × 100`; user texts have no chapters, so they always read "new".
- LIB-14 Card link → `Lexicon Reader v4.dc.html?book={id}` **[DEAD]**.
- LIB-15 "Add a text" tile (dashed `1.5px #d3d3dc`, min-height 150): "+", "Add a text", "paste · URL · PDF or photo"; opens the add sheet.
- LIB-16 No rename, delete, reorder, or sort for shelf items; no search within the shelf.

#### 4.4 Add-a-text sheet
- LIB-17 Modal: scrim `rgba(10,10,16,.4)`, centred, `width:min(900px,100%)`, `max-height:100%` with internal scroll, radius 14, `--sh-open`; opens from the tile or `?add=1`; closes on backdrop or "✕" (`aria-label="Close"`); no Esc.
- LIB-18 Sheet header (52px): title "New text", segmented mode switch "Paste" · "URL" · "PDF / image", close button.
- LIB-19 Body: two panes in a grid `repeat(auto-fit,minmax(320px,1fr))` — left input pane, right live preview; stacks when narrow.
- LIB-20 Left label "Your text" (mono uppercase).
- LIB-21 Paste mode: textarea `dir="rtl"`, 9 rows, vertical resize, Amiri 19px, line-height 1.9, placeholder "الصق النص هنا…".
- LIB-22 URL mode: input placeholder "https://… (article, Wikisource page, shamela.ws)" + note "Fetching and extracting the article text is a server-side step in the full build. In this prototype, paste the text instead." (stub — URL value is never used).
- LIB-23 PDF / image mode: dashed drop zone "Drop a PDF or a photo of a page" + "OCR with tashkīl restoration runs on the server — not wired in this prototype." (no file input, no drop handler).
- LIB-24 Meta line: "{n} words · tashkīl present" / "{n} words · no tashkīl detected" (detects U+064B–U+0652), or "paste Arabic text to see the annotation" when empty.
- LIB-25 Checkbox "add tashkīl (auto, reviewable)" — checked by default, not wired to anything.
- LIB-26 Title input `dir="rtl"`, Amiri 16px, placeholder "عنوان النص".
- LIB-27 Button "Save to my library" — enabled only when trimmed text > 10 chars and title non-empty (disabled style `#f5f5f8`/grey; enabled black).
- LIB-28 Right label "Live preview · annotated" + match badge "{pct}% of words matched" (green ≥80, amber ≥50, grey otherwise) or "—".
- LIB-29 Preview renders the first 80 tokens (Amiri 24px, line-height 2, RTL, wrapped): lexicon hit → dotted underline `#d3d3dc`; candidate score ≥0.6 → amber background + amber inset underline; otherwise grey text.
- LIB-30 Preview token tooltips: hit "{tr} — {en}"; candidate "root {root.tr}? ({score})"; none "not in lexicon".
- LIB-31 Review rows (max 3, amber box): token, "root uncertain — {root.ar} ({score})", link "Analyse" → `Analyser.dc.html?q={token}`.
- LIB-32 Preview footer counts: "{n} roots", "{n} entries", "{n} need review", "{n} not in lexicon".
- LIB-33 Classification: matched = lexicon hit; review = no hit and top candidate 0.6 ≤ score < 0.95; unknown = no hit and no candidate ≥0.6.
- LIB-34 Save writes to `jadhr-texts`: `{ id:'txt'+Date.now(), title, short (first 2 words of title), text, n (token count), words (matched word ids over the whole text), review (count over the first 80 tokens only), ts }`, closes the sheet, clears inputs, switches the filter to "Mine".
- LIB-35 [BUG] `review` is counted over the first 80 tokens while `words` and `n` use the whole text.
- LIB-36 Saved user texts appear in the Reader rail automatically and in the Concordance (which splits them into sentences on read).

#### 4.5 States, URL, persistence, keyboard
- LIB-37 URL: `?add=1` opens the sheet on load; nothing else read or written.
- LIB-38 Persistence: reads `jadhr-texts`, `jadhr-word-states`, `jadhr-progress`; writes `jadhr-texts`.
- LIB-39 States: no Continue section when there is no progress; "Mine" with no texts shows only the add tile; no loading, error, or save-failure state.
- LIB-40 Keyboard: no shortcuts; Enter in title does not submit (no form element).

#### 4.6 Phone and dark mode
- LIB-41 Phone (inferred from CSS): shelf becomes one column; add sheet panes stack (320px min); the 4-segment filter in the header crowds out the nav strip.
- LIB-42 Dark mode: none; cover gradients and amber review styling are literals.

#### 4.7 Cross-check against 05 §5.1 and 10 §3
- LIB-43 [GAP] Spec card: type dot, Arabic title, **English title**, kind label (`Qurʾān`/`Ḥadīth`/`prose`/`user`), meta (chapters **and passages**), progress, **words-encountered count**; prototype: cover block, Arabic title, chapters·kind, % known, % progress.
- LIB-44 [GAP] Spec filter "All plus the available kinds" (data-driven); prototype hard-codes All/Scripture/Classical/Mine.
- LIB-45 [GAP] Spec Paste splits text into passages and tokenises; prototype stores one raw string plus matched ids (no passages).
- LIB-46 [GAP] Spec empty state "a prompt to add the first text, with the three modes offered directly"; prototype has none.
- LIB-47 [EXTRA] Continue section, % known, live annotated preview with review rows and the "add tashkīl" option.
- LIB-48 10 §3: ship Paste first, URL second; do not promise PDF in the first release — hide it or label it experimental with a preview-and-correct step; user texts are presumed private; size cap open.

#### 4.8 Quran adaptation notes (Library)
- LIB-Q01 The Quran is not one "book" card among others: give it its own shelf entry point with surah list (114), juz/hizb/page navigation, Meccan/Medinan labels, and per-surah progress.
- LIB-Q02 Shelf groups for the ecosystem: القرآن الكريم · الحديث (collections: Bukhārī, Muslim, …) · الكتب (classical book reader) · نصوصي (user texts); filter labels in Arabic, data-driven from text kinds.
- LIB-Q03 Continue resumes at surah:ayah (or hadith number / book page) and shows the surah name, not "ch. · passage".
- LIB-Q04 "% known" should be based on unique lemmas (and optionally occurrence coverage) and must handle texts with no recognised words without claiming 100%.
- LIB-Q05 Quran text is immutable and comes from a verified source (Uthmani/Hafs); the "add tashkīl" and any auto-vocalisation path must never apply to Quran or hadith texts — only to user texts.
- LIB-Q06 Ingest normalisation must handle Uthmani orthography if users paste Quranic text: alef wasla ٱ (U+0671), small high letters and waqf marks (U+06D6–U+06ED), maddah/hamza marks (U+0653–U+0655) — `stripDia` covers none of these.
- LIB-Q07 RTL: progress bars fill from the right; cover/title order mirrors.
- LIB-Q08 Data needed: text catalogue (`GET /texts`) with kind, Arabic/English titles, structure (surahs/ayat, hadith books/numbers, book chapters/pages), per-user progress, per-text lemma ids for known %, ingest pipeline (paste → segmentation → tokens → analysis), private user-text storage.

---

### 5. Search (`Search.dc.html`, route `/search`, `?q=`) — 05 §5.2, 09

#### 5.1 Header and detection bar
- SRC-01 Header (no nav): logo + "Jadhr", search form (`flex:1; max-width:480px`, 32px, blue `#2f6ae0` border, `⌕` glyph, input `dir="auto"`, `aria-label="Search"`, Amiri/Plex 17px, no placeholder), spacer, meta "{total} results" (empty when no query).
- SRC-02 Typing updates results live on every keystroke (no debounce); submit (Enter) only rewrites the URL via `history.replaceState` to `Search.dc.html?q={q}`.
- SRC-03 Detection bar under the header: "Understood as" + pill with the detected label + grey note; pill purple (`#f1edfb`/`#6f55c4`) for patterns, blue (`#eef3fd`/`#2f6ae0`) otherwise.
- SRC-04 Detection — empty: pill "—", note "type a query".
- SRC-05 Detection — `^\d+:\d+$`: "verse reference {q}", note "jumps to the passage" **[BUG: it does not jump; it only lists the passage]**.
- SRC-06 Detection — Arabic, exactly 3 letters after removing spaces, no tashkīl: "root letters {q}", note "also matches words containing them".
- SRC-07 Detection — other Arabic: "Arabic · with tashkīl" or "Arabic · no tashkīl", note "diacritics ignored when matching".
- SRC-08 Detection — `x-y-z` Latin with ʿ/ʾ allowed: "transliterated root {q}", no note.
- SRC-09 Detection — pattern via chat/Buckwalter-style input: lowercase, 3→ʿ, 2→ʾ, uu→ū, ii→ī, aa→ā, then exact match against `FORM_META` transliterations (e.g. "maf3uul" → mafʿūl): "pattern {wazn} · {tr}", note "via chat/Buckwalter transliteration".
- SRC-10 Detection — Latin containing ā ī ū ʿ ʾ ḍ ṣ ṭ ẓ ḥ: "transliteration", no note.
- SRC-11 Detection — anything else: "English gloss or transliteration", no note.

#### 5.2 Facet sidebar (220px, `#f8f8fa`)
- SRC-12 "Kind" checkboxes (all on): "Words", "Roots", "Patterns", "Passages", each with its result count on the right; counts are shown even when the kind is unchecked.
- SRC-13 "Source" checkboxes (all on), one per built-in text by English name: "The Book of Knowledge and the Library", "The Qurʾān", "Ṣaḥīḥ al-Bukhārī", each with its passage-hit count; sources filter Passages only.
- SRC-14 "Root letters" builder: three single-character inputs (40px, Amiri 18px, `dir="rtl"`, `maxlength="1"`, placeholder "·", `aria-label="Root letter"`), hint "narrow to roots with these letters".
- SRC-15 Root-letter logic: each box keeps the last typed character; roots are kept when their bare form contains every entered letter (order- and position-insensitive); applies to Roots and Words.
- SRC-16 With letters but no query, only the Roots group shows (words require a query).

#### 5.3 Results
- SRC-17 Result groups, in order: Roots, Patterns, Words, Passages; each with a header line "{title}" + rule + optional right link.
- SRC-18 Roots group: shown when the kind is on and (query or letters); max 6 rows; row = brown dot, Arabic spaced root (Amiri 20px brown), English gloss, meta "{n} words"; row → `Concordance.dc.html?root={key}`; group link "concordance →" → Concordance (no param).
- SRC-19 Root matching: bare equals stripped query, or transliteration equals query, or English gloss contains query, or (stripped query ≥2 letters) bare contains it.
- SRC-20 Patterns group: from detection, or patterns whose stripped Arabic equals the stripped query or whose transliteration equals the query; row = purple dot, wazn (purple), function, meta "{n} words"; row → Reader v4 `?w={first word with that wazn}` **[DEAD]**; no group link.
- SRC-21 Words group: title "Words" or "Words on this pattern"; max 12; row = blue dot, Arabic (blue), "{tr} · {en}", meta = Arabic root in Amiri (P3 fix); row → Reader v4 `?w={id}` **[DEAD]**; group link "{n} total" when >12 (href `#`, inert).
- SRC-22 Word matching: stripped Arabic contains stripped query, or transliteration contains query, or English contains query, or (3-letter Arabic query) word's root bare equals it; pattern queries return all words on that wazn.
- SRC-23 Passages group: max 10; row = green dot, Arabic text truncated to 60 chars + "…" (no keyword highlight), English translation, meta "{ref or Ch. c·p} · {source English name}"; row → Reader v4 `?book={id}` **[DEAD]** (not the passage); group link "open as concordance →" → Concordance (no param).
- SRC-24 Passage matching: stripped passage text contains query, or `ref === q` exactly, or English translation contains query; pattern queries match passages containing a tagged word on that wazn; user texts are never searched.
- SRC-25 Row layout: one-line flex, Arabic min-width 80px right-aligned, English ellipsised, meta `dir="auto"` nowrap; hover border blue; group grids `repeat(auto-fill,minmax(260px,1fr))` (passages full-width list).
- SRC-26 Header count "{total} results" sums all four kinds before kind toggles **[BUG: hidden kinds still counted]**.

#### 5.4 States
- SRC-27 Initial (no `q`): detection "—"/"type a query", sidebar counts (Roots 6, others 0 — screenshot), no groups, no empty message.
- SRC-28 Empty results: "Nothing in the prototype data matches. Try k-t-b, maf3uul, 2:32 or library." with each example linked to `Search.dc.html?q=…`.
- SRC-29 Verified example behaviour (computed by running the page's matching logic on the seed): "" → Roots count 6, nothing listed; "k-t-b" → 1 root, 0 words, 0 passages (family rule needs Arabic letters); "كتب" → 1 root + all 8 k-t-b words + 3 prose passages; "2:32" and "2:255" → exactly that Quran passage; "kitab" (no macron) → 0 results (empty state); "kitāb" → 2 words (kitāb, kitāba); "maf3uul" → pattern مَفْعُول + 1 word (maktūb) + 1 passage; "library" → 1 word (maktaba) + 2 passages; root letter "ل" alone → roots ʿ-l-m and j-l-s.
- SRC-30 No loading or error states.

#### 5.5 URL, persistence, keyboard
- SRC-31 URL: reads `?q=` on load; writes `?q=` on submit only; kinds, sources, and letters are not in the URL.
- SRC-32 Persistence: none.
- SRC-33 Keyboard: Enter submits; root-letter boxes do not auto-advance and Backspace does not move back.

#### 5.6 Phone and dark mode
- SRC-34 Phone (inferred from CSS): fixed 220px sidebar plus results column leaves ~170px for results at 390px; no collapse to a filter sheet.
- SRC-35 Dark mode: none.

#### 5.7 Cross-check against 05 §5.2, 08 §8.3, 09
- SRC-36 [GAP] Spec: kind toggles "via chips"; prototype uses checkboxes (with counts — keep the counts).
- SRC-37 [GAP] Spec: root builder keyboard-navigable — typing advances to the next box, Backspace returns; prototype does neither; API `by-root-letters?l1&l2&l3` is positional with wildcards, prototype is order-insensitive.
- SRC-38 [GAP] Spec: passage results show the reference with the keyword emphasised; prototype shows truncated text with no emphasis (API returns `highlight` offsets).
- SRC-39 [GAP] Spec: the empty state routes to Ask mode (`?mode=ask`) — PLAN R1 also says so; prototype offers sample queries instead.
- SRC-40 [GAP] 09 §9.6 assertions not met by the prototype matcher: "kitab finds kitāb" fails (no Latin folding); "a root query returns the whole family" fails for transliterated roots; ة/ه, ى/ي, ؤ/و, ئ/ي folding absent from `stripDia`.
- SRC-41 [GAP] 09 §9.4: detection label must come back in the API `detected` field; classes Arabic word · transliteration · English gloss · root · pattern · empty; prototype adds verse reference and an ambiguous "English gloss or transliteration".
- SRC-42 [GAP] Search page lacks the shared nav (SHL-30).
- SRC-43 [EXTRA] Source facet with per-source counts.

#### 5.8 Quran adaptation notes (Search)
- SRC-Q01 Reference parser for Quran-first queries: `2:255`, `٢:٢٥٥` (Arabic-Indic digits), ranges `2:255-257`, surah names in Arabic/transliteration/English ("البقرة 255", "al-Baqara 255"), juz/page; an exact reference should navigate straight to the ayah (or pin it as the first result) — make the "jumps to the passage" note true.
- SRC-Q02 Normalisation must cover Uthmani script (ٱ, small high letters, waqf marks U+06D6–U+06ED, U+0653–U+0655) in addition to 09's `strip_tashkil` + `fold_hamza`; a user typing plain imla'i spelling must find Uthmani ayat.
- SRC-Q03 Result kinds for the ecosystem: Ayat (first in Quran-first ranking), Words, Roots, Patterns, Hadith, Book passages, Dictionary entries; Source facet becomes Quran / hadith collections / books / my texts, data-driven.
- SRC-Q04 Root builder in an RTL page: first radical in the rightmost box; auto-advance follows logical order; accept letters typed with or without spaces/hyphens in the main box too.
- SRC-Q05 "Understood as" labels in Arabic (e.g. "فُهِم على أنه"), with English as the second language; detection must recognise surah names.
- SRC-Q06 Translation search depends on licensed translation sources (choose and record licences); transliteration search needs Latin folding.
- SRC-Q07 Data needed: words/roots/patterns indices, per-token ayah index with surah/ayah/word position, surah name aliases, translations, hadith and book passage indices, root-letters endpoint, `detected` classifier.

---

### 6. Concordance (`Concordance.dc.html`, route `/concordance`, `?root=` | `?w=`, `?view=`) — 05 §5.3

#### 6.1 Header and filter bar
- CON-01 Shared header with "Concordance" active; page actions: segmented "KWIC" · "Distribution", button "Export CSV".
- CON-02 Filter bar (white, wraps): label "Root" + one pill per seed root (Amiri 17px spaced letters; selected = brown border and text); clicking sets the root and clears the form filter.
- CON-03 Divider, then label "Texts" + one chip per text that has at least one hit for the root, label "{English title} {hits}" (e.g. "The Book of Knowledge and the Library 12"); chips toggle the text on/off (all on by default); texts with zero hits are not listed.
- CON-04 Right meta (mono): "{hits} hits · {root.tr} · {forms} forms" (hits after text + form filters; forms counted over enabled texts) — screenshot "12 hits · k-t-b · 8 forms".
- CON-05 Root selection fallback on load: `?root` (if valid) → root of `?w` → `jadhr-context.root` → `ilm` (05 §5.3: arriving from the Reader must never show an empty page).

#### 6.2 KWIC view (default)
- CON-06 Sub-bar (`#f8f8fa`): "Sort" + chips "following context" (default) · "preceding" · "source"; divider; "Form" + chips "any {n}" then one chip per form "{form} {n}" sorted by count desc (Amiri 15px).
- CON-07 Column header row (mono uppercase): "Source" · "← following" (right-aligned) · "Keyword" (centred) · "preceding →" — grid `130px minmax(0,1fr) 140px minmax(0,1fr)`.
- CON-08 Row = full-width `<button>` with the same grid, Amiri 19px, hover `#f8f8fa`, `title` = English translation of the passage.
- CON-09 Row cells: source ref (mono 11px; `p.ref` such as "2:32"/"Bukhārī 71", or "Ch. {c}·{p}" for the prose book); following context (RTL, right-aligned, single line, ellipsis, wrapped in `<bdi>`); keyword (RTL, centred, blue `#2f6ae0`, bold, the inflected surface); preceding context (RTL, left-aligned, ellipsis, `<bdi>`); an empty side shows "—".
- CON-10 Layout rationale (hard-won, P3): the keyword column is narrow and fixed, following text is right-aligned and preceding text left-aligned so both hug the keyword; arrows in the labels make direction unambiguous in RTL.
- CON-11 [BUG] Preceding column truncation is on the wrong side: with `dir="rtl"` overflow clips the inline end (left), which is the end adjacent to the keyword — long preceding contexts lose the words nearest the keyword (not visible in the seed screenshot because contexts are short); needs start-side truncation.
- CON-12 Sort "following context": key = following text with diacritics stripped, compared with `localeCompare(…, 'ar')`.
- CON-13 Sort "preceding": key = preceding words reversed (nearest word first), stripped, Arabic collation — standard concordance left-sort (09 precomputes `left_sort` reversed).
- CON-14 Sort "source": key = stripped source label string (not numeric — "Ch. 1·10" would sort before "Ch. 1·2"; "2:255" before "2:31").
- CON-15 Form filter: chip value is the lemma (`WMAP[word].ar`, the dictionary form), not the inflected surface and not the wazn.
- CON-16 Row click → `Lexicon Reader v4.dc.html?book={id}&w={wordId}` **[DEAD]**; Reader v5 opens the word but has no parameter to select the specific token/passage.
- CON-17 Empty: "No attestations of this root in the selected texts."
- CON-18 Footer hint: "Click a line to open it in the reader with the hit selected."
- CON-19 No pagination or virtualisation (all hits render; ilm = 17 hits in seed, ~850 in a real Quran concordance).

#### 6.3 Distribution view
- CON-20 Grid `repeat(auto-fit,minmax(340px,1fr))`, two white panes separated by 1px lines.
- CON-21 Left pane label "By text · hits per 100 words": one row per text with hits: title (150px, ellipsis), green bar scaled to the max rate, mono value "{hits} · {rate}" with 1 decimal (computed for ilm: base 10 · 10.5, Qurʾān 5 · 13.2, Bukhārī 2 · 9.1).
- CON-22 [BUG] By-text ignores the Texts filter (always all texts with hits).
- CON-23 Left pane label "Collocates · within 2 words": up to 14 neighbour words (2 left + 2 right of each hit, enabled texts), keyed by stripped form without "،.:", words of ≤2 letters dropped; font size 14–26px by frequency; colour tiers t1/t2/t3; tooltip "{n} co-occurrences"; not clickable.
- CON-24 Right pane label "By inflected form" + hint "click a form → KWIC lines": rows (grid 110px/1fr/48px) with Arabic form (20px), blue bar scaled to max, mono count; selected form row tinted `#eef3fd`; click sets the form filter and switches to KWIC.
- CON-25 [BUG] "By inflected form" actually groups by lemma (same key as CON-15); label and data disagree.

#### 6.4 Export
- CON-26 "Export CSV": header `source,preceding,keyword,following`; every field double-quoted with `"` escaped as `""`; rows follow the current text filter, form filter, and sort; download name `concordance-{root.tr}.csv` (e.g. `concordance-k-t-b.csv`, `concordance-ʿ-l-m.csv`).
- CON-27 [BUG] No UTF-8 BOM, so Excel opens Arabic as mojibake; no columns for text id, chapter/verse numbers, lemma, wazn, or gram; non-ASCII filename for ʿ-l-m; no feedback toast.

#### 6.5 Data, URL, persistence, keyboard
- CON-28 Corpus = prose book + Qurʾān + Bukhārī + user texts from `jadhr-texts`; user texts are split on read into sentences at `.؟!،:؛` followed by whitespace or at newlines, refs "{short title} · {n}", and only exact lexicon hits count as tokens of the root.
- CON-29 Seed hit counts (computed, all texts): ktb 12 (8 forms), drs 7 (6), ilm 17 (8; base 10, Qurʾān 5, Bukhārī 2), qra 5 (3), jls 5 (3), qwm 7 (5; base 6, Qurʾān 1).
- CON-30 URL: reads `?root`, `?w`, `?view=dist`; root/view/sort/form/text changes are not written back (state only) — 01 §1.3 requires shareable URLs; API also defines `sort=left|right` and `pattern=`.
- CON-31 Persistence: reads `jadhr-context` (fallback) and `jadhr-texts`; writes nothing.
- CON-32 Keyboard: rows are buttons (Tab + Enter opens); no shortcuts.

#### 6.6 Phone and dark mode
- CON-33 Phone (inferred from CSS): the KWIC grid has fixed 130px + 140px columns, leaving ~30px per context column at 390px; needs a stacked phone row (ref line, then the KWIC line) or horizontal scroll; Distribution panes stack (340px min).
- CON-34 Dark mode: none (bar colours, hover, keyword blue are literals).

#### 6.7 Cross-check against 05 §5.3, 08, 09
- CON-35 Matches spec: two views as segmented control; context columns hug the keyword; ←/→ labels; left/right sort; rows link to the Reader; frequencies in Plex Mono.
- CON-36 [GAP] Spec "Pattern filter: restrict to occurrences of one *wazn*"; prototype filters by lemma (labelled "Form").
- CON-37 [GAP] Spec Distribution: per text ✓, **per chapter** ✗, **across historical corpora (pre-Islamic poetry · Qurʾān · Ṣaḥīḥ al-Bukhārī)** ✗; API `view=dist` returns per text, per chapter, per era.
- CON-38 [EXTRA] Source sort, Texts filter, collocates, by-form panel, CSV export.
- CON-39 09 §9.4: KWIC context must be split server-side from the token store (not highlighter fragments) with precomputed `left_sort`/`right_sort` keyword fields.

#### 6.8 Quran adaptation notes (Concordance)
- CON-Q01 Quran-first default ordering is mushaf order (surah:ayah:word), with following/preceding sorts as alternatives; source sort must be numeric by surah, ayah, word position.
- CON-Q02 In an Arabic RTL page the grid mirrors: DOM order must become Source · preceding · keyword · following (logical order) so preceding sits right of the keyword; labels become Arabic (e.g. "السياق السابق" / "الكلمة" / "السياق اللاحق") and arrows are re-derived, not copied.
- CON-Q03 Separate filters for lemma and wazn (and optionally POS/features); Texts filter becomes surah/juz range, Meccan/Medinan, and corpus (Quran / hadith collections / books).
- CON-Q04 Distribution for the Quran: hits per surah (114 bars or juz), normalised per 100 words, Meccan vs Medinan split, optional revelation order; historical-era view for the ecosystem corpora.
- CON-Q05 Collocates should exclude particles by POS tag (not by length ≤2) and link to a filtered KWIC.
- CON-Q06 Hadith: allow restricting to matn vs isnad and filtering by collection/grade.
- CON-Q07 Pagination/virtualisation and server totals (e.g. "854" for ʿ-l-m) are required at Quran scale.
- CON-Q08 CSV export: UTF-8 BOM, ASCII filename (root key), columns for surah, ayah, word position, surface, lemma, root, wazn, gram, preceding, following, translation.
- CON-Q09 Data needed: token table (surah, ayah, position, surface, lemma, root, pattern, morphology), precomputed sort keys, per-surah token counts, Meccan/Medinan and revelation-order metadata, hadith structure, translation per ayah for row tooltips.

---

### 7. Analyser (`Analyser.dc.html`, route `/analyse`, `?q=`) — 05 §5.4

#### 7.1 Header and input
- ANA-01 Shared header with "Analyser" active; page actions: segmented "Table" · "Interlinear", button "Copy CoNLL-U".
- ANA-02 Input textarea: `dir="rtl"`, 2 rows, vertical resize, Amiri 24px, line-height 1.8, right-aligned, placeholder "اكتب أو الصق عبارة…", `aria-label="Phrase to analyse"`, focus border `#2f6ae0`.
- ANA-03 Prefill: `?q=` value, else the sample "إِنَّ العِلْمَ لَا يُدْرَكُ إِلَّا بِالتَّعَلُّمِ".
- ANA-04 "Try" chips (Amiri 15px pills), label = first 3 words + "…": "إِنَّ العِلْمَ لَا…", "وَالمُكَاتَبَةُ بَيْنَ القَارِئِ…", "يَجْلِسُ المُدَرِّسُ فِي…"; click replaces the input.
- ANA-05 Right meta: "{n} tokens · {r} roots · {k} to review" (empty when no input) — default sample: "6 tokens · 2 roots · 2 to review" (screenshot and computed).
- ANA-06 Analysis re-runs on every keystroke; tokens = whitespace split.

#### 7.2 Table view (default)
- ANA-07 Column header (mono uppercase): "Token" · "Segments" · "Root · wazn" · "Analysis" · "Conf." (right-aligned); grid `130px 170px 130px minmax(0,1fr) 70px` — fixed widths so segments/root/wazn never bleed (P3 fix).
- ANA-08 Row background `#fff9f1` (amber tint) when confidence < 0.8, else white.
- ANA-09 Token cell: Amiri 21px inside `<bdi>`, cell `direction:ltr`.
- ANA-10 Segments cell: chips (Amiri 17px) — prefix/suffix purple text on `#f1edfb`, stem dark on `#f5f5f8`; each chip's `title` = grammatical label ("conj.", "def. art.", "impf. 3 m. · passive", "stem", …); harakat-only segments dropped (a segment must contain U+0621–U+064A); array reversed inside an LTR container so the visual order reads correctly right-to-left.
- ANA-11 Screenshot 09 shows the opposite chip order (prefix chip on the left) — the screenshot predates or disagrees with the code; treat the code's logic (prefix visually rightmost) as intended.
- ANA-12 Particles (function-word list) show a single grey chip with tooltip "particle — not segmented".
- ANA-13 Root · wazn cell: top candidate root in Arabic (brown, Amiri 16px) + wazn (purple, 15px); particles show "—"; non-particles without candidates show "—" root and the fallback wazn.
- ANA-14 Analysis cell: particles "particle / function word"; lexicon hit "{pos} · {gram or 'dictionary form'} · {English gloss}" + link "entry" (→ Reader v4 `?w={id}` **[DEAD]**); candidate only "{gram or 'stem'} · {N analyses | one analysis}" + amber link "choose" when confidence < 0.8; nothing found "no root in the lexicon".
- ANA-15 [GAP] "choose" is an affordance only — `href="#"`, no picker, no way to see or select the other candidates; only the top candidate is ever displayed.
- ANA-16 Conf. cell: two decimals, mono 11px, green ≥0.8, amber below; particles fixed at 1.00, lexicon hits 0.99, otherwise top candidate score.
- ANA-17 Function-word list (matched on the stripped, punctuation-free form): و ف في من الى على لا ما ان الا ثم هو هي كان انما كل هنا حين بين لم قد عن ذي لنا به فيه انك انت (note: includes the verb كان and pronoun-attached forms).
- ANA-18 "to review" = non-particle tokens with no lexicon hit and a top candidate below 0.8; tokens with no candidate at all are tinted but not counted.
- ANA-19 "roots" = distinct top-candidate roots of non-particle tokens.
- ANA-20 Empty input: "Type a phrase above."
- ANA-21 Table footer: legend "■" (purple) "affix", foot "{n} tokens · {r} roots · {k} to review · rule-based prototype analyser", spacer, link "Build graph from this →".
- ANA-22 "Build graph from this →" → `Lexicon Editor v5.dc.html?from=analyser&seed={base64(JSON{ words:[lexicon hits], sentence:{ ar:input, tr:'', en:'Analysed phrase', src:'Analyser' } })}` (UTF-8-safe base64, try/catch).
- ANA-23 Default sample, per token (computed): إِنَّ particle 1.00; العِلْمَ → ʿilm, ع ل م, فِعْل, "noun · def. art. · acc. · knowledge, science" 0.99; لَا particle; يُدْرَكُ → candidate د ر س 0.30, wazn يَفْعَلُ, "impf. 3 m. · passive · nom. · one analysis" + "choose"; إِلَّا particle; بِالتَّعَلُّمِ → candidate ع ل م 0.65, wazn فَعَلَ fallback.
- ANA-24 [BUG] The heuristic is visibly wrong on its own sample: يُدْرَكُ is root د ر ك, not د ر س; التعلّم is تَفَعُّل, not فَعَلَ; the verb's final ُ is labelled "nom." — acceptable only because confidence is low and shown (keep the honesty contract, replace the engine).

#### 7.3 Interlinear view
- ANA-25 RTL flex-wrap of token cards (min-width 80px, radius 10): Arabic 26px; transliteration (mono 11px, lexicon hits only); gloss (11.5px, max 140px) = "(particle)" / English gloss / "? {root English}" / "?"; root in Arabic (brown 14px).
- ANA-26 Footer line = the same foot text as the table.
- ANA-27 [GAP] Interlinear shows no confidence and no low-confidence tint — 05 §5.4 "Confidence is always shown".

#### 7.4 Export
- ANA-28 "Copy CoNLL-U": first line `# text = {input}`; then one line per token with 10 tab-separated columns: ID, FORM (surface), LEMMA (lexicon Arabic or `_`), UPOS (`PART` for particles, `VERB`/`NOUN` for hits by pos, else `X`), XPOS `_`, FEATS `Root={translit or _}|Pattern={wazn}`, HEAD/DEPREL/DEPS/MISC `_`; written with `navigator.clipboard.writeText`, failures swallowed.
- ANA-29 [BUG] No copy confirmation toast and no failure message.
- ANA-30 [BUG] Particles export a bogus `Pattern=فَعَلَ` (fallback wazn), contradicting "particles show —"; `Root`/`Pattern` are not Universal Dependencies FEATS (belong in MISC); no `sent_id`, no terminating blank line; participles exported as NOUN.

#### 7.5 URL, persistence, keyboard, states
- ANA-31 URL: reads `?q=` on load (Library's "Analyse" links use it); input changes and view are not written back.
- ANA-32 Persistence: none.
- ANA-33 Keyboard: no shortcuts; Try chips are buttons.
- ANA-34 States: default sample on first visit, empty message, low-confidence rows; no loading/error states.

#### 7.6 Phone and dark mode
- ANA-35 Phone (inferred from CSS): fixed columns total ~576px with padding, so the table overflows at 390px with no scroll container; interlinear wraps and works.
- ANA-36 Dark mode: none (row tint, chip fills are literals).

#### 7.7 Cross-check against 05 §5.4, 08 §8.3, 09 §9.5
- ANA-37 Matches spec: prefilled input; view toggle; fixed widths; affix chips; harakat-only segments dropped; particles show "—"; confidence shown in the table.
- ANA-38 [GAP] Spec table columns: surface · segments **with grammatical label** (prototype: tooltip only) · **candidate roots with confidence** (prototype: top candidate only) · pattern · grammatical summary.
- ANA-39 [GAP] Spec: "Candidate roots are clickable → Concordance or the Reader panel"; prototype root text is not a link.
- ANA-40 08 contract: candidates ranked, deduped by root, max 3; harakat-only segments omitted; particles return `candidates: []` and `pattern_key: null`; `confidence` always present — prototype decides particles in the UI layer, production must decide them in the service.
- ANA-41 09 §9.5: do not build on the search stemmer; lexicon-driven analyser first, morphology service (CAMeL Tools/Farasa) later; cache by surface + dataset version.

#### 7.8 Quran adaptation notes (Analyser)
- ANA-Q01 Two sources of truth: Quran (and tagged hadith) tokens use gold, hand-verified morphology at confidence 1.0 with the source named; free text uses the analyser with ranked candidates and confidence.
- ANA-Q02 Accept Uthmani input (normalise ٱ, small high letters, waqf marks) and imla'i input alike.
- ANA-Q03 In an RTL table: Token column at the right; remove the reverse-in-LTR trick and render segments in logical order inside `dir="rtl"`; labels in Arabic grammar terms (e.g. حرف عطف، أداة تعريف، ضمير متصل، فعل مضارع مبني للمجهول) with English as secondary.
- ANA-Q04 Build the "choose" flow: show all candidates with confidence, let the user pick, and remember the choice for that surface (and feed review/proposals).
- ANA-Q05 Try chips become ayat and hadith phrases; an ayah reference typed into the input (e.g. `2:255`) could load that ayah pre-analysed.
- ANA-Q06 CoNLL-U aligned with UD Arabic conventions (Root/Pattern in MISC), plus an option to export the gold Quran morphology for a range.
- ANA-Q07 Data needed: morphology service/endpoint (`POST /analyse`), gold token annotations for Quran, lemma/root/wazn ids, Arabic and English labels for affixes and features, function-word lexicon, editor seed endpoint.

---

### 8. Hard-won fixes found in code, comments, and PLAN change log

- SHL-F01 Nav strip scrolls horizontally with hidden scrollbar and page actions stay pinned right — `overflow-x:auto; scrollbar-width:none; min-width:0; flex:0 1 auto` + `flex:1` spacer (PLAN P6: "shared header no longer pushes page actions off-screen").
- SHL-F02 `aria-current="page"` on the active nav item (PLAN P5).
- SHL-F03 One shared theme key `jadhr-theme`, default light, shared by Reader and Editor including when embedded (PLAN P5) — not yet wired on these six screens.
- SHL-F04 "No dead links across pages" (PLAN P5) — regressed in this bundle by Reader v4 targets (SHL-33).
- SHL-F05 `load()`/`save()` wrap localStorage in try/catch with defaults so private mode or quota errors never crash a page.
- SHL-F06 Matching normalises (strip tashkīl, fold أ إ آ → ا) but display always keeps the vocalised form (02 §2.3).
- SHL-F07 English is never placed inside an RTL Arabic run: glosses and Arabic sit in separate elements (Collections WOTD/items, Search rows, Library preview tooltips) (02 §2.3 bidi fix).
- SHL-F08 Arabic inputs carry `dir="rtl"`; mixed-language inputs and labels use `dir="auto"` (Hub search, Search field, context chips, Search row meta).
- SHL-F09 Editor seeds use UTF-8-safe base64 (`btoa(unescape(encodeURIComponent(JSON)))`) inside try/catch with a plain-link fallback (Collections, Analyser).
- HUB-F01 `⌘K`/`Ctrl+K` calls `preventDefault()` before focusing so the browser's own shortcut does not fire.
- HUB-F02 Sign-in is never a wall: opened only on request, dismissible three ways, offers "Export my data instead", and states what works without an account (06 §6.1, 4g).
- HUB-F03 Context strip hides itself when empty and has an explicit "Clear".
- COL-F01 Word of the day is deterministic by date (same for everyone, cacheable, shareable) (PLAN R5).
- COL-F02 Progress shows no streaks, with explicit copy "No streaks, no guilt — the words wait." (PLAN R5; 06 §6.2 "Do not add one").
- LIB-F01 Save is disabled until there is real text (>10 chars) and a title; after saving, the filter switches to "Mine" so the new text is visible.
- LIB-F02 Live preview is capped at 80 tokens to keep typing responsive.
- LIB-F03 Stubbed URL/PDF modes say plainly that they are not wired rather than failing silently.
- SRC-F01 "Understood as" detection is shown to the user (honest feedback) — 05 §5.2 "keep it".
- SRC-F02 Search word rows show the Arabic root in Amiri in the meta column (PLAN P3).
- SRC-F03 Chat-style numerals in transliteration are accepted (3→ʿ, 2→ʾ, doubled vowels → long) for pattern lookup.
- CON-F01 Context columns hug the keyword with explicit "← following" / "preceding →" labels (PLAN P3; 05 §5.3 "essential for Arabic").
- CON-F02 Contexts are wrapped in `<bdi>` so neutral punctuation at the edges does not reorder.
- CON-F03 Preceding-context sort reverses word order (nearest word first); sorting strips diacritics and uses Arabic collation (`localeCompare(…,'ar')`).
- CON-F04 Root fallback chain `root → w → context → ilm` so arriving from the Reader never shows an empty page.
- CON-F05 CSV fields are quoted with `"` doubled.
- CON-F06 User-text sentence splitting uses a look-behind on Arabic punctuation `[.؟!،:؛]` so punctuation stays attached to its sentence.
- ANA-F01 Fixed column widths stop segments/root/wazn bleeding into each other (PLAN P3).
- ANA-F02 Affixes render as chips distinct from the stem; harakat-only segments are dropped; particles show "—" (PLAN P3).
- ANA-F03 Confidence is always shown and low-confidence rows are tinted; uncertain analyses say "one analysis"/"N analyses" rather than asserting.
- ANA-F04 `<bdi>` + `direction:ltr` + reversed segment order keeps chip order stable regardless of the page direction.
- ANA-F05 `analyse()` strips punctuation first, only strips an affix when at least two letters remain, prefers a non-verb lexicon hit when the article is present, dedupes candidates by root and keeps at most 3.

---

### 9. Cross-screen summary of the biggest parity gaps

- SHL-S01 Study swipe deck (Collections) is specified and marked done in PLAN but not present in any bundle file — must be designed and built from the spec text alone.
- SHL-S02 Every Reader deep link in these screens targets the missing Reader v4 file; production must map them to the Reader routes (`/read?w=`, `?book=`, plus a new passage/token selector for Concordance and Search hits).
- SHL-S03 No dark mode, no theme toggle, no `lang` attributes, no Esc handling, and no phone breakpoints on these six screens; the tokens and rules exist in 02 and must be applied.
- SHL-S04 URL state is mostly read-only (Search kinds/sources/letters, Concordance root/view/sort/form/texts, Analyser input/view are not written back) — 01 §1.3 requires shareable URLs.
- SHL-S05 Search matching in the prototype fails 2 of 09's 5 Arabic assertions (kitab→kitāb; root query → family) and lacks ة/ى/ؤ/ئ folding.
- SHL-S06 Concordance's "Form" filter and "By inflected form" both group by lemma; the spec asks for a wazn filter.

---

## Part 4 — Community: Review queue, Notebook, Classroom, Profile, Data & API

_Original heading: Community screens — feature and parity inventory_

Scope: Review Queue, Notebook, Classroom, Profile, Data & API prototypes in `Claude Design Handoff/prototypes/`, plus the parts of `lexicon-data.js` and `jadhr-chrome.js` they use.

Sources read in full: the five `.dc.html` files, `jadhr-chrome.js`, `lexicon-data.js`, `06-screens-community.md`, `07-data-model.md` (all; §7.3 is the relevant part), `08-api-contract.md` (all; §8.4/§8.5/§8.7/§8.8 relevant), `10-open-questions.md` (all; §4–§7 relevant), `prototypes/PLAN.md`, `screenshots/README.md`, and screenshots 10, 11, 12, 14 and 15. I also grepped the parts of `01-product-and-ia.md` (routes), `02-design-tokens.md` (§2.2 dark, §2.6 breakpoints), `11-implementation-plan.md` (phases) and README that cover these screens. I grepped the places in Reader v5, Hub, Library and Editor v5 that write data, to get the shapes these screens read.

Checked by running node on `lexicon-data.js`: ROOTS 6, WORDS 35, senses 75, DICTS 9, FORM_META 21 (doc 07 §7.4 says 22), ALL_PASSAGES 10. The top looked-up roots in Classroom come out as ktb 67, qra 12, jls 10, qwm 7, which matches screenshot 12. I also ran the Notebook @-mention regex and resolver against the placeholder's own examples; results are in NTB-27.

Tag legend: **[P]** what the prototype does · **[D]** required by the docs but not in the prototype · **[≠]** docs and prototype disagree · **[BUG]** prototype defect, do not port · **[FAKE]** simulated or sample value, must not ship as real · **[SRV]** needs accounts or a server · **[LOCAL]** can be local-first.

Note: the brief listed RVQ, NTB, CLS, PRF and DAT prefixes. I added one extra prefix, SHR, for shared chrome and storage, because it applies to all five screens.

---

### 0. Shared chrome and storage (SHR)

- SHR-01 [P] Header is 52px tall, background #f8f8fa, 1px bottom border #e5e5ea. The logo is an 18px rounded square in #a8682c plus "Jadhr" at 14px/600, and it links to the Hub (`Jadhr.dc.html`).
- SHR-02 [P] The nav strip is a pill container (#ecedf1, radius 9). It scrolls horizontally with the scrollbar hidden (`overflow-x:auto; scrollbar-width:none; flex:0 1 auto; min-width:0`), so each page's right-hand actions stay pinned.
- SHR-03 [P] NAV has 11 items in this order: Read → Reader v5 · Explore → Collections · Library · Look up → Reader v5 `?mode=lookup` · Concordance · Analyser · Graph → Editor v5 · Notebook · Review queue · Classroom · Data & API.
- SHR-04 [P] Profile is not in NAV. The Profile page passes an empty current value, so no nav item is active there.
- SHR-05 [P] `navModel(current)` sets `aria-current="page"` and the active style (white background, weight 500, 0 1px 2px shadow). Inactive items are #4f4f5a.
- SHR-06 [P] Shared style helpers: `seg(on)` is the segmented control used for filters, tabs and layers; `chip(on)` is the pill used by Notebook groupings (active: #eef3fd background, #2f6ae0 border); `dot(c)` is an 8px dot.
- SHR-07 [P] Colour constants: root #a8682c · form #6f55c4 · word #2f6ae0 · sentence #177a44 · desc #6f6f7c · amber #b45309 · good #15803d · bad #c02626 · t1 #16161a · t2 #4f4f5a · t3 #71717c · line #e5e5ea · line2 #d3d3dc · card2 #f5f5f8 · panel #f8f8fa.
- SHR-08 [P] Fonts are Amiri (Arabic), IBM Plex Sans (UI) and IBM Plex Mono (meta and section labels). Section labels are Mono 10.5px, uppercase, letter-spacing .09em, #71717c.
- SHR-09 [P] Focus ring: `:focus-visible` gets a 2px solid #2f6ae0 outline at 2px offset on button, a, input and textarea.
- SHR-10 [P] Storage helpers `load(k, d)` and `save(k, v)` wrap localStorage JSON in try/catch, so they fail safe in private mode or when the quota is full.
- SHR-11 [P] KEYS: prefs `jadhr-prefs` · states `jadhr-word-states` · marks `jadhr-marks` · notes `jadhr-notes` · progress `jadhr-progress` · texts `jadhr-texts` · sessions `jadhr-sessions` · context `jadhr-context` · account `jadhr-account` · proposals `jadhr-proposals` · graphs `jadhr-published` · onboarded `jadhr-onboarded`.
- SHR-12 [BUG] Other prototypes use storage keys that are not in KEYS: `jadhr-trail` (Reader trail), `jadhr-comments` (Editor comments), `jadhr-theme` (shared theme), `lexicon-reader-v5` (Reader prefs, including starred marks) and `lexicon-editor-v5-ui` (Editor UI). Profile's export and delete only see KEYS (PRF-09).
- SHR-13 [BUG] Nothing writes `jadhr-marks`. The Reader keeps marks inside `lexicon-reader-v5`. Anything that reads KEYS.marks always gets an empty value: Notebook's starred count and due count, and the Hub's sign-in title.
- SHR-14 [P] Every page lazy-imports `lexicon-data.js` and `jadhr-chrome.js` in componentDidMount and renders an empty skeleton until both have loaded.
- SHR-15 [≠] None of the five pages, `jadhr-chrome.js` or `lexicon-data.js` has an `@media` rule or any dark-theme code (grep count 0 in each). Colours are hard-coded hex values, not tokens, and the pages never read `jadhr-theme`. README and 02 §2.2 require dark parity on every screen, and PLAN P5 says "dark parity" was done.
- SHR-16 [≠] Every one of these pages has a fixed-width side column: Review 320px, Notebook 280px, Classroom 300px, Profile 280px, Data 300px, API 220px. None has a breakpoint. 02 §2.6 says below 900px is phone mode (targets ≥40px, ≥44px in overlays, 390px is the audited floor), and none of that is implemented here.
- SHR-17 [≠] Header meta and right-hand controls use `white-space:nowrap`. 02 §2.6 says "no nowrap on text containers".
- SHR-18 [P] Hub card descriptions: Review queue "Proposals awaiting approval" · Notebook "Notes and reading journal" · Classroom "Assignments and the shared graph" · Profile "Contributions, data export" · Data & API "Releases, licences, playground".
- SHR-19 [P] The Hub's prototype sign-in writes `jadhr-account` = `{ name: 'Amal Haddad', affiliation: 'Lexicography · Univ. of Jordan', orcid: '0000-0002-1825-0097', since: '2025' }`. Modal footer: "Export my data instead" (→ Profile) · "No tracking, no ads — grant-funded, open licence".
- SHR-20 [BUG] Identity is plain display-name strings: the local proposer is 'you', the reviewer is hard-coded 'R. Saleh', the signed-in name is 'Amal Haddad' and the seeds use 'A. Haddad'. There are no stable user IDs, so the Mine, Profile, credit-line and changelog matching all drift apart.

---

### 1. Review Queue (RVQ)

#### 1.1 Route, entry, params

- RVQ-01 [P] File `Review Queue.dc.html`, route `/review` (06 §6.3, 01 routes table).
- RVQ-02 [≠] The docs define `?filter=Open|Approved|Merged|Declined`. The prototype reads no URL params; the filter lives in state and defaults to 'Open'.
- RVQ-03 [P] This is the editorial proposal queue, not the study review deck; 01 flags the overloaded name. Inbound links come from the Hub card, the NAV, Data & API ("add yours"), Notebook (after Propose), the Reader suggest modal and Profile rows.

#### 1.2 Header

- RVQ-04 [P] Meta text (Mono 12px, #71717c): "{open} open · {yours} yours", where "yours" counts proposals with `by === 'you'`.
- RVQ-05 [P] Filter segmented control: Open · Mine · Merged · Declined. A count is appended only when it is non-zero, e.g. "Open 3", "Mine", "Merged 1", "Declined" (screenshot 10).
- RVQ-06 [≠] The docs (06, 01) say Open · Approved · Merged · Declined. The prototype has Mine where the docs have Approved. 07 and 08 include an `approved` status that the prototype never uses.

#### 1.3 Filter semantics

- RVQ-07 [P] Open = `status === 'pending'`.
- RVQ-08 [P] Mine = `by === 'you'`, any status. It does not match the signed-in account's name.
- RVQ-09 [P] Merged = `status === 'merged'`.
- RVQ-10 [P] Declined = every status that is not pending and not merged. That includes 'changes', so "Changes requested" items show up under Declined.
- RVQ-11 [P] Each filter is sorted newest first (ts descending).
- RVQ-12 [P] Switching filter selects the newest item in that filter (or none if it is empty) and clears the note draft.
- RVQ-13 [P] On load, the selection is the first pending proposal, else the first proposal in the list, else nothing.

#### 1.4 List column (320px, #f8f8fa)

- RVQ-14 [P] Row line 1: Arabic word (Amiri 19px, rtl; '—' if missing) · kind label (12px) · spacer · age ('today' if under 1 day, else "N d").
- RVQ-15 [P] Row line 2: "{by} · {n} of 2 approvals", then " · cites {N}" if there are sources, or " · no source attached" if there are no sources and no rationale.
- RVQ-16 [P] Line 2 turns amber (#b45309) only when there are no sources and no rationale; otherwise it is #71717c.
- RVQ-17 [P] The selected row has a white background and a 3px left border in #a8682c. Other rows are transparent with a bottom divider.
- RVQ-18 [P] Clicking a row selects it and clears the note draft.
- RVQ-19 [P] Empty-state copy for Open: "Nothing waiting. Proposals arrive from “Suggest an edit” on any sense in the Reader, from unknown words, and from notes."
- RVQ-20 [P] Empty-state copy for Mine: "You have not proposed anything yet — try “Suggest an edit” on a sense in the Reader."
- RVQ-21 [P] Empty-state copy for Merged: "Nothing merged yet."
- RVQ-22 [P] Empty-state copy for Declined: "Nothing declined."

#### 1.5 Detail pane

- RVQ-23 [P] Title (16px/600): "{kind label}" + " NN" (two-digit sense number, only when senseIdx is set) + " · " + Arabic word. Examples: "edit sense 01 · عَالَم", "attestation · قَيُّوم".
- RVQ-24 [P] By-line: "{by} · proposed {toLocaleDateString}". When `by === 'you'` it adds " · you cannot approve your own proposal".
- RVQ-25 [P] Approval tracker, top right: two slots. A filled slot is a 20px green (#15803d) circle with ✓ and the reviewer's name in green. An empty slot is a dashed #d3d3dc circle labelled 'you' if it is the next slot to fill, otherwise 'pending'.
- RVQ-26 [P] Diff box (radius 10): the "before" line (background #fbe9e9, red Mono "−") appears only when there is current text and the kind is not attest. The "after" line (background #e7f4ec, green Mono "+") always appears.
- RVQ-27 [P] Section "Rationale & sources": the rationale, or "No rationale given.", followed by a source note.
- RVQ-28 [P] Source note when sources exist (green): "· cited: {dictionary English names, falling back to the raw id} — reference present (auto-checked)".
- RVQ-29 [P] Source note when there are none (amber): "· no source attached — request one before approving".
- RVQ-30 [P] Section "Your note to the contributor": a 2-row textarea (vertical resize) with placeholder "Optional — shown with the decision"; focus border #2f6ae0.
- RVQ-31 [P] Action row, shown only while pending: "Decline" (red text, outline) · "Request changes" (outline) · spacer · primary Approve button (#16161a).
- RVQ-32 [P] Approve button label: "Approve (1 of 2)" with 0 approvals; "Approve & merge" with 1 approval from someone else; "You approved · waiting for one more" once the current reviewer has approved.
- RVQ-33 [P] Settled banner (replaces the action row). Merged, on #e7f4ec in green: "Merged · credited to {by} · appears in the next changelog".
- RVQ-34 [P] Settled banner, declined (on #f5f5f8): "Declined" + " · “{note}”" if there is a note.
- RVQ-35 [P] Settled banner, changes requested: "Changes requested" + " · “{note}”" if there is a note.
- RVQ-36 [P] Footer copy: "Two approvals merge a proposal; every merge is credited on the entry and in the next dataset changelog. You are reviewing as R. Saleh (prototype role)."
- RVQ-37 [P] With nothing selected, the pane shows "Select a proposal."

#### 1.6 Rules: the moderation logic

- RVQ-38 [P] Two distinct approvals merge a proposal. Approving appends the reviewer to `approvals[]`, and status becomes 'merged' when the length reaches 2.
- RVQ-39 [P] No double-approve: if the reviewer is already in `approvals`, the proposal is returned unchanged. [BUG] The button stays enabled and clicking it still clears the note draft.
- RVQ-40 [BUG] No self-approve exists only as copy (RVQ-24). `decide()` never checks the proposer. The prototype's reviewer is 'R. Saleh' and its proposer is 'you', so R. Saleh can approve your proposals. Production must enforce this on the server (08 §8.5: 403 forbidden) and in the database (07: check `reviewer_id <> proposer_id`).
- RVQ-41 [P] Decline: one reviewer declines immediately (status 'declined', note stored). There is no quorum for declines.
- RVQ-42 [P] Request changes: one reviewer sets status 'changes' and stores the note. The item leaves the open queue, and there is no revise-and-resubmit path back into it.
- RVQ-43 [P] The note is stored on the proposal as a single `note` field. Every decision overwrites it, including approve. There is no per-decision history.
- RVQ-44 [P] Selection moves on after a decision. In the Open filter, if the item stopped being pending, the selection jumps to the next pending item.
- RVQ-45 [P] If no pending items remain after a decision, the filter switches itself to Merged (if the item just merged) or Declined (otherwise) and keeps the decided item selected. The detail pane is never left empty.
- RVQ-46 [P] If an approval leaves the item pending (1 of 2), the selection stays on it.
- RVQ-47 [P] Each decision is written to `jadhr-proposals` immediately.
- RVQ-48 [P] Every detail field 06 lists is present: word, the specific sense, current text, proposed text, rationale, sources, proposer, timestamp and approvals so far.

#### 1.7 Proposal kinds, producers, consumers

- RVQ-49 [P] Kind labels: edit → "edit sense" · sense → "new sense" · attest → "attestation" · error → "error report" · entry → "new entry" · note → "from a note". Any other kind shows its raw id.
- RVQ-50 [P] Producer of edit: the "Suggest an edit" button on a Reader sense row opens a modal titled "Suggest an edit · sense NN" with the fields "Current", "Your wording" and "Why · source *". The Why placeholder is "e.g. Lisān s.v. ع ل م gives … as the primary gloss".
- RVQ-51 [P] The suggest modal offers source chips for the first 6 DICTS only (Kitab al-Ayn, Tahdhib al-Lugha, al-Sihah, Maqayis al-Lugha, Mufradat al-Quran, Lisan al-Arab). Lane, Taj and Qamus cannot be cited, and neither can grammars or corpora.
- RVQ-52 [P] Suggest modal buttons: "Cancel" and "Submit for review". Submit stays disabled until the wording is non-empty and there is either a rationale or at least one source.
- RVQ-53 [P] Suggest modal footer: "Only you see this until two reviewers approve. Track it in the review queue." After submitting, a toast says "Submitted for review". [≠] The proposal is in fact visible to reviewers.
- RVQ-54 [P] Producer of sense: the Reader's "Propose a new sense" opens the same form with current '(new sense)' and senseIdx null.
- RVQ-55 [P] Producer of error: the Reader's "Report an error" opens the same form with current "{ar} — {en}".
- RVQ-56 [P] Producer of entry: the Reader's unknown-word analyser submits directly, with no form. Text is "New entry for {surface} under {root}", why is "Encountered in {book}; analysed as {gram}", sources is []. This bypasses the source rule in RVQ-52.
- RVQ-57 [P] Producer of note: Notebook's "→ Propose" (NTB-22). It also bypasses the source rule.
- RVQ-58 [P] Producer of attest: nothing in the UI creates one. It exists only as seed2b.
- RVQ-59 [P] Consumer in the Reader: a merged edit replaces the sense text, with meta "edited by {by} · reviewed · sources: …". A pending edit shows "your edit pending review · {date}" with a dashed amber border.
- RVQ-60 [P] Consumer in the Reader: new senses (pending or merged) are appended as extra numbered senses, with meta "added by {by} · reviewed" or "proposed by {by} · pending review".
- RVQ-61 [P] Other consumers: the Data & API changelog (DAT-17) and Profile's Contributions tab (PRF-15). The chain is propose → review → merge → credit line in the Reader → changelog → profile, and 06 says every link in it must survive.

#### 1.8 Data shape, seed, persistence

- RVQ-62 [P] Proposal shape: `{ id ('p'+ms or seed id), kind, wordId|null, wordAr, senseIdx|null, current, text, why, sources:[dict ids], status:'pending'|'merged'|'declined'|'changes', by, approvals:[names], note?, ts }`.
- RVQ-63 [P] seed1b, edit on عَالَم sense 1, by A. Haddad, approvals [H. Mansour], 2 days old, cites lisan. Current "the world; all created things" → proposed "the world; everything other than God — all created things".
- RVQ-64 [P] seed1b rationale, verbatim: "Lisān gives كلُّ ما سوى الخالق as the primary gloss; the theological framing is the classical one."
- RVQ-65 [P] seed2b, attest on قَيُّوم, by M. Farouk, 4 days old, sources [quran]. Text: "Attestation · Q 2:255 — اللهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ". Why: "Auto-verified verse text (Tanzil)."
- RVQ-66 [P] seed3b, error on مَكْتَب, by L. Khoury, 5 days old. Current "pattern shown as مَفْعِل" → "pattern should be مَفْعَل". Why: "Standard grammars (Wright §223) give mafʿal for nouns of place from Form I verbs with fatḥa." Sources [] (the grammar is cited only in free text).
- RVQ-67 [P] seed4b, sense on عَالَم, by A. Haddad, 2 days old: "the human microcosm (Sufi usage: العالم الصغير)". No rationale and no sources, which makes it the example of the amber warning.
- RVQ-68 [P] Seed migration: if 'seed1b' is missing, the page prepends SEED, drops legacy ids matching `/^seed\d$/`, keeps the user's own proposals, and persists the result.
- RVQ-69 [P] Screenshot 10 shows "3 open · 0 yours", Open 3, Merged 1 (seed1b merged after R. Saleh's approval), with قَيُّوم selected showing ✓ R. Saleh.

#### 1.9 Parity gaps and defects

- RVQ-70 [≠] Status values differ: 07 has 'open'|'approved'|'merged'|'declined'; the prototype has 'pending'|'merged'|'declined'|'changes'. 08 `POST /proposals/:id/decisions` accepts only approve|decline, so there is no request-changes decision.
- RVQ-71 [≠] 07 makes `proposals.sense_id` and `rationale` NOT NULL. The sense, error, entry, note and attest kinds have no sense id, and seed4b has no rationale. The schema needs a `kind` column, a nullable sense id, and a target that can be a word, root, passage or new entry.
- RVQ-72 [≠] 07 stores `sources` as free text; the prototype stores an array of dictionary ids. There is no structured way to cite a grammar or corpus (seed3b) or a Qur'anic reference (seed2b).
- RVQ-73 [≠] 07's `unique (proposal_id, reviewer_id)` prevents double-approve, but it also blocks a reviewer from changing their decision (approve then decline). That behaviour needs defining.
- RVQ-74 [D] 10 §6 leaves these open: who becomes a reviewer (appointed, earned, or an editorial board), a revert path with sense revision history, abuse handling (reporting, per-user rate limits, blocking), competing senses with attribution, and whether there is a canonical layer separate from a community layer. None of it is designed.
- RVQ-75 [D] 10 §4.4: proposing requires an account, and the sign-in prompt must come after the proposal is written, never before. The prototype has no gate.
- RVQ-76 [BUG] README §4 step 6 says "approve twice", but in the prototype your own proposal can never merge: there is one reviewer identity and double-approve is blocked. Only seed1b, already approved by H. Mansour, can reach merged.
- RVQ-77 [BUG] After R. Saleh fills the first slot, the second slot is still labelled 'you' (visible in screenshot 10), even though R. Saleh is "you".
- RVQ-78 [BUG] The source id 'quran' is not in DICTS, so the raw id is shown: "cited: quran" (screenshot 10).
- RVQ-79 [FAKE] "reference present (auto-checked)" and "Auto-verified verse text (Tanzil)" describe checks that do not exist.
- RVQ-80 [BUG] The page does not re-read storage on focus, unlike the Reader and Data & API. A proposal submitted in another tab appears only after a reload.
- RVQ-81 [P] Phone: the 320px list plus the detail pane cannot work under ~700px; it needs list-then-detail stacked navigation (02 §2.6). Dark mode: none (SHR-15).

#### 1.10 Quran adaptation notes (Review Queue)

- RVQ-Q01 [SRV] Moderation has to be enforced on the server: two distinct approvals, 403 for self-approve, 409 for double-approve, and merge in one transaction with the sense rewrite, credit and changelog entry (08 §8.5). It needs accounts, a reviewer role and an audit log, and it cannot be local-first.
- RVQ-Q02 [LOCAL] Drafting a proposal can happen offline and without an account. The draft is kept locally and submitted after sign-in, so the user's work is never lost to a sign-in wall (10 §4.4).
- RVQ-Q03 Proposals must never edit the Qur'anic text itself, which is kept verbatim from its source (Tanzil-style terms). Proposal targets should be glosses and senses, root/pattern/POS/segmentation corrections, attestation links and error reports. Define the kinds as: gloss edit · new sense · morphology correction · attestation link · error report · new entry.
- RVQ-Q04 Reviewer authority: for a religious-study audience, use appointed reviewers or an editorial board with stated qualifications, not reviewers earned purely by contribution count (10 §6.1). Show reviewer names on every merge.
- RVQ-Q05 Make the source rule stricter than the prototype: a gloss or sense change needs at least one structured citation (lexicon plus entry or page, or a grammar reference), and "no source attached" should block approval rather than only warn. Whether tafsir counts as a source is a policy question, because it is interpretation, not lexicography.
- RVQ-Q06 Theological drift is a risk: seed1b shows a proposal bringing theological framing into a gloss ("everything other than God"). Reviewers need written guidelines. Consider competing senses with attribution instead of one winner (10 §6.4), and get advice from subject-matter advisors.
- RVQ-Q07 Revert and sense revision history are needed before launch (10 §6.2). Every merged gloss must be traceable to its proposal, its reviewers and its sources.
- RVQ-Q08 Arabic-first UI: list rows and the diff box mirrored for RTL, Arabic copy for every label and filter, logical CSS properties.
- RVQ-Q09 Privacy: contributor names are shown publicly only with consent; local-only users stay "you"; no public reviewer stats.
- RVQ-Q10 No machine-generated proposals or rationales. Automated checks must be real and labelled honestly; for example, matching attestation verse text against the canonical source is a genuine deterministic check that can be built.
- RVQ-Q11 Ecosystem: the same queue model (kinds, targets, two approvals, credit) should cover the future Arabic dictionary and hadith encyclopedia. Namespace targets by product (quran:word, dict:entry, hadith:narration).

---

### 2. Notebook (NTB)

#### 2.1 Route, header, tabs

- NTB-01 [P] File `Notebook.dc.html`, route `/notebook`. `?tab=journal` opens Journal; any other value opens Notes (06, 01).
- NTB-02 [P] Header right side: segmented tabs "Notes {count}" · "Journal", plus a primary "+ New note" button (#16161a).
- NTB-03 [P] New note creates `{ id:'n'+ms, title:'', body:'', tags:[], ts, roots:[] }`, appends it, selects it, and switches to the Notes tab.
- NTB-04 [P] On load, the selection is the newest note (last in the array), or nothing.

#### 2.2 Notes list (280px column)

- NTB-05 [P] Search input: placeholder "Search notes…", aria-label "Search notes". It matches a case-insensitive substring of body plus title.
- NTB-06 [BUG] Search does not normalise Arabic (diacritics, alef/hamza, ta marbuta), so vocalised notes will not match bare queries.
- NTB-07 [P] Grouping chips: All · By root · By text · Tags.
- NTB-08 [P] All lists notes newest first.
- NTB-09 [P] By root sorts by the first root key (localeCompare). It is a sort only; there are no group headers.
- NTB-10 [P] By text sorts by book id. It is a sort only; there are no group headers.
- NTB-11 [BUG] Tags does nothing: the list is the same as All.
- NTB-12 [≠] 06 asks for a grouping control ("All plus groups"); the prototype sorts but never shows group sections.
- NTB-13 [P] Row title (13px/500, ellipsis) is the title, else the first line of the body cut to 60 characters, else "Untitled note".
- NTB-14 [P] Row sub-line (11.5px, ellipsis) joins, with " · ": the root letters in Arabic (joined " · "), the ref, the tags (joined ", ") and the date.
- NTB-15 [P] The selected row has a white background and a 3px #a8682c left border.
- NTB-16 [P] Empty-list copy: "No notes yet. Write one from any passage in the Reader (Note action) or start here."
- NTB-17 [BUG] The "Reader" link in that copy points at `Lexicon Reader v4.dc.html`, which is not in the handoff. That makes it a dead link, despite PLAN P5 ("no dead links") and R7 ("Review links point at v5").
- NTB-18 [BUG] When search filters the list to zero but notes exist, the column is blank. There is no "no matches" copy.

#### 2.3 Editor pane

- NTB-19 [P] Title input: 18px/600, borderless, placeholder "Untitled note", aria-label "Note title".
- NTB-20 [P] Meta line: "{toLocaleString(ts)} · private", then the tag pills, then a "+ tag" input (dashed pill, 70px wide, aria-label "Add tag"). Pressing Enter adds the trimmed tag.
- NTB-21 [BUG] Tags cannot be removed, duplicates are allowed, and there is no autocomplete.
- NTB-22 [P] Action buttons: "→ Description card" (link to Editor v5 `?note={encoded title}`) · "→ Propose" · "Delete" (transparent; red on hover).
- NTB-23 [P] "→ Propose" pushes `{ kind:'note', wordId:cur.word|null, wordAr:(the word's Arabic, else the first root's Arabic, else '—'), text:whole body, why:'From my note “{title}”', sources:[], status:'pending', by:'you', ts }` and then navigates to the Review Queue.
- NTB-24 [BUG] Propose asks for no confirmation, has no sense target, requires no source, and submits private note text as a public proposal in one click.
- NTB-25 [BUG] Delete is immediate: no confirmation and no undo. Afterwards the newest remaining note is selected.
- NTB-26 [P] Body textarea: 9 rows, 14.5px/1.7, focus border #2f6ae0. Placeholder: "Write. Type @ to link — roots (@ع ل م or @k-t-b), words (@ʿilm), passages (@2:32), lexica (@Lisān)."
- NTB-27 [BUG, checked with node] The mention regex `/@([^\s,.;:()]+(?:\s[^\s,.;:()]+){0,2})/` excludes the colon, so "@2:32" captures only "2" and passage mentions never resolve. "@Lisān" does not match "Lisan" because of the macron. So two of the placeholder's own four examples fail. In addition, trailing words are swallowed ("@ʿilm is great" fails), and the dictionary substring test gives false positives ("Qayn" resolves to Kitab al-Ayn).
- NTB-28 [P] Mentions resolve in this order. Root, by bare letters with spaces removed or by translit, links to Concordance `?root=`. Word, by bare Arabic or translit, links to Reader `?w=`. Dictionary, by English-name substring, links to Reader `?w=ilm` (a placeholder target). Passage, matching `/^\d+:\d+$/`, shows "Q {ref}" and links to Reader `?book=quran`.
- NTB-29 [P] The "Linked" section shows chips, each with a coloured dot. The anchor passage chip (sentence green, "{ref} · {bookAr}") links to Reader `?book=`. Root chips (root brown, spaced Arabic letters) link to Concordance `?root=`. Resolved mentions follow.
- NTB-30 [P] Empty "Linked" copy: "No links yet — anchors and @-mentions appear here; backlinks show on the linked entry."
- NTB-31 [D] That copy promises backlinks on the linked entry. The Reader does list notes per passage, but there are no backlinks on word or root entries.
- NTB-32 [P] Anchor block (only when the note has a key): "Anchored to {ref} · {bookAr}", then the anchor text (the first 4 tokens plus "…", Amiri 18px RTL) with a 2px #a8682c left border.
- NTB-33 [P] With nothing selected, the pane shows "Select a note, or create one." (screenshot 11).
- NTB-34 [P] Every keystroke in the title or body saves the whole notes array, with no debounce. `ts` is the creation time and there is no updated-at.

#### 2.4 Note shapes from producers

- NTB-35 [P] A Reader passage note is `{ id, book, bookAr, key:'ci.pi', ref, anchor, body, roots:P_ROOTS, word:(selected word id), ts }`, followed by the toast "Note saved · see Notebook".
- NTB-36 [P] Reader "Save trail" creates `{ id, title:'Trail: a › b › c', body:'Trail · {date}\n@{tr} — {en}…', tags:['trail'], ts, roots }`, followed by the toast "Trail saved · see Notebook".
- NTB-37 [P] A Notebook-created note is `{ id, title, body, tags, ts, roots:[] }`.
- NTB-38 [≠] 06 says notes carry `{ id, body, tags, wordId?, passageKey?, ts }`. 07's `notes` table has no title, roots, anchor snapshot or book, but adds `kind` ('note'|'marginalia'|'trail'|'journal') and `updated_at`. These need reconciling.

#### 2.5 Journal tab

- NTB-39 [P] Heading "This week", with meta "{sessions in the last 7 days} sessions · {entries opened} entries opened".
- NTB-40 [P] A 7-day bar chart from 6 days ago to today, labelled Su Mo Tu We Th Fr Sa, with today's label darker and weight 500. Bar height is max(6, n/max×44)px and opacity is .35+.65×n/max. Days with no activity get a 4px grey (#ecedf1) bar.
- NTB-41 [P] Session cards (the newest 8): "{weekday long} · ~{minutes} min" · bookAr (Amiri) · "{opened} lookups".
- NTB-42 [P] Each card has a "Roots met" row of chips (Amiri, root colour, linking to Concordance `?root=`), then "· {N} entries opened".
- NTB-43 [P] Notes written the same day appear on the card as "Note: {first 120 chars}" with a root-colour left border.
- NTB-44 [P] Empty copy: "No sessions yet — every entry you open in the Reader is logged here, grouped by day and text."
- NTB-45 [P] Right rail, "All time": "{unique roots} roots met" · "{known} words known · {learning} learning" · "{notes} notes · {starred} starred".
- NTB-46 [P] Right rail, "Due for review": a card reading "{N} root families" with a dark "Review" link. N is the number of unique roots among starred words, falling back to all roots met.
- NTB-47 [BUG] The Review link goes to `Lexicon Reader v4.dc.html?mode=review`, which is a dead link.
- NTB-48 [BUG] The starred count is always 0 because `jadhr-marks` is never written (SHR-13). As a result the due count always falls back to all roots met, which is a misleading number.
- NTB-49 [P] Footer copy: "Everything here is derived from reading; nothing asks you to keep a streak." This is the anti-streak commitment from 06 §6.2.
- NTB-50 [P] Session shape (written by Reader `logSession`): `{ day:'YYYY-MM-DD' (UTC), book, bookAr, words:[], roots:[], opened, minutes }`, one record per day and book. Each entry opened adds 1 to `opened`.
- NTB-51 [P] `minutes` also goes up by 1 per lookup, capped at 180. It is a proxy for lookups, not measured time. Only the last 60 sessions are kept.
- NTB-52 [BUG] Day keys are UTC (`toISOString`) but labels use the local weekday, and `new Date('YYYY-MM-DD')` parses as UTC midnight. Users west of UTC see the wrong weekday, and notes are matched to sessions by UTC day.
- NTB-53 [≠] 08 `GET /me/journal` returns sessions grouped by day, while 07 derives the journal from `lookup_events`. That needs an aggregation step and a defined meaning for "minutes".

#### 2.6 Phone and dark

- NTB-54 [P] Notes uses a fixed 280px list plus the editor; Journal uses 1fr plus a 280px rail. Neither has a phone layout, and there is no dark theme (SHR-15/16). Screenshot 11 shows the nav strip clipped at the right edge ("F…"), which is the scroll fix doing its job.

#### 2.7 Quran adaptation notes (Notebook)

- NTB-Q01 [LOCAL] Notes, tags and the journal should be fully local-first: IndexedDB instead of localStorage for size, sync only when signed in (08 `/me/notes`, `/me/journal`).
- NTB-Q02 A reading journal of religious study is sensitive. Keep it local by default, make sync opt-in, encrypt it at rest on the server, set a stated retention, and say so in the product, not only in a policy (10 §7).
- NTB-Q03 Anchors should be ayah references (surah:ayah, with the surah name). The anchor snippet must be the verbatim canonical text with its source; offer the full ayah on expand rather than a cut-off token prefix.
- NTB-Q04 @-mentions should cover ayah refs (2:255) and ranges (2:255–257), roots in Arabic letters (with or without spaces), transliteration, words, and lexica by Arabic or English name. Later: hadith references (collection plus number) and dictionary entries for the ecosystem. Fix the colon bug (NTB-27).
- NTB-Q05 Search and mention resolution need the Arabic normalisation in 07 §7.1: strip tashkil, fold alef and hamza forms, fold ta marbuta.
- NTB-Q06 Grouping should produce real sections: By root · By surah/text · By tag.
- NTB-Q07 [SRV] "Propose from a note" needs an account. It should open the proposal form prefilled from the note rather than auto-submitting the private note body.
- NTB-Q08 Keep the journal free of streaks and gamification, and avoid metrics that turn recitation or study into competition. "Due for review" must read the real spaced-repetition queue.
- NTB-Q09 Arabic UI with RTL layout; note bodies use `dir="auto"` for mixed Arabic and Latin text.
- NTB-Q10 [LOCAL] Offer per-note and all-notes export (Markdown or JSON) here as well as from Profile.

---

### 3. Classroom (CLS)

#### 3.1 Route and header

- CLS-01 [P] File `Classroom.dc.html`, route `/classroom`. `?tab=shared` opens the Shared graph tab; anything else opens Assignment. The `assign|shared` values match 06 and 01.
- CLS-02 [P] The header shows a static course label "Arabic 301 · Week 6" and segmented tabs "Assignment" · "Shared graph".

#### 3.2 Assignment tab: heat overlay on the text

- CLS-03 [P] Legend: "Lookups per word" with swatches 1–3 (#fdf1e3), 4–8 (#f6d5a8) and 9+ (#e0b361).
- CLS-04 [P] Layer segmented control: lookups · notes · time spent.
- CLS-05 [BUG] The legend still says "Lookups per word" and keeps the lookup thresholds when the notes or time layer is selected.
- CLS-06 [FAKE] Lookups are synthetic, built from a hash of the word id plus rarity: base 9 for frequency under 10, 5 for under 20, otherwise 2, then ±2.
- CLS-07 [FAKE] Notes = (hash % 4) × 3, scaled to fit the shading. Time = 4–12, so in the time layer every word is at least mid-shaded.
- CLS-08 [P] Shading thresholds: ≥9 dark, ≥4 mid, ≥1 light, 0 none.
- CLS-09 [P] Passages shown: the first 3 of chapter 1. Each has a label "Ch. 1 · passage N" (Mono 11px), a rule line, and meta "{entries} entries · {14+2i} of 18 finished". Entries come out as 4, 7 and 4.
- CLS-10 [P] Passage text is RTL Amiri 29px with line-height 1.9 in a wrapping flex row (column-gap 6, row-gap 2). Each token is a button with the heat background, radius 4, padding 0 3px, and a tooltip "{n} lookups · {translit}". Tokens that are not entries are not clickable.
- CLS-11 [P] The English translation (14px, #4f4f5a) appears under each passage.
- CLS-12 [P] Focusing a word highlights every occurrence with #e0b361 plus an inset underline in the root colour.
- CLS-13 [P] Focus card: the Arabic word (22px), then "looked up by {min(18, n+3)} of 18 · avg {1+n/6, 1 decimal} times · {k} notes".
- CLS-14 [P] Focus card sub-line: "{pos} · {pattern meaning} · root {translit}", plus " — worth 5 minutes on Friday" when n ≥ 9.
- CLS-15 [P] Focus card button: "Add to lesson notes", which becomes "In lesson notes ✓" once added.

#### 3.3 Assignment tab: right rail (300px)

- CLS-16 [FAKE] Header "Class · 22 students", with static tiles "18 finished" and "11 min median time".
- CLS-17 [P] "Most looked-up roots": the top 4 roots by summed lookups, each a bar (#a8682c on #ecedf1) with a count. Screenshot shows ك ت ب 67 · ق ر أ 12 · ج ل س 10 · ق و م 7, which matches my node run.
- CLS-18 [BUG] The top roots are summed over all 4 chapter-1 passages, but only 3 passages are displayed.
- CLS-19 [P] "Lesson notes · Friday": rows of {Arabic, "{n} lookups · {pattern meaning}"}. Empty copy: "Click a word in the text, then “Add to lesson notes”."
- CLS-20 [BUG] Lesson notes are not saved anywhere, and cannot be removed or reordered.
- CLS-21 [FAKE] "Needs a nudge" shows a red dot with "4 not started · remind" (remind links to '#') and an amber dot with "2 finished in under 3 min".
- CLS-22 [P] Footer copy: "Aggregates only by default; per-student detail is opt-in for the class. Sample data."
- CLS-23 [BUG] The sample numbers disagree: 22 students against denominators of 18.

#### 3.4 Assignment tab: parity with the docs

- CLS-24 [≠] 06 describes a cohort heat-map: a learners × roots grid with layers lookups / confirmed / struggling, tight line boxes, and clicking a cell focuses that learner/root pair. The prototype instead overlays heat on the words of the text, with layers lookups / notes / time spent and no learner axis.
- CLS-25 [≠] 08 §8.7 defines the heat-map layer as `lookups|confirmed|struggling`, and 07 has `lookup_events.kind` 'lookup'|'ask'|'confirm'|'struggle'. Neither has a notes or time layer. Someone has to decide which model ships.
- CLS-26 [D] 06 calls for a lesson builder (assemble a lesson from passages and roots), backed by 08 `POST /cohorts/:id/lessons {title, passage_ids, root_ids, due_at}` and 07 `lessons`. The prototype has no UI for it.

#### 3.5 Shared graph tab

- CLS-27 [P] This tab mounts the real editor in an iframe at `Lexicon Editor v5.dc.html?view=sample&embed=1&entry=0`, with title "Shared class graph".
- CLS-28 [P] Bottom-left pill (pointer-events none): "Class copy · students propose, teacher confirms · same cards as the editor".
- CLS-29 [P] Bottom-right: a dark "Open in the editor →" link to Editor `?fork=sample`.
- CLS-30 [FAKE] Top-right presence: a green dot with "Live · 6 here" and 5 overlapping 24px avatar circles (#a8682c, #6f55c4, #2f6ae0, #177a44, #ecedf1).
- CLS-31 [P] Side tabs: "Activity" · "Topics 4" · "Notes 12".
- CLS-32 [BUG] Switching side tabs changes only the active style. The content is always the activity feed.
- CLS-33 [P] "Awaiting your confirmation" lists the unconfirmed cards on dashed amber cards (background #fff9f1, border #b45309): تَفَعُّل (Omar), التَّعَلُّم (Omar · just now), د ر ك (Sara · proposed). Each has a "Confirm" button.
- CLS-34 [P] Confirm marks the card confirmed and adds the feed entry "Dr. Nour confirmed {ar}" ("just now") at the top.
- CLS-35 [BUG] Confirming does not reach the graph inside the iframe; nothing is sent to the embed.
- CLS-36 [P] Feed seed, verbatim: Omar "added التَّعَلُّم under تَفَعُّل" just now · Sara "asked about يُدْرَكُ · 2 replies" 4 min · Dr. Nour "confirmed 3 cards · tagged topic Knowledge" 12 min · Layla "linked passage 1·3 to Knowledge" 20 min.
- CLS-37 [P] Each feed entry is a 20px coloured avatar dot, the name in bold (500), the text, and the time underneath (11px).
- CLS-38 [≠] 06 says feed colour should reflect the type of thing touched. The prototype colours each entry by person.
- CLS-39 [P] Feed vocabulary rule: entries describe what changed in the product's own terms (added X under a pattern, asked about a word, confirmed cards, tagged a topic, linked a passage), never "User edited graph". 08 activity entries carry `{ who, kind, subject_ar, subject_translit, detail, at }`.
- CLS-40 [P] Comment form: input with placeholder "Comment or @mention…" (aria-label "Comment") and a "Send" button. Empty drafts are ignored; a sent comment becomes a "You" entry at the top.
- CLS-41 [BUG] Comments are not saved, and @mentions are not resolved.
- CLS-42 [P] Dead code: the page still computes cards, edges and cursors from an earlier hand-drawn graph mock (including the `@keyframes pulse` CSS) but never renders them. The real editor iframe replaced that mock (PLAN P1).
- CLS-43 [D] 08 §8.7 endpoints: `GET /cohorts` and `/cohorts/:id` (scoped to membership) · `POST /cohorts/:id/lessons` · `GET /cohorts/:id/heatmap?lesson=&layer=` · `GET /cohorts/:id/activity?cursor=` · `POST /cohorts/:id/confirm {node_id}`.
- CLS-44 [D] 07 tables: `cohorts` (instructor_id, graph_id), `cohort_members` (role 'learner'), `lessons`. The heat-map is a query over `lookup_events` grouped by (user, root), materialised for large cohorts.
- CLS-45 [D] 10 §5 is open: is there one shared cohort graph or one graph per learner? The answer changes the permission model. Presence-only realtime is recommended for the first release.
- CLS-46 [P] Phone and dark: 1fr plus a fixed 300px rail, 29px text, an absolutely positioned iframe, no phone layout. There is no dark theme; if `jadhr-theme` is dark, the embedded editor goes dark while the host page stays light. Screenshot 12 shows the default state (lookups layer, nothing focused).

#### 3.6 Quran adaptation notes (Classroom)

- CLS-Q01 [SRV] Everything here needs accounts and a server: cohorts, membership, instructor and learner roles, aggregated analytics, presence over WebSocket, and the activity feed. 11 §4 defers Classroom; keep it deferred unless teaching circles (halaqa) or schools are a launch goal.
- CLS-Q02 Privacy comes first: aggregates only by default, a minimum cohort size before any statistic shows (no "looked up by 1 of 3"), explicit learner consent, and per-student detail only by opt-in. Qur'an schools often teach minors, so parental consent and child-data rules apply.
- CLS-Q03 To fit Qur'an teaching, assignments should be ayah ranges (surah:ayah–ayah), the heat overlay should sit on the actual words of the Qur'anic text, and the layers should be lookups / confirmed / struggling as the docs specify.
- CLS-Q04 The heat overlay must not hurt the legibility of the Qur'anic text (tashkil, pause marks). Use backgrounds or underlines with enough contrast, and never recolour letters in a way that could be mistaken for tajwid colour-coding.
- CLS-Q05 Frame "Needs a nudge" and "finished in under 3 min" gently and privately to the teacher; no shaming, and reminders are opt-in.
- CLS-Q06 The shared graph follows the same moderation pattern as the review queue but scoped to the cohort (students propose, the teacher confirms). Its content stays inside the class unless it goes through the public review queue.
- CLS-Q07 [LOCAL] A local-first fallback: a teacher can export a "lesson pack" (passages, roots, lesson notes) that learners open with no account. Learner analytics still require accounts and consent.

---

### 4. Profile (PRF)

#### 4.1 Route, header, identity

- PRF-01 [P] File `Profile.dc.html`, route `/me`.
- PRF-02 [≠] The docs define `?tab=Contributions|Graphs|Library|Journal`. The prototype reads no URL params and defaults to Contributions.
- PRF-03 [P] Profile is not in the NAV (SHR-04). It is reached from the Hub avatar (when signed in), the Hub destination card, and the sign-in modal's "Export my data instead".
- PRF-04 [P] Header right: a 7px dot (green if there is an account, amber if not) with "synced · 1 device" or "saved on this device only".
- PRF-05 [FAKE] The "1 device" count is hard-coded.
- PRF-06 [P] Left rail (280px): a 64px avatar circle in #a8682c with no image or initials; the name ("Local reader", or the account name, 17px/600); the affiliation ("not signed in", or the account affiliation); and "ORCID {id}" in Mono 11px when signed in.
- PRF-07 [P] Signed-out callout: "You are working locally. Everything below is on this device only. Sign in to sync and to have contributions credited by name." The "Sign in" link goes to the Hub.
- PRF-08 [P] Counts list: Contributions merged · Pending · Published graphs · Texts in library · Notes, all computed from local storage.

#### 4.2 Data controls ("Your data")

- PRF-09 [BUG] Export and delete cover only the 12 KEYS. They miss `jadhr-trail`, `jadhr-comments`, `jadhr-theme`, `lexicon-reader-v5` (which holds starred marks and Reader prefs) and `lexicon-editor-v5-ui`. "Delete all local data" therefore does not delete all local data, and README's "To reset, use Profile → Delete local data" inherits the problem.
- PRF-10 [P] "Export everything (JSON)" downloads `jadhr-export.json`: an object mapping each KEYS storage key to its parsed value, or null.
- PRF-11 [P] "Download my texts" downloads `jadhr-texts.json`, the texts array.
- PRF-12 [P] "Delete local data" is a red text button. The first click changes its own label to "Click again to delete all local data", which reverts after 3 seconds. A second click within that window removes every KEYS entry from localStorage and resets the account state. There is no modal, as 06 requires.
- PRF-13 [BUG] Blob URLs are never revoked. There is no success feedback after exporting or deleting, and no undo.
- PRF-14 [D] Production (06, 08 §8.4): `GET /me/export` for the whole account, `DELETE /me/data` with a confirmation token, `POST /me/migrate-anon`, and account settings plus sign-in/out living on this page. With a backend these become GDPR obligations.

#### 4.3 Tabs and rows

- PRF-15 [P] Segmented tabs: Contributions · Graphs · Library · Journal.
- PRF-16 [P] Each row is a link card: coloured dot · Arabic (Amiri 20px RTL, at least 70px wide) · text (13px, ellipsis) · when (11.5px). The border turns #2f6ae0 on hover.
- PRF-17 [P] Contributions: proposals where `by === 'you'` or `by === account.name`, newest first. Text is a prefix ('edit sense ' · 'new sense · ' · 'error report · ' · 'new entry · ' · otherwise '{kind} · ') plus the first 90 characters.
- PRF-18 [P] Contributions "when" column: "merged", or "pending · n/2", or the raw status, then " · {date}". Dot is green (merged), amber (pending) or grey; the row links to the Review Queue.
- PRF-19 [BUG] Raw ids leak into the UI ("attest · ", "note · ", status "changes"), and 'edit sense ' has no " · " separator.
- PRF-20 [P] Graphs: published graphs. Arabic is the first root node; text is "{title} · {n} cards"; when is the date; dot is #6f55c4; the row links to Published Graph `?g={slug}`.
- PRF-21 [P] Graphs are legacy-tolerant: the page uses `g.doc.nodes` with frames excluded, and falls back to `g.nodes` for old records (06 requirement).
- PRF-22 [P] Library: user texts. Arabic is the title; text is "{n} words · {matched} matched entries"; when is the date; dot is #177a44.
- PRF-23 [BUG] Library rows link to `Lexicon Reader v4.dc.html?book={id}`, a dead link.
- PRF-24 [P] Journal: sessions, newest first. Arabic is bookAr; text is "{opened} lookups · roots {translits}"; when is the day; dot is the root colour; the row links to Notebook `?tab=journal`.
- PRF-25 [P] Contributions empty copy: "No proposals yet — use “Suggest an edit” on any sense in the Reader."
- PRF-26 [P] Graphs empty copy: "Nothing published yet — publish from the graph editor."
- PRF-27 [P] Library empty copy: "No texts added yet."
- PRF-28 [P] Journal empty copy: "No reading sessions logged yet."
- PRF-29 [P] Footer callout: "Every merged contribution is credited on the entry and in the dataset changelog — the public record is the reputation."
- PRF-30 [P] Account shape: `{ name, affiliation, orcid, since }`. Published graph shape (written by the Editor on publish): `{ slug, title, desc, counts:{cards, roots, words}, doc:{nodes, edges}, forks, cited, ts }`.
- PRF-31 [BUG] Identity mismatch: the signed-in name 'Amal Haddad' does not match the seed's 'A. Haddad', and the Reader's credit line reads "edited by you" (SHR-20).
- PRF-32 [D] 07 `users.role` (member|reviewer|instructor|admin) is never shown, and 08 `GET /me` counts per tab are not modelled.
- PRF-33 [D] 10 §4.1 migration rule: the newest `updated_at` wins per record, nothing is destroyed, and a recoverable copy is kept for 30 days.
- PRF-34 [P] Screenshot 14: signed out, "Published graphs 2" (from earlier publishes in the capture session), all other counts 0.
- PRF-35 [P] Phone and dark: a 280px rail plus the main pane, with the data controls at the bottom of the rail where a phone would push them below the fold. No phone layout and no dark theme.

#### 4.4 Quran adaptation notes (Profile)

- PRF-Q01 [LOCAL] The "Local reader" default must work completely, and the page must say honestly what is stored on the device and what is synced.
- PRF-Q02 [SRV] Accounts are optional and exist for sync and attribution. Migrating local data on sign-in is required (10 §4.1). Email magic link fits this audience; institutional SSO can come later.
- PRF-Q03 Data controls are a trust commitment. Export must cover everything (notes, journal, bookmarks, spaced-repetition state, prefs, trail) in an open format. Local delete must be complete, either through a key registry or by dropping the IndexedDB database, and server delete must use a confirmation token. Fix PRF-09.
- PRF-Q04 Privacy: no public profile by default; contributions are credited under a name the user chooses; ORCID and affiliation are optional, for scholars.
- PRF-Q05 No points, badges or reputation scores ("the public record is the reputation"). This suits a religious-study audience and avoids performative piety mechanics.
- PRF-Q06 Arabic UI. Likely tabs for the Qur'an product: Bookmarks (ayah) · Notes · Contributions · Journal, with Graphs later if the editor ships.
- PRF-Q07 Ecosystem: one account and one data-controls page across the Qur'an site, dictionary, hadith encyclopedia and book reader, with per-product sections in the export.

---

### 5. Data & API (DAT)

#### 5.1 Route and header

- DAT-01 [P] File `Data & API.dc.html`, route `/data`. `?tab=api` opens the API playground; anything else opens Dataset (06, 01).
- DAT-02 [P] Header: segmented tabs "Dataset" · "API playground", plus static text "CC BY-SA 4.0 · code MIT".
- DAT-03 [P] The page re-renders on window focus and on visibilitychange (forceUpdate), so a merge in another tab shows up at once. The listeners are removed on unmount.

#### 5.2 Dataset tab

- DAT-04 [P] Title "Jadhr — dataset" (22px/600). Description: "Roots, patterns, words, senses with source attributions, and attestations across the loaded corpora. Everything the site shows, as files you can diff."
- DAT-05 [P] Stat tiles, computed from the data and checked with node: 6 "roots (prototype)" · 35 "words" · 75 "senses · sourced" · 9 "lexica".
- DAT-06 [FAKE] "senses · sourced": the per-sense sourcing comes from the synthetic `dictAttests`.
- DAT-07 [P] Releases, section label "Releases". Row v2026.09 (current: white background, bold) has the note "{N} merged contribution(s) this session · " (only when N>0) + "scripture attestations sample · pattern tables · timeline", format buttons JSON · TEI · LMF · CSV, and DOI cell "live".
- DAT-08 [P] Release row v2026.06: "Qurʾān attestations · pattern table for 1,800 roots" · "DOI 10.5281/…4471".
- DAT-09 [P] Release row v2026.03: "first public release · 9 lexica aligned" · "DOI 10.5281/…3109".
- DAT-10 [≠] Past releases have no download buttons, but 06 and 07 say old versions must stay permanently retrievable because citations point at them.
- DAT-11 [P] CSV download: header `id,ar,tr,root,pattern,pos,en`, one row per word, with `en` wrapped in quotes. File name `jadhr-v2026.09.csv`.
- DAT-12 [BUG] The CSV does not escape quotes inside fields, so it is not valid RFC 4180.
- DAT-13 [FAKE] JSON, TEI and LMF all download the same JSON, `{ format, dataset, roots, words, lexica }`, as `jadhr-v2026.09.json`. TEI and LMF are not implemented.
- DAT-14 [P] Changelog label: "Changelog · v2026.09 (this prototype's live data)".
- DAT-15 [P] Changelog entries: "• {by} — {'edited sense' for edit, else the raw kind} on {wordAr}: “{first 70 chars}”". Screenshot 15 shows the seed1b merge.
- DAT-16 [P] Changelog empty copy: "No contributions merged yet in this session. Approve one in the review queue and it appears here under the contributor’s name."
- DAT-17 [BUG] Entries are joined with "\n" inside a div that has no `white-space:pre-wrap`, so two or more entries run together on one line.
- DAT-18 [P] Right rail, "Cite the dataset": a pre-wrap citation box, format pills BibTeX · Chicago · APA (selected pill is #eef3fd with a #2f6ae0 border), and a "copy" pill that writes to the clipboard and shows the toast "Citation copied" (green, 1.8 s).
- DAT-19 [P] BibTeX template, verbatim: `@dataset{jadhr_2026_09,\n  title = {Jadhr — Arabic Root Lexicon, dataset v2026.09},\n  year = {2026},\n  doi = {10.5281/zenodo.0000000},\n  license = {CC-BY-SA-4.0}\n}`
- DAT-20 [P] Chicago template, verbatim: `Jadhr. Arabic Root Lexicon, dataset v2026.09. 2026. https://doi.org/10.5281/zenodo.0000000.`
- DAT-21 [P] APA template, verbatim: `Jadhr. (2026). Arabic Root Lexicon (dataset v2026.09) [Data set]. https://doi.org/10.5281/zenodo.0000000`
- DAT-22 [≠] 06 says the citation formats are BibTeX / RIS / plain; the prototype has BibTeX / Chicago / APA. The DOI is a placeholder.
- DAT-23 [P] "Sources & licences" copy, verbatim: "Classical lexica: public domain (digitised texts credited per source). Lane: PD. Qurʾān text: Tanzil, CC BY-ND. Our alignments, glosses and attestation links: CC BY-SA 4.0."
- DAT-24 [≠] That licence claim cannot ship until each source is resolved (06 §6.8, 10 §1).
- DAT-25 [FAKE] "Used by" copy, verbatim: "2 papers · 6 forks · 14 downstream tools · add yours". The "add yours" link oddly goes to the Review Queue.
- DAT-26 [P] Footer copy: "Every merged contribution appears in the next release's changelog under the contributor's name."
- DAT-27 [BUG] The toast is only rendered inside the Dataset tab (see DAT-45).

#### 5.3 API playground tab

- DAT-28 [P] Left column (220px, Mono 11.5px), heading "Endpoints". Each entry shows its method in colour (GET #15803d, POST #2f6ae0) and its path; the selected entry is white with a #d3d3dc border.
- DAT-29 [P] Endpoint `GET /lookup`, URL `https://api.jadhr.org/v1/lookup?q=` + param + `&limit=3`. Description: "Resolves any query the site search accepts — Arabic with or without tashkīl, transliteration, English gloss, root letters, wazn, verse reference — and returns typed matches."
- DAT-30 [P] Endpoint `GET /roots/{root}`, URL `https://api.jadhr.org/v1/roots/`. Description: "A root with its patterns, words and attestation counts. Accepts the key (ilm), the letters (علم) or the transliteration (ʿ-l-m)."
- DAT-31 [P] Endpoint `GET /words/{id}`, URL `https://api.jadhr.org/v1/words/`. Description: "One entry: senses with the lexica that attest each, pattern, root, corpus frequency."
- DAT-32 [P] Endpoint `GET /patterns/{wazn}`, URL `https://api.jadhr.org/v1/patterns/`. Description: "Every word on a pattern across roots."
- DAT-33 [P] Endpoint `GET /concordance`, URL `https://api.jadhr.org/v1/concordance?root=` + param + `&texts=all`. Description: "KWIC lines for a root across the loaded texts."
- DAT-34 [P] Endpoint `GET /lexica/{id}/{root}`, URL `https://api.jadhr.org/v1/lexica/lisan/`. Description: "A lexicon entry for a root, with sense alignment."
- DAT-35 [P] Endpoint `POST /analyse`, body `{"text":"…"}`. Description: "Morphological analysis of a phrase: segmentation, candidate roots, pattern, confidence."
- DAT-36 [P] Endpoint `POST /graphs`, body `{"title":"…", …}`. Description: "Publish a graph (requires a key)."
- DAT-37 [P] Left column footer: "v1 · no key for reads · 60 req/min · OpenAPI spec". The spec link is '#'.
- DAT-38 [P] Request area: a "{METHOD} {path}" title and the description; a URL field showing the base (grey Mono), an editable param (`dir="auto"`, Amiri/Mono 15px, aria-label "Query parameter") and the tail; a "Send" submit button; a "curl" button.
- DAT-39 [P] Default params when switching endpoint: lookup 'علم' · roots, words, concordance and lexica 'ilm' · patterns 'مَفْعُول' · analyse 'إِنَّ العِلْمَ لَا يُدْرَكُ' · graphs 'ʿ-l-m family'. The page also runs lookup('علم') on load.
- DAT-40 [FAKE] Response status row: "200 OK" (always green) · "{ms} ms" (random 28–67) · "application/json" · `etag "v2026.09"`.
- DAT-41 [P] The response is shown in a pre (Mono 12px, line-height 1.6, max-height 60vh, scrolls).
- DAT-42 [P] lookup response: `{ query:{ raw, detected:'arabic'|'arabic_undiacritised'|'latin' }, results:[rootJ…, wordJ… (max 3 words)] }`.
- DAT-43 [P] wordJ shape: `{ kind:'word', id, ar, tr, root, pattern, pos, senses:[{ id:'sN', en, sources:[≤4 dict ids] }], frequency, url:'https://jadhr.org/w/{id}' }`. rootJ shape: `{ kind:'root', id, ar, tr, gloss, words, attestations, url:'https://jadhr.org/r/{key}' }`.
- DAT-44 [P] Other endpoint shapes. roots: rootJ plus `patterns:[{ ar, tr, words:[ids] }]`. words: wordJ. patterns: `{ kind:'pattern', ar, tr, meaning, words:[{ id, ar, root, en }] }`. concordance: `{ root, hits, lines:[≤6 { source, left, keyword, right }] }`. lexica: `{ lexicon, compiler, died, root, entry:(400 chars…), senses_aligned:[{ sense, attested }] }`. analyse: `{ text, tokens:[{ token, segments, root, pattern, entry, confidence }] }`. graphs: `{ status:'created', id:'g_…', url:'https://jadhr.org/g/you/{slug}', license }`.
- DAT-45 [P] Every response gets flat `dataset:'v2026.09'` and `license:'CC-BY-SA-4.0'` fields appended, so provenance travels with the data. [BUG] The "curl copied" toast never appears, because the toast only exists inside the Dataset tab.
- DAT-46 [≠] 08 §8.8 specifies an envelope instead: `{ meta:{ dataset_version, license, doi, generated_at }, data }`.
- DAT-47 [≠] 08 §8.8 public endpoints are `/public/lookup`, `/public/roots/:key`, `/public/concordance` (paginated), `/public/releases` and `/public/releases/:version/:format`. The playground has no releases endpoint but does show words, patterns, lexica, analyse and graphs, which are not in that list.
- DAT-48 [≠] Auth: the playground says "no key for reads · 60 req/min". 08 §8.8 says key-authenticated at 60/min per key, and 08 §8.1 says public reads are 120/min per IP.
- DAT-49 [BUG] Queries that match nothing silently fall back to a default (ROOTS[2] = ilm, WMAP.ilm, 'مَفْعُول') instead of returning a 404 `not_found` error.
- DAT-50 [BUG] For POST endpoints, the curl button produces an invalid command because the JSON body is pasted into the URL.
- DAT-51 [BUG] Query detection only distinguishes arabic, arabic_undiacritised and latin. 08 §8.3 requires Arabic word · transliteration · English gloss · root · pattern · empty.
- DAT-52 [FAKE] The lexica endpoint returns placeholder `lexEntry()` prose, and word sense sources come from the synthetic `dictAttests`. Neither may ship (07 §7.4, 10 §1).
- DAT-53 [P] The concordance endpoint scans only the prose BOOK (ALL_PASSAGES), not SCRIPTURE.
- DAT-54 [P] Phone and dark: Dataset is 1fr plus a 300px rail; API is a 220px list plus the main pane, and the URL field has a 260px minimum width. No phone layout and no dark theme. Screenshot 15 shows the Dataset tab with the seed1b changelog entry.
- DAT-55 [D] Production (06 §6.8, 07, 08, 10 §7): pre-generated, versioned, DOI-registered artefacts stored in object storage; an immutable `dataset_releases` table; `GET /changelog?since=`; and a stated cadence (live data with periodic citable snapshots).

#### 5.4 Quran adaptation notes (Data & API)

- DAT-Q01 [SRV] Server and infrastructure: a release pipeline, object storage, DOI registration (Zenodo), API keys and rate limits. The page itself can be static and cached.
- DAT-Q02 Licensing comes before anything ships. The Qur'anic text source's terms (Tanzil allows only verbatim copies, requires attribution and a link, and requires the notice to stay intact; the prototype says "CC BY-ND") must be confirmed. Any derived morphology dataset must be checked for licence compatibility (for example, the Quranic Arabic Corpus is reportedly GPL; verify). Each lexicon follows 10 §1. Show the licence per source on the page and in every API response.
- DAT-Q03 Provenance: every record carries source ids. The "senses · sourced" claim must be literally true, and machine-derived values (such as morphology confidence) must say so.
- DAT-Q04 No invented numbers: "Used by", download counts and DOIs are either real or hidden.
- DAT-Q05 Formats: TEI Lex-0 and LMF (ISO 24613) for the lexicon. For Qur'an morphology, a token table keyed by location (surah:ayah:word:segment). CSV must be RFC 4180, UTF-8, NFC.
- DAT-Q06 Citation formats: BibTeX, RIS, Chicago and APA, plus an Arabic citation form. Ayah-level citations (for example "Q 2:255, via {dataset} v…") should be offered by the Reader's cite sheet too.
- DAT-Q07 Ecosystem: namespace the API by product (quran, lexicon, hadith, books) with stable cross-product ids, so the future dictionary and hadith encyclopedia share the same release and citation machinery.
- DAT-Q08 [LOCAL] The playground can be purely client-side, calling the real public API. Downloaded datasets support offline and scholarly use; nothing here needs a user account apart from writes such as publishing graphs.

---

### 6. Hard-won fixes found in code and comments (keep these)

- SHR-H01 The nav strip scrolls horizontally while page actions stay pinned, so the shared header never pushes page controls off-screen (PLAN P6).
- SHR-H02 `aria-current="page"` on the shared nav (PLAN P5).
- SHR-H03 One shared theme key (`jadhr-theme`) so the Reader, the Editor and embedded editors agree, defaulting to light (PLAN P5, 02 §2.2). Keep the principle; the community pages still need to consume it.
- SHR-H04 Storage access is wrapped in try/catch everywhere, so private mode and full quota fail safe.
- SHR-H05 English glosses are never spliced into Arabic text fields (PLAN P2, 07 §7.1.2). This matters for proposal text, which must keep Arabic and English in separate fields.
- RVQ-H01 A second reviewer's approval is seeded (H. Mansour on seed1b) so the two-approval merge path can be demonstrated (PLAN P4).
- RVQ-H02 Double-approve guard: a second approve by the same reviewer is a no-op (PLAN P4).
- RVQ-H03 Switching filter selects the first item, so the detail pane is never empty (PLAN P4, 06).
- RVQ-H04 A decision moves the selection on to the next pending item, and when the queue empties the filter auto-switches to Merged or Declined (PLAN P4).
- RVQ-H05 Each filter has its own empty-state copy (PLAN P4).
- RVQ-H06 Seed versioning: stale `/^seed\d$/` seeds are replaced by `seedNb` seeds while the user's own proposals are kept.
- RVQ-H07 The note draft is cleared on every selection change and after every decision, so a note can never attach to the wrong proposal.
- RVQ-H08 Merged edits rewrite the sense in the Reader with a credit line and appear in the Data changelog (PLAN P4). This end-to-end chain is the reason contributors take part.
- RVQ-H09 The Reader's suggest form keeps Submit disabled until there is wording and either a rationale or a source, and the Reader re-reads proposals on window focus.
- NTB-H01 A note's title falls back to the first line of its body, so untitled notes still list meaningfully.
- NTB-H02 The mention regex allows up to three space-separated tokens, so spaced root letters ("@ع ل م") resolve. Keep the intent but fix the colon and greedy-capture bugs (NTB-27).
- NTB-H03 The journal footer states there is no streak. This is a deliberate rejection of loss-aversion mechanics (06 §6.2: "Do not add one").
- NTB-H04 The session log is capped: minutes at most 180, the last 60 sessions kept, the trail at 40 steps. This keeps local storage bounded.
- NTB-H05 Empty states name the specific action that fills them (06 §6.4).
- CLS-H01 The shared graph mounts the real editor read-only through an iframe (`view`, `embed`, `entry`), not a mock or screenshot (PLAN P1). The old hand-drawn mock remains as dead code.
- CLS-H02 Heat-map line boxes were tightened (PLAN P4): token padding 0 3px, column-gap 6px, row-gap 2px, token line-height 1.5 inside a 1.9 container, so the text reads as continuous prose.
- CLS-H03 Aggregates only by default, with per-student detail opt-in for the class (stated in the footer).
- CLS-H04 Overlay pills on the iframe use `pointer-events:none` so they never block the canvas.
- PRF-H01 Two-step delete changes the button's own label and auto-reverts after 3 seconds, with no modal (06 §6.7).
- PRF-H02 Graph rows tolerate the legacy format (`g.doc` versus `g.nodes`) and exclude frames from card counts (PLAN P4, 06, 08 `doc_version`).
- DAT-H01 The page re-reads data on focus and visibilitychange, with listener cleanup, so cross-tab merges appear immediately (PLAN P4).
- DAT-H02 Every API response carries the dataset version and licence, so provenance cannot be lost downstream (08 §8.8).
- DAT-H03 Clipboard writes are wrapped in try/catch and the toast shows either way.
- DAT-H04 The changelog is driven by live merged proposals and credits contributors by name.

#### 6.1 Defects consolidated (do not port; the IDs point to the full entries above)

- DEF-01 Dead links to `Lexicon Reader v4.dc.html` (not in the handoff): NTB-17, NTB-47, PRF-23, plus the Reader/anchor/mention links inside Notebook. PLAN P5 says "no dead links" and R7 says "Review links point at v5".
- DEF-02 No dark theme and no phone layout on any of the five pages: SHR-15, SHR-16. README and 11 §4 say do not cut either.
- DEF-03 Export and delete miss five storage keys: PRF-09, SHR-12.
- DEF-04 `jadhr-marks` is never written, so starred and due counts are wrong: SHR-13, NTB-48.
- DEF-05 Self-approve is not enforced; it exists only as copy: RVQ-40.
- DEF-06 Your own proposal can never merge in the prototype: RVQ-76. The approval slot label is wrong: RVQ-77. The raw source id is shown: RVQ-78. No re-read on focus: RVQ-80.
- DEF-07 @-mention parser: passage refs never resolve, @Lisān fails, greedy capture, false-positive dictionary matches: NTB-27.
- DEF-08 The Tags grouping does nothing; groupings are sorts without headers: NTB-11, NTB-12.
- DEF-09 Journal day keys mix UTC and local time: NTB-52.
- DEF-10 Notebook delete and propose happen in one click with no confirmation: NTB-24, NTB-25.
- DEF-11 Classroom legend is fixed while layers change; side tabs do nothing; confirmations are not sent to the embed; numbers are inconsistent: CLS-05, CLS-32, CLS-35, CLS-23, CLS-18.
- DEF-12 Changelog newlines collapse; CSV quoting is wrong; TEI/LMF are fake; the curl toast is invisible; curl for POST is invalid; lookups fall back silently instead of 404: DAT-17, DAT-12, DAT-13, DAT-45, DAT-50, DAT-49.
- DEF-13 Identity is matched by display-name strings instead of stable ids: SHR-20, RVQ-08, PRF-31.
- DEF-14 Doc numbers are off: 07 §7.4 says FORM_META has 22 rows; node counts 21.

---

### 7. Accounts and server versus local-first, at a glance

- MAP-01 [LOCAL] Notebook (notes, tags, search, grouping, journal), Profile in local-reader mode (counts, export, delete), Data & API browsing and downloads, and API playground reads. All of these work with no account.
- MAP-02 [LOCAL→SRV] Optional sync of notes, journal, word states, progress and prefs (08 §8.4), with anonymous-to-account migration (`X-Jadhr-Anon`, `POST /me/migrate-anon`, newest wins, 30-day recoverable copy).
- MAP-03 [SRV] Review Queue decisions, merges, credit lines and changelog entries (08 §8.5); reviewer roles and revisions (10 §6). Proposal drafts can be kept locally until sign-in.
- MAP-04 [SRV] Classroom in full: cohorts, lessons, heat-map aggregation, activity feed, presence, confirmations (08 §8.7, 10 §5).
- MAP-05 [SRV] Dataset releases, DOIs, the public API with keys and rate limits, and graph publishing (08 §8.8, 10 §7).
- MAP-06 Suggested phasing (11 §3/§4): Notebook and Profile in Phase 2 with accounts; the proposal chain in Phase 2; Classroom in Phase 3 (deferrable); Data & API in Phase 4 and gated on licensing (10 §1).

---

## Part 5 — Content and data model behind the prototypes

_Original heading: Content and data model inventory — Jadhr design handoff_

Source folder: `Claude Design Handoff/` (read-only). Files read in full: `prototypes/lexicon-data.js` (300 lines), `prototypes/jadhr-chrome.js` (13 lines), `07-data-model.md`, `08-api-contract.md`, `09-search-architecture.md`. Also read, to locate the content the brief asked about that is NOT in `lexicon-data.js`: the data/logic blocks of `Lexicon Reader v5.dc.html` (lines 1352–3063), `Collections.dc.html`, `Library.dc.html`, `Concordance.dc.html`, `Search.dc.html`, `Analyser.dc.html`, `Data & API.dc.html`, `Classroom.dc.html`, `Notebook.dc.html`, `Review Queue.dc.html`, `Profile.dc.html`, `Shell.dc.html`, `Jadhr.dc.html`, the data block of `Lexicon Editor v5.dc.html` (lines 712–850), and §1 of `10-open-questions.md`.

All counts below were computed by evaluating `lexicon-data.js` in Node (in memory, nothing written), not copied from the docs.

---

### 0. Headline findings (read first)

- `lexicon-data.js` exports 32 names; it does NOT contain the glossary, collections, word of the day, next steps, or difficulty — those live in `Lexicon Reader v5.dc.html` (GLOSSARY, next steps, difficulty) and `Collections.dc.html` (SETS, word of the day). They are documented in §1.B below.
- `jadhr-chrome.js` does NOT contain a context strip, theme handling, or storage keys. It holds only the nav list, `navModel`, a colour map, and three inline-style helpers. Context strip, theme, and storage keys live elsewhere (§3).
- FORM_META has **21** patterns, not 22 as `07-data-model.md` §7.4 states. The only other pattern string anywhere in the data layer is `يَفْعَلُ`, which `analyse()` can return as a fallback pattern but which has no FORM_META row (so the UI shows a blank function for it).
- GLOSSARY has **29** terms (07/08 say "~30").
- `Lexicon Reader v5.dc.html` does not import `lexicon-data.js`; it carries an inline copy. `diff` confirms the copy is byte-identical for FORM_META → ALL_PASSAGES, SCRIPTURE/SCRIPT_OCC, and AFFIX tables/analyse. The Reader uses its own storage helpers (`JK`, `jload`, `jsave`) instead of `KEYS`/`load`/`save`.
- `Lexicon Editor v5.dc.html` has its own, different content model (ROOTS with nested forms → words, an English `note` per root, SENTS, typed card fields). Summarised in §1.C.
- Everything sense-level that implies scholarship — which dictionary attests which sense (`dictAttests`), which corpus attests which sense (`corpusAttests`), every dictionary article (`lexEntry`) — is **fake, generated by hash arithmetic or templates**. The UI labels it "placeholder". Real equivalents are the single largest content gap (§4).
- Prototype content is linguistically imperfect in places that matter for the rebuild: `الْعَلِيمُ` in 2:32 is tagged to lemma `alim` (عَالِم, pattern فَاعِل); the real lemma is عَلِيم on فَعِيل, which FORM_META lacks. Patterns the Quran needs (فَعِيل, تَفَعُّل, اِفْتِعَال, اِنْفِعَال, فُعُول, أَفْعَال …) are absent from FORM_META.
- Normalisation is specified three different ways: prototype `stripDia` (strip `[ً-ْٰـ]`, fold أإآ→ا only), 07 (adds ى→ي, ة→ه), 09 (adds ٱ→ا, ئ→ي, ؤ→و). None strip Quranic annotation marks (U+0610–U+061A, U+06D6–U+06ED) or fold alef wasla in the prototype — this matters for Uthmani Quran text.
- The glossary highlighter `GLOSS_RE` uses `\b`, which only matches ASCII word boundaries — it cannot match Arabic glossary keys. An Arabic-first glossary needs a different matcher.

---

### 1. `lexicon-data.js` — every export

Export list (verbatim order): `FORM_META, ROOTS, WORDS, DICTS, FILTERS, TAILS, BOOK, WMAP, RMAP, TYPE_COLOR, parseTok, OCC, lexEntry, TOPICS, CORPORA, TL_MIN, tlX, dictAttests, corpusAttests, SENSE_COLORS, stripDia, P_KEY, P_REF, P_ROOTS, ALL_PASSAGES, TL_MAX, SCRIPTURE, SCRIPT_OCC, KEYS, load, save, analyse`. Not exported (module-internal): `W` (word constructor), `AFFIX_PRE`, `AFFIX_SUF`.

Consumers (from grepping `m.<name>` in each page; the Reader uses its inline copy):

| Export | Used by |
|---|---|
| FORM_META | Reader, Analyser, Classroom, Collections, Data & API, Search |
| ROOTS | Reader, Concordance, Data & API, Notebook, Search |
| WORDS | Reader, Collections, Data & API, Notebook, Search |
| DICTS | Reader, Data & API, Notebook, Review Queue |
| FILTERS, TAILS, TYPE_COLOR, OCC, TOPICS, CORPORA, TL_MIN/TL_MAX/tlX, corpusAttests, SENSE_COLORS, P_KEY/P_REF/P_ROOTS, SCRIPT_OCC | Reader only |
| BOOK | Reader, Classroom, Concordance, Library, Search |
| WMAP | Reader, Classroom, Collections, Concordance, Data & API, Notebook, Search |
| RMAP | Reader, Analyser, Classroom, Collections, Concordance, Notebook, Profile, Search |
| parseTok | Reader, Classroom, Concordance, Data & API, Library, Search |
| lexEntry, dictAttests | Reader, Data & API |
| stripDia | Reader, Analyser, Concordance, Data & API, Notebook, Search |
| ALL_PASSAGES | Reader, Data & API |
| SCRIPTURE | Reader, Concordance, Library, Search |
| KEYS, load, save | Collections, Concordance, Data & API, Jadhr hub, Library, Notebook, Profile, Published Graph, Review Queue |
| analyse | Reader, Analyser, Concordance, Data & API, Library |

#### 1.A Exports one by one

##### FORM_META — patterns (awzān)
- Shape: object keyed by the vocalised Arabic pattern string → `[translit, functionText]`. Example: `'مَفْعَلَة': ['mafʿala', 'noun of place (fem.)']`.
- There is no slug key, no form number field, no part-of-speech hint, no plain-language field. Form number appears only inside the function text ("Form II participle"). Plain-language text is reached indirectly: the Reader runs the function text through the GLOSSARY matcher, so "noun of place" becomes a dotted term opening the glossary card.
- Full verbatim table in §2.1.
- UI uses: Reader word chip (shows `[0]` translit, not the Arabic), Family section group headers (Arabic + translit + function), Shapes/Patterns section (root paradigm table over all FORM_META keys, "N of 21 patterns attested", "Show all 21 patterns"), wazn view ("<function> — N words across M roots in the lexicon."), cousins note, next-steps "The shape" door, Ask card 4 "The shape", review hints ("hint: <function>"), omnibox Patterns group (matches stripped Arabic or translit with ʿʾ/3/' stripped), Search pattern detection (chat/Buckwalter translit), Analyser seed, Classroom focus line, Collections item sub-line (`tr · function`), Data & API `/patterns`, graph-editor seed `form: { ar, tr, en }`.

##### ROOTS
- Shape: `{ key, ar, bare, tr, en, arGist, corpus }`. Example: `{ key: 'ilm', ar: 'ع ل م', bare: 'علم', tr: 'ʿ-l-m', en: 'knowing, marking, signposting', arGist: 'الأثرِ والعلامةِ يُستدَلُّ بها', corpus: 854 }`.
- `ar` is letters space-separated (display); `bare` is joined letters (matching); `tr` hyphenated translit; `en` English gloss; `arGist` an Arabic genitive phrase written to complete the sentence "يدلُّ على …" (the Reader renders `'يدلُّ على ' + arGist + '.'`, and lexEntry splices it after "أصلٌ صحيحٌ يدلُّ على"); `corpus` an integer frequency.
- 6 roots. Verbatim table in §2.2.
- Note: `corpus` is not the sum of its words' `freq` (computed: ktb 130 vs 319, drs 57 vs 144, ilm 158 vs 854, qra 33 vs 88, jls 25 vs 41, qwm 532 vs 660). The two numbers come from different (placeholder) counts; recompute both.
- UI uses: root chip in panel header (`ar`, `tr`, `en`, gist line), omnibox Roots group (`N words · <corpus> in corpus`), passage Roots drawer (`N× here · <corpus> in corpus`), page-roots rail (bars), index groups, Concordance root chips, Search roots, root builder (three letter boxes matched with `bare.includes`), analyse skeleton match, review root card, word of the day blurb ("Built on <tr> — <en>"), Collections root chips, Notebook @mentions, hub/Shell context chips, citations (`jadhr.org/r/<key>`), Data & API `/roots`.

##### W and WORDS — lexemes
- `W(id, ar, tr, en, pos, root, form, arDef, freq, senses)` builds `{ id, ar, tr, en, pos, root, form, arDef, freq, senses }`.
- Example: `{ id: 'maktaba', ar: 'مَكْتَبَة', tr: 'maktaba', en: 'library, bookshop', pos: 'noun', root: 'ktb', form: 'مَفْعَلَة', arDef: 'موضعُ الكتبِ وجمعُها', freq: 7, senses: ['a collection of books; a library', 'a shop where books are sold'] }`.
- `id` slug (URLs `?w=`, storage keys, citations `jadhr.org/w/<id>`); `ar` vocalised lemma; `tr` translit; `en` short English gloss; `pos` one of `verb | noun | participle` in the data (the UI and 07 also expect `adjective`, `particle`; Collections tests a never-present `pos === 'place'`); `root` → ROOTS.key; `form` → FORM_META key; `arDef` one-line Arabic classical definition; `freq` integer "in corpus"; `senses` ordered English strings.
- 35 words, 75 senses total; sense count distribution: 1 word has 1 sense, 28 have 2, 6 have 3. Words per root: ktb 8, drs 6, ilm 9, qra 3, jls 3, qwm 6. Every FORM_META key is used by at least one word. Verbatim table in §2.3.
- Optional field the UI reads but the data never sets: `arSenses` — the Reader's compare/apparatus views call `w.arSenses[i]` for senses 2+ (sense 1 uses `arDef`); when absent they fall back to English italic LTR text. An Arabic-first build needs this field populated.
- UI uses: essentially every surface (panel headword, chips, Meanings section, family, patterns, hover card, Ask cards, omnibox, search, index, concordance, collections, review, analyser, data API, CSV/JSON export, graph seeds).

##### DICTS — historical dictionaries
- Shape: `{ id, ar, en, by, d, tag, kind }`. Example: `{ id: 'lisan', ar: 'لسان العرب', en: 'Lisan al-Arab', by: 'Ibn Manzur', d: 1311, tag: 'comprehensive', kind: 'general' }`.
- `d` = author's death year CE (timeline x-position); `kind` ∈ `earliest | general | root | interpretive | english` drives filter chips, article direction (`english` → LTR, else RTL), and the lexEntry template; `tag` is the label printed on the article card.
- Array order matters: it is chronological and the index `j` feeds `dictAttests(w, i, j)`; the apparatus base choices are `DICTS.filter(kind !== 'english').slice(-4)` = mufradat, lisan, qamus, taj (default base `lisan`); compare defaults to `['ayn','sihah','lisan']` (max 3, FIFO); "Suggest an edit" offers `DICTS.slice(0, 6)` as sources; tab "Lexica" count = dictionaries not toggled off; "Old dictionaries — N say something" counts dictionaries attesting ≥1 sense.
- Verbatim table in §2.4. There are no `license` or `source_note` fields in the prototype; 07 makes `license` NOT NULL.

##### FILTERS
- `[{k:'all',label:'All 9'},{k:'earliest',label:'Earliest'},{k:'general',label:'General'},{k:'root',label:'Root-semantic'},{k:'interpretive',label:'Interpretive'},{k:'english',label:'English'}]`.
- Reader Lexica filter chips; label becomes `label + ' ' + count` for non-all chips, chip dimmed when count is 0. "All 9" is hard-coded text — must be computed from the dictionaries actually held.

##### TAILS
- 5 Arabic boilerplate sentences appended by `lexEntry` to pad placeholder articles to realistic length. Verbatim: 1 `وقد جاءَ في كلامِ العربِ على وجوهٍ، وسيأتي بيانُ ذلك في موضعِه.` · 2 `قال بعضُ أهلِ اللغةِ: وهذا هو الأصلُ في البابِ، وما بعدَه متفرِّعٌ عنه.` · 3 `ويقالُ في الجمعِ على غيرِ القياسِ، وقد حُكِيَت فيه لغاتٌ عن العرب.` · 4 `وأنشدَ في ذلك بيتًا لم يُسنَد إلى قائلٍ معروفٍ، وفيه نظرٌ عندَ المحقِّقين.` · 5 `والوجهُ الآخرُ أن يكونَ محمولًا على المعنى الأوَّلِ اتِّساعًا في الكلام.`
- Placeholder only. Do not ship.

##### BOOK — the invented demo prose text
- Shape: `{ ar, en, chapters: [{ ar, en, passages: [{ tr, en, toks: [rawToken…] }] }] }`. Title `كِتَابُ العِلْمِ وَالمَكْتَبَة` / "The Book of Knowledge and the Library". 3 chapters, 10 passages, 95 tokens of which 45 are tagged to a word.
- Raw token format: `'<surface>|<wordId>|<gram>'`, pipe-separated; untagged tokens are just the surface (punctuation stays attached to the surface, e.g. `'قَدِيمًا،'`). Example: `'المَكْتَبَةِ|maktaba|noun · genitive, definite'`.
- No passage `ref`; the UI synthesises "Ch. N · passage M". No difficulty field. Passage list verbatim in §2.6.
- Used as the Reader's default book, Classroom's assignment (chapter 1, passages 1–3), Library shelf ("Classical"), Concordance/Search sources, review context cards.

##### WMAP / RMAP
- `WMAP[word.id] = word`, `RMAP[root.key] = root`. Lookup tables used everywhere.

##### TYPE_COLOR
- `{ root: 'var(--c-root)', form: 'var(--c-form)', word: 'var(--c-word)', sentence: 'var(--c-sentence)', description: 'var(--c-desc)' }`. Colour-codes the five graph card types; used for the "Open in graph" sheet row dots. Hex equivalents are in `jadhr-chrome.js` `C` (§3).

##### parseTok(raw)
- Rule: split on `|`; return `{ ar: parts[0], word: parts[1] || null, gram: parts[2] || '' }`.

##### OCC — occurrences in BOOK
- Rule: for every chapter `ci`, passage `pi`, token `ti` of BOOK, if the token has a word id, push `{ ci, pi, ti, gram, ar }` onto `OCC[wordId]`.
- Computed: 32 of 35 words occur; `alima`, `qawm`, `qayyum` never occur in BOOK.
- UI: Reader "In this text" section ("N occurrences of X in this book, with the inflection recorded for each", rows "Ch. N · passage M · gram"), selected-token inflection line ("dictionary form" when none), wazn view "N in this book" and the "In this book" filter, review reveal meta "N in this book", graph seed "Sentence" row count.

##### lexEntry(w, root, dict) — placeholder article generator
- Returns `{ id: dict.id + ':' + w.id, dict, text }` — i.e. the design assumes one article per (dictionary, word).
- If `dict.kind === 'english'`: `w.ar + ' ' + w.tr + ' — ' + w.en + '. '` + senses joined as `"1. s1 === 2. s2"` + `'. (Placeholder article standing in for the lexicon text, so the layout can be judged at a realistic length.)'`; if `dict.id === 'lane'` additionally appends a fixed English paragraph that interpolates `root.bare`, `root.en`, and `w.form` ("The root X is said to signify, primarily, …; … some treat it as the measure <form>, others as a noun of place …").
- Else if `dict.kind === 'root'` (Maqayis): `'(' + root.bare + ') أصلٌ صحيحٌ يدلُّ على ' + root.arGist + '، ومن ذلك ' + w.ar + ': ' + w.arDef + '. والبابُ كلُّه راجعٌ إلى هذا المعنى عندَ التحقيق.'` — this is a faithful imitation of Ibn Fāris's formula, which is why `arGist` must be a phrase that follows "يدل على".
- Else (all other Arabic lexica): `w.ar + ': ' + w.arDef + '، وهو من ' + root.bare + '، ومعناه عندَ أهلِ اللغةِ ' + root.arGist + '. ويقالُ: ' + w.ar + ' على ' + w.senses.length + ' أوجهٍ، أوَّلُها ما ذكرناه.'`; if `dict.id === 'lisan'` additionally appends a long fixed paragraph (al-Aṣmaʿī vs Abū Zayd, ḥadīth, etc.) interpolating `root.bare` and `root.arGist`.
- Then padding: `reps = 1 + ((w.id.length + dict.id.length) % 4)`; for `i` in `0..reps-1` append `' ' + TAILS[(i + dict.id.length) % 5]`.
- Computed for `ilm`: article lengths ayn 357, tahdhib 360, sihah 209, maqayis 361, mufradat 429, lisan 777, qamus 209, taj 357, lane 1309 characters.
- UI: Reader Lexica section in three modes — "One by one" cards (Arabic name, English name, tag, "author · d. year", collapsible body with "Show more · N characters · ~N words", copy, "queue as description card", footer "placeholder entry · dummy data for layout"), "Side by side" compare grid, "Apparatus"; Data & API `/lexica/{id}/{root}` (first 400 chars).

##### TOPICS
- `['Knowledge', 'Writing', 'Teaching', 'The library', 'Uprightness']`. A fixed English topic taxonomy; the Reader's passage "Topic" drawer lets the user tag a passage with any of these (stored per passage key in Reader state). Needs a real taxonomy (and Arabic labels).

##### CORPORA
- `[{ id: 'poetry', label: 'Pre-Islamic poetry', y: 580 }, { id: 'quran', label: 'Qurʾān', y: 632 }, { id: 'hadith', label: 'Ṣaḥīḥ al-Bukhārī', y: 846 }]`. `y` = representative year for the timeline. UI: timeline lane markers, green "attested" squares per sense, streams view, "N lexica · 3 corpora · N senses" meta.

##### TL_MIN, TL_MAX, tlX
- `TL_MIN = 550`, `TL_MAX = 1920`; `tlX(y) = (y − 550) / (1920 − 550) × 100` (percent across the timeline). Computed positions: poetry 2.2, quran 6.0, hadith 21.6, ayn 17.2, tahdhib 31.4, sihah 33.1, maqayis 33.1, mufradat 40.7, lisan 55.5, qamus 63.1, taj 90.6, lane 98.0. Ticks drawn at 600, 800, …, 1800 ("1800 CE").

##### dictAttests(w, i, j) — FAKE sense×dictionary matrix
- Rule: `i === 0 || ((j * 7 + i * 3 + w.id.length) % 3) !== 0` — sense 1 is always attested by every dictionary; other senses by a hash of indices.
- Example (`ilm`): sense 1 → all 9; sense 2 → tahdhib, sihah, mufradat, lisan, taj, lane.
- UI driven by it: sense meta "reviewed · sources: <first 3 attesting dictionaries>", Sources tab count, "Old dictionaries — N say something", compare grid cells (attesting cell shows the sense text, else "—"; row note "all agree" / "none of these" / "<Dict> only" / list of short names; single-source cell tinted), apparatus spans and notes, timeline dots and "first in <Dict> (<year>)", citation "Sources" list (`attestedIn(0).slice(0,3)` → "<author>, <Dict>, s.v. <root>"), Data & API `senses[].sources` (first 4).

##### corpusAttests(w, i, c) — FAKE sense×corpus matrix
- Rule: `(i === 0 && c === 1 && w.freq > 20) || ((c * 5 + i * 2 + w.freq) % 3) === 0` — sense 1 is attested in the Qurʾān when freq > 20, otherwise hash.
- UI: timeline green squares per sense (hint "<corpus> · attested (placeholder)"; click toasts "corpus attestations arrive with phase 2"), streams view counts.

##### SENSE_COLORS
- `['var(--c-root)', 'var(--c-form)', 'var(--c-word)', 'var(--c-sentence)', 'var(--c-desc)']`; sense `i` gets `SENSE_COLORS[i % 5]` as its band colour in the timeline "Streams" view. Purely presentational.

##### stripDia(t)
- Rule: remove `[ً-ْٰـ]` (tanwīn, ḥarakāt, shadda, sukūn, superscript alef, tatweel), then fold `[أإآ]` → `ا`. Does NOT fold ى, ة, ٱ, ئ, ؤ and does NOT remove Quranic marks.
- Separate helper in the Reader, `stripHarakat`, removes `[ً-ْٰ]` without folding — used for the tashkīl-off display.

##### P_KEY, P_REF, P_ROOTS, ALL_PASSAGES
- `P_KEY(ci, pi) = ci + '.' + pi` (e.g. `"0.2"`); `P_REF(ci, pi) = 'Ch. ' + (ci+1) + ' · passage ' + (pi+1)`; `P_ROOTS(ps)` = unique roots of the tagged tokens, in first-appearance order.
- `ALL_PASSAGES` = BOOK passages only (not scripture) as `{ ci, pi, ps, key, ref, short: '(ci+1)·(pi+1)', roots }`. Computed: 1·1 qra,ktb · 1·2 ktb,jls,ilm,qwm · 1·3 ktb,qwm · 1·4 ktb,qra,qwm · 2·1 ilm,drs,qwm,qra · 2·2 qra,drs · 2·3 drs,jls,ilm · 3·1 ilm · 3·2 jls,drs · 3·3 ktb,qra,qwm,ilm.
- UI: related passages drawer, link picker, review context cards, Data & API `/concordance`.

##### SCRIPTURE — Qurʾān and Bukhārī samples
- Shape: `[{ id, ar, en, kind, chapters: [{ ar, en, meta, passages: [{ ref, tr, en, toks }] }] }]`. `kind` is a display string (`'Qurʾān'`, `'Ḥadīth'`); `meta` e.g. `'Medinan · 286 verses'`, `'The Book of Knowledge · 76 ḥadīth'`; `ref` e.g. `'2:31'`, `'Bukhārī 71'`.
- Qurʾān: al-Baqara (2:31, 2:32, 2:255) and Ṭā Hā (20:114). Bukhārī: Kitāb al-ʿIlm (71, 79). 60 tokens, 8 tagged. Verbatim in §2.7.
- Sample quality notes: `tr` is often only the first clause while `toks` is the full verse (2:31) or a partial verse (2:255); English is a free rendering; `الْعَلِيمُ` is mis-tagged to `alim`.

##### SCRIPT_OCC — attestations
- Rule: for each scripture book → chapter → passage → tagged token, push `{ book: b.id, bookEn: b.en, kind: b.kind, ref: p.ref, ar: <whole passage surface joined by spaces>, en: p.en, gram: t.gram, surface: t.ar, chapter: c.en }` onto `SCRIPT_OCC[wordId]`.
- Computed: allama 2 (2:31, 2:32), ilm 4 (2:32, 20:114, Bukhārī 71, Bukhārī 79), alim 1 (2:32), qayyum 1 (2:255).
- UI: Reader "Across the centuries → scripture" list (book filter chips "All N" / "<book> N", surface-form chips "<surface> N", rows ref · chapter · gram · Arabic · English, "Read in place"), empty state "Not attested in the loaded scripture samples — the full Qurʾān and Ṣaḥīḥ al-Bukhārī arrive with phase 2.", sibling fallback ("same root, attested: <word> N"), next-steps "A verse" door, Ask "Heard in" card, Sources tab count.

##### KEYS, load, save — storage
- `KEYS = { prefs: 'jadhr-prefs', states: 'jadhr-word-states', marks: 'jadhr-marks', notes: 'jadhr-notes', progress: 'jadhr-progress', texts: 'jadhr-texts', sessions: 'jadhr-sessions', context: 'jadhr-context', account: 'jadhr-account', proposals: 'jadhr-proposals', graphs: 'jadhr-published', onboarded: 'jadhr-onboarded' }`.
- `load(k, d)`: JSON-parse `localStorage[k]`, return `d` when null/undefined or on any error. `save(k, v)`: JSON-stringify into localStorage, swallow errors. Shapes and inconsistencies in §3.3.

##### AFFIX_PRE / AFFIX_SUF (internal)
- Prefixes, in priority order: وَ conj. · فَ conj. · بِ prep. · لِ prep. · كَ prep. · ال def. art. · سَ future · يُ impf. 3 m. · passive · يَ impf. 3 m. · تَ impf. 2/3 f. · نَ impf. 1 pl. · أَ impf. 1 sg. · مُ participle · مَ noun of place / pass. part. · اِسْتَ Form X.
- Suffixes, in priority order: ُونَ m. pl. nom. · ِينَ m. pl. obl. · َاتِ f. pl. · َاتُ f. pl. · ُهُ + his · ُهَا + her · ُهُمْ + their · ِهِ + his · نِي + me · نَا + us · ةً f. acc. · ةٌ f. nom. · ةِ f. gen. · ةُ f. · ةَ f. · ً acc. indef. · ٌ nom. indef. · ٍ gen. indef. · َ acc. · ُ nom. · ِ gen. · ْ juss.

##### analyse(surface) — heuristic morphology
- Step 1: `clean` = surface with `، . : ؛ ! ؟` removed; `bare = stripDia(clean)`; `hasArt` = bare matches `^(و|ف|ب|ل|ك)?ال`.
- Step 2 (lexicon hit): `hits` = WORDS whose stripped `ar` equals `bare`, or `bare` minus a leading ال, or `bare` minus an optional و/ف/ب/ل/ك plus ال. If any: when `hasArt`, prefer the first non-verb hit, else the first hit.
- Step 3 (segmentation): try each AFFIX_PRE in order; the first whose stripped form starts the stripped core, with stripped core length > stripped prefix length + 1, becomes a `{ t, g, kind: 'pre' }` segment and `core = core.slice(prefix.length)`; stop after one. Then try each AFFIX_SUF in order on the unstripped core (`endsWith`, core length > suffix length + 1); first match becomes `{ kind: 'suf' }` and is removed. Push `{ t: core, g: 'stem', kind: 'stem' }`, then the suffix. At most one prefix and one suffix.
- Step 4 (root candidates): `stemBare` = stripped core minus leading ال; `skel` = stemBare minus ا و ي. For each root: score 0.92 if `skel === root.bare`; else if every root letter occurs in stemBare and `stemBare.length <= root.length + 3`, score `0.7 − 0.05 × (stemBare.length − root.length)`; else if exactly 2 root letters occur, 0.3; else 0. Keep score > 0, sort descending, top 3. If there was a lexicon hit, prepend `{ root: hit's root, score: 0.99, word: hit }`. Dedupe by root key keeping the first.
- Step 5 (pattern): the hit's `form`; else by prefix: مَ → مَفْعُول, مُ → مُفَعِّل, any of ي ت ن أ → يَفْعَلُ, otherwise فَعَلَ.
- Step 6: `gram` = non-stem segment glosses joined by " · ", else the hit's `pos`, else `'unanalysed'`. Return `{ surface: clean, segments, candidates, word, pattern, gram, confidence: top candidate score or 0 }`.
- Known defects (verified by running it): يُ is always chosen over يَ (and مُ over مَ) because both strip to the same letter, so `يَجْلِسُ` is labelled "impf. 3 m. · passive" and `مَدَارِس` "participle"; on undiacritised input the prefix slice removes 2 characters for a 1-letter prefix (`كتاب` → prefix كَ, stem اب); fallback pattern for `عِلْمًا` / `الْعَلِيمُ` is فَعَلَ. Do not port the heuristic; QAC segmentation replaces it for Quran text (09 §9.5 agrees).
- UI: Reader unknown-word popover (segments, "gram · pattern X", up to 3 candidate roots with scores, "Propose an entry", "Open in Analyser"), Ask "analyse it" fallback, Analyser table/interlinear (segments RTL, root, pattern, analysis, confidence colour ≥0.8 green else amber, CoNLL-U export `Root=…|Pattern=…`), Library paste preview (matched / review 0.6–0.95 / unknown), user-text tokenisation in Reader and Concordance, Data & API `/analyse`.

#### 1.B Content the brief asked about that lives outside `lexicon-data.js`

##### GLOSSARY (Reader v5, `const GLOSSARY`) — 29 terms
- Shape: `key → [label, category, plain text, jumpTarget|null]`. Categories: grammar, writing, sources, meaning. Jump targets map to buttons: patterns → "Show me the shapes", lexica → "Show the dictionaries", timeline → "Show where it appears", family → "Show the family", senses → "Show the meanings".
- Matching: `GLOSS_RE` = case-insensitive `\b(<keys sorted longest first>)\b`; applied to pattern function texts, grammar strings, family/pattern headers when "Explain terms" is on (default on, persisted). Card shows label, "<category> term", plain text, jump button, and "Turn off explanations". Verbatim list in §2.5.

##### Collections (`Collections.dc.html`, `const SETS`) — 4 curated sets
- Shape: `{ id, title, color, intro, why, roots, pick(w) }`; items = `WORDS.filter(pick).slice(0, 8)`. Verbatim in §2.8 with computed membership.
- Card shows title, "N words · M roots", first 3 Arabic items, progress ("new" / "K of N met", green when all met, amber when some). Set view shows numbered items (Arabic, English, `tr · function`, root), "Open" (→ Reader `?mode=ask&q=<tr>`), "Keep" cycle (none → learning → known → none, saved to `jadhr-word-states`), "Why this set", root chips (→ Concordance), "See the set as a map" (Editor seed), "Review kept words".
- "Your progress": words met = number of keys in word-states; "K known · L learning · R roots touched"; "No streaks, no guilt — the words wait."

##### Word of the day (`Collections.dc.html`)
- Rule: `day = floor(Date.now() / 86_400_000)` (UTC day number); word = `WORDS[day % WORDS.length]`. Deterministic, same for everyone, rolls over at UTC midnight. For 2026-10-02: day 20728, index 8 → `darasa`.
- Fields shown: `ar`, `tr — en`, date ("2 Oct", locale), blurb = `(senses[1] ? 'Also: ' + senses[1] + '. ' : '') + 'Built on ' + root.tr + ' — ' + root.en + '.'`, label "root <root.ar>", link to Ask. 08 wants `GET /word-of-the-day?date=` deterministic by date.

##### Next steps (Reader v5, `nextDoors`) — "three doors"
- Door 1 "A cousin" (word colour): first word of the same root, not the current word, not yet in the user's trail; else first word of the same root other than the current one. Text: `cousin.en + ' — same root, ' + (same pattern ? 'same shape' : 'shaped as ' + function.toLowerCase())`.
- Door 2 "A verse" (sentence colour): first SCRIPT_OCC entry for the word → shows `ref` and the first 70 chars of its English in quotes; opens the Sources section filtered to that book. If none: "In the text" → first passage in any loaded book containing the word → shows ref and first 80 chars of English; scrolls there.
- Door 3 "The shape" (form colour): the word's pattern; text `function + (siblings ? ' — N more like it: ' + first 3 sibling Arabic joined by '، ' : '')` where siblings = same pattern, different root; opens the pattern view.
- Output is `doors.slice(0, 3)`. 08 requires `next_steps` computed server-side and deterministically; note the prototype's door 1 depends on the user's trail, which is not deterministic.

##### Difficulty (Reader v5 contents rail; Library shelf)
- Prototype rule is per CHAPTER and personalised: `ids` = all tagged token word ids in the chapter (with repeats); `kn` known, `lr` learning, `nw = ids − kn − lr`; `pct = round(kn / ids × 100)` (100 if no ids); label `pct ≥ 90 → 'easy'`, `≥ 75 → 'comfortable'`, else `'stretch'`; meta line `'<label> · <nw> new · <newRoots> new roots · ~<max(1, round(ids/8))> min'`; bar segmented known / learning / new.
- Library shelf uses the same idea per book: `% known` coloured ≥90 green, ≥75 amber, else red; progress % = `((ch + (pi+1)/passagesInChapter) / chapters) × 100`.
- 07/08 instead specify a stored `passages.difficulty smallint 1–5`; 10-open-questions lists the formula as undecided. These are two different features (objective passage difficulty vs personalised readiness).

##### Other derived logic the UI depends on (Reader v5 unless noted)
- Ask matching: query normalised to chat translit (3→ʿ, 2→ʾ, aa→ā, ii→ī, uu→ū); exact = stripped Arabic equal (with or without ال) or translit equal; loose = Arabic substring (≥2 chars), translit substring, English substring, or 3-letter query equal to root bare; rank = `(verb ? 1 : 0) − min(0.9, freq/200)` (nouns before verbs, frequent first). Hint label: Arabic with/without vowels, transliteration, or English. Try-chips: علم · knowledge · 3ilm · كتاب · مدرسة.
- Ask cards (phone): Meaning (headword, en, tr · pos, "Also: senses 2..n", play, save), Cousins (root, root en, up to 3 family words), Heard in (first scripture occurrence else first passage, play), The shape (pattern, function, translit, "N words in the lexicon share it").
- Omnibox: Roots (bare equal, translit equal, English substring, or bare substring ≥2), Words (≤5), Patterns (≤2), In texts (≤5; Arabic substring, exact ref like "2:255", English substring). Detected label: verse reference / Arabic with tashkīl / root letters? / no tashkīl / root transliterated / transliteration / English.
- Related passages: other BOOK passages sharing ≥1 root, sorted by shared-root count, top 4.
- Page roots rail: counts of tagged tokens per root in the current chapter, bars relative to max.
- Root-family tint: tokens whose word's root equals the open word's root (or the focused root) get a solid underline; word-state tint: learning → amber background, new → blue underline.
- Selecting a word: auto-sets its state to `learning`, appends to trail (max 40), records progress `{ch, pi, at}`, logs session, writes `jadhr-context`.
- Review deck (unit = root family): queue = roots of starred words, else roots on the current chapter; Root card reveals each family member (Arabic, tr, en, hint "function — pos"); In-context card picks the BOOK passage with the most tokens of that root, blanks them, accepts answers compared with `stripDia`, grades "Knew all" / "Partial" / "Forgot".
- Apparatus colour: share = attesting dictionaries other than base; ≥ 0.6 × 8 → green, ≥ 1 → amber, 0 → red ("Unique to <base> — this sense first appears here.").
- Timeline streams: cumulative per-sense source counts at each source year, stacked bands, label "N sources by 1900".
- Concordance (`Concordance.dc.html`): hits = every token in BOOK + SCRIPTURE + user texts whose word's root = selected root; left/right context = rest of the passage; sort by stripped right context, reversed left context, or source, with `localeCompare(…, 'ar')`; form chips by surface lemma; distribution "hits · hits per 100 tokens" per text; collocates = 2 tokens either side, stripped, length > 2, top 14 sized by count; CSV export.
- Search (`Search.dc.html`): detect verse ref, Arabic root letters (3 chars, no vowels), Arabic with/without tashkīl, transliterated root `x-y-z`, pattern via chat translit, transliteration (diacritic letters), else English; three-letter root builder filters roots whose `bare` includes every entered letter; kinds facet Words/Roots/Patterns/Passages; sources facet per text.
- Analyser page: function-word regex `^(و|ف|في|من|الى|على|لا|ما|ان|الا|ثم|هو|هي|كان|انما|كل|هنا|حين|بين|لم|قد|عن|ذي|لنا|به|فيه|انك|انت)$` → "particle — not segmented", confidence 1; lexicon hit → 0.99; else top candidate score; < 0.8 → "to review".
- Classroom heat-map (`Classroom.dc.html`): FAKE — lookups per word = `base(freq<10→9, <20→5, else 2) + hash(id)%5 − 2`; notes and time also hashed. Real version needs `lookup_events`.
- Citation (Reader): permalinks `jadhr.org/w/<id>`, `/r/<key>`, `/p/<book>/<ci.pi>`, dataset `v2026.09`, formats Chicago/APA/MLA/BibTeX, license `CC-BY-SA-4.0`, sources "<author>, <Dict>, s.v. <root>".

#### 1.C Lexicon Editor v5 — its own content model (not from `lexicon-data.js`)
- Card types: root (جَذْر), form (وَزْن), word (كَلِمَة), sentence (جُمْلَة), description (وَصْف); allowed children root→form/sentence/description, form→word/sentence/description, word→sentence/description, sentence→description, description→any.
- Own ROOTS: `{ ar, tr, en, note, forms: [{ ar, tr, en, words: [{ ar, tr, en, pos }] }] }` — includes an English `note` paragraph per root (curated), extra words not in WORDS (كَاتِبَة, تَدْرِيس), and a pseudo-root `ف ي` for the particle فِي ("particle — no pattern").
- Own SENTS: `{ ar, tr, en, ment: [translit…], src: 'Modern Standard'|'Colloquial'|'Literary'|'Proverb' }`.
- Typed card fields seeded per type: root → Semantic field (tags), Attestations (number); form → Productivity (common/restricted/rare); word → Part of speech (noun/verb/adjective/particle), Pronunciation (audio); sentence → Source (text), Register (formal/neutral/literary/colloquial); description → Body (notes). Field kinds available: text, notes, number, select, tags, audio, image, file, link, date.
- Seeds from other pages arrive as base64 JSON `{ words: [{ ar, tr, en, pos, form: { ar, tr, en }, root: { ar, tr, en } }], sentence: { ar, tr, en, src } | null }`.

---

### 2. Verbatim content tables

#### 2.1 FORM_META — all 21 patterns

"Form no." is parsed from the function text (there is no field). "Plain-language text" is what the Reader shows: the GLOSSARY term(s) its `GLOSS_RE` finds inside the function text (full text of each term in §2.5). "Slug per 08 convention" applies the convention implied by 08's examples (`maf3ala`, `fi3al`, `fa33ala`: ʿ→3, macrons dropped) — it is not in the prototype, and it collides.

| # | Key (Arabic) | Translit | Function text (verbatim) | Form no. | Plain-language text reached via glossary | Slug per 08 convention | Words using it |
|---|---|---|---|---|---|---|---|
| 1 | فَعَلَ | faʿala | Form I — base verb | I | Form I | fa3ala (COLLIDES with #17) | kataba, darasa, qaraa, jalasa, qama |
| 2 | فَعِلَ | faʿila | Form I — stative verb | I | Form I | fa3ila | alima |
| 3 | فَعَّلَ | faʿʿala | Form II — causative verb | II | Form II | fa33ala | darrasa, allama |
| 4 | أَفْعَلَ | afʿala | Form IV — causative verb | IV | Form IV | af3ala | aqama |
| 5 | فَاعِل | fāʿil | active participle | — | Active participle | fa3il | katib, alim, qari, jalis |
| 6 | مُفَعِّل | mufaʿʿil | Form II participle | II | Form II | mufa33il | mudarris, muallim |
| 7 | مُسْتَفْعِل | mustafʿil | Form X participle | X | Form X | mustaf3il | mustaqim |
| 8 | مَفْعُول | mafʿūl | passive participle | — | Passive participle | maf3ul | maktub |
| 9 | مَفْعُولَة | mafʿūla | passive participle (fem.) | — | Passive participle | maf3ula | maluma |
| 10 | مَفْعَل | mafʿal | noun of place | — | Noun of place | maf3al | maktab |
| 11 | مَفْعِل | mafʿil | noun of place | — | Noun of place | maf3il | majlis |
| 12 | مَفْعَلَة | mafʿala | noun of place (fem.) | — | Noun of place | maf3ala | maktaba, madrasa |
| 13 | فِعَال | fiʿāl | verbal noun | — | Verbal noun (maṣdar) | fi3al | kitab, qiyam |
| 14 | فِعَالَة | fiʿāla | verbal noun (fem.) | — | Verbal noun (maṣdar) | fi3ala | kitaba, dirasa, qiraa |
| 15 | فَعْل | faʿl | verbal noun | — | Verbal noun (maṣdar) | fa3l | dars, qawm |
| 16 | فِعْل | fiʿl | verbal noun | — | Verbal noun (maṣdar) | fi3l | ilm |
| 17 | فَعَالَة | faʿāla | noun of quality | — | NONE | fa3ala (COLLIDES with #1) | alama |
| 18 | فَاعَل | fāʿal | noun | — | NONE | fa3al | alam |
| 19 | فَعُّول | faʿʿūl | intensive noun | — | NONE | fa33ul | qayyum |
| 20 | تَفْعِيل | tafʿīl | Form II verbal noun | II | Form II + Verbal noun (maṣdar) | taf3il | talim |
| 21 | مُفَاعَلَة | mufāʿala | Form III verbal noun | III | Verbal noun (maṣdar) only — no "Form III" glossary term | mufa3ala | mukataba |

- Not in FORM_META but referenced: `يَفْعَلُ` (analyse fallback for prefixes ي ت ن أ). GLOSSARY defines "Form V" which no pattern uses.
- Content oddities to correct in real data: `قَوْم` filed as a verbal noun on فَعْل; `عَالَم` on "فَاعَل — noun"; `قَيُّوم` on "فَعُّول" (classically فَيْعُول); `مَعْلُومَة` is modern usage; `مَكْتَبَة`, `مَدْرَسَة`, `مُدَرِّس`, `دِرَاسَة` are largely post-classical — fine for a demo, irrelevant for a Quran build.

#### 2.2 ROOTS — all 6

| key | ar (spaced) | bare | tr | en (gloss) | arGist (completes "يدلُّ على …") | corpus | words in WORDS |
|---|---|---|---|---|---|---|---|
| ktb | ك ت ب | كتب | k-t-b | writing, inscribing, setting down | الخطِّ والرسمِ وجمعِ الشيء إلى الشيء | 319 | 8 |
| drs | د ر س | درس | d-r-s | studying, wearing a path by repetition | إعادةِ الشيء حتى يُعرَف، ومنه الدَّرْسُ | 144 | 6 |
| ilm | ع ل م | علم | ʿ-l-m | knowing, marking, signposting | الأثرِ والعلامةِ يُستدَلُّ بها | 854 | 9 |
| qra | ق ر أ | قرأ | q-r-ʾ | reading, gathering into recitation | جمعِ الحروفِ وإخراجِها نُطقًا | 88 | 3 |
| jls | ج ل س | جلس | j-l-s | sitting, being seated | القعودِ ولزومِ الموضع | 41 | 3 |
| qwm | ق و م | قوم | q-w-m | standing, rising, upholding an affair | الانتصابِ والعزمِ وتولِّي الأمر | 660 | 6 |

- The figures 854 (ع ل م), 660 (ق و م), 319 (ك ت ب), 88 (ق ر أ) look like Quranic root counts; 144 (د ر س) and 41 (ج ل س) cannot be (both roots are rare in the Quran). Treat all as placeholders and recompute from our corpus.

#### 2.3 WORDS — all 35

Columns: in-book = OCC count, in-scripture = SCRIPT_OCC count.

| # | id | ar | tr | en | pos | root | form | arDef | freq | senses | in-book | in-scripture |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | kataba | كَتَبَ | kataba | he wrote | verb | ktb | فَعَلَ | خطَّ الحرفَ بالقلمِ وأثبتَه | 43 | 1. to write, set down in writing · 2. to prescribe, ordain, make binding · 3. to enrol or register a name | 2 | 0 |
| 2 | katib | كَاتِب | kātib | writer, clerk, scribe | noun | ktb | فَاعِل | مَن يتولَّى الكتابةَ صناعةً | 12 | 1. one who writes; an author · 2. a secretary or registrar of accounts | 1 | 0 |
| 3 | maktub | مَكْتُوب | maktūb | written; a letter | participle | ktb | مَفْعُول | ما أُثبِتَ خطًّا، والرسالةُ نفسُها | 9 | 1. written, inscribed · 2. a letter or written notice · 3. decreed, appointed beforehand | 1 | 0 |
| 4 | maktab | مَكْتَب | maktab | desk, writing place, office | noun | ktb | مَفْعَل | موضعُ الكتابة | 6 | 1. the place where one writes · 2. an office or bureau | 1 | 0 |
| 5 | maktaba | مَكْتَبَة | maktaba | library, bookshop | noun | ktb | مَفْعَلَة | موضعُ الكتبِ وجمعُها | 7 | 1. a collection of books; a library · 2. a shop where books are sold | 2 | 0 |
| 6 | kitab | كِتَاب | kitāb | book; writing | noun | ktb | فِعَال | المكتوبُ المجموعُ بين لوحين | 38 | 1. a book, a written volume · 2. a written decree or prescription · 3. a letter sent to someone | 2 | 0 |
| 7 | kitaba | كِتَابَة | kitāba | writing, script, the craft of writing | noun | ktb | فِعَالَة | صناعةُ الخطِّ وحرفتُه | 11 | 1. the act or art of writing · 2. a script or hand | 2 | 0 |
| 8 | mukataba | مُكَاتَبَة | mukātaba | correspondence | noun | ktb | مُفَاعَلَة | أن يكتبَ كلُّ واحدٍ إلى صاحبِه | 4 | 1. an exchange of letters between two parties · 2. a written contract of manumission | 1 | 0 |
| 9 | darasa | دَرَسَ | darasa | he studied | verb | drs | فَعَلَ | أعادَ الشيءَ حتى حفظَه، وأصلُه أن يُعفَى الأثرُ بالوطء | 17 | 1. to study, to learn by repetition · 2. to efface or wear away by treading | 2 | 0 |
| 10 | darrasa | دَرَّسَ | darrasa | he taught | verb | drs | فَعَّلَ | جعلَ غيرَه يدرُسُ ويُعيدُ | 8 | 1. to teach, to make another study | 1 | 0 |
| 11 | mudarris | مُدَرِّس | mudarris | teacher, instructor | noun | drs | مُفَعِّل | مَن يتولَّى تدريسَ غيرِه | 6 | 1. one who teaches a set lesson · 2. a lecturer in a school | 1 | 0 |
| 12 | madrasa | مَدْرَسَة | madrasa | school | noun | drs | مَفْعَلَة | موضعُ الدراسةِ ومجتمعُ الطلبة | 9 | 1. the place where study is done · 2. a school of thought or method | 1 | 0 |
| 13 | dars | دَرْس | dars | lesson | noun | drs | فَعْل | ما يُعادُ من العلمِ مرَّةً بعد مرَّة | 10 | 1. a lesson or portion recited · 2. a trace worn away | 1 | 0 |
| 14 | dirasa | دِرَاسَة | dirāsa | study, sustained reading | noun | drs | فِعَالَة | مداومةُ النظرِ في العلم | 7 | 1. the act of studying · 2. a course of learning | 1 | 0 |
| 15 | alima | عَلِمَ | ʿalima | he knew | verb | ilm | فَعِلَ | أدركَ الشيءَ على ما هو به | 35 | 1. to know, to be aware of · 2. to perceive by a mark or sign | 0 | 0 |
| 16 | allama | عَلَّمَ | ʿallama | he taught | verb | ilm | فَعَّلَ | جعلَ غيرَه عالِمًا، ووضعَ له العلامة | 14 | 1. to teach, to make known to another · 2. to mark something with a sign | 1 | 2 |
| 17 | ilm | عِلْم | ʿilm | knowledge, science | noun | ilm | فِعْل | إدراكُ الشيءِ بحقيقتِه | 53 | 1. knowledge, certain apprehension · 2. a branch of learning | 3 | 4 |
| 18 | alim | عَالِم | ʿālim | scholar, one who knows | noun | ilm | فَاعِل | مَن قامَ به العلمُ | 15 | 1. a learned person · 2. knowing, informed of a thing | 1 | 1 |
| 19 | alam | عَالَم | ʿālam | world, created order | noun | ilm | فَاعَل | كلُّ ما سوى الخالق، وسُمِّيَ لأنه علامةٌ على صانعِه | 21 | 1. the world; all created things · 2. an age or a realm of beings | 1 | 0 |
| 20 | muallim | مُعَلِّم | muʿallim | teacher | noun | ilm | مُفَعِّل | مَن يتولَّى التعليم | 5 | 1. one who teaches · 2. a master of a craft | 1 | 0 |
| 21 | talim | تَعْلِيم | taʿlīm | teaching, instruction | noun | ilm | تَفْعِيل | إيصالُ العلمِ إلى المتعلِّم | 4 | 1. the act of instructing · 2. education as a practice | 1 | 0 |
| 22 | alama | عَلَامَة | ʿalāma | mark, sign, token | noun | ilm | فَعَالَة | ما يُستدَلُّ به على غيرِه | 8 | 1. a sign or distinguishing mark · 2. a landmark set up on a road | 1 | 0 |
| 23 | maluma | مَعْلُومَة | maʿlūma | a piece of information | noun | ilm | مَفْعُولَة | ما صارَ معلومًا مِن خبرٍ أو أثر | 3 | 1. a thing known; a datum · 2. a fixed or appointed amount | 1 | 0 |
| 24 | qaraa | قَرَأَ | qaraʾa | he read, he recited | verb | qra | فَعَلَ | جمعَ الحروفَ وتلا بها | 18 | 1. to read, to recite aloud · 2. to gather or collect together | 2 | 0 |
| 25 | qari | قَارِئ | qāriʾ | reader, reciter | noun | qra | فَاعِل | مَن يقرأُ ويُحسِنُ التلاوة | 6 | 1. one who reads · 2. a trained reciter | 1 | 0 |
| 26 | qiraa | قِرَاءَة | qirāʾa | reading, recitation | noun | qra | فِعَالَة | فعلُ القارئِ وصنعتُه | 9 | 1. the act of reading aloud · 2. a received manner of reciting | 2 | 0 |
| 27 | jalasa | جَلَسَ | jalasa | he sat | verb | jls | فَعَلَ | قعدَ ولزِمَ موضعَه | 12 | 1. to sit down, to be seated · 2. to remain in a place | 2 | 0 |
| 28 | jalis | جَالِس | jālis | seated, sitting | participle | jls | فَاعِل | القاعدُ في موضعِه | 5 | 1. sitting, in a seated posture · 2. a companion who sits with one | 1 | 0 |
| 29 | majlis | مَجْلِس | majlis | council, sitting, assembly room | noun | jls | مَفْعِل | موضعُ الجلوسِ ومجتمعُ القوم | 8 | 1. the place where people sit · 2. a session or assembly · 3. a council of state | 2 | 0 |
| 30 | qama | قَامَ | qāma | he stood, he rose | verb | qwm | فَعَلَ | انتصبَ قائمًا، وتولَّى الأمرَ | 33 | 1. to stand up, to rise · 2. to undertake or attend to an affair · 3. to be upright, to endure | 3 | 0 |
| 31 | aqama | أَقَامَ | aqāma | he set up; he stayed | verb | qwm | أَفْعَلَ | أثبتَ الشيءَ قائمًا، ولزِمَ المكان | 54 | 1. to set up or establish · 2. to reside, to stay in a place · 3. to perform an obligation duly | 1 | 0 |
| 32 | qiyam | قِيَام | qiyām | standing, upholding | noun | qwm | فِعَال | الانتصابُ والقيامُ بالأمر | 22 | 1. the act of standing · 2. the upholding or management of a matter | 1 | 0 |
| 33 | qawm | قَوْم | qawm | a people, a company | noun | qwm | فَعْل | الجماعةُ من الناس يقومُ بعضُهم مع بعض | 383 | 1. a body of people · 2. a tribe or kinsfolk | 0 | 0 |
| 34 | qayyum | قَيُّوم | qayyūm | self-subsisting, sustainer of all | noun | qwm | فَعُّول | القائمُ بنفسِه المقيمُ لغيرِه | 3 | 1. self-subsisting, eternally standing · 2. the sustainer of all that is | 0 | 1 |
| 35 | mustaqim | مُسْتَقِيم | mustaqīm | straight, upright, unbroken | participle | qwm | مُسْتَفْعِل | ما استوى ولم يَعوَجّ | 37 | 1. straight, direct, without bend · 2. upright in conduct | 1 | 0 |

#### 2.4 DICTS — all nine

| idx | id | Arabic name | English name | Author (`by`) | d. (CE) | kind | tag | Do we have it? |
|---|---|---|---|---|---|---|---|---|
| 0 | ayn | كتاب العين | Kitab al-Ayn | al-Khalil ibn Ahmad al-Farahidi | 786 | earliest | earliest | No |
| 1 | tahdhib | تهذيب اللغة | Tahdhib al-Lugha | al-Azhari | 980 | general | general | No |
| 2 | sihah | الصحاح | al-Sihah | al-Jawhari | 1003 | general | selective | Yes |
| 3 | maqayis | مقاييس اللغة | Maqayis al-Lugha | Ibn Faris | 1004 | root | root-semantic | Yes |
| 4 | mufradat | المفردات | Mufradat al-Quran | al-Raghib al-Isfahani | 1108 | interpretive | interpretive | Yes |
| 5 | lisan | لسان العرب | Lisan al-Arab | Ibn Manzur | 1311 | general | comprehensive | Yes |
| 6 | qamus | القاموس المحيط | al-Qamus al-Muhit | al-Fayruzabadi | 1414 | general | concise | No |
| 7 | taj | تاج العروس | Taj al-Arus | Murtada al-Zabidi | 1791 | general | encyclopedic | No |
| 8 | lane | معجم لين | Lane's Lexicon | Edward William Lane | 1893 | english | english | Yes |

- Notes in the prototype: none (no `note`/`license`/`source_note`). 10-open-questions §1 adds copyright status per source (text public domain; modern critical editions and good digitisations carry their own terms) and says the side-by-side/apparatus views survive down to about four sources and should be hidden below that.
- We hold a sixth classical source the design has no row for: Ibn Qutaybah, Tafsīr Gharīb al-Qurʾān (d. 889 CE) — organised by sūra/verse, so it is a per-occurrence gloss, not a root article. It needs its own `kind` (e.g. `gharib`) and filter chip if shown.
- Editor v5 has its own DICTS copy with `{ id, ar, en, by, d, tag }` (no `kind`).

#### 2.5 GLOSSARY — all 29 (verbatim, from Reader v5)

| key | label | category | plain text | jump |
|---|---|---|---|---|
| root | Root | grammar | Three (sometimes four) consonants that carry a core idea. Arabic builds whole families of words from one root by pouring it into different shapes. | family |
| pattern | Pattern (wazn) | grammar | A mould. Drop a root into it and you get a word with a predictable job — the doer, the thing done, the place, the tool. Scholars call it a wazn. | patterns |
| wazn | Wazn | grammar | The Arabic word for pattern — literally “weight” or “measure”. Same thing as pattern here. | patterns |
| form i | Form I | grammar | The plain verb: “he wrote”, “he knew”. Every other verb form is a variation on it. | patterns |
| form ii | Form II | grammar | A verb made stronger or made to cause something: from “know” you get “teach” (make someone know). | patterns |
| form iv | Form IV | grammar | A verb that makes something happen: from “to be safe” you get “to submit / to make safe”. | patterns |
| form v | Form V | grammar | A verb turned on oneself: from “teach” you get “learn” (get yourself taught). | patterns |
| form x | Form X | grammar | A verb of asking or seeking: from “know” you get “to enquire”. | patterns |
| active participle | Active participle | grammar | The word for the one who does it. From “write” you get “writer”; from “know”, “one who knows”. Usually looks like فَاعِل. | patterns |
| passive participle | Passive participle | grammar | The word for the thing something was done to. From “write” you get “written”; from “know”, “known”. Usually looks like مَفْعُول. | patterns |
| verbal noun | Verbal noun (maṣdar) | grammar | The idea of the action as a thing: writing, knowing, learning. Scholars call it the maṣdar. | patterns |
| maṣdar | Maṣdar | grammar | The idea-word of a verb — “writing” from “to write”. English calls it a verbal noun. | patterns |
| noun of place | Noun of place | grammar | Where the action happens: from “write” you get “desk / office”; from “sit”, “council”. | patterns |
| perfect | Perfect | grammar | The done form of a verb — “he wrote”. Not about perfection; it just means finished. | — |
| imperfect | Imperfect | grammar | The ongoing form — “he writes / is writing”. Unfinished, hence the name. | — |
| accusative | Accusative | grammar | The ending a noun takes when it is the object of an action — the thing being written, known, seen. Often a fatḥa or -an. | — |
| nominative | Nominative | grammar | The ending a noun takes when it is the doer or the subject — usually a ḍamma. | — |
| genitive | Genitive | grammar | The ending after “of” or after a preposition — usually a kasra. | — |
| tashkīl | Tashkīl | writing | The small marks above and below letters that show the short vowels. Most everyday Arabic leaves them out. | — |
| lexicon | Lexicon | sources | A dictionary — here, one of the great classical Arabic dictionaries, written between the 8th and 14th centuries. | lexica |
| lexica | Lexica | sources | Dictionaries — the plural. This site lines up several classical ones so you can see where they agree. | lexica |
| attestation | Attestation | sources | A real place where the word actually appears — a verse, a saying, a line of a book. Evidence, not opinion. | timeline |
| apparatus | Apparatus | sources | A view that shows one dictionary’s wording and marks which parts the others share. Borrowed from how scholars compare manuscripts. | lexica |
| concordance | Concordance | sources | A list of every place a word appears, each shown with a few words on either side. | — |
| sense | Sense | meaning | One meaning of a word. “Knowledge” and “a mark, a sign” are two senses of the same root. | senses |
| gloss | Gloss | meaning | A short translation or explanation of a word. | — |
| transliteration | Transliteration | writing | Arabic written in Latin letters so you can read the sound — ʿilm, kitāb. | — |
| corpus | Corpus | sources | A body of texts that has been searched and counted — here, the texts loaded into the reader. | — |
| diacritics | Diacritics | writing | Another word for tashkīl — the vowel marks. | — |

- Missing for our data: Form III, VI–IX, XI–XII; فَعِيل / intensive; noun of quality; noun of instrument; elative; diptote; jussive/subjunctive; and every term in Arabic.

#### 2.6 BOOK passages (invented demo prose)

| ref | Arabic (surface) | translit | English |
|---|---|---|---|
| 1·1 | قَرَأْتُ فِي المَكْتَبَةِ كِتَابًا قَدِيمًا، فَوَجَدْتُ فِيهِ كِتَابَةً لَا يَعْرِفُهَا النَّاسُ. | qaraʾtu fī l-maktabati kitāban qadīman, fa-wajadtu fīhi kitābatan lā yaʿrifuhā n-nās | I read an old book in the library, and found in it a script that people no longer know. |
| 1·2 | وَكَانَ الكَاتِبُ جَالِسًا إِلَى مَكْتَبِهِ حِينَ كَتَبَ مَا كَتَبَ، وَالعِلْمُ عِنْدَهُ قِيَامٌ لَا قُعُودٌ. | wa-kāna l-kātibu jālisan ilā maktabihī ḥīna kataba mā kataba, wa-l-ʿilmu ʿindahū qiyāmun lā quʿūd | The writer was seated at his desk when he wrote what he wrote; for him knowledge was a standing, not a sitting. |
| 1·3 | مَكْتُوبٌ عَلَى بَابِ المَكْتَبَةِ: مَنْ أَقَامَ هُنَا قَامَ بِأَمْرِ نَفْسِهِ. | maktūbun ʿalā bābi l-maktabati: man aqāma hunā qāma bi-amri nafsih | Written above the library door: whoever settles here takes charge of his own affair. |
| 1·4 | وَالمُكَاتَبَةُ بَيْنَ القَارِئِ وَالكِتَابِ مُسْتَقِيمَةٌ لَا تَنْقَطِعُ. | wa-l-mukātabatu bayna l-qāriʾi wa-l-kitābi mustaqīmatun lā tanqaṭiʿ | The correspondence between reader and book runs straight, and is never cut off. |
| 2·1 | قَالَ المُعَلِّمُ: الدَّرْسُ لَيْسَ حِفْظًا، وَإِنَّمَا هُوَ دِرَاسَةٌ تَقُومُ عَلَى القِرَاءَةِ. | qāla l-muʿallimu: ad-darsu laysa ḥifẓan, wa-innamā huwa dirāsatun taqūmu ʿalā l-qirāʾa | The teacher said: a lesson is not memorising — it is a study that stands upon reading. |
| 2·2 | فَمَنْ قَرَأَ وَلَمْ يَفْهَمْ فَقَدْ دَرَسَ الطَّرِيقَ وَلَمْ يَسِرْ فِيهِ. | fa-man qaraʾa wa-lam yafham fa-qad darasa ṭ-ṭarīqa wa-lam yasir fīh | Whoever reads and does not understand has worn down the road without walking it. |
| 2·3 | وَفِي المَدْرَسَةِ مَجْلِسٌ يَجْلِسُ فِيهِ العَالِمُ، يُعَلِّمُ الطُّلَّابَ التَّعْلِيمَ الأَوَّلَ. | wa-fī l-madrasati majlisun yajlisu fīhi l-ʿālimu, yuʿallimu ṭ-ṭullāba t-taʿlīma l-awwal | In the school there is a hall where the scholar sits, teaching the students the first instruction. |
| 3·1 | العِلْمُ نُورٌ، وَالعِلْمُ عَلَامَةٌ، وَالمَعْلُومَةُ أَثَرٌ مِنْ آثَارِهَا. | al-ʿilmu nūrun, wa-l-ʿilmu ʿalāmatun, wa-l-maʿlūmatu aṯarun min āṯārihā | Knowledge is light; knowledge is a mark; and a piece of information is one of its traces. |
| 3·2 | يَجْلِسُ المُدَرِّسُ فِي المَجْلِسِ، وَيُدَرِّسُ مَا دَرَسَ. | yajlisu l-mudarrisu fī l-majlisi, wa-yudarrisu mā darasa | The instructor sits in the hall and teaches what he himself studied. |
| 3·3 | وَالكِتَابَةُ صِنَاعَةٌ، وَالقِرَاءَةُ عَادَةٌ، وَبَيْنَهُمَا يَقُومُ العَالَمُ. | wa-l-kitābatu ṣināʿatun, wa-l-qirāʾatu ʿādatun, wa-baynahumā yaqūmu l-ʿālam | Writing is a craft, reading is a habit, and between the two the world stands. |

- Chapter titles: 1 فِي المَكْتَبَة / In the Library · 2 الدَّرْسُ وَالطَّرِيق / The Lesson and the Road · 3 العِلْمُ عَلَامَة / Knowledge is a Mark.
- All `gram` strings used across BOOK + SCRIPTURE (18): verb · 1st sg. perfect · noun · genitive, definite · noun · accusative, indefinite · noun · nominative, definite · participle · accusative · noun · genitive + possessive · verb · 3rd sg. perfect · noun · nominative, indefinite · participle · nominative · verb · Form IV perfect · participle · fem. nominative · verb · 3rd fem. sg. imperfect · verb · 3rd sg. imperfect · verb · Form II imperfect · noun · accusative, definite · verb · Form II perfect · verb · Form II perfect + 2 pl. + 1 pl. obj. · adjective · intensive · nominative. Format: `<pos> · <features>`, English; the glossary lights up "perfect", "imperfect", "accusative", "nominative", "genitive" inside them.

#### 2.7 SCRIPTURE

| Book (id · ar · en · kind) | Chapter (ar · en · meta) | ref | translit (`tr`) | English (`en`) | tagged words |
|---|---|---|---|---|---|
| quran · القُرْآنُ الكَرِيم · The Qurʾān · Qurʾān | سُورَةُ البَقَرَة · al-Baqara · 2 · Medinan · 286 verses | 2:31 | wa-ʿallama Ādama l-asmāʾa kullahā | And He taught Adam the names, all of them; then He presented them to the angels and said: tell Me the names of these, if you are truthful. | allama |
| quran | (same) | 2:32 | qālū subḥānaka lā ʿilma lanā illā mā ʿallamtanā | They said: Glory be to You — we have no knowledge except what You have taught us; You are the Knowing, the Wise. | ilm, allama, alim (mis-tag: الْعَلِيمُ) |
| quran | (same) | 2:255 | Allāhu lā ilāha illā huwa l-ḥayyu l-qayyūm | God — there is no god but He, the Living, the Self-Subsisting… | qayyum |
| quran | سُورَةُ طه · Ṭā Hā · 20 · Meccan · 135 verses | 20:114 | wa-qul rabbi zidnī ʿilman | And say: my Lord, increase me in knowledge. | ilm |
| bukhari · صَحِيحُ البُخَارِي · Ṣaḥīḥ al-Bukhārī · Ḥadīth | كِتَابُ العِلْم · Kitāb al-ʿIlm · The Book of Knowledge · 76 ḥadīth | Bukhārī 71 | wa-innamā l-ʿilmu bi-t-taʿallum | …and knowledge comes only by learning. | ilm |
| bukhari | (same) | Bukhārī 79 | mathalu mā baʿathanī llāhu bihī mina l-hudā wa-l-ʿilm | The likeness of the guidance and knowledge God has sent me with is that of abundant rain… | ilm |

#### 2.8 CORPORA and curated collections

CORPORA (verbatim): `poetry` "Pre-Islamic poetry" y 580 · `quran` "Qurʾān" y 632 · `hadith` "Ṣaḥīḥ al-Bukhārī" y 846.

Collections — `SETS` in `Collections.dc.html` (verbatim text; membership computed by running each `pick` over WORDS):

| id | title | colour | intro | why | rule (`pick`) | items shown (max 8) |
|---|---|---|---|---|---|---|
| know | Ways of knowing | #a8682c | One root, ʿ-l-m, and the whole spectrum from a mark on the ground to the world itself. Watch how each shape changes the job of the word. | The single best demonstration of how Arabic builds meaning: same three letters, four shapes, four ideas that still rhyme. | `w.root === 'ilm'` (`roots: ['ilm']`) | عَلِمَ, عَلَّمَ, عِلْم, عَالِم, عَالَم, مُعَلِّم, تَعْلِيم, عَلَامَة — 9 match, `مَعْلُومَة` silently dropped by `slice(0, 8)` |
| doers | The ones who do it | #6f55c4 | Every word here is shaped as فَاعِل — the doer. Writer, scholar, reader, teacher: once you see the shape you can guess a hundred more. | Pattern recognition is the fastest win for a beginner. This set trains one pattern across many roots. | `w.form === 'فَاعِل'` | كَاتِب, عَالِم, قَارِئ, جَالِس (4 words, 4 roots) |
| places | Where it happens | #177a44 | Desk, school, council: the noun-of-place shape turns an action into the room it happens in. | Place nouns are everywhere in city signs and book titles; they are also the friendliest introduction to the مَفْعَل pattern. | form matches `^مَفْع[َِ]ل` OR `pos === 'place'` OR English matches `desk\|school\|council\|office\|place\|library` | مَكْتَب, مَكْتَبَة, مَدْرَسَة, مَجْلِس (4 words, 3 roots) |
| known | Words you may already know | #2f6ae0 | Kitāb, ʿilm, madrasa — words that travelled into Turkish, Persian, Urdu and Swahili. Meet them at home. | Recognition before learning: if a word already lives in your other languages, the root behind it is a free gift. | `tr` in kitāb, ʿilm, madrasa, kātib, ʿālim, maktab, dars, majlis, qalam, kalima | كَاتِب, مَكْتَب, كِتَاب, مَدْرَسَة, دَرْس, عِلْم, عَالِم, مَجْلِس (8 words, 4 roots); qalam and kalima are listed but absent from WORDS |

- 01-product-and-ia mentions a Collections "study swipe deck"; the built Collections page has none (the phone Ask view has four swipe cards instead).

---

### 3. `jadhr-chrome.js` — shared header model (and where the other "chrome" lives)

#### 3.1 What the file actually contains (all of it)
- Header comment: "Shared header model for Jadhr pages (data only — each page renders it from its template)."
- `NAV` — 11 `[label, href]` pairs in order: Read → `Lexicon Reader v5.dc.html` · Explore → `Collections.dc.html` · Library → `Library.dc.html` · Look up → `Lexicon Reader v5.dc.html?mode=lookup` · Concordance → `Concordance.dc.html` · Analyser → `Analyser.dc.html` · Graph → `Lexicon Editor v5.dc.html` · Notebook → `Notebook.dc.html` · Review queue → `Review Queue.dc.html` · Classroom → `Classroom.dc.html` · Data & API → `Data & API.dc.html`.
- `navModel(current)` — maps NAV to `{ label, href, current: 'page' | undefined, style }`; the item whose label equals `current` gets `aria-current="page"` and the active pill style (white background, `#16161a`, weight 500, subtle shadow); others get `#4f4f5a`. Base style: `padding:5px 10px; border-radius:7px; font-size:12.5px; no underline; nowrap`. Pages call it with their own label (Search and Profile pass `''` so nothing is active).
- `C` — colour map: root `#a8682c`, form `#6f55c4`, word `#2f6ae0`, sentence `#177a44`, desc `#6f6f7c`, amber `#b45309`, good `#15803d`, bad `#c02626`, t1 `#16161a`, t2 `#4f4f5a`, t3 `#71717c`, line `#e5e5ea`, line2 `#d3d3dc`, card2 `#f5f5f8`, panel `#f8f8fa`. These are the light-theme hex values of the `--c-*` / `--t*` CSS variables the Reader uses.
- `dot(color)` — style string for an 8×8 round colour dot (type legend dots in Search, Notebook link chips, Profile rows).
- `chip(on)` — style string for a pill toggle: 12px, `3px 10px`, radius 99px; on → `#eef3fd` background with `#2f6ae0` border; off → white with `#e5e5ea` border (Concordance text/sort/form chips, Notebook groupings, Published Graph).
- `seg(on)` — style string for a segmented-control button: 12.5px, `4px 11px`, radius 7px; on → white background, `#d3d3dc` border, `#16161a`, weight 500; off → transparent, `#71717c` (view/tab switches on Library, Concordance, Analyser, Classroom, Notebook, Profile, Review Queue, Data & API).
- Pages that import it: Analyser, Classroom, Collections, Concordance, Data & API, Library, Notebook, Profile, Published Graph, Review Queue, Search. Not imported by the Reader, Editor, Jadhr hub, or Shell (they build their own headers).

#### 3.2 Context strip, theme handling (not in jadhr-chrome.js)
- Context record (`jadhr-context`): written by the Reader on every word selection as `{ book: <book Arabic title>, bookId, word, wordAr, wordTr, root, rootAr }`.
- Context strip in `Jadhr.dc.html` (hub): reads the record via `load(KEYS.context)`, renders up to three chips — book (sentence green dot → Reader), word "<wordAr> · <wordTr>" (word blue dot → Reader `?w=`), root (root brown dot → Concordance `?root=`) — plus "clear" (`save(KEYS.context, null)`).
- Context strip in `Shell.dc.html` (split view): polls `localStorage['jadhr-context']` every 800 ms, renders the same three chips, and a "to graph" button that seeds the Editor with the current word (hard-coded pattern فَعْل and pos noun in the seed).
- Concordance uses the context root as its default root when no `?root=`/`?w=` is given (fallback `ilm`).
- Theme: Reader `theme()` = Reader state override → `localStorage['jadhr-theme']` → prop `theme` → `'light'`; `applyTheme` toggles a `dark` class on `<html>` and `<body>`; toggling writes `jadhr-theme`. The Editor and Published Graph also read/write `jadhr-theme`. The other pages are light-only (hard-coded hex colours from `C`).

#### 3.3 Storage keys and shapes (prototype localStorage; 07 §7.3 maps them to tables)
- `jadhr-word-states` (KEYS.states): `{ [wordId]: 'learning' | 'known' | 'new' }`. Selecting a word auto-writes `learning`; the hover card can write the literal `'new'`, which Collections then counts as "met".
- `jadhr-marks` (KEYS.marks): `{ [wordId]: true }` — read by the hub sign-in prompt and Notebook, but the Reader keeps stars in its own `lexicon-reader-v5` state and never writes this key, so those counts are always 0 in the prototype.
- `jadhr-notes`: array; passage notes `{ id, book, bookAr, key, ref, anchor, body, roots[], word, ts }`; trail notes `{ id, title, body, tags: ['trail'], ts, roots }`; Notebook notes `{ id, title, body, tags[], ts, roots[] }`.
- `jadhr-progress`: `{ [bookId]: { ch, pi, at } }` ("You stopped here · <date>", Library "Continue").
- `jadhr-texts`: user-pasted texts `{ id: 'txt…', title, short, text, n, words[], review, ts }`; the Reader and Concordance re-tokenise them with `analyse()`.
- `jadhr-sessions`: `[{ day: 'YYYY-MM-DD', book, bookAr, words[], roots[], opened, minutes }]`, last 60 kept; feeds Notebook journal and Profile.
- `jadhr-context`: see §3.2.
- `jadhr-account`: `{ name, affiliation, orcid, since }` (fake sign-in).
- `jadhr-proposals`: `[{ id, kind: 'edit'|'sense'|'error'|'entry'|'note'|'attest', wordId, wordAr, senseIdx, current, text, why, sources[], status: 'pending'|'merged'|'declined'|'changes', by, ts, approvals[], note }]`; merge = 2 approvals.
- `jadhr-published` (KEYS.graphs): published graphs list (Profile reads `{ slug, title, doc|nodes, ts }`).
- `jadhr-onboarded`: boolean (three-beat first-run).
- `jadhr-prefs` (KEYS.prefs): no page writes it; it is only touched generically by Profile's "Export everything" and "Delete local data", which iterate every KEYS value. Reading preferences actually persist in `lexicon-reader-v5` and `jadhr-theme`.
- Keys used directly, not in KEYS: `jadhr-trail` (`[{ kind: 'word', id, ts }]`, max 40), `jadhr-theme`, `lexicon-reader-v5` (Reader PERSIST: explainOff, panelMode, layerOpen, wordStatesOn, bookIdx, lexMode, cmp, tashkil, themeOverride, size, trOn, tlOn, tintOn, gramAll, railOpen, panelOpen, panelW, dictOff, ch, marks, links, topics, speed), Editor/Published Graph keys `jadhr-card`, `jadhr-comments`, `jadhr-fit`, `jadhr-fold`, `lexicon-editor-v5-ui` (not inspected in detail).
- Broken links: Library, Concordance, Search, Analyser, Notebook, Profile, Shell, Jadhr hub, and the Editor link to `Lexicon Reader v4.dc.html`, which is not in the handoff (only v5 exists).

---

### 4. Field → do we likely have it?

Status values exactly as requested: **from Quran corpus data** · **from classical lexica** · **needs curated/editorial content** · **needs a new licensed source** · **derivable by computation**. Where two apply, the status is the one that decides the gap and the other is in Notes. "We have" = full Quran text, QAC morphology for 77,429 words, roots/lemmas, wazn for most lemmas, 7 tafsirs, 2 English translations, Mufradat, Maqayis, Lisan, Sihah, Lane, Ibn Qutaybah's gharib, word-level audio timings, English word glosses.

#### 4.1 Root

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| key slug (`ktb`) | URLs `?root=`, permalinks `/r/<key>`, storage | derivable by computation | From QAC root (Buckwalter); prototype slugs are ad hoc (`ilm`, `qra`) — define a collision-free scheme |
| ordered letters / spaced `ك ت ب` / bare `كتب` | root chip, concordance chips, three-box root builder, skeleton match | from Quran corpus data | QAC root field; handle quadriliterals and hamza/weak letters consistently |
| transliteration `k-t-b` | root chip, omnibox, search detection `x-y-z` | derivable by computation | Fixed letter table incl. ʿ ʾ |
| English gloss (`en`) | panel root chip, Ask Cousins card, wotd blurb, hover hints, omnibox, review card, Lane template | needs curated/editorial content | Not in QAC; seed from Lane root headings and aggregated QAC word glosses, then edit |
| Arabic core idea (`arGist`, after "يدلُّ على") | panel line under the root chip; root-semantic article | from classical lexica | Maqayis states "أصل … يدل على X" for most roots — extract X; editorial fill for roots Maqayis lacks or splits into several أصول (UI assumes one gist) |
| corpus frequency | "N in corpus" in omnibox, passage roots drawer, concordance total | derivable by computation | Count QAC tokens per root |
| words per root / shapes per root | family header "N words · M shapes", index groups, review cap | derivable by computation | Count lemmas / distinct wazn per root |
| English note paragraph (Editor) | graph editor root card | needs curated/editorial content | Editor-only |
| semantic-field tags (Editor) | graph editor root card | needs curated/editorial content | Editor-only |

#### 4.2 Pattern (wazn)

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| Arabic wazn per lemma | word chip, family groups, patterns table, cousins, next-steps door 3, Ask card 4, review hints | from Quran corpus data | Our wazn data covers "most lemmas" — the gaps need editorial assignment; the inventory must grow well beyond the 21 (فَعِيل, تَفَعُّل, اِفْتِعَال, اِنْفِعَال, اِسْتِفْعَال, فُعُول, أَفْعَال, فَعْلَان, أَفْعَل …) |
| pattern slug key | URLs, API `pattern_key` | derivable by computation | 08's implied convention collides (`fa3ala` = فَعَلَ and فَعَالَة) — needs a different scheme |
| transliteration (`mafʿala`) | word chip label, pattern rows, search by translit | derivable by computation | From the vocalised wazn |
| function text English (`noun of place (fem.)`) | family/pattern headers, wazn note, hover/review hints, cousin door, Ask card, Collections sub-line | needs curated/editorial content | Partly derivable from QAC features (verb form, ACT/PASS participle, verbal noun); noun of place/time/instrument, intensive, quality, elative need editorial; Arabic-first needs `function_ar` (اسم مكان، اسم فاعل، مصدر …) |
| form number (I–X) | 07 `form_number`; prototype embeds it in text | from Quran corpus data | QAC verb-form feature (I–XII) on verbs, participles, verbal nouns |
| plain-language explanation | glossary card via dotted terms | needs curated/editorial content | Only category-level via GLOSSARY; none exists for "noun of quality", "noun", "intensive noun", Form III; none in Arabic |
| words per pattern, roots per pattern | wazn view "N words across M roots", omnibox, Search | derivable by computation | |
| productivity (Editor field) | graph editor form card | derivable by computation | From counts, or editorial override |

#### 4.3 Word (lexeme / lemma)

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| slug id | `?w=`, permalinks `/w/<id>`, word-states, trail | derivable by computation | From QAC lemma; must stay stable across dataset releases (citations) |
| vocalised lemma `ar` | headword everywhere | from Quran corpus data | QAC lemma |
| bare / normalised forms | search, matching, tashkīl-off display | derivable by computation | Write one normalisation spec that also strips Quranic marks and folds ٱ (prototype, 07 and 09 disagree) |
| transliteration | sub-lines, Ask chat-translit matching, search | derivable by computation | |
| short English gloss (`en`) | hover, chips, family, results, Ask title, wotd, collections | derivable by computation | Aggregate our per-token English glosses to the lemma, then an editorial pass; Arabic-first may want an Arabic short gloss too (editorial) |
| part of speech | chip, hover, Ask ranking (nouns before verbs), analyser CoNLL | from Quran corpus data | Map QAC tags to noun/verb/participle/adjective/particle (+ pronoun, proper noun) |
| pattern link | see 4.2 | from Quran corpus data | |
| one-line Arabic definition (`arDef`) | sense 01 Arabic line, compare/apparatus sense-1 text, lexEntry templates | from classical lexica | Lexica are root-organised: needs lemma sub-entry location and condensation to one line (editorial) |
| corpus frequency | chip "N in corpus", omnibox, index rows, Ask ranking | derivable by computation | Count QAC tokens per lemma |
| headword audio | Ask play button, Meaning card | from Quran corpus data | Our word timings let us clip an in-context recitation of an occurrence (assuming the matching recitation audio is licensed); an isolated dictionary-form pronunciation would need a new licensed source; hide the button when null |
| family list | Family section, Ask Cousins | derivable by computation | Lemmas sharing the root |
| cousins (same wazn, other roots) | Family "cousins", next-steps door 3 | derivable by computation | |
| word states, stars, trail | tints, review, collections progress | derivable by computation | User data, not content |

#### 4.4 Sense

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| ordered sense list, English | Meanings section, compare grid, apparatus, timeline lanes/streams, copy/export, wotd "Also:", Ask "Also:" | needs curated/editorial content | Biggest content gap; QAC glosses are single contextual glosses, not sense inventories; Lane gives English senses per root that must be split per lemma |
| Arabic sense text (`arSenses`, sense 2+) | compare and apparatus cells (falls back to English italics) | from classical lexica | Absent from prototype data; essential for Arabic-first |
| ordinal `01, 02` | numbering, proposals | derivable by computation | |
| sense colour / tint | timeline streams band colour | derivable by computation | `SENSE_COLORS[i % 5]` |
| which dictionaries attest each sense | "reviewed · sources: …", "N say something", Sources count, compare/apparatus, timeline dots, "first in X (year)", cite sources, API `senses[].sources` | needs curated/editorial content | Prototype fakes it with `dictAttests`; real alignment of every sense to every lexicon article is scholarly editorial work |
| which corpora attest each sense | timeline green squares | needs curated/editorial content | Quran: requires sense-tagging each token (not in QAC); poetry and ḥadīth corpora need a new licensed source |
| credited contributor | sense meta after merge | derivable by computation | User/community data |

#### 4.5 Dictionaries and articles

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| name ar/en, author, death year, kind, tag (Sihah, Maqayis, Mufradat, Lisan, Lane) | article cards, filter chips, dictionary toggles, timeline | needs curated/editorial content | Small metadata, type it once |
| Kitāb al-ʿAyn, Tahdhīb al-Lugha, al-Qāmūs al-Muḥīṭ, Tāj al-ʿArūs | four of the nine design rows; compare default includes `ayn`; apparatus bases include `qamus`, `taj`; "Earliest" filter | needs a new licensed source | Without them we have 5 sources (layout survives down to ~4 per 10-open-questions) |
| Ibn Qutaybah's Gharīb | no slot in the design | from classical lexica | We have it; per-verse glosses — would need a new `kind`, filter chip, and timeline year 889 |
| license, source note per dictionary | must be shown on every article (07, 10) | needs curated/editorial content | From our licence records |
| article body per (dictionary, word) | Lexica "one by one", compare, apparatus, Data & API | from classical lexica | Design keys articles per word; our lexica are per root (Lane per root with sub-entries) — needs sub-entry segmentation or a per-root fallback with the lemma highlighted |
| article body per (dictionary, root) | 07 `dict_articles.root_id`, API `/lexica/{id}/{root}` | from classical lexica | Direct |
| page reference | 07/08 `page_ref` | from classical lexica | Only if the digitisation carries pagination |
| per-dictionary one-line gist per word | "gists" list in the Lexica section | needs curated/editorial content | Prototype fakes it with `senses[i % n]` |
| "N characters · ~N words" | show-more button | derivable by computation | |

#### 4.6 Texts, passages, tokens, attestations

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| Quran text (Arabic, vocalised), sūra/āya refs | reading surface, attestations, KWIC, omnibox "2:255" | from Quran corpus data | |
| sūra names ar/en, "Medinan · 286 verses" | chapter headers, attestation chapter label | from Quran corpus data | Standard metadata |
| English translation per verse | passage English line, attestation rows, Ask "Heard in", next-steps verse door, KWIC hover | from Quran corpus data | We hold 2 licensed translations; the design has one slot — add a translation switch |
| verse transliteration line | passage Latin line (toggle) | derivable by computation | Rule-based from vocalised text, or drop for Arabic-first |
| tafsir | no slot in the design | from Quran corpus data | We hold 7 tafsirs; the design never shows tafsir — needs a new panel section |
| token surface, lemma link, root link, pattern link | tap-to-open, tint, concordance | from Quran corpus data | QAC |
| grammar string (`noun · genitive, definite`) | hover, grammar band, KWIC, attestation rows, review | derivable by computation | Render QAC features to English and Arabic labels; glossary keywords are English |
| segments prefix/stem/suffix with gloss | analyser, unknown-word popover | from Quran corpus data | QAC segmentation replaces `analyse()` for Quran text; out-of-corpus pasted text still needs an analyser (09 §9.5) |
| confidence | analyser | derivable by computation | 1.0 for QAC tokens |
| particle / function-word flag | untagged token styling, analyser | from Quran corpus data | QAC POS |
| word-by-word audio highlight | passage Audio button (prototype steps every 780 ms / speed) | from Quran corpus data | Our word timings give real sync; prototype only fakes timing |
| attestation rows (book, ref, whole verse, English, gram, surface, chapter) | Sources section, surface-form chips, sibling fallback | derivable by computation | Join tokens → verses → translation |
| KWIC left/right, sort keys | Concordance | derivable by computation | Precompute normalised left/right sort keys (09) |
| distribution per text / per 100 tokens, collocates | Concordance distribution | derivable by computation | |
| related passages (shared roots) | passage Related drawer | derivable by computation | |
| passage difficulty 1–5 (07/08) | Reader contents | derivable by computation | Formula undefined (10); prototype instead shows personalised per-chapter easy/comfortable/stretch |
| reading time "~N min" | chapter contents | derivable by computation | `max(1, round(tagged tokens / 8))` |
| topics taxonomy | passage Topic drawer | needs curated/editorial content | Prototype has 5 English labels |
| Ṣaḥīḥ al-Bukhārī text, refs, translation | scripture filter, attestations, timeline corpus | needs a new licensed source | |
| pre-Islamic poetry corpus | timeline corpus lane | needs a new licensed source | |
| the demo prose BOOK | default reader text, collections, classroom | needs curated/editorial content | Invented demo text; drop or replace for a Quran site |

#### 4.7 Timeline, discovery, and study features

| Field | UI that needs it | Status | Notes |
|---|---|---|---|
| timeline range, ticks | Sources timeline | derivable by computation | Constants 550–1920 |
| dictionary years | timeline dots/labels | needs curated/editorial content | Death years, small table |
| corpus years (580 / 632 / 846) | timeline corpus markers | needs curated/editorial content | |
| "first in <Dict> (<year>)" per sense | timeline lane meta | derivable by computation | Only once the sense×dictionary matrix exists (editorial) |
| glossary terms (29, English) | dotted-term cards | needs curated/editorial content | English copy exists; Arabic glossary and an Arabic-aware matcher needed |
| collections: titles, intros, whys, colours | Collections | needs curated/editorial content | |
| collections: membership | Collections | derivable by computation | Rules by root/pattern; the "words you may already know" list is editorial |
| word of the day | Collections hero | derivable by computation | `dayNumber % N` over an eligible list; blurb needs sense 2 and root gloss |
| next steps (3 doors) | panel "next" row | derivable by computation | Make door 1 independent of the user trail to satisfy 08's determinism |
| Ask matching and ranking | Ask mode, omnibox | derivable by computation | Uses `freq` and `pos` |
| query-type detection | Search "detected" label, omnibox | derivable by computation | |
| review deck (root-family unit) | Review | derivable by computation | User data + family/passage lookups |
| classroom heat-map | Classroom | derivable by computation | From real lookup events (prototype fakes it) |
| citation formats, dataset version, DOI | cite sheet, Data & API | needs curated/editorial content | Release process |

#### 4.8 What we hold that the design has no place for
- 7 tafsirs (no tafsir section anywhere in the Reader panel or Ask cards).
- The second English translation (one `en` per passage).
- Real word-level audio timings (design steps tokens on a fixed timer).
- Ibn Qutaybah's Gharīb (not one of the nine rows; organised per verse).
- QAC features beyond the single `gram` string (person/gender/number/case/mood/voice/state as separate fields, syntactic treebank).
