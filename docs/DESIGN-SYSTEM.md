# Design system — as built

The audit PLAN P1.5 asks for: the handoff's design system (`Claude Design Handoff/02-design-tokens.md`) set against what the code holds — tokens, type roles, component recipes, motion, breakpoints and the accessibility floor — with every deviation named and its reason. Audited 2026-10-04 against `apps/web/src/app/globals.css`, `apps/web/src/lib/fonts.ts`, `apps/web/src/components/ui/`, `apps/web/src/lib/reader/media.ts` and the e2e suite.

Where things live: the tokens and recipes in `globals.css` (`:root` for light, `:root[data-theme="dark"]` for dark, Tailwind names in `@theme inline`); the families in `lib/fonts.ts`; the shared controls in `components/ui/` (`Dialog`, `Segmented`, `Switch`, `MarksToggle`, `useFocusTrap`); the reader's breakpoints in `lib/reader/media.ts`. The contrast floor is a test: `apps/web/src/lib/tokens.test.ts` reads the tokens from `globals.css` and fails when any text colour falls under 4.5:1.

## 1 · Colour

The handoff's light and dark sets are kept, names included, with these changes.

| Token | Handoff | Built | Why |
|---|---|---|---|
| `--t3` light | `#71717c` | `#686872` | 4.16:1 on the canvas, under AA; now 4.8 |
| `--c-root` light | `#a8682c` | `#945c27` | 4.49:1 on a card and 3.87 on the canvas; now 5.5 and 4.7 |
| `--c-word`, `--ring` light | `#2f6ae0` | `#2b62ce` | 4.26:1 on the canvas; now 4.8 |
| `--c-desc` light | `#6f6f7c` | `#686874` | 4.28:1 on the canvas; now 4.7 |
| `--good` light | `#15803d` | `#13763a` | 4.33:1 on the canvas; now 4.9 |
| `--amber` light | `#b45309` | `#a54c08` | 4.34:1 on the canvas; now 5.0 |
| `--t3` dark | `#8d8d9b` | `#9a9aa8` | 4.28:1 on `--card-3`; now 5.0 |
| `--amber` dark | none | `#f0b45c` | The handoff gives no dark amber; the light one is unreadable on dark grounds |
| washes | none | `--root-wash`, `--word-wash`, `--form-wash`, `--sentence-wash` | Tinted wells for word states, type chips and the marked word of a line: the type colour at 10–12% on the card |
| `--chart-root` | none | `#a8682c` light, `#b97a3c` dark | The single-series root charts' mark, validated for its lightness band in both themes (the darkened `--c-root` is for text) |

The handoff's own `--c-root` survives as the chart colour. The five type colours still classify kinds of linguistic object only (root, pattern, word, sentence, description), never a UI state.

### Contrast, computed from the tokens (WCAG 2)

Light:

| text | canvas | card | card-2 | card-3 | panel | paper | root-wash | word-wash | sentence-wash |
|---|---|---|---|---|---|---|---|---|---|
| t1 | 15.6 | 18.0 | 16.6 | 15.4 | 17.0 | 18.0 | 15.3 | 15.7 | 15.8 |
| t2 | 7.0 | 8.1 | 7.4 | 6.9 | 7.6 | 8.1 | 6.8 | 7.0 | 7.1 |
| t3 | 4.8 | 5.5 | 5.1 | 4.7 | 5.2 | 5.5 | 4.7 | 4.8 | 4.8 |
| c-root | 4.7 | 5.5 | 5.1 | 4.7 | 5.2 | 5.5 | 4.7 | 4.8 | 4.8 |
| c-form | 4.8 | 5.6 | 5.1 | 4.8 | 5.2 | 5.6 | 4.7 | 4.8 | 4.9 |
| c-word / ring | 4.8 | 5.6 | 5.2 | 4.8 | 5.3 | 5.6 | 4.8 | 4.9 | 4.9 |
| c-sentence | 4.6 | 5.4 | 4.9 | 4.6 | 5.1 | 5.4 | 4.6 | 4.7 | 4.7 |
| c-desc | 4.7 | 5.5 | 5.1 | 4.7 | 5.2 | 5.5 | 4.7 | 4.8 | 4.8 |
| good | 4.9 | 5.7 | 5.2 | 4.9 | 5.4 | 5.7 | 4.8 | 5.0 | 5.0 |
| bad | 5.1 | 5.9 | 5.4 | 5.1 | 5.6 | 5.9 | 5.0 | 5.1 | 5.2 |
| amber | 5.0 | 5.8 | 5.3 | 4.9 | 5.4 | 5.8 | 4.9 | 5.0 | 5.0 |

