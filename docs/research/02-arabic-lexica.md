# 02 — Classical Arabic lexica for the Quran-roots site

Status: research complete for the sources listed below; nothing has been imported into an app database. Date: 2026-10-02. Raw downloads live under `data/raw/lexica/` (1.8 GB, see the appendix).

## 1. Outcome in one screen

- Every target work exists in at least one open digitization, but **no single source is both root-segmented and licensed for commercial redistribution**, except Lane's Lexicon (Perseus XML, CC BY-SA 3.0 US).
- The classical texts themselves are public domain. What carries rights is (1) the **modern critical edition** behind each digitization (editor footnotes, introductions, and in some jurisdictions the established text), and (2) the **digitization project's licence** (OpenITI and islamlab are CC BY-NC-SA 4.0, m3ajim is CC BY-NC 4.0).
- Best text source for the Arabic works: the **Shamela 4 extraction on Hugging Face (`AuthenticIlm/Shamela4_Full_DB`)**. It carries the printed edition's bibliographic card for every book, printed page numbers, and keeps editor footnotes in a separate field, so they can be dropped. Root segmentation is already in the table of contents for al-Mufradat, Maqayis, al-Sihah, Taj al-Arus, Asas and al-Gharibayn; Lisan, al-Qamus, Tahdhib, al-Ayn, al-Muhkam and Mujmal are chapter-level only and need our own article splitter.
- Root coverage against the 1,642 Quranic Arabic Corpus roots (strict tier → loose tier, best root-segmented source): Taj 99.3% → 99.8%, Lisan 98.7–99.0% → 99.3–99.8%, Lane 98.9% → 99.4%, al-Sihah 97.7–98.4% → 98.8–99.1%, Maqayis 92.0% → 97.2%, al-Mufradat 91.8–91.9% → 94.9% (97.5% of Quranic root occurrences). The five root-keyed works in the launch set together cover 1,641 of 1,642 roots strict and all 1,642 loose — see §4.
- Recommended launch set: al-Mufradat, Maqayis al-Lugha, Lisan al-Arab, al-Sihah, Lane (English), plus Ibn Qutaybah's Gharib al-Quran as a verse-level classical gloss. The Arabic works launch **display-only** (public-domain author text, editor apparatus removed, edition cited). Lane is the only one cleared for **public API and bulk redistribution, including commercial use** (with ShareAlike). Details and attribution strings in §7.
- Per-word Arabic meanings (معاني الكلمات): no open dataset is both complete and clearly licensed. Named gharib books cover 11–23% of Quranic words each (KFGQPC al-Muyassar fi Gharib al-Quran 23.3%, al-Siraj 10.9%, Ibn Qutaybah 13.4%; all four named books together 33.6%); only the Tafsir Center `quran.db` covers every word (CC BY 4.0 on its licence file, contradicted by its own usage note, and half its rows are grammar templates). The word layer needs written permission before launch — see §5.12 and §7.5.

## 2. Method

- Reference root list: the **Quranic Arabic Corpus v0.4** morphology file (Buckwalter `ROOT:` fields), mirror at `github.com/cltk/arabic_morphology_quranic-corpus` (file header: "Copyright (C) 2011 Kais Dukes / License: GNU General Public License"). It yields **1,642 distinct roots** over **49,968 root-bearing segments** (1,602 triliteral + 40 quadriliteral). Hamza is a distinct radical there (`A` = ء), weak radicals are `w`/`y`, geminates are written in full (`rbb`).
- Secondary list: the project CSV `Example Data/Quran DB - Clean Roots.csv`, column `Root_Letters`. It has **1,799 distinct root strings**; 1,761 of them have 3–4 letters, and of those **1,604** match a QAC root once hamza is folded to ا. The other **157 are pseudo-roots** (particles, pronouns, proper names, e.g. `ا ن ن` on 1,878 words, `ع ل ي` on 1,445, `ا ل ل ذ` on 1,384), carried by 11,815 of the 77,431 word rows. The CSV also never writes hamza (it uses ا), so `ق ر ا` stands for قرأ. CSV percentages below are therefore lower than QAC percentages by construction; QAC is the primary metric.
- Key normalization applied identically to every dataset: strip tashkeel, tatweel and non-letters; fold أ إ ؤ ئ ء ٱ آ to ء; ى → ي; ة → ه.
- Matching tiers (code: scratchpad `lexcommon.py`, reproduced in §9):
  - **Strict**: exact consonant match, plus purely orthographic variants — hamza written as bare ا, a weak radical written as ا (Lisan/Sihah keys like سما, قال), geminate CYY keyed as CY (Maqayis keys رب for ربب), reduplicated quadriliteral ABAB filed under ABB (زلزل under زلل, the classical convention).
  - **Loose**: additionally lets any of ء ا و ي stand for a weak/hamza radical (رضو ↔ رضي, دنو ↔ دنى; Ibn Faris files قرأ under قرى) and accepts the two-letter key of defective nouns (يد, أخ, أب, دم). Loose is an upper bound; it can create false positives such as قول ↔ قيل.
  - Self-tests in the script assert known positives (سمو→سما, ربب→رب, زلزل→زلل, ءمن→امن) and known negatives (رضي is not strict for رضو; رحم does not match رخم) before any number is printed; the run printed all rows, so the asserts passed.
- "By occurrences" = share of the 49,968 QAC root-bearing segments whose root has an entry; it weights roots by how often a reader will click them.
- Text-fidelity checks: entry-length ratios and token overlap between parallel digitizations of the same work, plus manual reads of the رحم and كتب articles in every source.

## 3. Coverage table (QAC 1,642 roots)

Keys = distinct normalized keys the dataset exposes. Rows marked chapter-level are not segmented by root, so their near-zero numbers mean "not usable for root lookup without our own splitter", not "the work lacks the root".

| Work | Source | Keys | Strict | Loose | By occurrences | CSV 3–4-letter (n=1,761) |
|---|---|---|---|---|---|---|
| al-Mufradat (al-Raghib) | Shamela4 TOC | 1,624 | 1,508 = 91.8% | 1,558 = 94.9% | 97.5% | 88.5% |
| al-Mufradat | wizsk sqlite | 1,627 | 1,509 = 91.9% | 1,558 = 94.9% | 97.5% | 88.6% |
| al-Mufradat | OpenITI Shamela0023636 headers | 1,614 | 1,496 = 91.1% | 1,545 = 94.1% | 96.1% | 87.7% |
| al-Mufradat | MohamedRashad (Hawramani scrape) | 1,606 | 1,492 = 90.9% | 1,545 = 94.1% | 93.7% | 87.7% |
| Maqayis al-Lugha | Shamela4 TOC | 4,752 | 1,511 = 92.0% | 1,596 = 97.2% | 97.0% | 89.8% |
| Maqayis al-Lugha | islamlab | 4,791 | 1,511 = 92.0% | 1,596 = 97.2% | 97.0% | 89.8% |
| Maqayis al-Lugha | OpenITI Shamela0021710 headers | 4,760 | 1,509 = 91.9% | 1,596 = 97.2% | 97.0% | 89.6% |
| Maqayis al-Lugha | wizsk | 5,274 | 1,504 = 91.6% | 1,591 = 96.9% | 96.8% | 89.4% |
| Maqayis al-Lugha | m3ajim | 4,632 | 1,496 = 91.1% | 1,586 = 96.6% | 96.1% | 88.9% |
| Lisan al-Arab | m3ajim | 9,340 | 1,626 = 99.0% | 1,638 = 99.8% | 99.1% | 96.5% |
| Lisan al-Arab | wizsk | 9,334 | 1,621 = 98.7% | 1,634 = 99.5% | 98.5% | 96.4% |
| Lisan al-Arab | OpenITI mARkdown `### $` tags | 9,112 | 1,620 = 98.7% | 1,631 = 99.3% | 98.4% | 96.3% |
| Lisan al-Arab | MohamedRashad (Hawramani) | 9,239 | 1,592 = 97.0% | 1,612 = 98.2% | 95.9% | 94.7% |
| Lisan al-Arab | Shamela4 / islamlab | chapter-level (760 / 742 rows) | — | — | — | — |
| al-Sihah | wizsk | 5,648 | 1,616 = 98.4% | 1,628 = 99.1% | 99.6% | 95.9% |
| al-Sihah | Shamela4 TOC | 5,603 | 1,609 = 98.0% | 1,624 = 98.9% | 98.3% | 95.6% |
| al-Sihah | m3ajim | 5,688 | 1,608 = 97.9% | 1,623 = 98.8% | 98.7% | 95.3% |
| al-Sihah | MohamedRashad (Hawramani) | 5,593 | 1,607 = 97.9% | 1,624 = 98.9% | 98.2% | 95.4% |
| al-Sihah | OpenITI Shamela0023235 headers | 5,601 | 1,607 = 97.9% | 1,624 = 98.9% | 98.2% | 95.4% |
| al-Sihah | islamlab | 5,601 | 1,605 = 97.7% | 1,623 = 98.8% | 98.2% | 95.3% |
| Taj al-Arus | Shamela4 TOC | 11,796 | 1,630 = 99.3% | 1,639 = 99.8% | 99.3% | 96.7% |
| Taj al-Arus | OpenITI Shamela0007030 headers | 11,835 | 1,630 = 99.3% | 1,639 = 99.8% | 99.3% | 96.8% |
| Taj al-Arus | islamlab | 11,760 | 1,629 = 99.2% | 1,638 = 99.8% | 99.2% | 96.6% |
| Taj al-Arus | MohamedRashad (Hawramani) | 11,826 | 1,622 = 98.8% | 1,637 = 99.7% | 97.5% | 96.4% |
| Lane (English) | Perseus XML `div2` roots | 5,257 | 1,624 = 98.9% | 1,632 = 99.4% | 99.7% | 95.8% |
| Lane (English) | GibreelAbdullah sqlite / wizsk | 5,063 | 1,623 = 98.8% | 1,630 = 99.3% | 99.8% | 95.9% |
| Lane (English) | MohamedRashad (Hawramani) | 4,952 | 1,587 = 96.7% | 1,623 = 98.8% | 99.0% | 93.3% |
| Asas al-Balagha | Shamela4 TOC | 3,717 | 1,521 = 92.6% | 1,574 = 95.9% | 96.5% | 89.2% |
| al-Muhkam (Ibn Sida) | MohamedRashad (Hawramani) | 6,583 | 1,503 = 91.5% | 1,530 = 93.2% | 93.8% | 88.6% |
| al-Gharibayn (al-Harawi, Quran + hadith) | Shamela4 TOC / islamlab | 2,938 | 1,373 = 83.6% | 1,439 = 87.6% | 92.2% | 80.5% |
| al-Nihaya (Ibn al-Athir, hadith) | islamlab | 4,287 | 1,515 = 92.3% | 1,542 = 93.9% | 96.7% | 89.4% |
| al-Misbah al-Munir | m3ajim | 2,518 | 1,239 = 75.5% | 1,295 = 78.9% | 78.0% | 73.3% |
| Umdat al-Huffaz (al-Samin al-Halabi, Quran-only lexicon) | Shamela4 5440, body headers like `أف ك:` (heuristic parse, lower bound) | 1,652 | 1,517 = 92.4% | 1,559 = 94.9% | 95.7% | 88.7% |
| Tuhfat al-Arib (Abu Hayyan, Quran gharib) | Shamela4 TOC | 1,135 | 1,086 = 66.1% | 1,131 = 68.9% | 61.0% | 62.9% |
| al-Majmu al-Mughith (Abu Musa, Quran + hadith) | Shamela4 TOC | 2,432 | 1,045 = 63.6% | 1,114 = 67.8% | 74.8% | 62.6% |
| Kitab al-Ayn | MohamedRashad (Hawramani) | 2,719 | 629 = 38.3% | 713 = 43.4% | 42.1% | 37.8% |
| Kitab al-Ayn | Shamela4 / islamlab | permutation-chapter level | — | — | — | — |
| al-Qamus al-Muhit | MohamedRashad (headword-keyed) | 10,277 | 497 = 30.3% | 594 = 36.2% | 32.0% | 31.3% |
| al-Qamus al-Muhit | Shamela4 / islamlab / m3ajim | chapter-level or word-keyed | — | — | — | — |
| Tahdhib al-Lugha | Shamela4 / islamlab | permutation-chapter level | — | — | — | — |
| al-Ubab / Jamhara | m3ajim | 1,527 / 2,908 | 12.5% / 19.2% | 17.8% / 21.6% | — | — |

