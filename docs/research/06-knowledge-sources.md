# 06 · Knowledge-layer and ecosystem sources — what exists, under what licence, and what we build ourselves

Research date: 2026-10-02. Eleven research passes, one per layer, each checking candidate sources over the network, reading licence texts verbatim, downloading only samples (under 5 MB each) and computing coverage from those samples. "Computed" means measured by us; "claimed" means the publisher's own figure. Nothing here has been ingested — this is the evidence behind `docs/PLAN.md` §4 (decisions D9–D28) and the tasks that cite it. Licence wording is quoted as found on the date above; it must be re-read before ingestion (PLAN P1.8).

## The short answer per layer

| Layer | What we recommend | Licence position | Decision | Plan |
|---|---|---|---|---|
| Meaning relations (near-synonyms, wujūh, furūq, antonyms, fields) | No open Quran-validated dataset exists. An in-house editorial relation table seeded from public-domain classical works: Ibn al-Jawzī's Nuzhat al-Aʿyun (313 headings, 236 roots), al-Dāmaghānī (≈312 roots), al-ʿAskarī's al-Wujūh and al-Furūq (884 entries, 211 Quranic root pairs), Ibn al-Anbārī's al-Aḍdād, al-Mukhaṣṣaṣ and Fiqh al-Lugha for fields. Arabic WordNet v2 only as editor-side candidates | OpenITI copies CC BY-NC-SA; authors public domain; AWN v2 CC BY-SA | D18, D19, D27 | P3.1, P8.4 |
| Topic index | An editorial Arabic taxonomy: top level from La Beaume's public-domain index (1878) merged with Quranpedia's roots; Quranpedia's human-made assignments imported with credit (6,100 topics, 3,673 verses — almost none after sūra 39); QSAC (all 6,236 verses, English, model-labelled) only as editor-side candidates | Quranpedia: republish with credit and version, commercial use not addressed; QSAC CC BY 4.0 | D29, D19 | P8.3 |
| Verse cross-references | Our own extraction of the verses a tafsir cites while explaining a verse — Ibn Kathīr's editor references parse at 98.8% accuracy in a sample; QurSim (7,679 pairs from Ibn Kathīr) as the evaluation set | Extracted pairs are facts; QurSim allows unchanged copies with credit | D25 | P3.9 |
| Mutashābihāt (verses memorisers confuse) | Waqar144's curated list (1,344 entries) with credit; wording similarity by our own reimplementation of QUL's open-source matcher | Free use with credit requested; QUL's own data unlicensed | D19 | B11 |
| Pronoun referents and entities | QurAna (24,679 pronouns → 1,028 concepts) shown unchanged with credit; an in-house entity registry on Wikidata ids; mentions from the corpus proper-noun tags | QurAna verbatim-only and tied to corpus ids; Wikidata CC0 | D25 | P3.9, B25 |
| Syntax (iʿrāb) | MASAQ word-level roles and case (96.6% of words); corpus treebank trees where they exist (42% of words); EQTB only as editor-side candidates | MASAQ v1/v3/v5 CC BY 4.0 vs v6 NC; treebank has no licence file | D23 | B10, P2.5 |
| Qirāʾāt | KFGQPC riwāyāt texts, aligned word by word with quran-ws/quran-text, verse numbering joined with qiraat-ayah-map | KFGQPC terms; CC BY 4.0 | D24 | B20 |
| Tajwīd | cpfair's 18-rule annotations remapped onto our text | CC BY 4.0 | D24 | B24 |
| Waqf signs | Tanzil's marks keyed to our words (identical to the corpus pause file: 4,359 marks in six types) | CC BY 3.0, verbatim | — | P3.9 |
| Sūra metadata, Makki/Madani, revelation order | Tanzil metadata (agrees with three independent sources); per-verse exceptions built in-house for 41 sūras; Arabic sūra introductions from the Tafsir Center database | CC BY; Tafsir Center CC BY 4.0 (commercial scope to confirm) | D26, D19 | P3.9, B6 |
| Occasions of revelation | The Tafsir Center's 201 vetted entries by default; al-Wāḥidī and al-Suyūṭī in full as a labelled classical layer | CC BY 4.0; OpenITI NC-SA | D26 | P3.9 |
| Quran word audio | Slices of EveryAyah verse audio cut with quran-align timings (99.99% of words timed); ask the Tafsir Center for its isolated-word set; else commission pause-form recordings | CC BY-NC + CC BY 4.0; Tafsir Center all rights reserved | D10, D19 | P3.7 |
| Classical lexica we lack | Split al-ʿAyn, Tahdhīb, al-Qāmūs and Tāj ourselves from the Shamela 4 typings (display-only, apparatus stripped); OpenITI copies as test oracles; later rebase Tāj and al-Qāmūs on public-domain printings by OCR | No grant from Shamela; the dataset card says "Research and personal use" | D22 | P3.2 |
| Hadith | Display text from sunnah.com under a written agreement (the only source with isnād/matn split, narrator links and named graders); fawazahmed0 as the fallback; gradings credited to each named grader; HadeethEnc (3,582 hadith with explanations) as the curated layer; narrators from hadith-kg once its source is confirmed | sunnah.com forbids mass reproduction without agreement; fawazahmed0 Unlicense over text of doubtful origin; HadeethEnc explicit republish grant with 7 conditions | D8, D19 | P11.2 |
| Classical books | OpenITI 2025.1.9 metadata as the catalogue, copyright gate by death date, OpenITI text for display; vowelled Shamela text only with permission | OpenITI CC BY-NC-SA; Shamela no grant | D9, D22 | P11.3 |
| OCR and text intake | Kraken with the OpenITI print model as the main engine (3.1% character error on classical letterpress, independent study); per-page PDF triage; a correction editor that feeds training | Apache-2.0 and CC0; avoid AGPL and Datalab-licensed models | D9a | P11.3a |
| Morphology for non-Quran text | farahidi (AlKhalil Morpho Sys 2) as the candidate generator, CAMeL Tools with Camel Morph MSA as an optional second opinion, a calibrated re-scorer | GPL-3.0 (server only); MIT + CC BY 4.0 | D28 | §5, P4.3 |
| Dictionary headword audio | A commercial TTS voice fed with phonemes we derive (pausal form → IPA), every file re-transcribed and checked; human recordings for the most frequent headwords | Engine terms (Azure paid tier grants output rights) | D10 | P11.1 |

## Cross-cutting findings

- **No source licenses classical Arabic text for commercial use.** OpenITI is explicit (CC BY-NC-SA); Shamela-derived datasets carry packagers' labels that Shamela never granted. A commercial future needs either permissions (D19) or our own OCR of public-domain printings (P11.3a). This ties every content layer to D2.
- **Labels lie, cards contradict themselves.** MIT tags on recitation audio cut from EveryAyah, CC0 on OpenITI chunks, a dataset card whose YAML says MIT and whose text says "Research and personal use". Every layer is traced to its origin before it is trusted.
- **Ids cross-walk.** The number inside an OpenITI version id such as `Shamela0007798` is the shamela.ws book id, the `shamela_id` in the Shamela 4 dump and the turath id (verified on three works); the Shamela 4 folder number is not.
- **Machine output is a candidate, never content.** Several open datasets are model-generated (Arabic WordNet 4, EQTB chapters 9–58, LLM-tagged topic sets). They may seed editor work; they are never shown as scholarship (PLAN L2, L3).

## The reports

Each part below is the research pass as written, with working-file paths removed. Questions addressed to "you" are questions for the owner; they are carried into PLAN §4.

## Part 1 — Meaning relations — synonymy, polysemy (wujūh), differences (furūq), antonyms, semantic fields

**Semantic-relations layer: open data sources assessed (synonyms, polysemy, differences, antonyms, semantic fields)**

No open dataset gives Quran-validated meaning relations between roots or lemmas. The usable, licensed material is classical public-domain works already in OpenITI and the Shamela4 Hugging Face dump:

- **Polysemy (wujuh):** Ibn al-Jawzi and al-Damghani are already semi-structured as word → senses → verses.
- **Differences (furuq):** al-Askari has 884–2,357 machine-readable "الفرق بين X وY" headings depending on the edition.

Arabic WordNet v2 (CC BY-SA 3.0) is the only open, root-tagged synonym graph. It is Modern Standard Arabic, not Quranic. On the fear set it links only خوف and خشي. So every synonym, antonym and semantic-field edge has to be built in-house and reviewed by an editor; the sources below only seed candidates.

On the fear set (خوف / خشية / وجل / رهب), the sources compare like this:
- **Arabic WordNet v2:** links خوف–خشي in one verb synset. It has no خوف–وجل or خوف–رهب link, and رهب sits in the إرهاب "terrorism" synset.
- **al-Askari's al-Furuq:** has explicit entries for خوف/خشية, خوف/رهبة and خوف/وجل.
- **Ibn al-Jawzi:** باب الخوف gives five senses (الخوف نفسه، العلم، الظن، القتال، النكبة), each with verses.

All coverage numbers marked "computed" were matched against the project release (1,642 roots, 4,832 lemmas). Matching is string-based after normalising hamza, ة/ه and ى/ي. "Claimed" means the publisher's figure. "Fetched" means WebFetch got the page; numeric codes are curl results.

#### A. Wordnets and lexical databases

| Source | Checked | Contents and coverage | Format | License (verbatim, where read) | Display / redistribute | Quality | Verdict |
|---|---|---|---|---|---|---|---|
| Arabic WordNet v2 via OMW "arb" (Elkateb/Black 2006; Abouenour/Bouzoubaa/Rosso 2013–15) | github.com/omwn/omw-data/wns/arb: LICENSE 200, wn-data-arb.tab 200 (1.93 MB downloaded) | 9,916 synsets keyed to Princeton WordNet 3.0 (PWN 3.0) ids (n 6,884 / v 2,484 / a 443 / r 105); 37,335 lemma rows, 14,683 root rows, 2,948 broken plurals; 7,781 synsets have a root. **Computed:** 1,257/1,642 Quranic roots (76.6%) via the root field; 1,311 (79.8%) via root or lemma match, 96.0% weighted by occurrences; 1,552/4,283 normalised Quranic lemma forms (36.2%, 60.3% weighted). 4,967 Quranic-root pairs share a synset. Missing root field on غفر, صلو, زكو, شطن, ءيي | TSV (synset, lemma / root / broken plural); no relations in the tab — hypernymy and antonymy come from PWN (English-derived) | "The Arabic WordNet data in the distribution is subject to the Creative Commons Attribution-ShareAlike license, Version 3.0" (wns/arb/LICENSE); omwn.org/omw1.html row: "CC BY SA 3.0" | Display yes; redistribution yes with attribution; ShareAlike; commercial use OK | Peer-reviewed; MSA senses (إرهاب); 47.4% of lemma rows vocalised (computed); OMW still edits it (changes log dated 2025-02/03). Freihat et al. 2024: "updated more than 58% of the synsets … correcting errors" | Cross-check: candidate generator for editors only |
| AWN 3.0 (Freihat, Khalili, Bella, Giunchiglia; OSACT 2024) | github.com/HadiPTUK/AWN3.0 fetched; Verbs CSV 200 (715 KB sample) | 9,576 synsets, 9,322 new glosses, 236 lexical gaps, 701 phrasets (claimed, arXiv 2403.20215). CSV keyed by PWN id, vocalised lemmas, Arabic glosses and examples, no roots | CSV/XLSX | No license file → no license (all rights reserved by default). The arXiv header "CC BY 4.0" covers the paper; whether it covers the data is unknown | Display / redistribute: not granted | Human-revised, better quality than v2 | Cross-check only; ask the authors for a license |
| Arabic WordNet 4.0/4.1 (Salah Abdo, 2026) | GitHub repo fetched; Zenodo 18872077 fetched; first 3 MB of awn4.xml.gz → 206 | 120,630 synsets, 136,041 entries, 184,238 senses, 297,150 relations (claimed). Translated by Gemini 3 Pro Preview plus Claude from Open English WordNet (OEWN) 2024. **Sample (77,142 lemmas):** 19% vocalised, no roots | WN-LMF 1.4 XML | Lexicon license="https://creativecommons.org/licenses/by/4.0/"; dc:rights "CC BY 4.0. Attribution required to Open English WordNet and Princeton WordNet." | Display and redistribute yes, attribution | Machine-generated by LLMs, single author, no evaluation, MSA | Avoid as an authority; at most an unvalidated candidate generator |
| SinaLab Synonyms (Ghanem, Jarrar et al., GWC 2023) | github.com/SinaLab/Synonyms: LICENSE 200, xlsx 200 (306 KB) | 500 Arabic WordNet synsets × ~3K candidate synonyms, each scored 0–1 by 4 linguists. MSA, not keyed to the Quran | XLSX | LICENSE: "Creative Commons Attribution 4.0 International" | Yes / yes, attribution | Peer-reviewed; linguists disagree (README: RMSE 32%) | Cross-check: the graded-synonymy method is worth copying; the data is too small |
| Qabas lexicon (Jarrar & Hammouda, LREC-COLING 2024) | sina.birzeit.edu/qabas/about fetched; arxiv.org/html/2406.06598 fetched | 58K lemmas linked to 110 lexicons and 12 corpora. Quran: 4,100 of 4,830 Quranic Arabic Corpus (QAC) lemmas mapped (84%), 62,123/77,469 tokens (claimed). Download = lemmas, morphology, roots and mapping links; no synonyms, antonyms or glosses (paper) | Behind a Google Form (not submitted) | "معجم قبس هو معجم مفتوح المصدر (تحت رخصة CC-BY-ND-4.0)" (qabas/about); resources page also says CC-BY-ND-4.0; some secondary sites say CC BY 4.0 | Display yes; no-derivatives (ND) blocks redistributing modified versions | Strong team, maintained | Avoid for the API; possible internal crosswalk QAC ↔ Qabas ↔ Arabic Ontology (open question) |
| Arabic Ontology (Jarrar) | sina.birzeit.edu/resources fetched; ontology.birzeit.edu → 403; en.wikipedia Arabic_Ontology fetched | About 1,800 well-investigated plus 16,000 partially validated concepts (claimed, via search snippet). Relations: subtypes, type, instances, parts, related, similar, equivalent — no antonymy; mapped to WordNet. Link to Quranic lemmas unknown | Concepts.csv / Relations.csv (claimed), behind a form | Resources page: "CC-BY-4.0"; Wikipedia: "Content license: copyright" — conflicting | Unknown until the files and license are seen | Peer-reviewed (Applied Ontology 2021) | Cross-check, pending the license |
| SinaLab "Quran" (each word linked to a Qabas lemma) / SinaLab 150-lexicon database | sina.birzeit.edu/quran fetched; resources page | Morphology tags plus Qabas lemma links; no semantic relations | Behind a form | Quran: "CC-BY-4.0" (resources page; the Quran page itself states no license). 150-lexicon database: "Special licence" | Quran yes; lexicon database no | — | Quran: crosswalk only. Lexicon database: Avoid |
| Wiktionary via kaikki.org | kaikki.org/dictionary/Arabic fetched; per-word JSONL endpoint 200; 4.5 MB head sample 206 | 59,484 words (claimed; data extracted 2026-09-28). **Computed on 80 random Quranic lemmas (seed 42):** page found 75%, synonyms 20%, antonyms 9%. Some misses come from lemma spelling differences | JSONL (full file 497 MB, marked deprecated — not downloaded) | en.wiktionary Wiktionary:Copyrights: "Creative Commons Attribution-ShareAlike 4.0 International License" plus GFDL | Yes / yes, attribution; ShareAlike | Crowd-sourced, MSA-leaning, per-sense synonyms | Cross-check: candidate generator |

#### B. Quran-specific ontologies and services

| Source | Checked | Contents | License | Verdict |
|---|---|---|---|---|
| QAC Ontology of Quranic Concepts | corpus.quran.com/concept.jsp and /license.jsp fetched | About 300 concepts and 350 relations (third-party claim): IS-A, part-of, instance, linked to verses. Mostly concrete or named things (Artifact, Astronomical Body, False Deity, Location…). No word-level relations | GNU GPL v3 (license.jsp: "Copyright © Kais Dukes, 2009-2017"). No official ontology download seen. The only dump found is a scrape, seelenbrecher/islamic-agent ontology.json (403 KB, no LICENSE: 404) | Cross-check for fields of concrete nouns; GPL copyleft applies on redistribution |
| Quranic Arabic WordNet (AlMaayah, Sawalha, Abushariah; IJST 2015) | Semantic Scholar API: openAccessPdf "CLOSED" | 6,918 synsets from about 8,400 senses (claimed, search snippet) | No public data found | Unavailable; could be requested from the authors |
| Quran WordNet (IEEE 10409881, 2024); "Relational WordNet model" (2009) | Search only | English-translation based | No data released | Unavailable |
| Alqahtani & Atwell Quranic Ontology (1,217 concepts, claimed) | etheses.whiterose 24184 fetched; Leeds data 464 fetched | Ontology not released. Only the Q&A corpus is (AAQQAC, CC BY 4.0). The thesis text is "Creative Commons Attribution-NonCommercial-ShareAlike 2.5" | Ontology: not available | Unavailable |
| Kalimat API (used by quranwbw.com) | kalimat.dev and /terms fetched; api.kalimat.dev/docs returned a title only | Semantic search at verse level across Quran, Hadith and Athkar; no word-level relations | Home page: "Kalimat offers a free tier for personal and non-commercial use". Terms: "You must provide appropriate attribution to Kalimat"; prohibits "Use the Service for any commercial purpose without a proper license or agreement". Caching and redistribution not addressed | Avoid as a data source; it is a search service |
| QUL "Topics and Concepts" (Tarteel) | qul.tarteel.ai/resources and /ayah-topics fetched; repo LICENSE 200 | Verse-level topics "and semantic relations between these concepts"; source not stated | Code is MIT ("Copyright (c) 2024-present Tarteel, Inc"); data license unknown | Cross-check, pending the license |
| QSAC (Hugging Face ahmadbilal-dev) | HF API and README read | 338 verse-level tags; LLM-assisted; English Saheeh International text | README badge "CC BY 4.0" (LICENSE file not read) | Avoid: verse-level and LLM-labelled |

#### C. Classical public-domain works (the real seed material)

Licensing for all of these: OpenITI copies are CC BY-NC-SA 4.0. The Shamela4 Hugging Face copies carry "mit" set by the packager only. The authors are public domain. Modern editors' footnotes are separate in Shamela4 and stripped in cleaned OpenITI files.