Dark:

| text | canvas | card | card-2 | card-3 | panel | paper | root-wash | word-wash | sentence-wash |
|---|---|---|---|---|---|---|---|---|---|
| t1 | 17.1 | 15.5 | 14.1 | 12.6 | 16.3 | 16.2 | 12.6 | 13.1 | 12.9 |
| t2 | 8.9 | 8.1 | 7.4 | 6.5 | 8.5 | 8.4 | 6.5 | 6.8 | 6.7 |
| t3 | 6.9 | 6.2 | 5.7 | 5.0 | 6.6 | 6.5 | 5.0 | 5.3 | 5.2 |
| c-root | 8.7 | 7.9 | 7.2 | 6.4 | 8.3 | 8.2 | 6.4 | 6.7 | 6.6 |
| c-form | 7.4 | 6.7 | 6.1 | 5.4 | 7.0 | 7.0 | 5.4 | 5.7 | 5.6 |
| c-word / ring | 7.6 | 6.9 | 6.3 | 5.6 | 7.2 | 7.2 | 5.6 | 5.8 | 5.7 |
| c-sentence | 9.9 | 9.0 | 8.2 | 7.3 | 9.4 | 9.3 | 7.3 | 7.6 | 7.4 |
| c-desc | 6.9 | 6.2 | 5.7 | 5.0 | 6.6 | 6.5 | 5.0 | 5.3 | 5.2 |
| good | 10.8 | 9.7 | 8.9 | 7.9 | 10.2 | 10.1 | 7.9 | 8.2 | 8.1 |
| bad | 6.7 | 6.1 | 5.5 | 4.9 | 6.4 | 6.3 | 4.9 | 5.1 | 5.0 |
| amber | 10.4 | 9.4 | 8.6 | 7.6 | 9.9 | 9.8 | 7.6 | 8.0 | 7.8 |

The lowest is 4.6:1 (`--c-sentence` on the light canvas, `--card-3` and its own wash). Borders and the editor's edges are not text and are not held to 4.5.

### Theme

One preference key across the product, `jadhr-theme`, as the handoff asks; the theme is set as `data-theme` on `<html>` (not a `.dark` class) by a script that runs before the page paints, so a page never flashes the other theme, and an embedded map takes its theme from its address. Default light. The route sweep (`e2e/routes-sweep.spec.ts`) checks on every route, at three widths, that the theme is still on after hydration.

## 2 · Type

| Family | Variable | Role | Loading |
|---|---|---|---|
| KFGQPC Uthmanic Hafs V22 | `--font-quran` | The mushaf text only, byte-identical to the signed file (its licence forbids conversion) | Local file, `display: block` so the marks never paint in a fallback |
| Amiri 400/700 | `--font-classical` | Classical Arabic: hadith, books, the lexica's articles, Arabic book titles, headwords | Swapped in, not preloaded (below the fold) |
| IBM Plex Sans Arabic 400/500/600 | first in `--font-ui` | Arabic as interface | Preloaded |
| IBM Plex Sans 400/500/600 | `--font-latin`, second in `--font-ui` | Latin interface text | Preloaded |
| IBM Plex Mono 400/500 | `--font-mono` | Numbers in a measured context: counts, references, identifiers, keyboard hints | Not preloaded |
| Jadhr Symbols (a Noto Naskh Arabic subset, OFL) | after Plex and Amiri in `--font-ui` and `--font-classical` | Only U+FDFA–FDFF, the honorific ligatures neither Plex nor Amiri has (1,809 articles) | Fetched only when such a character is on the page |

All through `next/font`, self-hosted: no request to a font service at run time. Plex Mono has no Arabic: an Arabic letter inside a mono run (an article's identifier, `dict:lane:علم`) falls back to Plex Sans Arabic, a little off the mono baseline.

The scale is the handoff's (§2.3): 11 px uppercase labels (`.label-caps`; in Arabic 12 px, weight 500, no letter-spacing, since Arabic has no capitals), 12.5–13 px for controls, 22–32 px reading text, 36–56 px headwords. The reading text follows the reader's A−/A+ multiplier (floor 0.8, cap 1.6, step 0.1). The vowel-marks switch (D7) changes what is shown of every text but the mushaf's, never the text itself.

## 3 · Spacing, radii, motion

Spacing and radii are the handoff's (§2.4): gaps of 6, 10 and 12 px dominate; radii 8 for buttons, 12 for cards and popovers, 99 for pills.

Motion: the three keyframes of the handoff (`dc-pop` 0.12 s, `dc-rise` 0.16 s, `dc-fade` 0.15 s) and transitions of 0.12–0.14 s on colour, border, background and transform. Two longer ones, both moving something the reader asked to move: the reader's phone sheet going from half to full height and back (0.22 s, the handoff's one longer animation; added with this audit), and the map editor's glide to a card (0.38 s). `prefers-reduced-motion: reduce` turns every animation and transition off (`globals.css`, the first rule after the base).