What the residual misses are, checked by hand:

- al-Mufradat: some articles are headed by a word, not a root (ساعة for سوع, ماء for موه, خنزير for خنزر, لات), so the key match undercounts; other roots have no article at all (no heading ليس, يمم, تسع or كوكب in the Shamela TOC, the Shamela body title spans, the wizsk keys or the OpenITI headers). Loose-tier misses: 84 roots, almost all with ≤8 Quranic occurrences except ليس (89), موه (63), سوع (49).
- Maqayis: strict misses are mostly orthography (Ibn Faris keys weak roots with ى/ا, e.g. دنى for دنو) — loose fixes 85 of them. Real gaps in wizsk are segmentation losses, e.g. the volume-initial articles قل and حد are absent in wizsk but present in islamlab/Shamela (V05P003, V02P003). Quadriliterals (برهن, خنزر, سنبل, كوكب, قنطر, زخرف…) are only partly covered because Ibn Faris treats most of them inside triliteral articles.
- Lisan: every one of the "missing" major roots I traced exists in the text but is **merged into a neighbouring record** by the article splitter that m3ajim and wizsk share (9,067 of their 9,344 records are identical): عين inside عون (at char 9,381), ولي inside وشي (at char 43,566 of an 86,357-char record), دين inside دون (char 9,559), حفظ inside حظظ, ندد inside نجد, رحل inside رجل, قدد inside قحد. The underlying Shamela text has these headwords at line start, and OpenITI's hand-annotated mARkdown tags every one of them (`### $ عين:` etc.), so the defect is in those two datasets' segmentation, not in the text; our own splitter, tested against the OpenITI tags, avoids it.
- Lane: the residual misses are mostly quadriliterals and rare roots (هطع, هرع, نتق, دهق); Lane's own work stops in ق and the ك–ي volumes are Lane-Poole's thinner completion from Lane's notes.

## 4. Union coverage of the recommended set

Keys used: al-Mufradat, Maqayis and al-Sihah from the Shamela4 TOC; Lisan from the OpenITI mARkdown root tags (9,143 `### $` entries, a proxy for any root-segmented Dar Sadir text); Lane from the Perseus XML; Taj from the Shamela4 TOC.

| Set | Strict | By occurrences | Loose | Roots still missing (strict) |
|---|---|---|---|---|
| al-Mufradat alone | 1,508 = 91.8% | 97.45% | 1,558 = 94.9% | 134, led by أول، يد، أخ، ليس، مال، رضي، ماء… |
| + Maqayis | 1,598 = 97.3% | 98.89% | 1,627 = 99.1% | 44 (يد، ليس، رضي، نسي، بلو، ألو، برهن، خنزير…) |
| + Lisan | 1,639 = 99.8% | 99.83% | 1,642 = 100% | رضو، دمو، هءت |
| + al-Sihah | 1,641 = 99.9% | 99.99% | 1,642 = 100% | هءت (هَيْتَ لَكَ, filed under هيت) |
| + Lane, + Taj | 1,641 = 99.9% | 99.99% | 1,642 = 100% | هءت |

- 1,527 roots (93.0%; 99.1% of root occurrences) have **both** an al-Mufradat article (Quran-specific usage) and a Maqayis article (core meaning) under the loose tier — that pair can be the default two-panel view.
- Every one of the 1,642 roots has at least one Arabic article in al-Mufradat, Maqayis, Lisan or al-Sihah under the loose tier.

## 5. Per-dataset findings

### 5.1 Shamela 4 full extraction — `huggingface.co/datasets/AuthenticIlm/Shamela4_Full_DB`

- Contents: 8,589 Shamela books, 7,611,186 pages (snapshot `shamela4_full_extraction_pg_2026_04_26`). Per book: `book_metadata.json` (includes the Shamela bibliographic card "betaka" with editor, publisher, edition), `pages.jsonl` (`body`, separate `footnotes`, printed `page_num`, `part`), `toc.jsonl`, `manifest.json` with SHA-256 per file. All 20 downloaded books verified against their manifest checksums (0 mismatches).
- Relevant books present (folder id → edition from betaka):
  - 6119 al-Mufradat fi Gharib al-Quran — ed. Safwan Adnan al-Dawudi, Dar al-Qalam / al-Dar al-Shamiya, Damascus–Beirut, 1st ed. 1412 AH; 881 pages; TOC 1,679 (≈1,600 root articles).
  - 5826 Mu'jam Maqayis al-Lugha — ed. Abd al-Salam Harun (d. 1408 AH), Mustafa al-Babi al-Halabi, 2nd ed. 1389–1392 AH / 1969–1972 (reprinted Dar al-Jil / Dar al-Fikr); TOC 5,492.
  - 1462 Lisan al-Arab — Dar Sadir, Beirut, 3rd ed. 1414 AH, 15 vols, "الحواشي: لليازجي وجماعة من اللغويين"; 47 MB; TOC chapter-level (760).
  - 6061 al-Sihah — ed. Ahmad Abd al-Ghafur Attar, Dar al-Ilm lil-Malayin, 4th ed. 1407 AH / 1987; TOC 6,333 (entries like `[بدأ]`).
  - 2558 al-Qamus al-Muhit — Maktab Tahqiq al-Turath, Mu'assasat al-Risala, 8th ed. 1426 AH / 2005; TOC chapter-level (718); articles marked in the body by `•`.
  - 2502 Taj al-Arus — Kuwait National Council edition, 1385–1422 AH / 1965–2001, 40 vols; 62 MB; TOC 12,719 (root-level).
  - 1459 Kitab al-Ayn — ed. Mahdi al-Makhzumi & Ibrahim al-Samarra'i, Dar wa Maktabat al-Hilal; arranged by phonetic permutations (تقاليب), not root-segmented.
  - 2503 Tahdhib al-Lugha — ed. Muhammad Awad Mur'ib, Dar Ihya al-Turath al-Arabi, 2001; permutation chapters only.
  - 3304 Mujmal al-Lugha (Ibn Faris) — ed. Zuhayr Abd al-Muhsin Sultan, Mu'assasat al-Risala 1406/1986; chapter-level.
  - 5737 Asas al-Balagha — ed. Muhammad Basil Uyun al-Sud, Dar al-Kutub al-Ilmiyya 1419/1998; TOC root-level (`ث ج ج`).
  - 3498 al-Muhkam — ed. Abd al-Hamid Hindawi, Dar al-Kutub al-Ilmiyya 1421/2000; permutation chapters.
  - Quran gharib: 1684 Gharib al-Quran, Ibn Qutaybah (ed. Ahmad Saqr, 1398/1978; verse-keyed, ≈2,087 numbered items over 111 surah headings); 6105 same work ed. Sa'id al-Lahham; 6006 Gharib al-Quran / Nuzhat al-Qulub, al-Sijistani (ed. Muhammad Adib Jumran, Dar Qutayba 1416/1995; arranged alphabetically by first letter and vowel); 6088 al-Tibyan fi Tafsir Gharib al-Quran, Ibn al-Ha'im d. 815 (ed. Dahi Abd al-Baqi, Dar al-Gharb al-Islami 1423; verse-keyed, ≈2,673 items over 1,910 verses); 2421 Yaqutat al-Sirat, Ghulam Tha'lab d. 345; 3805 Tadhkirat al-Arib, Ibn al-Jawzi d. 597; 4963 Tuhfat al-Arib, Abu Hayyan d. 745 (root-keyed, 1,135 roots); 5305 al-Majmu al-Mughith, Abu Musa al-Madini d. 581; 5232 al-Gharibayn, al-Harawi d. 401.
  - 5440 Umdat al-Huffaz fi Tafsir Ashraf al-Alfaz, al-Samin al-Halabi d. 756 (ed. Muhammad Basil Uyun al-Sud, Dar al-Kutub al-Ilmiyya 1417/1996, 4 vols) — a Quran-only root lexicon that builds on al-Mufradat; entries headed `أف ك:`; ≥1,517 QAC roots by a heuristic parse. Not in the original brief, but the strongest second Quran-specific lexicon.
  - Modern, copyrighted, present but NOT usable without permission: 5140 al-Siraj fi Bayan Gharib al-Quran (al-Khudayri); 8079 Mu'jam wa Tafsir Lughawi li-Kalimat al-Quran; 5647 al-Mu'jam al-Ishtiqaqi al-Mu'assal (Muhammad Hasan Jabal — the closest modern work to "core meaning of each Quranic root"); 2500 al-Mu'jam al-Wasit; 6527 Mu'jam al-Lugha al-Arabiyya al-Mu'asira; 6546 Mu'jam Matn al-Lugha; 684 critique of Makhlouf's Kalimat al-Quran.
