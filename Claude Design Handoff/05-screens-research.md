# 5 · Research screens

All four wear the shared shell (`01-product-and-ia.md` §1.4). Each loads `lexicon-data.js` and `jadhr-chrome.js` on mount — in production, each is a route that fetches from the API described in `08-api-contract.md`.

---

## 5.1 Library

`prototypes/Library.dc.html` · route `/library` · `?add=1` opens the add sheet.

**Purpose:** the shelf of texts the user can read, and the only way new text enters the product.

**Layout:** shared header, then a filter row, then a grid of text cards.

**Text card:** type dot · Arabic title in Amiri RTL · English title · kind (`Qurʾān` / `Ḥadīth` / `prose` / `user`) · meta (chapters, passages) · **a progress indicator** drawn from reading progress · a words-encountered count drawn from word states. Clicking opens the Reader with `?book=<id>`.

**Filter:** `All` plus the available kinds.

**Add a text** — a sheet with three modes:
| Mode | Prototype | Production |
|---|---|---|
| **Paste** | Textarea + title field; text is split into passages and tokenised client-side | Server-side tokenisation and morphological tagging pipeline |
| **URL** | URL field, stubbed | Fetch, extract, sanitise, detect Arabic, tokenise |
| **PDF** | Stub only | **Genuinely hard.** Arabic PDF → correctly ordered, diacritic-preserving text. See `10-open-questions.md` §3 |

User texts persist (`jadhr-texts`) and **appear in the Reader's rail automatically** — the Reader merges them with the built-in texts on mount, skipping duplicates by id.

**Empty state:** a prompt to add the first text, with the three modes offered directly.

---

## 5.2 Search

`prototypes/Search.dc.html` · route `/search` · `?q=`.

**Purpose:** one search box over everything.

**Four result kinds**, each independently toggleable via chips: **Words · Roots · Patterns · Passages**. All on by default.

**Query type detection** — the input is classified as the user types (Arabic word, transliteration, English gloss, root, pattern, empty) and the detected type is shown back to the user with a label. This is the honest-feedback affordance that makes a multi-kind search comprehensible; keep it.

**Root builder** — three separate single-letter inputs for entering a root consonant by consonant, for users who know the root but not the word. This is a distinctive and genuinely useful control; it must be keyboard-navigable (typing advances to the next box, backspace returns).

**Result rows:** the match, its kind, and its meta — word results show the **Arabic root in Amiri**, pattern results show the function, passage results show the reference with the keyword emphasised.

**Empty state routes to Ask mode** in the Reader (`?mode=ask`) — a user who searched and found nothing is offered the plainest path, not a dead end.

**Search must be diacritic-insensitive and match across Arabic, transliteration, and English gloss simultaneously.** See `09-search-architecture.md` §4.1.

---

## 5.3 Concordance

`prototypes/Concordance.dc.html` · route `/concordance` · `?root=<key>` or `?w=<wordId>` · `?view=kwic|dist`.

**Purpose:** see every occurrence of one root across the corpus, the way a philologist would.

Root selection falls back through: explicit `root` → the root of `w` → the root in shared cross-page context → `ilm` as the default. This fallback chain matters: arriving here from the Reader must never show an empty page.

**Two views**, a segmented control:

**KWIC (keyword in context)** — the classic three-column concordance: left context · **keyword** · right context. The keyword column is narrow and the context columns **hug it** so the eye can scan the keyword vertically. Context columns are explicitly labelled **←** and **→** so the direction is unambiguous in an RTL context — this was a specific fix and is essential for Arabic.
- Sort control: by **left** context or **right** context (standard concordance sorts)
- Pattern filter: restrict to occurrences of one *wazn* within the root family
- Each row links to the passage in the Reader

**Distribution** — where in the corpus the root occurs: per text, per chapter, and across the historical corpora (pre-Islamic poetry · Qurʾān · Ṣaḥīḥ al-Bukhārī), with frequency figures in `IBM Plex Mono`.

---

## 5.4 Analyser

`prototypes/Analyser.dc.html` · route `/analyse` · `?q=<text>`.

**Purpose:** paste any Arabic and get it broken down word by word.

**Input:** a text field, prefilled with a sample phrase. **View toggle:** `table` / (alternate view).

**Per-token output** — the prototype's `analyse()` function in `lexicon-data.js` is a readable reference implementation of the intended output shape:

```js
{
  surface: 'وَالمَكْتَبَةِ',
  segments: [ { t:'وَ', g:'conj.', kind:'pre' },
              { t:'المَكْتَبَة', g:'stem', kind:'stem' },
              { t:'ِ', g:'gen.', kind:'suf' } ],
  candidates: [ { root: {…}, score: 0.99, word: {…} }, … ],  // ranked, deduped, max ~3
  word: {…} | null,
  pattern: 'مَفْعَلَة',
  gram: 'conj. · gen.',
  confidence: 0.99
}
```

**Table columns:** surface form · segments (as chips: prefix / stem / suffix, each with its grammatical label) · candidate roots with confidence · pattern (*wazn*) · grammatical summary.

Design decisions to preserve:
- **Columns are fixed-width and must not bleed into each other** — segments, root, and wazn each own their column. This was broken and fixed.
- **Affixes render as chips**, visually distinct from the stem.
- **Harakat-only segments are dropped** — a segment that is nothing but a vowel mark is noise.
- **Particles show `—`** in the root and pattern columns rather than a bogus guess.
- **Confidence is always shown.** Never present a guess as a fact.
- Candidate roots are clickable → Concordance or the Reader panel.

**Production:** the prototype's affix-stripping heuristic is a placeholder. Real analysis needs a proper morphological analyser — see `09-search-architecture.md` §5 and `10-open-questions.md` §1. **But keep the output contract above**, including ranked candidates with confidence scores, because the whole UI is built on the assumption that analysis is ambiguous and says so.
