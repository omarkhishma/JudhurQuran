# 21 · The ecosystem — baseline and build plan (P11)

Date: 2026-10-04. Scope: phase P11 of `docs/PLAN.md` — the Arabic dictionary as its own surface (P11.1), the hadith encyclopedia (P11.2), the book reader (P11.3) with its text-intake pipeline (P11.3a), cross-linking across every text (P11.4) and the exit (P11.5) — against the vision's first line: «an Arabic dictionary, Quran and Hadith encyclopedia, and book reading site supported with the dictionary … a full eco-system for islamic topics enriching each others». Approved decisions it rests on: D8 (hadith), D9 and D9a (books, uploads and OCR), D22 (the classical texts' legal basis), D2 (non-commercial launch, every licence recorded).

Inputs, each measured on pinned files under `data/raw/` (gitignored, each folder with `SOURCE.txt` and sha256): the nine lexica (built into `data/build/2026.10.0`); `openiti-2025.1.9/` (the catalogue TSVs and a 40-work shelf, 145.4 MB); `fawazahmed0-hadith-api/` (the seven Arabic editions at `df57907`); `openiti-2025.1.9-hadith/` (OpenITI's annotated versions of the seven books and Ibn Ḥajar's Taqrīb); `sanadset-650k/` (a CC BY 4.0 subset); `mis-muslim-narrators/` (MIDS v2); `hadeethenc/` (Excel v1.7.0 and the API dump); `hadith-kg/`, `lk-hadith-corpus/`, `wikisource-hadith/`, `islamic-biographies/` (evaluation and cross-checks only, as said below); `kitab-textreuse/`. The working reports behind §3 and §4 are the research agents' of 2026-10-04; their numbers are repeated here where the plan depends on them.

## 1. Outcome

| Part | State | What decides the build |
|---|---|---|
| P11.1 Dictionary | **built** (§2) | 13,076 roots from the nine lexica, 1,642 the Quran's; every article filed under its root by evidence |
| P11.2 Hadith | data pinned; build next | the text is fawazahmed0's (D8's fallback) verbatim; four of its grader columns are misattributed and are not shown under those names; the isnād/matn split is ours, said to be machine-made; Arabic titles from OpenITI |
| P11.3 Books | shelf pinned; build next | 6,766 works pass the D9 gate (catalogue); a launch shelf of 37 works; a printed page is cited only where the version's page markers pass a build-time check; the editor's residue is stripped by a per-book profile |
| P11.3a Intake and OCR | researched (§5) | a permissive, self-hosted stack measured at about 7% letter error on Bulaq letterpress before fine-tuning; paste, URL and PDF text layers need no owner decision, OCR's hosting does |
| P11.4 Cross-linking | sized (§6) | every word of every text to its root: 77% of the shelf's words reach a Quranic form after clitics; the rest go through the patterns over the dictionary's roots, with their confidence |
| P11.5 Exit | defined | one root followed from a hadith to the Quran to a lexicon article to a book passage |

## 2. The dictionary (P11.1) — built

- **Coverage before:** the nine lexica hold 62,012 articles, but only about 1,600 per lexicon reached the site — each one only through the Quranic root it matched.
- **The registry** (`lexica/dictroots.py`, DECISIONS 2026-10-04) files every article under its root by what the lexica write and attest:
  - the Quran's match where the site shows it;
  - a three- or four-letter heading (five without the article) as its own root;
  - an alif read as a hamza or a weak radical only when one reading is attested;
  - a two-letter heading as its doubled root when attested;
  - combined headings linked to each of their roots;
  - al-Qāmūs's words linked to the Tāj root of their section.
  - Result: 13,076 roots, 1,642 of them the Quran's. 796 articles are left as written with their candidates named, and 495 headings make no root (the letters, function words and phrases).
- **The surface:**
  - `/dictionary`: the letters and the nine lexica in the order their authors died;
  - a page per letter, by root size;
  - a page per root, with every lexicon's articles and the Quran as one layer, leafing to the previous and next root;
  - search over all 61,520 filed articles and the roots;
  - links from the Quran's root pages and the reader's dictionaries.
- **Words:** al-Qāmūs's 10,389 bullet words are each an article. Inside the other lexica the words are not marked, so a word is found through search. Splitting those articles into word entries is editors' work or a later parser.

## 3. Hadith (P11.2)

### 3.1 Sources, one per need