- Sample (6119, printed p. 347, body):
  > رحم — الرَّحِمُ: رَحِمُ المرأة، وامرأة رَحُومٌ تشتكي رحمها. ومنه استعير الرَّحِمُ للقرابة، لكونهم خارجين من رحم واحدة، يقال: رَحِمٌ ورُحْمٌ. قال تعالى: وَأَقْرَبَ رُحْماً [الكهف/ ٨١]، والرَّحْمَةُ رقّة تقتضي الإحسان إلى الْمَرْحُومِ…
- The same page's `footnotes` field holds the editor's takhrij ("(١) الحديث، عن عبد الرحمن بن عوف… أخرجه الترمذي…") — cleanly separable.
- Vocalization (diacritics per Arabic letter, 300-page sample): Mufradat 0.25, Maqayis 0.23, Sihah 0.15, Ibn Qutaybah 0.31, Sijistani 0.30, Tuhfa 0.01. Partially vocalized: headwords and Quran quotations are vocalized, running prose mostly not.
- Quality: Shamela text is proof-read typing, not OCR; Quran quotations are inline text (not Mushaf-verified) with `[سورة/ آية]` references; Lisan/Qamus/Ayn/Tahdhib need our own article splitter.
- Licence, verbatim (dataset card YAML, `README.md`): `license: mit` / `license_url: https://shamela.ws`. No LICENSE text file is shipped. Shamela itself grants nothing; its terms page (`https://shamela.ws/page/terms`, titled "شروط استخدام خدمة الشاملة MCP", updated 19 Sept 2026) says, verbatim:
  > 5. الملكية الفكرية — تبقى الحقوق في الكتب والطبعات والمواد لأصحابها حسب ما ينطبق. لا تمنحك هذه الشروط حقًا في إعادة استخدام المحتوى خارج ما يسمح به النظام أو إذن صاحب الحق.
- Permissions: the MIT grant is the packager's and cannot cover rights it does not hold. For a public-domain author text with the editor apparatus removed: (a) display — yes; (b) redistribution via our API/bulk — low risk for the author text, but the established text of a modern critical edition is a residual risk (see §6); (c) commercial — same as (b). Editor footnotes, introductions, indexes and the modern works listed above: not licensed for any use.

### 5.2 islamlab/arabic-lexicons — `huggingface.co/datasets/islamlab/arabic-lexicons`

- Contents: 197,731 entries from 136 works (one parquet, 86.5 MB). Columns `headword`, `root` (filled on 69,517 rows), `text`, `work_id`, `title_ar`, `author_ar`, `death_year_ah`, `page_start` (e.g. `V02P498` = vol. 2 p. 498 of the printed edition), `n_chars`.
- Key works: Maqayis (shamela.5826, 4,882 rows), al-Sihah (shamela.6061, 5,661), Taj (shamela.2502, 12,051), al-Ayn (shamela.1459, 1,680, permutation chapters), Lisan (shamela.1462, only 742 chapter rows), al-Qamus (shamela.2558, 692 chapter rows), Tahdhib (OpenITI JK007040, 1,303 permutation rows), al-Gharibayn (OpenITI Sham19Y0016782, 3,005), Tuhfat al-Arib (shamela.4963, 1,140), al-Nihaya (shamela.6151, 4,334), Mujmal (663 chapter rows), al-Muhkam (6,323 rows, root unfilled). **al-Mufradat is not in it** (Quran sciences are left to the `quranlab/*` org, which has no gharib/lexicon config either).
- Sample (Maqayis, `رحم`, V02P498):
  > الراء والحاء والميم أصلٌ واحدٌ يدلُّ على الرقّة والعطف والرأفة. يقال من ذلك رَحِمَه يَرْحَمُه، إذا رَقَّ له وتعطَّفَ عليه. والرُّحْمُ والمَرْحَمَة والرَّحْمَة بمعنًى. والرَّحِم: عَلاقة القرابة…
- Provenance: per `works` config, the lexica above come from Shamela (`source = shamela`, edition column empty) or OpenITI release 2025.1.9 (edition filled, e.g. Tahdhib "محمد عوض مرعب ; بيروت ; 2001م ; دار إحياء التراث العربي").
- Quality: text is the Shamela text verbatim (same typo "ترهب خيرمن أن ترحم" as every Shamela-derived Sihah); root column only where the edition heads by root; includes "تجديد الصحاح" (shamela.6493), which is a **modern rearrangement** of al-Sihah, despite the dataset's "author died by 1350 AH" gate.
- Licence, verbatim (`LICENSES.md` of `islamlab/islamic-sciences`, saved to `data/raw/lexica/hf-islamlab-arabic-lexicons/LICENSES.md`):
  > The texts reached us as machine-readable files from the **Open Islamicate Texts Initiative**, release 2025.1.9, which is licensed **CC BY-NC-SA 4.0**. That licence travels with the data: reuse of this dataset must remain **non-commercial**, must **preserve attribution**, and must be shared under **the same licence**. This is the binding term for the dataset as a whole, and it is stricter than the public-domain status of the underlying works.
- Card YAML: `license: cc-by-nc-sa-4.0`. Permissions: (a) display — yes, non-commercial only, with attribution; (b) API/bulk — yes, non-commercial and under CC BY-NC-SA 4.0 only; (c) commercial — no.

### 5.3 OpenITI — `github.com/OpenITI` (release 2025.1.9, Zenodo record 17767721)

