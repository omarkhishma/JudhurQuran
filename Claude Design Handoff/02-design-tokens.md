# 2 · Design tokens

Every value here is taken from the shipped prototypes and is final. Implement as CSS custom properties on `:root` with a `.dark` override class, or as the equivalent in your styling system. **Names below match the prototype variable names** so you can cross-reference the design files directly.

## 2.1 Color — light theme (default)

### Surfaces
| Token | Value | Use |
|---|---|---|
| `--canvas` | `#eeeef1` | Page background behind everything |
| `--card` | `#ffffff` | Cards, panels, popovers, inputs |
| `--card-2` | `#f5f5f8` | Recessed wells, segmented-control tracks, hover fills |
| `--card-3` | `#ecedf1` | Third-level recess (rare — nested wells) |
| `--panel` | `#f8f8fa` | Header and rail background |
| `--paper` | `#fffffe` | The reading surface only — a hair warmer than `--card` |

### Lines
| Token | Value | Use |
|---|---|---|
| `--line` | `#e5e5ea` | Default border, dividers |
| `--line-2` | `#d3d3dc` | Emphasised border — popovers, active segments, scrollbar thumb |
| `--edge` | `#b7b7c3` | Graph edges in the editor |
| `--dot` | `#d5d5dd` | Canvas dot grid |

### Text
| Token | Value | Use | Contrast on `--card` |
|---|---|---|---|
| `--t1` | `#16161a` | Primary text | 17.9:1 |
| `--t2` | `#4f4f5a` | Secondary — labels, button text | 8.2:1 |
| `--t3` | `#71717c` | Tertiary — meta, hints, captions | 5.1:1 |

`--t3` is the floor. Nothing smaller or lighter than `--t3` at 11px is used anywhere, and 11px is reserved for uppercase meta labels with letter-spacing.

### Semantic and type colors
The five type colors are the product's real palette — they classify **kinds of linguistic object** and are used consistently on every screen, in the graph, in the panel, in the concordance, and in the analyser. Do not repurpose them for UI states.

| Token | Value | Means |
|---|---|---|
| `--c-root` | `#a8682c` | **Root** — also the brand mark color |
| `--c-form` | `#6f55c4` | **Pattern / wazn** |
| `--c-word` | `#2f6ae0` | **Word** — same hue as `--ring` |
| `--c-sentence` | `#177a44` | **Sentence / attestation** |
| `--c-desc` | `#6f6f7c` | **Description / note** |

| Token | Value | Use |
|---|---|---|
| `--ring` | `#2f6ae0` | Focus rings, links, selection, primary accent |
| `--good` | `#15803d` | Success, approved, live-presence dot |
| `--bad` | `#c02626` | Error, declined, destructive |
| `--amber` | `#b45309` | Warning / pending (from `jadhr-chrome.js`) |

### Shadows
```
--sh:      0 1px 2px rgba(20,20,35,.05), 0 10px 24px -12px rgba(20,20,35,.20)
--sh-open: 0 2px 4px rgba(20,20,35,.06), 0 30px 60px -20px rgba(20,20,35,.32)
```
`--sh` for resting cards; `--sh-open` for anything floating above the page — popovers, dialogs, menus, the phone sheet.

## 2.2 Color — dark theme

Not a filter or an inversion. A separate, hand-tuned set. The five type colors are re-chosen for dark grounds, not lightened programmatically.

```
--canvas:#0f0f12  --card:#1a1a20  --card-2:#22222a  --card-3:#2b2b34
--panel:#15151a   --paper:#16161b
--line:rgba(255,255,255,.08)      --line-2:rgba(255,255,255,.16)
--t1:#f2f2f7      --t2:#b0b0be    --t3:#8d8d9b
--ring:#7aa2f7    --edge:#4d4d5b  --dot:#2a2a33
--bad:#f07178     --good:#79d68b
--c-root:#e0a361  --c-form:#ab92f2 --c-word:#7aa2f7
--c-sentence:#6fce88  --c-desc:#9a9aa8
--sh:      0 1px 0 rgba(255,255,255,.04) inset, 0 14px 30px -14px rgba(0,0,0,.85)
--sh-open: 0 1px 0 rgba(255,255,255,.06) inset, 0 34px 64px -20px rgba(0,0,0,.9)
```

