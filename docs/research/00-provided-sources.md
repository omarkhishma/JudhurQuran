# 00 — Disposition of every source in the owner's research list

The brief says: do not rely only on the owner's list, but where nothing better is found, use it. This table records, for every link in `Quran Idea.md`, what it is, whether the product uses it, and why. "Better" means: more authoritative provenance, a license that permits our use, or measurably better data quality. Details and evidence are in reports 01–04.

Status keys: **Used** — data in the product · **Cross-check** — used to verify our data, not shown · **Later** — planned for a later phase · **Reference** — studied, not a data source · **Not used** — with the reason.

## Quran and Hadith

| Link | What it is | Status | Why |
|---|---|---|---|
| github.com/spa5k/tafsir_api | Mirror of QUL tafsir exports (123 editions) | **Used** | Source of the digital text for al-Sa'di, al-Baghawi, Ibn Kathir, al-Qurtubi and al-Tabari (pinned v1.2.2, passages regrouped). Its al-Muyassar is a revised recension with an undocumented intro block, so al-Muyassar comes from QuranEnc instead (better: explicit re-publication grant, standard text). Its "Tanwir al-Miqbas" is mislabelled and its Arabic Jalalayn is incomplete — excluded (report 03 §2.5). |
| sunnah.com/developers | Hadith API | **Later** | Hadith phase. Key by request; English hadith only via an agreement. |
| dorar.net API | Hadith encyclopedia search with rulings | **Later** | API and terms are behind Cloudflare; terms must be read in a browser before use. |
| github.com/fawazahmed0/quran-hadith-search | A search engine project | **Not used** | No license; we built our own search over our own data (Arabic-aware, tested). |
| github.com/fawazahmed0/hadith-api | 10 hadith collections, Arabic + grades | **Later** | Best open compilation for the hadith phase (Unlicense); bundled English translations are third-party copyrighted and stay out. |
| ummahapi.com/tafsir-api | Third-party live API (Ibn Kathir, Ma'arif al-Quran, Muyassar) | **Not used** | We own these texts already (better: own database, cited editions); Ma'arif al-Quran is a copyrighted modern English work. |
| puremonotheism.com | Quran topic maps | **Reference** | Studied for graph UX (report 04); not a data source. |
| openislam.org/root_words | Root lists | **Cross-check** | Exactly 1,642 roots — derived from the Quranic Arabic Corpus, so not an independent check (report 01). |
| studyquran.org concordance (pattern-wise PDF) | Printed concordance ordered by pattern | **Reference** | Confirms the value of grouping a root's words by pattern (wazn), which we are building; PDF is not machine-readable data. |
| greattafsirs.com | Reading site with 91 tafsirs | **Not used** | "All rights reserved", no data export; we use licensed or public-domain digital texts. |
| altafsir.com | Royal Aal al-Bayt tafsir site | **Not used** | Its English tafsir translations are copyrighted; the Arabic classical works we serve come from cleaner pinned sources. |
| tanzil.net | Verified Quran text + metadata | **Used** | Verification text (letter-for-letter identical to the KFGQPC text), juz table, alignment bridge to the morphology. |
| corpus.quran.com | Quranic Arabic Corpus | **Used** | Primary morphology (segments, POS, lemma, root) for all 77,429 words; credited on every word panel. |
| islamiccontent.org | Islamic Content Service Association in Languages (publisher of QuranEnc, HadeethEnc, IslamHouse) | **Used** (via QuranEnc) | QuranEnc is its Quran encyclopedia: al-Muyassar, al-Mukhtasar, Saheeh International and Rowwad come from it under an explicit re-publication grant. |
| dev.islamiccontent.org/all-apis | The association's developer API directory | **Later** | HadeethEnc (translated and explained hadith) is a strong candidate for the hadith phase under the same publisher terms; the Quran APIs duplicate what we already import from QuranEnc. |

## Arabic dictionaries

| Link | What it is | Status | Why |
|---|---|---|---|
| huggingface.co/datasets/mysamai/m3ajim | 30+ Arabic dictionaries keyed by root | **Cross-check** | CC BY-NC 4.0 (non-commercial); its Maqayis drops the headwords and its Sihah is abridged (report 02) — the Shamela text is better for display. |
| huggingface.co/datasets/MohamedRashad/arabic-roots | Roots + dictionary text | **Not used** | License claim (GPL) not backed by the sources; words are glued together in the text. |
| huggingface.co/datasets/islamlab/arabic-lexicons | Classical lexicons | **Cross-check** | CC BY-NC-SA, unvocalised; useful to verify article boundaries. |
| github.com/linuxscout/ayaspell | Arabic spell-checker dictionary | **Not used** | A spelling word list, not a lexicon; the same author's Quran word index was used as a cross-check instead (report 01). |
| github.com/wizsk/arabic_lexicons | Lexicons in SQLite | **Not used** | Its Lisan splitter merges entries (عين inside عون…), and its "المحيط" table is a modern dictionary, not al-Qamus. |
| github.com/GibreelAbdullah/LaneLexicon | Lane's Lexicon database | **Cross-check** | Same Perseus lineage as the source we use (Perseus XML, CC BY-SA). |
| github.com/OSINTAI/Arabic-Dictionaries | Dictionary dumps | **Not used** | No license. |
| arabiclexicon.hawramani.com | Lisan, Lane and others online | **Cross-check** | States the texts are public domain; its texts match the Shamela typings, so it is a cross-check for Lisan article boundaries, never a source. |

## Public sites

| Link | Status | Why |
|---|---|---|
| quranroots.com · quranmorphology.com · searchtruth.com · jadhr.app · puremonotheism.com | **Reference** | Competitive analysis (report 04): what they do well, their data errors, and the gaps this product fills. jadhr.app also rules out the handoff's working name. |

## Extras

| Link | Status | Why |
|---|---|---|
| huggingface.co/models?other=quran | **Not used** | The tag lists generic embedding/LLM models; the product never generates religious content, and search does not need them. |
| huggingface.co/mysamai | **Cross-check** | Its useful dataset is m3ajim (above). |
| huggingface.co/datasets/mysamai/ashaar-tashkeel | **Not used** | Poetry with *model-inferred* diacritics — AI-generated vocalisation cannot be shown as authoritative text. |
| huggingface.co/datasets/islamlab/islamic-biographies | **Later** | 219k biographical notices (CC BY-NC-SA) — candidate for author pages of tafsir authors and hadith narrators. |
| huggingface.co/datasets/forzagreen/ar-conjugation | **Later** | 495 reviewed conjugation models with maṣdar and participles (CC BY 4.0) — candidate for verb conjugation tables and to cross-check pattern (wazn) labels. Taken from a modern published dictionary; confirm the dataset license covers it before display. |
| huggingface.co/islamlab | **Cross-check** | See arabic-lexicons and islamic-biographies above. |
| huggingface.co full-text search for «قران» | **Reference** | Survey of what exists; individual datasets assessed above where relevant. |

## Sources added beyond the list (because they are better)

| Source | Why it was added |
|---|---|
| KFGQPC official Hafs data v2.0 + KFGQPC Hafs font V22 | The authority for the Madinah mushaf; text verified against KFGQPC's published checksums; renders exactly like the printed mushaf. |
| QuranEnc.com | The only Arabic tafsir and English translations with an explicit re-publication grant. |
| QAC v2 (author's revision) and the mustafa0x corrected fork | Shown as attributed root variants where they disagree with the corpus. |
| AlKhalil Morpho Sys 2 (farahidi port) | The only independent root analyser found; planned as a cross-check and pattern (wazn) source. |
| Shamela 4 extraction (Hugging Face) and Perseus Lane XML | Best digitisations of the classical lexica (editions recorded, editor notes separable). |
| EveryAyah + quran-align | Verse recitation and word-level timing for highlighting and word pronunciation. |