- Downloaded: 121 files / 408 MB into `data/raw/lexica/openiti/<URI>/` (every version file + yml), each verified against its git blob SHA-1 (`MANIFEST.json`), plus the 2025.1.9 metadata TSV. Raw URL pattern: `https://raw.githubusercontent.com/OpenITI/<NNNNAH>/master/data/<Author>/<URI>/<URI>.<version>`.
- Works and versions (primary version first; edition from each file's `#META#` header):
  - al-Mufradat `0502RaghibIsbahani.Mufradat`: JK001150 (pri, ed. Muhammad Sayyid Kilani, Dar al-Ma'rifa), Shamela0023636 (Dawudi 1412), Masaha003644, ShamAY0034092, Shia002552.
  - Maqayis `0395IbnFarisQazwini.MucjamMaqayis`: JK008008 (pri, Harun, Dar al-Jil 1420/1999), Shamela0021710 (Harun, Dar al-Fikr 1399/1979), Masaha, Shia.
  - Lisan `0711IbnManzurIfriqi.LisanCarab`: Shamela0001687 `.mARkdown` (pri, Dar Sadir 3rd ed. 1414, annotated 2020), JK000880, ShamAY0034695 (Dar al-Ma'arif, Cairo), Shia.
  - al-Sihah `0393IbnHammadJawhari.SihahTajLugha`: Masaha000955 (pri), Shamela0023235 (Attar 1407/1987), Shia.
  - al-Qamus `0817MajdDinFiruzabadi.QamusMuhit`: JK001437 (pri), Shamela0007283 (Risala 8th ed. 2005), Shia.
  - al-Ayn `0170KhalilFarahidi.Cayn`: JK000930 (pri, Makhzumi/Samarra'i), Shamela0001682, ShamIbadiyya, Shia.
  - Taj `1205MurtadaZabidi.TajCarus`: JK007140 (pri, Dar al-Hidaya), Shamela0007030, ShamAY0034693 (Dar al-Fikr 1414), Shia.
  - Tahdhib `0370AbuMansurAzhari.TahdhibLugha`: JK007040 (pri, Mur'ib 2001), Shamela0007031.
  - Quran gharib also downloaded: Ibn Qutaybah `0276IbnQutaybaDinawari.GharibQuran` (Saqr; Lahham), al-Sijistani `0330IbnCuzayzSijistani.GharibQuran` (incl. an altafsir.com version keyed by `[sura.ayah]`, flagged INCOMPLETE), Abu Hayyan `0745AbuHayyanGharnati.TuhfatArib`, al-Samin al-Halabi `0756IbnYusufSaminHalabi.CumdatHuffaz` (Quran-only lexicon, ed. Uyun al-Sud 1996), al-Fayruzabadi `0817MajdDinFiruzabadi.BasairDhawiTamyiz`, al-Damghani `0478IbnMuhammadDamghani.QamusQuran` (wujuh wa-naza'ir).
- Keying: only Lisan has real dictionary markup — `### $ ROOT:` per article (9,143 by my count; at least 35 are false splits where a hadith citation line starts with a name, e.g. «وفي حديث» followed by `### $ عمر:`), inside `### | باب` / `### || فصل` headers. Shamela-derived versions give `### | [ROOT]` (Sihah 5,626), `### | (ROOT)` (Maqayis 4,680 + ≈314 junk), `### | ROOT` (Mufradat 1,706 incl. 467 numbered pseudo-headers; Taj 11,575). Qamus entries are `# • headword` (derived form, root implicit). Ayn and Tahdhib are permutation groups that need a permutation-aware parser.
- Coverage from those headers (QAC strict / loose / by occurrences): Lisan 98.7% / 99.3% / 98.4%; Sihah 97.9% / 98.9% / 98.2%; Maqayis 91.9% / 97.2% / 97.0%; Mufradat 91.1% / 94.1% / 96.1%; Taj 99.3% / 99.8% / 99.3%.
- Sample (Lisan, mARkdown):
  > ### $ رحم: الرحمة: الرقة والتعطف، والمرحمة مثله، وقد رحمته وترحمت عليه. وتراحم القوم: رحم بعضهم بعضا. والرحمة: المغفرة؛ وقوله تعالى في وصف القرآن: هدى ورحمة لقوم يؤمنون*…
- **Vocalization: zero.** 0 harakat in the 17.5 MB Lisan file and in all 40 downloaded OpenITI text files (the counting regex was checked on a vowelled control string first). OpenITI's converter strips vowels by design. For a dictionary this destroys information (Sihah "والجمع كتب وكتب" no longer distinguishes كُتُب/كُتْب). OpenITI is therefore a structure/cross-check source, not a display source.
- Other quality notes: inline markers to strip (`PageV05P341`, `ms0994`, `~~`, `#`, JK `@QB@…@QE@` and `|` for punctuation); primary versions are "CLEANED" ("All paratextual elements (introductions, footnotes, indices, ...) removed by HRH and MGR (OpenITI Clean operation, 2023)") while secondary versions still carry editors' introductions and, in places, footnotes; Shamela-derived versions keep footnote reference numbers «2» with the bodies removed.
- Licence, verbatim — `https://openiti.org/documentation/` (source `github.com/OpenITI/documentation/index.md`):
  > OpenITI releases are published under the CC BY-NC-SA 4.0 license. Our files are based firstly on existing open digital libraries, which we acknowledge in our URIs. Please, do cite URIs of specific files if you use them in your research.
  > OpenITI has a duty to ensure all content of uploaded texts is not subject to copyright. In order to comply with this, all editions which are still in copyright must have their copyrighted content removed (that is all editorial input, such as footnotes and introductory matter). OpenITI removes this type of content in the course of its text annotation process.
- Zenodo record 17767721 API: `license: {"id": "cc-by-nc-sa-4.0"}`. The GitHub century repos have no LICENSE file (API `license: null`).
- Permissions: (a) display — non-commercial only, with attribution (OpenITI, file URI + version, licence link, "modified"); (b) API/bulk — non-commercial only, and any derived dataset (e.g. our root index) must be CC BY-NC-SA 4.0 (ShareAlike, Section 4(b) makes a database built from substantial contents Adapted Material); (c) commercial — no.

### 5.4 wizsk/arabic_lexicons — `github.com/wizsk/arabic_lexicons`

- Contents: Flutter app; data in `assets/data/db/db.sqlite.zip` (48.4 MB → 173 MB sqlite). Tables: `mufradat_alfajul_quran` 1,631, `maqayeesul_luga` 5,274, `lisanularab` 9,352, `mujamul_shihah` 5,650, `lanelexcon` 52,914 (5,074 roots, `is_root`/`parent_id`), plus modern copyrighted dictionaries `hanswehr` 24,799, `mujamul_ghoni` 29,810, `mujamul_muashiroh` 32,297, `mujamul_wasith` 6,763, `mujamul_muhith` 38,944. `ghoribulquran` and `quran` tables are empty.
- Keying: `word` = bare root (comment in schema: "this is most likely root; with no harakat"); sub-lines joined with `|`.
- Samples (رحم):
  > مفردات: الرَّحِمُ: رَحِمُ المرأة، وامرأة رَحُومٌ تشتكي رحمها. ومنه استعير الرَّحِمُ للقرابة…
  > مقاييس: (رَحِمَ) الرَّاءُ وَالْحَاءُ وَالْمِيمُ أَصْلٌ وَاحِدٌ يَدُلُّ عَلَى الرِّقَّةِ وَالْعَطْفِ وَالرَّأْفَةِ…
- Vocalization: Maqayis is fully vocalized (0.84 marks per letter — a different, fully-diacritized typing than Shamela's 0.23; 482 stacked double-vowel marks such as "الشمسَُ" record variant readings in verse), Lisan 0.62, Mufradat 0.20, Sihah 0.13.
- Quality: editor footnotes are **inlined** in `[[…]]` (Dawudi's takhrij in Mufradat, Attar's notes in Sihah) and must be stripped; Lisan carries the merged-article defects listed in §3; Maqayis lost volume-initial articles (قل, حد); `mujamul_muhith` is **not** al-Qamus al-Muhit but a modern dictionary (entries like "يدني الكتابَ من عينيه حين يقرأ لضَعف في بصره").
- Licence, verbatim: repo `LICENSE` = GNU GPL v3; README: "This project is fully open source and released under the **GPL-3.0 License**." `assets/data/db/Sources.md`: "All included materials are either in the public domain due to their age or derived from public domain sources." That claim is false for Hans Wehr, al-Wasit, al-Mu'asira, al-Ghani and al-Muhit, so the repo cannot be relied on as a licence source for its data. Permissions as stated: (a) yes (b) yes under GPL-3.0 copyleft (c) yes — but only the public-domain author text is actually clear, and the provenance of the typing is unstated.

### 5.5 mysamai/m3ajim — `huggingface.co/datasets/mysamai/m3ajim`

- Contents: `roots.parquet` 207,010 entries from 40 dictionaries (14 "مطبوع", 26 "مرقمنة"); `words.parquet` 281,134 word-position rows indexing Lisan only; `dictionaries.parquet`. Classical: al-Sihah 5,689, Lisan 9,344, al-Qamus 9,811 (keyed by word, e.g. `الوَرَّةُ`), Maqayis 4,636, al-Ubab 1,528, al-Misbah 2,691 (spaced root `ط ي ب`), Jamhara 2,908 (dashed `د - ق - ق`). The rest are modern copyrighted works (al-Wasit, al-Ra'id, al-Mu'asira, Academy term lists).
- Provenance: not stated. The dictionary set and the title "الصحاح في اللغة" match the baheth.info (الباحث العربي) collection — an inference, not verified.
- Fidelity problems found:
  - Maqayis drops words: رحم reads "والمَرْحَمَة والرَّحَْمة بمعنىً. عَلاقة القرابة" where islamlab, wizsk and Shamela all have "والرُّحْمُ والمَرْحَمَة والرَّحْمَة بمعنًى. والرَّحِم: عَلاقة القرابة" — the dropped tokens are exactly the defined words, so highlighted spans were lost in scraping.
  - al-Sihah is abridged: on 2,834 shared entries longer than 200 letters, the median m3ajim/islamlab letter ratio is 0.789 and 51.4% of entries are under 80% of the full length.
  - Lisan is the same Dar Sadir text as wizsk (9,067 of 9,344 records identical in their first 200 characters) with the same merged articles.
- Licence, verbatim (card YAML): `license: cc-by-nc-4.0`. Permissions: (a) yes, non-commercial; (b) yes, non-commercial with attribution; (c) no. The NC licence is asserted over third-party modern works the uploader does not own.

### 5.6 MohamedRashad/arabic-roots — `huggingface.co/datasets/MohamedRashad/arabic-roots`

- Contents: 56,606 rows (`root`, `definition`, `book_name`, `url`) scraped from arabiclexicon.hawramani.com: Taj 11,835, al-Qamus 10,325 (headword-keyed), Lisan 9,245, al-Muhkam 6,588, al-Sihah 5,600, Lane 4,953, Asas 3,729, al-Ayn 2,723, al-Mufradat 1,608.
- Sample (Mufradat, `?book=33`): "رحمالرَّحِمُ: رَحِمُ المرأة، وامرأة رَحُومٌ…" — the headword is glued to the text.
- Quality: HTML-to-text conversion collapsed whitespace between elements ("وقدرَحِمْتُهُ", "لقوميؤمنون", "هادياًوذا" in Lisan رحم), which corrupts words. Not fit for display without re-fetching.
- Licence, verbatim (card): "This dataset is available under the GPL-3.0 license." The uploader does not own the Hawramani texts; the underlying claim is Hawramani's "All texts belong to the public domain."

### 5.7 arabiclexicon.hawramani.com

- Site: 47 works, root pages per book (`?book=3` Lisan, `?book=5` al-Ayn, `?book=8` al-Sihah, `?book=33` al-Mufradat, `?book=50` Lane). Text matches the Shamela typings (spot-check: the Mufradat رحم article is identical to Shamela 6119, including "[الكهف/ 81]").
- Statement, verbatim (site footer, `https://arabiclexicon.hawramani.com/about/`): "Software and presentation © 2026 Hawramani.com. All texts belong to the public domain." The general terms (`https://hawramani.com/terms-of-use/`) contain no content licence. `robots.txt` allows root pages.
- Permissions: (a) display — yes for the text; (b) redistribution — yes for public-domain text, never the site's presentation/markup; (c) commercial — same. Risk: Hawramani does not name its editions, and the text is Shamela-derived.

### 5.8 Lane's Arabic-English Lexicon

- Perseus TEI XML (amended): `github.com/laneslexicon/lexicon_xml` (copy at `data/raw/lexica/perseus-lane-lexicon_xml/lexicon_xml.tar.gz`, SHA-256 `49b5d9cf…a4c1ce`). 37 XML files, 5,219 `<div2 type="root">` elements (5,257 normalized root keys after splitting "X or Y" headings), entries in `<entryFree key=… >`; root ids in a Buckwalter variant (`A^` = أ, `Y` = ى, "Quasi …", "&c."). Source edition per teiHeader: London, Williams and Norgate, 1863. Vocalized Arabic headwords; English prose.
- Note: `PerseusDL/lexica` on GitHub holds only Greek and Latin lexica (checked `CTS_XML_TEI/perseus/pdllex/{grc,lat}`); Lane is not there.
- Licence, verbatim — Perseus text page `https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2002.02.0015`:
  > This work is licensed under a Creative Commons Attribution-ShareAlike 3.0 United States License. An XML version of this text is available for download, with the additional restriction that you offer Perseus any modifications you make. Perseus provides credit for all accepted changes, storing new additions in a versioning system.
- teiHeader `<availability status="free">` inside every XML file:
  > This text may be freely distributed, subject to the following restrictions: You credit Perseus, as follows, whenever you use the document: "Text provided by Perseus Digital Library, with funding from The U.S. Department of Education and The Max Planck Society." You leave this availability statement intact. You offer Perseus any modifications you make.
- `laneslexicon/lexicon_xml` itself has no LICENSE file (GitHub API `license: null`); its README says only "This repository contains the updated XML files. The original Perseus XML files are in the 'originals' branch." Its amendments inherit the Perseus terms.
- Permissions: (a) yes; (b) yes, under CC BY-SA 3.0 US — our derived Lane dataset must also be CC BY-SA and we must offer corrections back to Perseus; (c) yes.
- GibreelAbdullah/LaneLexicon (`assets/lanelexicon.sqlite`, 106 MB, FTS5 `DICTIONARY` 52,914 rows / 5,074 roots, plus a `QURAN` table of 104,602 word→root rows): no licence file (API `license: null`); README credits Perseus and "Graeme Andrews… LexiconDatabase", and warns "Text was extracted from scanned pages and may contain errors". Use the Perseus upstream instead.

### 5.9 OSINTAI/Arabic-Dictionaries — `github.com/OSINTAI/Arabic-Dictionaries`

- Contents: raw Shamela text exports (headers "تم إعداد هذا الملف آليا بواسطة المكتبة الشاملة"): Kitab al-Ayn (5.3 MB, Makhzumi/Samarra'i edition with editor footnotes «1»… inline), Lisan in 15 volume files, Taj in 3 files (Dar al-Hidaya edition), Dozy's Takmilat al-Ma'ajim (Arabic translation by Muhammad Salim al-Nu'aymi, Iraqi Ministry of Culture 1979–2000 — a modern copyrighted translation). Not segmented. Last commit 2020-01-02.
- Licence: none (no LICENSE; GitHub API `license: null`; README silent). No grant; adds nothing over Shamela4.

### 5.10 ejtaal.net (Mawrid Reader / Arabic Almanac) — `github.com/ejtaal/mr`

- Page-image viewer over scanned print dictionaries (Lane, Hans Wehr, al-Mawrid, Mufradat, Maqayis, Kitab al-Ayn, Lisan…) with per-page root indexes (`mr-*-index.js`). No text.
- Licence, verbatim (`readme.html`): "Code license: GNU GPL v3. © 2011-2015 by Abdurahman Erik Taal". The scans carry no licence and include in-copyright books. Usable only as an outbound "see the printed page" link, if at all.

### 5.11 Arramooz — `github.com/linuxscout/arramooz`

- Morphological word lists (verbs, nouns, stop words) with roots, built from Ayaspell data; no definitions. GitHub API licence GPL-2.0; README "License | GPL". Useful for word→root lookups, not as a lexicon.

### 5.12 Per-Quranic-word Arabic meanings (معاني الكلمات) and Quran gharib datasets

Word coverage below = share of the 77,429 quran.com v4 word positions that receive a gloss when each headword is aligned inside its own ayah (diacritic/alef/hamza/ta-marbuta normalized, skeleton fallback). Multi-word headwords count every word of the phrase, so phrase-style books score a little high. Every folder listed has a `_source.json` with URL, revision/snapshot, checksum and the licence as found.

| Source | Work | Keying | Entries | Word coverage | Ayah coverage | Licence status |
|---|---|---|---|---|---|---|
| `tafsircenter/tafsir-mcp-data` (HF) `quran.db`, table `word_content_meaning` | unnamed ("معاجم لغوية قرآنية") | surah/ayah/word | 77,432 | ≈100% (77,375 positions map 1:1; 54 in 5 ayahs need manual mapping) | 6,236 | CC BY 4.0 in `LICENSE-DATA` and card, but `DATA_SOURCES.md` restricts commercial redistribution of "tafsir texts" |
| KFGQPC official `MuyassarGhareeb.docx` | الميسر في غريب القرآن الكريم (King Fahd Complex) | ayah + Uthmani headword | 11,371 | 23.30% | 5,082 (81.5%) | No licence file; developer page permits use in apps; redistribution/commercial not addressed |
| QUL 519 via `spa5k/tafsir_api` | variant of the KFGQPC Muyassar text (247 ayahs differ) | ayah + headword | 11,362 | 23.14% | 5,064 | No grant (spa5k MIT covers code only) |
| QuranEnc `arabic_seraj` (API) | السراج في بيان غريب القرآن, al-Khudayri | ayah + headword | 6,109 | 10.87% | 3,641 (58.4%) | QuranEnc terms: re-publish allowed with no modification, attribution, version number |
| quran.ksu.edu.sa `ar_ma3any` | كلمات القرآن تفسير وبيان, Makhlouf (d. 1990) | ayah + headword | 5,973 | 12.16% | 3,563 | None; in copyright |
| `itsSamBz/Islamic-Api` `Quran-Data/meanings` | mix of al-Siraj, Makhlouf, Muyassar | ayah | 12,991 | 17.29% | 4,293 | None |
| OpenITI / Shamela4 | Gharib al-Quran, Ibn Qutaybah (Saqr ed.) | surah + ayah number + phrase | 3,168 (OpenITI parse) | 13.40% | 2,114 | Public-domain text; OpenITI copy CC BY-NC-SA; Shamela4 copy MIT-packaged |
| `MohamedRashad/Quran-Tafseer` (HF, not downloaded) | includes Zayd b. Ali's Gharib and Ibn al-Jawzi's Tadhkirat al-Arib, from altafsir.com | surah name + ayah text | 2,310 / 3,290 | — | — | Card says apache-2.0; uploader's right doubtful |

- Tafsir Center `quran.db` (`data/raw/lexica/tafsircenter-tafsir-mcp-data/`, 234 MB, sha256 `10e61f61…`): my own count is 77,432 rows, 6,236 ayahs, 20,489 distinct meaning strings. Sample (2:255, word 3):
  > لا إله: لا معبود بحق. والإله، معناه: المألوه، أي: المعبود؛ سواء بحق أو بغير حق…
- Its quality limits: 54.1% of positions carry a meaning string reused 20+ times — template grammar notes such as "نافية للجنس" or "حرف جر يفيد معنى الظرفية", not lexical meanings; almost unvocalized (0.02 marks/letter); ZWNJ in 6,063 entries; no per-entry source, and some glosses are copied verbatim from al-Siraj (3.2% of al-Siraj's long glosses), KFGQPC Muyassar (1.3%) and Makhlouf (10.3%), plus Maqayis text.
- Licence, verbatim — `LICENSE-DATA` (github.com/tafsircenter/tafsir-mcp): "The Quranic content database accompanying this software (quran.db) is the intellectual property of Tafsir Center for Quranic Studies (مركز تفسير للدراسات القرآنية), licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). You are free to: Share… Adapt… Use commercially… Attribution — You must give appropriate credit to: "Tafsir Center for Quranic Studies (https://tafsir.net)"". `DATA_SOURCES.md` (Acceptable Use): "Personal, educational, and research use is acceptable. Commercial redistribution of tafsir texts requires permission from rights holders." Permissions: (a) yes, (b) yes, (c) yes on the face of `LICENSE-DATA`; confirm in writing (cloud@tafsir.net) because of the contradiction and the copied third-party text.
- KFGQPC Muyassar fi Gharib (`data/raw/lexica/kfgqpc-muyassar-gharib/`): fetched from the Wayback snapshot (20250417141929) of `download.qurancomplex.gov.sa/resources_dev/MuyassarGhareeb.docx` because the Complex's server timed out; the MD5 printed on the developer page does not match the served file (also noted independently by `github.com/quran-ws/kfgqpc-resources`). Sample (2:15): "﴿يَعۡمَهُونَ﴾: يَتَردَّدُون." Vocalization 0.46. Two entries are filed under the wrong ayah. Developer-page statement, verbatim: "هي خدمة يقدمها مجمع الملك فهد لطباعة المصحف الشريف للمطورين والباحثين ودور النشر لاستخدامها في محتوى تطبيقاتهم (المكتبية ، والجوال ، والمتصفحات) وأبحاثهم، وهذا المحتوى موثوق به ومعتمد من قبل مجمع الملك فهد لطباعة المصحف الشريف، ويحتوي على بيانات الميسر في غريب القرآن الكريم برواية حفص." Permissions: (a) display in an app/website — yes per that statement; (b) our API/bulk — not addressed; (c) commercial — not addressed. In-copyright KFGQPC publication.
- QuranEnc al-Siraj (`data/raw/lexica/quranenc-arabic-seraj/`, 114 files + terms snapshot): card "اللغة العربية - معاني الكلمات — من كتاب السراج في بيان غريب القرآن", V1.0.0. Sample (2:255): "سِنَةٌ: نُعَاسٌ." Fully vocalized (0.78). ≥17 entries under the wrong ayah (e.g. "بِرُوحِ الْقُدُسِ" filed at 2:78, belongs to 2:87). Terms, verbatim (quranenc.com/en/home/about): "Contents of the translations can be downloaded and re-published, with the following terms and conditions: 1. No modification, addition, or deletion of the content. 2. Clearly referring to the publisher and the source (QuranEnc.com). 3. Mentioning the version number when re-publishing the translation. 4. Keeping the transcript information inside the document. 5. Notifying the source (QuranEnc.com) of any note on the translation. 6. Updating the translation according to the latest version issued from the source (QuranEnc.com). 7. Inappropriate advertisements must not be included when displaying translations of the meanings of the Noble Quran." Permissions: (a) yes, verbatim per ayah with attribution + version (whether showing one word's gloss alone counts as "modification" is an open legal question); (b) yes under the same terms; (c) not addressed. The book itself is a modern in-copyright work (KSU Quran chair).
- Mislabel warning: QUL resource 250 "Asseraj fi Bayan Gharib AlQuran" (and its spa5k mirror `asseraj-fi-bayan-gharib-alquran`) is **Tafsir al-Sa'di**, not al-Siraj — I confirmed the spa5k files for 2:255 are identical (2,401 chars, same text) to `ar-tafsir-as-saadi`.
- Makhlouf (`data/raw/lexica/ksu-ar-ma3any-makhlouf/`): identified against the 1995 printing; no licence anywhere; author d. 1990 — do not use without permission.
- Checked and not useful: QUL word-by-word (no Arabic), QUL 487 "Tahlil Kalimat al-Qur'an" (grammar/roots, not meanings), quran.com v4 Arabic word translation (returns English), Tanzil (only ayah-level Muyassar/Jalalayn, "for non-commercial purposes only"), Mu'jam Alfaz al-Quran of the Cairo Academy (PDF scans only), `fawazahmed0` `ara-sirajtafseer` (lossy copy of QuranEnc al-Siraj under an Unlicense that cannot relicense it).
- Combined word coverage: KFGQPC Muyassar + al-Siraj 25.22%; + Makhlouf 27.39%; + Ibn Qutaybah 33.55%. Only the Tafsir Center table reaches every word, and half of its rows are grammar templates.

## 6. Licensing analysis that applies to all Arabic sources

- The authors (d. 170–1205 AH) are public domain everywhere. The rights questions are about the layers added on top:
  - Editor apparatus (footnotes, takhrij, introductions, indexes, editor's bracketed additions): protected wherever the editor died less than 50–70 years ago — Dawudi (Mufradat), Harun (d. 1988, Maqayis), Attar (Sihah), Makhzumi/Samarra'i (Ayn), the Kuwait Taj committee, Saqr (Ibn Qutaybah). Must never be displayed or redistributed.
  - The established text of a modern critical edition: some jurisdictions give scholarly editions their own right (e.g. Germany §70 UrhG, 25 years from publication); Arab publishers routinely claim rights over "تحقيق". Risk is low for display of a single article with citation, higher for bulk redistribution of a whole recent edition (Dawudi 1412 AH, Attar 1987, Hindawi's al-Muhkam 2000).
  - Digitization licences: OpenITI/islamlab (CC BY-NC-SA 4.0) and m3ajim (CC BY-NC 4.0) bind anyone who takes the files under those licences, even though the underlying text is public domain. Taking a work from Shamela4 (MIT packaging) instead avoids NC/SA obligations but not the edition question.
- Practical rule for this project: store the author text only, record the edition + digitization source + printed volume/page per article, keep editor notes out, and keep a takedown path.

## 7. Recommendation

### 7.1 Launch set

| # | Work | Role on the word card | Text source of record | Root coverage (strict / occurrences) | Launch mode |
|---|---|---|---|---|---|
| 1 | al-Mufradat fi Gharib al-Quran — al-Raghib (d. 502) | Quranic usage of the root, with the verses al-Raghib cites | Shamela4 6119 body (Dawudi ed.), footnotes dropped; cross-collate with OpenITI JK001150 (Kilani ed.) | 91.8% / 97.5% | Display-only |
| 2 | Maqayis al-Lugha — Ibn Faris (d. 395) | "Core meaning" line: the opening sentence of every article ("… أصل واحد يدل على …") | Shamela4 5826 body (Harun ed.); vocalized wizsk typing as a second witness | 92.0% / 97.0% (97.2% loose) | Display-only |
| 3 | Lisan al-Arab — Ibn Manzur (d. 711) | Full reference article, collapsed by default | Shamela4 1462 body (Dar Sadir 1414), split by our own article splitter; the OpenITI `### $` tags and the wizsk/m3ajim splits serve only as test oracles | 98.7–99.0% / 98.4–99.1% | Display-only |
| 4 | al-Sihah — al-Jawhari (d. 393) | Short classical definition with vocalized forms | Shamela4 6061 body (Attar ed.), TOC-segmented | 98.0% / 98.3% | Display-only |
| 5 | Lane's Arabic-English Lexicon | English layer | Perseus TEI XML via `laneslexicon/lexicon_xml` | 98.9% / 99.7% | Display + public API + bulk download (CC BY-SA 3.0 US) |
| 6 | Gharib al-Quran — Ibn Qutaybah (d. 276) | Verse-level classical gloss shown on the ayah/word card | Shamela4 1684 body (Saqr ed.), items aligned to (surah, ayah) from the numbered `٤١- ﴿…﴾` lines | verse-keyed, ≈2,087 items | Display-only |

- Second wave, in order of value: Umdat al-Huffaz (second Quran-only lexicon), Taj al-Arus (99.3% but very long, heavy modern apparatus), Asas al-Balagha (figurative usage), Tuhfat al-Arib (one-line Quran glosses keyed by root), al-Tibyan of Ibn al-Ha'im (verse-keyed). al-Qamus, al-Ayn and Tahdhib need bespoke parsers and add little coverage once Lisan (which absorbs Tahdhib and al-Sihah) is in.
- Do not use for production text: m3ajim (dropped words, abridged al-Sihah, NC), MohamedRashad (glued words), OSINTAI (no licence, raw exports), any modern dictionary in wizsk/m3ajim/Shamela (al-Wasit, al-Mu'asira, al-Ghani, Hans Wehr, al-Siraj, Jabal's al-Mu'jam al-Ishtiqaqi), and OpenITI text for display (no vowels, NC-SA).
- If the owner decides the site is permanently non-commercial, OpenITI and islamlab become usable for redistribution under CC BY-NC-SA 4.0; that still does not fix OpenITI's missing vowels, so the display text would stay the Shamela typing.

### 7.2 What "display-only" means here

- We show the author's text per root with full citation and a link to the printed page reference; we do not offer the Arabic lexicon text through the public API or as a bulk download until the owner gets a legal opinion on redistributing the Shamela typings of in-copyright critical editions.
- Editor apparatus is never stored in the production database: drop Shamela `footnotes`, drop inline `[[…]]` / «n» / «(1)» notes, drop editor-bracketed insertions where the edition marks them, drop introductions and indexes.
- Quran quotations inside lexicon articles are rendered as quotations of the lexicographer, never replaced by or presented as Mushaf text; the `[سورة/ آية]` references are parsed into links to the canonical verse.

### 7.3 Attribution text (one line under every article; Arabic first, English second)

Template (Arabic):

```
المصدر: {العنوان}، {المؤلف} (ت {سنة الوفاة}هـ)، {تحقيق}، {الناشر}، {الطبعة}، ج{المجلد} ص{الصفحة}. النص الرقمي: {المصدر الرقمي}. حُذفت حواشي المحقق.
```

Template (English):

```
Source: {author} (d. {AH} AH), {title}, ed. {editor} ({place}: {publisher}, {edition}), vol. {v}, p. {p}. Digital text: {digital source}. Editor's notes omitted.
```

Filled examples:

```
المصدر: المفردات في غريب القرآن، الراغب الأصفهاني (ت 502هـ)، تحقيق صفوان عدنان الداودي، دار القلم والدار الشامية، دمشق وبيروت، الطبعة الأولى 1412هـ، ص347. النص الرقمي: المكتبة الشاملة، الكتاب 23636. حُذفت حواشي المحقق.
Source: al-Raghib al-Isfahani (d. 502 AH), al-Mufradat fi Gharib al-Qur'an, ed. Safwan Adnan al-Dawudi (Damascus/Beirut: Dar al-Qalam & al-Dar al-Shamiyya, 1st ed., 1412 AH), p. 347. Digital text: al-Maktaba al-Shamila, book 23636. Editor's notes omitted.

المصدر: معجم مقاييس اللغة، ابن فارس (ت 395هـ)، تحقيق عبد السلام محمد هارون، مصطفى البابي الحلبي، الطبعة الثانية 1389–1392هـ، ج2 ص498. النص الرقمي: المكتبة الشاملة، الكتاب 21710. حُذفت حواشي المحقق.

المصدر: لسان العرب، ابن منظور (ت 711هـ)، دار صادر، بيروت، الطبعة الثالثة 1414هـ، ج{v} ص{p}. النص الرقمي: المكتبة الشاملة، الكتاب 1687.

المصدر: الصحاح تاج اللغة وصحاح العربية، الجوهري (ت 393هـ)، تحقيق أحمد عبد الغفور عطار، دار العلم للملايين، بيروت، الطبعة الرابعة 1407هـ، ج5 ص1929. النص الرقمي: المكتبة الشاملة، الكتاب 23235. حُذفت حواشي المحقق.

المصدر: غريب القرآن، ابن قتيبة (ت 276هـ)، تحقيق أحمد صقر، دار الكتب العلمية، 1398هـ، ص{p}. النص الرقمي: المكتبة الشاملة، الكتاب 3259. حُذفت حواشي المحقق.

Edward William Lane, An Arabic-English Lexicon (London: Williams and Norgate, 1863–1893), root رحم. Text provided by Perseus Digital Library, with funding from The U.S. Department of Education and The Max Planck Society. Corrections: laneslexicon/lexicon_xml. Licensed under CC BY-SA 3.0 US (https://creativecommons.org/licenses/by-sa/3.0/us/); modified by {site name} (markup converted, root index added).
```

- The Shamela book numbers above are the `shamela_id` values from each `book_metadata.json` (6119→23636, 5826→21710, 1462→1687, 6061→23235, 1684→3259); volume/page come from the page record's `part` / `page_num`.
- The Lane bulk download must ship with the full Perseus availability statement intact and under CC BY-SA 3.0 US (or a later compatible BY-SA), and our corrections should be offered back to Perseus.

### 7.4 Risks

| Risk | Where it bites | Mitigation |
|---|---|---|
| Rights in modern critical editions (تحقيق) | Bulk/API redistribution of Shamela typings of Dawudi 1412, Harun 1969–72, Attar 1987, Saqr 1978 | Display-only at launch; apparatus never stored; edition cited; takedown contact; legal opinion before any Arabic bulk export; long-term option: rebase on pre-1950 printings (Bulaq Lisan 1300–1308 AH, Bulaq Sihah 1282 AH, early-20th-century Cairo printings of al-Mufradat; Maqayis has no complete printing before Harun's own first edition of the 1940s) from page scans |
| NC/SA contamination | Copying OpenITI, islamlab or m3ajim text into the product | Use them only internally as collation/test oracles; never ship their text unless the owner commits to non-commercial + CC BY-NC-SA |
| Silent textual corruption | Merged Lisan articles (عين in عون, ولي in وشي, دين in دون, حفظ in حظظ…), dropped words (m3ajim Maqayis), abridged entries (m3ajim Sihah), glued words (MohamedRashad), missing articles (wizsk Maqayis قل/حد; Hawramani Lisan index lacks سلم/قبل/سكن/فتح/قدم/ولي) | Collate two independent typings per work and queue every divergence for human review; assert per-root article counts against a checked list; keep printed volume/page on every article so a reviewer can check the page image |
| Root mapping errors | Weak, hamzated, geminate and reduplicated roots (loose-only matches: al-Mufradat 50, Maqayis 85, al-Sihah 15, Lisan 11, Lane 8) | Store an explicit QAC-root → article mapping with `match_tier` (exact / orthographic / loose / manual); review all loose matches by hand before launch |
| Vocalization loss | OpenITI has none; Shamela prose is lightly vocalized | Display from Shamela typings; never from OpenITI |
| Content sensitivity for a religious audience | Lisan and Taj quote pre-Islamic poetry, some of it coarse; the editor's study in the Dawudi edition has sections titled "ملاحظات على كتاب المفردات" and "قول السلف في ذم العلوم الكلامية والفلسفية", i.e. the editor flags points of al-Raghib's method for readers | Show the definition paragraphs first and collapse the full article; attribute every statement to its author |
| Upstream drift | Hugging Face datasets and GitHub repos are mutable | Pin the revisions recorded in `data/raw/lexica/HF_REVISIONS.txt`, `GIT_COMMITS.txt`, `openiti/MANIFEST.json` and `SHA256SUMS.txt` |

### 7.5 Word-level meaning layer (per Quranic word)

- Launch with what is public domain and already aligned: the Ibn Qutaybah gloss (Shamela4 text, display-only) on the ≈13% of words it covers, and the root-level articles (al-Mufradat + Maqayis) for every word through its QAC root.
- Ask before launch (owner's call; nothing has been sent): KFGQPC for al-Muyassar fi Gharib al-Quran (23.3% of words, official, vocalized — the best modern gloss), the Tafsir Center for written confirmation that `word_content_meaning` is CC BY 4.0 including commercial use (100% of words), and QuranEnc on whether per-word display of al-Siraj counts as "modification".
- If the Tafsir Center confirms, use its table only where a row is a lexical gloss (filter out the reused grammar templates) and keep KFGQPC/Ibn Qutaybah first where they exist; attribute every gloss to its source.
- Do not use Makhlouf (KSU `ar_ma3any`), the itsSamBz mix, or QUL 250 (mislabelled al-Sa'di).

## 8. Pending and owners

- Owner (Omar): decide whether the site is or may become commercial. If yes, OpenITI, islamlab and m3ajim text stay out of the product (internal QA only); if permanently non-commercial, CC BY-NC-SA material becomes an option.
- Owner (Omar), with counsel: approve "display-only" for the Arabic lexica at launch, and get an opinion before exposing Arabic lexicon text through the public API or bulk download (the Shamela typings of Dawudi 1412 AH, Harun 1969–72, Attar 1987, Saqr 1978).
- Engineering — done 2026-10-02 (§10): importer for the launch set, Lisan splitter, root mapping with review queue, Ibn Qutaybah verse alignment, Lane conversion. Still open: wiring `build_lexica` into build.py / cli / API (coordinator), and human review of the 1,060 loose/manual mappings and the 1,026 suppressed candidates (owner or a designated reviewer) before loose entries are shown.
- Engineering: a collation pass (Shamela vs a second typing per work — wizsk/Hawramani/OpenITI) that flags divergent words for human review before an article is published.
- Owner (Omar): outreach for the word layer — KFGQPC (al-Muyassar fi Gharib al-Quran: API/bulk and commercial use), Tafsir Center (cloud@tafsir.net: confirm CC BY 4.0 covers `word_content_meaning` commercially and name its sources), QuranEnc (per-word display of al-Siraj). Nothing was sent; it goes out under the owner's name only with his say.
- Not done in this research: no comparison against printed page images; Shamela's own upstream typists' terms beyond the MCP terms page were not found; al-Qamus, al-Ayn and Tahdhib root-level parsers were not built, so their coverage is reported as "chapter-level", not as a percentage.

## 9. Appendix — files and scripts

State after the implementation step (2026-10-02): `data/raw/lexica/` was cut from 1.8 GB to 82 MB and now holds only what the pipeline reads, plus licence evidence. `SHA256SUMS.txt` covers every remaining file; the per-book `manifest.json` files in `hf-authenticilm-shamela4/` were re-verified (0 mismatches); `HF_REVISIONS.txt`, `GIT_COMMITS.txt` and `_evidence/openiti/MANIFEST.json` pin the exact revisions of everything removed, so each research copy can be re-fetched byte-for-byte.

| Folder (kept) | What | Size |
|---|---|---|
| `hf-authenticilm-shamela4/{6119,5826,1462,6061,1684}/` | al-Mufradat, Maqayis, Lisan, al-Sihah, Ibn Qutaybah — `pages.jsonl`, `toc.jsonl`, `book_metadata.json`, `manifest.json` (+ dataset README and extraction manifest) | ≈70 MB |
| `perseus-lane-lexicon_xml/` | `lexicon_xml.tar.gz` (laneslexicon/lexicon_xml, Perseus TEI) + README | 12 MB |
| `kfgqpc-muyassar-gharib/` | official `MuyassarGhareeb.docx` (Wayback copy; the Complex's server times out) + developer-page snapshot — kept because it is hard to re-fetch; candidate for the word layer, pending permission | 1.3 MB |
| `_evidence/<source>/` | licence texts, READMEs, terms snapshots and `_source.json` records of every removed source (islamlab, m3ajim, MohamedRashad, OpenITI manifest, wizsk, GibreelAbdullah, OSINTAI, ejtaal, Hawramani errors log, Tafsir Center, QuranEnc al-Siraj, KSU Makhlouf, QUL 519, itsSamBz) | 0.9 MB |

Removed after the research (re-fetchable from the pinned revisions): the wizsk, GibreelAbdullah, OSINTAI and ejtaal clones; the m3ajim, MohamedRashad and islamlab parquet files; the 121 OpenITI files; the Tafsir Center `quran.db`; the QuranEnc al-Siraj, KSU Makhlouf, QUL 519 and itsSamBz JSON; and the 15 Shamela books not in the launch set (Taj, Tahdhib, al-Qamus, al-Ayn, Asas, Mujmal, al-Muhkam, al-Gharibayn, Tuhfat al-Arib, al-Majmu al-Mughith, Umdat al-Huffaz, al-Sijistani, al-Tibyan, Yaqutat al-Sirat, Tadhkirat al-Arib).

Research scripts (session scratchpad only, not in the repo): `lexcommon.py` (QAC loader, normalization, candidate generation, coverage), `coverage.py`, `cov_shamela4.py`, `cov_shamela4b.py`, `cov_openiti.py`, `cov_umdat.py`, `union.py`, `lisan_qc.py`, `fidelity.py`, `lenratio.py`, `vocal.py`; results in `coverage_results.json`. The QAC file used is `quranic-corpus-morphology-0.4.txt` from `github.com/cltk/arabic_morphology_quranic-corpus` (header: GNU GPL, © 2011 Kais Dukes). Core of the matcher (simplified: the extra rule that lets a CSV `ا` stand for ء/و/ي is omitted):

```python
def candidates(root, loose=False):
    opts = []
    for c in root:
        o = {c}
        if c == 'ء': o.add('ا')                 # hamza written as bare alif
        if c in 'وي':
            o.add('ا')                           # weak radical written as alif (سما، قال)
            if loose: o.update('وي')             # و/ي interchange (رضو ~ رضي)
        opts.append(sorted(o))
    out = {''.join(p) for p in itertools.product(*opts)}
    if len(root) == 3 and root[1] == root[2]:
        out |= {x[:2] for x in out}              # geminate keyed by two letters (رب)
    if len(root) == 4 and root[0] == root[2] and root[1] == root[3]:
        out |= {root[0] + root[1] + root[1], root[0] + root[1]}   # زلزل under زلل
    if loose:
        opts2 = [sorted({c} | (set('ءاوي') if c in 'ءاوي' else set())) for c in root]
        out |= {''.join(p) for p in itertools.product(*opts2)}
        if len(root) == 3 and root[2] in 'وي': out.add(root[:2])  # يد، أخ، دم
    return out
```

## 10. Implementation (pipeline, 2026-10-02)

The launch set from §7.1 is now imported by production code in `pipeline/src/jadhr_pipeline/lexica/`, driven by the registry `data/lexica.yaml`, tested by `pipeline/tests/test_lexica.py`.

### 10.1 API

```python
from jadhr_pipeline.lexica import build_lexica

works, entries, glosses, report = build_lexica(
    raw=Path("data/raw"),                 # registry paths are relative to this
    registry=Path("data/lexica.yaml"),    # sha256-pinned; a mismatch or missing file raises LexiconRegistryError
    roots=roots_jsonl_rows,               # the 1,642 canonical roots (key, letters, occurrences)
    words=words_jsonl_rows,               # optional; default: latest data/build/<version>/words.jsonl
    surahs=surahs_jsonl_rows,             # optional; default: latest data/build/<version>/surahs.jsonl
)
```

- `works` (6 rows): `id, title_ar, title_en, author_ar, author_en, death_hijri, death_ce, lang, edition_note, source_url, license, attribution_ar, attribution_en, redistributable, sort_order`. Only `lane` has `redistributable: true`.
- `entries` (26,696 rows): `id, work_id, root_key, headword, match, body, core_meaning, page_ref, source_ref`. `id = sort_order × 1,000,000 + position in the work` (deterministic). `root_key` is a canonical display key or null; `match` is `strict | loose | manual`, and null exactly when `root_key` is null. `body` paragraphs are separated by a blank line. `core_meaning` is set for Maqayis only. `page_ref` is `volume/page` or `page`, with a range when the article spans pages (Lane: printed page number). `source_ref` is `shamela:<book>:toc-<id>`, `shamela:<book>:page-<id>:line-<n>` or `perseus:lane:<file>:<entryFree id>`.
- `glosses` (3,431 rows): `id, work_id, surah, ayah, phrase, gloss, word_locations` plus `page_ref` and `source_ref` (two extra fields for citation; drop them if the loader is strict). `gloss` is the item's printed text after its ayah number, verbatim — connective and quoted phrase included («و ﴿يَوْمِ الدِّينِ﴾ يوم القيامة…»); `phrase` repeats the quoted words for alignment and highlighting (rule `gharib-item-number`).
- `report`: `rules` (the registry rules), `works.<id>` (counts, coverage, `roots_without_entry`, `unmatched_headwords`, `toc_headings_not_found`, `rules_applied` and `stats` counters), `review` (every loose and manual mapping with confidence), `review_suppressed`, `coverage` (cross-work, incl. `display_fallbacks`).

### 10.2 How each work is read

- al-Mufradat, Maqayis, al-Sihah: the Shamela TOC gives the expected ordered headwords; an article starts at the printed heading line that matches the next expected title within a look-ahead of 4 (al-Mufradat: the headword alone on its line; Maqayis: the headword span alone on its line, or a plain headword line followed by Ibn Faris's letter formula; al-Sihah: a line opening with "[root]"). Shamela TOC anchors are not trusted as boundaries — 167 of al-Mufradat's sit inside running text, even inside a word ("م<span>أخ</span>وذ") — so markup is removed and its text kept.
- Lisan: own splitter (rule `lisan-article-split`). Line-initial "X:" tokens of 2–6 letters are candidates; tokens with a medial plain alif or a definite article are rejected (قال، صار، والوجء); the article starts are the heaviest subsequence that is non-decreasing in Lisan's (باب = last radical, فصل = first radical) order, each skeleton weighing 1 in total across its occurrences (so a headword that opens its article once outweighs a formula such as "وَيُرْوَى:" repeated on many lines); repeats of the same skeleton in one run keep the occurrence that best fits the alphabetical order. The merged articles of earlier community splits are fixed: عين, ولي, دين and حفظ are separate entries (test-asserted). Dev check against OpenITI's hand-annotated tags (the pinned Shamela0001687 mARkdown, re-fetched for the check and deleted again): 96 of the 9,143 OpenITI tags have no matching start here and 323 starts here have no OpenITI tag. The 96 are mostly OpenITI's own false tags (names opening hadith citations — عمر ×4, علي ×3, خالد ×3, وهب ×3 — and quote words such as قال, تريد, لقلت), second occurrences of a headword OpenITI tagged twice (حلق, سحر, خدر, صقع, كوز, طلق, غيل, عمي), and about 8 genuine headwords written with a medial alif (باج، ضاج، جاذ، جاس، نار، عاعا…) that stay inside the preceding article. The 323 are 248 quadriliteral/quinqueliteral articles OpenITI did not tag (شطرنج، زبرجد، قرنفل…), 42 triliteral ones (فتح، قبر، نزل، فصل، عسل…), 25 letter descriptions ("ب:", "ت:"…) and 8 two-letter or particle headings from the closing section.
- Lane: one entry per `<div2 type="root">`; Perseus' Buckwalter variant converted with the laneslexicon table; 91.0% of Arabic tokens agree exactly with the laneslexicon project's own converted database on a 300-root sample (the rest are differences of segmentation, not of letters). 13 root divisions are empty in the Perseus XML and are dropped — including قبل (Lane pp. ≈2475–2480 are missing from the Perseus file), قبع، قبن، كعل، مظع، منج — so Lane shows nothing for قبل.
- Ibn Qutaybah: an item opens a line either with its ayah number(s) and a dash — «٤١-», «٢- و (العالَمُونَ)», «٣٠ و٣١-», «١٦، ١٨، ٢١، ٣٠-», «١٧-١٨-» — or, for a further word of the same ayah, directly with ﴿phrase﴾. The phrase is the first quoted span (﴿…﴾, (…) or "…"). A numbered item naming several ayahs gives one row per listed ayah in which its phrase occurs (57 such items); a phrase quoted across ayahs ("… * …") is aligned part by part (26). An unnumbered ﴿…﴾ line that does not occur near its ayah but does occur elsewhere in the Quran is a verse cited inside the previous gloss and stays in it (6). A surah heading followed by an honorific outside its TOC anchor («سورة محمد ﷺ») is recognised. Alignment tiers for the printed ayah: match keys → consonant skeleton → leading clitic → the phrase as one alif-insensitive string («يا أيها» ↔ «يَٰٓأَيُّهَا») → a one-word dictionary form («الصَّيِّبُ» ↔ «كَصَيِّبٖ»); ayahs ±1…±3 are tried with the first three tiers only and 30 items were re-keyed (listed). A sample of 30 of the 95 alignments made only by the two loosest tiers was checked by hand: all correct.

### 10.3 Root mapping

- Strict = the headword's letter skeleton equals a canonical root, or a printed final shadda doubles the last letter ("أزّ" → ءزز, sub-rule `shadda-expanded`). Accepted automatically.
- Loose = exactly one documented substitution, always listed for review with a confidence flag: `alif-for-hamza` (high), `alif-for-weak` (high), `two-letter-geminate` (high), `waw-yaa-swap` (medium), `hamza-weak-swap` (low), `two-letter-defective` (low). Ties between candidates are assigned to the root with more Quranic occurrences, flagged `ambiguous` and downgraded to low (27 cases, e.g. Sihah [أبا] → أبو, alternative أبي).
- A loose candidate is not assigned when the work already has a strict article for that root (the headword is then most likely a different, non-Quranic root); these 1,026 cases are listed in `review_suppressed` with root null.
- Manual = `manual_roots` in the registry: al-Mufradat ساعة → سوع, ماء → موه, خنزير → خنزر.
- Note: these strict/loose tiers are stricter than the research tiers of §2 (where alif/hamza spellings and two-letter geminates counted as strict), so the strict percentages below are lower than in §3; the strict + loose totals agree with §3.

### 10.4 Counts and coverage (computed by the pipeline; pinned in the tests)

| Work | Entries | Strict | Loose | Manual | No root | Roots strict | Roots any | Coverage any | Occurrences covered |
|---|---|---|---|---|---|---|---|---|---|
| al-Mufradat | 1,624 | 1,295 | 221 | 3 | 105 | 1,295 = 78.87% | 1,515 | 92.27% | 98.51% |
| Maqayis | 4,750 | 1,357 | 216 | 0 | 3,177 | 1,352 = 82.34% | 1,547 | 94.21% | 99.16% |
| Lisan | 9,370 | 1,490 | 180 | 0 | 7,700 | 1,489 = 90.68% | 1,619 | 98.60% | 99.71% |
| al-Sihah | 5,648 | 1,490 | 169 | 0 | 3,989 | 1,470 = 89.52% | 1,599 | 97.38% | 98.23% |
| Lane | 5,304 | 1,466 | 271 | 0 | 3,567 | 1,388 = 84.53% | 1,613 | 98.23% | 99.72% |

- All works together: 1,633 of 1,642 roots have at least one entry (1,630 with an Arabic entry). The 9 without any are reduplicated quadriliterals (حصحص، ذبذب، رفرف، زحزح، زلزل، صرصر، صفصف، صلصل، هدهد); `display_fallbacks` offers the geminate article for 5 of them (زلزل → زلل, ذبذب → ذبب, صرصر → صرر, صفصف → صفف, هدهد → هدد).
- Entries with no root (non-Quranic articles) are kept: filter `root_key IS NOT NULL` for the Quran subset.
- Review queue: 1,060 mappings (high 779, medium 75, low 203, manual 3) by rule: two-letter-geminate 395, alif-for-weak 341, hamza-weak-swap 125, waw-yaa-swap 75, alif-for-hamza 66, two-letter-defective 55, manual 3. Plus 1,026 suppressed candidates.
- Ibn Qutaybah: 3,382 items → 3,431 glosses, 3,404 aligned to word locations (99.2%), 27 unaligned (listed with source_ref — mostly readings that differ from the Hafs text, e.g. «بظنين», or dictionary forms such as «المنسأة»), 30 re-keyed to a neighbouring ayah, 6 cited verses kept in the previous gloss. Fix of 2026-10-02: before it, 153 of 3,093 glosses swallowed later numbered items of other ayahs (e.g. 1:1 contained the items of 1:2, 1:4 and 1:6) because items written «٢- و (العالَمُونَ)», «٤- و ﴿…﴾» or «٣٠ و٣١-» were not recognised; now 0.
- Shamela gaps (not pipeline defects): Maqayis has no article text for عون, غلظ, وجل, خفض in the Shamela typing; 11 Maqayis and 9 al-Sihah TOC titles have no printed heading (listed in the report); al-Sihah has 9 bracket headings missing from its TOC (imported anyway).

### 10.5 Cleaning rules applied (counts from the report)

| Rule | al-Mufradat | Maqayis | Lisan | al-Sihah | Ibn Qutaybah |
|---|---|---|---|---|---|
| footnotes-dropped (pages) | 857 | 2,632 | 3,731 | 4,152 | 542 |
| footnote-markers-removed | 2,963 | 8,923 (27 after a heading) | 5,119 | 8,415 | 1,976 |
| … with a matching note on the same page | 2,962 | 8,896 | 5,106 | 8,328 | 1,975 |
| title-markup-removed | 1,666 | 5,492 | 760 | 6,299 | 115 |

- Lane: `lane-markup-removed` 48,176 paragraphs, `lane-transliteration` 395,995 Arabic runs, 2 characters outside the table kept as is.
- Lisan split: 20,229 candidates; 6,734 rejected as not a root form; 4,149 off the (باب, فصل) chain; 21 repeated in run; 9,370 entries.
- `page-join`, `whitespace-normalised`, `front-matter-skipped` and `separator-lines-dropped` counts are in `report.works.<id>.rules_applied`.

### 10.6 Verification

Command (repo root): `uv run pytest pipeline/tests/test_lexica.py -q` → `24 passed in 7.69s`; with the Arabic helper tests `uv run pytest pipeline/tests packages/arabic-py/tests -q` → `41 passed in 7.73s`. `uv run ruff check` / `ruff format --check` → "All checks passed!" / "9 files already formatted"; `uv run mypy pipeline/src/jadhr_pipeline/lexica --ignore-missing-imports` → "Success: no issues found in 8 source files". The tests load the real pinned files and assert the counts above, the Maqayis core meanings of علم, كتب, رحم (verbatim prefix of the body), the al-Mufradat رحم article as printed (p. 347–348), the Lisan splits (عين not inside عون; ولي, دين, حفظ likewise), Lane كتب (Arabic script, no Buckwalter left), al-Sihah [رحم] at 5/1929, the 9:41 gloss aligned to 9:41:1–3, no gloss containing a later numbered item (the coordinator's detector, checked first on a merged sample), separate glosses for 1:2 (العالمون), 1:4 (يوم الدين) and 1:6 (الصراط) aligned inside their own ayahs and absent from 1:1, al-Qamar's refrain item giving rows for 54:16, 18, 21 and 30, that no body contains a stripped marker pattern, span markup or a carriage return, that every root_key is one of the 1,642, that every loose/manual mapping is on the review list, and that the registry refuses a file whose sha256 differs or is missing. The marker and merge checks were run against known positives first (a marked string; the old merged عون record) and do fail on them.