Dark theme is applied by putting `.dark` on the root element. **One shared preference key across the entire product** (`jadhr-theme` in the prototypes) so the Reader and Editor never disagree — including when the Editor is embedded in an iframe inside another page. Default is **light**.

## 2.3 Typography

Four families, loaded from Google Fonts:

```
Amiri:ital,wght@0,400;0,700;1,400
IBM Plex Sans:wght@400;500;600
IBM Plex Mono:wght@400;500
IBM Plex Sans Arabic:wght@400;500;600
```

| Family | Role | Never use for |
|---|---|---|
| **Amiri** (serif) | All classical Arabic content — passages, headwords, dictionary text, Arabic book titles. `dir="rtl"`. | UI chrome |
| **IBM Plex Sans** | All English and Latin UI text, labels, buttons, body copy | Arabic |
| **IBM Plex Sans Arabic** | Arabic appearing *as UI* — Arabic labels in chrome, Arabic input fields | Classical text |
| **IBM Plex Mono** | Numerals in a measured context: counts, refs, frequencies, IDs, keyboard hints, size indicators, API payloads | Prose |

### Scale in use
| px | Weight | Where |
|---|---|---|
| 10.5–11 | 400 | Uppercase section labels (`letter-spacing: .09em`), keyboard hints, badges |
| 11.5–12 | 400 | Hints under toggles, chip labels, secondary meta |
| 12.5–13 | 400/500 | Nav items, buttons, segmented controls — the UI default |
| 13.5–14 | 500 | Titles in headers, menu items on touch |
| 15 | 400 | Amiri book titles in chrome, list items |
| 17–20 | 400/600 | Panel headings, section headers |
| 22–32 | 400 | Amiri reading text (user-scalable, see below) |
| 36–56 | 400 | Amiri headwords in the entry header and the Ask result card |

**Reading text is user-scalable** via `A−` / `A+` in the Reader header, stored as a multiplier, floor `0.8`, step `0.1`, shown as a percentage in `IBM Plex Mono`. All reading-surface type must be expressed relative to that multiplier.

### Arabic typesetting rules
- Arabic runs always carry `dir="rtl"`; the element, not a parent.
- Amiri at reading size needs `line-height` ≈ 1.9–2.1 — tashkīl collides below that.
- **Never place English inside an RTL Arabic run.** English glosses live in a separate LTR element styled `font-style: italic`. This was a bug fixed during design; re-introducing it breaks bidi ordering visibly.
- Tashkīl is toggleable. Strip with `/[\u064B-\u0652\u0670\u0640]/g` for the undecorated view and for search normalisation; also fold `أ إ آ → ا` for matching only, never for display.
- Transliteration uses full diacritics (`ʿ ʾ ā ī ū ḥ ṣ ṭ ḏ ṯ ġ`). Store as NFC UTF-8 and never strip it.

## 2.4 Spacing, radii, motion

**Spacing** — a 2px-based informal scale. Observed values: `1, 2, 4, 6, 8, 9, 10, 11, 12, 14, 18, 24`. Gaps of `6px` (tight control groups), `10px` (header items), and `12px` (card interiors) dominate. Use `display: flex/grid` + `gap`, never margins between siblings.

**Radii**
| Value | Use |
|---|---|
| `4–5px` | Badges, the logo mark, tiny chips |
| `6–7px` | Segmented-control segments, inline buttons, inputs |
| `8–9px` | Standard buttons, control-group wrappers |
| `12px` | Popovers, menus, dialogs, cards |
| `16–18px` | Phone sheet top corners |
| `99px` | Pills, dots, avatars, toggle tracks |

**Motion** — fast and minimal. Three keyframes cover the whole product:
```
dcPop  .12s ease-out   opacity 0→1, scale .97/.98→1   — popovers, menus, dialogs
dcRise .16s ease-out   opacity 0→1, translateY 6-8px  — toasts, tooltips
dcFade .15s            opacity 0→1                    — scrims, overlays
```
Transitions on interactive elements: `120–160ms ease-out`, on `border-color`, `background`, `color`, `transform` only. The phone sheet's height change is the one longer animation (~220ms). **No spring physics, no staggered entrances, no scroll-triggered animation anywhere.**

