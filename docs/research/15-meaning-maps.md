# 15 · Meaning maps (P8.4)

Date: 2026-10-04. Scope: PLAN P8.4 — "an editorial relation table in the workbench — one row per edge (near-synonym with its «فرق» note, contrast, antonym, wujūh sense, ḍidd, field member), each with source work, locator, quote, verses, editor and review status. Seeds … al-ʿAskarī's al-Furūq, the wujūh books, Ibn al-Anbārī's al-Aḍdād, and for semantic fields Ibn Sīda's al-Mukhaṣṣaṣ and al-Thaʿālibī's Fiqh al-Lugha; Arabic WordNet v2 only as editor-side candidates … near-synonymy plus the classical «فرق», not full synonymy … Users add their own links with a relation label." Research 13 §3 (QAN-10): "a meaning-graph layout (roots in one column, shared verses beside them)".

## 1. What is held

Measured on the loaded dataset 2026.10.0 (`content.relation_candidates`, 0008), every row `extracted`:

| Type | Source | Rows | Mapped to a root | Both ends mapped | With verses |
|---|---|---|---|---|---|
| furūq contrast | al-ʿAskarī, al-Furūq | 920 | 705 | 512 | 195 |
| near-synonym candidate | al-ʿAskarī (derived from the contrasts) | 542 | 542 | 542 | 0 |
| near-synonym candidate | al-Dāmaghānī (a sense named by another word) | 946 | 946 | 946 | 916 |
| near-synonym candidate | Ibn al-Jawzī, Nuzhat al-Aʿyun (likewise) | 791 | 791 | 791 | 780 |
| wujūh sense | al-Dāmaghānī | 2,345 | 2,217 | — | 2,258 |
| wujūh sense | Ibn al-Jawzī | 1,659 | 1,528 | — | 1,632 |
| ḍidd | Ibn al-Anbārī, al-Aḍdād | 355 | 188 | — | 105 |

Every row keeps the book's words verbatim (`text_ar`), its locator and page, and the verses it cites. The reader's word panel shows them per lemma (`/words/{slug}/relations`), said to be extracted and not reviewed. The two field works are in the same OpenITI release the other four were fetched from (`0458IbnSidaMursi.Mukhassas`, `0429AbuMansurThacalibi.FiqhLugha`; research 06), not yet fetched.

## 2. Principles

- **The books' relations, reviewed by the board; never ours.** An edge between two roots is one a classical author drew — al-ʿAskarī's «الفرق بين…», a wujūh book naming a sense by another word, Ibn al-Anbārī's ḍidd — quoted with its locator. Nothing is inferred from co-occurrence or a model (L2).
- **Near, with the difference — never "synonym".** A pair from al-Furūq is near in meaning *and* al-ʿAskarī's words say how they differ; the edge carries those words. A pair from a wujūh book is near in one sense, which the edge names.
- **Reviewed before it is drawn as the dataset's.** The board's verdict on each candidate (P3.0's verdict layer `relation_candidates`) puts it in force: reviewed, corrected, or rejected. The commonest defect is a wrong root on one end (a headword mapped to the wrong root), so a correction can re-map either end to another root, not only add words.
- **Unreviewed is said, not hidden.** The extracted candidates stay readable in the word panel and the map's Meaning panel, marked "extracted, not reviewed"; a reader may put one on their own map as their own link, carrying its source and the same mark (L3). Only reviewed edges are drawn by the map itself.
- **The reader's own links stay theirs** (P8.1a's typed relations), never mixed with the dataset's.

## 3. Model

No new table: the edge *is* the candidate row, and the board's verdict is the editorial record (who, when, revision, note — `editorial.entries`, kind `verdict`, target `relation_candidates:{id}`). The verdict's value gains, for this layer only, `ends: {root?: key, target_root?: key}` — a re-mapping checked against `content.roots`. In force = the latest approved verdict reviewed or corrected (with its ends applied); rejected rows are left out.

| Candidate type | Edge on the map (P8.1a relation) | Its words |
|---|---|---|
| furūq contrast | root ↔ root, `near-in-meaning` | al-ʿAskarī's «الفرق بين…» passage, as the «فرق» |
| near-synonym candidate | root ↔ root, `near-in-meaning` | the sense the book names, and the sense's passage |
| wujūh sense | word → verse, `wujuh-sense` | the sense's passage, its verses |
| ḍidd | word → note, `didd` | Ibn al-Anbārī's passage |

## 4. Read path