| Need | Source and pin | Licence | Measured | Consequence |
|---|---|---|---|---|
| Text (vowelled) | fawazahmed0/hadith-api `ara-<book>.json` at `df57907` (D8's fallback until a sunnah.com agreement) | Unlicense (compilation) | 36,390 records in 7 files; 408 empty; RLM marks in 98.4%; 96.5% change under NFC | stored verbatim, compared after NFC; the `ara-X1` files are unvowelled, for search only |
| Numbering | `hadithnumber` (al-Bukhārī = Fatḥ al-Bārī; the four Sunan = their standard printings); Muslim's `arabicnumber` (ʿAbd al-Bāqī, with .01/.02) | — | anchors checked; number joins with printed-edition files agree on 98.5–99.9% | Muslim: 344 records have no ʿAbd al-Bāqī number. The Muwaṭṭaʾ's 1–1858 matches no tested edition, so it is cited by kitāb and its place there (owner may choose an edition) |
| Kitāb and bāb titles (Arabic) | OpenITI v2025.1.9 annotated versions, one per book; MIS for Muslim as a check | CC BY-NC-SA 4.0 (as D9 already accepts) | five books by number join; al-Bukhārī 6,753 of 7,589 and Mālik 1,732 of 1,858 records reach a bāb by alignment | titles unvowelled; editors' bāb numbers stripped |
| Grades | fawazahmed0 `info.json` for the graders whose attribution holds: al-Albānī (four Sunan), Shuʿayb al-Arnaʾūṭ (Abū Dāwūd, Ibn Mājah), Zubair ʿAlī Zaʾī (four Sunan), Salīm al-Hilālī (Muwaṭṭaʾ); al-Tirmidhī's own verdict quoted from his text | the rulings are the graders' | 21,185 graded records | four columns labelled Muḥyī al-Dīn ʿAbd al-Ḥamīd, Aḥmad Shākir, Abū Ghudda and ʿAbd al-Bāqī are al-Albānī's ruling (94.8–96.7% identical) and are **not shown under those names**; «Bashshār» is al-Tirmidhī's verdict (88.5%). Al-Bukhārī and Muslim: «رواه البخاري / مسلم», never a grade of ours (D8) |
| Isnād / matn | our rule-based splitter, cross-checked against Sanadset v5 boundaries transferred onto our text (positions only) | — | splitter v2 on the hand-checked Bukhārī: 54% exact, 71% within 2 words, 81% within 5 | every split stored with its method and rule, shown «تقسيم آلي» until reviewed |
| Explanations | HadeethEnc Arabic v1.7.0, verbatim with its version; linked by the cited number | publisher's policy (2026-08-18) allows commercial use and format changes with the text unchanged | 3,582 items; 1,894 cite a Six-Books number, 87–94% of which match ours | shown as "HadeethEnc → cited Bukhārī N", never as identical text; its grade is HadeethEnc's verdict |
| Narrators, Muslim | MIS / MIDS v2 | CC BY 4.0 | 2,092 narrators, 63,642 chain edges; 7,126 of 7,748 rows join our records by text | no death dates or ranks |
| Narrator profiles | Ibn Ḥajar's Taqrīb al-Tahdhīb in OpenITI (JK000121) | CC BY-NC-SA 4.0 | 8,522 entries with rank, ṭabaqa, death year, book sigla | basic profiles; linking with candidates, a rule, a confidence and a reviewer |

Cross-checks only, never shown: Sanadset 650K and hadith-kg — measurements tie both to a 2017 dump whose narrator ids are islamweb's, and islamweb's terms forbid copying; the LK corpus (scraped from sunnah.com, no licence). Arabic Wikisource (CC BY-SA, typing source unstated) and MIS are the candidates for titles if the commercial path is chosen.

### 3.2 What changes D8 (for the owner)

1. **Graders:** D8 names Aḥmad Shākir among the graders to credit. His column, and three others, are al-Albānī's rulings under an editor's name. Product law ("disagreements are shown with attribution") forbids crediting them as they stand. The build shows the four graders whose attribution holds, plus al-Tirmidhī's own verdict, and drops the four mislabelled columns. **The owner approves or changes this.**
2. **Empty records:** there are 408, not only Muslim's introduction. Each is listed with the named cross-check that could fill it (OpenITI by number, MIS for Muslim's introduction), and is never patched silently.
3. **al-Nasāʾī:** no openly licensed isnād split covers al-Mujtabā, so ours is the only one.
4. **hadith-kg's source**, which D8 waits on, is answered by measurement: very probably islamweb's encyclopedia. Asking islamweb and the dataset's author is a D19 message (owner).
5. **The isnād/matn convention:** the sources disagree three ways. The proposed convention puts every transmission formula and narrator up to the Companion's name, honorific and introducing verb in the isnād, and everything reported in the matn. The collector's own comments («قال أبو عيسى…») are a third segment. Owner or board.

## 4. Books (P11.3)

### 4.1 The catalogue through the D9 gate