## 2.5 Component recipes

These recur across every screen; build them once.

**Button (default)**
`background: var(--card)` · `border: 1px solid var(--line)` · `border-radius: 8px` · `color: var(--t2)` · `font-size: 13px` · `padding: 5px 11px` · hover: `border-color: var(--ring); color: var(--t1)` · focus-visible: `outline: 2px solid var(--ring); outline-offset: 2px`

**Icon button**
`32×30px` (or `28×28` in tight header slots), centred 12–14px stroke icon at `stroke-width: 1.1–1.2`, otherwise identical to the default button. **On touch / below 900px: minimum 40px, and 44px for anything in an overlay.**

**Control group** (Tidy|Fit, Undo|Redo, A−|A+)
Wrapper: `display: flex; gap: 1px; padding: 2px; background: var(--card-2); border: 1px solid var(--line); border-radius: 9px`. Children: transparent, `border: none`, `border-radius: 7px`, `padding: 5px 11px`, hover `background: var(--card)`. Dividers: `1px × 16px` in `var(--line)`.

**Segmented control** (`seg(on)` in `jadhr-chrome.js`)
Off: transparent border, transparent background, `color: #71717c`, `font-weight: 400`. On: `border: 1px solid #d3d3dc`, `background: #fff`, `color: #16161a`, `font-weight: 500`. Both: `font-size: 12.5px`, `padding: 4px 11px`, `border-radius: 7px`, `white-space: nowrap`.

**Chip / filter** (`chip(on)`)
Off: `background: #fff`, `border: 1px solid #e5e5ea`. On: `background: #eef3fd`, `border: 1px solid #2f6ae0`. Both: `font-size: 12px`, `padding: 3px 10px`, `border-radius: 99px`, `color: #16161a`.

**Toggle switch**
Track `28×16px`, `border-radius: 99px`; off `var(--line-2)`, on `var(--ring)`. Knob `12×12px` white, `2px` inset, translates `12px`. Always `role="switch"` + `aria-checked`. Rendered as a row: track · label (13px `--t1`) · hint (11.5px `--t3`, `line-height: 1.35`).

**Popover / menu**
`background: var(--card)` · `border: 1px solid var(--line-2)` · `border-radius: 12px` · `box-shadow: var(--sh-open)` · `padding: 6px` (menus) or `10px` (panels) · `animation: dcPop .12s ease-out`. Items: `border-radius: 8px`, hover `background: var(--card-2)`, min-height `44px` on touch. Section labels: 11px uppercase `--t3`, `letter-spacing: .09em`. Always closable with `Esc`.

**Type dot**
`width: 8px; height: 8px; border-radius: 99px; flex: none; background: <type color>` — the universal marker for root/pattern/word/sentence/description across every screen.

**Uppercase section label**
`font-size: 11px` · `color: var(--t3)` · `text-transform: uppercase` · `letter-spacing: .09em`

## 2.6 Responsive breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1200px | Full layout: rail + reading surface + docked panel |
| 900–1200px | Rail collapses to an overlay with a scrim; panel stays docked but narrower |
| < 900px | **Phone mode.** Dictionary becomes a bottom sheet at half height, swipe up for full, down to close. Passage tools hidden until a 420ms long-press. Header collapses to the ⋯ menu. All targets ≥ 40px, overlay targets ≥ 44px. |
| 390px | The audited floor. Every overlay — omnibox, cite, suggest, onboarding, review deck, term card — was checked at this width. |

Everything outside the Editor canvas and the phone sheet is fluid: `max-width` rather than fixed `width`, `minmax(0, 1fr)` grid tracks, no `nowrap` on text containers.

## 2.7 Accessibility floor

- `aria-current="page"` on the active nav item
- `role="switch"` + `aria-checked` on every toggle; `aria-pressed` on toggle buttons
- `aria-live="polite"` on the editor's save-status indicator and on toasts
- `aria-label` on every icon-only button (all present in the prototypes — copy the strings)
- `aria-hidden="true"` on every decorative SVG
- Visible focus ring on all interactive elements: `2px solid var(--ring)`, `offset: 2px`
- `Esc` closes every overlay, without exception
- Arabic content elements carry `lang="ar"` and `dir="rtl"`; transliteration and glosses carry `lang="en"`
