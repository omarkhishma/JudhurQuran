# 22 · Ecosystem coverage — P11 against the plan, the design inventory and the code

Audited 2026-10-04 against commit `72eb8d4` (branch `build/vision`). Scope: phase P11 "The ecosystem — dictionary, hadith, books" of `docs/PLAN.md` (P11.1–P11.5 with every clause of their bullets) and the design inventory's ecosystem items (research 05: SHL-Q03, SHL-Q09, HUB-Q05, LIB-Q02, LIB-Q03, LIB-Q05, LIB-Q08, SRC-Q03, SRC-Q07, CON-Q03, CON-Q06, CON-Q09, ANA-Q01, ANA-Q05, RVQ-Q11, NTB-Q04, PRF-Q07, DAT-Q07), from the baseline in research 21.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, the reason in DECISIONS or in the row. `partial` — part built, the rest named with its reason. `owner` — waits on a decision only the owner can take (§3). A row is `done` only where a test or a screenshot read by eye shows it.

**Evidence.** Pipeline: `test_books.py` (13: paging, slipped markers, markup by library, verse references, the card, no word lost and no markup left on all 37 books), `test_catalogue.py` (3: the D9 gate recounted from the file), `test_texts_model.py` (3: the per-text root counts and lemma sets), `test_hadith.py`, `test_isnad.py`, `test_taqrib.py`, `test_narrators.py`, `test_hadeethenc.py`. API: `test_texts_api.py`, `test_books_api.py`, `test_catalogue_api.py`, `test_intake_api.py`, `test_rootlife_api.py` (5: counts recounted from the passages, the marked word in the report, the timeline, words known), `test_analyse.py` (11, with 2,100 stored forms read alike by the API), `test_narrators_api.py`, `test_search_engine.py`. e2e: `p11-exit.spec.ts` (the exit ◆), `books.spec.ts` (14), `hadith.spec.ts`, `rootlife.spec.ts`, `library.spec.ts`, `analyse.spec.ts`, `dictionary.spec.ts`. Screenshots at 1440 and 390 px in both themes, read: the shelf, a book, a section, a paragraph, the catalogue, the root in the texts, the concordance by source, the timeline, the add-a-text sheet with a PDF, the Analyser on a lexica-only root. Full runs at the end of this audit: §4.

## 1. Summary

| Status | Rows |
|---|---|
| done | 40 |
| adapted | 5 |
| partial | 3 |
| owner | 4 |
| **total** | **52** |