## 4 · Component recipes

| Recipe | Class / component | Notes |
|---|---|---|
| Button | `.btn`, `.btn-primary`, `.btn-danger` | Handoff values; min-height 30 px, raised on phones (§6) |
| Chip / filter | `.chip`, `.chip.is-on` | On: `--word-wash` with a `--ring` border (the handoff's `#eef3fd` made from the tokens, so dark works) |
| Segmented control | `components/ui/Segmented`, `.seg-group`, `.seg` | `aria-pressed` on each segment; in the reader's rail the segments share its width and shrink (`.reader-rail .seg-group`) |
| Toggle switch | `components/ui/Switch`, `.switch-row`, `.switch-track`, `.switch-knob` | `role="switch"` + `aria-checked`; `MarksToggle` is the vowel-marks one |
| Popover / menu | `.popover` | `--sh-open`, radius 12, Esc closes |
| Dialog | `components/ui/Dialog` with `useFocusTrap` | Focus trapped and returned; Esc closes |
| Type dot | `.dot` | 8 px, the type colour |
| Section label | `.label-caps` | See §2 for Arabic |
| Result row | `.result-row` | Search, concordance and texts lists; min-height 44 px |
| Word in its line | `.kwic-line`, `.kwic-word` | The root's or the word's place marked with a root wash |
| State chip | `.state-chip` (`.is-review`, `.is-open`, `.is-approved`) | Board and review states; amber is a state colour, never a type |
| Term | `.term` | A glossary term dotted in running text; its card portalled above the header |
| Word panel | `components/text/WordPanel`, `.hadith-panel` | Beside a hadith, a book paragraph or the reader's own text; sticky within the window on a desktop, a sheet from the foot on a phone |

## 5 · Breakpoints

| Width | Where | What changes |
|---|---|---|
| ≥ 1200 | Reader (`lib/reader/media.ts`) | Rail docked beside the reading surface and the panel |
| 900–1199 | Reader; the shell | Rail as an overlay; the site header keeps its navigation |
| < 900 | Reader; the shell | Phone mode: the dictionary as a bottom sheet, the header's menu, 40/44 px targets |
| ≥ 1024 | Hadith, books, the reader's texts | The word panel docks beside the text; below, it rises from the foot |
| 768 (Tailwind `md`) | Page layouts | Grids go from one column to two |
| 760 | Review deck | The in-context card's side column drops below |
| 390 | Every screen | The audited floor: the route sweep and the phone project of the e2e suite (a 412 px Pixel 7) |

The handoff's 1200/900/390 hold. 1024 is ours: a text and a 320 px panel side by side need it.

## 6 · Accessibility floor

| Rule | Where it is | Checked by |
|---|---|---|
| Visible focus: 2 px `--ring`, offset 2, radius 6 | `:focus-visible` in `globals.css` | axe (`e2e/a11y.spec.ts`) |
| Skip to content | The first link of every page (`app/[locale]/layout.tsx`) | a11y spec |
| Targets: 40 px for header tools and passage tools, 44 px in the reader's sheet and overlays, 48 px section heads | `globals.css` phone rules | `e2e/phone-targets.spec.ts` |
| Esc closes every overlay and gives focus back | `Dialog`, `useFocusTrap`, each panel | reader and editor specs |
| `lang` and `dir` on every Arabic run; transliteration as Latin | components | the route sweep checks the page's `lang` |
| Text at 4.5:1 on every surface, both themes | the tokens (§1) | `src/lib/tokens.test.ts` |
| No sideways scroll at 390 px | layouts | the route sweep (492 pages) and 16 specs |
| Reduced motion | §3 | — |

## 7 · Deviations from the handoff, in one place

- Seven colours darkened and one dark amber added, for AA on every surface (§1).
- Four washes and a chart colour added, made from the tokens.
- The theme is a `data-theme` attribute set before paint, not a `.dark` class; the key is the handoff's.
- Fonts are self-hosted, not loaded from Google Fonts; a symbols subset covers the honorific ligatures.
- Arabic section labels drop the uppercase letter-spacing (Arabic has no case) and gain weight.
- A 1024 px breakpoint for the text readers' word panel.
- The rail's segmented control shares its width among four views (the Texts view, RDR-063).