| Author died (AH) | Primary works | Authors | Words | UTF-8 |
|---|---|---|---|---|
| ≤ 1374, uncorrected OCR excluded — passes | 6,766 | 2,696 | 862,966,786 | ≈ 8.54 GB |
| 1375–1394 — case by case (owner) | 482 (429 Hindawi) | 113 | 36.7 M | ≈ 0.38 GB |
| ≥ 1395, or the placeholder date 1450 — fails | 1,022 | — | — | — |

- The catalogue is `OpenITI_metadata_2025-1-9.tsv` (Zenodo 17767721, sha256 `10a025fc…2a61`). The Arabic subcorpus is 8,755 works by 3,373 authors. The plan's "9,108 titles, 3,558 authors" counted the Persian and manuscript subcorpora too, and is corrected.
- Texts are fetched per version from `OpenITI/RELEASE` at `cfc4157` (tag v2025.1.9).
- Still caught by hand: 30 works dated `0001`, 34 anonymous or multiple-author URIs, 6 reconstructed texts, and modern commentators filed under a classical author.

### 4.2 What the text is

- **No vowels:** there are 0 ḥarakāt in the shelf's 59,983,622 letters. Vowelled display needs permission or our own OCR of a public-domain printing (D9, P11.3a).
- **Page markers** close the printed page (`PageV##P###`).
  - Shelf quality: 18 clean, 12 with minor slips, 8 broken, 2 with none.
  - Against turath's printed pages, both ends of a sampled page matched the same printed page in 92 of 110 pages.
  - Rule: **a printed page is cited only where the version's markers pass a build-time check** (monotone, no `V00P000`, plausible words per page, agreement with turath's print map for Shamela ids). Otherwise the citation is section and paragraph.
- **"Cleaned" still carries the editor's material:**
  - footnote markers: 38,716 `(N)` in Ibn Kathīr alone;
  - restored words, editor's numbering, folio numbers, metre labels.
  - The same `(N)` is a verse number in one book and a footnote marker in another, so "only the author's text" needs **a profile per book**, applied mechanically, counted, and reviewed by an editor.
- **Structure:** `#` paragraph, `~~` continuation, `### |…` heading levels, `@QB@…@QE@` Quran quotations, `### |EDITOR|` / `|PARATEXT|` non-author sections. Milestones `ms####` are never keys. The cleaner the relation seeds already use (`relations/openiti.py`) handles most of this, with locators.

### 4.3 The launch shelf

- **Pinned:** 40 works (authors died by 911 AH; 14,787,419 words, 145.4 MB). They are 10 tafsir and Quran sciences, 7 hadith, 6 grammar, 3 lexicology, 5 fiqh, 3 history and 6 adab, with Zaydi, Ibadi and Imami founding texts beside the Sunni ones.
- **Built:** 37 of them. Al-Bukhārī, Muslim and the Muwaṭṭaʾ are the hadith encyclopedia's (P11.2, D8); one collection shown as two texts would contradict itself. The other hadith works on the shelf (Riyāḍ al-Ṣāliḥīn, Zayd b. ʿAlī's Musnad, al-Rabīʿ's Jāmiʿ, al-Kāfī) are outside D8's first scope and stay books.
- **Collections:** the metadata labels no sect. The shelf's Sunni, Zaydi, Ibadi and Imami labels are shown as an editorial table with the basis cited (D9's four collections), for the board to confirm.

### 4.4 For the owner or the board

- whether any of the 482 works of 1375–1394 enter;
- the version where the primary is weak (al-Ṭabarī, Muslim, al-Bukhārī's al-Bughā edition, al-Shāfiʿī's Risāla);
- bracketed restorations: keep, mark or drop. Until decided they are kept as printed and marked as the editor's, as al-ʿAyn's are (DECISIONS 2026-10-03);
- sect labels and their basis;
- KITAB's 2025.1.9 reuse data (no licence file): a D19 message.

## 5. Text intake and OCR (P11.3a)

Measured on this machine (Apple M3 Max, CPU only) on one dense, fully vowelled page of the Bulaq al-Qāmūs (1872, vol. 1, printed page 38; Wikimedia Commons, public domain), against an unvowelled reference of a later edition — one page is a smoke test, not a benchmark.

