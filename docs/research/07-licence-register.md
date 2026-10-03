# 07 — Licence register: every source's terms, re-read

**Update, later on 2026-10-03.** The register now covers every registry the product reads — `sources`, `lexica`, `works`, `recitations`, `patterns`, `particles`, `gharib`, `relations` and `knowledge` — 62 entries and 439 clauses: ok 6 · attention 43 · conflict 13. Each entry added since the first run had every quote checked against its live page by `jadhr_pipeline.licence_check` (the four new dictionaries 28/28, the relation and knowledge sources 127/127, the pattern, particle and gharīb works by their builders). The new conflicts are the four Shamela dictionaries (D22), as Lisān; the new attention items are listed in their `notes`. The rest of this document is the first run's record.

Re-read on 2026-10-03 (local time; the fetch run was 2026-10-02 22:22–22:43 UTC) for PLAN P1.8. The machine-readable register is `data/licences.yaml`: one entry per source id in the four registries, with every page checked, the sha256 of the bytes it returned, the governing clauses quoted verbatim, what the product does with the source, a status and notes. It is re-checked before every release. This is a licensing record, not legal advice; nothing here decides D2, D19 or D22 — it puts the facts in front of the owner.

**Method.** Every terms page, licence file (at the pinned commit and at HEAD where a repository has one), dataset card, file header and API listing was fetched with a generic User-Agent and no identity, saved and hashed. Pinned data files were re-downloaded where the source still serves them, to see whether the source has moved on. Hosts that did not answer were read from their latest Wayback Machine capture, and the register says so. All 210 quoted clauses were machine-checked against the bytes fetched from their URL (whitespace normalised, nothing else); the check fails on a single changed character. `uv run python pipeline/tests/test_licences.py` (also part of pytest) proves that every registry id has an entry and every entry quotes at least one clause with its URL.

## Outcome