| Work | Where (checked) | Edition | Structure and coverage (computed unless noted) | Verdict |
|---|---|---|---|---|
| Ibn al-Jawzi, نزهة الأعين النواظر (wujuh) | OpenITI `0597IbnJawzi.NuzhatAcyun.JK007134-ara1` raw 200 (661,715 B); Shamela4 HF book 2191 | الراضي, مؤسسة الرسالة 1984. OpenITI yml: "All paratextual elements (introductions, footnotes, indices, ...) removed" | 313 numbered "( N - باب X )" headings parsed; 182 "على N أوجه" statements; about 2,069 @QB@ plus about 1,005 ^( verse quotes cited by surah name only. 257/313 headings map to a Quranic root (236 roots); unmapped ones are mostly verbal nouns and particles | **Use** — primary wujuh source |
| al-Damghani, قاموس القرآن / إصلاح الوجوه والنظائر | OpenITI `0478IbnMuhammadDamghani.QamusQuran.ShamAY0034085-ara1` raw 200 (745,422 B) | عبد العزيز سيد الأهل, دار العلم للملايين ط3 1980 | Headings keyed by spaced root letters ("ب ر ه ن على وجهين"): 336 distinct roots detected, 312 match Quranic roots (heuristic). The root ordering is probably the modern editor's arrangement (not verified) | **Use** — primary, root-keyed |
| Abu Hilal al-Askari, الوجوه والنظائر | Shamela4 HF 7598; OpenITI `0395AbuHilalCaskari.WujuhWaNazair` (folder seen) | محمد عثمان, 2007 | 212 entry headings, 181 map to Quranic roots (167 roots); critiques earlier wujuh claims | **Use** — secondary wujuh source |
| Muqatil, الوجوه والنظائر | Not in OpenITI (the Muqatil folder holds only TafsirMuqatil); not among the 8,590 Shamela4 HF books; shamela.org PDF (password-protected per search snippet); quranpedia 27478 | حاتم الضامن, مركز جمعة الماجد ط2 2011 | Only PDF or HTML, no license. The Shahata edition "الأشباه والنظائر" has a disputed attribution (mtafsir thread) | Cross-check |
| Hārūn b. Mūsā, الوجوه والنظائر | ketabonline 102306 fetched (no license stated); not in OpenITI 0175AH or Shamela4 HF | حاتم الضامن, وزارة الثقافة العراقية 1988 | Browsable text only | Cross-check |
| al-Askari, الفروق اللغوية | Shamela4 HF 3787 (pages 990 KB); OpenITI `0395AbuHilalCaskari.FuruqLughawiyya` | محمد إبراهيم سليم; partly vocalised | 884 "الفرق بين" entries: 562 contain at least one Quranic lemma, 229 at least two → 211 Quranic root pairs (285 roots); naive lower bound with some false hits. Entries cite verses | **Use** — primary furuq source |
| معجم الفروق اللغوية (al-Askari plus al-Jaza'iri d.1158), Qum 1412 | Shamela4 HF 1485 | Arranged by بيت الله بيات; al-Jaza'iri additions marked "(اللغات)"; numbered cross-references | 2,357 entries: 1,595 with at least one Quranic lemma, 687 with at least two → 314 root pairs (373 roots). Copyright status of the modern arrangement unknown | Cross-check and index; take al-Jaza'iri's text from it after verification |
| Ibn al-Anbari, الأضداد | Shamela4 HF 5288; OpenITI `0328AbuBakrIbnAnbari.Addad` | محمد أبو الفضل إبراهيم, 1987 | 362 headings, 143 map to Quranic roots (114). These are auto-antonyms (one word, two opposite senses), not antonym pairs | **Use** — for polysemy, as a ḍidd flag |
| Ibn Sida, المخصص | Shamela4 HF 1709 (TOC only; pages 12.6 MB not downloaded); OpenITI `0458IbnSidaMursi.Mukhassas` | خليل جفال 1996 | 1,975 TOC headings in a classical topic-ordered thesaurus | **Use** — public-domain seed for a semantic-field taxonomy |
| al-Tha'alibi, فقه اللغة وسر العربية | Shamela4 HF 4126; OpenITI `0429AbuMansurThacalibi.FiqhLugha` | عبد الرزاق المهدي 2002 | 30 thematic chapters (133 TOC entries) | **Use** — secondary semantic-field source |

#### D. Modern copyrighted works (reference only)

| Work | Status | Verdict |
|---|---|---|
| محمد محمد داود, معجم الفروق الدلالية في القرآن الكريم (دار غريب 2008, 675 pp) | In copyright. An archive.org upload exists, apparently unauthorised | Avoid as data; editorial reference only |
| محمد حسن جبل, المعجم الاشتقاقي المؤصل (2010) — Shamela4 HF 5647 | In copyright; root-keyed and Quranic | Avoid redistribution; cross-check only |
| فهد الضالع, زوائد ابن الجوزي على مقاتل (master's thesis 2005) — Shamela4 HF 6; عبد العال مكرم, المشترك اللفظي في الحقل القرآني — Shamela4 HF 7745 | In copyright | Reference only |
| Izutsu (semantic fields); Arabic thesauri (المكنز) | No open dataset found | Avoid |
| Arabic antonym-pair datasets | None found (Hugging Face API searches for antonym, synonym, wordnet and thesaurus: no Arabic hits) | Gap |

**Cross-lingual route (technique only):** QAC word-by-word English glosses (GPL) → Open English WordNet synsets (README: "Open English Wordnet is released under CC-BY 4.0") → Arabic candidate clusters. The result is derived and lossy; label it machine-suggested.

#### (a) Recommended sources per relation

| Relation | Recommended | Why |
|---|---|---|
| Near-synonyms | In-house edges. Seeds: al-Askari furuq pairs (each entry implies a near-synonym pair), shared wujuh sense labels (e.g. خوف sense "العلم"), Arabic WordNet v2 as candidates | Classical, Quran-cited, public-domain authors. Arabic WordNet v2 is the only open root-tagged graph but is MSA |
| Polysemy (wujuh) | Ibn al-Jawzi (OpenITI) and al-Damghani (OpenITI, root-keyed); then al-Askari's wujuh; Muqatil and Hārūn to cross-check; Ibn al-Anbari for ḍidd | Already structured as word → senses → verses with cleaned text |
| Differences (furuq) | al-Askari al-Furuq (Shamela4 / OpenITI); the Qum compilation as an index | Headings are machine-extractable and cite verses |
| Antonyms | In-house editorial table; candidates from PWN antonymy projected onto Arabic WordNet and from Wiktionary | No Arabic or Quranic antonym-pair dataset exists |
| Semantic fields | In-house taxonomy seeded from al-Mukhassas and Fiqh al-Lugha, plus QAC concepts for concrete nouns | Only public-domain or GPL options; no open Quranic field dataset |

#### (b) What must be built in-house

- **Editorial relation table.** One row per edge: type (near_synonym, furuq_contrast, antonym, wujuh_sense, didd, field_member), source and target root or lemma, sense label, verse ids, source work, locator (OpenITI URI or Shamela page), short quote, editor, review status, and license of the source.
- **Parsers** for the Nuzha headings, al-Damghani's root headings, and al-Askari's "الفرق بين" entries.
- **A verse matcher** that turns quoted fragments (cited by surah name) into verse ids.
- **A lemma normaliser** to bridge verbal-noun headings to Quranic verb lemmas.
- **Licensing choice:** if quoted text is taken from OpenITI files, the redistributed layer inherits NC-SA. Re-keying from public-domain print editions keeps it free of that.

#### (c) Open questions for you

1. Do you accept NC-SA on the wujuh/furuq layer (via OpenITI), or should we re-digitise from public-domain print so the API stays commercial-ready?
2. Do you accept ShareAlike (Arabic WordNet v2 or Wiktionary-derived edges) in what the API returns?
3. Should machine-suggested candidates (Arabic WordNet v2/v4, LLM output) ever be shown to users if labelled, or stay editor-only?
4. Model relations as "near-synonym + furuq note" rather than "synonym"? al-Askari and Ibn Faris reject full synonymy.
5. Antonym scope: lexical antonyms (خوف↔أمن) only, or also Quranic contrast pairs (طباق, e.g. الجنة/النار)?
6. Can Qabas mappings (ND license) be used internally as a crosswalk?
7. Should I contact data authors (AWN 3.0, Quranic Arabic WordNet, Arabic Ontology) to ask for licenses? That goes out under your name and needs your go.

#### (d) Not verified, and why

- **Arabic Ontology:** contents and actual license not seen — download is behind a form, and ontology.birzeit.edu returned 403.
- **Qabas:** file contents not seen — download is behind a form.
- **Kalimat API:** the docs page returned only a title.
- **QAC ontology:** no official download found, only a third-party scrape.
- **Arabic WordNet 4.0:** full coverage not computed — the file is 11.8 MB, over my 5 MB limit, so I sampled the first 3 MB only.
- **Wiktionary/kaikki:** the full 497 MB file was not downloaded; I sampled 80 lemmas instead.
- **Muqatil:** the shamela.org PDF is reported password-protected; text quality unchecked.
- **Princeton WordNet license:** page returned 403.
- **Haffner's ثلاثة كتب في الأضداد:** no digital copy confirmed.
- **QSAC:** LICENSE file not read, and I did not check whether it embeds the Saheeh International text.
- **al-Damghani:** whether the root ordering is the editor's (al-Ahl) or original.
- **HTTP codes:** pages fetched with WebFetch show no numeric status.

**Pending:**
- **You:** decisions (c1)–(c7), and the go-ahead for any outreach to data authors.
- **Next build phase:** the parsers, verse matcher and editorial relation table in (b).

---

## Part 2 — Topic index of the Quran

**Topic layer source inventory (checked 2026-10-02)**

No single open dataset is good enough on its own. **Quranpedia's** Arabic topic tree is the strongest candidate, but its licence allows commercial use only by omission, it gives no source for the index, and it covers 58.9% of verses (almost nothing after surah 39). **QSAC** is the only dataset with all 6,236 verses under a clean licence (CC BY 4.0), but its labels are English and were made with an LLM. Everything else is non-commercial, unlicensed, too narrow, or not machine-readable. All counts below are computed by me from downloaded samples unless marked "claimed".

**Summary**

| Candidate | Coverage (verses / topics / depth) | Lang | Data licence | Display | Redistribute via our API | Derived from | Verdict |
|---|---|---|---|---|---|---|---|
| Quranpedia topic dumps | 3,673 of 6,236 (58.9%); 6,100 topics; 1,516 roots; up to 4 levels | Arabic | Quranpedia Data Licence (attribution + version to republish) | Yes | Yes with credit and version; commercial use not prohibited, but not stated either | Source not stated | Use as Arabic seed, after confirming source |
| QSAC (Hugging Face / GitHub / Kaggle) | 6,236 of 6,236; 338 tags in 18 domains and 70 categories; 3 levels | English | CC BY 4.0 for data, MIT for scripts | Yes | Yes, commercial OK; drop the Saheeh International column | LLM-assisted labelling | Use as full-coverage draft and cross-check |
| QUL ayah topics (resource 45) | Sample: 138 of 150 verses (92%); 2,512 topics (claimed), 2,511 unique IDs parsed; 1,781 roots; up to 4 levels | Mostly English; 993 Arabic names | "We don't have copyright information for this resource." | Unknown | No | QAC ontology + Clear Quran index + an unidentified English index | Avoid as import; cross-check |
| QUL ayah themes (resource 62) | Sample: 150 of 150; 1,049 themes (claimed on QUL index) | English | Same "no copyright information" modal | Unknown | No | Probably Farooq-i-Azam Malik's translation headings | Avoid |
| QAC ontology of concepts | 245 concepts in topic index; 285 nodes including 48 categories; up to 7 levels; links are word-level | Arabic + English | GPL + "CHANGING IT IS NOT ALLOWED" + FAQ non-commercial | Yes, non-commercial, with attribution | No (no official download) | Original (Dukes, Leeds) | Cross-check / link out only |
| Scraped QAC mirrors (islamic-agent, obsidian template) | 285 nodes; ≥1,836 verses (capped scrape) / 252 concepts, no verse links | Arabic + English | No licence (all rights reserved by default) | No | No | QAC | Avoid |
| Semantic Quran (AKSW) | No topic or concept data | — | CC BY-NC-SA 3.0 | — | — | Tanzil + QAC morphology | Avoid |
| Qurany (Leeds), mirror motazsaad/quran-concepts | Sample: 130 of 150 (86.7%); ~1,100–1,200 concepts (claimed); 2–5 levels | Arabic + English | Original: none stated; Apache-2.0 added by the mirror owner, who is not the rights holder | No | No | Mushaf al-Tajweed index (in copyright) | Avoid; use only as taxonomy inspiration |
| Hakkoum & Raghay OWL (A-Kamran/QuranExplorer) | Schema: 44 classes, 273 individuals | Arabic + English | No licence | No | No | Qurany + QAC + QurSim | Avoid |
| 7-colour thematic mushaf derivatives (muhareb/QuranTopics, al-mushaf-al-mufahras) | 6,236 of 6,236 in 1,281 segments; 7 flat classes | Arabic | None / MIT for code only | No | No | Printed colour-coded mushaf (in copyright) | Avoid |
| La Beaume, *Le Koran analysé* (1878) | 18 chapters plus alphabetical index; verse count not computed | French | Public domain (author died c. 1876) | Yes | Yes | Kazimirski translation (public domain) | Use as public-domain skeleton |
| تفصيل آيات القرآن الحكيم (Abd al-Baqi's Arabic translation) | 18 sections, ~350 sub-sections (claimed); no usable text | Arabic | Probably public domain in Egypt; unknown elsewhere | Unknown | Unknown | La Beaume | Cross-check after legal check |
| المعجم الموضوعي لآيات القرآن الكريم (Subhi 'Asr, 1990) | PDF scans only | Arabic | In copyright; no licence found | No | No | Original | Avoid |
| Mishkāt / QKG (emadjumaah/quran) | 6,236 of 6,236, one topic per verse; 262 topics | Arabic | "MIT License (code)" only; no data licence | No | No | Embedding clustering + LLM naming | Cross-check / method reference |
| Faiz28/Quran_Classification | 6,236 of 6,236; 16 flat labels, one per verse | English | CC BY-NC-SA 4.0 | Non-commercial only | Non-commercial share-alike only | Unknown | Avoid |
| AQQAC (Leeds) and nazimali HF version | Question-level, not a verse index | Arabic + English | CC BY 4.0 | Yes | Yes | Leeds | Cross-check only |
| QurSci-Onto | 194 verses, science topics only | English | CC BY-NC-SA 4.0 | Non-commercial only | Non-commercial only | Includes Clear Quran text | Avoid |
| Kaggle "Quranic Thematic & Emotional Annotation" | Not sampled (download needs login) | English + Urdu | Kaggle label "MIT" | Unknown | Unknown | Unknown; embeds translations | Avoid as import |
| Wikidata | 80 verse items of 6,236; 17 verse "main subject" statements | Multi | CC0 | Yes | Yes | — | Use only to link topic nodes to Wikidata IDs |
| Tanzil | No topic index | — | — | — | — | — | Not a source |
| Quran Foundation / quran.com | No topic endpoint found; QUL topics come from the quran.com database | — | QF terms forbid storing or redistributing | — | No | — | Not an import source |

**Per-candidate details**

*Quranpedia*
- Pages checked, all HTTP 200: `quranpedia.net/topics` (says "1,516 موضوع"), `/topics.md`, `/topic/216.md`, `/topic/274.md`, `/api/topic/216/children`, `/manhaj`, `/about`, `api.quranpedia.net`, and `api.quranpedia.net/dumps?lang=en`.
- I downloaded `/dumps/LICENSE.md`, `manifest.json`, `topics-index.json.gz` (163,306 bytes) and `topics.json.gz` (856,814 bytes). Both checksums match the manifest.
- Format: JSON records `{id, name, parent_id, ayahs:"s:a,…"}`, plus a per-verse file with each topic's parent.
- Coverage: 6,100 topics; levels 0–3 hold 1,516 / 4,482 / 93 / 9 topics; 19,117 topic–verse links; 3,673 verses.
- The coverage is lopsided: surahs 1–39 have 3,669 of 4,133 verses covered (88.8%), surahs 40–114 have 4 of 2,103 (0.2%), and 71 surahs have none.
- Quality: assignments are detailed and look human-made (4:11 has 13 inheritance-law topics). There are 864 leaf topics with no verses, 18 duplicate root names after normalisation, and some stray diacritics (`الَّريش`, `اللَه`).
- Licence, quoted from LICENSE.md v2026-10-01: "Free to use inside apps, websites, bots, and research tools — no attribution required" and "Republishing this data — in full or in part — as a downloadable database or dataset requires: (1) crediting Quranpedia.net as the source with a link, and (2) stating this dump's version."
- It also says: "Translations and contemporary works remain the intellectual property of their respective authors and publishers."
- API policy: "Do not bulk-scrape and republish". The dumps are the approved route.
- Neither `/manhaj` nor `/about` names a source for the topic index, and web searches on distinctive topic names found no upstream.

*QSAC*
- Checked: the HF dataset card, the CSV (2,471,287 bytes), the ontology JSON (398,104 bytes) and LICENSE, all 200. GitHub repo created 2026-03-20; GitHub's licence detection reports NOASSERTION.
- Computed: 6,236 rows; 16,309 tag assignments (average 2.615 per verse); 1–6 tags per verse (one verse has 6, the card says 1–5); every tag exists in the ontology; 323 of 338 tags are used.
- Licence quoted: "DATA LICENSE — Creative Commons Attribution 4.0 International (CC BY 4.0) Applies to: data/qsac-dataset.csv, data/qsac-ontology.json".
- The Kaggle copy is labelled MIT, which conflicts with the CC BY 4.0 file. Both are permissive.
- Spot checks look plausible (2:255 → Tawheed, Throne of Allah; 4:11 → Inheritance Law). It is one author, labelled with an LLM, not peer-reviewed, and has no Arabic labels.

*QUL topics and themes*
- Checked (all 200 unless noted): `/resources`, `/resources/ayah-topics/45` and its 27 listing pages, `/resources/ayah-theme/62`, 150 random `/ayah/{key}/topics` and `/ayah/{key}/theme` pages, `/credits`, `/faq`, and the QUL GitHub models and routes.
- The copyright modal lives at `/resources/{id}/copyright`. Ids 45 and 62 both return "We don't have copyright information for this resource." A non-existent id returns 404, so the endpoint does resolve real resources. `/resources/ayah-topics/45/copyright` is 404.
- QUL's help text says: "Ontology topics are sourced from Quran corpus project" and "Thematic topics are sourced from Clear Quran translation". No source is given for the General topics.
- Type counts: General 1,549, Thematic 695, Ontology 285. 181 topics have no verses. No Ontology topic shows a parent, so the QAC hierarchy was not carried over.
- The General entries ("adoption (see Marriage)"-style cross-references) also appear on quran-wiki.com, which suggests a shared English index I could not identify.
- Themes: English only, keywords are auto-stemmed ("Supplic", "Wai"). The 1:1–7 theme matches word for word the heading in Malik's translation (pdfcoffee copy of an al-quraan.org PDF).
- FAQ quoted: "Yes, you can use QUL data in commercial projects. However, please review the licensing terms for each resource."

*QAC ontology*
- Checked, all 200: `ontology.jsp`, `topics.jsp`, `concept.jsp`, `concept.jsp?id=allah`, `/download/`, `faq.jsp`, `/java/`.
- QAC claims "300 linked concepts with 350 relations". The download page offers only morphology v0.4.
- `kaisdukes/quranic-corpus` (GPL-3.0) and `quranic-corpus-api` (no licence) contain no ontology data.
- The islamic-agent scrape (no licence) has 3,056 concept–verse links. That is a lower bound: its scraper stops at 250 verses per concept, and Allah alone has 2,721 occurrences.

*Semantic Quran*
- Licence quoted from Table 1: "Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)".
- The dump at `mlode.nlp2rdf.org/datasets/semanticquran.nt.gz`, the SPARQL endpoint and the datahub entry all fail to connect.

*Qurany*
- The original pages are gone: `www.comp.leeds.ac.uk/nora/` redirects to `eps.leeds.ac.uk/computing/nora/` (404); `quranytopics.appspot.com` returns 500/503.
- The mirror's README says: "These themes were imported from 'Mushaf Al Tajweed', compiled by Dr. Mohamed Habash … published by Dar Al-Maarifah". The mirrored pages carry no licence text.

*La Beaume*
- `archive.org/details/lekorananalyseda00labe`: metadata 200, 844 images, ABBYY OCR text of 1,875,693 bytes. I fetched two slices; its table of contents lists 18 chapters, Histoire through Progrès.
- Verse numbering differs from Hafs: the OCR's "254" is Hafs 2:253. There are OCR errors ("161." printed for 164).
- French Wikisource has 53 of 842 pages started (11 proofread).

*Arabic Tafsil*
- `archive.org/details/20210823_20210823_1433`: the Tesseract OCR is unusable on Quranic text; only some headings are legible.
- Not in the Shamela4 Hugging Face listing (8,589 books; a known title in that listing was found, so the search works). In OpenITI only references to it turned up.
- Copyright: Abd al-Baqi died 1968. Egypt's term is life + 50, so it expired at the end of 2018 (assuming Law 82/2002 applies). US status unknown.

*Wikidata*: a SPARQL query found 80 verse items and 114 surah items.

**(a) Recommendation**
- Use Quranpedia's topic dump as the primary Arabic, hierarchical, human-curated seed. It is the only source with a licence that permits both display and redistribution. Re-sync from its changes endpoint and show the credit and version in our API.
- Use QSAC to cover surahs 40–114 as a clearly labelled machine-draft layer, and as a cross-check elsewhere. It is the only complete, commercially safe dataset.
- Neither one is adequate alone: one has gaps, the other is English and LLM-made.

**(b) What to build in-house**
- An editorial Arabic taxonomy. Its top level can follow La Beaume's 18 public-domain chapters merged with Quranpedia's roots.
- Mapping tables from Quranpedia topics and QSAC tags into that taxonomy.
- Reviewed verse assignments for surahs 40–114, using classical (public-domain) tafsir as evidence.
- Per-link provenance (source, version, reviewer, confidence) and per-surah coverage checks.
- Optional: Wikidata IDs on person and place nodes.

**(c) Questions for you**
- Does our public API count as "republishing as a dataset" under Quranpedia's terms? If so, is showing credit and version acceptable?
- Can someone email Quranpedia (`quranpedia.help@gmail.com`) to confirm where the topic index comes from and that commercial use is fine? I did not contact them; per your rules, nothing goes out under your name without your OK.
- May users see LLM-generated topics (QSAC) as a labelled draft, or should they stay internal?
- Topic labels in Arabic only, or bilingual?
- One canonical taxonomy, or source-specific "lenses" in the topic graph?
- When is commercial launch expected? That decides whether non-commercial sources can be ruled out for good.
- Who does the scholarly review, and how much budget is there for it?
- Verse-level only, or word-span links too (the QAC ontology works at word level)?

**(d) Not verified**
- QUL downloads need a login. I could only match Malik's heading for 1:1–7, so the themes' source beyond that is unconfirmed. The General topics' source is unknown.
- The Clear Quran and Tarteel terms pages are JavaScript-rendered and returned no licence text.
- Qurany's concept count: the original site is down; ~1,100–1,200 comes from secondary sources.
- Quranpedia's topic source, and explicit commercial permission.
- Semantic Quran's dump host is down.
- The Kaggle file needs a login.
- The Hakkoum RDF knowledge graph zip (7.3 MB) is over the 5 MB sample limit, and its site returns 404.
- The Arabic Tafsil's first-edition year, its copyright status outside Egypt, and the Egyptian term assumption.
- Wherry's 1896 public-domain index and the QRCD dataset card were found but not opened.
- Full QAC verse links (the only scrape is capped).

**Things I noticed outside the task**
- Third parties have put licences on data they don't own: the Qurany mirror's Apache-2.0 and the Kaggle MIT labels.
- QSAC's licence differs between Kaggle (MIT) and its own files (CC BY 4.0).
- Quranpedia's API forbids bulk scraping, so any import must use the dumps.

**Pending and who owns it:** questions (c) are yours, as is the decision to contact Quranpedia; the legal check on the Tafsil copyright needs you or counsel; building the editorial taxonomy and the surah 40–114 work is ours once you choose a direction.

---

## Part 3 — Verse-to-verse relations, pronoun referents and named entities

#### Verse relations and entities: data source findings (2026-10-02)

**Bottom line**

- **Layer A (verse-to-verse):** no dataset is both complete and cleanly licensed. The best route is to extract the verse citations ourselves from the public-domain tafsir texts. Ibn Kathir already marks each cited verse with an editor reference that a script can read reliably (98.8% correct in my check). QurSim should be our test set, and the Waqar144 list is a good starting point for memoriser confusions.
- **Layer B (pronouns and named entities):** QurAna is the only resource that links pronouns to what they refer to across the whole Quran (24,679 pronouns, concept names in Arabic). Its terms only allow unchanged copies with credit. No open dataset links named entities to verses under a usable licence, so that part has to be built in-house. Wikidata (CC0) works as the ID and label spine but has no verse links.

##### Licence texts, quoted exactly

- **L1, QurSim (XML header).** From the LREC 2012 paper appendix and the Wayback copy of `textminingthequran.com/wiki/Verse_relatedness_in_Ibn_Kathir` (2016-02-10): "Copyright (C) 2011 Abdul-Baquee M. Sharaf / License: GNU Public License … TERMS OF USE: - Permission is granted to copy and distribute verbatim copies of this file, but CHANGING IT IS NOT ALLOWED. - This annotation can be used in any website or application, provided its source (TextMiningTheQuran.com) is clearly indicated. - This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all works derived from or containing substantial portion of this file." The CSV and SQL files served today have no header.
- **L2, QurAna (header of `karimouda/qurananalysis/data/quran-pron/*.xml`).** "Annotation of Quranic Pronouns (version 0.1) / Copyright (C) 2011 Abdul-Baquee M. Sharaf / License: GNU Public License / … This work used QAC (http://corpus.quran.com) for segmentation IDs and POS tagging." The terms of use are the same three clauses as L1. The JSON files served today have no header.
- **L3, QUL.** The copyright pages `qul.tarteel.ai/resources/{45,62,73,74}/copyright` each say: "We don’t have copyright information for this resource." The FAQ says: "Yes, you can use QUL data in commercial projects. However, please review the licensing terms for each resource." It also says: "The resources available on QUL vary in their copyright status… We recommend reviewing the licensing information provided by each resource’s author before use."
- **L4, Tarteel Terms of Service (`tarteel.ai/terms`, "Last updated: April 2, 2021").** "No Service Content may be modified, copied, distributed, framed, reproduced, republished, downloaded, scraped, displayed, posted, transmitted, or sold in any form or by any means, in whole or in part, other than as expressly permitted in these Terms and Conditions."
- **L5, Waqar144 README.** "The data in this project is free to use as you see fit. However, I would appreciate if you mention the use of this project in your app or any other kind of work if you decide to use this data." There is no LICENSE file.
- **L6, OpenITI.** The Zenodo record (version 2025.1.9, dated 2025-12-30) lists `cc-by-nc-sa-4.0`.
- **L7, Wikidata (`wikidata.org/wiki/Wikidata:Licensing`).** "All structured data (i.e. the main, Property, Lexeme, and EntitySchema namespaces) is released into the public domain under Creative Commons Zero."
- **L8, taaa22/quran-graph README.** "This project is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0)." There is no LICENSE file.
- **L9, qurananalysis README.** "Feel free to use QA in your research or applications". There is no LICENSE file (the GitHub licence API returns 404).

In the tables, "C" means I computed the number from the data and "Cl" means the source claims it.

##### Layer A: verse-to-verse relations

| Candidate | Checked (HTTP status) | Contents and coverage | Format | Licence | Display / redistribute / restrictions | Derived from | Quality | Verdict |
|---|---|---|---|---|---|---|---|---|
| QurSim, original | `http://textminingthequran.com/` 200; `data/ibn_kathir_similarity.csv` 200 (164,712 B, modified 2020-08-29); `sql/kathir.sql` 200; `papers/qursim.pdf` 200; old wiki 404, Wayback copy 200; HTTPS times out | Verse pairs cited in Ibn Kathir, with common-root count and a relevance score of 0/1/2. C: 7,679 rows plus 24 junk header/blank rows. Relevance 2 = 3,079, 1 = 3,718, 0 = 882. 7,299 unordered pairs. 4,158 verses touched (66.7%); relevance ≥1 covers 3,943 (63.2%), relevance 2 covers 2,578 (41.3%). No out-of-range references. | CSV, XLSX, SQL | L1 | Display allowed with credit. Redistribution of unchanged copies only. No non-commercial clause. "GPL" and "no changes" contradict each other. | Ibn Kathir (public domain) via the qurancomplex.com edition; roots from QAC | Leeds PhD, peer-reviewed at LREC 2012. Static since 2016. 130 pairs are near-adjacent (artefacts of verse grouping). Relevance-0 noise, e.g. 1:1→3:1. | Cross-check: use as the test set for our own extraction. Showing it unchanged with credit is allowed. |
| QurSim, filtered (`AlsalehAbdullah/QurSim`) | GitHub 200; CSV 2,254,930 B | C: 6,915 pairs (labels 1 = 3,510, 2 = 2,548, 0 = 857), 4,114 verses (66.0%), verse text added | CSV | No licence (all rights reserved by default); it is also a modified copy of L1 data | No | QurSim | WANLP 2021 paper | Avoid |
| QurSim, multilingual (`sabdul111`) | GitHub 200 | 84 XLSX files: QurSim pairs joined to translations | XLSX | No licence | No | QurSim plus translations, many of them copyrighted | — | Avoid |
| QUL Similar Ayah (resource 74) | `/resources/similar-ayah` 200; `/74` 200; `/resources/74/copyright` 200 | Computed word overlap per ayah: matched ayah, words matched, coverage %, score 0–100, word range in the matched ayah. Preview: 1:1 matches 27:30, 59:22, 1:3, 41:2. The site shows "4,001" with no unit. Not computed (download needs a login). | SQLite, JSON | L3 + L4. GitHub issue #704 (opened 2026-08-08, no replies) asks for a licence for resources 73 and 74. | No permission granted | Computed by QUL's own matching code (`lib/matching_ayah_service.rb` in an MIT-licensed repo): word/root n-gram matching plus a longest-common-substring score | Issue #349 (open): the export showed 2 matches for 2:3 where the site shows 5, and about 1,100 verses had coverage 0. PR #389 (2025-09) claims a fix. | Avoid the data; reimplement the method in-house |
| QUL Mutashabihat ul Quran (resource 73) | `/resources/mutashabihat` 200; `/73` 200; `/resources/73/copyright` 200 | Shared phrases. A ZIP with `phrases.json` (phrase id → surah count, ayah count, occurrence count, source location, word ranges per ayah) and `phrase_verses.json` (ayah → phrase ids). Preview of 2:112 shows 3 phrases. The site shows "5,277" with no unit. | JSON | L3 + L4, issue #704 | No permission granted | Curated in QUL's "Mutashabihat builder" tool by approved contributors. Upstream author unknown. | Issue #542 (open): word ranges past the end of the verse (48:10, 48:24) and inconsistent ranges at verse ends | Avoid until licensed; the structure is worth copying |
| Waqar144 `Quran_Mutashabihat_Data` | GitHub 200; `mutashabiha_data.json` 163,804 B | Curated list of verses memorisers confuse (deliberately not exhaustive). C: 1,344 entries, 1,424 unordered group pairs, 1,550 verses (24.9%); 270 entries say the next ayah is needed for context. | JSON, per-juz TXT, Dart scripts | L5 | Use and redistribution appear allowed; credit requested; no non-commercial limit | "work of Qari Idrees Al Asim (late)" plus the author's experience; the upstream title and its rights are unknown | 13 stars, last push 2026-03-09; used by other projects | Use as the memoriser seed with credit; ask the author for a formal CC0/CC-BY licence |
| `srmdn/quran-mutashabihat` | GitHub 200 | C: 1,657 pairs (283 curated with category and English note, 1,359 pending from Waqar144, 15 dropped), 1,731 verses | JSON | No licence | No | Waqar144 plus own curation (its AGENTS.md suggests AI-assisted work) | Useful category scheme: lafzi, word_swap, addition_omission, ending_variation, order_change, pronoun_shift | Avoid the data; borrow the category scheme |
| `hamzaBaghi/mutashabihat-public-data` | GitHub 200 | `similar_groups.json` (1.2 MB): shared phrase, type, highlighted word indices | JSON | No licence; source unknown | No | Unknown | — | Avoid |
| `FatimaALzahrani/Quran-similarty-dataset` | GitHub 200 | Firebase export of similarity percentages | JSON | No licence | No | Own script | — | Avoid |
| Ibn Kathir citation extraction (in-house) | `spa5k/tafsir_api` v1.2.2 `ar-tafsir-ibn-kathir/2/255.json` 200 (67,645 B), plus surahs 18, 36, 67 | Cited verses appear as `﴿quote﴾ [سورة:آية]` in Arabic-Indic digits, including ranges and lists, e.g. `[مَرْيَمَ: ٩٣-٩٥]` and `[آلِ عِمْرَانَ:١، ٢]`. Footnotes use double brackets `[[…]]`. Quotes of the verse being explained carry no reference. C: 2:255 has 9 references. Per ayah: 0.87 (surah 18), 0.73 (36), 0.33 (67). 159 of 161 resolvable references point to a verse that contains the quote (98.8%); one editor typo (`[البقرة: 280]` for 2:28) and one spelling-normalisation miss. | JSON | Repo code is MIT. The text comes from QUL tafsir 22 (no copyright info on QUL). The classical text is public domain; the brackets and footnotes are modern editorial additions. | We would own the extracted pairs (they are facts) | Ibn Kathir (d. 774 AH) | Similar volume to QurSim: surah 18 gives 96 bracket references and 109 pairs found by quote matching, against QurSim's 139 | Build in-house; primary source |
| Quote matching for other public-domain tafsirs | Tabari, Baghawi, Qurtubi, surah 67 | Bracket references: Tabari 0, Baghawi 2, Qurtubi 15 (different layout). Quotes of 3+ words matched against the Tanzil text with 0–14 misses per surah. Cross-verse yield in surah 67: Tabari 3, Baghawi 0. | — | — | — | — | Low yield outside Ibn Kathir | Build in-house; secondary |
| Adwa' al-Bayan (known to be in copyright) | spa5k/QUL export, surah 67, 200 | C: 102 references across 16 entries; 91 of 93 correct (97.8%). The densest Quran-by-Quran source. | JSON | In copyright | No | — | — | Avoid unless rights are cleared |
| Classical mutashabih works in OpenITI | Raw files 200: Iskafi, درة التنزيل (Shamela0001340, 1,010,888 B); Kirmani, البرهان (filed as "AsrarTikrar", Shamela0003580, 332,360 B); Ibn Jama'a, كشف المعاني (Shamela0001403, 317,501 B). Ibn al-Zubayr's ملاك التأويل is not in OpenITI. | Kirmani: 604 numbered entries under 113 surah headings, quotes in `{…}` without verse numbers. Ibn Jama'a: 423 numbered questions, quotes in `(…)`. Iskafi: quotes in `(…)` with some references like "الأعراف: 62". None is structured as verse pairs. | OpenITI text | L6 (CC BY-NC-SA 4.0) | Non-commercial and share-alike on OpenITI's digital text; the works themselves are public domain | Shamela copies of modern editions | Not structured | Cross-check; possible later in-house structuring |
| Other 2026 AI-assisted repos | GitHub/HF 200 | OpenHikmah (GPL-3.0 app, AI-explained edges, no dataset); qataruts "Mishkat" (no stated licence, computed and LLM links); quran-bil-quran (MIT label on a concordance derived from QAC, which conflicts with QAC's no-change terms); quranlab corpus graph (licence "other: reference-attribution-removal", aggregates QUL and QuranEnc); QSAC (CC BY 4.0, LLM-assisted topic tags over the Saheeh International translation) | — | Various | — | — | AI-generated | Avoid (QSAC: cross-check only) |
| QRCD (`tarteel-ai/quranqa`) | HF card 200 | Question-answering passages, not verse relations | — | CC BY-ND 4.0 | No-derivatives blocks our use | — | — | Avoid |

##### Layer B: pronoun coreference and named entities

| Candidate | Checked (HTTP status) | Contents and coverage | Format | Licence | Display / redistribute / restrictions | Derived from | Quality | Verdict |
|---|---|---|---|---|---|---|---|---|
| QurAna | `data/QAnaphor.json` 200 (5,773,706 B, 2021-01-25; only the first 1 MB and the tail fetched); `QConcept.json` 200; `QacSegment.json` 200 (34,969,226 B, range sample only); `papers/qurana.pdf` 200; old wiki 404, Wayback 200; XML mirror in `karimouda/qurananalysis` 200 | Each QAC pronoun → concept id plus the span it refers to. C: 24,679 records (matches the paper); 1,028 concepts (ids up to 1,054) with Arabic names (e.g. إخوة يوسف، امرأة عزيز مصر، الخضر) and 1,027 English glosses. First 1 MB: 4,573 records, 1,825 with no antecedent span, 867 whose antecedent is in another ayah, 0 unmapped QAC ids. Surah 12: 110 of 111 verses have at least one pronoun (649 pronouns). Surah 18: 107 of 110 (545). Cl: 13,158 pronouns (53%) have an explicit antecedent. Whole-Quran verse fraction not computed (file over the 5 MB sample limit). | JSON now, XML in 2011 | L2 | Display allowed with credit. Redistribution of unchanged copies only. No non-commercial clause in its own text, but it depends on QAC segment ids, which brings in QAC's terms. | QAC segmentation | Leeds PhD, LREC 2012, revised by Imran Shafiq. Known issues: singular and plural merged into one concept, abstract referents. | Use with constraints; it is the only whole-Quran coreference data |
| QAC ontology and named-entity tagging | `ontology.jsp` 200; `concept.jsp?id=musa` 200 ("136 occurances"); `id=satan` 200 (88); `download/` 200 (morphology only) | Cl: "300 linked concepts with 350 relations". Named-entity spans and pronoun links appear on the word pages only. No bulk download, so it would have to be scraped. | HTML | QAC terms (already known) | Credit and link required; unchanged copies only; non-commercial wording in the FAQ | Ibn Kathir plus hadith | Kais Dukes; site maintained by the quran.com team; pronoun-link coverage not verified | Cross-check and use as a taxonomy reference |
| QUL Ayah Topics (resource 45) | `/resources/ayah-topics/45` 200; `/resources/45/copyright` 200 (no info) | 2,512 topics of three kinds: Ontology ("sourced from Quran corpus project"), Thematic ("sourced from Clear Quran translation") and General. The first page of 100 rows has 16 Ontology topics, e.g. Aad 23 ayahs, Adam 39, Allah 153. | SQLite (login) | L3 + L4 | No permission granted | QAC ontology plus Clear Quran (copyrighted) | — | Avoid; it does confirm QAC concept-to-ayah lists exist |
| QAC PN tags (already known) | — | 3,911 proper-noun segments | — | QAC terms | QAC terms | QAC | — | Use to generate entity candidates |
| QA Ontology (`karimouda/qurananalysis`) | GitHub 200; OWL file 2,117,429 B | C: 508 classes, 713 relations, no individuals, no verse links; Arabic and English labels, lemma, root | OWL | No LICENSE file; only the informal L9 wording | Unclear | QAC, QurAna, WordNet, DBpedia (auto-extracted, MSc 2015) | Last push 2017 | Avoid |
| Wikidata | `query.wikidata.org` 200 | C: 127 items marked as "present in work: Quran" (126 with Arabic labels), with noisy types (76 "Islamic term", 56 Sufi terminology). Only 3 have a verse qualifier. Classes: Quranic character 23, prophet of Islam 19, angel in Islam 13. No property for Quran verses. | RDF/JSON | L7 (CC0) | Display, redistribution and commercial use all allowed | — | Crowd-edited | Use as the entity ID and label spine, not for verse links |
| `taaa22/quran-graph` | GitHub 200 | C: 233 nodes in 16 types, 753 links with verse strings; README claims 965 verse references | JSON, Cypher | L8 | Allowed with credit if the README statement is accepted | README says "initially extracted using AI" and "not 100% accurate" | One day of activity | Cross-check only, as a seed list of entity types |
| `superizky27/Quranic-NER` | GitHub 200 | C: 36,753 Indonesian tokens from juz 1–6 only; person tags only (1,127 begin, 2,012 inside) | XLSX | MIT ("Copyright (c) 2026 [Rizky Ilhamsyah/Telkom University]") | — | Indonesian translation, source not stated | Student project | Avoid |
| CANERCorpus | README 200 | 7,000+ hadiths with 20 entity types; not Quran | — | GitHub reports NOASSERTION | Unclear | Sahih al-Bukhari | Peer-reviewed | Avoid |
| Semantic Quran (AKSW) | Dump host fails DNS; datahub page 404; DBpedia DataID example file 200; paper 200 | Translations and QAC morphology as RDF; no named entities | N-Triples | Non-commercial: the DataID file says "Creative Commons Attribution-NonCommercial 4.0 International" | Non-commercial | Tanzil plus QAC | Dump offline | Avoid |

##### Layer A wrap-up

- **(a) Recommended sources:**
  - Extract citation edges ourselves from Ibn Kathir (bracket references plus quote matching), recording which tafsir, which verse group and how confident.
  - Reimplement QUL's MIT matching logic over our own licensed Quran text for wording similarity.
  - Use Waqar144 as the curated memoriser seed, with credit.
  - Keep QurSim for evaluation; it may also be shown unchanged with credit.
- **(b) Build in-house:**
  - A surah-name normaliser (surah 18 alone uses 58 vowelled spellings).
  - A reference parser that handles ranges, lists and reversed ranges, and skips `[[…]]` footnotes.
  - A quote-to-verse matcher that normalises spelling differences (e.g. ندعوا vs ندعو).
  - Anchoring from a commentary group to a single verse, plus deduplication and symmetry.
  - Phrase-level wording matches with word ranges.
  - Relation types (tafsir citation, wording similarity, memoriser confusion) with provenance and a review screen.
- **(c) Open questions for the product owner:**
  - Do we accept QurSim's and QurAna's "unchanged copies plus credit" terms for display and our API? Should we contact the author (abdulbaqi.io) for a clean CC-BY?
  - Should verse pairs extracted from Adwa' al-Bayan be used or excluded?
  - Should we ask Waqar144 for a formal licence?
  - Do we wait on QUL issue #704 or write to Tarteel?
  - Are we comfortable treating the modern editor's verse references in the Ibn Kathir edition as facts we can extract?
- **(d) Not verified, and why:**
  - What the QUL datasets actually contain and what the 5,277 and 4,001 numbers count: downloads need a login.
  - Who authored QUL's mutashabihat data: the page credits no one.
  - Full-Quran yield of the Ibn Kathir extraction: I sampled about 3.3 surahs because the whole tafsir exceeds the sample limit.
  - A digital copy of ملاك التأويل: it is not in OpenITI and I did not search further.
  - textminingthequran.com over HTTPS: it times out, so I used HTTP.

##### Layer B wrap-up

- **(a) Recommended sources:** QurAna for pronoun references, pending the licence decision. Wikidata (CC0) for entity IDs and labels. QAC proper-noun tags to generate entity candidates.
- **(b) Build in-house:**
  - A curated entity registry covering prophets, people, angels, jinn, nations, groups, places, events and objects, with Arabic canonical names, aliases (e.g. إبليس/الشيطان) and Wikidata IDs.
  - Word-level mention annotation: names from the proper-noun tags plus descriptive mentions like فرعون or امرأة العزيز.
  - A mapping from QurAna's 1,028 concepts onto that registry.
  - A coreference graph and a review tool.
- **(c) Open questions for the product owner:**
  - Do we accept QAC-derived terms, given that QurAna depends on QAC segment ids and QAC's FAQ uses non-commercial wording?
  - Is scraping the corpus.quran.com ontology pages acceptable, since there is no bulk download?
  - If QAC's terms are rejected, do we re-anchor QurAna on an independently licensed morphology?
  - Taxonomy: is الله an entity node, and are groups such as المنافقون entities?
- **(d) Not verified, and why:**
  - QurAna's verse coverage across all 6,236 verses: the file is over the 5 MB sample limit.
  - How much of QAC has pronoun links, and its concept-to-verse counts: there is no bulk export.
  - Semantic Quran's licence on a live page: datahub returns 404 and the dump host is gone.
  - Kaggle and Mendeley: search found nothing relevant, and I created no account.

---

## Part 4 — Syntax (iʿrāb), qirāʾāt, tajwīd and waqf

The two layers come out very differently. For syntax/i'rab, nothing is both complete and cleanly licensed for commercial use. For qira'at, tajweed and waqf, there are usable openly licensed sources, but each needs an alignment step. All counts below are ones I computed unless marked "claimed".

#### Local files (computed)

**QAC v2 treebank (`syntax.txt`)**
- **Coverage:** 7,373 graphs separated by `go`. They cover 2,436 of 6,236 verses (39.06%) and 32,617 of 77,429 words (42.13%).
- **Surahs:** 1–8 and 59–114 are complete, and 9:1–91 (of 129) is covered. 65 surahs are touched, 64 of them fully. Every covered verse has all of its words in a graph. 67 graphs span more than one verse.
- **Newer than the website:** corpus.quran.com/treebank.jsp (HTTP 200) lists only chapters 1–8 and 59–114, so the v2 data adds 9:1–91.
- **Edge labels:** 45 types. The most common are subj 7,694, link 5,815, gen 5,481, obj 4,907 and poss 3,912.
- **Phrase tags:** 6 types: PP 5,403, VS 4,432, NS 1,277, SC 308, S 84, CS 70.
- **Elided nodes:** PRON 2,858, N 1,325, ADJ 325, V 141, VOC 54, and a few others.
- **Format:** each graph has three sections: words (nodes such as `word(c:v:w)`, `reference(c:v:w)` or an elided `PRON(...)`), phrases, and edges written as `rel(dependent - head)`.

```
-- words
n1 = V(*)
n2, n3 = word(1:1:1)
n4 = word(1:1:2)
n5 = word(1:1:3)
```

- **Licence flag:** the `quran-uthmani.xml` bundled in the same QAC folder is Tanzil v1.0.2 with the header "License: Creative Commons BY-ND 3.0 Unported". That is not the CC BY 3.0 that applies to Tanzil v1.1.

**QAC `pause-marks.tsv`**
- **Format:** 4,359 rows, no header, two columns: global QAC word index (1–77,429) and a code from 1 to 6.
- **What the codes mean:** the file doesn't say, so I derived it by aligning against Tanzil: 1=م (22), 2=لا (68), 3=صلى (1,682), 4=قلى (603), 5=ج (1,972), 6=∴ (12).
- **It is Tanzil's marks re-keyed to QAC words:** 3,498 positions match Tanzil v1.1 exactly. The other 861 are off by 1–2 words with the same code, because three verses are split into words differently. That accounts for all 4,359.

**MASAQ v6**
- **Size:** 157,676 rows, 77,411 words, 6,236 verses, 114 surahs. There are 77,797 distinct IDs, so the ID is per stem, not per word.
- **Columns (19, although the metadata says 20):** ID, Sura_No, Verse_No, Word_No, Segment_No, Word, Without_Diacritics, Segmented_Word, Morph_Tag, Morph_Type, Punctuation_Mark, Invariable_Declinable, Syntactic_Role, Possessive_Construct, Case_Mood, Case_Mood_Marker, Phrase, Phrasal_Function, Gloss.
- **Role coverage:** 110,886 rows carry a Syntactic_Role. 74,763 words have at least one role (96.58% of 77,411), and Case_Mood is present on 77,402 words.
- **Phrase fields are sparse:** Phrasal_Function is filled on only 2,830 rows.
- **Gap:** perfect verbs carry no role (PV stems 8,264 of 8,433 empty, PV_PASS 553 of 563). 2,648 words have no role at all, led by قال (416) and كان (322).
- **Not a tree:** there is no head or dependency index, so these are labels without attachments.
- **Text base:** the words are Tanzil *simple* script (e.g. الرَّحْمَنِ), not Uthmani.
- **Top 20 roles:** PREP 13,033 · PREP_OBJ 12,243 · AGNT 10,483 · NON_INFLECT 9,999 · GEN_CONS 9,123 · CONJ 8,909 · OBJ 8,878 · IV 7,527 · SUBJ 3,598 · CONJ_N 2,430 · SUBJ_COP_PART 2,086 · PRED 2,057 · ADJ 2,043 · CV 1,842 · ANNUL_PART 1,816 · ADV_TIME 1,426 · SUBJ_COP_V 1,199 · PART_COP_PRED 929 · PART_CONDITION 872 · PART_JUSSIVE 839. There are 59 distinct roles in total.
- **Case_Mood values:** INVARIABLE 53,687, NOMINATIVE 27,014, GENITIVE 23,255, ACCUSATIVE 19,327, JUSSIVE 1,490.

**Tanzil `quran-uthmani-marks-sajdah.txt` (v1.1)**
- **Pause marks:** ۖ صلى 1,682 · ۗ قلى 603 · ۚ ج 1,972 · ۙ لا 68 · ۘ م 22 · ۛ ∴ 12, totalling 4,359. These are the same six types and counts as the QAC file.
- **Other signs:** ۜ (small high seen) 7 and ۩ (sajdah) 15.
- **Format:** `sura|aya|text`, with marks as separate tokens. Verse 1 of each surah except 1 and 9 starts with the bismillah in this file.
- **Licence header:** "License: Creative Commons Attribution 3.0 … CHANGING IT IS NOT ALLOWED".

#### Layer A: syntax and i'rab

| Candidate | URL (status) | Contents and coverage | Licence (verbatim, where read) | Display / redistribute / NC-SA-ND | Derived from | Verdict |
|---|---|---|---|---|---|---|
| QAC v2 treebank | github.com/kaisdukes/quranic-corpus-api (200). GitHub API: no licence, single push 2023-09-04 | Dependency graphs, 42.13% of words (computed above) | Repo: no licence file, so all rights reserved by default. Site: "available under the GNU public license with terms of use" | Display: NC only. Redistribution: no (no-change + NC) | QAC; Tanzil v1.0.2 (BY-ND) | Cross-check, or use as NC with permission. Covers 42% |
| QAC `irab.tsv` (new find, not in local raw) | Same repo, `src/main/resources/data/irab.tsv`, 12,236,184 B (200 on a range request) | Arabic i'rab prose aligned to word spans. Column 1 is the span length in words: the first 1,132 segments sum to 2,561 words and end at 2:143 with matching text | No licence | No | الإعراب المفصل لكتاب الله المرتل (بهجت عبد الواحد صالح). Shamela book 150578 has the same opening text, and the chunker README names "al-I'rāb al-Mufassal". Modern work, in copyright | Avoid (copyright). The word-span structure is a useful model |
| EQTB (Extended Quranic Treebank) | pmc.ncbi.nlm.nih.gov/articles/PMC12361616 (200); data.mendeley.com/datasets/rk96pn66m4/1 (200); github.com/NoorBayan/Quranic (200, MIT, 182 stars, pushed 2026-09-17) | Token file from `Quranic.rar`: UTF-16 TSV, 51 columns, 139,376 rows. 6,236 verses, 77,429 words, 11,157 elided tokens, 11,693 sentences, 129 relation labels. Chapters 9–58 (3,891 verses, 46,534 words) were parsed by a BiLSTM model. Claimed LAS 95.7% on a 350-sentence sample; the paper says it has "not yet undergone the exhaustive, token-by-token manual review" | Mendeley: "CC BY 4.0". GitHub: MIT. Article: "open access article under the CC BY license" | The labels say commercial use is fine, but the content embeds QAC morphology features verbatim (e.g. `STEM\|POS:N\|LEM:{som\|ROOT:smw…`) and QAC English glosses ("In (the) name"). QAC's terms are therefore inherited | QAC images "web-crawled… then converted"; Tanzil | Cross-check. It is the only full-coverage graph, but the licence chain is unresolved and 60% of verses are machine-parsed |
| MASAQ | data.mendeley.com/datasets/9yvrzxktmr/6 (200) | 96.6% of words have role labels; no tree (computed above) | v6 (local JSON): "CC BY NC 3.0 … do not use the material for commercial purposes". **New:** the Mendeley pages for v1 (2024-10-14), v3 (2024-10-29) and v5 (2024-11-11) show "CC BY 4.0". The paper says CC BY 3.0 | v1, v3, v5: commercial use and redistribution allowed with attribution. v6: NC | Tanzil simple text. The Gloss column looks QAC-derived (my inference, unverified) | Use, as the primary word-level i'rab labels. Prefer the CC BY 4.0 version (v5) if its content matches v6 |
| QUL #504 إعراب الميسر | qul.tarteel.ai/resources/tafsir/504 (200) | JSON/SQLite verse-keyed prose; sample "﴿أو﴾: أو عاطفة للتخيير" | No author or licence on the page | Unknown | Author not stated. Possibly محمد الطيب الإبراهيم's work (Dar al-Nafa'is), unverified | Avoid |
| QUL #506 إعراب القرآن للدرويش | /tafsir/506 (200) | Full-Quran prose | Unknown (page gives none) | Modern work, in copyright | محيي الدين درويش, d. 1982 (from your brief) | Avoid |
| QUL #515 (Da'as) | /tafsir/515 (200) | Full-Quran prose; the page title is garbled | Unknown | Modern, in copyright | الدعاس وآخرون | Avoid |
| QUL #520 الجدول | /tafsir/520 (200) | Full-Quran prose | Unknown | In copyright. Shamela's death date "1376 هـ - 1985 م" is internally inconsistent, and the printed preface is dated 1399/1979 (mtafsir.net thread) | محمود صافي | Avoid |
| QUL #505 الدر المصون / #526 البحر المحيط (new find) | /tafsir/505, /tafsir/526 (200) | Verse-keyed passages | QUL generally shows no per-resource licence; #522's page says "We don't have copyright information" (not checked on these two pages) | Authors are public domain, but the text comes from modern editions with unknown rights | Probably tafsir.app (which lists the same set and states no terms); unverified | Cross-check |
| QUL #563 Ayah Dependency Graphs | qul.tarteel.ai/resources/morphology/563 (200) | SVG graphs; incomplete | Page: "temporarily published under the tafsir section for testing"; no licence | Unknown | QAC treebank | Avoid |
| OpenITI classical i'rab works | GitHub OpenITI/0350AH, 0450AH, 0625AH, 0775AH, 0750AH; zenodo.org/records/18613982 (WebFetch OK; curl 403) | Confirmed present: Nahhas IcrabQuran (3 versions, 2.9–4.2 MB), Makki MushkilIcrabQuran, Ukbari TibyanFiIcrabQuran, Samin DurrMasun, Abu Hayyan TafsirBahrMuhit. Format is mARkdown with page markers; **not verse-keyed** | "Creative Commons Attribution Non Commercial Share Alike 4.0 International" (Zenodo release 2025.1.9) | Display: NC. Redistribution: SA | Shamela digitisations of modern critical editions | Cross-check. It is the only public-domain-author path, but needs in-house verse alignment and stays NC-SA |
| mousadirksz/quran-analysis | github.com/mousadirksz/quran-analysis (WebFetch OK) | SQLite combining QAC, EQTB, Nahhas and wujuh works; claims 451 Hafs–Warsh farsh verses | No licence file | No | QAC (GPL), OpenITI (NC-SA) | Avoid |
| kaisdukes quran-neural-parser / -chunker | GitHub (no licence; pushed 2023-07) | Code; the chunker has `quranic-treebank-0.4-chunks.tsv` (1.5 MB) | No licence | No | QAC | Avoid |
| Universal Dependencies | universaldependencies.org/ar (200) | Only PADT, PUD and NYUAD; no Quranic treebank | n/a | n/a | n/a | n/a |
| Hugging Face | Dataset search API | Only `ihessahAlharbi/irab_scraping_dataset` (114 rows, empty dataset card, no licence) | None | No | Unknown scrape | Avoid |

#### Layer B: qira'at, tajweed and waqf

| Candidate | URL (status) | Contents and coverage | Licence (verbatim, where read) | Display / redistribute / NC-SA-ND | Derived from | Verdict |
|---|---|---|---|---|---|---|
| KFGQPC riwayat packages | Wayback index of download.qurancomplex.gov.sa/resources_dev/ (200). The live host timed out | Seven riwayat in 2022 `qc2_*_data` zips (Warsh, Qalun, Duri, Susi, Shu'bah, Bazzi, Qunbul) and `Uthmanic*_v2-x` zips, plus Qunbul v2.0 captured 2026-02-15 | Usage rights (quoted in quran-ws/quran-text LICENSE): "Mus'haf al-Madinah in these previous formats can be used for free in all personal, individual businesses… can be used also in websites, software". The Warsh `read.me` has no licence | Display: yes. Redistribution: arguably yes (wording is about Hafs formats). The font EULA forbids modification | KFGQPC | Use as the authoritative riwaya texts |
| KFGQPC Warsh sample (downloaded) | Wayback copy (3,660,591 B) | Formats: csv, json, xml, sql, txt, xlsx, html, plus TTF and .doc. Columns: id, jozz, page, sura_no, sura_name_en, sura_name_ar, line_start, line_end, aya_no, aya_text. 6,214 ayahs. Waqf uses only U+06D6 (9,948 times); 14 sajdah; 435 rub el-hizb. Ayah numbers are encoded as U+FC00… codepoints, so they depend on the font | As above | As above | KFGQPC | Use, but variants must be derived by us |
| quran-ws/quran-text (new) | github.com/quran-ws/quran-text (200). Created 2026-09-01, beta, 0 stars | Seven riwayat built from KFGQPC v3.0 packages, recorded with SHA-256; one shared word ID across 77,434 words. My count of `differences.csv` is 292 rows (alif 198, rasm 75, word-boundary 16, partial 3); the README says 277. Claimed word statuses: identical 40,624, diacritic 36,180, dotting 338 | "CC BY 4.0 (the work), attribution waived for use inside a product · KFGQPC terms (the text)" | Yes / yes, BY | KFGQPC | Use as the alignment accelerator: pin a version and cross-check against the KFGQPC raw files. It lacks Qunbul and the other 13 riwayat |
| quran-ws/qiraat-ayah-map | github.com/quran-ws/qiraat-ayah-map (200) | Ayah mappings across six counting systems for the ten qira'at | Data "CC BY 4.0… waiver of the attribution requirement… within an application"; code MIT; `sources/` is third-party | Yes / yes | al-Dani's al-Bayan and others | Use (needed to join 6,214 Warsh ayahs to Hafs keys) |
| Corpus Coranicum TEI | github.com/telota/corpus-coranicum-tei (200), pushed 2024-12-20 | `allvariants.xml` (8.44 MB), `reader.xml`, `sources.xml`. Sampled ≈3.4k items: variants are **Latin transliteration only**; the Arabic `<w xml:lang="ara"/>` element and the source key were empty in every sampled item. Highest variant ID seen is 18,306; total not computed. Includes canonical and shadhdh readers (Ibn Mas'ud, al-Hasan al-Basri…) | README: "© Berlin-Brandenburgische Akademie der Wissenschaften 2024 / Creative Commons CC BY-SA 4.0" | Yes / SA | Classical sources (al-Nashr, Taysir, Mukhtasar…) | Cross-check (SA would apply to the derived layer) |
| AQQD | pmc.ncbi.nlm.nih.gov/articles/PMC13285623 (200) | 24,183 audio files, 309 reciters, 70 surahs; explicitly no annotations | "CC0 1.0 Public Domain license" | Yes | Recordings | Avoid for the text layer |
| QUL Warsh scripts | qul.tarteel.ai/resources/quran-script (200) | Only Warsh among non-Hafs riwayat (ayah and word-by-word) | Not checked on the Warsh pages; QUL generally gives no per-resource licence | Unknown | KFGQPC | Cross-check |
| Tanzil | tanzil.net/download (200) | Hafs only (simple and Uthmani); no qira'at | "changing the text is not allowed… source (Tanzil Project) is clearly indicated" | Yes / verbatim only | Madinah mushaf | Use for waqf marks |
| al-Nashr | QUL #522 (200); OpenITI 0833IbnJazari.Nashr (Shamela0022642, 2.7 MB) | QUL: verse-keyed passages. OpenITI: page-marked prose | QUL: "We don't have copyright information". OpenITI: CC BY-NC-SA 4.0 | Unknown / NC-SA | Modern editions | Cross-check (reference for the variant apparatus) |
| cpfair/quran-tajweed | github.com/cpfair/quran-tajweed (200). Last push 2021-10-12, "not actively maintained" | 18 rules; JSON `{surah, ayah, annotations:[{rule, start, end}]}` with codepoint offsets into a pinned 2017 Tanzil text. The full file is 5.58 MB, so I counted only the first 4.9 MB: 4,915 ayahs (through 55:14), 53,152 spans. Quran-Lab's README claims 60,057 in total. Offsets drift against current Tanzil: 97.3% of hamzat al-wasl spans line up (11,378/11,689) | Data: "licensed under a Creative Commons Attribution 4.0 International License". Code: no licence file (all rights reserved) | Yes / yes, BY | Tanzil 2017; "information from ReciteQuran.com, the Dar al-Maarifah tajweed masaahif" | Use the data pinned to its own text, with a remapping layer. Quran-Lab's README lists a few span errors (17:7, 5:29, 28:76, 30:10) |
| quran-ws/quran-tajweed (new) | GitHub API OK (web page gave a 504). Release v0.4.3, 2026-09-12 | From `uthmani-hafs.json`: 147,255 spans over 6,235 ayahs (20:1 has none); 127 rules produce spans out of 164 IDs (182 rules claimed). Qalqalah and madd lazim are flagged `needsReview` | "CC BY 4.0 (the corpus, annotations and editions) · MIT (the engine)". The span base text "was exported from an earlier application… It is NOT the KFGQPC text" | Yes / yes, BY | Text provenance not recorded | Cross-check (promising, but the base text is unknown) |
| quran.com / Quran Foundation `text_uthmani_tajweed` | api.quran.com (200); api-docs.quran.foundation/legal/developer-terms (200, updated 2026-09-26) | `<tajweed class=…>` markup with 16 classes | "non-exclusive, revocable, non-transferable, non-sublicensable license… solely to develop and operate Applications". Redistribution of raw data needs a separate commercial licence; storage limited to one week | Display via their API only; no redistribution | Quran Foundation | Avoid for our API |
| alquran.cloud `quran-tajweed` | alquran.cloud/terms-and-conditions (200) | Surah 2: 281 of 285 comparable ayahs have identical text and identical span offsets to quran.com's tajweed, with a one-to-one code mapping. It is the same data | "You may reproduce… for any non-commercial purpose. Commercial reproduction… requires no permission… but a respectful acknowledgement". "The Quran text… originally retrieved from GlobalQuran.com". Tajweed licence: unknown | NC-leaning; unknown | quran.com tajweed | Avoid |
| QUL QPC tajweed (#87, #58, #47) | /quran-script/87 (WebFetch OK) | Colour is carried by the font; `text_uthmani_tajweed` | None on the page | Unknown | KFGQPC / QUL | Avoid |
| Quran-Lab tajweed phonetics | huggingface.co/datasets/Quran-Lab/quran-tajweed-phonetics (200), modified 2026-10-01 | Phone-level data, 522,475 phones claimed; expert review claimed | "You may not Charge for the Work or for any Derivative… [or place it] behind a payment, a subscription, a paywall, or advertising"; "You must distribute… every Derivative under this same License" | NC, no ads, SA | Tanzil/KFGQPC + cpfair checks | Cross-check only |
| QAC `pause-marks.tsv` | Local | Same marks as Tanzil (computed above) | QAC terms | NC | Tanzil | Cross-check |
| Classical waqf works | OpenITI | Confirmed present: Dani's MuktafiFiWaqf (443 KB; ed. رمضان, دار عمار 2001), Ashmuni's ManarHuda (2 versions, 1.9 MB), Ibn al-Anbari's IdahWaqfWaIbtida, Nahhas's QatcWaItinaf. Not verse-keyed | CC BY-NC-SA 4.0 | NC-SA | Modern editions | Cross-check |
| Indo-Pak waqf | QUL Indopak (#55, #59, #89, #90, #565, #566); DigitalKhatt `indopakfont` (OFL-1.1) | Indo-Pak uses a larger sign set (e.g. ط، ز، ص، قلے، صلے) than Madinah's six (learnquran.ca, quraanteacherresources); not deeply verified | QUL: none stated | Unknown | Various | Defer |

#### Recommendations

**Layer A (syntax/i'rab)**
- **Recommended:**
  - MASAQ for word-level i'rab labels (role, case, case marker) on 96.6% of words.
  - QAC v2 graphs for the 42% of words it covers, under NC.
  - EQTB only to cross-check or fill chapters 9–58, with a "machine-parsed" disclaimer.
- **Build in-house:**
  - A three-way word alignment: MASAQ 77,411 / QAC 77,429 / EQTB 77,429 tokens, onto our word IDs.
  - Arabic names for the role codes.
  - Filling the missing perfect-verb roles.
  - Generating Arabic i'rab sentences from the labels.
  - Verse-segmenting a public-domain classical i'rab work, if we want prose.
- **Questions for you:**
  - Do we take MASAQ v5 (CC BY 4.0) and diff it against v6, or ask the authors to resolve the licence conflict?
  - Do we accept NC-only for graphs, or ask Kais Dukes / quran.com for permission?
  - Is NC-SA (OpenITI) acceptable for any layer exposed through the API?
- **Not verified:**
  - QUL i'rab texts (login needed) and the #504 author.
  - Darwish's death date (taken from your brief) and the Da'as publication year.
  - MASAQ v2 and v4 licences, and the v5 vs v6 content difference.
  - EQTB accuracy on chapters 9–58.
  - The full `irab.tsv` (12 MB, over the sample limit).

**Layer B (qira'at, tajweed, waqf)**
- **Recommended:**
  - Qira'at: KFGQPC packages as the authority, quran-ws/quran-text for word alignment, and qiraat-ayah-map for ayah numbering. Corpus Coranicum stays a separate cross-check (SA, transliteration only).
  - Tajweed: cpfair (CC BY 4.0), pinned to its text, cross-checked against quran-ws/quran-tajweed.
  - Waqf: Tanzil marks (CC BY 3.0) keyed to our words.
- **Build in-house:**
  - Usul/farsh classification and reader attribution beyond KFGQPC's eight riwayat, curated from al-Nashr.
  - Remapping tajweed offsets onto our display text.
  - Handling KFGQPC's font-dependent codepoints.
  - A glossary of waqf signs.
- **Questions for you:**
  - Which riwayat to show: KFGQPC's 8 or all 20?
  - Should shadhdh readings appear?
  - Display text base: Tanzil or KFGQPC (the KFGQPC font forbids modification)?
  - How fine-grained should tajweed be: 18 rules or about 127?
  - Is Indo-Pak waqf in scope?
- **Not verified:**
  - KFGQPC's own licence page and live files (host timed out).
  - Qunbul package contents.
  - quran-ws review claims, and its 277 vs 292 differences count.
  - cpfair's full count (5.58 MB file, over the sample limit).
  - Corpus Coranicum's total item count, and whether its website/API has the Arabic forms.
  - `Tajweed_Muyassar.docx`.

#### Flags outside the task
- Local `tanzil/quran-uthmani.txt` is byte-identical to `quran-uthmani-nomarks.txt`: same SHA-256 and zero pause marks.
- The QAC-bundled Tanzil text is v1.0.2 under BY-ND, unlike Tanzil v1.1 (BY).

---

## Part 5 — Occasions of revelation, Makki/Madani, revelation order, Quran word audio

I found open sources for both layers. Layer A is mostly covered: surah-level type and order from Tanzil, Arabic surah introductions and 201 vetted asbab entries from the Tafsir Center's own CC BY 4.0 database, and al-Wahidi and al-Suyuti asbab texts from OpenITI (CC BY-NC-SA, non-commercial only). Layer B has no openly licensed set of isolated-word recordings. The only licensed path is to cut EveryAyah verse audio (CC BY-NC) using quran-align word timings (CC BY 4.0). The one complete isolated-word set I could trace to an owner is the Tafsir Center's, and it is "all rights reserved", so using it means asking them for permission.

#### Local files (computed with python3)
- `tanzil/quran-data.xml`: the root element carries `copyright="(C) 2008-2009 Tanzil.info" license="cc-by"` (no CC version given). It is byte-identical to the live copy at tanzil.net (`cmp` matched). Per-surah fields: `index, ayas, start, name, tname, ename, type, order, rukus`.
- Tanzil counts: 86 Meccan surahs (4,613 ayahs) and 28 Medinan (1,623 ayahs), 6,236 ayahs total. The `order` field holds 114 unique values, 1 to 114.
- Tanzil's Medinan list: 2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57–66, 76, 98, 99, 110. This is the Egyptian standard classification (it counts 13, 55, 76, 98 and 99 as Medinan).
- `qac-v2-kaisdukes/chapters.json`: fields `chapterNumber, phonetic, translation, city`. City split is Makkah 86 / Madinah 28, with 0 differences from Tanzil. `verses.json` has 214 rows with fields `chapterNumber, verseNumber, verseMark` (199 "section", 15 "sajdah"). Neither file has a revelation order or verse-level exceptions.
- `kfgqpc-uthmanic-hafs-v2-0`: columns `id, jozz, page, sura_no, sura_name_en, sura_name_ar, line_start, line_end, aya_no, aya_text, aya_text_emlaey`. There is no Makki/Madani or revelation field, and the `read.me` has no license text.
- `quran-align/data/README` license, verbatim: "These data files are licensed under a Creative Commons Attribution 4.0 International License". LICENSE says "Copyright (c) 2016 Collin Fair" (CC BY 4.0 full text). The GitHub repo's code license is MIT, which is separate from the data license.
- quran-align segment format: `[word_start_index, word_end_index_exclusive, start_msec, end_msec]` per ayah, plus `stats {insertions, deletions, transpositions}`.
- quran-align Alafasy coverage: 6,236 ayahs and 77,392 segments. Against the Tanzil 1.0.2 text with no basmala prefix (77,430 tokens), 77,422 words have a timing (99.99%) and 6,230 of 6,236 ayahs are fully covered. 23 segments cover more than one word, and 21 have zero or negative duration.
- Alafasy alignment stats: 1,632 ayahs have nonzero stats (3,873 insertions, 71 deletions, 272 transpositions). Median word duration is 1,070 ms (5th percentile 370, 95th percentile 2,990). 71,093 of 71,156 gaps between words are exactly 10 ms, so the segments run back to back and pauses get absorbed into the neighbouring word.

#### Layer A: asbab al-nuzul, Makki/Madani, revelation order, surah introductions
| # | Candidate and URLs checked | Contents, coverage, format | License (verbatim, where read) | Display / redistribute / flags | Derived from, quality | Verdict |
|---|---|---|---|---|---|---|
| A1 | Tanzil metadata: local file plus https://tanzil.net/res/text/metadata/quran-data.xml (200), https://tanzil.net/docs/quran_metadata (200) | Surah-level type and order for 114 surahs (computed above), XML | XML root `license="cc-by"`; the docs page only says "Tanzil © 2007–2026" | Display yes; redistribute yes with attribution; CC version not stated | Egyptian standard order. 0 differences from Tafsir Center, QAC and Wikipedia (computed) | Use (surah level) |
| A2 | Tanzil "Revelation Order" page https://tanzil.net/docs/revelation_order (200) | Table of 114 rows; 41 surahs carry verse-level notes, e.g. "Except 17-33 and 48-50, from Medina". Free text, some vague ("Except the last three verses") | No license shown, only "Tanzil © 2007–2026", so unknown. https://tanzil.net/docs/tanzil_license returns 200 but says "This topic does not exist yet" | Facts are usable; page license unknown | Cites al-Zanjani's "History of the Quran" and Edgecomb; notes Nöldeke differs on surahs 110 and 62. Type and order match the XML (0 differences, computed) | Cross-check (seed for verse-level exceptions) |
| A3 | Tafsir Center `tafsircenter/tafsir-mcp-data` quran.db: https://huggingface.co/api/datasets/tafsircenter/tafsir-mcp-data (200); repo github.com/tafsircenter/tafsir-mcp, LICENSE-DATA, DATA_SOURCES.md, SCHEMA_NOTES.md | SQLite, 234,352,640 bytes. Tables: `surah_stats` (makkiMadani, revelationSeq, surahClass and others), `surah_content` (surahNameInfo, surahNujoolInfo, surahFadael, surahAyahCount0/1, surahGoals), `ayah_content_nozool` (201 ayahs claimed; isnad and matn in one field), `word_statistics.root` (1,891 roots claimed) | LICENSE-DATA: "is the intellectual property of Tafsir Center for Quranic Studies ... licensed under Creative Commons Attribution 4.0 International (CC BY 4.0) ... Use commercially". Conflicting line in DATA_SOURCES.md: "Commercial redistribution of tafsir texts requires permission from rights holders." | Display yes, redistribute yes (CC BY, attribute "Tafsir Center for Quranic Studies (https://tafsir.net)"). Commercial use is ambiguous | Read via HTTP range requests (no full download): all 114 `surah_stats` rows give 86/28 and an order identical to Tanzil. Surah 1 intro texts run 20–130k characters (surah 2 is similar); goals are short (33 and 90 characters). Texts contain modern editors' footnotes (¬…¥ markers, manuscript sigla), so some third-party edited material is embedded. Asbab rows read: 2:89, 2:97, 2:104 (numbered narrations with takhrij). Stated source is "al-Wahidi + al-Suyuti", but the format looks like a modern authenticated compilation | Use: main source for Arabic surah intros and the vetted asbab layer, after the Center confirms commercial scope in writing |
| A4 | `quranlab/quran` configs `tafsir-asbab-wahidi-ar` and `tafsir-lubab-nuqul-suyuti-ar` (README 200, metadata/translations.csv 200, parquet 464,563 and 333,269 bytes) | Keyed to all 6,236 verses. Wahidi: 571 verses filled, 444 distinct passages, 83 surahs. Lubab: 744 verses, 546 passages, 102 surahs (computed). One passage is repeated across a verse range (e.g. 1:1–1:3) | translations.csv: license "CC-BY-NC-SA-4.0", commercial_ok "False", rights_holder "OpenITI digital corpus (CC BY-NC-SA 4.0); underlying classical work public domain" | Display yes (non-commercial); redistribute under NC-SA only (share-alike passes to our API) | From OpenITI v2025.1.9 (Shamela0011314 / JK000436). The verse mapping is by anonymous volunteers and is unverified | Cross-check (use to bootstrap verse keys) |
| A5 | OpenITI RELEASE v2025.1.9 Wahidi `...AsbabNuzul.Shamela0011314-ara1` (916,256 bytes) and Suyuti `...LubabNuqul.JK000436-ara1` (574,819 bytes) (raw files 200); Zenodo API record 17767721 (200) | OpenITI mARkdown text. Wahidi is the al-Humaydan edition (Dar al-Islah, 2nd ed. 1412/1992): 86 headings, 479 "qawluhu ta'ala" markers, 173 sections with editor-inserted verse numbers {n} covering 187 (surah, ayah) pairs. Lubab has no verse numbers; Quran quotes are wrapped in @QB@…@QE@ | Zenodo v2025.1.9 license id "cc-by-nc-sa-4.0". GitHub repo has no license file. YAML: "All paratextual elements (introductions, footnotes, indices, ...) removed by HRH and MGR (OpenITI Clean operation, 2023)" | Display yes (non-commercial); redistribute NC-SA; blocks commercial use | The original works are public domain (d. 468 AH / 911 AH). Removing the modern editor's footnotes lowers third-party risk | Use for the non-commercial phase (canonical classical text) |
| A6 | tafsir.app (pages 200, incl. /wahidi/2/104) | Site lists "Asbab al-Nuzul of al-Wahidi" among its books; no Lubab | No license or rights statement found on the page | No license (all rights reserved by default) | Website, not a dataset | Avoid (reference only) |
| A7 | spa5k/tafsir_api `en-asbab-al-nuzul-by-al-wahidi` (edition id 86, source altafsir.com; jsDelivr 200) | Surah 2 file has 128 entries | Repo is MIT (code only). The text is the Guezzou translation, © Royal Aal al-Bayt (already known) | Copyrighted | Contaminated: 2:104 is genuine Wahidi (Guezzou), but 2:6 and 2:189 are Kashf al-Asrar-style Sufi commentary; also has broken characters (mojibake) | Avoid |
| A8 | QUL surah-info https://qul.tarteel.ai/resources/surah-info (200); ids 3, 4, 5, 6, 7, 454 (200); ids 1, 2, 9 (500); /terms (404) | 6 resources visible now (not 9): English, Urdu, Tamil, Italian, Malayalam, Indonesian. No Arabic | None shown, so unknown | Unknown | The English text matches Maududi's Tafhim intro | Avoid for an Arabic-first site |
| A9 | api.quran.com/api/v4/chapters/1/info?language=ar (200) | Returns English even when Arabic is requested; source "Sayyid Abul Ala Maududi - Tafhim al-Qur'an" | Quran Foundation terms (already known) | No storage or redistribution | Copyrighted | Avoid |
| A10 | QuranEnc https://quranenc.com/en/home (200); API translation/sura/arabic_mokhtasar/2 (200) | Per-ayah only (id, sura, aya, arabic_text, translation, footnotes). No surah intro or maqasid block at 2:1 or 18:1 in Mukhtasar or Muyassar | "Contents of the translations can be downloaded and re-published, with the following terms and conditions: 1. No modification, addition, or deletion of the content. 2. Clearly referring to the publisher and the source (QuranEnc.com). 3. Mentioning the version number ... 6. Updating the translation according to the latest version ..." | Conditional republish, no-derivatives-like | Not applicable for intros | Avoid for intros |
| A11 | Wikipedia "List of chapters in the Quran" (parse API 200) | 114 rows parsed: place (86/28), Egyptian standard order (0 differences from Tanzil), Nöldeke order (114 unique values), themes | Wikipedia text is CC BY-SA 4.0 (standard; license page not fetched) | Display and redistribute with attribution; share-alike if we copy the table | Cites Robinson 2003 and Edgecomb | Use (Nöldeke order) |
| A12 | Wikidata SPARQL (200), item Q219675 | "has characteristic": Meccan surah 85 / Medinan surah 30 / none 1. That is more than 114, so there are duplicates or errors. No revelation order on the item | CC0 | Free | Inconsistent counts | Cross-check only |
| A13 | OpenITI: Biqa'i Masa'id al-Nazar (`MasacidNazar.Shamela0001404`, 1,474,390 bytes), Fayruzabadi Basa'ir (`BasairDhawiTamyiz.Shamela0009856`, 3,623,551 bytes), Ibn Ashur al-Tahrir wa'l-Tanwir (4 versions, 27–31 MB) | Files exist (listed via GitHub API); not downloaded or inspected | CC BY-NC-SA (OpenITI digital text) | Non-commercial only | Biqa'i and Fayruzabadi are public domain. Ibn Ashur died 1973: Tunisian Law 94-36 is life + 50 years, so public domain in Tunisia since 1 Jan 2024, but protected until 2044 where the term is life + 70 | Cross-check (public-domain intro candidates) |
| A14 | Muqbil al-Wadi'i, al-Sahih al-Musnad min Asbab al-Nuzul (search only) | 2nd ed. 1425/2004, Maktabat San'a' al-Athariyya | Unknown (no rights statement found) | Presumed in copyright | Modern authenticated work | Avoid unless permission is obtained |
| A15 | Blachère and Bazargan orders | No open machine-readable list found | n/a | n/a | n/a | Not verified |

#### Layer B: word-level recitation audio
| # | Candidate and URLs checked | Contents, coverage, format | License (verbatim, where read) | Display / redistribute / flags | Derived from, quality | Verdict |
|---|---|---|---|---|---|---|
| B1 | Quran.com word audio https://audio.qurancdn.com/wbw/001_001_002.mp3 (200) | MP3, 320 kbps, 44.1 kHz stereo, 1.36 s, ID3 date 2021, last-modified 2024-11-24 | None found. QUL credits: "ReciteQuran.com For providing wbw and tajweed recitations of Imam Wisam Sharieff". recitequran.com returns 403 | No license (all rights reserved by default) | Byte-identical to the quranwbw file in B2 (SHA1 fc85646239a203e04f091c18ef21efe42684398f). The credits conflict, so the voice and owner are unresolved | Avoid |
| B2 | quranwbw.com https://audios.quranwbw.com/words/1/001_001_002.mp3?version=2 (200); repo marwan/quranwbw (no license); ABOUT.md | Full word-by-word set served from their CDN | ABOUT.md: "Tafsir Center for Quranic Studies via Wahy App for granting us special permission to use their word by word audio files" and "All data used on this website belongs to their respective owners and authors. Permission must be obtained from them before copying any content." | Permission-based only | Points to the Tafsir Center as rights holder | Avoid, but it shows who to ask |
| B3 | Tafsir Center / Wahy app https://web.wahy.net/ (200) | Word-level audio inside the app | Footer: "جميع الحقوق محفوظة © مركز تفسير لمصادر الدراسات القرآنية" ("All rights reserved"). https://tafsir.net/terms (200) is the store's terms | All rights reserved | Has already granted permission to quranwbw | Best target for a permission request |
| B4 | archive.org quran-wordbyword (metadata API 200) | wbw.zip, 1,995,504,026 bytes, uploaded 2021-04-19, "source: quranwbw.com" | licenseurl None, rights None | No license | Pulling a single file out of the zip returned errors (503s and an extractor error page), so contents are unverified | Avoid |
| B5 | Buraaq/quran-md-words (Quran-MD; HF API 200) | 77,429 word MP3s, about 2.16 GB (claimed) | No license in the card or API | No license | Word audio comes from the archive.org wbw.zip (per its card), so it inherits B4's status. Paper: arXiv 2601.17880 | Avoid |
| B6 | zaibihassan/Quranic-Word-By-Word-Audio-Data (HF 200) | "Muallim" and "Mujawwad" sets, 77,000+ opus files at 16 kHz mono plus .pb timing files | Claims "distributed under the Apache 2.0 License" | Claim unverifiable | Neither the reciter nor the upstream source is named anywhere ("original source material was converted from traditional MP3") | Avoid |
| B7 | quran-align (local) | Timings for 12 reciters; coverage computed above | Data CC BY 4.0, code MIT | Display and redistribute timings with credit to Collin Fair | README accuracy: "word timestamps fell an average of <73 msec away fro the reference data ... standard deviations averaging 139 msec across all 6 recordings. 98.5-99.9% of words were individually segmented" (compared against ElMohafez) | Use (timings) |
| B8 | EveryAyah verse audio cut with quran-align | One clip per word, derived from verse MP3s | Audio CC BY-NC 2.5 Canada (already known) plus CC BY 4.0 timings, so clips are non-commercial and need both credits plus a link back | Display yes; redistribute non-commercially; cutting is allowed (no no-derivatives clause) | See quality caveats below. Whether EveryAyah holds rights from the reciters is unverified | Use for the non-commercial phase |
| B9 | quranlab/quran-audio (HF 200) | Links to 47 EveryAyah recordings, 44 with word timing (11 from quran-align, 33 new); hosts no audio | "The word timing is CC-BY-4.0 — free to use with credit to cpfair/quran-align for its 11 recordings and to QuranLab for the 33 we generated. The audio itself is referenced, not hosted" | Timings redistributable with credit | Forced alignment with no accuracy figures ("can contain occasional imperfect spans") | Cross-check (more reciters) |
| B10 | FaisaI/tadabur (HF API 200) | 1,400+ hours, 600+ reciters, automatic WhisperX word alignments (claimed) | "released under the Creative Commons Attribution–NonCommercial 4.0 (CC BY-NC 4.0) license" | Non-commercial | Upstream recordings were not rights-cleared | Avoid (research only) |
| B11 | tarteel-ai/everyayah (HF 200) | Verse-level only | "Licensing of the individual recordings is not documented. Use at your own risk. The remainder of the dataset is CC BY 4.0." | Unclear | No word clips | Avoid |
| B12 | Salama1429/tarteel-ai-everyayah-Quran (MIT claimed); MohamedRashad/Quran-Recitations (no license); rabah2026/Quran_TTS (Apache-2.0, 19 synthetic voices, card warns muqatta'at are "bad generateds") | Verse-level or synthetic | As listed | MIT on EveryAyah-derived audio is invalid relicensing | Not suitable | Avoid |

Quality caveats for cut-out words:
- Neighbouring sounds bleed across the cut (coarticulation).
- Idgham, iqlab and ikhfa across a word boundary (e.g. min rabbihim) leave the cut word sounding wrong.
- Words that begin with hamzat al-wasl lose their opening vowel.
- Clips keep the joined-reading (wasl) ending; a word said alone should be in the pause (waqf) form.
- Madd lengths depend on the context the word was recited in.
- Because the 10 ms segments run back to back, breaths and pauses land inside word clips.
- Muqatta'at are one long token (e.g. 2:1 is a single 7 s span).

#### Recommendations per layer
- Layer A, (a) recommended sources:
  - Surah-level type and Egyptian order: Tanzil `quran-data.xml` (CC BY, already local; agrees with three independent sources).
  - Nöldeke order: Wikipedia (CC BY-SA).
  - Arabic surah introductions (names, nuzul, virtues, goals, verse counts) and the vetted asbab layer: Tafsir Center `quran.db` (CC BY 4.0).
  - Full classical asbab: OpenITI Wahidi and Lubab (NC-SA), with quranlab's mapping as a starting point for verse keys.
- Layer A, (b) build in-house:
  - A per-ayah Makki/Madani exceptions table (41 surahs seeded from Tanzil's notes, checked against the Egyptian mushaf headers and the Tafsir Center nuzul text, with each opinion attributed).
  - Verse-keying of Wahidi: 173 sections map directly from editor numbers, the rest by fuzzy match of the quoted verse.
  - Verse-keying of Lubab: all by matching the @QB@ quotes.
  - Storing passages as verse ranges rather than copying them per verse.
  - Cleaning the ¬…¥ footnote markers for display.
  - A per-field license and attribution registry.
  - An alternative-orders table.
- Layer A, (c) questions for the product owner:
  - When might the site go commercial? OpenITI and quranlab are NC-SA, and share-alike would bind our public API.
  - May we email cloud@tafsir.net to confirm CC BY covers commercial use and the third-party edited texts?
  - Show all narrations, including weak ones (Wahidi/Lubab), or only the authenticated 201?
  - Show Western orders (Nöldeke) at all?
- Layer A, (d) not verified:
  - The full Tafsir Center DB (over the 5 MB sample cap). I read only `surah_stats` in full, 2 `surah_content` rows and 3 nuzul rows, via about 0.8 MB of range requests.
  - Where the 201 nuzul entries come from.
  - Content of the Biqa'i, Fayruzabadi and Ibn Ashur texts.
  - Rights in Muqbil's book; the Tanzil docs page license; open Blachère/Bazargan lists.
  - Why the brief saw 9 QUL surah-info resources when only 6 are visible now.
- Layer B, (a) recommended:
  - Non-commercial phase: cut EveryAyah audio with quran-align timings. Husary_Muallim (teaching pace) should give the least bleed between words. quranlab timings add more reciters after checking.
  - Production: either get written permission for the Tafsir Center/Wahy isolated-word set (the only complete set with a traceable owner) or commission our own pause-form recordings.
- Layer B, (b) build in-house:
  - A cutting pipeline (padding, fades, boundary refinement on energy dips) and QA flags for the 23 multi-word segments, 21 zero/negative-duration segments, cross-word idgham and muqatta'at.
  - A word-ID mapping across Tanzil tokens (77,430), QAC words (77,429) and Tafsir Center words (77,432 claimed).
  - Attribution display and CDN hosting.
- Layer B, (c) questions for the product owner:
  - Is cut-out joined-reading pronunciation acceptable, or must words be in pause form?
  - Is there a budget to commission recordings, and which reciter?
  - Is non-commercial audio acceptable long term?
  - Should we approach the Tafsir Center for permission?
- Layer B, (d) not verified:
  - Whose voice the Quran.com/quranwbw files are (the credits conflict).
  - The archive.org zip contents.
  - The source behind the zaibihassan set.
  - EveryAyah's chain of rights from the reciters.
  - QUL word resources (login-gated, not re-checked).

#### Flags outside the task (not acted on)
- The project's `tanzil/quran-uthmani.txt` (v1.1) has the basmala prepended to the first ayah of at least 110 surahs. That shifts word indices by 4 against quran-align and QAC, which is why a first coverage pass read 99.41% instead of 99.99%. It must be stripped before joining timings.
- QAC's bundled `quran-uthmani.xml` is Tanzil 1.0.2, labelled "Creative Commons BY-ND 3.0 Unported". The project's Tanzil 1.1 is "CC BY 3.0" with "CHANGING IT IS NOT ALLOWED". 115 ayahs differ in token count between them.

Still pending:
- Product owner: confirm the non-commercial horizon and choose an audio strategy.
- Product owner, or someone they authorize: request written confirmation from the Tafsir Center (data scope; word-audio permission).
- Main agent: build the in-house tables and pipeline listed above.

---

## Part 6 — Classical lexica — al-ʿAyn, Tahdhīb al-Lugha, al-Qāmūs al-Muḥīṭ, Tāj al-ʿArūs

I couldn't find any source that both splits these four works by root and allows commercial redistribution. The best text source for all four is still the Shamela4 extraction on Hugging Face. Taj al-Arus is ready to split as it stands. al-Qamus can be split by aligning its entries to Taj's root list. al-Ayn and Tahdhib need a parser that understands their permutation groups; it is buildable. One finding changes the earlier licensing picture: the Shamela4 dataset card's own licence section restricts use to "Research and personal use", even though its YAML says `license: mit`.

Quality was measured on the samples I downloaded: head and middle slices of each file, plus 11 extra Taj offsets. Vowel density = diacritics per Arabic letter. "Content words" = all words except the 60 most frequent in the slice. Precision figures labelled *estimate* are my projection from prototype parsers I ran on the slices, not from a full parse.

#### Licence finding that affects every Shamela4 source (including the existing launch set)

- The card YAML says `license: mit` / `license_url: https://shamela.ws`. The card's own "## License" section says: "This dataset is derived from **al-Maktaba al-Shamela**… The compilation and digitization rights belong to their respective owners. **Terms of use:** Research and personal use. Respect the intellectual property rights of muhaqqiqīn (editors) and publishers for critical editions." (https://huggingface.co/datasets/AuthenticIlm/Shamela4_Full_DB/blob/main/README.md, revision `07554bee`)
- So the packager grants nothing for our API, bulk download or commercial use. `docs/research/02-arabic-lexica.md` §5.1 quotes only the YAML, so its launch-set permissions should be re-read with this sentence in mind.

#### al-Ayn (al-Khalil, d. 170)

- **Shamela4 book 1459** (`30__الغريب-والمعاجم/1459__العين/pages.jsonl`, 5.93 MB):
  - Content: the Makhzumi & Samarra'i edition (Dar wa Maktabat al-Hilal, 8 parts, "ترقيم الكتاب موافق للمطبوع").
  - Coverage: the TOC has 1,802 rows, and 1,500 of them are group titles that list the permutations in use (verified).
  - Licence: as above.
  - Rights: display yes (author text only); redistribution and commercial not granted.
  - Vocalisation: 0.14–0.22 overall, 0.18 on content words; 65% of content words carry no mark.
  - Apparatus: 1,390 of 1,462 sample pages have a separate `footnotes` field ("(٢) كذا في الأصول أما في م: الهقوع."). Inline there are 4,576 «١» markers and 837 editor insertions in square brackets ("[وهو أن]"). The editor also marks text taken from one manuscript with ( ): «(٥) ما بين القوسين من ك.»
  - Article markers: a group title such as `<span data-type="title" id=toc-32>باب العين والهاء والقاف (ع هـ ق، هـ ق ع مستعملان) (ع ق هـ، ق ع هـ مهملان)</span>`, then each permutation starts its own line: «هقع: الهَقْعَة دائرة…», «عهق: العَوْهَقُ: الغُرابُ…».
  - Middle of the book: «باب القاف والشين والدال معهما ش ق د، ش د ق، د ق ش مستعملات», then lines «شقد:», «شدق:», «دقش:». There is minor noise such as «. قشط:».
  - Boundary method: take the group letters from the TOC title, then accept line-initial `XYZ:` tokens whose letters match the group. On the slices this found 1,754 permutation headers in 589 groups. Only 9 groups (1.5%) gave no header, caused by typos in TOC titles and by weak-letter groups.
  - Difficulty is medium. *Estimate*: ≥97% precision once the "مستعملات" lists are used as a checklist.
  - Verdict: **Use** as the display source. Strip the «n» markers, drop the footnotes field, and decide what to do with the [..] and (..) insertions.
- **OpenITI JK000930** (`raw.githubusercontent.com/OpenITI/0175AH/master/data/0170KhalilFarahidi/0170KhalilFarahidi.Cayn/0170KhalilFarahidi.Cayn.JK000930-ara1`, 3.5 MB; also Shamela0001682-ara1):
  - Same edition (META: «المخزومي / السامرائي»).
  - Licence CC BY-NC-SA 4.0 (from doc 02 §5.3; I did not re-fetch it).
  - Vowels: 0 harakat in 168,898 letters.
  - Markers: «& باب القاف والصاد والراء معهما ق ص ر … مستعملات &», then «# قصر» alone on a line.
  - Verdict: **Cross-check** — a test oracle for the splitter, never display text.
- **islamlab** (1,680 permutation-chapter rows, CC BY-NC-SA): **Cross-check** only.
- **Hawramani, MohamedRashad, and its duplicate `mehdikaveh/arabic-roots`** (same 56,606 rows, card `license: gpl-3.0`):
  - Hawramani's al-Ayn has 2,723 entries, one per permutation group, named after the first permutation printed.
  - Verified: the هقع page contains «عهق: العَوْهَقُ…», and there is no al-Ayn entry for عهق or رحم.
  - Verdict: **Avoid** — other permutations can't be reached by root.
- **Page scans**: no complete public-domain printing exists. archive.org `FRH2003AR` is Hindawi's alphabetical rearrangement (Dar al-Kutub al-Ilmiyya 2003), which is in copyright. `20240823_20240823_1254` («طبعة نادرة», Public Domain Mark) has an unknown edition. **Avoid**.
- Edition rights: Makhzumi (d. 1993) and Samarra'i (d. 2001) — death years from general knowledge, not checked here — so their apparatus and established text are in copyright.

#### Tahdhib al-Lugha (al-Azhari, d. 370)

- **Shamela4 book 2503** (19.1 MB):
  - Content: Mur'ib's edition, Dar Ihya al-Turath 2001. The card says "عدد الأجزاء: ٨", but the TOC has 15 «الجزء» markers and the page records run to part 15. Page references need checking before they are cited.
  - Licence and rights: as above.
  - Vocalisation: 0.39–0.44 overall, 0.43 on content words. Every في and قال is vowelled, which points to a machine-added layer on function words.
  - Apparatus: no footnotes and almost no inline markers (7 numbered parentheses in 652 pages).
  - Article markers: the title «(بَاب الْعين وَالْقَاف مَعَ الشين)», then a first line «عقش، عشق، قشع، قعش، شقع: مستعملة.», then «عشق:», «عقش:».
  - In volume 8 the three-letter groups are not TOC titles but plain lines: «ق ص د» / «قصد صدق دصق.» / «قصد: قَالَ اللَّيْث…».
  - Noise: line-initial glosses such as «غَلَا: أَي: تَنَوَّقَ» and speech verbs (1,285 «وأنشد:/قال:» tokens in the middle slice).
  - Boundary method: take group letters from the TOC letter names, the "مستعملة" line, or the spaced-letter lines; drop speech verbs; filter headers by group letters.
  - Result on the slices: 341 of 383 and 376 of 393 of the remaining `X:` tokens matched the group. In the head slice, 229 of 234 listed permutations were found as headers.
  - Difficulty is medium-high. *Estimate*: ≥95% precision.
  - Verdict: **Use**, display-only.
- **OpenITI JK007040** (14 MB): Mur'ib edition, 15 volumes in META, 0 harakat. Markers «# | 1 ( باب القاف والراء ) 1», «# قر رق : مستعملان .». **Cross-check**.
- **islamlab** (1,303 rows): **Cross-check**.
- **Page scans**: only the Cairo 1964–67 edition exists (Harun et al.; archive.org `AAlexandrina-009711`, `BBib-Alex-03704`…). It is the first printing and is in copyright. **Avoid** as a source.

#### al-Qamus al-Muhit (al-Firuzabadi, d. 817)

- **Shamela4 book 2558** (9.1 MB):
  - Content: the Risala edition, 8th ed. 2005, «بإشراف: محمد نعيم العرقسُوسي», 1,357 pages. TOC has 718 rows (28 باب, 689 فصل).
  - Licence and rights: as above.
  - Vocalisation: 0.52–0.54 overall, 0.58 on content words; 6% of content words unmarked.
  - Apparatus: only 2 pages have footnotes, both notes by Shamela's preparer. The preface carries inserted glosses («[أفصح]»), explained by «قال مُعِدُّ الكتاب للشاملة: ما بين المعكوفين في هذه المقدمة هو تفسير للغريب». There are no brackets in the dictionary body.
  - Article markers: «فَصْلُ العَيْن» then «• العَفَرْجَعُ، كسَفَرْجَلٍ: السَّيِّئُ الخُلُقِ.», with sub-entries «وـ الأرضُ بأهْلها…».
  - The root is only implied: باب gives the last radical, فصل the first.
  - Bullet counts: 2,121 in pp. 25–248 and 1,080 in pp. 695–864. 96.6% / 96.0% of bullets are consistent with their باب/فصل letters. The failures are bullets that open with «رجلٌ», «هو», «كـ».
  - Taj is a commentary that follows al-Qamus entry by entry, and its TOC for the same section lists عفرجع, عكوكع, عكنكع, علع, عهخع, عوع, عيع.
  - Boundary method: split on `•`, then align bullets to Taj root headings within each باب/فصل section. A quick prototype matched 93.7% (1,538/1,641) and 89.5% (910/1,017); most misses were prototype bugs (slice edges, letter-name variants).
  - Difficulty is medium. *Estimate*: ≥98% with a proper aligner plus review.
  - Verdict: **Use**.
- **Siwar** (KSAA, lexicon `2202f51d-…`):
  - `totalEntriesCount: 69030`, one entry per word, with a root field («root":"ر ح م»); 17 entries under رحم.
  - The text is identical to the Risala typing (Siwar: «الرَّحْمَةُ، ويُحَرَّكُ: الرِقَّةُ، والمَغْفِرَةُ، والتَّعَطُّفُ»; Shamela p. 1111 reads the same). Siwar does not name the edition. Vocalisation 0.53.
  - Terms (https://siwar.ksaa.gov.sa/api/settings/get-terms-for-developers): «لا يجوز الاحتفاظ بالبيانات التي تم الحصول عليها من خلال الواجهات البرمجية لمنصة سوار لمدة تزيد عن ثلاثين يوماً.» and «يتوجب الإشارة… إلى (المعجم المستخدم، منصة سوار للمعاجم الرقمية، مجمع الملك سلمان العالمي للغة العربية)». Site footer: «جميع الحقوق محفوظة لمجمع الملك سلمان العالمي للغة العربية © 2024».
  - Rights: display only through the live API with attribution; storage limited to 30 days; redistribution not granted; commercial use not addressed.
  - Verdict: **Cross-check** only — a temporary word→root oracle.
- **OpenITI Shamela0007283-ara1**: same Risala text, 0 vowels, «### | فصل الخاء» / «# • خبتع، كقطرب: ع.». **Cross-check**.
- **OpenITI JK001437**: META also says Mu'assasat al-Risala. Its markers are corrupted («# | + * : الدهش») and there is no bullet. **Avoid**.
- **Hawramani/MohamedRashad** (10,325 rows keyed by headword, glued words) and **m3ajim** (9,811): **Avoid**.
- **`power0man/diwan` `corpus/lexicons/qamus-muhit.jsonl`**: repo licence Apache-2.0. Records say `"source_id":"hf-shamela4-full-db"` and are page-level (`"locus":"ص25"`), so it is a derivative of the same Shamela4 text. **Avoid**.
- **Page scans** (public-domain rebase option; OCR needed):
  - Bulaq / al-Matba'a al-Miriyya 1883–85 (archive.org `AAlexandrina-140965`).
  - Maymaniyya 1901 (`AAlexandrina-140506`).
  - Egyptian General Book Organization 1977 (`ABD1977ARAR`, CC0 asserted by the uploader; whether it is a facsimile of Bulaq is unverified).
- Edition rights: Risala 2005 is a corporate edition in copyright; its full vocalisation is an editorial contribution.

#### Taj al-Arus (al-Zabidi, d. 1205)

- **Shamela4 book 2502** (62 MB, 21,562 pages, 40 parts):
  - Card: «تحقيق: جماعة من المختصين… المجلس الوطني… الكويت… (١٣٨٥ - ١٤٢٢ هـ)… وصَوّرتْ أجزاءً منه: دار الهداية».
  - Licence and rights: as above.
  - TOC: 12,719 rows — 7,390 plain root headings («حمأ»), 3,521 spaced («ح ل ط»), 1,074 irregular («ع ور»), 658 فصل.
  - Body markers match exactly: `<span data-type="title" id=toc-6422>ح ل ط</span>`.
  - Apparatus: no footnotes or markers on 2,018 sample pages, so the Kuwait apparatus is absent.
  - Vocalisation: 0.48–0.69 overall, 0.63 on content words; 100% of في/قال vowelled.
  - Defects found:
    - Headword markers were converted to Quranic brackets: «﴿حاطَهُ﴾ يَحوطُه ﴿حَوْطاً﴾», 3–22 per 1,000 letters.
    - A Quran quotation is corrupted: «﴿١. ٠١٥ ١٥ من﴾ حمإ مسنون﴾».
    - The parentheses that separate al-Qamus's text from al-Zabidi's commentary («(و) ﴿حَلأَه كَذَا (دِرْهَماً…)») run 11–20 per 1,000 letters in vols 1–12 and 32–40, but drop to 1.8–2.8 in vols 16–29. There the two layers can't be separated.
  - Boundary method: the TOC spans. Difficulty is low. *Estimate*: ≥99% precision.
  - Verdict: **Use**, after stripping the ﴿﴾ markers.
- **OpenITI JK007140** (41.6 MB): META «EdPUBLISHER :: دار الهداية», «# |غ ل ط» headings, 0 vowels. The same loss of matn parentheses (9.01 → 0.31 per 1,000 letters) shows the gap is in the shared upstream typing. **Cross-check**.
- **islamlab** (12,051 rows): **Cross-check**.
- **MohamedRashad**: **Avoid**.
- **Page scans**: the Khayriyya 1306 AH printing, 10 volumes (archive.org `ZUB1888ARAR`, «الطبعة الخيرية بجمالية مصر 1306 هـ», `licenseurl` CC0 1.0 asserted by the uploader) — a public-domain rebase option.
- Edition rights: the Kuwait 1965–2001 edition is a multi-editor government edition in copyright. The Shamela text carries its page numbering but none of its apparatus.

#### Other platforms and datasets checked

| Source | What it holds | Terms (verbatim) | Verdict |
|---|---|---|---|
| Siwar `siwar.ksaa.gov.sa` | 39 public lexicons; the only classical one is al-Qamus | 30-day retention clause above | Cross-check (al-Qamus only) |
| Doha Historical Dictionary `dohadictionary.org` | Historical dictionary; no public API (internal API behind reCAPTCHA) | «لا يجوز إعادة نشر أو توزيع أو نسخ أو تعديل أيّ مادة من مواد الموقع إلا لأغراض شخصية غير تجارية» / «يمنع استخدام البيانات في مشروعات تجارية أو تدريب نماذج ذكاء اصطناعي…» (`/terms-of-use`) | Avoid |
| Birzeit Qabas `sina.birzeit.edu/qabas` | Lemma links only, no definition text; none of the classical lexica among its 110 | "License: CC BY 4.0" (arXiv 2406.06598) | Not relevant |
| Birzeit `ontology.birzeit.edu` | Unknown | HTTP 403, not readable | Unknown |
| baheth.info | Claimed: Lisan, Maqayis, Sihah, Qamus, al-Ubab | Site returns 404 / fails on HTTPS; last Wayback capture 2025-05-21 (CDX offline) | Unknown |
| almaany.com | Unknown | Dictionary pages blocked by Cloudflare 403; `/terms.php`: "© Copyrights 2010-2026 Almaany.com, All rights reserved." | Avoid |
| Hugging Face / GitHub / Zenodo / Kaggle | No new dataset splits any of the four works by root; `shahdAI/arabic-lexicon-index` has no card | — | — |

#### Recommended source of record and parsing approach

| Work | Source of record | Parsing approach | Test oracles |
|---|---|---|---|
| Taj | Shamela4 2502 | TOC spans; strip ﴿﴾ | OpenITI JK headings, islamlab |
| al-Qamus | Shamela4 2558 | `•` split, then align to the Taj root list by باب/فصل | Siwar (transient), OpenITI Shamela version |
| al-Ayn | Shamela4 1459 | Group title + `XYZ:` permutation headers, checked against the TOC "مستعملات" lists | OpenITI JK «# root» lines |
| Tahdhib | Shamela4 2503 | Same, with group letters from title, "مستعملة" line or spaced-letter lines | OpenITI JK |

All four: display only, apparatus dropped, edition cited. The long-term public-domain rebase would use the Khayriyya Taj and Bulaq al-Qamus scans; al-Ayn and Tahdhib have no public-domain printing.

#### Questions for the owner

- Given the Shamela4 card's "Research and personal use" sentence, do we keep display-only for Shamela typings if the site may go commercial? Do we get legal advice first? This applies to the current launch set too.
- al-Ayn editor insertions in [..] and (..): keep them, attributed to the editor, or strip them?
- Should we ask KSAA for permission to store Siwar's al-Qamus word→root data beyond 30 days?
- Do we fund OCR of the public-domain scans (Khayriyya Taj, Bulaq al-Qamus) as the commercial-safe route?
- Are al-Ayn and Tahdhib worth their parsers, given Lisan already absorbs much of Tahdhib?

---

## Part 7 — Hadith data

#### Hadith data sources: verified licenses, coverage and quality (checked 2026-10-02)

**Outcome:** no source gives us vowelled Arabic text, isnad, narrator profiles and named graders under terms that clearly allow commercial use and bulk redistribution. HadeethEnc is the only source with explicit permission to republish (3,582 Arabic hadith). The best text and narrator data comes from sunnah.com, and it needs written permission from them. The fawazahmed0 compilation is Unlicense, but its Arabic text looks like it was copied from sunnah.com, and sunnah.com forbids mass reproduction. The big narrator and isnad sets (hadith-kg, Shamela4, Ifta) have unclear upstream rights.

##### (a) Hadith text sources

**fawazahmed0/hadith-api** · https://github.com/fawazahmed0/hadith-api · Use for grades / Cross-check for text
- License, verbatim (branch `1` LICENSE; GitHub reports Unlicense): "Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software … for any purpose, commercial or non-commercial".
- Editions (verified, `editions.json`): 10 books and 75 editions. Each book has `ara-X` and `ara-X1`; for `ara-X1` the comment reads "Diacritics removed for easier searching". Arabic editions list author "Unknown" and an empty source field.
- Diacritics on Bukhari 1: `ara-bukhari` has 0.88 harakat per letter. `ara-bukhari1` has 0.00 and also normalises hamza (الانصاري، ابراهيم، امري، امراة), so it is for search only, never display.
- Where the Arabic comes from (my inference): Bukhari sections 2, 3, 10, 65 and 97 contain 524–6,212 RLM marks (U+200F) each, the same punctuation pattern as sunnah.com pages. Bukhari 1 alone has none, matches Sanadset's style, and is missing its closing quote, so it looks hand-patched. `References.md` lists al-maktaba.org and sunnah.com among its sources.
- Gaps (verified): `ara-muslim` hadith 1 has empty text. Muslim section 0 holds 344 entries — 92 introduction entries (89 empty) plus 252 entries without an Abd al-Baqi number (107 empty). Malik has 29 empty out of 1,858; Tirmidhi section 2 has 2 empty out of 304. The Bukhari sections I checked had none.
- Numbering (verified ranges):

| Book | `hadithnumber` | Notes |
| --- | --- | --- |
| Bukhari | 1–7563 | plus 26 ".2" entries = 7,589 rows; 7563 is the Fath al-Bari total |
| Muslim | 1–7563 sequential | `arabicnumber` is Abd al-Baqi with .01/.02 sub-numbers (8.01–3033.02); missing on 344 rows |
| Abu Dawud | 1–5274 | |
| Tirmidhi | 1–3956 | plus 42 sub-entries |
| Nasa'i | 1–5758 | plus 7 sub-entries |
| Ibn Majah | 1–4341 | plus 2 sub-entries |
| Malik | 1–1858 | |

- Sections: names are English only (for example "Revelation"). There are no Arabic book or chapter (باب) titles and no isnad/matn split.
- Grades (from `info.json`, 10.3 MB, analysed then deleted):

| Book | Graded | Graders (number of hadith graded) |
| --- | --- | --- |
| Abu Dawud | 5,274 of 5,274 | Al-Albani 5,252; Muhyi al-Din Abd al-Hamid 5,171; Arnaut 3,171; Zubair Ali Zai 5,224 |
| Ibn Majah | 4,341 of 4,343 | Albani 4,308; Abd al-Baqi 4,314; Arnaut 3,242; Zubair 4,319 |
| Nasa'i | 5,758 of 5,765 | Abu Ghuddah 5,692; Albani 5,727; Zubair 5,626 |
| Tirmidhi | 3,954 of 3,998 | Ahmad Shakir 3,729; Albani 3,794; Zubair 3,864; Bashar Awad Maarouf 2,425 |
| Malik | 1,858 | Salim al-Hilali |
| Bukhari, Muslim, the three forty-hadith books | 0 | — |

- Grade values are English transliterations with 1,671 distinct strings (for example "Sahih" 32,909, "Daif" 9,937). They need normalising and mapping back to Arabic.
- Last update: the most recent commit is 2026-06-03 (README); the last data change I saw is 2026-05-04 (Urdu). I could not get the last date the Arabic changed because the GitHub API was rate-limited.
- Rights:
  - Display: the compilation's Unlicense allows it.
  - Redistribution and commercial use: risky. The Unlicense cannot clear rights the compiler never had, and sunnah.com forbids mass reproduction (quoted in (d)).

**Shamela4 (AuthenticIlm/Shamela4_Full_DB)** · https://huggingface.co/datasets/AuthenticIlm/Shamela4_Full_DB · Cross-check
- Size: 8,589 books, 7.6M pages, snapshot of 2026-04-26.
- License conflict: the card YAML says `license: mit` (with `license_url: https://shamela.ws`). The README's own License section says "The compilation and digitization rights belong to their respective owners. Terms of use: Research and personal use." So the MIT label cannot be relied on.
- Book IDs (dataset `book_id`):
  - Bukhari: 1458 (Sultaniyya / Tawq al-Najat 1422 AH with Abd al-Baqi numbering, `shamela_id` 1681), 1167, 1228, 706 (al-Bugha).
  - Muslim: 1481 (Abd al-Baqi, al-Halabi 1374/1955, `shamela_id` 1727), 683 (Turkish).
  - Abu Dawud 1480 and 8151; Tirmidhi 1279 (Shakir) and 2859 (Bashar); Nasa'i 797 and 1197, Kubra 2975; Ibn Majah 1095 and 8128.
  - Muwatta 1468 and 6494; Ahmad 6193 (Risala) and 8129; Darimi 5869 and 7236; Ibn Hibban 1482 and 518; Mustadrak 1631 and 1268; Bayhaqi 2855 and 8445.
  - Narrator books: Taqrib 3076, Tahdhib al-Kamal 1716.
- Vowelling (first 150 KB of `pages.jsonl`):
  - 1458 measures 0.615 harakat per letter, and Bukhari 1 is fully vowelled.
  - 1481 measures 0.683 but is only partly vowelled. It reads "لو لقينا أحد" where sunnah.com has «أَحَدًا», which is a typo.
- Narrator links: book 1458 links narrators as `inr://man-3654` and stores chains such as `"esnad":["01 s 4677 4494 5443 6932 2478 3654 5495"]`.
- `_meta/narrators.jsonl`: 18,989 narrators with kunya, nisba, residence, death date, Taqrib generation, Ibn Hajar and al-Dhahabi rankings, and jarh wa ta'dil quotes with book, volume and page.

**OpenITI 2025.1.9** · Zenodo 17767721 (full, 2025-12-30) and 18613982 (primary versions, 2026-02-12) · Cross-check
- License per the Zenodo API: `cc-by-nc-sa-4.0`, so commercial use is not allowed.
- Primary versions:

| Book | Versions | Primary version and edition |
| --- | --- | --- |
| Bukhari | 3 | JK000110 (al-Bugha); Shamela0001681 (Tawq al-Najat) is a secondary version |
| Muslim | 4 | Shamela0001727; JK000109 is Abd al-Baqi |
| Abu Dawud | 5 | JK000142 |
| Tirmidhi | 4 | JK000140 (Shakir) |
| Nasa'i Sughra | 4 | JK000130 (Abu Ghuddah) |
| Ibn Majah | 5 | JK000141 |
| Muwatta | 10 | Shamela0028107 (al-Azami) |
| Ahmad | 8 | Shamela0025794 (Risala) |
| Darimi | 7 | JK000842 |
| Ibn Hibban | 2 | via al-Ihsan (Ibn Balban) |

  Also present: Mustadrak, Bayhaqi Kubra, Ibn Khuzayma, Daraqutni, both Musannafs, Taqrib, Tahdhib al-Kamal, Tahdhib al-Tahdhib, al-Jarh wa'l-Ta'dil.
- Vowels are stripped: 0.000 harakat per letter in Bukhari Shamela0001681, Bukhari JK000110 and Muslim Shamela0001727. Shamela4 has the same Shamela book 1681 at 0.615.

**Sanadset 650K** · Cross-check
- License: CC BY 4.0, confirmed via the Mendeley API.
- Provenance: the paper says it was "collected from Hadith websites … web scraping" and never names the site, so upstream rights are unclear.
- `books.csv` lists 956 titles against the 926 claimed.
- Sample: Bukhari 1 has 0.88 harakat per letter, with `<SANAD>`, `<NAR>` and `<MATN>` tags.
- The Hugging Face mirror `freococo/650k_sanadset` relabels it CC0, which is not a valid relicensing.

**LK Hadith Corpus** · Avoid
- There is no LICENSE file.
- The text is sunnah.com-style (it has the RLM marks).
- Bukhari 1's isnad contains the typo «عَبْدُاللَّهِ» (missing space).
- `Arabic_Grade` does not name the grader.

**Open-Hadith-Data** · Cross-check
- LICENSE verified: "made available under the Open Database License", which is share-alike.

**AhmedBaset/hadith-json** · Avoid
- The README says "scraped from Sunnah.com"; 50,884 hadith; no license file.

##### (b) Grading sources (is the grader named?)

| Source | Grader named? | Coverage | Terms |
| --- | --- | --- | --- |
| fawazahmed0 `info.json` | Yes, per grade | 4 Sunan and Muwatta | Unlicense compilation, taken from al-maktaba.org editions |
| sunnah.com API | Yes: `grades[{graded_by, grade}]` in en and ar (from their code) | Site says "grade decisions by Shaykh al-Albani and Darussalam (Hafiz Zubair `Ali Za`i)" | Needs a key and permission |
| Dorar | Yes, `mohdith` field with the ruling (field names per the third-party wrapper) | Very broad | Copying the encyclopedia forbidden (quoted in (d)) |
| HadeethEnc | No — a bare `grade` (e.g. "صحيح") plus `attribution` such as "متفق عليه" | 3,582 Arabic | Republication allowed under 7 conditions |
| hadith-kg | No — per-hadith ruling and per-chain ruling from an undisclosed source | 715,790 hadith | CC BY 4.0 claimed |
| LK corpus | No | Six books | No license |
| Islamweb | — | — | Terms updated 28 April 2026 forbid copying for "أغراض تجارية أو عامة" without written consent and forbid bots: "عدم استخدام أي وسيلة آلية … لجمع البيانات" (https://www.islamweb.net/ar/article/226933/) |

##### (c) Narrator and isnad datasets and tools

| Dataset | Coverage (verified unless stated) | How narrators link to hadith | License | Verdict |
| --- | --- | --- | --- | --- |
| hadith-kg (`emadjumaah/hadith-kg`) | 715,790 hadith / 425 books / 577,024 chains / 49,844 narrators / 127,863 critic statements by 1,015 critics (`DATA_REPORT.md`) | narrator table to chain table with positions; character offsets in the text | Dataset says CC BY 4.0; code MIT. README: "Only the raw 2017 source dump is not distributed", and the source is never named | Cross-check until the source is known |
| Shamela4 `_meta` | 18,989 narrators, about 35K chains | `inr://man-ID` in the text | MIT vs "research and personal use" conflict (see (a)) | Cross-check |
| sunnah.com narrator pages | e.g. /narrator/5913 has kunya, generation, lineage, jarh wa ta'dil, teachers (archived 2026-07-24) | hadith pages split isnad and matn and link each name to /narrator/{id} | No mass reproduction; their API code has no narrator route | Only by agreement |
| Kaggle `fahd09/hadith-narrators` | 24K narrators | `scholar_indx` | Labelled "CC0: Public Domain" but scraped from muslimscholars.info, whose site shows no terms | Cross-check |
| Ifta Sunnah dataset (Kaggle `jehadoumer/ifta-hadith-corpus-original`) | 276,347 hadith, 33 books, 20,957 narrators (claimed), 9.8 GB | structured isnad | Labelled CC BY-SA 4.0; the source site sunnah.alifta.gov.sa did not respond from here | Unknown |
| MIS (Mendeley `gzprcr93zn` v2) | Sahih Muslim: 7,748 hadith, 2,092 narrators, graph edges | node and edge files | CC BY 4.0 (API) | Use for Muslim graph prototyping |
| `islamlab/islamic-biographies` | 219,364 biographical notices, not merged per person, no narrator IDs | none | CC BY-NC-SA 4.0 | Cross-check (non-commercial only) |
| Synthesium narrators pack v1 (2026-09-27) | 24,335 narrators + 32,906 isnads (claimed) | isnads, built from fahd09 | Inherits fahd09's problem | Cross-check |
| AR-Sanad 280K (`somaia02/Narrator-Disambiguation`) | Artificial chains, 18,298 narrator IDs from the Khadem al-Haramayn site | IDs | No LICENSE file | Avoid |
| `ali-ghamdan/narrations-narrators.db` | 135 files, 1.21 GB, no description | unknown | Waqf licence | Avoid (provenance unknown) |

- Other narrator projects:
  - The Hawramani encyclopedia says "All of the works have been sourced from the Shamela project … we assume they are in the public domain"; it is not usable data.
  - arXiv 2607.05424 links narrator records across databases, but its data release is unverified.
- Tools:
  - The `AhmedTaha012/hadith-finetuned-ner*` models are Apache-2.0, but their training data is undocumented.
  - "Isnad-AI" actually detects Quran and hadith spans in chatbot output; it does not parse isnads.
  - `alizahidraja/isnad-bench` (CC BY 4.0) is derived from hadith-kg: weakest-link chain grading agrees with scholars' verdicts at κ=0.871.

##### (d) APIs

**sunnah.com**
- Access: `api.sunnah.com/v1` returns 403 without a key (checked 2026-10-02).
- Fields, read from their code (`main.py`, `models.py`):
  - Per hadith: `collection`, `bookNumber`, `chapterId`, `hadithNumber`, and for each of en and ar: `chapterNumber`, `chapterTitle`, `urn`, `body` (HTML) and `grades`.
  - Routes: collections → books → chapters → hadiths, plus `/v1/hadiths/{urn}`, `/refs` and `/random`. Pagination is at most 100 per page.
- Terms (archived copy, 20 July 2026): "We do not permit the scraping of our data, nor mass reproduction of entire books or collections on other websites … Reproducing individual hadith or selections of hadith for a teaching/didactic/presentation purpose is permitted."
- Source of their Arabic: "sourced from al-eman.com and other now-defunct sources."
- Their GitHub repos have no LICENSE files and no data dump; the developers page says a dump is "not available yet".
- Getting a key: a public GitHub issue that includes name and email. There are 3,593 such requests and many are still open.

**Dorar**
- Live access: every endpoint returns a Cloudflare 403. The wrapper's issue #29 (2026-05-08, still open) says scraping broke.
- Article 389 (archived 2026-01-03): the API "توفر لأصحاب المواقع والمنتديات عرض نتائج البحث … في مواقعهم".
- Copyright page (article 111, archived 2021-05-06), verbatim: "المواد غير القابلة للتنزيل وإنما هي للبحث والتصفح كالموسوعة الحديثية لا يسمح بنسخها وجعلها للاستخدام من خارج الموقع … ولا بأس بنسخ نتيجة بحث ونشرها للفائدة".
- What this allows:
  - Display: live search results only.
  - Redistribution: no.
  - Commercial use: not addressed.
- Verdict: Avoid as a data source.

**HadeethEnc**
- Endpoints verified: `languages` (72 languages), `categories/list` (493), `categories/roots`, `hadeeths/list`, `one`, `multiple`, `search`, plus an MCP server at `/mcp/`.
- Fields: `id`, `title`, `hadeeth`, `attribution`, `grade`, `explanation`, `hints`, `categories`, `translations`, `hadeeth_intro`, `words_meanings`, `reference` (with volume, page and number).
- Arabic count: the official Excel export v1.7.0 ("Last update: 2025-11-12") has 3,582 hadith. Walking the 7 root categories in the API gives 3,574 unique IDs, all of which are in the Excel file.
- Text: no isnad; the matn is vowelled.
- Terms (home-page terms box, Arabic and English verbatim): "Contents of the translations can be downloaded and re-published", subject to 7 conditions:
  1. No modification, addition, or deletion of the content.
  2. Clearly refer to the publisher and the source.
  3. Mention the version number.
  4. Keep the version information inside the document.
  5. Notify the source of any notes.
  6. Update to the latest version.
  7. No inappropriate advertisements.
- Commercial use is not addressed.
- Verdict: Use.

##### Bukhari 1 («إنما الأعمال بالنيات») compared across sources

| Source | Harakat per letter | Isnad | Issues |
| --- | --- | --- | --- |
| fawazahmed0 `ara-bukhari` | 0.88 | yes | closing quote missing |
| Sanadset | 0.88 | yes, tagged | spaces before punctuation |
| Shamela4 1458 | 0.85 | yes, narrators linked | uses the single ﷺ and ﵁ characters |
| sunnah.com (archived) | 0.78 | yes, split into isnad and matn | RLM marks; «رضى» spelling |
| LK corpus | 0.78 | yes, split | «عَبْدُاللَّهِ» typo; no quote marks |
| HadeethEnc 4560 | 0.59 | no | Muslim's wording plus Bukhari's |
| OpenITI | 0.00 | yes | line-wrapped, page markers |

##### Recommended hadith data stack
- **Display text:** sunnah.com under a written agreement. It is the only source with clean isnad/matn split, narrator links and named graders together. Keep fawazahmed0 `ara-*` as the fallback and patch the empty Muslim and Malik entries from Shamela4 as a cross-check.
- **Grades:** fawazahmed0 `info.json`, crediting each grader by name. For Bukhari and Muslim show the collection itself ("رواه البخاري / مسلم") rather than a grade.
- **Explanations and curated selection:** HadeethEnc, kept unmodified with its version number.
- **Narrators and isnad:** hadith-kg if its upstream source is confirmed. Otherwise MIS for Muslim plus fahd09 for basic profiles. Only use Shamela4 or `islamlab` data if commercial use is ruled out.

##### Decisions and permission requests for you (none sent)
1. A sunnah.com API key and written permission for display, caching and commercial use. The request is a public GitHub issue carrying your name and email.
2. A Dorar permission request. Their contact email was hidden by Cloudflare, so I could not get it.
3. Confirm with HadeethEnc that commercial use is fine and that linking words to roots does not count as "modification".
4. Ask Emad Jumaah (hadith-kg) what the 2017 source dump was and whether he has the right to license it.
5. Whether to accept non-commercial-only sources (OpenITI, `islamlab`).
6. Which numbering to display: Fath al-Bari for Bukhari, Abd al-Baqi for Muslim.

**Still unknown:** sunnah.com's API terms; whether the API body includes the isnad/narrator spans; the Arabic last-change date in fawazahmed0; sunnah.alifta.gov.sa's terms (site unreachable); Sanadset's upstream site.

| File | Size |
| --- | --- |
| `hadeethenc-ar-download.xlsx` | 2,767,594 B |
| `fawaz-ara-malik.min.json` | 2,008,602 B |
| `fawaz-ara-muslim-sec1.min.json` | 593,591 B |
| `openiti-2025.1.9-hadith-rows.tsv` | 580,510 B |
| `fawaz-ara-muslim-sec0.min.json` | 341,914 B |
| `pages/shamela4-hfapi.json` | 4,286,756 B |
| `pages/sunnah-narrator-archived.html` | 362,965 B |
| `pages/hadith-kg-db-first256KB.bin` | 262,144 B |

Two downloads went over the 5 MB sample limit but were not kept as files:
- **`info.json` (10.3 MB):** saved briefly, then deleted after analysis; a 66,690 B excerpt is kept.
- **OpenITI metadata TSV (12.1 MB):** streamed and filtered, never saved whole.

I also wrote a stray file in `/tmp` by mistake and deleted it at once.

---

## Part 8 — Classical books — OpenITI, KITAB, Shamela-derived datasets, citation design, copyright gate

**OpenITI and KITAB, Shamela-derived datasets, other book sources, citation design and copyright filtering: research report**

#### Outcome

- OpenITI's latest release is still 2025.1.9 (published 30 Dec 2025, licence CC BY-NC-SA 4.0). There is no 2025.2 or 2026 release on Zenodo, and the newest GitHub tag is `v2025.1.9`.
- No source I checked licenses classical book texts for commercial use. OpenITI is the only one with an explicit licence, and that licence is non-commercial and share-alike. Every Shamela-derived copy has an MIT or Apache tag added by whoever packaged it, which Shamela never granted.
- Quality favours Shamela over OpenITI:
  - OpenITI text has no vowels: 0 harakat in a 200 KB sample of al-Tabari's tafsir.
  - The same edition in Shamela has 0.27–0.33 harakat per letter, keeps footnotes in a separate field, and gives the printed volume and page.
- Cross-referencing works. The number in an OpenITI version id like `Shamela0007798` is the shamela.ws book id, which is also the `shamela_id` field in the Hugging Face Shamela 4 dump and the turath.io id. I confirmed this for 3 works.
- Page alignment also works. OpenITI's page marker `PageV01P003` closes printed page 3, and it matches Shamela's (vol 1, page 3) word for word in al-Tabari.
- Recommendation in short:
  - Use OpenITI metadata as the catalogue and ID system.
  - Gate books on author death date and strip all editor material.
  - For non-commercial use, the only licensed display text is OpenITI's unvowelled text.
  - Vowelled Shamela text, or any commercial use, needs permission from the rights holders.

#### (a) OpenITI and KITAB

**OpenITI corpus** — https://doi.org/10.5281/zenodo.3082463 (always points to the latest release). Release record: https://zenodo.org/records/17767721

- Version history (Zenodo API): 2019.1.1, 2020.1.2, 2020.2.3, 2021.1.4, 2021.2.5, 2022.1.6, 2022.2.7, 2023.1.8, 2025.1.9. The newest is 2025.1.9, published 2025-12-30. The GitHub `OpenITI/RELEASE` repo's last commits are from 2026-02-09, all for "v9".
- A primary-versions-only record (18613982, version 2025.1.9) was published 2026-02-12. It holds `OpenITI-pri-data_v9.zip` (2,861,555,297 bytes) and `OpenITI_metadata_2025-1-9_pri.tsv` (7,012,606 bytes).
- The full record holds `OpenITI_data_2025-1-9.zip` (5,936,029,637 bytes), the metadata TSV (12,092,756 bytes) and the release notes (204,028 bytes).
- Corpus size, as stated in the release notes PDF (not recomputed by me):

| Measure | Value |
|---|---|
| Unique titles | 9,108 |
| Authors | 3,558 |
| Versions (unique ids) | 14,107 |
| Uncorrected OCR texts | 760 |
| Words, all versions | 2,348,893,857 |
| Words, primary versions only | 1,117,218,563 |
| Vetted `.mARkdown` / `.completed` / `.inProgress` files | 564 / 834 / 11 |
| New: Persian texts / manuscript transcriptions | 354 / 433 |

- Metadata TSV has 27 columns: `version_uri, language, subcorpus, uncorrected_OCR, date, author_ar, author_lat, book, title_ar, title_lat, ed_info, id, status, tok_length, char_length, local_path, tags, author_from_uri, author_lat_shuhra, author_lat_full_name, city_ar, city_lat, institution_ar, institution_lat, shelfmark, catalog_ref, parts`.
- Example row: `0068CabdAllahIbnCabbas.GharibQuran.Shamela0023622-ara1 | date 68.0 | id Shamela0023622 | status pri | tok_length 12834 | tags _CULUM :: CENT0100 :: _QURAN :: Shamela@علوم القرآن :: … :: PRIMARY_VERSION :: CLEANED_VERSION`.
- `ed_info` looks like `حمزة أحمد الزين :: 2004م :: دار الحديث - القاهرة` or a WorldCat link. It was filled for 881 of 1,207 rows in my 1 MB head sample.
- In that head sample (authors who died 1–338 AH), version sources were Shamela 392, JK 367, ShamAY 91, Zaydiyya 88, GRAR 70, Shia 44 and Sham19Y 36. 1,191 of 1,207 were tagged `CLEANED_VERSION`.
- In a 1.5 MB tail sample (2,722 Arabic primary rows, authors who died 1176–1450 AH):
  - 1,485 rows have death date after 1375 AH and 1,030 after 1395 AH.
  - 546 rows use 1450, which appears to be a placeholder for living or unknown modern authors.
  - Of the post-1375 rows, 1,096 come from Hindawi.
  - Living or recent authors are included, e.g. `1442MuhammadCaliSabuni.SafwatTafasir.Tafsir09083-ara1` and `1442NawalSacdawi.AdabUmmQillatAdab.Hindawi096024730-ara1`. OpenITI's licence therefore does not make every file safe, and we need our own death-date gate on top.
- URI scheme (OpenITI's documentation): `AuthorID.BookID.VersionID-langN`. The AuthorID is the death year as 4 digits plus a short name; the VersionID is the source collection plus that collection's id. Suffixes: `Vols` means volumes were joined, `BK1`/`BK2` means a file was split into books, `A`/`B` means a file was split for size. The documentation says the URIs are "CTS-compliant"; a passage id is optional.
- Version metadata file (`.yml`) for al-Tabari: `00#VERS#LENGTH###: 2910593`. Its comment field says "All paratextual elements (introductions, footnotes, indices, ...) removed by HRH and MGR (OpenITI Clean operation, 2023)" and links to a `pre-clean` branch.
- mARkdown format reference: https://maximromanov.github.io/mARkdown/ (says "Text is licensed CC BY-NC-SA 4.0 unless noted"). The markup it defines:
  - Magic first line `######OpenITI#`, `#META#` header lines, and `#META#Header#End#`.
  - Section headers `### |` down to `### |||||`, plus `### |EDITOR|`.
  - `#` starts a paragraph and `~~` continues a line.
  - `PageV##P###` for printed pages and `%~%` between the two halves of a poetry verse.
  - Entry headers `### $` (biography), `### @` (event), `### $DIC_LEX$` (dictionary).
  - Hadith markup `# $RWY$ [isnād] @MATN@ [matn] @HUKM@`, and name/date tags `@PER`, `@TOP`, `@YD####`.
- Milestones (`ms0001`): the `openiti` package's `insert_milestones.py` deletes existing ids (`re.sub(" ms[A-Z]?\d+", "", text)`) and re-inserts one every N Arabic tokens (300 in KITAB use). Milestone numbers can therefore shift whenever text before them changes.
- Verbatim from the al-Tabari version `0310Tabari.JamicBayan.Shamela0007798-ara1.inProgress` (first 200 KB). The sample has no isnad tags and no footnote reference numbers, and keeps Quran references in the form `[النساء: 165]`:

```
#META# 030.LibURI	:: Shamela_0007798
#META# 040.EdEDITOR	:: الدكتور عبد الله بن عبد المحسن التركي
#META# 041.EdNUMBER	:: الأولى، 1422 هـ - 2001 م
#META# 043.EdPUBLISHER	:: دار هجر للطباعة والنشر والتوزيع والإعلان
#META#Header#End#
##### | مقدمة المصنف
~~قال الله عز وجل: {ولله يسجد من في السموات والأرض طوعا وكرها وظلالهم
~~بالغدو والآصال} ؛ PageV01P003
~~صلى الله عليه وسلم من الدرجات ms0001 بالعليا، ومن المراتب بالعظمى، فحباه من
##### || القول في اللغة التي نزل بها القرآن من لغات العرب
### تريك إذا دخلت على خلاء %~% وقد أمنت عيون الكاشحينا
```

- Tools:

| Tool | Licence | Note |
|---|---|---|
| `openiti` Python package (github.com/OpenITI/openiti) | MIT | PyPI 0.1.6 |
| `oitei` mARkdown→TEI converter | No licence file | Default is all rights reserved |
| `tei_openiti` schema | No licence file | |
| `seemorg/mARkdown-parser` (JS) | MIT | |

- How OpenITI asks to be cited (documentation source `OpenITI/documentation/index.md`): "OpenITI releases are published under the CC BY-NC-SA 4.0 license… Please, do cite URIs of specific files if you use them in your research. To cite the entire corpus, please check the release version". Corpus citation form: "Authors, Year: OpenITI: A Machine-Readable Corpus of Islamicate Texts. Version 2025.1.9. https://zenodo.org/records/17767721".
- Rights: display is non-commercial only, with attribution. API or bulk redistribution is non-commercial and must stay CC BY-NC-SA. Commercial use is not allowed.
- Verdict: **Use** as the catalogue, ID system, structure and cross-check source. **Use** as display text only if a non-commercial launch is acceptable.
- Unknowns: the death-date distribution across the whole corpus (I only sampled; the TSV is over 5 MB); whether OpenITI would grant commercial permission.

**KITAB text reuse and metadata**

- Zenodo record 11501559, "KITAB Text Reuse Data", version 2023.1.8. It is still the latest version on Zenodo, licensed `cc-by-nc-sa-4.0`. It holds a pairwise zip (10,072,866,828 bytes) and a stats file (164,474,102 bytes).
- Self-reuse data: Zenodo record 14215964, also `cc-by-nc-sa-4.0`.
- For release 2025.1.9 the data is only on GitHub, in `kitab-project-org/pairwise-light` (about 2.3 GB) and `one_to_all` (about 3.2 GB). Neither repo has a licence file.
- File format: tab-separated with columns `b1 b2 bw1 bw2 e1 e2 ew1 ew2 seq1 seq2`, meaning milestone number plus character and word offsets in each book. The aligned text itself is left out. The al-Tabari folder has 1,000 or more pair files.
- Metadata browser: https://kitab-project.org/metadata. The `kitab-metadata-automation` repo regenerates metadata weekly and has no licence file. The download page has no licence statement, according to the fetch tool's summary of https://kitab-project.org/data/download.
- Verdict: **Cross-check**. It is useful for aligning versions and linking passages that reuse each other. The data is non-commercial.

#### (b) Shamela-derived datasets

**AuthenticIlm/Shamela4_Full_DB** — https://huggingface.co/datasets/AuthenticIlm/Shamela4_Full_DB

- Checked through the HF API: commit `07554bee…`, created and last modified 2026-05-19.
  - 34,373 files.
  - 8,589 `pages.jsonl` files and 8,589 `book_metadata.json` files, across 40 category folders.
  - A `_meta/` folder with 17 files.
- The extraction manifest gives: 7,611,186 pages, 4,060,485 table-of-contents entries, 35,526 isnads, 18,989 narrators, 84,430 tafsir cross-references, 37,076 hadith cross-references, 1,952,803 root-dictionary entries.
- Licence:
  - The README's front matter says `license: mit` and `license_url: https://shamela.ws`.
  - The README body contradicts this: "The compilation and digitization rights belong to their respective owners. **Terms of use:** Research and personal use. Respect the intellectual property rights of muhaqqiqīn (editors) and publishers for critical editions."
  - Shamela itself grants nothing (see section c).
- The folder number is not the Shamela id. Folder `2839` is al-Tabari ed. al-Turki with `shamela_id` 7798; folder `7798` is a different book (`shamela_id` 38218). Lisan al-Arab is folder 1462 with `shamela_id` 1687, and al-Mufradat is folder 6119 with `shamela_id` 23636.
- Book metadata fields: `main_author_death_hijri` (99999 means a collective or unknown author), `authors[]` with roles, `is_hidden` ("copyright/access restrictions"), `printed`, and `betaka_text`, which ends with a pagination flag such as `[ترقيم الكتاب موافق للمطبوع]`.
- Quality, measured on al-Tabari:
  - Vowels: 0.33 harakat per letter in vol 1 pp. 3–12, and 0.27 in vol 10 pp. 485–553.
  - Footnotes are in a separate `footnotes` field, and the body keeps `(¬١)` reference markers.
  - Printed `part` and `page_num` are present.
- Apparatus pitfalls in the same book:
  - The editor's introduction is in the body, as 182 pages under `part: "المقدمة"` (pp. 5–191).
  - The body contains editor insertions in square brackets, e.g. `[قُرِئ … قال] (¬٢)`.
  - Footnotes record that bracketed numbers are manuscript folio numbers.
- Verbatim sample (part 1, page 3):

```
{"shamela_page_id": 183, "part": "1", "page_num": 3, "body": "﷽\r(¬١)\r[قُرِئ على أبي جعفرٍ محمدِ بنِ جريرٍ الطَّبَرِيِّ، في سنةِ ستٍّ وثلاثِمائةٍ، قال] (¬٢):\rالحمدُ للَّهِ الذي حَجَّت (¬٣) الألبابَ …", "footnotes": "* الأرقام التي بين المعقوفين أرقام المخطوط … (¬١) بعده في ص: \"رب تمم برحمتك\" …"}
```

- `_meta/root_dictionary` maps an unvowelled word to candidate roots, e.g. `{"token":"آب","roots":["ءبب","ءيب","ءوب","ءبو","ءبي"]}`. It could generate candidate roots for our word→root links, but it is Shamela's internal data with no licence and the candidates are ambiguous.
- Verdict: **Cross-check / Use for public-domain author text only with the owner's sign-off on the risk**. For a public-domain author with the apparatus removed, display is low risk but has no grant. API redistribution and commercial use are a risk.
- Unknown: how many books are `is_hidden` (I had no parquet reader available).

**Other datasets**

| Dataset | Content and format | Licence claim | Quality evidence | Verdict |
|---|---|---|---|---|
| Kandil7/Athar-Shamela4 | Mirror of AuthenticIlm, same README, 34,374 files | `mit` | Same as above | Avoid (duplicate) |
| MoMonir/shamela_books_text_full | 8,538 books, 7,552,019 pages. Columns `edition, publisher, page_number, volume_number, text, foot_note`. Synced June 2025 | `apache-2.0` (packager) | Footnotes separate, printed page and volume present; vowels 0.021 in a 20-row sample of a modern book | Cross-check |
| MoMonir/Shamela_Books_info (CSV, 3,984,732 bytes) | 8,492 books. Columns `author_year, editor, publisher, edition, pagination, category` | `apache-2.0` | Best filterable catalogue I found (see section e) | Use as metadata cross-check |
| MohamedRashad/Al-Maktabah-Al-Shamilah | 6,521 works, 5.9M segments. Columns `Book_name, text` only | None in front matter. README: "contains many works that are public domain, but not all. Please check the legal status before redistribution or commercial use." | No page, volume or footnote fields | Avoid |
| ReligiousLLMs/shamela_all_diacritized_fully | 1,351,596 rows. Columns `title, page, text`; empty card | None | 0.85 harakat per letter (fully vowelled; al-Ajurri sample). Volume only inside the title; no footnotes; no edition | Cross-check for vowels only |
| ieasybooks-org/shamela-waqfeya-library | 4,661 books, 12,877 PDFs (5,138,027 pages), OCR'd with Google Document AI to TXT and DOCX | `mit` | OCR of Waqfeya scans | Avoid (scans of in-copyright editions) |
| islamlab/islamic-sciences | 4,022 works, gated to authors who died by 1350 AH, Sunni scope. Stable keys `work_id`, `unit_id` | CC BY-NC-SA 4.0, inherited from OpenITI | Shamela/OpenITI text | Cross-check |
| Maktabati/openiti-vectors | OpenITI-derived vectors | Claims CC BY 4.0 | Incompatible with the NC-SA source | Avoid |
| mittagessen/openiti_chunked | OpenITI-derived chunks | Claims CC0 | Invalid relicensing of OpenITI | Avoid |
| Kandil7/shamela-database | RAR archive of the Shamela database | None | — | Avoid |

- GitHub tools (code only, no data):
  - `OpenShamela/shamela_crawler` (GPL-3.0), `ammusto/shamela-extractor` (MIT).
  - `ragaeeb/shamela` (MIT). Its README says Shamela's v4 API "requires an API key", obtained from mail@shamela.ws.
  - `NoorBayan/Turath` contains only "Files will be uploaded later".

#### (c) Other reading-site sources

- **Shamela official** (https://shamela.ws)
  - Content: desktop database download `dev.shamela.ws/downloads/shamela-database-1448.zip`, 13,294,044,352 bytes, last modified 2026-07-30. The site's API needs a key (claimed by the ragaeeb/shamela README).
  - Terms: https://shamela.ws/page/terms covers only the "Shamela MCP" service (updated 19 Sept 2026). Verbatim: "Rights in books, editions, and other materials remain with their respective holders as applicable. These terms do not grant rights to reuse content beyond permission from the rights holder or applicable law." The service also bans attempts to "reconstruct the full index in a way that evades published limits".
  - Verdict: **Cross-check**. It is the source of record for page references; nothing in its terms grants reuse.
- **turath.io** (Nuqayah team, sponsored by Ayaat charity, Kuwait)
  - Content: endpoints `api.turath.io/book?id=` and `/page?book_id=&pg=` work and need no key. Ids are Shamela ids: book 7798 is al-Tabari ed. al-Turki with 16,700 pages, the same count as the Shamela 4 dump. Text is vowelled.
  - The book index includes `print_pg_to_pg`, `volume_bounds`, `headings` (10,104), `pdf_links` to page scans, and `non_author`: pages 1–182 are flagged as not the author's, with `author_page_start: 183`.
  - Licence: no terms or licence found (the app's about page shows none; https://nuqayah.com/docs/projects/turath shows none). `turath-sdk` is MIT but that covers code only.
  - Verdict: **Cross-check** as a design reference for marking non-author pages and mapping printed pages. Do not ingest.
- **Usul.ai** (https://usul.ai)
  - Content: "15,451 Texts"; page meta says "AI-powered access to over 15,000 texts including all of Shamela".
  - Paid plans ($0 / $5 / $25 / $100 per month) include "API access" and "Professional & commercial use". Footer: "© 2026 The Seemore Foundation. All rights reserved."
  - The GitHub repos `seemorg/usul` and `seemorg/usul-data` now return 404, with no Wayback Machine snapshot. A search snippet claimed MIT and "OpenITI + Turath" sources; I could not verify this.
  - Verdict: **Avoid** as a source.
- **ketabonline.com**
  - Content: "more than 30 thousand" indexed text books, built from Shamela, Waqfeya, al-Alukah and others.
  - Terms (https://ketabonline.com/ar/pages/terms-and-conditions): «لا يجوز أخذ أي كتاب من هذا الموقع بغرض إعادة إنتاجه، أو نشره، أو إذاعته، بأي طريقة إلا لأغراض الاستعمال الشخصي غير التجاري».
  - Verdict: **Avoid**.
- **Islamweb library** (Qatar Ministry of Awqaf)
  - Content: texts are fully vowelled (seen in the Siyar sample).
  - Terms (https://www.islamweb.net/ar/article/226933/): «يُسمح للمستخدم بالاطلاع على المحتوى وتنزيله وطباعته للاستخدام الشخصي وغير التجاري فقط» and «يُمنع منعاً باتاً نسخ، تعديل، توزيع، إعادة نشر، عرض، أو نقل أي جزء من محتوى الموقع لأغراض تجارية أو عامة دون … موافقة كتابية».
  - Verdict: **Avoid** (link out only).
- **Arabic Wikisource**
  - Size: 94,644 content pages and 116,251,577 words. Monthly dump is 263,232,405 bytes (2026-10-01).
  - Licence: the API's site rights field says "Creative Commons Attribution-Share Alike 4.0". The site's copyright policy page states protection lasts the author's life plus 50 years in most Arab countries.
  - Quality: the Sahih al-Bukhari "Book of Fasting" page has 0 harakat and no edition or printed page. Al-Tabari's tafsir is a scan-only placeholder.
  - Verdict: **Cross-check** (weak for citation).
- **Hindawi Foundation** (now redirects to safahat.org, which returned 403 to my requests)
  - Content: modern books, no religious books. 3,344 books according to a search snippet.
  - Licence, from the archived FAQ (https://web.archive.org/web/20220921234238/https://www.hindawi.org/home/faqs/): «يُحظَر تمامًا بيعُ أو إعادةُ نشر الكتب التي حصلت مؤسسة هنداوي على حقوق نشرها… للاستخدام الشخصي فقط». For public-domain works: «لا نفرض أي قيودٍ على استخدام النص» and their translations of public-domain foreign works are CC BY 4.0.
  - Verdict: **Use only public-domain-author texts** (adab and history). Avoid licensed books.
- **al-Maktaba al-Waqfeya** (waqfeya.net)
  - Content: PDF scans only, with ads. Footer: «المكتبة الوقفية. جميع الحقوق محفوظة».
  - Verdict: **Avoid** for ingestion; use only as a page-image link.
- **archive.org**: the terms page is rendered by JavaScript and I could not retrieve it, so terms are unknown. Rights differ per item.

#### (d) Segmentation and citation proposal

- Hierarchy: Work (OpenITI book URI, e.g. `0310Tabari.JamicBayan`) → Edition (Shamela id plus the bibliographic card: editor, publisher, edition) → Volume (the printed label, including non-numeric ones like «المقدمة») → printed Page → Block (paragraph, heading, verse or poetry line) → Token.
- Citation key: `urn:cts:arabicLit:0310Tabari.JamicBayan.Shamela0007798-ara1:1.3.2` (volume.page.paragraph). Human form: «الطبري، جامع البيان، ت. التركي (هجر 1422/2001)، 1/3، ف2». Always store the release or snapshot id with the key.
- Do not use OpenITI `ms` numbers as the primary key, because they are regenerated. Store them pinned to a release, only for joining KITAB text-reuse data.
- Page mapping:
  - OpenITI `PageVxxPyyy` marks the end of page yyy and maps to Shamela (part xx, page_num yyy). Verified exactly on al-Tabari pages 3 and 4.
  - This only holds when the bibliographic card says `[ترقيم الكتاب موافق للمطبوع]` (6,940 of 8,492 books).
  - For `[الكتاب مرقم آليا]` (180), `[الكتاب مرقم آليا غير موافق للمطبوع]` (436) and `[كتاب إلكتروني بترقيم الشاملة]` (44), cite «ترقيم الشاملة» or section and paragraph, never a printed page.
  - Non-numeric volumes need a mapping table from labels to OpenITI's V01, V02…; turath's `volume_bounds` is a working example.
- Keeping editor material out:
  - Drop the `footnotes` field and the `(¬N)` markers.
  - Drop pages before the author's text starts: the `المقدمة` part, table-of-contents headings «مقدمة التحقيق», and index sections «الفهارس».
  - Strip bracketed folio numbers and editor insertions.
  - Keep `[سورة: آية]` references, converted into Quran links.
  - Prefer OpenITI CLEANED primary versions as the redistributable base, and add a `non_author` page flag modelled on turath.
- Cross-referencing: OpenITI version id `Shamela0007798` = shamela.ws 7798 = HF `shamela_id` 7798 = turath 7798 (verified for al-Tabari, Lisan 1687 and Mufradat 23636).
  - `Sham19Y` is the 2019 shamela.ws scrape.
  - Do not assume `ShamAY` or `Sham30K` ids are shamela.ws ids (untested).
  - The work URI groups all versions; use KITAB alignments where ids differ.
- Word anchors: compute token indexes on vowel-stripped, normalised text, so OpenITI and vowelled Shamela text align and each word can link to its root.
- User texts: work id `user:<uuid>`, version = content hash, blocks = paragraphs. For PDFs, page = the PDF page index.

#### (e) Copyright filter

- Death-year gates as of 2026:

| Rule | Author died | Hijri cut-off | Source |
|---|---|---|---|
| Life + 50 | by 1975 CE | ≤1394 AH (1395 AH straddles 1975) | Egypt Law 82/2002 Art. 160, via secondary sources (en.wikisource, Wikipedia); Arabic Wikisource policy |
| Life + 70 (EU) | by 1955 CE | ≤1374 AH | General knowledge, not fetched |
| US | published before 1931 | — | General knowledge, not fetched |

- Editions: Germany's §70 UrhG protects scholarly editions "fünfundzwanzig Jahre nach dem Erscheinen der Ausgabe" (25 years after publication). How Arab-country laws treat critical editions (تحقيق) is unknown. So strip all apparatus, and prefer editions published more than 25 years ago where possible.
- Filter fields:
  - OpenITI: `date` (1450 = living or unknown), `tags` (`CLEANED_VERSION`, `UNCORRECTED_OCR`), `uncorrected_OCR`, `ed_info`, and the `id` prefix (treat `Hindawi` with caution).
  - Shamela: `main_author_death_hijri` (99999 = unknown), `authors[].death_hijri` with role, `is_hidden`, `betaka_text`.
  - Catalogue CSV: `author_year`, `editor`, `edition`, `pagination`.
- Shamela catalogue counts (8,492 books, June 2025):

| Gate | Books | With printed-page numbering | With a named editor |
|---|---|---|---|
| Death ≤1350 AH | 4,489 | — | — |
| Death ≤1374 AH (life + 70) | 4,570 | 3,981 | 3,537 |
| Death ≤1394 AH (life + 50) | 4,852 | 4,255 | 3,737 |
| No death year (`Null`) | 3,004 — exclude | — | — |

- Pitfalls:
  - The "main author" field misses modern commentators on a classical text.
  - Collective works are marked «مجموعة من المؤلفين» with death year 99999.
  - Modern rearrangements of classical works slip through (e.g. «تجديد الصحاح» passing islamlab's 1350 AH gate).
  - Translations need their own check.

#### Recommendation

1. Use the OpenITI 2025.1.9 metadata as the catalogue. Gate on death ≤1374 AH, `CLEANED_VERSION`, and not uncorrected OCR. Treat 1375–1394 AH as an owner decision.
2. For a non-commercial launch, display OpenITI primary text under CC BY-NC-SA with attribution to the file URI and release. Any public API or bulk download must also be CC BY-NC-SA.
3. Vowelled display and commercial use need permission from Shamela (mail@shamela.ws), OpenITI and edition rights holders. The fallback is our own OCR of public-domain old printings (option only; not assessed further).
4. Build the citation key on printed volume and page, verified against Shamela's bibliographic card, plus paragraph number. Keep OpenITI milestones only as a cross-reference.

#### Open questions for the owner

1. When might the site go commercial? This decides whether a CC BY-NC-SA base is acceptable at launch.
2. Which legal jurisdiction will the site operate under? This decides life + 50 versus life + 70.
3. Should we email Shamela for an API key and permission, and OpenITI about commercial permission?
4. Is unvowelled OpenITI text acceptable for display, or are vowels required?
5. Scope: should Shia, Zaydi and Ibadi collections, and Hindawi modern literature, be included?

#### Flagged outside the task

- The sample file paths in docs/research/02-arabic-lexica.md §5.1 use Shamela 4 folder numbers (`book_id`), not shamela.ws ids. For example, 6119 is really `shamela_id` 23636 and 1462 is really 1687. The sample files also use those folder numbers, so the label may also be wrong there. I did not edit anything.

---

## Part 9 — Arabic OCR and PDF/URL text extraction

**Arabic OCR and text-extraction options for the book-reading site (research as of 2026-10-02)**

**Outcome:** No single engine works best for Arabic. Of the tools that are safe for both a public site and later commercial use, one stands out for classical letterpress: Kraken with the OpenITI Arabic print model. An independent study measured it at 3.1% character error on 19th–20th-century Arabic books, against 24.6% for Tesseract and 10–21% for open vision-language models. For cleanly typeset modern books, Azure Document Intelligence and Gemini lead the independent tests. Vision-language models make extra errors on diacritics and occasionally produce text that is not on the page, so they should be a second opinion with a human checking the result. For a commercial future, avoid Surya/Marker/Chandra (Datalab weight licences), MinerU, Baseer, Arabic-Nougat, Qwen2.5-VL-3B and AWS Textract (no Arabic).

"CER" below is character error rate. "(self)" means the developer or vendor measured its own model; "(indep.)" means a third party did.

#### Candidate table

| # | Candidate | What it does | Arabic support | Code licence | Weights licence | Public non-commercial | Commercial | Footprint | Best quality evidence | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tesseract 5.5.3 + `ara` / `script/Arabic` (best, fast, legacy) | LSTM line OCR | Model's character set includes the harakat, but it rarely outputs them; no footnote or marginalia roles | Apache-2.0 | Apache-2.0 | Yes | Yes | CPU; ara best 12.6 MB, Arabic best 17.1 MB, ara fast 1.4 MB | (indep.) 24.6% median CER, book lines; 33.1% aged printed pages; 4.7% clean synthetic print; 16.5% Hindawi pages | Cross-check (baseline, and as input to a correcting model) |
| 2 | Kraken 7.1 + OpenITI "Printed Arabic Base Model" (Zenodo 7050296) | Trainable layout, reading order and line recognition | Right-to-left/BiDi support; model outputs harakat; ALTO/PageXML output | Apache-2.0 | CC0-1.0 | Yes | Yes | CPU; model 16.3 MB; speed not documented | (indep., Inria 2026) 3.1% median CER on 19th–20th-c. Arabic book lines; (self) 96.43% validation accuracy | Use (main self-hosted engine; fine-tune per typeface) |
| 3 | eScriptorium | Web interface for transcribing, correcting and training Kraken models | Same as Kraken | MIT | n/a | Yes | Yes | Django + Celery + Postgres + Redis (heavy) | n/a | Use (internal correction and training tool, not public-facing) |
| 4 | Qari-OCR 0.1 / 0.2.2.1 / 0.3 (2B, Qwen2-VL) and 0.4.0 (4B, Qwen3-VL) | Page OCR with a vision-language model | Claims full tashkil; v0.3 outputs HTML/Markdown; 0.4.0 tuned on Islamic books | n/a | Apache-2.0 (all four) | Yes | Yes | GPU; 2B uses 5.6–9.5 GiB and 7.6 s per 100 words on an A100 | (self) v0.2 CER 0.061; 0.4.0 CER 0.122 (own data). (indep.) KITAB 1.80; Baseer test 0.64; manuscripts 167% | Cross-check (0.4.0 only, test on our own pages) |
| 5 | AIN-7B (MBZUAI) | Arabic vision-language model | Arabic/English | MIT | MIT (base Qwen2-VL-7B, Apache) | Yes | Yes | GPU, 7B | KITAB (same lab) 0.20; others report 1.11, 0.309, 1.28 | Avoid (results contradict; self-evaluated) |
| 6 | Baseer (Misraj, 3B) | Arabic page to Markdown | Layout-aware | n/a | Main weights not public; HTR variant CC-BY-NC-SA-4.0; base Qwen2.5-VL-3B is non-commercial | Paid API only (terms unknown) | No (self-host) | GPU | (self) WER 0.25 / CER 0.53 on its own Misraj-DocOCR set; Azure CER 0.27 on the same set | Avoid self-hosting; API unknown |
| 7 | Arabic-Nougat (MohamedRashad) | Page to Markdown | Arabic | n/a | GPL-3.0 | Risky | Risky | GPU | (indep.) KITAB CER 4.37 | Avoid |
| 8 | Qwen3-VL 2B–235B; Qwen2.5-VL 7B/32B | General vision-language models | Arabic capable; diacritics often wrong | Apache-2.0 | Apache-2.0 (2.5-VL-3B: research only; 2.5-VL-72B: licence needed above 100M monthly users) | Yes | Yes (Apache sizes) | 8B uses 17–20 GiB, 5.4 s per 100 words on an A100 | (indep.) Q3-8B 11.3% book lines, 12.4% OpenITI pages; Q2.5-7B 20.1% aged pages | Cross-check (as corrector, given Tesseract or Kraken text) |
| 9 | Fanar-2-Oryx-IVU (QCRI, 7B) | Arabic-first vision-language model | Arabic fonts and calligraphy | n/a | Apache-2.0 | Yes | Yes | GPU, about 7B | (indep.-ish, QCRI) 19.2% aged pages; Tesseract + Fanar 15.5% | Cross-check (corrector) |
| 10 | olmOCR-2-7B | OCR-specialised vision-language model | Multilingual, not Arabic-tuned | Apache-2.0 | Apache-2.0 | Yes | Yes | About 17–20 GiB; 49.5 s per 100 words (slow) | (indep.) 10.5% book lines; 12.9% OpenITI pages; 12.7% modern news | Cross-check |
| 11 | dots.ocr (1.7B language model) | Layout + OCR to Markdown | Multilingual | MIT | MIT | Yes | Yes | GPU | (Baseer paper) CER 0.40 on Misraj-DocOCR; 0.28 on KITAB PDF-to-Markdown (30 samples) | Cross-check (layout/Markdown) |
| 12 | PaddleOCR PP-OCRv5 Arabic; PaddleOCR-VL 1.6 (0.9B) | Line OCR; page vision-language model | Arabic recogniser; VL claims 109 languages | Apache-2.0 | Apache-2.0 | Yes | Yes | CPU (classic) / small GPU (VL) | (self) 81.27% whole-line accuracy; (indep.) KITAB Paddle 0.79; no Arabic numbers for VL | Avoid classic / VL unknown |
| 13 | EasyOCR 1.7.2 | Line OCR | Arabic model | Apache-2.0 | Apache-2.0 | Yes | Yes | CPU/GPU | (indep.) KITAB 0.58; Qari paper 0.791; last release Sept 2024 | Avoid |
| 14 | docTR | Line OCR | Has Arabic vocabulary, no pretrained Arabic recogniser found | Apache-2.0 | Apache-2.0 | Yes | Yes | CPU/GPU | none | Avoid |
| 15 | Surya / Marker (Datalab) | OCR / PDF to Markdown | 90+ languages | Apache-2.0 (was GPL) | Modified OpenRAIL-M: free only under $5M revenue/funding, no competing product, output share-alike | Unclear (competitor clause) | No | GPU | (indep.) KITAB Surya CER 4.95 | Avoid |
| 16 | Chandra OCR 2 (Datalab) | Page OCR | 90+ languages | Apache-2.0 | Modified OpenRAIL: free only under $2M, "cannot be used competitively with our API" | Unclear | No | GPU | (self) Arabic 68.4% vs Gemini 2.5 Flash 84.4% | Avoid |
| 17 | GOT-OCR2 | Page OCR | No Arabic evidence | Apache-2.0 | Apache-2.0 | Yes | Yes | GPU | none | Avoid |
| 18 | MinerU 4 / MinerU2.5 | PDF parsing | Arabic quality unknown | Apache-2.0 plus extra terms (must name MinerU in online services; revenue/user thresholds) | 2.5-2509: AGPL-3.0; 2.5-Pro: Apache | Yes, with attribution | Thresholds apply | GPU | none for Arabic | Avoid |
| 19 | DeepSeek-OCR / OCR-2 | Page OCR | Multilingual | MIT / Apache | MIT / Apache-2.0 | Yes | Yes | About 7–9 GiB | (indep.) 20.8% book lines; OpenITI pages 180.6% / 31.1% | Avoid |
| 20 | LightOnOCR(-2) 1B | Page OCR | Multilingual | Apache | Apache-2.0 | Yes | Yes | Small GPU | (indep.) 15.4% book lines; 17.5% OpenITI pages | Avoid (low priority) |
| 21 | Mistral OCR 4 (API) | Cloud OCR | 170 languages (vendor) | Proprietary | n/a | Yes | Yes | API, $4 per 1,000 pages (vendor) | (indep.) 16.0% OpenITI pages, 2.3% modern news; Qari paper 0.210 | Cross-check (modern print) |
| 22 | Azure Document Intelligence v4.0 Read/Layout (API) | Cloud OCR + layout | Arabic printed and handwritten; marks footnotes and page numbers | Proprietary | n/a | Yes | Yes | API; data deleted after 24 h | (indep.) 10.5% OpenITI pages, 2.7% modern news; lowest CER (0.27) in Baseer's test; KITAB Hindawi 0.06 | Use (commercial reference / cross-check) |
| 23 | Google Cloud Vision / Document AI (API) | Cloud OCR | Arabic printed supported; no Arabic handwriting | Proprietary | n/a | Yes | Yes | API | No independent Arabic numbers found | Cross-check (quality unknown) |
| 24 | Gemini 2.0 / 2.5 / 3 (API) | Vision-language OCR | Strong Arabic | Proprietary | n/a | Gemini API bans services likely used by under-18s | Paid tier only | API | (indep.) KITAB best (0.13 overall, Hindawi 0.01); Gemini 3 Pro 10.1% OpenITI pages, 2.4% news | Cross-check (via Vertex AI; check terms) |
| 25 | AWS Textract | Cloud OCR | No Arabic | Proprietary | n/a | n/a | n/a | n/a | Vendor documentation | Avoid |
| 26 | GPT-4o / GPT-5 / GPT-5.1; Claude Opus 4.5 (API) | Vision-language OCR | Arabic capable | Proprietary | n/a | Yes | Yes | API | (indep.) GPT-5.1 36.2% OpenITI pages; Claude Opus 4.5 10.0% / 3.9%; GPT-4o KITAB 0.31 | Claude: Cross-check; GPT: Avoid |

#### Notes per candidate (licence quotes verbatim)

**Tesseract**
- Licence: "All data in the repository are licensed under the Apache-2.0 License" (https://github.com/tesseract-ocr/tessdata_best README). The GitHub licence API returns Apache-2.0 for tesseract, tessdata_best, tessdata_fast and tessdata (https://api.github.com/repos/tesseract-ocr/tessdata_best/license).
- The `ara` character set (langdata_lstm/ara/ara.unicharset) contains U+064B–U+0652. QCRI found Tesseract's CER barely changes when diacritics are scored (+0.4 points) because it "usually does not produce them".
- Evidence on classical prints, all independent:
  - Inria, arXiv 2605.27750 (Sep 2026): Tesseract-ara 24.6% median CER / 77.8% WER on 3,197 line images from 15 held-out 19th–20th-c. books, with the correct lines supplied.
  - QCRI, arXiv 2608.22366 (Aug 2026 preprint): 33.1% CER on 199 aged printed pages from 100 books, diacritics removed before scoring; 4.7% on clean synthetic print; 16.5% on Hindawi pages.
- KITAB-Bench gives 0.54 overall, but that mixes in handwriting and scene text.
- Unknowns: which traineddata variant each study used; the studies don't say.

**Kraken + OpenITI**
- Kraken code: Apache-2.0 (https://api.github.com/repos/mittagessen/kraken/license).
- OpenITI model: `"license": "CC0-1.0"` (https://zenodo.org/records/7050296, metadata.json). The multi-script parent model 7050270 is also CC0.
- What the model is: about 23k Arabic lines in many typefaces plus 600 synthetic Tahoma lines. The model card says it is "mostly intended as a base model for fine-tuning… not been extensively verified or optimized." Ground truth is "lightly normalized to NFD".
- The 3.1% result favours Kraken somewhat: the test books are held out but come from the same OpenITI print collection the model was trained on, and the correct lines were supplied, so no layout analysis was tested.
- The training data repository (OpenITI/arabic_print_data) has no declared licence. Inria notes these "carry no declared licence and are therefore reserved by default". Using the CC0 model is fine; reusing that data for training is not cleared.
- OpenITI MAKHZAN (Zenodo 19861912, 2026) is CC-BY-NC-SA-4.0, mostly manuscripts, so non-commercial only.
- The HTR-United catalogue lists only 5 Arabic-script entries, all manuscript or typed material, and no Arabic print models.
- Kraken's own description: "Fully trainable layout analysis, reading order, and character recognition" and "Right-to-Left, BiDi, and Top-to-Bottom script support".
- Unknowns: how well the default layout model handles Arabic print, footnotes and frame marginalia; whether OpenITI's transcriptions keep tashkil; CPU speed.

**eScriptorium**
- Licence: "Permission is hereby granted, free of charge, to any person obtaining a copy of this software…" (MIT, https://gitlab.com/scripta/escriptorium/-/blob/develop/LICENSE).

**Qari-OCR**
- HF model metadata shows `license: apache-2.0` for 0.1, 0.2.2.1, v0.3 and 0.4.0 (https://huggingface.co/api/models/NAMAA-Space/Qari-OCR-0.4.0-VL-4B-Instruct). The 0.4.0 base is Qwen3-VL-4B (Apache-2.0); it ships as a PEFT adapter.
- 0.4.0 was trained on seemorg/books-ocr (MIT dataset card; Usul.ai Islamic book pages). That dataset's "reviewed" text was produced by human review of Azure OCR output ("the raw output from the ocr model (we use azure)"). Its self-reported CER of 0.122 is in-domain, and how it was split for testing is unknown.
- The paper's v0.2 result (CER 0.061, WER 0.160) is on "200 scanned pages from traditional Arabic print", an in-house set that is not published. Because training was entirely synthetic, check this on our own pages before relying on it.
- KITAB-Bench measured "Qaari" at CER 1.80 without naming the version.

**Qwen licences**
- Qwen2.5-VL-3B: "FOR NON-COMMERCIAL PURPOSES ONLY" (https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct/blob/main/LICENSE). This also affects Baseer, which is built on it.
- Qwen2.5-VL-72B: "If you are commercially using the Materials, and your product or service has more than 100 million monthly active users, you shall request a license from us."
- Qwen3-VL (all sizes), Qwen3.5 and Qwen2.5-VL 7B/32B: `license: apache-2.0` (HF API).

**Surya / Marker**
- Surya README: "The Surya code is licensed under Apache 2.0. The model weights use a modified AI Pubs Open Rail-M license (free for research, personal use, and startups under $5M funding/revenue)."
- MODEL_LICENSE Attachment A 2(c) bars use "if You… provides or otherwise makes available any product or service that competes with any product or service offered by… Licensor" (https://github.com/datalab-to/surya/blob/master/MODEL_LICENSE).
- §8 Share-a-Like extends the licence "to the Output and any derivatives". That puts conditions on publishing the OCR'd text itself.
- Marker repeats the same weights terms (https://github.com/datalab-to/marker).

**Chandra**
- "Model weights use a modified OpenRAIL-M license: free for research, personal use, and startups under $2M funding/revenue. Cannot be used competitively with our API." (https://huggingface.co/datalab-to/chandra-ocr-2)

**MinerU**
- "If you provide online services to third parties based on MinerU, you must clearly and prominently indicate… that MinerU is used."
- A separate licence is needed if "monthly active users (MAU) exceed 100 million; or… total monthly revenue exceeds USD 20 million." (https://github.com/opendatalab/MinerU/blob/master/LICENSE.md)
- MinerU2.5-2509-1.2B weights: `agpl-3.0` (HF API).

**Baseer**
- Its benchmark tables are self-reported on the authors' own Misraj-DocOCR set (Apache-2.0 dataset).
- Only Misraj/Baseer__Nakba (CC-BY-NC-SA-4.0) is published; the main model is offered through baseerocr.com, whose terms I did not check.

**AIN and Arabic-Nougat**
- AIN: `license: mit`. KITAB-Bench and AIN share authors (Heakl, Salman Khan), so AIN's top open-model score there is a self-evaluation.
- Arabic-Nougat: `gpl-3.0` on its weights (HF API).

**Others (licences from the GitHub/HF licence APIs)**
- dots.ocr: "MIT License… Copyright (c) 2025 rednote-hilab" (https://github.com/studio-dots-ai/dots.ocr/blob/master/LICENSE).
- Apache-2.0: olmOCR, PaddleOCR, EasyOCR, docTR, GOT-OCR2, DeepSeek-OCR-2, LightOnOCR-2, and Fanar-2-Oryx-IVU (whose card says "License | Apache 2.0").
- DeepSeek-OCR (v1): MIT.
- docTR's multilingual model covers 12 Latin-script languages only.

**Cloud services**
- AWS: "Currently, Amazon Textract supports English, Spanish, German, Italian, French, and Portuguese." (https://docs.aws.amazon.com/textract/latest/dg/textract-best-practices.html)
- Azure lists Arabic for printed text (v3.1/v4.0) and for handwriting (v4.0) (https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr).
  - Layout tags paragraphs as title, sectionHeading, footnote, pageHeader, pageFooter or pageNumber.
  - Retention: "The service stores submitted input data and analyze results for 24 hours after an analysis operation completes."
  - KITAB found Azure "excels remarkably in diacritics recognition" on its 104 hard samples.
- Google Vision lists Arabic `ar` / `Arab` as supported, with no Arabic handwriting.
  - Data use: "Google does not use the content you send to train and improve our Cloud Vision features" (https://docs.cloud.google.com/vision/docs/data-usage, quoted via the fetch tool).
- Gemini API terms (https://ai.google.dev/gemini-api/terms, verbatim):
  - "You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website… that is directed towards or is likely to be accessed by individuals under the age of 18."
  - Paid tier: "Google doesn't use your prompts (including… files such as images, videos, or documents) or responses to improve our products".
  - The under-18 clause is a real risk for a public Quran site. Vertex AI falls under Google Cloud terms, which I did not verify.
- Mistral:
  - Zero data retention covers "/v1/ocr", granted on request (https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr).
  - The default 30-day retention comes from third-party summaries only; Mistral's own article returned 404, so it is unverified.
  - OCR 4 price, 170 languages and self-hosting are vendor claims from https://mistral.ai/news/ocr-4/.

**Benchmark caveats**
- KITAB-Bench (arXiv 2502.14949, ACL Findings 2025):
  - Its OCR set is mostly handwriting, scene text and synthetic data. The only historical-print subset ("HistoricalBooks") has just 10 samples.
  - The second block of its per-dataset table (Table 9) contradicts its overall table (Table 6). I used Table 6 and the first block only.
  - Several open models score CER above 1 because they repeat or invent text.
- METATR (Teklia, arXiv 2605.26712) uses only 10 pages per Arabic dataset. Its "QARI news" set is NAMAA's own synthetic data.
- Inria, Arabic: VLM-only failures:
  - VLMs alone show "repetition collapse, markup emission, and off-script generation".
  - "all five VLMs occasionally emit Latin characters within Arabic lines".
  - "Text-only post-OCR correction… degrades nearly all Arabic systems".
- QCRI: VLMs gain +7 to +20 CER points when diacritics are kept in scoring, and Qari 0.4.0 shows a +27.5 point penalty on manuscripts. Feeding the model both the image and Tesseract's text improves aged print by 19.3% relative.

#### Extracting text from born-digital PDFs

**Libraries**

| Tool | Licence (verbatim / API) | Arabic behaviour | Verdict |
|---|---|---|---|
| PyMuPDF | "Dual Licensed - GNU AFFERO GPL 3.0 or Artifex Commercial License" (PyPI); README: "Commercial — separate commercial licences available from Artifex… for proprietary applications" | Good engine; MuPDF falls back to the font's own map (claimed in the qalam README) | Avoid unless the server code is AGPL'd or a licence is bought |
| pdfminer.six / pdfplumber | MIT / MIT | Open issue #515 "Supporting RTL Languages" (since 2020) and #850 "Arabic ligatures order issue" (since 2023) | Cross-check (needs our own bidi and ligature fix) |
| pypdf | BSD-3 ("Redistribution and use in source and binary forms… are permitted") | Arabic handling not verified | Cross-check |
| pypdfium2 | "BSD-3-Clause, Apache-2.0" (PyPI) | Good for rendering pages to images; Arabic text layer not verified | Use (rendering pages for OCR) |
| Poppler `pdftotext` | GPL-2.0-or-later; README: "programs which call Poppler must be licensed under the GPL as well" | Not verified | Cross-check (call it as a separate command only) |
| Apache PDFBox / Tika | Apache-2.0 | `PDFTextStripper.normalizeWord` folds U+FB00–U+FDFF and U+FE70–U+FEFF; `handleDirection` uses `java.text.Bidi` (checked in trunk source) | Use (Java sidecar, or port its logic) |
| qalam (misraj-ai) | GPL-3.0; created 2026-09-06; 66 stars | Logical order, folds glyph shapes to base letters, per-page `needs_ocr` verdict (self-claimed) | Cross-check (useful reference design; very new) |

**AGPL/GPL for a network service.** Only AGPL has a network clause. Running PyMuPDF inside a public web service obliges you to offer that service's source, and Artifex sells a commercial licence for closed-source apps. Plain GPL (Poppler, qalam, PyArabic, Mishkal) has no network clause, so server-side use without distributing the software does not force source release. Distributing an on-prem product or desktop app would. This is not legal advice.

**Known Arabic problems in PDF text layers**
- Presentation forms (U+FB50–U+FDFF, U+FE70–U+FEFF): fold them with NFKC applied only to those code points. NFKC over the whole text also expands ﷺ (U+FDFA) into a phrase.
- Reverse visual order before folding. Folding first splits ligatures such as لا into two letters, and the order then comes out wrong (pdfminer #850).
- Spaces inserted in the middle of words, and harakat detached from their letter (example in the qalam README).
- Custom-font PDFs with no Unicode map: they produce Private Use Area characters (U+E000–U+F8FF), U+FFFD, or valid-looking but wrong letters.
- Hidden OCR layers (text render mode 3) on scanned PDFs: treat them as an untrusted earlier OCR.

**Detecting a bad text layer and falling back to OCR (per page)**
- Not enough Arabic letters, or any Private Use Area / U+FFFD characters.
- Presentation-form share above 0 before folding (fixable, not fatal).
- Lexicon hit rate is low, or the reversed text scores higher than the forward text, which signals visual order. The project's own root/word lexicon can serve as the lexicon.
- Average word length below 2, which signals letters split by spaces.
- OCR one page per batch and compare it to the text layer; if the difference exceeds about 10%, fall back to OCR for that page. The 10% is a starting threshold to tune, not a measured value.

#### Importing from a URL

- trafilatura: "This package is distributed under the Apache 2.0 license." It also says "Versions prior to v1.8.0 are under GPLv3+ license", so pin to 1.8.0 or later.
- Mozilla Readability: Apache-2.0 (JavaScript; needs a DOM such as jsdom).
- Pitfalls:
  - Both tools keep harakat, which are ordinary combining characters.
  - Strip bidi control characters (U+200E/F, U+202A–E, U+2066–9) and normalise to NFC.
  - Footnotes, sidebars and poetry laid out in tables are often dropped.
  - Some sites render Quranic text as images or in custom fonts.
  - Respect copyright and robots rules.

#### Post-OCR correction (brief)

- Correction that looks at both the image and the OCR text helps: QCRI measured a 19.3% relative gain on aged print. Text-only LLM correction made nearly all Arabic systems worse (Inria), so don't use it.
- Libraries:
  - Permissive: CAMeL Tools (MIT; normalisation and morphology), CATT diacritisation (Apache-2.0 code, weights licence unverified), Shakkelha (MIT).
  - Copyleft: Mishkal and PyArabic (GPL-3.0), Hunspell (LGPL-2.1).
  - KenLM: the GitHub licence API reports NOASSERTION; not verified.
- Never auto-add diacritics to OCR output that is presented as the printed edition.

#### Recommended pipeline

1. **Pasted text:** normalise only.
2. **URL:** extract the main content with trafilatura or Readability, then normalise.
3. **PDF triage, per page:**
   - Extract the text layer with PDFBox, or pypdfium2 plus our own bidi and presentation-form fix.
   - Score the page with the checks above.
   - Good pages go to normalisation; bad pages are rendered at 300–400 dpi with pypdfium2 and sent to OCR.
4. **OCR:**
   - Run Kraken with the OpenITI CC0 model on CPU as the main engine.
   - Run a second engine: either Azure Layout (which also gives footnote and page-number roles), or a self-hosted Apache vision-language model given the image plus the Kraken/Tesseract text (Qwen3-VL-8B, Fanar-2-Oryx-IVU, or Qari 0.4.0).
   - Compare the two engines line by line; lines that disagree are flagged for review.
5. **Normalise:**
   - Store the faithful text in NFC with harakat kept.
   - Fold presentation forms; strip bidi control characters.
   - Map Persian look-alikes to Arabic: ی (U+06CC) to ي (U+064A), ک (U+06A9) to ك (U+0643), ہ (U+06C1) to ه (U+0647).
   - Remove tatweel only in a separate search form.
   - Keep the printed page number (Arabic-Indic digits) and the PDF page index as separate fields.
6. **Human correction:** a side-by-side editor showing the line image and its text.
   - Each page carries a status: auto / needs review / verified.
   - Corrections are saved as ALTO/PageXML and periodically used to fine-tune Kraken per typeface family (eScriptorium can host this internally).

**Expected quality by input type** (CER = character error rate; all numbers measured by third parties unless noted)

| Input type | Evidence | Realistic expectation |
|---|---|---|
| Born-digital PDF, good text layer | Deterministic extraction | Near-exact after the bidi/folding fix; custom-font PDFs must go to OCR |
| Modern typeset (Beirut/Cairo), clean scan | Azure 2.7%, Gemini 3 Pro 2.4%, Mistral 2.3% on 10 modern-news pages; Tesseract 4.7% clean synthetic, 16.5% Hindawi | About 2–5% CER, so many words per page still contain an error; review before publishing |
| Classical letterpress (Bulaq/Cairo, 19th–20th c.) | Kraken-OpenITI 3.1% (book lines, lines supplied); VLMs 10.5–20.8%; Tesseract 24.6%; aged pages: Tesseract 33.1%, Fanar 19.2%, Tesseract + Fanar 15.5% | Roughly 3–15% CER once page layout must also be found; Kraken fine-tuning is the main lever |
| Lithograph (handwriting-like) | No Arabic lithograph benchmark found; manuscript proxy: Tesseract 69%, Qwen 70%, corrected 60% (Muharaf, zero-shot) | Not usable without training on each book or hand; plan for heavy human correction |
| Diacritised (full tashkil) | VLMs +7 to +20 CER points when diacritics are scored; Tesseract omits them; Qari's 0.061 is self-reported; no Kraken diacritic CER published | Diacritics will be the weakest part everywhere; every diacritised page needs human checking |
| Footnotes / marginalia | Azure tags footnotes and page numbers; Kraken layout is trainable; VLM Markdown output often merges regions | Footnotes are workable; frame or rotated marginalia need custom layout training (not verified) |

#### Open questions for the owner

- Copyright and visibility: are user-uploaded texts private to the uploader, or published?
- May user uploads be sent to Azure, Google or Mistral (data leaving our servers; retention of 24 hours at Azure, about 30 days at Mistral)?
- GPU budget versus a per-page API budget, and expected monthly page volume.
- Does the audience include minors? This decides whether the Gemini API is allowed at all.
- Are you willing to open-source the server code under AGPL (for PyMuPDF), or should the stack stay permissive?
- Diacritics policy: confirm "preserve as printed, never auto-add".
- Who corrects OCR: you, volunteers, or users? This shapes the correction interface and the training loop.
- Which material comes first (Bulaq letterpress, lithographs, modern editions)? Lithographs need a separate model-training project.
- When might the site go commercial? That rules out Surya, Marker, Chandra, Qwen2.5-VL-3B, Baseer and anything CC-BY-NC.

#### Flags

---

## Part 10 — Morphological analysers for non-Quran text

**Morphological analysers for arbitrary Arabic text: candidate tools, licences and recommended setup (research as of 2026-10-02)**

Only two open, commercially safe tools give roots plus a wazn. The first is AlKhalil Morpho Sys 2 through its `farahidi` port (GPL-3.0; fine when run on our server). The second is CAMeL Tools with the openly licensed Camel Morph MSA database (code MIT, data CC BY 4.0). Every other tool either has no roots, or is research-only, non-commercial or dependent on an LDC licence.

Three findings change what we knew going in:
- **farahidi already ranks its output.** The brief said "unranked". The 0.3.1 wheel sorts candidates by a `priority` field and also has an in-context step that picks one analysis per word. `priority` is a heuristic weight, not a probability.
- **CAMeL's free default database cannot give our roots as they are.** It writes every hamza or weak radical (و/ي) as `#`. Examples: تَوالَى → `#.ل.#`, حَكَى → `ح.ك.#`, أمير → `#.م.ر`.
- **There is a new Quran dataset with a wazn column.** It is the Oujda team's "Al Mus'haf corpus" (AlKhalil 2 output plus manual checking). It has no licence, so we need their permission to use it.

#### Candidate table

| Tool | URL | Outputs | Ranked/scores? | Code licence | Data/model licence | Public site OK? | Commercial OK? | Footprint | Classical/Quranic evidence | Maintenance | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| farahidi 0.3.1 (Python port of AlKhalil 2) | github.com/forzagreen/farahidi | root, lemma, stem, stem and lemma patterns (wazn), POS with features, case/mood, proclitic/enclitic, diacritised form; all candidates | Yes, but only a heuristic: sorted by `priority` (average of 5 AlKhalil frequency weights, not a probability); in-context step picks one analysis per word using an MSA-trained model | GPL-3.0-or-later | Bundled AlKhalil data GPL-3.0 | Yes (server-side) | Yes server-side; shipping the JS port to browsers counts as distribution | Pure Python ≥3.11, no dependencies, 11.5 MB wheel, offline; RAM and latency not documented | Our pilot (3k QAC tokens): top-1 root 91.3%, QAC root in candidates 98.5%, no analysis 6.2%. JLCL 2017 (AlKhalil 2): 5.8% unknown words, accuracy 0.90 on 50 words, 14.25 analyses/word. QAMAR 2026: NQC corpus (AlKhalil 2 + manual) root 93.81% | PyPI 2026-06-28; last commit 2026-08-12; "Alpha"; one maintainer | Use: main candidate generator |
| AlKhalil Morpho Sys 2 (Java original) | alkhalil.oujda-nlp-team.net/AlKhalil-MorphoSys.php | same as farahidi, plus a lemmatiser/stemmer | list of candidates, plus in-context mode | GPL-3.0 | GPL-3.0 | Yes | Yes server-side | Java; jar 61.2 MB, source 10.9 MB, REST API 28.5 MB | as above; fiqh texts (DSH 2019, version not stated): root F1 30.3%, 46.7% after removing stopwords | download files dated 2024-02/03 | Cross-check: reference to confirm farahidi matches |
| CAMeL Tools 1.6 + calima-msa-r13 database | github.com/CAMeL-Lab/camel_tools | diacritised form, lemma, root, pattern, stem, POS, clitics, tokenisations, gloss, log-probabilities; all analyses | Analyser itself: unranked, with log-probability fields. Its two disambiguators (MLE and BERT): sorted, top score = 1.0, not calibrated | MIT | Database GPL v2 (derived from AraMorph 1.2.1); MLE model GPL v2; BERT model MIT (trained on LDC Penn Arabic Treebank per Inoue 2022, not re-read) | Yes | Yes (flag: weights trained on LDC data) | Python 3.11–3.14, needs torch and transformers, Rust/cmake to build; data 40.5 MB + 88.7 MB (MLE) + 445 MB (BERT); "light" bundle 562 MB, "all" 4.26 GB | JOHD 2026: Quran segmentation exact match 0.80, hadith 0.81; no Quran root evaluation found; `#` for weak/hamza radicals (checked) | v1.6.0 2026-06-08; active | Cross-check: POS, clitics, diacritics; roots not usable as-is |
| Camel Morph MSA v1.0 database (used through CAMeL Tools) | github.com/CAMeL-Lab/camel_morph | same as above; roots fully written (ح.و.ش, ز.ي.د checked) | Analyser only (frequency data on about 9% of sampled entries); the shipped disambiguators are tied to calima-msa-r13 | MIT | CC BY 4.0 | Yes, with attribution | Yes, with attribution | 85 MB database + CAMeL Tools | No Classical Arabic evaluation found; paper reports about 36% fewer unknown words than SAMA (MSA) | last commit 2026-08-11 | Cross-check, then second generator if a pilot passes |
| CAMeL + calima-msa-s31 (CALIMA-Star) | CAMeL data catalogue | richest MSA database | through the disambiguators | MIT | "LDC": ships scrambled, needs the purchased SAMA 3.1 file | No | No | 44.8 MB | Saeed & Habash 2025: Quran lemma 94.5–95.2% | — | Avoid: needs an LDC licence |
| Farasa (QCRI) | farasa.qcri.org | segmentation, lemma, POS, diacritisation, NER, parsing; no root or pattern | single best, no scores exposed | research only | research only | No | No | Java after registration, or a free API with a key; limits not documented | POS 84.44% Classical vs 97.43% MSA (reported in JLCL 2017); Quran diacritisation error rate 12.2% per letter, 19.0% per word (Hamed & Zesch 2017); Quran segmentation 0.76 | site ©2020; Python wrapper 2025-09 | Avoid |
| MADAMIRA | camel.abudhabi.nyu.edu/madamira | diacritics, lemma, POS, tokens, gloss | ranked with scores (Pasha 2014, not checked) | Columbia academic licence; commercial by request; "Patent Pending" | SAMA (LDC) or AraMorph | No | No | Java | Quran diacritisation error rate 21.1% per letter, 36.7% per word; POS 0.706 on 50 Classical words | replaced by Camelira | Avoid |
| Camelira | camelira.camel-lab.com | web demo only | in the interface | web app | — | No API found | No | remote | MSA and dialects only | online | Avoid |
| Qalsadi | github.com/linuxscout/qalsadi | root, lemma, stem, diacritised form, type, affixes, frequency; no wazn field | unranked, with a modern-Arabic frequency field | "GPL" with no version (no licence file) | Arramooz GPL-2 | Yes | Yes server-side | pure Python, 10 dependencies | none found | 0.5.1 2025-07-27 | Cross-check |
| Tashaphyne | github.com/linuxscout/tashaphyne | light stem, all segmentations, guessed root | no | GPL-3.0 | — | Yes | Yes | 0.25 MB | no Quran root evaluation found | 0.3.6 2022; repo 2024-09 | Cross-check: fallback guess when nothing else analyses a word, labelled as a guess |
| Mishkal | github.com/linuxscout/mishkal | diacritisation (uses Qalsadi) | no | GPL-3.0 | GPL | Yes | Yes | pure Python, many dependencies | Tashkeela error rate 13.78% per letter (Fadel 2019, search summary only) | 0.4.1 2021; repo 2025-09 | Avoid for morphology |
| Arramooz | github.com/linuxscout/arramooz | dictionary: nouns (root, wazn), verbs (root), stopwords | — | GPL-2.0 | GPL-2.0 | Yes | Yes; published derivatives become GPL-2 | 6.3 MB SQLite | — | repo 2023-02 | Cross-check: wazn reference |
| Qutrub (libqutrub) | github.com/linuxscout/qutrub | verb conjugation generator | — | GPL v2 | — | Yes | Yes | 0.14 MB | — | 2020; repo 2023-07 | Avoid for analysis (possible conjugation feature) |
| pyarabic / alyahmor | github.com/linuxscout/pyarabic, /alyahmor | text normalisation / word-form generator | — | GPL-3.0 | — | Yes | Yes | tiny | — | pyarabic repo 2026-01; alyahmor 2023-01 | Use pyarabic only if needed |
| SinaTools / Alma (Birzeit) | github.com/SinaLab/sinatools | lemma (Qabas id), root (Qabas), POS (40 tags), frequency; no wazn | Yes, sorted by frequency (checked in code) | MIT | dictionary file has no licence; Qabas CC BY-ND 4.0 | Unclear | Unclear | pins transformers 4.47.1 and torchvision 0.20.1; its morphology data URL returned 404 on 2026-10-02 | MSA F1 88–90% (search summary); no Classical evaluation found | PyPI 1.0.9 2026-04; repo 2025-10 | Cross-check: blocked until the data is back and its licence is clear |
| BAMA 1.0 / AraMorph | catalog.ldc.upenn.edu/LDC2002L49 | stems, lemmas, POS, gloss; no root or pattern | no | GPL v2 | GPL v2 | Yes | Yes | Perl/Java | 8.4% unknown words, accuracy 0.88 on 50 words (JLCL) | 2002 | Avoid: calima-msa-r13 replaces it |
| ElixirFM | github.com/otakar-smrz/elixir-fm | root, pattern, lemma, inflection | no | GPL-3 | GPL-3 | Yes | Yes | Haskell build | 7.6% unknown words, accuracy 0.84, slowest tool (JLCL) | last commit 2023-03 | Avoid |
| Stanza Arabic | github.com/stanfordnlp/stanza | lemma, POS, features, dependencies; no root | single best | Apache-2.0 | model card says Apache, but trained on UD Arabic-PADT (CC BY-NC-SA 3.0) | Non-commercial only | Risky | torch | MSA only | 1.15.0 2026-10-01 | Avoid |
| UDPipe 2 Arabic | ufal.mff.cuni.cz/udpipe/2 | same layers as Stanza | single best | MPL-2.0 | models CC BY-NC-SA | Non-commercial only | No | — | MSA | UD 2.17 models | Avoid |
| spaCy | spacy.io | no trained Arabic model (only the two multilingual ones) | — | MIT | — | — | — | — | — | — | Avoid |
| SALMA (Leeds) | — | detailed tagger | — | not obtainable (authors did not answer the JLCL authors) | — | No | No | — | — | — | Avoid |
| YAMAMA (2016) | aclanthology.org/C16-2047 | MSA/Egyptian analyser | — | no public release found | — | — | — | — | — | — | Avoid |
| ALP | arabicnlp.pro | segmentation, POS, lemma; no root | — | unknown | — | Unknown | Unknown | — | Quran segmentation 0.81 (JOHD 2026) | — | Avoid |
| Khoja stemmer | zeus.cs.pacificu.edu/shereen/research.htm | one root per word | no | none stated | — | Unknown | No | Java | fiqh root F1 80.9% after removing stopwords (DSH 2019) | old | Avoid |
| LLMs | — | free text | self-reported only | — | — | — | — | API | QAMAR 2026, first 10k Quran words: root accuracy GPT-4o 21.58%, LLaMA-4 44.09% | — | Avoid as an analyser |

##### Quran-specific resources (gold data or priors, not analysers)

| Resource | Content | Licence | Use |
|---|---|---|---|
| Al Mus'haf corpus / NQC (Oujda, Zeroual & Lakhouaja 2016) | 78,479 rows: word, stem, stem pattern, POS, lemma, lemma pattern, root; AlKhalil 2 plus manual checking; 4.6 MB zip, Windows-1256 CSV | None stated; site footer "Copyright © 2023 All Rights Reserved - Oujda NLP Team"; bundled file only asks for a citation | Best prior for re-ranking AlKhalil output, wazn included; needs permission |
| QuranMorph (Birzeit) | 77,429 tokens, lemma (Qabas) and 40-tag POS; "manually lemmatized … by three expert linguists" (claimed; the QAMAR paper calls it fully automatic) | CC BY 4.0 | Lemma/POS gold for calibration; roots only through Qabas (CC BY-ND) |
| QAMAR (Faqihi et al., AbjadNLP 2026) | manually checked stem, lemma, root, POS | Not released: "will be made publicly available for research and educational purposes" | Evaluation only, if released; measures QAC roots at 84.57% agreement, largely due to different conventions |

#### Per-tool notes and licence quotes

**CAMeL Tools**
- Code: LICENSE says "MIT License / Copyright 2018-2026 New York University Abu Dhabi" (raw.githubusercontent.com/CAMeL-Lab/camel_tools/master/LICENSE).
- Catalogue (raw.githubusercontent.com/CAMeL-Lab/camel-tools-data/main/catalogue-1.6.json) licence fields:
  - morphology-db-msa-r13 "GPL v2"
  - morphology-db-egy-r13 "GPL v2"
  - disambig-mle-calima-msa-r13 "GPL v2"
  - morphology-db-msa-s31 "LDC"
  - morphology-db-glf-01 and lev-01 "CC BY 4.0"
  - disambig-bert-unfactored-msa "MIT"
- LICENSE inside the msa-r13 zip (read with a partial download): "### This database was derived from Aramorph1.2.1 available at, ### http://sourceforge.net/projects/aramorph/ and distributed under, ### GNU GENERAL PUBLIC LICENSE Version 2". It also says "as published by the Free Software Foundation version 2" (no "or later"). The egy-r13 and MLE packages carry the same file.
- msa-s31 install note: "1)Purchase a copy of SAMA 3.1 from https://catalog.ldc.upenn.edu/LDC2010L01." The package ships scrambled and is unscrambled with the purchased archive. The catalogue's `light` bundle still lists it.
- BERT model config: "MSA unfactored model based on Inoue et al., 2022 with calima-msa-r13 analyzer." Its LICENSE is MIT (Copyright 2022 NYUAD).
- GLF database LICENSE: "This work is licensed under the Creative Commons Attribution 4.0 International License."
- CAMeLBERT base models on Hugging Face (`-ca`, `-mix`, `-msa`, `-ca-pos-msa`): license tag apache-2.0.
- Camel Morph README: "The data files accessed through the below links are licensed under a Creative Commons Attribution 4.0 International License." It also says "the generated DB can be read using the official Camel Tools release" (claimed; I did not run it).
- Scores (from `disambig/mle.py` and `bert/unfactored.py`): each analysis gets a score divided by the best score, so the top is 1.0. The log-probabilities of POS/lemma are also exposed. None of this is a calibrated probability.

**Farasa**
- Home page: "QCRI FARASA package for processing Arabic text is being made public for research purpose only. For non-research use, please contact us."
- Also: "You can change and build your own modules as long as it is for Academic and/or research purposes."
- API: "The Web service API is totally free of charge . You just need to register for security reasons". The demo adds: "we force some limitations on portions of text you try and on the number of trials." No rate limits are published.
- farasapy README: "the original work(the toolkit) is __strictly premitted for research purposes only__. For any commercial uses, please contact the toolkit creators".

**AlKhalil Morpho Sys 2 and farahidi**
- The official source zip (alkhalil.oujda-nlp-team.net/Tools/AlkhalilMorphSys2.zip) contains `src/net/oujda_nlp_team/config/licenses.txt` = "GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007". The website itself states no licence. SourceForge "alkhalil" hosts only v1.1, last updated 2017-06-05.
- farahidi NOTICE: the bundled lexicon "is derived from AlKhalil Morpho Sys 2's resources and remains under the GPL-3.0."
- farahidi README: every analysis is "ranked by corpus frequency"; `priority` = "out-of-context ranking weight (higher = more frequent)".
- In the wheel's `analyzer.py`, priority is the average of 5 frequency weights (diacritic pattern, canonical pattern, lemma, lemma pattern, POS).
- The in-context step uses an MSA-trained language model file (`DATA.MSA.ALL.TRAIN.141809.lm`).
- A JS port exists: farahidi-js / npm `farahidi` 0.2.1, also GPL-3.0-or-later.

**MADAMIRA**
- Columbia licensing page (via WebFetch): "To request an academic license to download and use this software, please click on 'Express Licensing' above" and "For a commercial license, please contact techventures@columbia.edu." It is listed as "Patent Pending".
- Habash FAQ: "Requests from generic accounts (gmail, hotmail, etc.) will be rejected."
- CAMeL page: "MADAMIRA is now superseded by Camelira".
- It runs either with SAMA or with AraMorph (Hamed & Zesch 2017).

**linuxscout tools**
- tashaphyne, mishkal, pyarabic, alyahmor LICENSE: "GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007".
- arramooz LICENSE: "GNU GENERAL PUBLIC LICENSE Version 2, June 1991".
- qutrub COPYING: "Qutrub is subject to the GNU GENERAL PUBLIC (GPL) LICENSE." followed by "Version 2, June 1991".
- qalsadi has no licence file. Its README links to a missing LICENSE, `analex.py` says "Licence:     GPL" and PyPI says "GPL", so the version is unknown.
- None of these are AGPL.

**SinaTools and Qabas**
- README: "SinaTools is available under the MIT License."
- Qabas page: «معجم قبس هو معجم مفتوح المصدر (تحت رخصة CC-BY-ND-4.0) ويمكن استخدامه لأهداف ربحية وغير ربحية شرط عدم توزيعه إذا تم التعديل عليه»
  - In English: Qabas is open source (CC-BY-ND-4.0), usable for profit or not, but it may not be distributed if modified.
- Resources page: "Quran (CC-BY-4.0): Lemmatization of the Quran, each word is linked with a lemma in Qabas."
- The morphology data file sinatools 1.0.9 downloads (`https://sina.birzeit.edu/lemmas_dic.pickle`) returned HTTP 404 today.

**Other tools**
- BAMA 1.0 (LDC2002L49, via WebFetch): released under "GNU General Public License version 2". Contents: 82,158 stems / 38,600 lemmas, with no root or pattern in the description.
- ElixirFM: `ElixirFM.cabal` says "license: GPL"; its LICENSE is "GNU GENERAL PUBLIC LICENSE Version 3".
- UD Arabic-PADT LICENSE: "distributed under the same license terms as PADT 1.0, which is CreativeCommons BY-NC-SA 3.0".
- UDPipe: "Universal Dependencies 2.17 Models are distributed under the CC BY-NC-SA licence."
- Stanza code LICENSE: "Licensed under the Apache License, Version 2.0". The Hugging Face card for `stanza-ar` says apache-2.0, but the training data is non-commercial.

**Licence interactions to remember**
- GPL v2-only (calima-msa-r13) and GPL-3 (AlKhalil data) cannot be merged into one distributed work or published dataset. Running both on our server is fine.
- A bulk export of the AlKhalil lexicon (for example a root → lemma → wazn table) would be GPL-3 data.

**Evaluation sources**
- Checked against the original text:
  - JLCL 32(1) 2017 (Alosaimy & Atwell; Hamed & Zesch), PDF text extracted.
  - QAMAR tables, from the paper's LaTeX source.
  - JOHD 2026 numbers, from the article page.
- Taken from WebFetch or search summaries:
  - DSH 2019 (fiqh roots).
  - Fadel 2019 (Mishkal).
  - Alma's F1 scores.
  - Saeed & Habash 2025.

#### Recommended analyser architecture

**Two paths**
- If the input is Quran text (matched after normalisation): serve the curated QAC layer as the reference analysis, and show farahidi's other candidates as "other analyses".
- Otherwise:
  1. Normalise with our own code or pyarabic, keeping any diacritics as constraints.
  2. Generate all candidates with farahidi, run as a separate Python service on our server.
  3. Drop candidates whose diacritised form conflicts with the input.
  4. Optionally add CAMeL Tools with Camel Morph MSA as a second generator, for POS, clitics and a second root opinion. Use it only after a root-convention mapping and a pilot on QAC.

**Confidence**
- Re-score candidates with a log-linear model (softmax over each word's candidate set). Features:
  - log farahidi `priority`;
  - whether farahidi's in-context step picked this lemma;
  - smoothed QAC prior P(root, lemma | normalised form) (Al Mus'haf too, if permission comes);
  - CAMeL log-probability, when the candidate matches;
  - whether the two generators agree on the root;
  - number of clitics;
  - proper-noun and function-word flags.
- Train with surah-level cross-validation so Quran priors do not leak into the test set. Calibrate the probabilities on held-out surahs and report the calibration error.
- Calibrate separately on a hand-labelled hadith/classical sample (about 1–2k tokens). Quran calibration will not transfer to other text.

**Display**
- Ranked candidates with a percentage and a band: high ≥ 0.9, medium 0.6–0.9, low < 0.6.
- Mark "disputed" when the top two candidates are close or QAC disagrees.
- When nothing analyses a word (6.2% in our pilot), say "no analysis". The only fallback is a Tashaphyne root guess, clearly labelled as a guess.
- No LLM-generated analyses. At most, an LLM may explain candidates we already produced.

**Licence hygiene**
- GPL tools run only on our server.
- Do not ship farahidi-js to browsers unless you accept GPL-3 for that bundle.
- Credit AlKhalil, and Camel Morph (CC BY 4.0) if used.
- Keep QAC-derived frequency tables internal.

**Before building, measure**
- farahidi's RAM and latency (not documented).
- Top-1 root, top-k root recall and calibration error on held-out QAC.
- Lemma accuracy on QuranMorph.
- The same metrics on the hadith sample.

#### Questions for you

1. Will the analyser ever run in the browser or in an offline app? That counts as distributing GPL code, so that bundle would have to be GPL-3.
2. Should I ask the Oujda NLP Team for a written licence to the Al Mus'haf corpus? It is the only Quran dataset with wazn that matches AlKhalil's format. Should I also ask the QAMAR authors about terms once it is released?
3. The open QAC decision also covers using QAC frequencies as ranking priors. Should those stay strictly internal?
4. Will you fund hand-labelling 1–2k hadith/classical tokens? Without it, confidence on non-Quran text cannot be calibrated.
5. Should the server carry the CAMeL stack (torch, roughly 0.5–2 GB) for a second opinion, or stay on farahidi alone (11.5 MB)?
6. Do you accept the MIT/GPL release terms of CAMeL's models at face value, given they were trained on LDC Treebank data, or do you want a legal view?
7. We need a root-convention policy before analysers can be merged or compared: hamza seat, weak radicals, quadriliteral roots, foreign proper nouns, and the الله convention.

#### Flagged outside the task
- The SinaTools morphology data URL is down (404) as of today.
- CAMeL's `light` bundle lists the LDC-licensed SAMA database even though it cannot be used without SAMA.
- The QAMAR paper shows QAC's root layer at 84.57% agreement under its own conventions. The examples it lists (شيء, سوء) are hamza-representation choices, which supports the need for a root-convention policy.

#### Pending
- Owner: questions 1–7 above, and the permission requests to Oujda and QAMAR.
- Next agent: the farahidi resource benchmark and a calima-msa-r13 vs Camel Morph root pilot on QAC. Both need packages installed, which I was not allowed to do.

---

## Part 11 — Pronunciation audio for dictionary headwords

### Pronunciation audio for vocalised Arabic dictionary forms: candidates, licences and recommendation

No source tested here can be trusted to follow input tashkil without checking. No open recording set covers tens of thousands of fully vocalised forms. The workable plan is to pre-generate audio with a commercially licensed TTS engine, feed it phonemes rather than tashkil, and check every file by re-transcribing it.

- **Commercial engine, first choice:** Azure, paid tier, an ar-SA voice. Its Product Terms grant commercial use of the output, and it publishes an Arabic IPA phone set. Whether it actually accepts Arabic IPA is untested.
- **Commercial engine, second choice:** Amazon Polly's Zeina voice. Amazon claims it honours vocalised input, it has an Arabic IPA/X-SAMPA table, and its FAQ allows stored prompts to be replayed.
- **Self-hosted option:** Nabra-82M (Apache-2.0). It expects diacritised input and phonemises it with espeak-ng, but its training data is not disclosed.

Nothing was synthesised or listened to: running engines needs accounts, which I was not allowed to create. Every "follows tashkil" verdict below is therefore documented behaviour, vendor claim or a tokenizer inspection, not a listening test.

#### (a) Licensed human recordings

| Candidate | Coverage (computed) | Vocalised? | Licence | Commercial / store / redistribute | Verdict |
|---|---|---|---|---|---|
| Lingua Libre ara (Commons) | 13,765 files, 48 speakers, 11,726 distinct titles, 6,611 multi-word | 2,341 titles carry harakat; 1,865 single words are fully vocalised (1,724 distinct forms) | CC BY-SA 4.0 ≈7,068, CC BY-SA 3.0 ≈3,893, CC0 ≈2,344, CC BY 4.0 ≈460 (estimated from one file per speaker) | Yes, with per-file attribution; trimmed or transcoded files stay BY-SA | Cross-check, or a small human supplement |
| Wiktionary Arabic audio | 727 en.wiktionary entries with audio; files hosted on Commons | Filenames mostly unvocalised (e.g. File:Ar-أرز.ogg) | Per file (CC BY-SA / CC BY / CC0) | Yes, with attribution | Cross-check |
| Forvo API | Count not retrieved; site is Cloudflare-blocked | Unknown | Non-commercial plan is BY-NC-SA; commercial plan $28.95/month | Caching forbidden; links expire after 2 h | Avoid |
| Common Voice Arabic 27.0 | 136,832 clips, 158.27 h (93.34 h validated), 1,679 speakers | Sentences, not words | CC0-1.0 | Data Collective terms forbid re-hosting the dataset | Avoid for headwords |
| Shtooka | No Arabic collection; Commons "Category:Shtooka Arabic" does not exist | — | — | — | Not applicable |
| Arabic Speech Corpus (Halabi) | 1,813 studio utterances, one speaker | Buckwalter text plus phoneme TextGrids | CC BY 4.0 | Yes | Use only as training data; Damascene accent |
| ClArTTS (MBZUAI) | About 12 h, one male speaker, 9,500 train / 205 test | Text is diacritised; the related ArTST card says that model was trained without diacritics | CC BY 4.0 (HF YAML) | Yes | Use only as training data |
| ArVoice (MBZUAI) | 83.5 h, 11 voices | Parts 1 and 3 fully diacritised | ASC and synthetic parts CC BY 4.0; studio part research-only under a data agreement | Partly | Cross-check |
| Quranic word-audio datasets on HF (quranhive, dev-ahmedhany "Alafasy", Buraaq) | About 77.4k word files | Uthmani text | CC BY 4.0 / CC0 / none, stated by the uploaders | Uploader says sourced from audio.qurancdn.com and surahpedia, which publish no licence; this is licence laundering | Avoid |

Notes:

- **Lingua Libre count:** categoryinfo `files: 13765`, and the full member list matched. Dialect-coded categories exist separately: apc 961, ary 1,857, arz 995, arq 623, apd 31, shu 47. So "ara" is meant as Standard Arabic, but speaker accents are unverified.
- **Lingua Libre top speakers:** Zinou2go 3,893; Shahjina 2,054; Spotless Mind1988 1,756; Raghda (Akbarali) 1,692; Fjmustak 936.
- **Who recorded the vocalised forms:** Zinou2go 1,241, Spotless Mind1988 488, Zakaria Mimouni 93, XANA000 24, others 19.
- **Endings of the 1,865 vocalised forms:** final short vowel 990, no mark on last letter 648, shadda 124, sukun (pausal) 99, tanwin 4. Most were recorded with the case vowel, not in pausal form.
- **Licence wording, from Commons API extmetadata:** "UsageTerms: Creative Commons Attribution-Share Alike 4.0 | AttributionRequired: true". Example: https://commons.wikimedia.org/wiki/File:LL-Q13955_(ara)-Spotless_Mind1988-%D9%8A%D9%8E%D9%85%D9%8E%D9%91%D9%86%D9%8E.wav
- **Forvo, verbatim** (https://api.forvo.com/documentation/general-information/): "It is not allowed to cache audio pronunciations."
- Forvo: "When you generate an audio link using Forvo API it's valid during the next 2 hours."
- Forvo: "A 'request' is also counted for every play of an audio file from your application to Forvo."
- Forvo: "Attribution, non-commercial and share-alike, except for the commercial plans."
- forvo.com/license returned 403, so the recording licence itself is unverified.
- **Common Voice** (https://mozilladatacollective.com/datasets/cmu5wom3z00ceo107guxtg4xa): "It is forbidden to re-host or re-share this dataset."
- **Arabic Speech Corpus** (http://en.arabicspeechcorpus.com/): "Arabic Speech Corpus by Nawar Halabi is licensed under a Creative Commons Attribution 4.0 International License". The site gives the dialect as "South Levantine Arabic (Damascian accent)".
- **ClArTTS** (https://huggingface.co/datasets/MBZUAI/ClArTTS): `license: cc-by-4.0`. Card: "The speech is extracted from a LibriVox audiobook ... about 12 hours of speech from a single male speaker".

#### (b) Open-source TTS

| Candidate | Takes tashkil and follows it? | Weights / code licence | Commercial OK? | Footprint | Quality evidence | Verdict |
|---|---|---|---|---|---|---|
| eSpeak NG ar | Yes, by rule: docs say "Only fully diacritized Arabic." | GPL-3.0 | Program is GPL; audio output generally not covered (unverified legal reading) | Tiny, CPU | Robotic formant voice | Use only as a reference phonemiser (G2P) for QA |
| MBROLA ar1/ar2 | Phoneme input, needs a front end | Voice licence below | Not in any product that is sold without permission | Tiny | Diphone, robotic | Avoid |
| Festival Arabic HTS (linuxscout) | Untested | GPL (search snippet); trained on ASC | Unclear | Small | None found | Avoid |
| Mishkal | Diacritiser only, irrelevant for vocalised input | GPL-3.0 | — | — | — | Not needed (CATT Apache-2.0 / camel-tools MIT exist if ever needed) |
| tts-arabic-pytorch (nipponjo) | Yes, by design: Halabi Arabic-Phonetiser; accepts Buckwalter directly | No LICENSE file found; weights on Google Drive with no licence | No, without the author's permission | Small FastPitch + HiFi-GAN | No MOS published | Cross-check / prototype only |
| Klaam (ARBML) | Built on ASC Buckwalter | MIT code; README TTS weights link is empty | Unclear | — | — | Avoid |
| Piper ar_JO-kareem | Yes, by rule (espeak 'ar' phonemes) | Repo MIT, but MODEL_CARD says "License: See URL" and that repo has no licence | Unknown | About 60 MB ONNX (unverified), CPU | Jordanian voice, fine-tuned from an English voice | Avoid for production |
| MMS-TTS ara (Meta) | **No.** vocab.json has 39 symbols and no harakat, so tashkil cannot reach the model | CC-BY-NC-4.0 | No | Small | — | Avoid |
| ArTST / speecht5_tts_clartts_ar | No: "ArTST is trained without diacritics." | CC-BY-NC-4.0 | No | Small | — | Avoid |
| XTTS-v2 (Coqui) | Tokenizer has all harakat; adherence untested | CPML (non-commercial) | No; Coqui is gone (coqui.ai/cpml returns 404) | About 1.9 GB, GPU | — | Avoid |
| Chatterbox Multilingual (Resemble) | Tokenizer has all 9 marks; no Arabic-specific normalisation in code; adherence untested | MIT | Yes; every output carries a PerTh watermark | t3 file about 2.1 GB, GPU | None Arabic-specific | Cross-check |
| F5-TTS base | — | CC-BY-NC-4.0 (Emilia data) | No | — | — | Avoid |
| Habibi-TTS (SWivid) | MSA model's vocab lacks shadda and tanwin (verified); designed "without text diacritization" | MSA model says Apache-2.0 but its base is F5-TTS (CC-BY-NC) | Conflicting provenance | 1.35 GB per checkpoint | MSA WER 7.83 (unified) vs ElevenLabs v3 6.77 | Avoid |
| Arabic-TTS-Spark (IbrahimSalah) | Yes, documented: trained only on fully diacritised text | fair-noncommercial-research | No | 2.9 GB, GPU | 300 h MSA (claimed) | Cross-check only (non-commercial) |
| Nabra-82M (oddadmix) | Yes: expects tashkil, then espeak-ng to IPA | Apache-2.0 | Yes on paper; training data undisclosed | 327 MB, CPU (RTF under 1 claimed) | None published | Use-candidate: bake-off plus provenance question to the author |
| NVIDIA Magpie TTS multilingual 357M (v2607) | Untested; IPA injection documented only "in supported languages like English" | NVIDIA Open Model License | Yes | 1.47 GB .nemo | Arabic CER 1.62% on its card; voices are English speakers | Cross-check |
| Audar-TTS V1 Flash/Turbo | Untested: "no phonemizer and no per-language G2P" | AudarAI Open Licence v1.0 | Yes | 2.7 / 4.0 GB | Gulf strength claimed | Cross-check |
| VoxCPM2 / MOSS-TTS v1.5 / Supertonic-3 | Untested; Arabic listed | Apache-2.0 / Apache-2.0 / OpenRAIL-M | Yes | 4.96 GB / 17 GB / 0.41 GB | None Arabic-specific | Cross-check, low priority |
| Fish-Speech 1.5, S1-mini, S2-pro; OmniVoice; Voxtral TTS; Higgs TTS 3 | — | CC-BY-NC-SA / Fish research licence / CC-BY-NC / CC BY-NC / research-only | No | — | — | Avoid |
| Kokoro-82M; Qwen3-TTS | No Arabic | Apache-2.0 | — | — | — | Not applicable |

Verbatim quotes:

- **eSpeak NG** (https://raw.githubusercontent.com/espeak-ng/espeak-ng/master/docs/languages.md): "[7] Only fully diacritized Arabic."
- **MBROLA ar1** (https://raw.githubusercontent.com/numediart/MBROLA-voices/master/data/ar1/license.txt): "this database may not be sold or incorporated into any product which is sold without prior permission from the Diphone Database Owner". The ar2 licence has the same wording, with SEDCO, Jordan as owner.
- **tts-arabic-pytorch** (https://raw.githubusercontent.com/nipponjo/tts-arabic-pytorch/master/README.md): "By default, Arabic letters are converted using the Buckwalter transliteration, which can also be used directly."
- Same README: "The Tacotron2 model can sometimes struggle to pronounce the last phoneme of a sentence when it ends in an unvocalized consonant." This is exactly the pausal-headword case.
- **Piper kareem** (https://huggingface.co/rhasspy/piper-voices/raw/main/ar/ar_JO/kareem/medium/MODEL_CARD): "License: See URL" and "Finetuned from U.S English lessac voice (medium quality)."
- **MMS** (https://huggingface.co/api/models/facebook/mms-tts-ara, card): "The model is licensed as **CC-BY-NC 4.0**." The vocab.json has no code points U+064B–U+0652.
- **ArTST** (https://huggingface.co/MBZUAI/speecht5_tts_clartts_ar): "# ArTST is trained without diacritics."
- **XTTS CPML** (https://huggingface.co/coqui/XTTS-v2/raw/main/LICENSE.txt): "This license allows only non-commercial use of a machine learning model and its outputs."
- **Chatterbox** (https://huggingface.co/ResembleAI/chatterbox): "Every audio file generated by Chatterbox includes [Resemble AI's Perth (Perceptual Threshold) Watermarker]"; licence: mit.
- **Habibi** (https://huggingface.co/SWivid/Habibi-TTS): "The unified, SAU, and UAE models are licensed under CC-BY-NC-SA-4.0 ... All the rest (ALG, EGY, IRQ, MAR, MSA) are released under Apache 2.0 license." Yet `base_model: SWivid/F5-TTS`, whose licence is cc-by-nc-4.0.
- **Spark** (https://huggingface.co/IbrahimSalah/Arabic-TTS-Spark): "Text must include full Arabic diacritization (tashkeel). The model is trained exclusively on fully diacritized text".
- Spark licence: "Commercial use is strictly prohibited without explicit permission."
- **Nabra** (https://huggingface.co/oddadmix/Nabra-82M-v0.1): "Nabra expects diacritized (tashkeel'd) input."
- Nabra licence: "Released under **Apache-2.0**, following Kokoro-82M (Apache-2.0) and StyleTTS2 (MIT)." No training dataset is named.
- **Magpie** (https://huggingface.co/nvidia/magpie_tts_multilingual_357m): "This model is ready for commercial use."
- NVIDIA Open Model License (https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license): "NVIDIA does not claim ownership to any outputs generated using the Models or Derivative Models."
- **Audar** licence (https://www.audarai.com/license/audarai-open-license-v1.0/): "No revenue cap, user cap, field-of-use restriction, royalty, or reporting obligation applies under this License."
- **Supertonic-3** LICENSE (OpenRAIL-M): "Except as set forth herein, Licensor claims no rights in the Output You generate using the Model."
- **Fish** (https://raw.githubusercontent.com/fishaudio/fish-speech/main/LICENSE): "Any use of the Fish Audio Materials or Derivative Works for a Commercial Purpose requires a separate written license agreement from Fish Audio."
- **OmniVoice** card: "The pre-trained model is licensed under the CC-BY-NC due to constraints from its training data (e.g., Emilia)."
- **Voxtral TTS** card: "These voices are licensed under CC BY-NC 4, which is the license that the model inherits."
- **Higgs TTS 3** card: "Production, hosted APIs, embedding in a product/service, or reselling the model requires a separate commercial license."
- **Tokenizer checks** (vocab files downloaded and inspected):
  - Chatterbox mtl_tokenizer and XTTS vocab.json contain all 9 marks (tanwin ×3, fatha, damma, kasra, shadda, sukun, dagger alif).
  - Habibi Unified vocab has all 9.
  - Habibi MSA vocab is missing shadda, all tanwin and dagger alif.

#### (c) Commercial TTS

| Service | Arabic voices | Follows tashkil? | Phoneme input for Arabic | Output rights / storage | Price (computed cost) | Verdict |
|---|---|---|---|---|---|---|
| Azure AI Speech | ar-SA Hamed/Zariyah, ar-EG and other ar-* locales | Not documented; a 2020 user report says no; a 2024 blog improved its built-in diacritiser | IPA phone set published for ar-EG/ar-SA; acceptance untested | Paid tier: commercial use of output granted; no-compete clause; must disclose synthetic voice | Neural $15 / 1M chars, HD $22 (retail price API, eastus); about $12 for 100k forms | Use (first choice) after bake-off |
| Amazon Polly | Zeina (arb, MSA, standard engine only); Hala/Zayd (ar-AE Gulf, neural) | Claimed: "If a customer provides vocalized input, Zeina generates the corresponding audio as well." | IPA/X-SAMPA table for Zeina | FAQ allows replaying static prompts; output belongs to the customer | Standard $4 / 1M, neural $16 / 1M; about $3 for 100k forms | Use (second choice) |
| Google Cloud TTS | ar-XA "Arabic (Generic)", Chirp 3 HD (GA), WaveNet, Standard | Untested | Chirp 3 HD custom pronunciations (IPA/X-SAMPA) are not excluded for ar-XA, but the feature is Preview; no Arabic phone table in the phonemes doc | Customer retains IP in Customer Data, which includes derived data; no TTS-specific terms found | Chirp 3 HD $30 / 1M, WaveNet $4, Neural2 $16; about $24 for 100k forms | Cross-check |
| ElevenLabs | Arabic in v3/v4 and Multilingual v2 | Unverified (only blog claims) | IPA dictionaries for v3/v4/flash_v2 (search snippet, unverified) | Paid plans commercial; free plan non-commercial; you retain rights in output | Pay-as-you-go $0.08 / 1K chars (v3); about $63 for 100k forms | Cross-check |
| OpenAI TTS | Arabic is listed; voices "optimized for English" | Untested | None documented | Customer owns output; must tell users the voice is AI | tts-1-hd $30 / 1M | Avoid (no pronunciation control) |
| Acapela | Arabic voices | Untested | — | Standard licence excludes redistribution and broadcast | Quote only | Avoid unless negotiated |
| ReadSpeaker | 4 Arabic voices (Amir, Laila, Sami, Yasmin) | Untested | — | Storage forbidden unless in the order | Quote only | Avoid unless negotiated |
| Narakeet | Not counted | Untested (engine not disclosed) | — | Commercial account: no restrictions, no further payments | Plans | Low priority |
| Nuance/Cerence (Laila/Maged/Tarik) | 3 voices | Untested | — | Reseller says the retail EULA is personal use only | — | Avoid |

Cost basis: a mean of 7.9 characters per vocalised form, measured on the 1,865 Lingua Libre forms as a proxy, times 100,000 forms, gives about 0.79M characters. Whether SSML markup is billed is unverified. Cost is not the constraint; licence and accuracy are.

Verbatim quotes:

- **Azure Product Terms** (https://www.microsoft.com/licensing/terms/en-US/productoffering/MicrosoftAzure/allprograms): "TTS Service output use rights : For Customers of the paid tier TTS Service only, Customer may use the audio output of prebuilt neural voices generated using the TTS Service, including for commercial purposes."
- Same terms: "Customer will not use and will not allow third parties to use Foundry Tools or data from Foundry Tools to create, train, or improve (directly or indirectly) a similar or competing product or service."
- Azure Code of Conduct (https://learn.microsoft.com/en-us/legal/ai-code-of-conduct): "Disclose when the output, decisions, or actions are generated by AI, including the synthetic nature of generated voices".
- Azure diacritics blog, Dec 2024 (https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/azure-ai-voices-in-arabic-improved-pronunciation/4360306): "The diacritic task involves predicting the diacritic for each Arabic character in the written form ... This approach reduced word-level pronunciation errors by 78%." It never says user-supplied tashkil is kept.
- Azure user report, 2020 (https://learn.microsoft.com/en-us/answers/questions/210674/): "The output audio does not stick to the diacritics added on the words and pronounce the word with different diacritics." Microsoft's reply: "We are checking with our team internally". No resolution was posted.
- Azure SSML doc (https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-pronunciation): "If the specified string contains unrecognized phones, text to speech service will return http 400 error for invalid SSML." The phonetic-sets page has an "ar-EG/ar-SA" IPA table including dˤ tˤ sˤ ðˤ ħ ʕ.
- **Polly** blog, 2019 (https://aws.amazon.com/blogs/machine-learning/amazon-polly-adds-arabic-language-support/): "If a customer provides vocalized input, Zeina generates the corresponding audio as well."
- Same blog: "Zeina follows the MSA pronunciation".
- Polly FAQ (https://aws.amazon.com/polly/faqs/): "Can I use the service for generating static voice prompts that will be replayed multiple times? Yes, you can. The service does not restrict this and there are no additional costs for doing so."
- Polly FAQ: "As between you and AWS, your Polly output belongs to you."
- **Google Cloud Terms** (https://cloud.google.com/terms): "As between the parties, Customer retains all Intellectual Property Rights in Customer Data".
- Google definition: "Customer Data" includes "data that Customer or End Users derive from that data through their use of the Services".
- Google Chirp 3 HD (https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd): "You can specify custom pronunciations using IPA or X-SAMPA phonetic representations".
- Google Chirp 3 HD: "Custom pronunciations is available across all locales except: bg-bg, bn-in, cs-cz ..." (ar-XA is not in the list).
- **ElevenLabs** terms, updated 31 March 2026 (https://elevenlabs.io/terms-of-use): "if you access or use our Services free of charge ... you may only use the Services for non-commercial purposes".
- ElevenLabs terms: "as between you and ElevenLabs, you retain all rights in and to your Output."
- **OpenAI** (https://developers.openai.com/api/docs/guides/text-to-speech): "provide a clear disclosure to end users that the TTS voice they are hearing is AI-generated and not a human voice."
- OpenAI ownership comes from a search snippet of the Services Agreement, because openai.com pages return 403: "Customer retains all ownership rights in Input and owns all Output."
- **Acapela** (https://www.acapela-group.com/acapela-tts-voices-software-license-agreement-google-play/): "does not include the right to replicate sound files ... for the purpose of reselling or re-distributing on a media ... or via downloads; nor to broadcast or do public performance."
- **ReadSpeaker** (https://www.readspeaker.com/solutions/text-to-speech-online/readspeaker-speechcloud-api/): "Audio data must not be stored, reused or redistributed unless explicitly agreed in the order confirmation."
- **Narakeet** (https://www.narakeet.com/docs/usage-rights-copyright/): "There are no additional payments required for continual usage of the materials you create."

#### (d) Quality realities and controls

**Published quality evidence:**

| Source | Finding |
|---|---|
| Habibi paper, MSA, undiacritised input (arXiv 2601.13802, Table 5) | WER-O / WER-S: ElevenLabs v3 6.77 / 7.54; Habibi Unified 7.83 / 8.56; Habibi Specialized 10.37 / 10.91 |
| Same paper, MOS | Naturalness: ElevenLabs 4.20, Habibi 4.04. Dialect accuracy: Habibi 4.24, ElevenLabs 4.12 |
| ArVoice (arXiv 2505.20506) | VITS WER 20.67% with diacritics vs 35.69% without |
| Magpie TTS card | Arabic CER 1.62% |
| Azure blog (vendor claim) | 78% fewer word-level pronunciation errors; +1.49% / +3.88% word accuracy vs two unnamed providers |

None of these test isolated, fully vocalised headwords.

**Pausal form (waqf).** Wikipedia (https://en.wikipedia.org/wiki/Pausal_form): "In Arabic, short vowels, including those carrying case, are dropped before a pausa". The same page says ة "is classically pronounced [h] in pausa but [t] in liaison". A headword whose tashkil carries a case vowel or tanwin (e.g. «مَرْحَمَةٌ») needs a derived spoken form (مَرْحَمَهْ) before synthesis. Otherwise engines either read the iʿrāb or improvise.

**Final consonant at end of utterance.** Tacotron-class models drop or mangle it (quote above). Pausal words end on exactly such a consonant, so check by trimming silence and looking for truncation.

**Shadda and tanwin.** These are lost in some models: MMS has no harakat in its vocabulary; Habibi MSA has no shadda or tanwin. In pausal output tanwin mostly disappears (‑an becomes ‑ā), which removes one failure class.

**Hamzat al-wasl.** Wikipedia (https://en.wikipedia.org/wiki/Hamza): "It is not pronounced following a vowel". In isolation the word starts the utterance, so the prothetic vowel must be spoken. Write it explicitly in the spoken form (اِنْصَرَفَ, اُكْتُبْ, اَلْ‑) rather than relying on the engine.

**Phoneme input (IPA/Buckwalter).**
- Azure: IPA for ar-EG/ar-SA is documented; acceptance is untested.
- Polly: IPA/X-SAMPA for Zeina is documented.
- Google: IPA/X-SAMPA custom pronunciations on Chirp 3 HD; Arabic phone set undocumented.
- ElevenLabs: IPA dictionary on v3/v4 (unverified).
- tts-arabic-pytorch: Buckwalter natively.
- Nabra and Piper: espeak-ng IPA internally.

**QA by re-transcription.**
- NAMAA-Space/Cohere-Speech-Tashkeel-2B (Apache-2.0) turns speech into fully diacritised text. Its card reports DER 6.62% with case endings, 5.67% without, and letter WER 10.13% on 260 held-out clips. Its base model is gated on Hugging Face.
- tarteel-ai/whisper-base-ar-quran (Apache-2.0) outputs diacritised text but is biased towards Qur'anic text.
- Neither has been validated on isolated words.

#### Recommended approach

1. **Store two fields per form:** the source tashkil (displayed unchanged) and a derived spoken form. Derive the spoken form with a small, unit-tested rule module:
   - drop the final short vowel and the tanwin of damma/kasra;
   - tanwin fatha becomes ā;
   - ة becomes هْ;
   - keep a final shadda as a held geminate;
   - make the hamzat al-wasl vowel explicit;
   - keep long vowels and alif maqsura.
2. **Convert the spoken form to IPA with your own rules.** Cross-check every word against espeak-ng 'ar' output and log mismatches. Send IPA to the engine (Azure `<phoneme alphabet="ipa">`, Polly `<phoneme>`, Google `custom_pronunciations`) so its internal diacritiser is bypassed.
3. **Run a bake-off before committing.**
   - Build a 300–500 word gold set stratified by shadda, pausal tā' marbūṭa, hamzat al-wasl, sun/moon lām, emphatics, long vowels, alif maqsura, and minimal pairs (عَلِمَ / عُلِّمَ, رُحْم / رَحِم).
   - Engines: Azure (text vs IPA), Polly Zeina (text vs IPA), Google Chirp 3 HD (text vs custom pronunciation), ElevenLabs v3, Nabra, Chatterbox, Magpie.
   - Score with the tashkeel ASR plus two blind native fusha reviewers.
   - Leave non-commercial models out entirely, even as references, so nothing has to be regenerated when the site goes commercial.
4. **Production gate.**
   - Batch-generate.
   - Auto-accept when the tashkeel-ASR output matches the spoken form exactly.
   - Send the rest to human review, plus a random sample of passes (rate is your call).
   - Store files content-addressed, keyed on a hash of the NFC spoken form, engine, voice and version, as Opus or MP3 on the CDN.
   - Keep a manifest recording engine, voice, date, licence and QA scores, so a fix only regenerates the affected forms.
5. **Licensing hygiene.**
   - Azure must run on a paid tier; the free tier is excluded from output rights.
   - Show an "AI-generated voice" notice (Microsoft and OpenAI both require one).
   - If any Lingua Libre files are used, keep per-file speaker, licence and link, and keep trimmed or transcoded copies under BY-SA. Only use them when the recorded vowels exactly match the spoken form and a reviewer has heard them.

#### Open questions for you

1. **Pausal or as written?** Should every headword be voiced in pausal form even when its tashkil shows a final vowel? For example «رَحِمَ» as raḥim or raḥima, «رَحْمَةٌ» as raḥmah. Same rule for verbs and nouns?
2. **Voices:** one voice or two (male and female)? A Saudi-accented ar-SA voice is the likely fusha choice on Azure.
3. **Disclosure:** is a visible "AI-generated voice" note acceptable on the site?
4. **Human review:** what budget for a native fusha reviewer? Do you want commissioned human recordings, with an assignment of rights, for the top N headwords?
5. **Mixing sources:** should the few human Lingua Libre recordings (various accents, CC BY-SA) sit next to TTS audio, or keep one consistent voice?
6. **Accounts:** the bake-off needs Azure, AWS and Google Cloud accounts, which I was not permitted to create.

#### Unknowns

- No engine's real tashkil adherence or Arabic IPA acceptance has been tested.
- Nabra's training data is undisclosed.
- No licence exists for tts-arabic-pytorch or for the Piper kareem dataset.
- Accents of the Lingua Libre speakers are unknown.
- The Forvo recording licence and the full OpenAI terms pages were blocked.
- Whether Azure or Google bill SSML markup characters is unverified.
- ElevenLabs IPA support for Arabic is unverified.

#### Pending

- **You:** answers to the open questions; creating the cloud accounts.
- **Main agent:** bake-off design and the pausal/IPA rule module, once you have answered.
