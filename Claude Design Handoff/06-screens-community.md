# 6 · Hub, explore, and community screens

---

## 6.1 Hub

`prototypes/Jadhr.dc.html` · route `/`.

The landing page and the product's front door. Three parts:

1. **Masthead** — the name جَذْر with its meaning, and one sentence stating the product's premise (words come in families; this shows you the family).
2. **Search box** — routes to `/search?q=`. Prominent, the primary action.
3. **Context strip** — "pick up where you left off", built from shared cross-page context and reading progress. Shows the last text, the last word, the last root. Hidden when there is nothing to resume.
4. **Destination cards** — one per major surface: Read · Explore · Look up · Library · Concordance · Analyser · Graph · Notebook · Review queue · Classroom · Data & API. Each with a one-line description of what it is *for*, not what it is called.
5. **Local-first sign-in prompt** — states plainly that everything works without an account and that signing in syncs across devices. Never a blocking modal, never a wall. Dismissible.

---

## 6.2 Collections

`prototypes/Collections.dc.html` · route `/explore` · `?set=<id>`.

The casual explorer's home.

- **Word of the day** — chosen **deterministically from the date**, so every user sees the same word on the same day and it is cacheable and shareable. Presented as a large card: Arabic in Amiri, meaning, root, one attestation, opens the Ask card.
- **Progress without streaks** — a deliberate design decision. Progress is shown as words met and sets advanced; there is **no streak counter and no loss-aversion mechanic**. Do not add one.
- **Four curated sets** built from the corpus data. Each set is a guided list; each item offers **Open** (→ the Reader's Ask card) and **Keep** (marks the word `learning`). Root chips are shown per item.
- **"See the set as a map"** — seeds the graph editor with the set.
- **"Study this set"** — opens a **swipe deck** over the collection:
  - Front: the word + audio. Tap or `space` flips to the meaning.
  - Swipe, or `←` / `→`: **Skip** / **Keep**.
  - **Keep** marks the word `learning` **and** stars it, which pulls its whole root family into the review deck.
  - An end card links to Review.

---

## 6.3 Review Queue (editorial)

`prototypes/Review Queue.dc.html` · route `/review` · `?filter=`.

**Not the study deck.** This is the editorial queue for sense-edit proposals coming from the Reader's "Suggest an edit".

**Layout:** filter segmented control · list of proposals · detail pane for the selected proposal.

**Filters:** `Open` (default) · `Approved` · `Merged` · `Declined`.

**Proposal detail:** the word and the specific sense, the current text, the proposed text, the rationale, the sources cited, the proposer, the timestamp, and the approvals so far.

**Rules — these are the product's moderation logic and must be implemented exactly:**
- A proposal needs **two distinct approvals** to merge.
- **No double-approve**: the same reviewer approving twice is a no-op.
- **No self-approve.**
- Deciding on a proposal **moves the selection to the next item** so a reviewer can work through the queue without re-clicking.
- **Switching filters selects the first item** in the new filter, never leaving an empty detail pane.
- Each filter has **its own empty-state copy** — "nothing open" reads differently from "nothing merged yet".
- Reviewers can attach a note to a decision.

**On merge:** the sense text is rewritten in the Reader **with a credit line**, the merge appears in the Data & API changelog, and it appears on the contributor's Profile. This chain is the reason contributors participate; do not break any link in it.

---

## 6.4 Notebook

`prototypes/Notebook.dc.html` · route `/notebook` · `?tab=notes|journal`.

**Two tabs:**

**Notes** — notes created from the Reader (on a word, on a passage, as marginalia, or as a saved trail). List + editor. Search box, grouping control (`All` plus groups), tag input. Notes carry `{ id, body, tags, wordId?, passageKey?, ts }`. Notes anchored to a word or passage link back to it in the Reader.

**Journal** — a reading journal: sessions over time, what was read, which roots were met, how long. Built from the session log.

Empty states point at the Reader with the specific action that creates the first note.

---

## 6.5 Classroom

`prototypes/Classroom.dc.html` · route `/classroom` · `?tab=assign|shared`.

**Assign tab:**
- Lesson builder — assemble a lesson from passages and roots
- **Cohort heat-map** — a grid of learners × roots, with a **layer** selector (`lookups` / `confirmed` / `struggling`). Cell intensity encodes the metric. **Line boxes are tight** — the grid reads as a dense matrix, not a spaced-out table. Clicking a cell focuses that learner/root pair.
- Focus detail for the selected cell

**Shared tab:**
- A shared workspace mounting the **real graph editor** read-only (`view=<slug>&embed=1`), driven through the postMessage protocol in `04-screen-editor.md` §4.5
- **Activity feed** — `{ who, text, when, color }` entries, each colored by the type of thing touched, e.g. "added التَّعَلُّم under تَفَعُّل" · "asked about يُدْرَكُ · 2 replies" · "confirmed 3 cards · tagged topic Knowledge". The feed must show *what changed*, in the product's own vocabulary, not generic "User edited graph" strings.
- Side panel toggle: `Activity` / other side content
- A comment draft field
- Per-card confirmation state (instructor confirms learner contributions)

**Production:** this is the screen that most needs real multi-user infrastructure — presence, live feed, permissions (instructor vs learner), cohort membership. See `10-open-questions.md` §5 and §6.

---

## 6.6 Published Graph

`prototypes/Published Graph.dc.html` · route `/g/<slug>`.

The public, citable page for a published graph.

- **Graph list** — a sidebar of published graphs including a built-in **sample** so the page is never empty on a fresh install.
- **The graph itself** — an iframe mounting the real editor in read-only mode. **Not a screenshot.**
- **Display options**, which map straight onto embed parameters: `entry` (show the entry sidebar) · `folded` (start folded) · `dark`.
- **Selected-card strip** — populated from the `jadhr-card` postMessage the embed sends when a card is folded or selected.
- **Metadata** — title, author, updated date, description, counts (cards / roots / words), **fork count**, **cited count**.
- **Actions** — Fork (→ editor with `?fork=<slug>`) · Cite · Open in editor · copy an embed snippet.
- A toast surface for copy confirmations.
- **Tolerant of legacy records**: graphs saved in the pre-`doc` format still render.

---

## 6.7 Profile

`prototypes/Profile.dc.html` · route `/me` · `?tab=`.

**Four tabs:** `Contributions` · `Graphs` · `Library` · `Journal`.

Each lists the user's own records with links back to the source surface. Every tab has **specific** empty-state copy naming the action that fills it — e.g. Contributions: "No proposals yet — use 'Suggest an edit' on any sense in the Reader." Graphs: "Nothing published yet — publish from the graph editor."

**Data controls — a first-class part of this screen, not a footer link:**
- **Export everything** — downloads a single JSON of all the user's data
- **Export texts** — downloads just the library
- **Delete local data** — **two-step confirmation**: the button's own label changes to "Click again to delete all local data". No modal.

Graph rendering here is **tolerant of legacy formats**.

**Production:** account settings, sign-in/out, and the anonymous→account migration also live here. Keep export and delete — they are a stated product commitment, and with a real backend they become GDPR-shaped obligations rather than conveniences.

---

## 6.8 Data & API

`prototypes/Data & API.dc.html` · route `/data` · `?tab=data|api`.

The scholarly-credibility screen.

**Data tab:**
- **Dataset download** in four formats: **JSON · TEI · LMF · CSV**. TEI and LMF are the lexicography standards; their presence is the signal that this is a serious project. CSV export is a flat `id,ar,tr,root,pattern,pos,en`.
- **License and citation** — the prototype shows `CC-BY-SA`, a version string (`v2026.09`), and a DOI placeholder, with the citation offered as **BibTeX / RIS / plain**.
- **Changelog** — every merged proposal appears here. The page **re-reads on window focus and visibility change** so a merge in another tab shows up immediately.
- Dataset statistics.

**API tab:**
- An **API playground**: endpoint selector (`lookup`, etc.), a parameter field (prefilled with an Arabic example), a **Run** action, the JSON response, and a response time in ms.
- Endpoint documentation.

**Production:** the real dataset export needs to be a generated, versioned, DOI-registered artefact — not an on-the-fly client-side dump. Version it, archive it (Zenodo or equivalent), and make old versions permanently retrievable, because published citations will point at them. The license claim depends on the source-licensing question in `10-open-questions.md` §1 and **must not ship unresolved**.

---

## 6.9 Split Shell

`prototypes/Shell.dc.html` · route `/split`.

Reader and Editor side by side, each in an iframe, with independent show/hide toggles. They stay in sync through shared cross-page context, which the shell **polls every 800ms** in the prototype.

**Production:** with both surfaces as components in one app, replace the polling with shared application state. Keep the split view itself — it is the power-user surface where a scholar reads with one hand and builds the graph with the other.
