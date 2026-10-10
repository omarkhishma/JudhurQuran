# 26 · Phase 2 of the vision, clause by clause (P19)

Audited 2026-10-10 at `1150ea4` against the owner's own words ("Phase 2" in `Quran Idea.md`), itemised as PV-01…26 in PLAN §6a. Each row names what was built, where a reader meets it, and the test that holds it; "owner" marks what only the owner can supply. Commits are on `build/vision`.

**Status rules.** `done` — built, tested, met. `done, content pending` — built and tested; the content it shows is the administration's to enter. `adapted` — met in another form than the words suggest, the reason given.

## 1. Summary

| | Clauses | done | done, content pending | adapted |
|---|---|---|---|---|
| Layers of meaning (PV-01…05) | 5 | 4 | 1 | 0 |
| The administration's context and dashboard (PV-06, 07) | 2 | 0 | 2 | 0 |
| Search and intelligence (PV-08…17) | 10 | 9 | 0 | 1 |
| Tapping a word (PV-18…26) | 9 | 7 | 2 | 0 |
| **All** | **26** | **20** | **5** | **1** |

Nothing is left unbuilt. Five clauses wait on content only the administration can give: the contexts and the near and opposite words are entered by people, as the owner's text says, and none is entered yet in production. One clause is met in another form: "ask questions in natural language" is answered from the data, with no language model writing any answer (D35; the owner's decision on a parser that only reads questions is B65).

## 2. Clauses