39 entries: **ok 2 · attention 28 · conflict 9.** The two that are fully in order are the Tanzil simple-clean text and the Rowwad translation. Nothing has changed at any source since our research: every pinned file we re-downloaded (the KFGQPC data and font, four Tanzil files, the corpus v0.4 file and the author's revision, the mustafa0x fork, the four QuranEnc files, Lane, quran-align) is byte-identical to today's copy, the two pinned revisions we could not re-download file by file (tafsir_api v1.2.2, the Shamela 4 dataset) are still the HEAD of their repositories, and every terms page says what it said. So the findings below are about how we use the sources and what our records say, not about upstream changes. The ones that matter most:

- **The bulk release mislabels corpus text as KFGQPC text.** `words.text_uthmani` and `segments[].text` are the corpus's FORM column — Tanzil Uthmani 1.0.2 text under a "Creative Commons BY-ND 3.0 Unported" notice — converted from Buckwalter. The release labels that file "KFGQPC … reproduced verbatim", and it carries neither the corpus copyright notice nor the Tanzil 1.0.2 notice (`qac`).
- **The corpus author's revision has no licence.** The pinned files come from `kaisdukes/quranic-corpus-api`, which has none; our registry and the release cite the GPL-3.0 of a different repository, the frontend `kaisdukes/quranic-corpus` (`qac-v2`).
- **Recitations are not credited the way their licences require.** Neither EveryAyah (CC BY-NC 2.5 Canada) nor quran-align (CC BY 4.0) appears on /sources or in any API response, and the player's credit names them without a licence or a link — although /developers promises "the source and license of every piece of data" (`everyayah`, `quran-align`, every reciter).
- **One reciter's audio may not be EveryAyah's to license.** The Sudais files say "Original MP3s from QuranicAudio.com", whose terms allow personal use only (`sudais`). Two other reciters trace to MP3Quran.net, which opens all rights; one to AllahsQuran.com, which states nothing.
- **The Shamela lexica rest on a self-contradicting dataset card** ("license: mit" against "Research and personal use") and on a Shamela terms page that grants nothing; our lexica.yaml still records only the MIT tag (five lexica, D22).
- **Tanzil's metadata goes into the release without Tanzil's name.** The verses file carries Tanzil's juz, hizb-quarter and sajda tables (CC BY) while the MANIFEST credits only KFGQPC and the corpus (`tanzil-uthmani`).
- **KFGQPC's terms are thinner than our record says.** The usage page that allows websites and software presents itself as covering the vector (Illustrator) mushaf; the Unicode data package states no licence; "may not be modified or sold" in our registry is the font EULA's wording, not anything KFGQPC says about the text (`qpc-hafs`). The font EULA itself both grants copying and forbids reproduction (`kfgqpc-hafs-font`).
- **Lane's required credit is missing in Arabic**, the default locale: the Arabic attribution drops Perseus's credit sentence and the licence URL (`lane`).

**Could not reach:** qurancomplex.gov.sa (developer portal), dm.qurancomplex.gov.sa (usage rights) and fonts.qurancomplex.gov.sa all time out from here — read from their latest Wayback captures (2025-09-01, 2024-05-18, 2026-02-08 and 2025-12-06). EveryAyah's licence page (versebyversequran.com/site/license) now returns 404 — read from its last good capture, 2012-10-21. The Tarteel terms page that QUL links as its "Terms of use", which research 01 could not read, was read this time from the data embedded in the page.

## The register

| Source id | Registry | Status | Reason |
|---|---|---|---|
| qpc-hafs | sources | attention | Usage page covers the vector mushaf; the data states no licence; bulk release not addressed; our "no modify/sell" wording is the font's |
| kfgqpc-hafs-font | sources | conflict | EULA grants "Use, Copy, Distribute" yet forbids "Reproduced"; name ID 0 needs written approval to reproduce |
| tanzil-uthmani | sources | attention | Release carries Tanzil's CC BY metadata without crediting Tanzil |
| tanzil-simple-clean | sources | ok | Unchanged, pin matches, used verbatim as a search fallback, credited with a link |
| qac | sources | conflict | GPL vs "CHANGING IT IS NOT ALLOWED" vs FAQ non-commercial; release changes the data, omits the notice, mislabels its text |
| qac-v2 | sources | conflict | Data repository has no licence; we cite another repository's GPL-3.0 |
| qac-wbw | sources | attention | Display terms met; licence_url points to the bare GPL page; non-commercial wording ties it to D2 |
| qac-fork-mustafa0x | sources | attention | No licence; a changed copy of a no-change file, shown as a credited cross-check |
| quranenc | sources | attention | Seven conditions unchanged; version numbers unavailable for two works; commercial use not addressed |
| tafsir-api-qul | sources | attention | MIT covers code only; QUL holds no copyright information for any of our five texts |
| mufradat | lexica | conflict | Card: "license: mit" vs "Research and personal use"; Shamela grants nothing; Dawudi edition |
| maqayis | lexica | conflict | Same card conflict; Harun edition (d. 1408 AH) |
| lisan | lexica | conflict | Same card conflict; Dar Sadir edition |
| sihah | lexica | conflict | Same card conflict; Attar edition |
| ibn-qutaybah-gharib | lexica | conflict | Same card conflict; Saqr edition |
| lane | lexica | attention | Modifications not offered to Perseus; availability statement not carried; Arabic credit incomplete |
| muyassar | works | attention | QuranEnc publishes no version number; we show a file date |
| mukhtasar | works | attention | QuranEnc publishes no version number; we show a file date |
| saheeh | works | attention | We drop the "(n) " verse prefix QuranEnc's file carries (its own API drops it too) |
| rwwad | works | ok | Current version, unmodified, publisher, source and version shown |
| saadi | works | attention | No licence in the chain; author d. 1956 (life + 70 only from 2027-01-01); edition unnamed |
| baghawi | works | attention | Public-domain author; the modern edition behind QUL's text is not identified or cited |
| ibn-kathir | works | attention | Public-domain author; the modern edition behind QUL's text is not identified or cited |
| qurtubi | works | attention | Public-domain author; the modern edition behind QUL's text is not identified or cited |
| tabari | works | attention | Public-domain author; the modern edition behind QUL's text is not identified or cited |
| everyayah | recitations | attention | Licence known only from a 2012 archive; no licence link or EveryAyah link in the product |
| quran-align | recitations | attention | CC BY 4.0 attribution and modification notice missing from the player and the API |
| alafasy | recitations | attention | EveryAyah's terms only; the shared credit gap |
| husary | recitations | attention | EveryAyah's terms only; the shared credit gap |
| husary-muallim | recitations | attention | ID3 points to AllahsQuran.com, which states no licence; the shared credit gap |
| minshawy-murattal | recitations | attention | EveryAyah's terms only; the shared credit gap |
| minshawy-mujawwad | recitations | attention | From MP3Quran.net (all rights open); the shared credit gap |
| abdulbasit-murattal | recitations | attention | EveryAyah's terms only; the shared credit gap |
| abdulbasit-mujawwad | recitations | attention | EveryAyah's terms only; the shared credit gap |
| sudais | recitations | conflict | "Original MP3s from QuranicAudio.com" — personal use only upstream |
| shuraym | recitations | attention | EveryAyah's terms only; the shared credit gap |
| shaatree | recitations | attention | EveryAyah's terms only; the shared credit gap |
| rifai | recitations | attention | EveryAyah's terms only; the shared credit gap |
| tablaway | recitations | attention | From MP3Quran.net (all rights open); the shared credit gap |

## Sources that need the owner

Each section gives the clauses that decide the question (verbatim; the URL of each is in `data/licences.yaml`), what we do today, and what is the owner's to decide or do. Engineering fixes that need no decision are collected at the end.

### qpc-hafs — the KFGQPC Quran text (attention)

The usage-rights page (Wayback, 2024-05-18) opens by saying what it covers, then grants use:

> يتشـرَّف المجمع بإتاحة نسخة رقمية كاملة من مصحف المدينة النبوية المطبوع في المجمع، وذلك بالصيغ التالية:

> رسم المتجهات Illustrator

> ويمكن استخدام النسخة المذكورة مجاناً في المجالات الشخصية والأعمال الفردية كافة، وأعمال الجهات الحكومية والجهات والمؤسسات الخاصة والأهلية، وأعمال الطباعة الورقية*، والنشـر المكتبي والإعلامي، ومواقع الإنترنت والبرامج الحاسوبية وغيرها، وذلك داخل المملكة العربية السعودية وخارجها.

The developer portal (Wayback, 2025-09-01), which hosts the Unicode data we use, points to that page for printing and publishing and otherwise reserves rights:

> جميع الحقوق محفوظة لمجمع الملك فهد لطباعة المصحف الشريف © 2025

The data package's read.me (version 2.0, 2022-09-07) states no licence. Our registry's "the text may not be modified or sold" is not stated anywhere for the text; it is the font EULA's wording.

We display the text verbatim, serve it verse by verse through the public API, and write the whole text into the bulk release. **Owner:** before the release is published, ask KFGQPC to confirm that redistributing the Unicode text verbatim through a public API and data download is allowed (already on research 01's list, D19). Display on the site rests on the usage page's "websites and software" wording as today.

### kfgqpc-hafs-font — the KFGQPC Hafs font (conflict)

> Permission is hereby granted, Free of Cost, to any person obtaining a copy of this Font accompanying this license, the rights to Use, Copy, Distribute, subject to the following conditions:

> 1. The Font Software cannot be Sold, Modified, Altered, Translated, Reverse Engineered, Decompiled, Disassembled, Reproduced or Attempted to discover the Source Code of this Font in no means.

> All rights reserved. This Font is the property of King Fahd Glorious Quran Printing Complex, and may not be reproduced, modified without the express written approval of King Fahd Glorious Quran Printing Complex.

The grant allows copying and distributing; condition 1 and name ID 0 forbid reproducing. A web font is copied to every visitor. We serve the file byte-identical (never converted or subset), so the no-modification condition is met. The KFGQPC font page (Wayback, 2025-12-06) still lists version 2.2, our file. **Owner:** accept the common reading — the grant covers distributing the unmodified file, as quran.com and QUL do — or ask KFGQPC for a written confirmation (D19).

### tanzil-uthmani — Tanzil text and metadata (attention)

> This Quran text can be used in any website or application, provided that its source (Tanzil Project) is clearly indicated, and a link is made to tanzil.net to enable users to keep track of changes.

> Permission is granted to copy and distribute verbatim copies of this text, but CHANGING IT IS NOT ALLOWED.

> `<quran type="metadata" version="1.0" copyright="(C) 2008-2009 Tanzil.info" license="cc-by">`

The text itself is not displayed and is credited with a link on /sources. The juz, hizb-quarter and sajda tables from quran-data.xml are in the site, the API and the release's verses file; the release MANIFEST credits only KFGQPC and the corpus. That is an engineering fix (below), not a decision. **Owner:** nothing now; when the waqf layer (P3.9) keys Tanzil's pause marks onto our words, check it against the no-change term before it ships.

### qac — the Quranic Arabic Corpus morphology (conflict)

The file header and download page:

> Permission is granted to copy and distribute verbatim copies of this file, but CHANGING IT IS NOT ALLOWED.

> This annotation can be used in any website or application, provided its source (the Quranic Arabic Corpus) is clearly indicated, and a link is made to http://corpus.quran.com to enable users to keep track of changes.

> This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all works derived from or containing substantial portion of this file.

The licence it names (GPL v3, on license.jsp), section 7:

> If the Program as you received it, or any part of it, contains a notice stating that it is governed by this License along with a term that is a further restriction, you may remove that term.

The FAQ:

> The final aim of the project will be to produce a highly accurate annotated Quran available freely for non-commercial use under the GNU public license.

And inside the same file, for the text its FORM column is built on:

> Tanzil Quran Text (Uthmani, version 1.0.2)

> License: Creative Commons BY-ND 3.0 Unported

Display in the word panel with credit and link meets the terms. The bulk release does three things the terms do not cover: it ships changed, derived data (script converted, segments restructured); it paraphrases the notice instead of reproducing "Copyright (C) 2011 Kais Dukes" and its terms block; and its words file labels `text_uthmani` as KFGQPC text "reproduced verbatim" when it is the corpus's Tanzil 1.0.2 text, converted. PLAN P1.8's "the corpus's bundled Tanzil 1.0.2 is read by nothing" holds for a separately bundled copy, not for this column. **Owner:** the research-01 decision is still open — treat the corpus as GPL and rely on §7, ask the maintainers (the quran.com team) for permission to publish a derived, corrected dataset, or keep corpus-derived data out of the release (D19, and D2 for the non-commercial wording). Until then the release should not be published with corpus-derived columns; the notice and label fixes are engineering.

### qac-v2 — the corpus author's revision (conflict)

Our pinned morphology.txt and lemmas.txt equal the HEAD (17a90624) of kaisdukes/quranic-corpus-api. GitHub's answer for that repository, and its README:

> `"license":null`

> This repo contains the backend server API for the Quranic Arabic Corpus 2.0.

The licence our registry and release cite is the LICENSE of kaisdukes/quranic-corpus, the frontend repository, which holds no data files:

> GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007

We show its root variants and lemma glosses and write both into the release under "GPL-3.0". **Owner:** decide whether the revised glosses and variants stay in the release before Kais Dukes is asked (D19); the corrected licence record is engineering.

### qac-wbw — corpus word-by-word glosses (attention)

> The Quranic Arabic Corpus is available under the GNU public license with terms of use.

> It should be emphasised that the English translation in the word by word section of the website is not a new translation of the text. Corresponding English words are based on standard and accepted sources of English translation of the Quran, including: Sahih International Mohammed Pickthall Yusuf Ali

Display with credit and a per-word link is met; the glosses are not in the release. **Owner:** the FAQ's non-commercial wording binds this layer to D2; the planned message to the corpus maintainers (D19) should ask about API exposure and about the glosses' basis in Sahih International.

### qac-fork-mustafa0x — community corrections (attention)

> `"license":null`

> This is a fork of [Quranic Arabic Corpus Morphology v0.4](http://corpus.quran.com),

No licence (LICENSE is 404 at HEAD); it is a changed copy of a file whose terms forbid changing it, and it does not carry the corpus notice. We show only its root and lemma differences, credited, as a cross-check, and keep them out of the release. **Owner:** keep as is, or ask the author (furqan.co) under D19.

### quranenc, muyassar, mukhtasar, saheeh — QuranEnc and three of its works (attention)

> Contents of the translations can be downloaded and re-published, with the following terms and conditions:

> 1. No modification, addition, or deletion of the content.

> 3. Mentioning the version number when re-publishing the translation.

> 6. Updating the translation according to the latest version issued from the source (QuranEnc.com).

> 4. إبقاء معلومات نسخة الترجمة الموجودة داخل المستند.

All four SQLite files are byte-identical to today's downloads, so we are on the latest versions. al-Muyassar and al-Mukhtasar have no version number anywhere on QuranEnc (absent from its translations list and its API answers); we show the file date 2025-03-25. For Saheeh International we drop the "(n) " verse number every row starts with; QuranEnc's own API serves the same verse without it:

> In the name of Allāh,[2] the Entirely Merciful, the Especially Merciful.[3]

The terms do not address commercial use. **Owner (D19):** one message to QuranEnc asking (1) the version numbers of arabic_moyassar and arabic_mokhtasar, (2) that dropping the verse-number prefix is acceptable, (3) that re-publication through a public API is covered, and (4) commercial use if D2 ever turns commercial.

### tafsir-api-qul, saadi, baghawi, ibn-kathir, qurtubi, tabari — QUL tafsirs via tafsir_api (attention)

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction,

> Yes, you can use QUL data in commercial projects. However, please review the licensing terms for each resource. Some data may have restrictions or require attribution, while others are freely available for commercial use.

QUL's copyright notice for each of our five resources (308, 27, 22, 23, 37):

> We don’t have copyright information for this resource.

The "Terms of use" QUL links, tarteel.ai/terms (last updated April 2, 2021) — app terms that do not clearly reach QUL data:

> You shall not (a) copy the Services or any part, feature, function or user interface thereof

There is no grant anywhere in the chain; the basis is the authors' public-domain status. al-Sa'di died in 1376 AH / 1956: public domain under life + 50, and in life + 70 countries only from 2027-01-01. For the four classical works the authors are long in the public domain, but the inline editor footnotes we strip show the digital text comes from modern critical editions, and neither QUL nor works.yaml names them — unlike the lexica, whose editions we cite. **Owner (D22):** have the editions identified and cited, or accept the risk; for al-Sa'di, decide whether to wait for 2027-01-01 before relying on him in life + 70 markets.

### mufradat, maqayis, lisan, sihah, ibn-qutaybah-gharib — Shamela typings via Hugging Face (conflict)

The dataset card, unchanged since our pin (HEAD = 07554bee):

> license: mit

> Research and personal use. Respect the intellectual property rights of muhaqqiqīn (editors) and publishers for critical editions.

Shamela's terms (updated 19 Sept 2026, unchanged):

> تبقى الحقوق في الكتب والطبعات والمواد لأصحابها حسب ما ينطبق. لا تمنحك هذه الشروط حقًا في إعادة استخدام المحتوى خارج ما يسمح به النظام أو إذن صاحب الحق.

We display the authors' articles, editor apparatus stripped, edition cited, and serve them one at a time through the public API; they are not in the release. A public site and API go beyond "research and personal use", and nothing grants more. The editions: al-Dawudi (al-Mufradat, 1412 AH), Harun (Maqayis; d. 1408 AH, so life + 50 runs to 2038), Dar Sadir (Lisan, no muhaqqiq), Attar (al-Sihah, 1987), Saqr (Ibn Qutaybah, 1978). **Owner (D22):** legal advice before launch, the Shamela request (D19), and the long-term rebase on public-domain printings — as decided; this re-read adds only that lexica.yaml should quote the card's own sentence.

### lane — Lane's Lexicon via Perseus (attention)

> This work is licensed under a Creative Commons Attribution-ShareAlike 3.0 United States License.

> An XML version of this text is available for download, with the additional restriction that you offer Perseus any modifications you make.

The availability statement in every XML file:

> You credit Perseus, as follows, whenever you use the document:

> Text provided by Perseus Digital Library, with funding from The U.S. Department of Education and The Max Planck Society.

> You leave this availability statement intact.

The English attribution meets the credit and licence terms; the Arabic attribution — what the default locale shows under each article — paraphrases the credit without the funders and without the licence URL. API responses do not carry the availability statement. We change the text (markup removed, transliteration converted) and have not offered the changes to Perseus. **Owner (D19):** approve the message offering our conversion back to Perseus. The Arabic credit and the API notice are engineering.

### everyayah — EveryAyah recitation audio (attention)

From the 2012 "License for MP3s" page (Wayback; the page is 404 today and EveryAyah's current site states no licence):

> `src="http://creativecommons.org/licenses/by-nc/2.5/ca/"`

> Copyright © 2012 Verse By Verse Quran (EveryAyah.com). All Rights Reserved.

The licence it embeds (CC BY-NC 2.5 Canada, legal code):

> You must include a copy of, or the Uniform Resource Identifier for, this Licence with every copy or soundrecordings of the Work You Use.

> You may not exercise any of the rights granted to You in Section 3 above in any manner that is primarily intended for or directed toward commercial advantage or private monetary compensation.

And EveryAyah's current timing-files disclaimer:

> You must link back to our site from your product and web-site to use these timings.

We stream the MP3s from everyayah.com (hotlinked) and the API hands out their URLs. The licence URI and a link to EveryAyah are missing; the player's credit links to /sources, which does not list EveryAyah. **Owner:** D2 — this layer is non-commercial only; D10's word slices are derivatives, which BY-NC allows. The credit is engineering.

### quran-align — word timings (attention)

> These data files are licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

> indicate if You modified the Licensed Material and retain an indication of any previous modifications; and

We remap the timings onto our tokens and serve them through the API with no creator, copyright notice, licence link or modification note; the player's "timing: quran-align" links to /sources, which does not list it. Commercial use is allowed. **Owner:** nothing to decide; the credit is engineering.

### sudais (conflict) and the eleven other reciters (attention)

The first 16 KiB of each reciter's first-ayah MP3 was read for its ID3 tag. Sudais:

> (C) VerseByVerseQuran.com AbdurRahman As-Sudais

> Original MP3s from QuranicAudio.com

QuranicAudio.com's terms:

> Mp3s on this site may be downloaded and used for personal use free of charge. However, you may not use these files for commercial purposes as many of these files have rules and regulations that prevent their sale except by the publishing companies.

Public streaming on our site is not personal use, so EveryAyah's CC BY-NC grant for these files may be more than it received. Minshawy (mujawwad) and Mohammad At-Tablaway name MP3Quran.net, whose statement is open:

> الحقوق: جميع الحقوق متاحة للجميع و يحق لأي زائر أو مطور استخدام اي مادة أو رابط من الموقع

Al-Husary (teaching) names www.AllahsQuran.com, whose pages state no licence for its audio. The other eight files name no origin. Every reciter also inherits the credit gap above. **Owner:** for Sudais, keep, replace with a source whose terms allow public use, or ask (D19); for the others, nothing beyond D2.

## Differences from what our files and research record

- `data/sources.yaml` qpc-hafs: "the text may not be modified or sold" / «لا يجوز تعديل النص أو بيعه» is not a KFGQPC statement about the text; the usage page it relies on covers the vector mushaf.
- `data/sources.yaml` qac: the licence line omits the FAQ's non-commercial wording.
- `data/sources.yaml` qac-v2: license_url points to the frontend repository's GPL-3.0; the data repository has no licence.
- `data/sources.yaml` qac-wbw: license_url is license.jsp (bare GPL text); the terms of use are on /download/.
- `data/sources.yaml` quranenc: the summary omits conditions 4, 5 and 7.
- `data/lexica.yaml` (five Shamela works): the licence lines record the MIT tag and Shamela's silence, not the card's "Research and personal use" (research 06 and DECISIONS already record it).
- `data/lexica.yaml` lane: the Arabic attribution lacks Perseus's credit sentence and the licence URL.
- `data/works.yaml` (four classical tafsirs and al-Sa'di): no edition recorded, unlike the lexica.
- `data/recitations.yaml`: no licence or attribution fields; EveryAyah's licence is "CC BY-NC 2.5" Canada and known only from a 2012 archive.
- `pipeline/src/jadhr_pipeline/release.py`: the words file's notice calls corpus-derived Tanzil 1.0.2 text KFGQPC text; the corpus notice is paraphrased; Tanzil is not credited for the metadata columns; the qac-v2 notice cites a licence the data does not carry.
- `docs/PLAN.md` P1.8: "the corpus's bundled Tanzil 1.0.2 (CC BY-ND) is read by nothing" — true for a separate copy, not for the morphology file's FORM column, which reaches the word panel, the API and the release.
- `docs/research/01` §3.4 reads the KFGQPC usage page as covering the Unicode data; the page names the Illustrator copy. §4 and §11 say the Tarteel terms are unread; they are now read.
- `docs/research/03` §7.1 treats EveryAyah's grant as covering every recording; the ID3 tags show other origins for at least four reciters.

## Engineering fixes that need no owner decision

Not done in this task (it records; it does not change the product). Each is small:

1. Release MANIFEST and notices: credit Tanzil (with link) for juz/hizb/sajda; reproduce the corpus copyright notice and terms block; stop labelling `text_uthmani`/`segments[].text` as KFGQPC text and carry the Tanzil 1.0.2 notice with them (or leave them out until the qac decision); correct the qac-v2 notice.
2. Recitations: add `license`, `license_url` and attribution fields to recitations.yaml for EveryAyah (CC BY-NC 2.5 CA) and quran-align (CC BY 4.0, Collin Fair, "modified"); load them into content.sources so /sources lists them; make the player's credit link to everyayah.com and the licences; return the same in the /recitations API responses.
3. Lane: an Arabic attribution that carries Perseus's credit sentence and the licence URL; the availability statement in API responses for Lane articles.
4. Registry wording: the differences listed above, so each licence line quotes what its source says.
5. A re-check tool that re-fetches `urls_checked`, compares `page_sha256` and confirms each quote is still present — this re-read was done with scratch scripts, which are not kept.

## Owner decisions and actions, by decision

- **D2 (commercial or not):** binds EveryAyah and every reciter (BY-NC), the corpus and its glosses (FAQ non-commercial), and QuranEnc (silent on commercial use). Nothing here changes the launch-non-commercial decision.
- **D19 (messages under the owner's name):** KFGQPC (bulk redistribution of the Unicode text; the font's "Reproduced" clause); the corpus maintainers (derived release data, the revised files, API exposure of glosses); QuranEnc (two version numbers, the "(n) " prefix, API re-publication); Perseus (offer our Lane conversion); Shamela (as already planned); optionally the mustafa0x author and a Sudais source.
- **D22 (classical text):** the five Shamela lexica (unchanged position) and, newly, the editions behind the five QUL tafsirs.
- **Not tied to an existing decision:** whether to keep the Sudais recitation while its upstream terms are personal-use only.
