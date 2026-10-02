# Arabic normalisation — the one specification

Every component that compares Arabic strings uses exactly these rules: search (index and query), the glossary matcher, the Ask box, panel filters, root input, and the analyser cache key. There are two implementations — Python (`packages/arabic-py/src/jadhr_arabic/normalize.py`) and TypeScript (`apps/web/src/lib/arabic/normalize.ts`) — and both must pass every case in `vectors.json`. Nothing here is ever shown in place of a source text, except `display_bare`, which is the tashkīl-off view of non-Quranic text.

The design handoff states normalisation three different ways (`02-design-tokens.md` §2.3, `07-data-model.md` §7.1, `09-search-architecture.md` §9.2); none of them strips the Quran's annotation marks or folds alef wasla. This file supersedes all three (PLAN P1.3a).

## Functions

All functions first apply Unicode NFC.

**`strip_marks(text)`** removes, and touches nothing else:
- harakat, tanwīn, shadda, sukūn, madda and the combining hamzas: U+064B–U+065F;
- superscript (dagger) alef: U+0670;
- Quranic small high signs: U+0610–U+061A;
- Quranic annotation and pause signs: U+06D6–U+06ED (pause marks, end of āya, rubʿ al-ḥizb, small waw and yeh, small high and low signs, sajda, stops);
- Arabic Extended-A marks used by mushaf encodings, including open tanwīn: U+08D3–U+08E1, U+08E3–U+08FF;
- tatweel U+0640 and invisible format characters: U+200B–U+200F, U+061C, U+FEFF.

**`display_bare(text)`** — the tashkīl-off view: `strip_marks`, then alef wasla ٱ → ا. Hamza carriers (أ إ آ ؤ ئ) and every other letter stay exactly as written. Spacing is not changed. Never applied to the mushaf text (decision D7: the Quran stays fully vocalised; a separate labelled standard-spelling view exists instead).

**`fold(text)`** — for matching only:
- ٱ أ إ آ ٲ ٳ ٵ → ا
- ى → ي, ی (Persian yeh) → ي
- ة → ه
- ؤ → و, ئ → ي
- ک (keheh) → ك
- no-break space → space

The standalone hamza ء is not folded.

**`normalize(text)`** — the matching key: `fold(strip_marks(text))`, every run of whitespace (including newlines) collapsed to one space, then trimmed. Latin text passes through unchanged (case is the caller's concern).

## What is deliberately not here

- **Uthmani → everyday spelling** (`plain_spelling` in Python: وٰ → ا, ىٰ → ا inside a word, dagger alef → ا) is a separate, heuristic step used only to match lemmas typed in everyday spelling. It is not part of the key, because applying it to everyday text would corrupt it.
- **Skeletons** (`skeleton`: dropping long vowels and hamza) align two spellings of the same verse in the pipeline and are never used for search ranking.
- **Stemming** never decides a root. Root identity comes from the morphology data.

## Tests

`vectors.json` holds hand-written cases; each gives `input` and the expected `strip_marks`, `display_bare` and `normalize`. Combining marks are written as `\u` escapes because editors silently reorder typed marks.

- Python: `uv run pytest packages/arabic-py -q`
- TypeScript: `pnpm --filter web test`