| ID | The owner's words | Status | What was built, where | Held by |
|---|---|---|---|---|
| PV-01 | "Each word would have several layers of meaning: a lexical meaning" | done | The word panel's «المعنى المعجمي»: the dictionaries' articles, the gharīb books' meaning at the word, Lane, al-Mufradāt (P15, `88bdcdd`) | `word-layers.spec.ts`, `meanings.spec.ts` |
| PV-02 | "a semantic meaning" | done | «المعنى الدلالي»: the wujūh of the word, the furūq between near words, the aḍdād, its semantic fields and topics, and the administration's near, related and opposite words (P15) | `word-layers.spec.ts`, `journey-g.spec.ts` |
| PV-03 | "a contextual meaning" | done | «المعنى السياقي»: the context's verses with the word marked, the meaning at this place from the Tafsir Center and al-Muyassar (P13 `8db9281`, P15) | `word-layers.spec.ts`; `test_context_api.py` |
| PV-04 | "and maybe more in the future" | done | Six layers today (contextual, lexical, semantic, morphological, grammatical, readings and spelling), each a `LayerId` with its door on the data card; a layer is added by one entry and its body (D30) | `word-layers.spec.ts` (every layer present) |
| PV-05 | "this context would not be determined only by the single verse … but also by a group of surrounding verses that come before and after it, whenever those verses form one connected and coherent idea" | done, content pending | A context is a range of verses: a sūra's passages (each a coherent idea, set by the administration against the commentators' own groupings) or a word's own range; resolution: the word's own, else its passage, else "not set yet", with the commentators' groupings shown as candidates, never as the answer (D32) | `test_context_api.py`; `journey-g.spec.ts` |
| PV-06 | "this contextual range would be defined by a human (Admin)" | done, content pending | Only the administration's people set contexts and relations; they come into force by an administrator's publication, held by a database trigger (D31); the board reviews after (P14 `2de7672`, `b686ead`) | `test_editorial_api.py`; `admin-dashboard.spec.ts` |
| PV-07 | "a dashboard where he can define, for each word, where its relevant context begins and ends … the exact surah and verse where the contextual passage starts, and the exact verse where it ends" | done, content pending | `/workbench`: what is defined and where, the 114 sūras shaded by the share of their words with a context; a sūra's passages drawn against the sources' boundaries; a word's own range by sūra:verse "from" and "to", with its meaning there on a source; roles (P14) | `admin-dashboard.spec.ts`; `journey-g.spec.ts` |
| PV-08 | "Search the Quran by 'roots' … in Arabic and English" | done | Roots by letters in any spelling, by transliteration, by English gloss (P4.1, existing), and the root builder | `search.spec.ts`; `test_search_engine.py` |
| PV-09 | "… 'meaning' in Arabic and English" | done | Search by meaning (P17): an open model on our server (e5-large, 8-bit, chosen by research 25), fused with the sources' words; «قريبة في المعنى» in search and the omnibox; a verse's nearest verses | `test_semantic_api.py` (with research 25's floor); `semantic.spec.ts` |
| PV-10 | "Explore the Quran using state-of-art visualization techniques" | done | The chart kit (bars, sūra columns, heatmaps, the 604 pages, a similarity matrix, a force network, radial mind maps, a log line), each with its table, keyboard reach, both themes, phone layouts (P16, D36) | `stats.spec.ts`; `mindmap-layout.spec.ts` |
| PV-11 | "ask questions in natural language" | adapted | `/ask` «اسأل القرآن» (P18): a question in Arabic or English read as an intent and its terms by rules, then by the nearest example questions, then by meaning; answered from the data and the sources only, "understood as" shown and editable. No model writes an answer (D35, law L2); the bank reads 98.3% (tuned on) and 96% of held-out questions | `test_ask_api.py`; `ask.spec.ts`; `journey-h.spec.ts` |
| PV-12 | "Analyze the text" | done | The Analyser for any Arabic text (P4.3, existing); a sūra's analysis in numbers (`/stats/surah/{n}`); questions that analyse (counts, spread, comparison) | `analyse.spec.ts`; `stats.spec.ts`; `ask.spec.ts` |
| PV-13 | "acquire detailed statistics" | done | `/stats`: the Quran in numbers, frequency by root, word, pattern and part of speech in any scope, sūra sizes; every number recounted by the tests from the tables (P16, `72146f6`) | `test_stats_api.py`; `stats.spec.ts` |
| PV-14 | "find hidden patterns and relations" | done | Collocations with PMI and Dunning's G², the roots' network, the sūras' similarity clustered, rank–frequency (P16); verses close in meaning and each verse's nearest verses (P17); all descriptive, each saying what it counted (L4) | `test_stats_api.py`; `test_semantic_api.py` |
| PV-15 | "interactive visualization like charts" | done | Every chart answers a hover or a press with its figures and opens what it names (a sūra, a root, a page) | `stats.spec.ts`; `journey-h.spec.ts` |
| PV-16 | "heatmaps" | done | Roots × sūras, the mushaf's 604 pages per root, the sūras' similarity matrix; on a root's page and in the concordance (P16) | `stats.spec.ts`; `mindmap-layout.spec.ts` |
| PV-17 | "in addition to the graphs and mindmaps" | done | The map editor (P8, existing) with «ذهنية» arranging any map as a mind map; a word's and a root's mind maps (`/mindmap`) (P16) | `mindmap-layout.spec.ts`; `stats.spec.ts` |
| PV-18 | "when tap it select the tapped word, show its meanings and data" | done | Tapping a word opens its panel: the data card and the layers of meaning | `journey-g.spec.ts` (desktop and phone) |
| PV-19 | "(root, …" | done | The data card's root, a door to its family | `word-layers.spec.ts` |
| PV-20 | "how many times it mentioned, …" | done | Occurrences with verses and sūras, Meccan and Medinan, the root's count | `word-layers.spec.ts`; `journey-g.spec.ts` |
| PV-21 | "related topics, …" | done | The word's topics (Quranpedia, QSAC, credited) on the card and in the semantic layer | `word-layers.spec.ts` |
| PV-22 | "words with similar meaning or close to or related (these similar words are defind by the admin/owner), …" | done, content pending | The administration's near and related words, set in the dashboard, read both ways, shown first in the semantic layer; the books' candidates offered to the administration, never shown as its choice | `admin-dashboard.spec.ts`; `journey-g.spec.ts` |
| PV-23 | "words with opposite meaning (also defind by the admin/owner), …" | done, content pending | The administration's opposite words, the same way | `admin-dashboard.spec.ts`; `journey-g.spec.ts` |
| PV-24 | "its morphological balance, …" | done | The wazn on the card; the morphological layer with the pattern's function and the Center's sarf statement | `word-layers.spec.ts`; `journey-g.spec.ts` |
| PV-25 | "etc..." | done | The card's context, pattern and topics; the grammatical layer (the corpus's tags, the Center's iʿrāb of the word and the verse); readings and spelling | `word-layers.spec.ts` |
| PV-26 | "and it list all other word an verses from the same root with allowness to interact with them and redirect to them" | done | «أسرة الجذر» lists the root's words, each opening in the panel; «في القرآن» lists the verses, each leading to its place; the concordance and the root's page one press away | `journey-g.spec.ts` (the root's words, one opened in the panel; its verses listed) |

## 3. Budgets (measured 2026-10-10, the development API, each question asked once)

| What | Budget | Measured |
|---|---|---|
| The semantic part of a search (embedding over HTTP, search, fusion) | < 250 ms | p50 57 ms, p95 69 ms (40 questions) |
| `/ask` | the panel's < 200 ms p95 | p50 38 ms, p95 128 ms (60 questions; the first call, 1.6 s, reads the indexes once) |
| `/verses/{key}/similar` | < 200 ms | p95 4 ms |
| A whole search with its meaning group | (none set before) | p50 162 ms, p95 442 ms — the lexical groups' share is the search's as it was |

## 4. What remains, and whose

- **Owner (content):** the contexts of the Quran's words and their near, related and opposite words, entered in `/workbench` by the administration the owner appoints (an administrator is made by `python -m jadhr_api.roles <email> admin`, DEPLOY.md). Until then every word says its context is not set and shows the commentators' groupings as candidates.
- **Owner (decisions):** D30–D36 as built (PLAN §6a); B65 (a hosted parser for questions, its cost and the question leaving the server) and B66 (a second embedding model for English).
- **Data limits, said plainly:** an English name the data does not hold ("Mary", "Pharaoh": the corpus glosses them "Maryam", "Firaun", and their entities have no Wikidata link yet) is not resolved; such a question falls back to a search by meaning and says so. B67 proposes the names from Wikidata.