Counted from the tables of §2 (each clause of P11's bullets and each ecosystem item of the inventory is one row).

The exit ◆ (P11.5: one root followed from a hadith to the Quran to a lexicon article to a book passage without leaving the product): **done** — `p11-exit.spec.ts` starts at al-Bukhārī 1, chooses «الأعمال» in its matn, follows «الجذر في القرآن» to the root's page, «كل مواد هذا الجذر في المعجم» to the dictionary's page and its nine lexica, «كل مواضعه في الكتب» to the root's passages in the books, and opens the first one's paragraph page with its citation — by links only, every expectation read from the API, on desktop and phone.

## 2. The rows

### P11.1 The dictionary as its own surface

| Clause | Status | How |
|---|---|---|
| every root and word in the nine lexica | adapted | 13,076 roots, every article filed under its root (796 left open with their candidates); words inside articles are found by search, not given pages of their own — the lexica do not mark them (PLAN P11.1 status). |
| entry pages, index browsing | done | `/dictionary`, a page per letter, a page per root (e2e dictionary.spec.ts). |
| the Quran as one layer among many | done | The root page's Quran section; now also the hadith and the books as a layer of their own (P11.4b). |

### P11.2 The hadith encyclopedia

| Clause | Status | How |
|---|---|---|
| collections in the generic text model | done | Seven texts, 36,390 records (test_texts_api). |
| isnād and matn stored apart | done | The split by rule (87.4% of records), said «تقسيم آلي», measured against Sanadset. |
| every grading with its grader and edition | done | Grades only under the graders whose rulings they are; 21,331 held back as misattributed (owner, D8). |
| empty entries patched only from a named cross-check | done | The witness in OpenITI named, never copied in silently. |
| Arabic book and chapter titles | done | OpenITI's kitāb and bāb titles. |
| narrator profiles linked from each name | done | 87.4% of 174,092 names linked, with rule and confidence; the Taqrīb profiles. |
| analysis with confidence, links to Quran roots | done | Every word opens its reading (the shared rules), its root in the Quran and the dictionary. |
| concordance across Quran + hadith | done | The concordance's source «الحديث» and the root's page of every passage (rootlife.spec.ts). |
| collections on the timeline | done | The panel's timeline carries the seven collections and the 37 books by their compilers' death, each marked where it holds the word's root, with its count (rootlife.spec.ts, test_rootlife_api). |

### P11.3 The book reader

| Clause | Status | How |
|---|---|---|
| catalogue: OpenITI metadata through the D9 gate | done | `/books/catalogue`: 6,766 works, the gate recounted from the pinned file (test_catalogue). |
| ids cross-walked: OpenITI, shamela.ws, Shamela 4, turath | adapted | Links to OpenITI's folder, shamela.ws and turath for the 1,752 Shamela ids (the turath id equals Shamela's in the print-page evidence); the Shamela 4 dump is not used by any page, so no link to it. |
| citation model: work → edition → volume → page → block, key and Arabic form | done | `urn:cts:arabicLit:<version>:<volume>.<page>.<n>`, «…، ١/٣٢، ف١٥»; the editor's numbers where the pages are not cited (the Risāla), else section and place (test_books_api). |
| a printed page cited only where its numbering matches print | done | The page-trust check with slipped markers read between their neighbours: 32 books by page. |
| only the author's text | done | Footnote markers, verse references (links now), paratext, each library's markup out; the editor's brackets kept and marked (owner: keep, mark or drop). |
| words linked to roots, with confidence | done | The shared rules (`jadhr_arabic.analysis`); the reader panel beside every paragraph. |
| word indexes aligning unvowelled OpenITI and vowelled Shamela copies | adapted | No vowelled Shamela copy is served; the matching key folds vowels, so a vowelled search finds the unvowelled text. |
| KITAB text reuse linking passages that quote each other | owner | The data is CC BY-NC-SA with terms for the owner to confirm (KITAB licence, §3). |
| P11.3a intake: paste | done | As before (LIB). |
| intake: URL main text | done | trafilatura, public addresses only (test_intake_api, library.spec.ts). |
| intake: PDF triage (presentation forms, visual order, a bad layer) | done | Sound / display order turned back / broken / scan, per page. |
| intake: OCR (Kraken, the OpenITI print model) | owner | Hosting: a CPU or GPU budget and pages a month (research 21 §5). |
| intake: correction editor, page status, ALTO/PageXML | owner | Follows OCR. |
| normalisation: Persian look-alikes in the search form, tatweel, page index apart, no vowels added | done | The matching key folds ی ک; PDF pages keep their own index; no vowel is ever added. |
| licences: permissive stack only | done | pypdf, trafilatura, python-multipart; no PyMuPDF, Surya, Marker, MinerU. |
| expectations stated in the UI (OCR error rates) | owner | With OCR. |

### P11.4 Cross-linking