| Role | Component | Licence | Measured |
|---|---|---|---|
| OCR engine | Kraken 7.1.1, through its Python API (the command line writes visual order unless given `--base-dir R`) | Apache-2.0 | needs Python 3.10–3.13 and PyTorch; on Linux the CPU-only PyTorch index keeps the install near 371 MB of wheels instead of 3.18 GB |
| Recognition model | OpenITI printed Arabic, `arabic_best.mlmodel` (Zenodo 7050296, 16.3 MB) | CC0 | about 7% letter error once hamza and ى/ي are folded, 13% strict, before any fine-tuning; an independent study reports 3.1% on 19th–20th-century books |
| Line segmenter | BLLA 2026 retrain (Zenodo 22879549) — not the 2025 one bundled in 7.1.1, which cut the rows of vowel marks into 42 junk lines | Apache-2.0 | 23 lines instead of 63; vowels start to appear in the text; recognition 10 s → 5 s per page |
| PDF text layer | pypdf 6.19 | BSD-3 | right reading order in 4 of 4 tests (pypdfium2's extraction scrambled 3 of 4) |
| PDF rendering and scans | pypdfium2 5.13 — the scan at its native pixels, never re-rendered (re-rendering at 300 dpi doubled the error) | BSD-3 / Apache-2.0 | |
| URL main text | trafilatura 2.3 (Apache-2.0 from 1.8.0; GPL before) | Apache-2.0 | |
| Corrections | PAGE XML 2019 stored, ALTO exported; Kraken reads and writes both | schemas published | both validated against the official schemas |
| Fine-tuning | `ketos train` on corrected PAGE files | Apache-2.0 | CPU: about 0.4 s per line per epoch, 3–4 GB of memory per worker |
| Second engine | none yet: Tesseract (`ara`) scored 38% folded and its disagreement did not predict errors; PP-OCRv6 (Apache-2.0) scored like Kraken and its disagreement did predict errors (0.70), but after the restart it left half the lines empty with the same model — not adopted until explained | | |

- **Faults:** Kraken's pinned scipy 1.15.3 does not load on macOS 27 (1.18.1 works); Linux was not tested. Reporting both faults to the Kraken project is an outward message (owner's go).
- **The text:** the model writes Persian letter forms (ی، ک) for Arabic ones and keeps the vowels it sees. Normalisation maps the Persian look-alikes in the search form only, and never adds a vowel (D9a).
- **Privacy (D9a):** the upload goes to an OCR worker of ours, which returns the text and keeps nothing. The text then lives in the reader's browser like any text they add (DECISIONS 2026-10-03).
- **For the owner:**
  - a CPU or GPU budget and the expected pages a month — about 50 minutes per 300-page book per worker on this Mac, with no Linux benchmark yet;
  - whether a cloud second engine is still wanted;
  - a 20–50-page gold set before the interface promises any error rate;
  - which public-domain printings come first (D22 names the Khayriyya Tāj and the Bulaq al-Qāmūs).

## 6. Cross-linking (P11.4): every word to its root

- **The shelf** has 14,720,330 words in 359,799 distinct forms:
  - 65.7% of the words have a form the Quran spells;
  - after the usual clitics (و ف ب ل ك ال, the attached pronouns), 77% reach a Quranic word or lemma;
  - the remaining 23% are mostly names (بن، أبو، عباس) and the transmission formulae (حدثنا، أخبرنا).
- **The analysis** runs once per distinct form, in memory, at build time, with the analyser's rules (DECISIONS 2026-10-03), extended past the Quran:
  - the same form in the Quran;
  - the form without its clitics;
  - the patterns over the Quran's roots, then over the dictionary's 13,076;
  - every reading with its confidence and kind;
  - names and particles get no root.
- **Storage:** a form table (≈ 400,000 rows) holds each analysis once. Passages keep their text and the form ids of their words, aligned with one tokeniser. A passage carries its roots, so "where does this root live" is one index lookup.
- **The root's life across texts:** a root's page in the dictionary and in the Quran shows its hadith and book passages by text, with counts; search and the concordance take a source filter (Quran, hadith, books, lexica).

## 7. Build order

1. **P11.4a** The text pipeline shared by hadith and books:
   - chapters with a parent and a level;
   - passages with their form ids and roots;
   - the form analysis;
   - the loader;
   - the search index per passage.
2. **P11.2a** The seven collections:
   - text verbatim, numbering, kitāb and bāb titles;
   - grades (the attributable graders, al-Tirmidhī's verdict);
   - the empty records listed with their cross-checks.
3. **P11.2b** The isnād/matn split (rules and the Sanadset cross-check, flags) and the narrators: MIS for Muslim, Taqrīb profiles, linking with candidates.
4. **P11.2c** HadeethEnc's explanations and word meanings; the hadith pages (`/hadith`, a collection, a kitāb, a hadith); the reader's dictionary panel on hadith words.
5. **P11.3a** The catalogue (6,766 works) and the shelf (37):
   - the per-book profiles;
   - the page-trust check;
   - the citation key and its Arabic human form.
6. **P11.3b** The book reader (`/books`, a work, its contents, a page or section) with the dictionary panel.
7. **P11.3c** Text intake: paste, URL and PDF triage into the Library; OCR where the owner's hosting allows (§5).
8. **P11.4b** The root across texts (dictionary and root pages), search and concordance with source filters.
9. **P11.5** Exit test, coverage audit, boundary proposals.
