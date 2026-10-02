# 4 · Lexicon Editor v5

`prototypes/Lexicon Editor v5.dc.html` · 2,628 lines. A node-graph canvas for building root families. `v2`/`v3`/`v4` are in the bundle for comparison; **v5 is the specification**.

The editor has **two personalities in one file** — a full editor and a read-only published viewer. The read-only mode is not a separate implementation and must not become one: the public `/g/<slug>` page and the Classroom embed both mount this same component with `view=<slug>`, so a published graph is always pixel-faithful to what the author built.

---

## 4.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ header 48px                                                  │
├──────────┬────────────────────────────────┬─────────────────┤
│ palette  │ canvas (dot grid, pan/zoom)    │ entry sidebar   │
│ left     │                                 │ right            │
│ collapsi.│                                 │ collapsible      │
└──────────┴────────────────────────────────┴─────────────────┘
```

- **Canvas** — `background: var(--canvas)` with a dot grid in `var(--dot)`. Pan by drag on empty space or space-drag; zoom by wheel/pinch. `Fit` (`F`) frames everything; `Tidy` (`T`) re-runs auto-layout.
- **Palette** (left) — node types to drag in, with an inline help block that can be dismissed (`paletteHelp` preference).
- **Entry sidebar** (right) — the selected card's full record as editable fields. In read-only mode it becomes the published entry view; hidden with `entry=0`.

### Header (left → right)
1. 18×18 logo mark in `--c-root`
2. **Title** — click to rename in place; input is `200px`, `border: 1px solid var(--ring)`, commits on blur or `Enter`
3. `Published · read-only` pill *(read-only mode only)* — 11px uppercase, `letter-spacing: .08em`, `border-radius: 99px`, `padding: 2px 9px`
4. **Presence** *(edit mode)* — a `Live` label with a `--good` dot, then overlapping collaborator avatars with name tooltips
5. **Save status** — `aria-live="polite"`, dot + text (`Saved` / `Saving…` / `Unsaved`)
6. Spacer
7. `Tidy | Fit` control group
8. `Undo | Redo` control group — disabled states carry the action name in the tooltip
9. `Import | Export` control group — Import opens a hidden `<input type="file" accept="application/json">`; Export downloads the graph as JSON
10. **Reader** link — back to the Reader, label and tooltip vary by context
11. **Publish** button

Read-only mode replaces 7–11 with the public actions: **Fork**, **Cite**, **Open in editor**.

---

## 4.2 Node model

Five node kinds, each in its type color. The color *is* the type — there are no other labels distinguishing them at a glance.

| Kind | Color | Carries |
|---|---|---|
| `root` | `--c-root` `#a8682c` | The consonantal root, its core idea in Arabic and English, corpus frequency |
| `form` | `--c-form` `#6f55c4` | A pattern (*wazn*), its transliteration, its grammatical function |
| `word` | `--c-word` `#2f6ae0` | A word: Arabic, transliteration, English, part of speech, senses |
| `sentence` | `--c-sentence` `#177a44` | An attestation: Arabic, transliteration, English, reference |
| `description` | `--c-desc` `#6f6f7c` | A free note |

Plus **`frame`** — a non-semantic grouping container (a labelled region on the canvas). Frames are excluded from fold-all and from card counts.

### Card anatomy
- Type dot + kind label in the header row, `background: var(--card)`, `border: 1px solid var(--line)`, `border-radius: 12px`, `box-shadow: var(--sh)`
- **Arabic line** in Amiri, RTL, largest element
- **Transliteration** and **English** lines
- A list of **fields** — label/value pairs, each individually editable (see `Field.dc.html` and `Card Field.dc.html`)
- **Add field** affordance — hidden in read-only mode
- **Fold** toggle — collapses the card to its header. When folded in a read-only embed, the card **posts a `jadhr-card` message to the parent window** carrying its id and Arabic, so the host page can react (the Published Graph page uses this to show a detail strip)
- **⋯ menu** per card — disabled in read-only mode
- Selected: `outline: 2px solid var(--ring)`. Multi-select by shift-click or marquee drag.