| Clause | Status | How |
|---|---|---|
| every root shows its life across Quran, hadith, books and lexica | done | The Quran's and the dictionary's root pages, the page of every passage, the timeline (rootlife.spec.ts). |
| search and concordance span all texts with source filters | done | Search: the sources as facets (Quran, dictionaries, hadith, books, the reader's texts); the concordance's source. |
| one set of rules for every word | done | `vocabulary_from` shared; the API's Analyser and a reader's text read as the books are (test_analyse). |

### P11.5 Exit

| Clause | Status | How |
|---|---|---|
| exit test | done | §1. |
| coverage audit | done | This document. |
| boundary proposals | done | PLAN §8 B55–B58. |

### The inventory's ecosystem items (research 05)

| Item | Status | How |
|---|---|---|
| SHL-Q03 nav for the ecosystem | done | الحديث and الكتب in the shared nav after المعجم. |
| SHL-Q09 cross-page context generalised | done | A word looked up in a hadith or a book is the last lookup; the hub and the concordance carry its root (hadith.spec.ts). |
| HUB-Q05 destinations for the ecosystem | done | Hub tiles for the dictionary, the hadith and the books (hub.spec.ts). |
| LIB-Q02 shelf groups | done | القرآن · الحديث · الكتب · نصوصي, from the text kinds. |
| LIB-Q03 continue at a hadith number or book page | done | The shelf resumes at the last hadith or paragraph read (library.spec.ts). |
| LIB-Q05 no auto-vocalisation of Quran or hadith | done | No vowel is ever added anywhere. |
| LIB-Q08 per-user progress, per-text lemmas for known % | done | Progress per text; each text's sure content lemmas; «تعرف N من M كلمة» on every hadith and book card, the known words sent in a body and kept nowhere. |
| SRC-Q03 result kinds and source facet | done | Verses, words, roots, patterns, dictionary, hadith, books, the reader's texts. |
| SRC-Q07 hadith and book passage indices | done | One OpenSearch index of the texts' passages, two groups. |
| CON-Q03 corpus filter | done | The concordance's source. |
| CON-Q06 hadith: matn vs isnād, collection, grade | partial | The report only by design (an isnād, a name and a blessing are never counted), by collection; by grade not built: the rulings are per grader in each grader's terms («Sahih - Agreed Upon», «Isnaad Hasan»), one grader's unmapped — a filter needs the grader chosen and the terms mapped by the board (proposal B57). |
| CON-Q09 hadith structure for the concordance | done | Collection, kitāb, bāb on each line. |
| ANA-Q01 gold for tagged hadith | adapted | No hand-tagged hadith morphology is licensed; hadith words are read by the shared rules with their confidence, said so. |
| ANA-Q05 try chips with hadith phrases | done | «إنما الأعمال بالنيات». |
| RVQ-Q11 the review queue for dictionary and hadith targets | partial | The queue's model is ready for namespaced targets; the hadith's split and narrator links and the dictionary's open articles as targets are not wired (proposal B58). |
| NTB-Q04 @-mentions of hadith references | partial | The inventory puts it later; not built (proposal B58). |
| PRF-Q07 one account across the products | done | One site, one account; the export carries the reader's texts. |
| DAT-Q07 the API namespaced by product, the release | adapted | `/texts`, `/narrators`, `/catalogue`, `/roots/{key}/texts` under one API with stable uris (`hadith:bukhari:1`, the CTS keys); whether the hadith and the books enter the dataset release is the owner's (licences, §3). |

## 3. For the owner

- **OCR hosting** (research 21 §5): a CPU or GPU budget and the pages a month; then the worker, the correction editor and the error rates the UI may state.
- **KITAB text reuse**: the licence's terms for showing passages that quote each other.
- **The editor's brackets** in the books: keep and mark (as now), unwrap, or drop.
- **The 482 works of 1375–1394 AH**: in or out of the catalogue.
- **The hadith and the books in the dataset release** (D2, D14).
- Three slips the catalogue's sources print («بلاذري», «الهادي الى الحقق يحيى», «جامع أبي الحسن البسيوي جديد»): corrected by an editor, or shown as printed (as now).

## 4. Full runs

At `72eb8d4` with the dataset of that commit loaded: Python (strict, with data) 769 passed, 0 failed, 0 skipped (the recitation tests needed the pipeline's `audio` extra back in the environment); e2e against the production build 708 passed, 88 skipped (tests written for one width only), 0 failed, in 5.0 minutes.
