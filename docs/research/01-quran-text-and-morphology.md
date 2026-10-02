# 01 — Quran text, fonts and morphology sources

Research date: 2026-10-02. Every file listed below was downloaded into `data/raw/<slug>/` and hashed; each slug directory also holds a `SHA256SUMS.txt`. All counts were computed from the downloaded bytes by scripts, not copied from the sources' own claims (where a source states a number, it is shown next to ours).

## 0. Outcome in one screen

- **Display text:** the official KFGQPC "Uthmanic Hafs" Unicode text (`hafsData_v2-0.json`, from the KFGQPC developer portal; MD5 and SHA-1 match the portal's published checksums). It is the text the KFGQPC Hafs font was built for, and it renders as Madinah-mushaf script (khah-head sukun, open tanween, attached waqf signs, ayah-end medallion with number).
- **Font:** `KFGQPC HAFS Uthmanic Script` Version 2.2 (`UthmanicHafs_V22.ttf`). The file from the KFGQPC font site zip and the QUL CDN copy are byte-identical (sha256 `aa68bffc…f145`). It must be served unmodified (no WOFF2 conversion, no subsetting).
- **Canonical verification text + morphology alignment key:** Tanzil Uthmani 1.1 (CC BY 3.0 + "no changes" clause). 6,236 verses verified. The letter stream agrees with KFGQPC; the orthographic encoding differs (sukun, tanween, word spacing).
- **Primary morphology:** Quranic Arabic Corpus (QAC) v0.4, kept byte-pristine. 128,219 segments / 77,429 words / 1,642 roots / 4,832 lemmas / 27,462 words with no root. Our root counts reproduce the live corpus.quran.com dictionary exactly (رحم 339, كتب 319, نوس 241).
- **Cross-check sources:** there is no openly licensed, human-verified, token-level root dataset that is independent of QAC. Every "other" root dataset I could test (openislam.org, tafsir.app "تحليل كلمات القرآن", QUL morphology, kwanite, quran-analyzer, the owner CSV) descends from QAC or its mustafa0x fork. The workable independent check is **AlKhalil Morpho Sys 2** (via the `farahidi` Python port, GPL-3.0). It is rule-based and lexicon-based, and it also gives a wazn. Pilot on 3,000 random QAC tokens: AlKhalil's top-1 root matched QAC on 91.3% of analysed tokens; QAC's root was among AlKhalil's candidates for 98.5%; 6.2% of tokens got no analysis. Second-tier checks: the linuxscout manual word index (GPL-3.0), MASAQ (independent POS and segmentation, but no roots, CC BY-NC 3.0), and the mustafa0x deltas as a ready-made list of known disputes.
- **Licensing blockers to resolve before launch:** (1) QAC: the GPL header conflicts with a "CHANGING IT IS NOT ALLOWED" clause, and its FAQ says the data is for non-commercial use. (2) Tanzil: modifying the text is prohibited. (3) KFGQPC font: no modification. (4) Quran.com / Quran Foundation API data cannot be cached for more than 1 week or redistributed. **The two QF-sourced files now in `data/raw` should be deleted by 2026-10-09** (see §5). (5) MASAQ is NC.

## 1. Quranic Arabic Corpus (QAC) morphology

### 1.1 Files

| Slug / file | Source URL (no login) | Bytes | sha256 |
|---|---|---|---|
| `qac-morphology-0.4/quranic-corpus-morphology-0.4.txt` | https://raw.githubusercontent.com/bnjasim/quranic-corpus/master/quranic-corpus-morphology-0.4.txt | 6,309,503 | `a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46` |
| `qac-morphology-mustafa0x/quran-morphology.txt` (+ README, `morphology-terms-ar.json`, `scripts/`) | https://github.com/mustafa0x/quran-morphology (last commit 2018-06-19) | 6,322,866 | `742bfac59941b2cb09736d5b7aae694af50792261fb8450cbf6afafcc340645f` |
| `qac-v2-kaisdukes/morphology.txt`, `lemmas.txt`, `syntax.txt`, `pause-marks.tsv`, `quran-uthmani.xml`, `chapters.json`, `verses.json` | https://github.com/kaisdukes/quranic-corpus-api/tree/main/src/main/resources/data | 2,617,763 (morphology.txt) | `f1d3417be9aac22d54fff9ddc34db0818d7f490d836471a0d9163b3a2c11c065` |

**Official download needs an e-mail address.** At https://corpus.quran.com/download/, the file is released only after a form submission (`txtEmail`, "for verification purposes only"). The direct path `https://corpus.quran.com/download/quranic-corpus-morphology-0.4.txt` redirects (302) to the homepage. I did not submit the owner's e-mail.

**Provenance proof without the form:** three public mirrors agree. The bnjasim mirror (2018) and the ezAldinWaez mirror are byte-identical (CRLF, `a1d12923…`). The AhmedSaadi0 mirror is the same content with LF line endings (normalised sha `910b721a…`). The live site still serves 0.4 data: corpus.quran.com shows root ن و س for 2:8:2 and د ل ل for 7:22:1, exactly as in the file. CRLF warning: parse in binary/newline-aware mode, or you will get "\r"-suffixed phantom roots.

### 1.2 Format (QAC 0.4)

The file opens with a 54-line comment block: the QAC copyright notice followed by the Tanzil Uthmani 1.0.2 notice. Then come a header row `LOCATION FORM TAG FEATURES` and one tab-separated row per segment. FORM and LEM are in extended Buckwalter. Verb form is a `(II)`…`(XII)` token, and Form I is implicit; the `VF:` key exists only in the mustafa0x fork.

```
LOCATION	FORM	TAG	FEATURES
(1:1:1:1)	bi	P	PREFIX|bi+
(1:1:1:2)	somi	N	STEM|POS:N|LEM:{som|ROOT:smw|M|GEN
(1:1:2:1)	{ll~ahi	PN	STEM|POS:PN|LEM:{ll~ah|ROOT:Alh|GEN
(1:6:3:2)	musotaqiyma	ADJ	STEM|POS:ADJ|ACT|PCPL|(X)|LEM:m~usotaqiym|ROOT:qwm|M|ACC
```

In QAC roots, the Buckwalter `A` stands for hamza (`Alh` = أله, `qrA` = قرأ). Map it to ء/أ, never to ا.

### 1.3 Computed counts (script: Python, strict Buckwalter mapper that throws on unknown characters)

| Metric | QAC 0.4 | mustafa0x fork | QAC v2 data (kaisdukes) |
|---|---|---|---|
| Segments (rows) | 128,219 | 130,030 | n/a (one line per word) |
| Words, unique s:v:w | 77,429 | 77,429 | 77,429 lines |
| Verses / suras | 6,236 / 114 | 6,236 / 114 | — |
| Segments with ROOT | 49,968 | 50,269 | — |
| Words with a root | 49,967 | 50,268 | 49,967 |
| **Words with no root** | **27,462** | 27,161 | 27,462 |
| **Distinct roots** | **1,642** (1,602 triliteral + 40 quadriliteral) | 1,651 (1,608 + 43) | 1,642 |
| **Distinct lemmas** | **4,832** (4,657 of them carry a root) | 4,776 | 4,834 |
| Roots occurring in exactly one word | 395 | 399 | — |
| Distinct POS tags | 45 | 3 top-level (N/V/P) + sub-tags | — |
| Words with two roots | 1 (20:94:2 يَبْنَؤُمَّ = بني + أمم) | 1 (same) | — |

- **Top roots by word count (QAC 0.4):** أله 2,851 · قول 1,722 · كون 1,390 · ربب 980 · أمن 879 · علم 854 · قوم 660 · أتي 549 · كفر 525 · بين 523.
- **Verb segments by form (QAC 0.4):** I 12,347 · IV 3,487 · II 1,300 · VIII 963 · V 414 · X 369 · III 334 · VI 77 · VII 51 · XII 9 · IX 5.
- **Tag distribution (top):** N 25,136 · PRON 24,685 · V 19,356 · P 13,006 · CONJ 9,450 · DET 8,377 · PN 3,911 · REL 3,575 · REM 2,925 · NEG 2,688 · ACC 2,283 · ADJ 1,961.
- **Validation against the live site:** our word-level root counts equal the corpus.quran.com Quran Dictionary totals for رحم (339, 9 lemmas), كتب (319, 7 lemmas) and نوس (241). So "occurrences of a root" = the number of words carrying that root, and "derived forms" = distinct lemmas under the root.
- **QAC does not give a noun wazn.** It marks verb forms, participles (ACT/PASS PCPL) and verbal nouns (VN) only. The mustafa0x README lists "mark the form of all nouns" as still to do. The wazn layer must come from another source; see §6.2 (AlKhalil `pattern_lemma`).
- **Lemma quirks that need a normalisation pass:** some verb lemmas are inflected forms, e.g. 1:5:4 `LEM:{sotaEiynu` (should be استعان) and 2:16:7 `LEM:rabiHat` (should be رَبِحَ). Roots are not affected.

### 1.4 Errata and correction versions, and how they differ

**mustafa0x/quran-morphology** (Mustafa Jibaly; QUL credits him for "improving and providing Quran morphology data") converts the file to Arabic script and applies `apply-changes.py`. After normalising hamza spelling (QAC `A` → أ etc.), **76,672 words keep the same root and 757 words differ in 29 distinct ways**. The substantive changes:

| QAC 0.4 → mustafa0x | Words | Example |
|---|---|---|
| نوس → أنس | 241 | 2:8 ٱلنَّاسِ |
| (none) → أيي | 215 | 2:21 يَٰٓأَيُّهَا |
| (none) → يوم | 70 | يَوْمَئِذٍ (ئذ split off) |
| ندو → ندي | 53 | 2:171 نِدَآءً |
| اول → (none) | 45 | 2:179 يَٰٓأُو۟لِى |
| اني → (none) | 28 | 2:223 أَنَّىٰ |
| (none) → أدم | 25 | 2:31 ءَادَمَ |
| طمن → طمأن | 13 | 2:260 لِّيَطْمَئِنَّ |
| (none) → مسح / مدن / هود / أون / حيي / حمد | 11 / 10 / 9 / 8 / 5 / 5 | ٱلْمَسِيحُ، مَدْيَنَ، ٱلْيَهُودُ، ٱلْـَٰٔنَ، يَحْيَىٰ، مُحَمَّدٌ |
| (none) → برزخ / سبأ / مرو / رمض / عرف / جود / عزز / مني / برق / هاء / نمرق / زرب / قرش | 1–3 each | proper nouns and loanwords |
| لمم → هلم | 2 | 6:150 هَلُمَّ |
| معن → عون | 1 | 107:7 ٱلْمَاعُونَ |

Most of these are classical scholarly disagreements, not plain errors: الناس from أنس or نوس; whether foreign proper nouns such as آدم or محمد get a root at all. They are exactly the cases that need a documented root policy and an editorial "disputed" flag. The fork also retags particles (adds NV, ATT, DIST, ADDR; replaces ADJ with N plus an ADJ attribute; renames SP to FAM) and singularises and de-madds lemmas. The repo has **no license file**.

**QAC v2 data** (kaisdukes/quranic-corpus-api, 2023; this is the backend of "Quranic Arabic Corpus 2.0"). Root attributions are identical to 0.4 for 77,427 of 77,429 words. The one real change is 7:22:1 فَدَلَّىٰهُمَا, where the root changes from دلل to دلو. The other "difference" (20:94:2) is just how the two-root word is represented. There are 546 stem-lemma string differences, mostly multi-stem function words; there are 62 POS changes, mostly ADJ↔N. The repo has **no license file**. Its sibling frontend repo `kaisdukes/quranic-corpus` is GPL-3.0.

**qurancorpus.app — do not use.** The "new site" domain named in the QAC 2.0 README now 301-redirects to a "Ce domaine est à vendre" (domain for sale) page (checked 2026-10-02). Its `/api/...` endpoints are gone.

### 1.5 License — verbatim

The file header (https://corpus.quran.com/download/ shows the same block) contains a notice that must be reproduced in derived works:

> Quranic Arabic Corpus (morphology, version 0.4) · Copyright (C) 2011 Kais Dukes · License: GNU General Public License

> - Permission is granted to copy and distribute verbatim copies of this file, but CHANGING IT IS NOT ALLOWED.
> - This annotation can be used in any website or application, provided its source (the Quranic Arabic Corpus) is clearly indicated, and a link is made to http://corpus.quran.com to enable users to keep track of changes.
> - This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all works derived from or containing substantial portion of this file.

- **Download page:** downloading means agreeing to "the terms and conditions of the GNU License". https://corpus.quran.com/license.jsp is the full GPL **version 3**.
- **Site footer (every page):** "available under the GNU public license with terms of use".
- **FAQ, https://corpus.quran.com/faq.jsp — the source of the non-commercial signal:**
  - Research-data requests come with the condition "You do not use the data for commercial purposes".
  - The project's stated aim is an annotated Quran "freely for non-commercial use under the GNU public license".
- **Where the "CC BY-NC-SA" claims in the wild come from:** derivative compilations relicensed their own packaging. Example: the Semantic Quran RDF dataset is CC BY-NC-SA 3.0; the q-ran/quran Text-Fabric corpus is CC BY 4.0 for its own layer and tells users to respect the source licenses. **QAC itself is GPL plus custom terms. I found no first-party CC statement.**

## 2. Tanzil Quran text

### 2.1 Files

Download endpoint, no login: `https://tanzil.net/pub/download/index.php?quranType=<type>&outType=<txt-2|xml>&agree=true[&marks=true][&sajdah=true]`. Each option is switched on by the mere presence of its parameter (`marks=false` still adds the marks). Omitting all of them gives the plain variant.

| File | Options | Bytes | sha256 |
|---|---|---|---|
| `tanzil/quran-uthmani-marks-sajdah.txt` | uthmani, pause marks + sajdah sign | 1,384,015 | `18c719bb3ba26d32ef457f40dad77cd28c4c5a34156833e26a8e5fcfdd246fb1` |
| `tanzil/quran-uthmani-nomarks.txt` (= `quran-uthmani.txt`) | uthmani, no options | 1,370,878 | `bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8` |
| `tanzil/quran-uthmani.xml` | uthmani XML, marks + sajdah | 1,529,315 | `5ea5cbab9b4d031613a819a70822aff75e7c4500dea4946fc554b1bf84b7468a` |
| `tanzil/quran-simple.txt` | simple (imlaei) with marks | 1,353,105 | `c8c2ea9e004cf3f4b7afc5ba00de859556f4ed09bd9cf5d1bc79e877406ef678` |
| `tanzil/quran-simple-clean.txt` | simple-clean, no diacritics | 781,176 | `228df2a717671aeb9d2ff573002bd28d6b3f973f4bc7153554e3a81663d67610` |
| `tanzil/quran-data.xml` | metadata, https://tanzil.net/res/text/metadata/quran-data.xml | 77,234 | `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a` |

**Variant check:**

- A fresh download of the Uthmani text with no options gives sha `bf4f57b9…`, the no-pause-marks variant; the marks variant is kept under its own name (`quran-uthmani-marks-sajdah.txt`).
- `quran-data.xml` matches `8867c1d8…` exactly.
- Note: `tanzil/quran-uthmani.txt` was overwritten at 14:50 by another process with the no-marks variant. That is why the marks variant has its own explicit file name.

Sample (`txt-2` = `sura|aya|text`):

```
1|1|بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
1|2|ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ
1|1|بسم الله الرحمن الرحيم            (simple-clean)
```

### 2.2 Computed counts and conventions

- **Counts:** 6,236 verse lines in every variant; XML 114 suras / 6,236 ayas. `quran-data.xml`: 114 suras (aya sum 6,236), 30 juz, 240 hizb, 7 manzil, 556 ruku, 604 pages, 15 sajdas.
- **Version:** Uthmani 1.1 (released 2021-02-12). Changes since 1.0.2 (https://tanzil.net/updates/):
  - بَعْدَمَا is split into بَعْدَ مَا at 2:181, 8:6 and 13:37.
  - يَـٰصَـٰحِبَىِ at 12:39 and 12:41.
  - HIGH_NOON and SMALL_WAW get a tatweel.
  - A mid-word SMALL_YEH becomes TATWEEL + HIGH_YEH.
  - لءا becomes لـَٔا.
- **Word tokens:**
  - Uthmani 1.1 has 82,260 space tokens. 4,379 of them are standalone pause-mark tokens: U+06DA 1,972, U+06D6 1,682, U+06D7 603, U+06D9 68, U+06D8 22, U+06E9 15, U+06DB 12, U+06DC 5. That leaves 77,881 words — but only in the txt file, where the basmala is prepended (next bullet).
  - The XML (basmala kept as an attribute) gives **77,433 words**.
  - Simple and simple-clean have 78,248 words; the imlaei text separates يا, ها and similar.
- **Basmala gotcha:** in `txt-2` output, Tanzil **prepends the basmala to ayah 1 of 112 suras** (all except 1 and 9). The XML keeps it in a `bismillah` attribute instead. These are unnumbered header tokens, so strip them before aligning to morphology.
- **Alignment with QAC (77,429 words):** Tanzil 1.1 XML differs from QAC in exactly **4 verses**: 2:181, 8:6, 13:37 (QAC keeps بعدما as one word) and 37:130 (QAC treats إِلْ يَاسِينَ as one word). Tanzil 1.0.2, which QAC was built on, differs only at 37:130.
- **Codepoints:** Uthmani with marks uses 69 distinct codepoints; KFGQPC V22 and Amiri Quran both cover all 69. Sukun is U+0652 (round). Tanzil does not encode the Madinah open-tanween or khah-head sukun forms.

### 2.3 License — verbatim

The notice is appended to every downloaded file and is the same as https://tanzil.net/docs/Text_License:

> Tanzil Quran Text (Uthmani, Version 1.1) · Copyright (C) 2007-2026 Tanzil Project · License: Creative Commons Attribution 3.0

> - Permission is granted to copy and distribute verbatim copies of this text, but CHANGING IT IS NOT ALLOWED.
> - This Quran text can be used in any website or application, provided that its source (Tanzil Project) is clearly indicated, and a link is made to tanzil.net to enable users to keep track of changes.
> - This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all files derived from or containing substantial portion of this text.

**Licensing change:** QAC's embedded copy of the 1.0.2 notice said "Creative Commons BY-ND 3.0". The current notice says "Creative Commons Attribution 3.0" but keeps the "CHANGING IT IS NOT ALLOWED" clause. Treat the stricter clause as binding.

## 3. KFGQPC text and fonts, plus Amiri

### 3.1 Files

| Slug / file | Obtained from | Bytes | sha256 | Authenticity check |
|---|---|---|---|---|
| `kfgqpc-uthmanic-hafs-v2-0/UthmanicHafs_v2-0.zip` (data in CSV/JSON/SQL/XML/TXT/HTML/XLSX + `uthmanic_hafs_v20.ttf` + docx/pdf; extracted json, csv, read.me, ttf alongside) | KFGQPC developer portal `https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip`, via Wayback `web.archive.org/web/20250417225336id_/…` | 10,729,285 | `a7b0e5591945712ec5e4d6142938ae4d1e9b49bdc89dff06222789bfebdfd72c` | **MD5 `cf6841ae…8278` and SHA-1 `36ea5ab0…7ebf` equal the checksums published on the portal** (2025-09 snapshot). The 2023 snapshot listed older checksums for an earlier build. |
| `fonts/kfgqpc-official-site/UthmanicHafs_v22.zip` (UthmanicHafs_V22.ttf, uthmanic_hafs_v22.ttf, full-Quran docx) | font site `https://fonts.qurancomplex.gov.sa/wp-content/uploads/fonts/UthmanicHafs_v22.zip`, via Wayback (2025-12-08) | 962,683 | `b5cf0666441aabd5ff2be4993934e6f2a57d00b6b89afcdf708cd70288671b23` | The inner `UthmanicHafs_V22.ttf` is byte-identical to the QUL CDN copy (`aa68bffc…`) |
| `fonts/kfgqpc-uthmanic-hafs/UthmanicHafs_V22.ttf` | QUL CDN `https://static-cdn.tarteel.ai/qul/fonts/UthmanicHafs_V22.ttf` (no login) | 297,700 | `aa68bffce289b4c0ebac68e90502eb69e42356abcd1603cb2b8e99c2c723f145` | Matches the official zip |
| `fonts/kfgqpc-official-site/UthmanTN_v2-0.ttf` / `UthmanTNB_v2-0.ttf` | `https://fonts.qurancomplex.gov.sa/wp-content/uploads/2022/12/UthmanTN_v2-0.ttf` (+ `UthmanTNB_v2-0.ttf`), via Wayback | 139,336 / 132,048 | `f4a2b776…1ba` / `c881678c…e38` | Family "KFGQPC Uthman Taha Naskh", v2.0 |
| `kfgqpc-hafs-smart-v4/kfgqpc_hafs_smart_4.zip` | portal `resources_dev/kfgqpc_hafs_smart_4.zip`, via Wayback | 22,705,385 | `e0db8d3ccb9889abe70606a70fef102f1e3a4646e682c0263ef9554775a05ffe` | MD5 `53d82b55…` and SHA-1 `1dbeae38…` equal the portal values. **Not usable:** `aya_text` is Private-Use-Area glyph codes (2,600 distinct PUA codepoints), not real Unicode. |
| `fonts/amiri-quran/Amiri-1.003.zip` (+ extracted) | https://github.com/aliftype/amiri/releases/download/1.003/Amiri-1.003.zip | 1,033,533 | `81af0aff7d2086d8af24cea7202f7546130997982534691373485cd96744d05e` | GitHub release 1.003 (2025-06-13) |

**The KFGQPC sites are unreachable from here.** fonts.qurancomplex.gov.sa, qurancomplex.gov.sa and dm.qurancomplex.gov.sa time out (curl) or refuse connections (WebFetch), apparently geo-restricted. The Wayback copies are verified by the portal's own checksums where the portal publishes them. The `UthmanicHafs_v22.zip` (font site) has no published checksum. Its TTF matches the QUL copy.

### 3.2 The official Unicode Hafs text

Sample from `hafsData_v2-0.json`:

```
{"id":1,"jozz":1,"page":1,"sura_no":1,"sura_name_en":"Al-Fātiḥah","sura_name_ar":"الفَاتِحة","line_start":2,"line_end":2,"aya_no":1,
 "aya_text":"بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ ﰀ","aya_text_emlaey":"بسم الله الرحمن الرحيم"}
```

- **Shape of the data:** 6,236 records, 114 suras, 604 pages, with Madinah page and line numbers per ayah.
- **Ayah markers:** every `aya_text` ends with an ayah-mark glyph from U+FC00–U+FD1D (286 distinct). These are Arabic presentation-form codepoints that the font repurposes as numbered medallions. Strip them for search and copy, and render the number yourself.
- **Codepoints:** the verse bodies use 73 distinct codepoints, all in U+0600–U+06FF plus space/NBSP. Sukun is U+06E1 (khah-head).
- **Cross-check with Quran.com `qpc_hafs` (see §5):**
  - 6,202 / 6,236 verses identical.
  - 33 differ only because Quran.com inserts a TATWEEL (e.g. 19:79 كـَلَّا).
  - 1 differs by a stray leading space in the official 2:6.
- **Cross-check with the V22 zip's docx:** the docx holds the full Quran text too. Its 6,236 parsed verses agree with Quran.com except the same 33 tatweels.
- **Word alignment with QAC:** space-splitting gives 77,430 words; 7 verses differ from QAC:
  - 2:181, 8:6, 13:37 — بعد ما split;
  - 37:130 — إل ياسين split;
  - 15:7 — لَّوۡمَا as one word, where QAC has two;
  - 27:20 and 36:22 — مَالِيَ as one word, where QAC has two.

  QPC also attaches waqf signs to words, with no standalone tokens.

### 3.3 Fonts: properties and rendering test

- **Name tables (from the files):**
  - `KFGQPC HAFS Uthmanic Script`: Version 2.2; 1,572 glyphs; DSIG-signed; OS/2 fsType 0 (installable embedding).
  - `kfgqpc_hafs_uthmanic_script` v2.0 (dev-portal package): same EULA.
  - `KFGQPC Uthman Taha Naskh` v2.0: 642 glyphs.
  - `Amiri Quran` 1.003: 1,446 glyphs.
- **Coverage:**
  - KFGQPC V22: 100% of Tanzil Uthmani (69/69 codepoints) and 100% of QPC Hafs (83/83).
  - Amiri Quran: 100% of Tanzil, but **misses U+065E** (used 1,807 times in QPC text).
  - Uthman Taha Naskh: misses ٱ, all waqf marks and the small high letters. It is a UI/body Naskh font, **not a Quran-text font**.
- **HarfBuzz rendering (`hb-view`, 2:2 and 73:4) — images read, findings:**
  - QPC text + V22: authentic Madinah look. Khah-head sukun, open tanween (هُدٗى), ۛ attached, and a plain Arabic-Indic number after an NBSP is drawn as the ayah-end medallion.
  - Tanzil text + V22: renders, but with round sukun, ordinary tanween and spaced waqf signs. Adding U+06DD before the digits draws a **second, empty medallion**, so with this font never use U+06DD.
  - Amiri Quran + Tanzil: clean Naskh rendering; a good open-licensed fallback.
- **Encoding facts:** KFGQPC fonts map U+0652 (2-contour round sukun) and U+06E1 (1-contour khah head) to different glyphs. So the text encoding, not the font, decides whether the Madinah sukun appears.

### 3.4 Licenses — verbatim

**KFGQPC font EULA**, name ID 13 inside `UthmanicHafs_V22.ttf`. The same terms are in `uthmanic_hafs_v20.ttf` and, with © 2008, in Uthman Taha Naskh:

> Permission is hereby granted, Free of Cost, to any person obtaining a copy of this Font accompanying this license, the rights to Use, Copy, Distribute, subject to the following conditions:
> 1. The Font Software cannot be Sold, Modified, Altered, Translated, Reverse Engineered, Decompiled, Disassembled, Reproduced or Attempted to discover the Source Code of this Font in no means.

Name ID 0 adds: "may not be reproduced, modified without the express written approval of King Fahd Glorious Quran Printing Complex."

**KFGQPC usage-rights page for its digital mushaf** (https://dm.qurancomplex.gov.sa/copyright/, Wayback 2024-05-18; the developer portal links to it as «سياسة حقوق الإستخدام»):

- Free use is permitted for individuals, government and private bodies, printing, publishing, «ومواقع الإنترنت والبرامج الحاسوبية», inside and outside Saudi Arabia.
- Printing mushafs inside the Kingdom, and importing them for commercial sale, is restricted by royal decree.

The data packages (`UthmanicHafs_v2-0.zip`) carry no separate text license beyond this page and the font EULA.

**Amiri:**

> This Font Software is licensed under the SIL Open Font License, Version 1.1.

No Reserved Font Name is declared (line 1 of `OFL.txt` is only "Copyright 2010-2022 The Amiri Project Authors"). So subsetting and WOFF2 conversion are allowed.

## 4. QUL — Quranic Universal Library (https://qul.tarteel.ai/resources)

- **Catalogue on 2026-10-02 (counts from the listing pages):**
  - Quran Script 30 — includes "KFGQPC Hafs script – Word by word" (#312), "QPC Hafs script – Ayah by Ayah" (#86), Digital Khatt, Indopak, Warsh, and V1/V2/V4 glyph codes.
  - Fonts 22 — QPC Hafs font #245 in TTF/WOFF2/font pack, QPC V1/V2/V4, Digital Khatt, surah-name fonts, Warsh/Qaloun/Douri/Sousi/Shuba.
  - Mushaf layouts 12 — KFGQPC V1 1405H, V2 1421H, V4 1441H, Indopak, Qatar…
  - Translations 205, of which 13 are word-by-word: English, Urdu, Bengali, Indonesian, Turkish, Persian, Hindi, Tamil, French, German, Russian, Ingush, colored English. **There is no Arabic word-by-word meaning dataset.**
  - Tafsir 108 — includes Arabic gharīb/word-level works: «السراج في بيان غريب القرآن» #250, «الميسر في غريب القرآن» #519, «تحليل كلمات القرآن» #487, plus i'rab works #504/#506/#515/#520.
  - Recitations 133 (with segments/timings).
  - Others: transliteration 8, metadata 8, surah info 6, plus topics, themes, mutashabihat and similar-ayah (1 each).
  - **Morphology 6:** word root #76, word lemma #75, word stem #77, ayah root/lemma/stem #482/#483/#481, all SQLite. The root DB has tables `roots` (id, arabic_trilateral, english_trilateral, words_count, uniq_words_count) and `word_roots`. The lemma DB has `lemmas` and `word_lemmas`.
- **Access:** every dataset download link points to `/users/sign_in`, so a **free account is required for all data downloads**; I did not create one. Files on the public CDN can be fetched directly, e.g. `https://static-cdn.tarteel.ai/qul/fonts/UthmanicHafs_V22.ttf`. QUL states it has no API.
- **License notes:** the resource detail pages I checked (#76, #75, #77, #245, #312, #86, #250, #487, #519) show **no per-resource license text**, only the footer "Terms of use" link to https://www.tarteel.ai/terms. That page is client-rendered; neither curl nor WebFetch returned its text, and the archived copy is compressed. **The terms remain unread.** QUL's docs FAQ answers the commercial question only with "Check repository license terms and dataset-specific licensing details" (https://qul.tarteel.ai/docs/faq). The GitHub repo (TarteelAI/quranic-universal-library) is MIT, which covers the code only.
- **Is QUL's morphology newer or independent?** No.
  - QUL Credits (https://qul.tarteel.ai/credits) thank Dr. Kais Dukes "for preparing the original digitized Quran morphology data" and Mustafa Jibaly "for improving and providing Quran morphology data".
  - The preview shows القرآن → «ق ر ا» (QAC-style hamza-as-alif).
  - So QUL morphology is the QAC/mustafa0x lineage with roots, lemmas and stems only (no full POS/feature export).
  - The «تحليل كلمات القرآن» tafsir (#487; the same text is served at tafsir.app/ayah-morph) is an Arabic prose rendering of the **mustafa0x** data. Spot checks match mustafa0x's distinctive changes: 2:8 الناس → (أنس), 2:31 آدم → (أدم), 107:7 الماعون → (عون).
  - "Ayah Dependency Graphs" (#563) is labelled experimental and incomplete, derived from the QAC treebank.

## 5. Quran.com API v4 / Quran Foundation

**Still reachable without a key** (2026-10-02, HTTP 200, Cloudflare-cached):

- `https://api.quran.com/api/v4/verses/by_key/1:1?words=true&word_fields=text_uthmani,text_qpc_hafs`
- `https://api.quran.com/api/v4/quran/verses/uthmani`
- `https://api.quran.com/api/v4/quran/verses/qpc_hafs`
- the `api.qurancdn.com/api/qdc/...` equivalents

**No roots, lemmas or stems** are exposed in word fields (tested `word_fields=root,lemma,stem`, which returned nothing).

Saved in `quran-com-api-v4-text/`:

| File | Bytes | sha256 |
|---|---|---|
| `quran_verses_qpc_hafs_all.json` (6,236 verses) | 1,680,614 | `d6464a96…e36e` |
| `quran_verses_uthmani_all.json` (6,236 verses) | 1,654,246 | `3754c592…58c` |
| `verse_1_1_words_qpc.json` | 2,165 | `120de923…2fd` |
| `verse_2_8_words_qpc.json` | 4,951 | `40a4afad…452` |


Sample:

```
{"verses":[{"id":1,"verse_key":"1:1","text_qpc_hafs":"بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ ١"}],...}
```

**Current state of the Quran Foundation API:**

- The new Content API (`https://apis.quran.foundation/content/api/v4/...`) needs OAuth2 client credentials (`grant_type=client_credentials&scope=content`) and `x-auth-token` + `x-client-id` headers on every request.
- The migration guide calls the legacy base "the older unauthenticated API" but gives no sunset date.
- Developer Terms: https://api-docs.quran.foundation/legal/developer-terms/, last updated 2026-09-26.
- The license is "non-exclusive, revocable, non-transferable, non-sublicensable".
- The Terms prohibit three things:
  - caching or storing QF Content "longer than 1 week" (unless through Content Sync);
  - redistributing QF Content as a dataset, API or download without a signed commercial license;
  - modifying the Quran text.
- On termination, QF Content must be deleted.
- Under these terms no Quran Foundation content is kept: the API samples fetched for this research were removed from `data/raw`, and the official KFGQPC file in §3 is the display text (the same text minus 33 tatweels).

## 6. Cross-validation sources for root attribution

### 6.1 Tested and found to be QAC-derived (not independent)

- **openislam.org/root_words:** 1,670 links = 28 letter headers + **1,642 roots (1,602 + 40)**, exactly the QAC 0.4 inventory. The site states "Nothing here is copyright."
- **tafsir.app «تحليل كلمات القرآن» and QUL #487:** this is mustafa0x (see §4).
- **GitHub "root" repos:**
  - kwanite/quran-roots-dictionary, jawadshuaib/quran-analyzer (1,642 roots / 4,832 lemmas) and R3GENESI5/quran-bil-quran (1,651) are QAC or mustafa0x;
  - aliozdenisik/quran-arabic-roots-lane-lexicon (1,651) is mustafa0x plus Lane.
- **Owner CSV (`Example Data/Quran DB - Clean Roots.csv`, 77,431 rows):**
  - Roots are QAC-like (الناس → نوس, الماعون → معن).
  - It also contains non-QAC fillers: محمد → حمد, مدين → مدين, and particles given pseudo-roots (من, ما, الا…; 1,799 "roots").
  - Provenance and license are unknown, so it cannot be a licensed cross-check. Our own reconciliation (`docs/DATA-VALIDATION.md`): 49,085 roots agree with the corpus, 882 differ.

### 6.2 Independent or partly independent, usable

| Source | What it gives | Independence | License (verbatim/short) | Downloaded | Result |
|---|---|---|---|---|---|
| **AlKhalil Morpho Sys 2** via `farahidi` 0.3.1 (PyPI; https://github.com/forzagreen/farahidi) | root, lemma, stem, **pattern (wazn)**, POS, clitics, for every candidate analysis | Rule- and lexicon-based analyzer (Oujda NLP Team). It does not use QAC. | farahidi README: "licensed under the **GPL-3.0-or-later**, because it bundles and derives from AlKhalil Morpho Sys 2's GPL-3.0 linguistic data". Using it "places no obligations on your own code or its outputs". | Installed in a scratch venv only, not committed | **Pilot:** 3,000 random root-bearing QAC tokens, aligned to Tanzil Simple in the 5,869 verses whose token counts match. Top-1 root = QAC on **91.3%**; QAC's root among the candidates on **98.5%**; no analysis on **6.2%**. Disagreements are mostly known scholarly splits: اتخذ أخذ/تخذ, شيطان شطن/شيطن, ابن بني/بنو, سلطان سلط/سلطن, اطمأن طمن/طمأن. |
| **linuxscout/quran_word_index** v0.5.2 (Taha Zerrouki; used by Alfanous) | type-level index: unvocalised word form → root, lemma (مصدر), type; 11,829 forms | The README says «مراجعة يدويا» (manually reviewed). Its noisy errors (تكن → كنن, أمين → ءمم) point to a non-QAC pipeline. | GPL-3.0 (GitHub repo license) | `linuxscout-quran-word-index/quran_word_v0.5.2.csv`, 648,087 B, `56265200…da40` | It matched 36,029 QAC tokens. Root agreement is 89.6% with QAC 0.4 and 88.9% with mustafa0x. The largest "disagreement" is convention (الله as its own root, 2,153 tokens). |
| **MASAQ** v6 (Sawalha, Yagi, Alshargi, Hammo, Alshdaifat), https://data.mendeley.com/datasets/9yvrzxktmr/6, DOI 10.17632/9yvrzxktmr.6 | segmentation, 133 morph tags, i'rab roles, case/mood, gloss. **No roots or lemmas.** | Expert-annotated with traditional i'rab on the Tanzil text; the paper names no QAC source | Mendeley metadata: **CC BY-NC 3.0** ("do not use the material for commercial purposes"). The paper (PMC11741905) says CC BY 3.0, so the two **conflict**. | `masaq-mendeley-v6/MASAQ.tsv`, 18,650,409 B, sha256 `aac224f1…a931` = Mendeley's published hash | 157,676 rows, 77,411 words, 6,236 verses. Word count differs from QAC in 10 verses. Use it to cross-check POS and segmentation, not roots. |
| **al-Mu'jam al-Mufahras** (Muhammad Fu'ad 'Abd al-Baqi) | the classical root-ordered concordance with occurrence lists | Fully independent, human | Print work; only PDF scans on archive.org; no machine-readable dataset found | No | Manual arbiter for disputed items |
| **Lane / Lisan al-'Arab** (another agent covers these in `data/raw/lexica/`) | root entries | Independent, classical | Lane digital edition CC BY-SA 3.0 (Perseus); Lisan is public domain | (lexica agent) | Check that every root exists as an entry and that the lemma appears under it |

## 7. Licensing restriction matrix

| Source | (a) Display on our site | (b) Redistribute via our public API / data downloads | (c) Modify / correct |
|---|---|---|---|
| Tanzil text | Yes, with the source named and a link to tanzil.net | Yes, verbatim, with the full notice block in every file | **Blocked** for the text itself. Keep it byte-verbatim. Search-normalised shadow columns are derived data and must carry the notice; they must never be shown as "the Tanzil text". |
| QAC 0.4 | Yes, with the source named and a link to corpus.quran.com | Verbatim file: yes (GPL + notice). A derived dataset must keep the notice and, under GPL copyleft, be released GPL-3.0-compatible. **Flag:** the FAQ's non-commercial wording conflicts with commercial reuse. | **Conflict:** the header forbids changing the file. GPLv3 §7 lets recipients drop "further restrictions", but relying on that is a legal call for the owner. Safe path: keep the file pristine and publish corrections as a separate, clearly labelled overlay (ours, with reasons), never as "QAC". |
| mustafa0x fork | Risky: the repo has no license, so his changes are all-rights-reserved by default, on top of the QAC terms | Not without the author's permission | n/a — use only as a reference list of disputes |
| QAC v2 data (kaisdukes API) | Same as QAC; the repo has no license | Treat as QAC terms | Reference only |
| KFGQPC Hafs font | Yes. Serving the unmodified TTF as a web font counts as Use/Copy/Distribute. | Only the unmodified file with its embedded EULA; never sold | **Blocked:** no WOFF2 conversion, subsetting or renaming |
| KFGQPC Unicode Hafs text (official v2.0 data) | Yes (usage page: websites and software allowed) | Probably yes, verbatim with attribution. No explicit data license, so confirm with KFGQPC (info@qurancomplex.gov.sa) before shipping bulk downloads. | Not addressed. Keep verbatim; strip the ayah-mark glyphs only in derived fields. |
| Amiri Quran (OFL 1.1) | Yes | Yes, with OFL.txt | Yes; no RFN, so WOFF2 and subsetting are OK |
| Quran.com / QF API | Only live, ≤1-week cache, inside the app | **Blocked** without a signed commercial license | **Blocked** (Quran text must not be modified) |
| QUL datasets | Per resource; no license shown; terms unread | Unknown — requires reading the Tarteel terms and per-resource provenance | Unknown |
| MASAQ | Yes, non-commercial, attributed | NC only, so it blocks any commercial distribution | Allowed (CC BY-NC permits adaptation), attributed and NC |
| AlKhalil / farahidi | Tool outputs are ours | Outputs unencumbered per the README; shipping the analyzer itself would be GPL-3.0 | Yes |
| linuxscout index | Yes | GPL-3.0 copyleft on the data | Yes, under GPL-3.0 |

## 8. Recommendation

1. **Canonical display text: the official KFGQPC Hafs Unicode text** (`kfgqpc-uthmanic-hafs-v2-0/.../hafsData_v2-0.json`, verse bodies with the trailing ayah-mark glyph removed and the number rendered by us). It is the KFGQPC's own digital text for the Madinah mushaf, it carries page and line data, and its MD5 and SHA-1 match the publisher's checksums. Fix the stray leading space in 2:6 in a derived field, never in the stored original.
2. **Canonical verification and morphology key: Tanzil Uthmani 1.1 (XML).** Store it verbatim, use it for the QAC alignment, and checksum it in CI. Keep a per-word mapping table between Tanzil, QPC and QAC word indices with the documented exceptions:
   - Tanzil ↔ QAC: 4 verses (2:181, 8:6, 13:37, 37:130);
   - QPC ↔ QAC: 7 verses (those 4 plus 15:7, 27:20, 36:22);
   - basmala tokens in Tanzil txt.
3. **Font:** `KFGQPC HAFS Uthmanic Script` V2.2 (`UthmanicHafs_V22.ttf`, sha256 `aa68bffc…`), served byte-identical from our own origin. Take it from the KFGQPC zip, not from QF endpoints, so QF terms do not attach. Fallback, and the font for any context where a modified or subset font is needed: **Amiri Quran** (OFL) with the Tanzil text. UI Arabic: KFGQPC Uthman Taha Naskh is fine for headings and body, but not for Quran text.
4. **Primary morphology: QAC 0.4**, byte-pristine (`a1d12923…`). Our corrections and policy decisions live in a separate overlay table: location, field, QAC value, our value, reason, reference, reviewer.
5. **Cross-check every root attribution with at least two checks that are independent of QAC:**
   - **AlKhalil** (farahidi) on every root-bearing token; for the 6.2% with no analysis, use the unvocalised and Uthmani-normalised forms;
   - **the classical lexicon gate**: the root must exist in Lane or Lisan, and the lemma must appear under it;
   - **linuxscout** as a third, type-level vote;
   - the **757 mustafa0x deltas** pre-flagged as "disputed";
   - human review against 'Abd al-Baqi's al-Mu'jam al-Mufahras for every disagreement.

   Take the wazn from AlKhalil's `pattern_lemma`, then review it, because QAC lacks noun patterns.
6. **Do not use:** the Hafs Smart package (PUA glyph codes), qurancorpus.app (domain lapsed), Quran.com/QF as a data source (1-week cache rule), the owner CSV as a licensed source, or MASAQ for anything commercial.

### 8.1 Attribution text each license requires (Arabic first, the site's default)

- **Tanzil** (must name the source and link to tanzil.net; the full notice goes in every data file we ship): «نص القرآن الكريم (للتحقق والمحاذاة): مشروع تنزيل — tanzil.net» linked to https://tanzil.net. In downloads, include the full notice block of §2.3 unchanged.
- **QAC** (must name the source and link to corpus.quran.com; the notice is reproduced in derived works): «التحليل الصرفي مبني على المدونة القرآنية العربية (Quranic Arabic Corpus) © 2011 Kais Dukes — رخصة GNU GPL — corpus.quran.com» linked to http://corpus.quran.com. Any dataset we publish must carry the §1.5 block and state that our corrections are a separate layer, not part of QAC.
- **KFGQPC font and text** (no attribution clause; the embedded EULA must stay intact; courtesy credit recommended): «الخط والنص القرآني الرقمي: مجمع الملك فهد لطباعة المصحف الشريف — qurancomplex.gov.sa».
- **Amiri Quran** (OFL: ship OFL.txt with any redistribution): «خط أميري قرآن © The Amiri Project Authors — SIL OFL 1.1».
- **AlKhalil, if outputs are shown or cited:** «تحقق صرفي آلي: الخليل الصرفي 2 (Oujda NLP Team) عبر farahidi — GPL-3.0».
- **MASAQ, if used** (non-commercial only): «MASAQ — Sawalha et al., Mendeley Data, DOI 10.17632/9yvrzxktmr.6 — CC BY-NC 3.0».

## 9. Licence quotes re-verified at the source (2026-10-02)

Tanzil (tanzil.net/docs/Text_License and the file footer), QAC (download page, license.jsp, file header, FAQ), KFGQPC font EULA (inside the font file), QF Developer Terms (updated 2026-09-26; it carries the explicit 1-week cache and no-dataset clauses). The KFGQPC usage page could only be read via Wayback (2024-05-18).

## 10. Housekeeping notes (flagged, not acted on)

- **Duplicate copies in `data/raw`** (same bytes):
  - `qac/quranic-corpus-morphology-0.4.txt` = `qac-morphology-0.4/…`;
  - `fonts/UthmanicHafs_V22.ttf` = `fonts/kfgqpc-uthmanic-hafs/UthmanicHafs_V22.ttf`;
  - `tanzil/quran-uthmani.txt` = `tanzil/quran-uthmani-nomarks.txt`. Another process overwrote the earlier marks variant, which now lives at `quran-uthmani-marks-sajdah.txt`.
- **QF-sourced files** past the 1-week cache rule: delete `quran-com-api-v4-text/*.json` and `qpc/qpc-hafs-via-qul.json` by 2026-10-09, or record an explicit owner decision.
- **Missing project files:** the project has no `docs/PLAN.md` or `docs/DECISIONS.md` yet, and I was told not to write outside `data/raw` and `docs/research`, so the decisions above are not logged there.

## 11. Pending, and who owns it

- **Owner:** decide the QAC licensing posture. Options: (i) treat QAC as GPL-3.0 and drop the "no changes" clause under GPLv3 §7; (ii) ask Kais Dukes or the quran.com team (corpus maintainers) for written permission to publish a corrected derivative and to use it commercially; or (iii) never redistribute QAC-derived data and only display it. This is a legal decision; I recommend (ii).
- **Owner:** ask KFGQPC (info@qurancomplex.gov.sa) to confirm that redistributing the Unicode Hafs text through our public API is allowed. The usage page covers websites and software, but not data redistribution explicitly.
- **Owner:** create a free QUL account if QUL datasets are wanted (all data downloads are login-gated), and read https://www.tarteel.ai/terms in a browser. I could not read it non-interactively; the browser tool needs a browser selection that only the owner can make.
- **Owner:** delete the two QF-sourced files by 2026-10-09 (§5).
- **Next build step (engineering):**
  - run AlKhalil over all 49,967 root-bearing tokens;
  - build the Tanzil↔QPC↔QAC word map with the 7 documented exceptions;
  - apply the lexicon gate.

  The scripts used here are in the session scratchpad (`analyze_qac.py`, `cmp_norm.py`, `tanzil_cmp*.py`, `qpc_align.py`, `farahidi_pilot.py`, `kfg_cmp.py`, `docx_cmp.py`, `fontinfo.py`). They should be moved into the repo when the pipeline is built.