- `GET /roots/{root}/relations` — the edges in force on a root, each with its type, both ends (root key, the book's words for each), the quote, the source (work, author, death year, locator, page), its verses and the board's verdict; and how many extracted candidates on the root still wait for review.
- `GET /relations?roots=a,b,…` (≤ 50 roots) — the edges in force among a set of roots, and for each pair the verses where both roots occur in the corpus (counted, never interpreted): the "shared verses beside them".
- `/words/{slug}/relations` marks each row with the board's verdict (P3.0c's `review`), applies a corrected re-mapping, and leaves out rejected rows.

## 5. The map

A meaning map (P8.1a type `meaning`): from a root card, "Related roots" adds the roots in force with their edges, each edge named with its relation and carrying its source and quote; the layout puts roots in one column and the verses they share beside each pair; a pair's shared verses come in as verse cards on request. The Meaning panel of a root lists, under the reviewed relations, the extracted candidates marked as such, each addable as the reader's own link.

## 6. Build order

- **P8.4a — the relation layer reviewed and served (API + workbench):** the verdict's `ends` for this layer; the workbench's relation rows with both ends, their roots, the quote and verses, a re-mapping when corrected; `GET /roots/{root}/relations`, `GET /relations?roots=`; the word panel's rows marked. Tests: a re-mapping refused for an unknown root; an approved verdict brings an edge into force on both roots with its ends corrected; a rejected one stays out; shared verses counted from the corpus.
- **P8.4b — the meaning map (web):** "Related roots" on a root card, the edge naming its relation with its source, the layout, shared verses on request, the Meaning panel's reviewed and extracted relations with "add as my link". Both themes, desktop and phone, axe.
- **P8.4c — field seeds:** al-Mukhaṣṣaṣ's and Fiqh al-Lugha's chapters fetched at the pinned OpenITI release, cut into field-member candidates (a chapter's heading, the words it lists, mapped to Quranic roots with confidence), loaded as a new candidate type for the board; a field note on the map gathers its members. Arabic WordNet v2 is not fetched for readers at all: D27 keeps it to editor-side candidates, which the workbench can take later from a pinned copy if the board asks.

## 7. Not in this step

The review of 7,558 candidates is the board's (D15). Until it is appointed, no edge is in force outside the test suites, and the map offers the extracted candidates only as marked, reader-owned links.

## 8. Status (2026-10-04)

- **P8.4a** (commit 141c7ab): the verdict on a relation row may map either word to another root (a correction, checked against the corpus); relations in force on a root and among a set (`/roots/{root}/relations`, `/relations?roots=`); the word panel's rows marked with the board's verdict, following a re-mapping, rejected rows left out; the workbench's relation rows with both words and their roots.
- **P8.4b** (commit 6162b5f): Related roots on a root card; a link's panel quoting the book by the relation's id and adding the verses two roots share (`/relations/{id}`, `/roots/{root}/shared`); the Meaning panel's reviewed relations and the extracted pairings, said to be, addable only as the reader's own dashed link.
- **P8.4c** (commit a1df7fa): the two field works fetched at the pinned OpenITI commit and registered with their pins; a new candidate type `field_member` (migration 0025); al-Thaʿālibī read faṣl by faṣl from the first bāb to the start of Sirr al-ʿArabiyya (the introduction and the second part are not fields), a member being a word a chapter defines with «… فهو X», the defining sentence its text, the edition's footnote numbers dropped by an opt-in cleaning rule; al-Mukhaṣṣaṣ read heading by heading with its place in the book, a member being the word an authority is quoted on, kept only when it is a Quranic noun's spelling exactly and not metalanguage («الجمع»، «الإنسان»).

| Work | Fields | With members | Members | Roots | Read by hand (a random 25) | Shown to readers before review |
|---|---|---|---|---|---|---|
| Fiqh al-Lugha | 140 | 110 | 479 | 369 | 24 right (one root wrong: «سوآء» → سوي) | yes, marked extracted |
| al-Mukhaṣṣaṣ | 404 | 208 | 513 | 299 | about 20 right before the metalanguage list (errors: «الجمع», «الإنسان», «الخب» → خبأ) | no (`shown_extracted: false`) |

A field on the map is one note card per chapter (`field:{entry}`) that each member's link joins; the reader's word panel lists the fields whose chapters name a word of the root, with the chapter, its place in the book and the sentence. Arabic WordNet was not fetched: D27 keeps it to editor-side candidates and the board has not asked for it.

Known limits, said where they show: a member is mapped to a root, not a lemma, so a field shows under every word of the root («سبع» the beast's chapter under «سبع» the number) — the panel says "a word of this root" and quotes the sentence; the reviews themselves are the board's (D15).