### Edges
Drawn in `var(--edge)` `#b7b7c3`. Directed, root → pattern → word → attestation being the canonical spine, but any pair may be linked. Edges are curves, not right angles, and never carry labels — the node colors make the relationship legible.

---

## 4.3 Interaction

| Action | Input |
|---|---|
| Pan | Drag empty canvas, or space + drag |
| Zoom | Wheel / pinch |
| Fit to view | `F`, or header **Fit** |
| Tidy / auto-layout | `T`, or header **Tidy** |
| Select | Click; shift-click to add; marquee drag |
| Move | Drag a selected card (moves the whole selection) |
| Create | Drag from the palette, or a quick-add affordance on the canvas |
| Connect | Drag from a card's edge handle to another card |
| Fold / unfold | The card's fold toggle; fold-all from the header in embeds |
| Rename graph | Click the title |
| Undo / redo | `⌘Z` / `⌘⇧Z` and the header group |
| Delete | `Delete` / `Backspace` on the selection |
| Comment | Comment affordance on a card or the canvas |

**Every mutation goes through a single `commit(label, mutator)` path** that pushes an undo entry with a human-readable label ("Add note card", "Tidy layout"). That label surfaces in the Undo tooltip. Preserve this: a graph editor without labelled, reliable undo is unusable, and it is the first thing users test.

Auto-layout runs on load (200ms after mount) and on demand. In read-only mode the viewer **fits** rather than re-laying-out, so a published graph keeps the author's composition.

---

## 4.4 Comments

Comments are anchored to a card (by node id, with the card's Arabic recorded as the anchor text) or to the canvas. Each: `{ id, who, text, nodeId, anchor, ts, color }`. They are listed in a comments surface and marked on their cards.

Prototype persists to `jadhr-comments`; production needs threads, resolve/unresolve, mentions, and notification. See `10-open-questions.md` §5.

---

## 4.5 Publish

**Publish** captures a **full-fidelity document** — `{ nodes, edges }` deep-cloned, including positions, folds, and frames — plus metadata: `slug`, `title`, author, updated date, description, and counts (`cards`, `roots`, `words`). It then redirects to `/g/<slug>`.

Critical properties:
- The published record stores the **document**, not a rendering. The public page mounts the real editor read-only.
- A **legacy-format fallback** exists for records saved before the `doc` field. Keep an equivalent versioning path in production — published graphs are citable and must never break.
- `fork` counts and `cited` counts live on the published record.
- Forking (`?fork=<slug>`) deep-clones the document into a new editable graph and increments the original's fork count.

### Read-only embed parameters
`view=<slug>` · `embed=1` (no chrome) · `entry=0|1` · `folded=0|1` · `theme=light|dark`

### postMessage protocol
The embed listens for, from the parent:
- `{ type: 'jadhr-fit' }` — fit to view
- `{ type: 'jadhr-fold', folded: boolean }` — fold or unfold all cards

and posts to the parent:
- `{ type: 'jadhr-card', id, ar }` — a card was folded/unfolded or selected

Both the **Published Graph** page and the **Classroom** shared workspace depend on this. In a real app these become component props and callbacks — but keep the iframe-embed path working too, because external embedding of published graphs is an explicit product goal (see Data & API).

---

## 4.6 State

| Concern | Prototype key | Production |
|---|---|---|
| Graph document | in-memory + `Import`/`Export` JSON | Server-side document with revision history |
| UI state (sidebar open, palette help, theme) | `lexicon-editor-v5-ui` | Client-local |
| Theme | `jadhr-theme` | Shared, client-local |
| Comments | `jadhr-comments` | Server-side |
| Published graphs | `jadhr-published` | Server-side, addressable by slug |

**Read-only mode must never write.** The prototype guards this by skipping the UI-state read and forcing `sel = []` when `view` is present. Enforce it at the API layer too.

---

## 4.7 Sub-components

`Field.dc.html` (280×60) and `Card Field.dc.html` (300×64) are the editable field rows used inside cards. Both take a field model and manage a local draft that commits on blur or `Enter`, reverts on `Esc`. `Card Field` adds an editable label and a tag input. Build these as one controlled field component with two density variants.
