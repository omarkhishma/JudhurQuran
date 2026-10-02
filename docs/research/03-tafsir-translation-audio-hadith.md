# 03 — Tafsir, translations, word-by-word, audio, hadith: open-data survey

Research date: 2026-10-02. Every URL, count and license below was fetched or computed on that date unless marked otherwise. Samples are saved under `data/raw/<source-slug>/` (manifest at the end). This is a licensing survey, not legal advice: items marked "risk" need a human decision or a written permission before launch.

On quotations: license and terms text is quoted only as short operative excerpts, with the full page URL. Read the full page before relying on a clause.

## 0. Outcome in one screen

- Tafsir: the content exists and is mostly complete, but almost none of it has an explicit license. The only Arabic tafsir sources with written re-publication permission are QuranEnc.com (al-Muyassar, al-Mukhtasar) and the CC BY-ND al-Jami' al-Wajiz. Classical works (al-Tabari, Ibn Kathir, al-Qurtubi, al-Baghawi, al-Jalalayn) are public domain as texts, so we can import them. Sa'di (died 1956) is public domain under life+50 and becomes public domain under life+70 on 2027-01-01.
- spa5k/tafsir_api (MIT, 123 editions, 57 Arabic) is a convenient mirror of QUL's tafsir exports. MIT covers only the repository and code. It cannot license the texts. The mirror strips HTML and copies the text of a grouped passage into every ayah of the group. I found data defects: "Tanwir al-Miqbas" is actually Ibn Ashur's al-Tahrir wa al-Tanwir and is corrupt in surah 18; the Arabic Jalalayn is missing 226 ayahs; one of the two Sa'di editions is missing 59 ayahs.
- QUL (qul.tarteel.ai) is the upstream for most tafsir, translation, word-by-word and segment data. Every download needs a free login. Most resources have no license attached; the copyright modal says it has no copyright information for the resource.
- The Quran.com API v4 still answers without authentication (200 on every probe). Its current developer terms forbid redistributing its content through our own API without a signed commercial license, and forbid storing it longer than 1 week. It cannot feed our database. At most it is a live fallback.
- English: Tanzil translations are non-commercial only and may not be redistributed. QuranEnc.com explicitly allows download and re-publication of Saheeh International (Noor International Center edition) and the Rowwad translation, with no modification. Pickthall's 1930 text is public domain in the US and in life+89-or-shorter countries. Yusuf Ali's 1934 text carries US risk (likely URAA-restored until 2030–2034).
- Word-by-word: the user's `Quran DB - Roots.csv` Translation column comes from corpus.quran.com's word-by-word glosses (Kais Dukes, Quranic Arabic Corpus). Its punctuation matches the corpus exactly, and it has at least one truncation defect. Quran.com and QUL serve an edited copy of the same glosses.
- Audio: EveryAyah per-ayah MP3s (79 folders, 48 distinct Hafs reciters) are the same files Quran.com serves; I confirmed byte-identical copies. The license is CC BY-NC 2.5 Canada (archived 2012 page), so they are usable only if the site stays non-commercial. Word-highlight timings for 12 reciters are CC BY 4.0 (cpfair/quran-align), and Quran.com's verse "segments" are identical to that data. Per-word pronunciation MP3s on Quran.com's CDN resolve. They are attributed to Imam Wisam Sharieff (ReciteQuran.com), and I found no license, so we need permission before self-hosting them.
- Hadith (later phase): fawazahmed0/hadith-api (Unlicense compilation) covers 10 collections with Arabic and grades for the Sunan and Muwatta. It has no isnad/matn split. Sanadset 650K (CC BY 4.0, 650,986 records, isnad/matn tagged) is the strongest open isnad corpus. The sunnah.com API needs a key requested via a GitHub issue. Dorar's API and terms sit behind Cloudflare and could not be read by automation.

## 1. Rights matrix (summary)

| Source | Display on our site | Redistribute via our public API | Modify | Basis |
| --- | --- | --- | --- | --- |
| Classical tafsir texts (Tabari, Ibn Kathir, Qurtubi, Baghawi, Jalalayn) | Yes | Yes | Legally yes; do not, for religious integrity | Public domain (authors died 923–1505 CE); the digital edition has no stated license |
| Sa'di, Taysir al-Karim al-Rahman | Yes (low risk) | Yes in life+50 countries; life+70 from 2027-01-01 | No | Author died 1956; no license on the QUL data |
| al-Muyassar / al-Mukhtasar via QuranEnc | Yes | Yes, with conditions | No | QuranEnc terms (section 4.3) |
| al-Muyassar / al-Mukhtasar via QUL or Quran.com | Unclear | No (no license) | No | No license; Quran Foundation terms forbid redistribution |
| al-Jami' al-Wajiz (Ayman Al-Amer) | Yes | Yes | No | CC BY-ND 4.0 per repo README |
| Modern tafsirs in QUL (al-Wasit/Tantawi, Ibn Uthaymeen, Jazairi, Tadabbur, Mawsu'at al-Ma'thur…) | Risk | No | No | In copyright; no license found |
| spa5k/tafsir_api repository | Code: yes | Code: yes | Code: yes | MIT covers the code and compilation only, not the texts |
| QUL resources | Per resource | Per resource | Per resource | FAQ says check each resource; most say "no copyright information" |
| Quran.com / Quran Foundation API | Yes, under the terms | No without a signed commercial license | Quran text: never | QF Developer Terms, 2026-09-26 |
| Tanzil translations | Non-commercial only | No without Tanzil permission | No | tanzil.net/trans terms |
| QuranEnc translations (Saheeh, Rowwad, Hilali-Khan) | Yes | Yes, with conditions | No | QuranEnc terms |
| Pickthall 1930 | Yes | Yes | Yes (keep verbatim) | Public domain (Wikisource notice) |
| Yusuf Ali 1934 original | Risk in the US | Risk in the US | No | Author died 1953; probable URAA restoration in the US |
| corpus.quran.com word-by-word glosses | Yes, with attribution and link | Verbatim only; ambiguous | No | GPL label plus custom terms; FAQ mentions non-commercial |
| EveryAyah MP3 | Non-commercial, with attribution | Non-commercial | Allowed under BY-NC (e.g. slicing) | CC BY-NC 2.5 CA (archived 2012) |
| QuranicAudio.com MP3 (surah files) | Personal use only | No | No | quranicaudio.com/about |
| quran-align timings | Yes | Yes | Yes | CC BY 4.0 |
| Quran.com word-by-word MP3 (Wisam Sharieff) | Needs permission | Needs permission | No | No license found |
| fawazahmed0/hadith-api | Yes (Arabic) | Arabic: yes; translations: risk | No | Unlicense covers the compilation; the English translations are third-party copyrighted works |
| Sanadset 650K | Yes | Yes | Yes | CC BY 4.0 |
| sunnah.com API | With a key | No public grant | No | Key by request; no license file in the repo |

## 2. spa5k/tafsir_api

### 2.1 Facts

- Repo: https://github.com/spa5k/tafsir_api. Latest tag `v1.2.2` at commit `eb82bb6294`, 2026-09-30; tags `v1.2.1`, `v1.2.0`, `v1.1.0` and a moving `v1`. Repository size 1.19 GB. 204 stars.
- License: MIT (`Copyright (c) 2023 Spark`), https://github.com/spa5k/tafsir_api/blob/main/LICENSE. The grant covers "this software and associated documentation files". It is the repo author's license and cannot relicense third-party tafsir texts.
- Where the text comes from, per README "Data generation" and `editions.json` `source` fields: 108 editions are generated from QUL SQLite exports by `scripts/import_qul_sqlite.py`. 7 legacy editions are tagged `quran.com` (ids 381, 92, 157, 160, 159, 818, 817), 7 English editions are tagged `altafsir.com` (Royal Aal al-Bayt Institute translations), and 1 comes from GitHub (al-Jami' al-Wajiz, CC BY-ND 4.0, imported "unchanged").
- Editions: 123 in `tafsir/editions.json` (57 Arabic, 13 English, 9 Urdu, 6 Bengali, then Russian, Turkish, Indonesian, Persian, Kurdish and 24 single-language Mokhtasar/Sa'di translations). The `tafsir/` folder has 124 subfolders; the orphan `kashf-al-asrar-tafsir` (30 surah files) is not listed in `editions.json`.
- Sizes were computed from the GitHub tree API (sum of the 114 surah files per edition). The largest Arabic editions are Fath al-Qadir (180.0 MB), al-Bahr al-Muhit (173.0 MB), Ibn Uthaymeen (145.7 MB) and al-Lubab (134.0 MB).

### 2.2 URL pattern and JSON shape

- Base URLs, in the order I recommend: `https://raw.githubusercontent.com/spa5k/tafsir_api/v1.2.2/tafsir/…` (pinned), then `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.2/tafsir/…`. The README itself recommends self-hosting.
- Endpoints: `editions.json`; `{slug}/{surah}.json` (array of that surah's ayahs); `{slug}/{surah}/{ayah}.json` (one ayah); `{slug}/{surah}/empty_ayahs.json` (only present when the surah has ayahs without text). Metadata lives in `data/ayah_data.json` (114 × `{surah, ayah-count}`, sum 6236) and `data/editions.json`.
- jsDelivr quirk: for this repo a missing file returns HTTP 403 with "Package size exceeded the configured limit of 50 MB" instead of 404. raw.githubusercontent returns 404 for the same path. Clients probing `empty_ayahs.json` must treat a jsDelivr 403 as "not found". Existing files returned 200 on all CDNs I tried; statically.io returned 301.
- Current per-ayah shape (QUL-generated editions): `{"text": "...", "ayah": 255, "surah": 2}`. The surah file is an array of these objects.
- Legacy shape (`ar-tafseer-tanwir-al-miqbas`, `en-al-jalalayn`): `{"ayahs": [ {...}, ... ]}`. Normalise both shapes on import.
- Sample (Ibn Kathir 2:255, classical public-domain text; truncated here):

```json
{ "text": "هَذِهِ آيَةُ الْكُرْسِيِّ وَلَهَا شَأْنٌ عَظِيمٌ …", "ayah": 255, "surah": 2 }
```

### 2.3 How grouped ayahs are represented

In QUL's export a passage that covers several ayahs is stored once, with `group_ayah_key`, `from_ayah`, `to_ayah` and `ayah_keys`. tafsir_api's importer (`import_qul_sqlite.py`, `import_database` and `write_tafsir`) expands each group: it writes the same text into every member ayah's file. Ayahs that resolve to no text are left out of the surah array and listed in `{surah}/empty_ayahs.json`. HTML tags are stripped (`clean_text`) and entities unescaped. The group boundaries are therefore lost, but they can be rebuilt by merging consecutive ayahs with identical text. For our own store, import from QUL's SQLite instead: it keeps the group keys and the HTML.

### 2.4 Completeness of the editions that matter

Each row was computed by downloading all 114 surah files and all `empty_ayahs.json` files at tag `v1.2.2`. "Groups" means runs of ayahs sharing byte-identical text. "Unique chars" counts each distinct text once.

| Slug (QUL id) | Ayahs present / 6236 | Missing | Groups (ayahs inside) | Largest group | Unique chars | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `ar-tafsir-muyassar` (38) | 6236 | 0 | 626 (1,839) | 55:18–77 refrain | 1,125,907 | Different recension from QuranEnc/Quran.com, and all 114 surah openers carry an added surah-intro block (2.5) |
| `ar-tafseer-al-saddi` (24) | 6177 | 59 (e.g. 2:107, 2:109, 2:111, 2:286) | 161 (411), 10 non-contiguous | 55:18–77 | 3,154,052 | Per-ayah split; some ayahs' wording differs from the printed Taysir (e.g. 2:255) |
| `ar-tafsir-as-saadi` (308) | 6236 | 0 | 1,202 (5,699) | 7:103–171 (69 ayahs) | 3,074,260 | Printed-book passages with `{n}` ayah markers; best Sa'di source |
| `ar-tafsir-al-mukhtasar` (251) | 6236 | 0 | 36 (116) | 55:13–77 | 1,050,129 total | Tafsir Center's al-Mukhtasar |
| `ar-tafsir-al-baghawi` (27) | 6236 | 0 | 1,524 (5,608) | 26:156–171 | 7,747,270 | Complete |
| `ar-tafsir-ibn-kathir` (22) | 6236 | 0 | 1,421 (5,746) | 74:11–30 | 13,401,179 | Complete |
| `ar-tafseer-al-qurtubi` (23) | 6236 | 0 | 1,161 (4,136) | 26:23–51 | 17,323,373 | Complete |
| `ar-tafsir-al-tabari` (37) | 6236 | 0 | 1,334 (3,934) | 80:5–17 | 20,578,907 | Complete |
| `ar-tafseer-tahrir-al-tanwir` (25) | 6236 | 0 | 1,224 (3,537) | 70:8–21 | 23,456,076 | Includes print page markers ("صفحة ١٥٢") |
| `ar-tafsir-al-wasit` (26) | 6236 | 0 | 157 (358) | 39:7–16 | 10,043,737 total | Muhammad Sayyid Tantawi (died 2010); in copyright |
| `ar-tafsir-al-jalalayn` (523) | 6010 | 226 (e.g. 2:82, 2:274, 2:277, 3:2) | 20 (44) | 26:127–180 | 1,434,194 total | Incomplete; Tanzil's `ar.jalalayn` has 6236/6236 lines but non-commercial terms |
| `ar-tafseer-tanwir-al-miqbas` (92) | 6236 | 0 | 9 (165) | 17:111 → 18:99 (111 ayahs) | 15,761,414 | Mislabelled: the text is Ibn Ashur's al-Tahrir wa al-Tanwir (unvocalised), and surah 18 holds 17:111's text. Do not use |
| `ar-tafsir-al-jami-al-wajiz` (9001) | 6236 | 0 | 0 | — | 5,191,010 | CC BY-ND 4.0 |
| `tafsir-ibn-uthaymeen` (486) | 3456 | 2780 | 564 | 37:97–132 | 20,852,971 | Partial work; in copyright (author died 2001) |
| `adwa-al-bayan` (525) | 2320 | 3916 | 0 | — | 9,200,053 | Selective by design; in copyright (al-Shinqiti, died 1973) |
| `tafsir-al-baydawi` (518) | 3811 | 2425 | 1,177 | 26:140–148 | 3,049,945 | Incomplete in this export |
| `en-tafisr-ibn-kathir` (35) | 6236 | 0 | 1,415 | 74:11–30 | 9,862,313 | Abridged English (Quran.com calls it "Ibn Kathir (Abridged)"; publisher not stated in the data); in copyright |
| `tafsir-al-jalalayn` (573), `en-al-jalalayn` (74) | 6236 each | 0 | 16–17 | 55:16–77 | ~2.1–2.2 M | English translation; 74 is sourced from altafsir.com (Royal Aal al-Bayt Institute); in copyright |
| `en-tafsir-al-mukhtasar` (266) | 6236 | 0 | 38 | 55:13–77 | 1,716,962 | Tafsir Center; in copyright |

### 2.5 Data-quality findings, with evidence

- al-Muyassar recension. QuranEnc's `arabic_moyassar` SQLite, Tanzil's `ar.muyassar` and Quran.com tafsir 16 all agree on the classic King Fahd Complex text. QUL 38 / tafsir_api is a revised text. Of 6,236 ayahs, 5,248 are identical after normalisation (diacritics, ﷺ, punctuation and the intro block stripped). Mean similarity is 0.984 and 221 ayahs fall below 0.9. Example: 2:178 adds "سواء الرجل بالمرأة أو المرأة بالرجل", and 2:45 is merged with 2:46. In addition, the first ayah of all 114 surahs is prefixed with an intro block headed "تسمية السورة / من مقاصد السورة". That block is absent from the other three copies, and its provenance is undocumented.
- Sa'di editions differ. On a 300-ayah random sample, 226 of edition 24's texts are largely (≥60% contiguous) contained in edition 308's passage. Some are not: 2:255 in edition 24 opens with different wording from the printed Taysir, which edition 308 matches. Use 308.
- "Tanwir al-Miqbas" (id 92, source quran.com) is not Tanwir al-Miqbas. 1:1–2 match Ibn Ashur's al-Tahrir wa al-Tanwir verbatim, without vocalisation. 18:50 contains the commentary on 17:110–111, and the same text repeats from 17:111 to 18:99.
- HTML is stripped in tafsir_api. QUL documents that the source text "may contain HTML tags such as `<b>` and `<i>`" and should be rendered as HTML (https://qul.tarteel.ai/resources/tafsir/38, Help tab). Quran.com's Muyassar marks Qur'anic words with `<span class="green">`. Both formatting layers are lost in tafsir_api.
- Classical texts usually come from modern critical editions (e.g. Ibn Kathir's common digital text descends from a 20th-century edition). The base text is public domain, but editorial footnotes and takhrij can carry edition rights. None of the editions I sampled include the editors' footnotes, so the risk is low. Still record the edition name when QUL provides it.

### 2.6 Downloads saved

`data/raw/tafsir_api/`: `editions.json`, `ar-tafsir-muyassar.json` (3.0 MB), `ar-tafseer-al-saddi.json` (6.2 MB), `ar-tafsir-as-saadi.json` (38.9 MB). Each merged file is `{source, tag, slug, ayahs:[{text, ayah, surah}], empty_ayahs:[…]}` fetched at `v1.2.2`. The other editions were streamed for analysis and not stored, to save disk.

## 3. QUL — Quranic Universal Library (qul.tarteel.ai)

- What it is: Tarteel's CMS and resource library. The code is MIT (https://github.com/TarteelAI/quranic-universal-library, pushed 2026-10-01). QUL states it has no API: resources are "intended for you to download and package with your own project; no API is available" (https://qul.tarteel.ai/resources).
- Inventory on the resources index: recitations 131 (73 unsegmented, 58 segmented); translations 227 (205 ayah-by-ayah, 22 word-by-word); tafsirs 115 (35 Mukhtasar, 80 detailed; the tafsir list page shows 108); mushaf layouts 28; scripts 30; fonts 24; metadata 8; transliteration 10; surah info 9; topics 2,512; morphology 77,432 words; mutashabihat 5,277; similar ayahs 4,001; ayah themes 1,049.
- Downloadable without login: nothing. I checked the download links on `resources/translation/193`, `translation/92`, `recitation/118`, `tafsir/38`, `quran-script` and `morphology`. All 80 links open `/users/sign_in?modal=true…`. A free account is required. I did not create one, because my safety rules forbid creating accounts.
- Formats: tafsir comes as JSON (`{"2:3": {"text": "...", "ayah_keys": ["2:3","2:4"]}, "2:4": "2:3"}`) or SQLite (`ayah_key, group_ayah_key, from_ayah, to_ayah, ayah_keys, text`). Translations come as simple, footnote-tags, inline-footnote or text-chunk shapes, in JSON or SQLite. Recitation segments are `[word_position (1-based), start_ms, end_ms]`, per-ayah relative or surah-absolute with `timestamp_from/to`.
- License, general (https://qul.tarteel.ai/faq): commercial use is allowed, "However, please review the licensing terms for each resource." The FAQ also says "Some data may have restrictions or require attribution". For per-resource attribution it recommends "reviewing the licensing information provided by each resource's author".
- License, per resource: the `/resources/{id}/copyright` modal returned "We don't have copyright information for this resource." for Saheeh International (193), Tafsir Muyassar (38) and English word-by-word (92). Only 3 translation resources are flagged "© copyrighted" (ids 97, 426, 472). For 97 the modal names Quran Academy and says permission is required. No recitation resource is flagged.
- Credits (https://qul.tarteel.ai/credits) name the upstreams: QuranWBW.com for word-by-word translations, Collin Fair for "the original word-by-word timestamps", EveryAyah.com and QuranicAudio.com for recordings, Kais Dukes for morphology, Sami Rifai/ReciteQuran.com "For providing wbw and tajweed recitations of Imam Wisam Sharieff", and Tanzil for text and sourcing translations.
- Tarteel's site-wide terms (https://www.tarteel.ai/terms) are app terms and say nothing about QUL data. Answers per category: (a) display: per resource, mostly undetermined; (b) redistribution via our API: only where the underlying author's license allows it; (c) modification: no, unless the author's license allows it.

## 4. Quran.com / Quran Foundation API

### 4.1 Is `api.quran.com/api/v4` still public?

Yes, technically. All of these returned HTTP 200 with no credentials on 2026-10-02 (Cloudflare, `cache-control: public`):

| Endpoint | Result |
| --- | --- |
| `/api/v4/resources/tafsirs` | 20 tafsirs (Arabic: 14 Ibn Kathir, 15 Tabari, 16 Muyassar, 90 Qurtubi, 91 Sa'di, 93 al-Wasit/Tantawi, 94 Baghawi) |
| `/api/v4/resources/translations` | 126 translations; English: 85 Abdel Haleem, 149 Bridges, 84 T. Usmani, 95 Maududi, 19 Pickthall, 22 Yusuf Ali, 20 Saheeh, 203 Hilali & Khan, 57 transliteration |
| `/api/v4/tafsirs/16/by_ayah/1:1` | Muyassar 1:1, HTML with `<span class="green">` |
| `/api/v4/resources/recitations` | 12 verse-by-verse recitations |
| `/api/qdc/audio/reciters` | 14 surah-file reciters |
| `/api/v4/verses/by_key/1:1?words=true&audio=7` | Words with `audio_url: "wbw/001_001_001.mp3"`, word-by-word translation and transliteration, and verse `audio.segments` |

### 4.2 Terms

- Quran Foundation documents the unauthenticated base URL as the "older unauthenticated API". The supported path is `https://apis.quran.foundation/content/api/v4/…` with OAuth2 client credentials and `x-auth-token` + `x-client-id` headers (https://api-docs.quran.foundation/docs/quickstart/migration/).
- Developer Terms, last updated 2026-09-26 (https://api-docs.quran.foundation/legal/developer-terms/). "QF Content" covers Quran text, translations, metadata, audio and other returned content. Display inside an application is allowed, including in commercial apps.
- Redistribution needs a signed commercial license. The terms list the forms it covers, including redistribution "as a dataset, data feed, API, content package". Serving content from our own backend inside our own app's experience is "not, by itself, redistribution".
- Storage: developers must not "Cache or store QF Content longer than 1 week" unless QF permits it or the content is in Content Sync, which requires re-syncing every 7 days. The Content Sync exception "does not itself authorize distributing a prepackaged database".
- Other clauses: the Quran text must be "not modified in any way". Snippets must keep their context. Audio rights belong to the recordings' own holders. Recommended attribution is "Quran data provided by Quran Foundation" (FAQ: https://api-docs.quran.foundation/docs/tutorials/faq/).
- Answers: (a) display: yes, under the terms; (b) redistribution via our public API: no, without a signed commercial license; (c) modification: no for Quran text, and snippets must keep their context. Consequence: the Quran.com API cannot be a source for our own database or API. Use it only as a live, credited fallback, with at most 1 week of caching.

### 4.3 QuranEnc.com — the explicitly licensed alternative for Muyassar, Mukhtasar and English

- API: `https://quranenc.com/api/v1/translations/list[/{lang}]`, `/api/v1/translation/sura/{key}/{sura}`, `/api/v1/translation/aya/{key}/{sura}/{aya}`. SQLite downloads at `https://quranenc.com/downloads/sqlite/{key}.zip`. No key needed.
- Keys verified: `arabic_moyassar` (812 KB zip) and `arabic_mokhtasar` (773 KB) work but are not listed in `/translations/list`. Listed English keys: `english_saheeh` v1.1.2 (updated 2025-06-24, "Issued by Noor International Center"), `english_rwwad` v1.0.19 (2026-03-12, Rowwad Translation Center), `english_hilali_khan` v1.1.2. The full list has 76 translations.
- Completeness: every downloaded SQLite file (`translations(id, sura, aya, translation, footnotes)`) has 6236 rows, 6236 distinct keys and 0 empty rows. Muyassar has 1,377,550 chars and Mukhtasar 1,050,575. Every `english_saheeh` row starts with an inline "(n) " ayah number, which needs handling at display time (section 9).
- Terms (https://quranenc.com/en/home/api, the "Terms and Policies" block on every page; Arabic text at `/ar/browse/…`): content "can be downloaded and re-published" under 7 conditions. They are: no modification, addition or deletion; clear credit to the publisher and the source (QuranEnc.com); state the version number; keep the version info; send notes to QuranEnc; update to new versions; and no inappropriate advertisements next to the translations.
- Answers: (a) display: yes; (b) redistribution via our public API: yes, as re-publication, provided we carry publisher, source and version and keep updating; (c) modification: no.

## 5. Translations of meanings (English first)

### 5.1 Tanzil (https://tanzil.net/trans/)

- 17 English entries exist (`en.ahmedali`, `en.ahmedraza`, `en.arberry`, `en.daryabadi`, `en.hilali`, `en.itani`, `en.maududi`, `en.mubarakpuri`, `en.pickthall`, `en.qarai`, `en.qaribullah`, `en.sahih`, `en.sarwar`, `en.shakir`, `en.transliteration`, `en.wahiduddin`, `en.yusufali`), plus `ar.jalalayn` and `ar.muyassar`. Download pattern: `https://tanzil.net/trans/?transID=en.sahih&type=txt-2` (`sura|aya|text`, comment footer). The 4 saved files each have 6236 lines; the `en.sahih` footer says "Last Update: April 24, 2011".
- Terms, on the same page: the translations "are for non-commercial purposes only"; other use needs the translator's or publisher's permission; using more than three requires a link back; and "Redistributing the following list in another website is not allowed" without Tanzil's permission.
- Answers: (a) display: non-commercial only; (b) redistribution via our API: no; (c) modification: no. Tanzil is a reference copy, not an import source.

### 5.2 Saheeh International

- Print copyright belongs to Abul-Qasim Publishing House (1997) and Al-Muntada Al-Islami (2004). The print edition requires written permission for any reproduction (per the colophon reported in search results; I did not see the book itself).
- The best documented permission I found is QuranEnc's re-publication grant for `english_saheeh` (section 4.3).
- Risk: QuranEnc's grant is a third party's statement. Before launch, get a one-line written confirmation from QuranEnc or Noor International that re-publishing through a public API is covered. That message would go out under the owner's name, so the owner decides.

### 5.3 Public-domain English

- Pickthall, The Meaning of the Glorious Koran (1930). Wikisource (https://en.wikisource.org/wiki/The_Meaning_of_the_Glorious_Koran_(1930)) says it is public domain in the US because it "was published before January 1, 1931". The author died in 1936, so it is public domain wherever the term is life+89 or less. Conclusion: clean worldwide for practical purposes. Import from the Wikisource 1930 transcription and use Tanzil's `en.pickthall` only to cross-check, because Tanzil's terms bind its copy.
- Yusuf Ali, The Holy Qur-an (Lahore, published in parts 1934–1938). The author died in 1953, so it has been public domain in life+70 jurisdictions since 2024-01-01 (Wikisource author page). My analysis for the US: the work was still in copyright in Pakistan on 1996-01-01 (life+50 ran to the end of 2003), so URAA likely restored a US term of 95 years from publication. That would make it public domain in the US only from 2030–2034. The 1985 King Fahd revision and the 1989 Amana revision are separately copyrighted. Conclusion: do not launch it as a US-facing default.
- Other older translations (Sale 1734, Rodwell 1861, Palmer 1880, Muhammad Ali 1917) are public domain but sensitive for a Sunni audience. Not recommended.

## 6. Word-by-word English glosses

### 6.1 Origin of the user's `Example Data/Quran DB - Roots.csv` Translation column

- Verdict: the column was scraped from corpus.quran.com's Word by Word pages (Quranic Arabic Corpus, Kais Dukes, University of Leeds; now maintained by the Quran.com team). The transliteration column ("bis'mi", "l-lahi") is the corpus's too.
- Evidence 1: the glosses keep the corpus's per-word punctuation and quote marks ("(of) Allah,", "the Most Merciful.", `"We believed`). Quran.com's API removes these.
- Evidence 2: in 2:255 the CSV matches the corpus's "His Throne", where Quran.com now has "His Seat".
- Evidence 3: across all 286 verses of surah 2 (6,116 words) the CSV and the Quran.com API have the same word count per verse. 5,821 glosses (95.2%) are identical after trailing punctuation is stripped; most of the rest differ only by quote marks.
- Defect found: CSV line 5200, 2:255 `بِإِذْنِهِ`, gloss "by". The corpus has "by His permission." Other truncations may exist, so re-import rather than trusting the CSV.

### 6.2 corpus.quran.com terms

- The site footer says the corpus is "available under the GNU public license with terms of use" (https://corpus.quran.com/license.jsp, which hosts GPL v3). The download header (https://corpus.quran.com/download/) adds: "CHANGING IT IS NOT ALLOWED". Use is allowed in any website or application "provided its source (the Quranic Arabic Corpus) is clearly indicated, and a link is made to http://corpus.quran.com".
- The FAQ (https://corpus.quran.com/faq.jsp) says the word-by-word English "is not a new translation". It is based on Sahih International, Pickthall and Yusuf Ali. The FAQ also says the project's aim is data "available freely for non-commercial use under the GNU public license".
- The glosses are not in the downloadable morphology file (v0.4). They exist only on the web pages, Quran.com and QUL.
- Answers: (a) display: yes, with source credit and a link; (b) redistribution via our API: verbatim with the notice, but the GPL/no-changes/non-commercial mix is internally inconsistent, so treat it as ambiguous; (c) modification: no. Stripping punctuation is arguably a change, so keep the stored text verbatim.

### 6.3 Quran.com and QUL word-by-word

Quran.com's `translation.text` per word (e.g. "In (the) name") is the corpus gloss with punctuation removed and some edits. QUL resource 92, "English Word by Word Translation", has the same lineage and no copyright information on its modal. QUL credits QuranWBW.com for the other languages. No separate license exists. The Quran.com API copy is also bound by the QF terms (no redistribution).

## 7. Audio

### 7.1 EveryAyah (per-ayah MP3)

- URL pattern: `https://everyayah.com/data/{subfolder}/{SSS}{AAA}.mp3`, e.g. `https://everyayah.com/data/Alafasy_128kbps/001001.mp3`. Mirror: `https://mirrors.quranicaudio.com/everyayah/{subfolder}/…`. Reciter list: `https://everyayah.com/data/recitations.js` (saved).
- Counts: 79 folders = 68 Arabic Hafs folders (48 distinct reciters) + 3 Warsh + 8 translation/multilanguage. Per-ayah files are numbered 001001–114006 (6236 per reciter).
- Quran.com's verse audio is EveryAyah: the md5 of `verses.quran.com/Alafasy/mp3/001001.mp3`, `everyayah.com/data/Alafasy_128kbps/001001.mp3` and the quranicaudio mirror are all `92cd0474a1073e264fac310fb0c28351`. API recitations 6, 11 and 12 point straight at `mirrors.quranicaudio.com/everyayah/…`.
- License: the "License for MP3s" page of VerseByVerseQuran.com, which is EveryAyah (copyright line "Verse By Verse Quran (EveryAyah.com)"), embedded the Creative Commons BY-NC 2.5 Canada license. The page is in the Wayback Machine snapshot of 2012-10-21: http://web.archive.org/web/20121021062917/http://www.versebyversequran.com/site/license (the iframe source is `creativecommons.org/licenses/by-nc/2.5/ca/`).
- The timing-files disclaimer (https://everyayah.com/data/timings_files/000_disclaimer.txt) requires: "You must link back to our site from your product and web-site". No current license page exists; contact goes through quran.zendesk.com.
- Answers: (a) display/stream: yes, non-commercial, with attribution and a link; (b) redistribution: non-commercial only; (c) modification (slicing, transcoding): allowed under BY-NC. The underlying recordings belong to their reciters and publishers.

### 7.2 Quran.com / QuranicAudio CDNs

- Verse audio: `https://verses.quran.com/{path}` or `https://audio.qurancdn.com/{path}`, where `{path}` comes from the API, e.g. `Alafasy/mp3/001001.mp3` or `AbdulBaset/Mujawwad/mp3/001001.mp3`. All 12 recitation paths were listed.
- Surah files: `https://download.quranicaudio.com/qdc/{reciter}/{style}/{n}.mp3`, e.g. `qdc/mishari_al_afasy/murattal/1.mp3`. Alafasy's 114 files total 1,723 MB and 29.5 h, summed from the API's `file_size` and `duration`.
- QDC segments: `api.quran.com/api/qdc/audio/reciters/7/audio_files?chapter=1&segments=true` returns `verse_timings[].segments = [word, start, end]`. Malformed entries occur, e.g. `[1]` and `[2]` in 1:3, so validate on import.
- QuranicAudio terms (https://quranicaudio.com/about): files may be used for personal use only, and you "may not use these files for commercial purposes". Answers: (a) display: personal, non-commercial streaming at most; (b) redistribution: no; (c) modification: no.

### 7.3 Per-word pronunciation audio

- `https://audio.qurancdn.com/wbw/001_001_001.mp3` resolves (200, `audio/mpeg`, 44,975 bytes, 320 kbps; ID3 has only year 2021 and the encoder, no artist). Spot checks of 2:255:1, 2:255:50, 2:282:128 (the last word of the longest ayah), 18:19:11, 1:7:9 and 114:6:3 all returned 200. Pattern: `wbw/{SSS}_{AAA}_{WWW}.mp3`, also on `verses.quran.com/wbw/…`.
- Reciter: Imam Wisam Sharieff via ReciteQuran.com. QUL credits Sami Rifai and ReciteQuran.com for the "wbw and tajweed recitations of Imam Wisam Sharieff". QuranWBW.com says it serves its word audio from its own CDN. I found no license.
- Answers: (a) display: needs permission (hotlinking is not covered by any grant); (b) redistribution: needs permission; (c) modification: no.
- Size: a full mirror would be roughly 77k files × ~70 KB ≈ 5 GB (estimate from 7 samples). Not downloaded.
- License-clean alternative: play the word's time-slice of the EveryAyah verse file, using the quran-align segment `[start_ms, end_ms]` (7.4). This needs no extra files, but the result is connected-speech pronunciation rather than an isolated word.

### 7.4 Word timing for highlighting

- cpfair/quran-align (https://github.com/cpfair/quran-align, release `release-2016-11-24`, 5.8 MB zip, saved). Its 12 JSON files match EveryAyah folders: Abdul_Basit_Mujawwad_128kbps, Abdul_Basit_Murattal_64kbps, Abdurrahmaan_As-Sudais_192kbps, Abu_Bakr_Ash-Shaatree_128kbps, Alafasy_128kbps, Hani_Rifai_192kbps, Husary_64kbps, Husary_Muallim_128kbps, Minshawy_Mujawwad_192kbps, Minshawy_Murattal_128kbps, Mohammad_al_Tablaway_128kbps, Saood_ash-Shuraym_128kbps.
- Format: `{surah, ayah, segments: [[word_start (0-based), word_end (exclusive), start_ms, end_ms]], stats}`. Words are split on spaces in Tanzil `quran-uthmani.txt`. Alafasy has 6236 entries and 77,392 segments.
- License: the README and the packaged README say "These data files are licensed under a Creative Commons Attribution 4.0 International License", with "Copyright (c) 2016 Collin Fair". Answers: (a) yes; (b) yes; (c) yes, with attribution.
- Quran.com's verse segments are this data. Alafasy 1:1 from `/api/v4/verses/by_key/1:1?audio=7` is `[[0,1,60,610],[1,2,620,1310],[2,3,1320,2450],[3,4,2460,5970]]`, identical to quran-align. The 12 Quran.com verse recitations are the same 12 reciters.
- QUL's 58 segmented recitations extend coverage, including gapless surah files. They need a login and carry no license data (section 3).

### 7.5 Sample files saved (3 MP3s only)

`data/raw/audio-samples/`: `everyayah_Alafasy_128kbps_001001.mp3` (146,830 B), `everyayah_Husary_128kbps_001001.mp3` (82,164 B; ID3 album "VerseByVerseQuran.Com"), `qurancdn_wbw_001_001_001.mp3` (44,975 B).

## 8. Hadith (later phase, survey only)

| Source | What | Counts | Arabic | Isnad/matn split | Grading | License / access |
| --- | --- | --- | --- | --- | --- | --- |
| fawazahmed0/hadith-api (https://github.com/fawazahmed0/hadith-api) | 10 collections: Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Malik, Nawawi 40, Qudsi 40, Dehlawi 40 | Bukhari 7,589; Muslim 7,563; Abu Dawud 5,274; Tirmidhi 3,998; Nasa'i 5,765; Ibn Majah 4,343; Malik 1,858 | Yes (`ara-*`, two variants each) | No (isnad and matn in one `text`) | Abu Dawud, Ibn Majah, Nasa'i, Tirmidhi, Malik: grades by al-Albani, Arnaut, Zubair Ali Zai and others; Bukhari and Muslim: none | Unlicense (public-domain dedication of the compilation). Sources include al-maktaba.org and sunnah.com, and the bundled English translations are third-party copyrighted works |
| Sanadset 650K (https://data.mendeley.com/datasets/5xth87zwb5, DOI 10.17632/5xth87zwb5.5) | 926 Arabic hadith books | 650,986 records; `sanadset.csv` 1.43 GB (not downloaded) | Yes | Yes (`<SANAD>`, `<MATN>`, `<NAR>` tags) | No | CC BY 4.0 (Mendeley API `data_licence`) |
| LK Hadith Corpus (https://github.com/ShathaTm/LK-Hadith-Corpus) | Six books, Arabic–English parallel | 39,038 hadith | Yes | Yes (`Arabic_Isnad`, `Arabic_Matn`; Bukhari hand-checked, the rest auto-segmented at 92%) | `Arabic_Grade` / `English_Grade` | No license file; the authors ask for a citation; the text appears to derive from sunnah.com |
| Open-Hadith-Data (https://github.com/mhashim6/Open-Hadith-Data) | 9 books incl. Ahmad and Darimi, with and without tashkeel | — | Yes | No | No | ODbL 1.0 + DbCL 1.0 (LICENSE); origin is `ceefour/hadith-islamware` |
| sunnah.com API (`api.sunnah.com/v1`) | Many collections, Arabic + English | — | Yes | Partial | Yes (on site) | `/v1/collections` without a key returns 403 `{"message":"Forbidden"}`. Keys are requested via a GitHub issue on `sunnah-com/api` (template asks for rate limits and dump vs API). The repo has no license file, and https://sunnah.com/developers was Cloudflare-blocked for automated fetch, so its terms were not read |
| Dorar al-Saniyya API (`https://dorar.net/dorar_api.json?skey=…`) | Hadith encyclopedia search with rulings | — | Yes | No (HTML inside JSON) | Yes (muhaddith rulings) | Article https://dorar.net/article/389 and the endpoint return Cloudflare 403 to automated clients. A third-party proxy author reports there are no complete docs, the API returns HTML inside JSON, and the proxy stopped working after Cloudflare was added in 2026 (issue https://github.com/AhmedElTabarani/dorar-hadith-api/issues/29). Terms not read |

Hadith direction for the later phase: Arabic matn+isnad from Sanadset (CC BY 4.0) or the Arabic `ara-*` editions of hadith-api; grades from hadith-api's info.json, crediting each grader; English only from a licensed source (sunnah.com by agreement). Samples saved: `data/raw/fawazahmed0-hadith-api/` (editions, info, 2 Arabic hadith) and `data/raw/lk-hadith-corpus/Bukhari_Chapter1.csv`.

## 9. Recommendation

### 9.1 Arabic tafsir — launch set (concise → detailed)

| Order | Work | Arabic title | Import source | Size (unique chars) | Rights basis |
| --- | --- | --- | --- | --- | --- |
| 1 | al-Muyassar (King Fahd Complex) | التفسير الميسر | QuranEnc `arabic_moyassar` SQLite | 1,377,550 | Explicit QuranEnc re-publication grant |
| 2 | al-Sa'di, Taysir al-Karim al-Rahman | تيسير الكريم الرحمن | QUL 308 (SQLite via QUL account; fallback tafsir_api `ar-tafsir-as-saadi` @v1.2.2) | 3,074,260 | Author died 1956 (see 9.6) |
| 3 | al-Baghawi, Ma'alim al-Tanzil | معالم التنزيل | QUL 27 | 7,747,270 | Public domain (died 1122) |
| 4 | Ibn Kathir | تفسير القرآن العظيم | QUL 22 | 13,401,179 | Public domain (died 1373) |
| 5 | al-Qurtubi, al-Jami' li-Ahkam al-Qur'an | الجامع لأحكام القرآن | QUL 23 | 17,323,373 | Public domain (died 1273) |
| 6 | al-Tabari, Jami' al-Bayan | جامع البيان | QUL 37 | 20,578,907 | Public domain (died 923) |
| Optional | al-Mukhtasar (Tafsir Center) | المختصر في تفسير القرآن الكريم | QuranEnc `arabic_mokhtasar` | 1,050,575 | Explicit QuranEnc grant |

- Total for items 1–6: 63,502,539 unique characters (roughly 115–125 MB of UTF-8 text). That fits comfortably in Postgres.
- Data model: store each passage once with `from_key`, `to_key` and member ayah keys, and keep the HTML.
- Exclude for now: the `ar-tafseer-tanwir-al-miqbas` slug (mislabelled and corrupt); QUL's Arabic Jalalayn (226 missing); al-Wasit/Tantawi (in copyright); Ibn Uthaymeen, Adwa' al-Bayan and al-Tahrir wa al-Tanwir (modern authors; partial or in copyright in life+70 countries).
- Do not import QUL 38 al-Muyassar until the provenance of its added surah-intro block and revised wording is documented.

### 9.2 English translation

- Primary: Saheeh International, from QuranEnc `english_saheeh` v1.1.2. Store it verbatim, including footnotes. Hide the leading "(n) " ayah number at render time only, and ask QuranEnc to confirm that this display choice is acceptable.
- Second option: Rowwad Translation Center, `english_rwwad` v1.0.19 (same terms; plainer modern English).
- Public-domain fallback: Pickthall 1930, imported from Wikisource.
- Not recommended as an import source: Tanzil (non-commercial, no redistribution), the Quran.com API (no redistribution), and Yusuf Ali (US risk until 2030–2034).

### 9.3 Word-by-word English

Use the Quranic Arabic Corpus glosses verbatim, with the required credit and link. Re-import them from the corpus or QUL rather than from the CSV, because of the 2:255 truncation. Raise the non-commercial wording with the corpus maintainers (the Quran.com team) before exposing the glosses through our public API.

### 9.4 Audio

- Verse recitation: EveryAyah per-ayah MP3s. Start by streaming from `everyayah.com/data/…` (or the quranicaudio mirror); self-host on object storage later. One reciter at 128 kbps is about 1.7 GB, computed from Alafasy. This is acceptable only while the site is non-commercial (CC BY-NC).
- Launch reciters: those covered by quran-align, so highlighting works on day one. Recommended: Alafasy_128kbps, Husary_64kbps (or Husary_Muallim_128kbps for learners), Minshawy_Murattal_128kbps and Abdul_Basit_Murattal_64kbps.
- Word highlighting: quran-align, CC BY 4.0.
- Per-word pronunciation: until written permission arrives from ReciteQuran.com / Quran Foundation for the Wisam Sharieff files, play the word's segment of the verse audio.

### 9.5 Exact attribution text to display

Tafsir panel footer, al-Muyassar:

```
التفسير الميسر — نخبة من العلماء، مجمع الملك فهد لطباعة المصحف الشريف. المصدر: موسوعة القرآن الكريم QuranEnc.com — الإصدار: {version}
```

Tafsir panel footer, al-Mukhtasar:

```
المختصر في تفسير القرآن الكريم — مركز تفسير للدراسات القرآنية. المصدر: موسوعة القرآن الكريم QuranEnc.com — الإصدار: {version}
```

Tafsir panel footer, classical works (one line per work; shown for Sa'di, al-Baghawi, Ibn Kathir, al-Qurtubi and al-Tabari):

```
تيسير الكريم الرحمن في تفسير كلام المنان — الشيخ عبد الرحمن بن ناصر السعدي (ت ١٣٧٦هـ). مصدر النص الرقمي: Quranic Universal Library (qul.tarteel.ai)
معالم التنزيل — الإمام الحسين بن مسعود البغوي (ت ٥١٦هـ). مصدر النص الرقمي: Quranic Universal Library (qul.tarteel.ai)
تفسير القرآن العظيم — الحافظ إسماعيل بن عمر ابن كثير (ت ٧٧٤هـ). مصدر النص الرقمي: Quranic Universal Library (qul.tarteel.ai)
الجامع لأحكام القرآن — الإمام محمد بن أحمد القرطبي (ت ٦٧١هـ). مصدر النص الرقمي: Quranic Universal Library (qul.tarteel.ai)
جامع البيان عن تأويل آي القرآن — الإمام محمد بن جرير الطبري (ت ٣١٠هـ). مصدر النص الرقمي: Quranic Universal Library (qul.tarteel.ai)
```

English translation footer:

```
Translation: Saheeh International (issued by Noor International Center). Source: QuranEnc.com — Encyclopedia of the Noble Qur'an, version {version}.
Translation: Rowwad Translation Center, with the Rabwah Dawah Association, the Islamic Content Service Association in Languages and IslamHouse.com. Source: QuranEnc.com, version {version}.
Translation: Marmaduke Pickthall, The Meaning of the Glorious Koran (1930). Public domain.
```

Word-by-word footer, with a link to https://corpus.quran.com:

```
Word-by-word English translation and transliteration: The Quranic Arabic Corpus (corpus.quran.com), Kais Dukes, University of Leeds; maintained by the Quran.com team.
```

Audio footer, with links to https://everyayah.com and https://github.com/cpfair/quran-align:

```
Recitation audio: EveryAyah.com (VerseByVerseQuran.com), licensed CC BY-NC 2.5. Word timing data: quran-align by Collin Fair, licensed CC BY 4.0.
```

Credits page: list every source above with its URL, license and the version or date imported, plus "Quran Foundation" if the live API fallback is ever used ("Quran data provided by Quran Foundation").

### 9.6 Risk notes behind the recommendation

- Sa'di: no license is attached to QUL's data. The text is public domain in Saudi Arabia (life+50) and becomes public domain in life+70 jurisdictions on 2027-01-01. Before then, the residual risk sits with his heirs or the publisher (Mu'assasat al-Risala edition, ed. al-Luwayhiq).
- EveryAyah is non-commercial. If the site will carry ads, subscriptions or paid tiers, the audio plan must change: each reciter's publisher must license their recordings directly.
- QuranEnc's version numbers for `arabic_moyassar` and `arabic_mokhtasar` are not exposed by its API. Until QuranEnc supplies them, record the SQLite file date (2025-03-25) and its SHA-256.

## 10. Pending — who owns what

- Owner: create a free QUL account and download the SQLite files for tafsir 308, 27, 22, 23 and 37 (plus word-by-word 92 and segmented recitations if wanted). My rules forbid creating accounts. Fallback without an account: tafsir_api JSON at `v1.2.2`.
- Owner: decide whether the site is commercial. This decides EveryAyah (BY-NC), Tanzil and the corpus's non-commercial wording.
- Owner: send these permission requests, which go out under your name: (1) QuranEnc — version numbers and confirmation that public-API re-publication and hiding the "(n)" prefix are fine; (2) ReciteQuran.com / Quran Foundation — Wisam Sharieff word audio; (3) the Quranic Arabic Corpus maintainers — the word-by-word glosses through an API.
- Owner or counsel: confirm Yusuf Ali's US status before ever offering it, and the edition-rights posture for classical texts.
- Later phase: request a sunnah.com API key (GitHub issue template); read Dorar's terms in a real browser, because Cloudflare blocks automation.
- Flagged outside this task: `data/raw/lexica` is 1.7 GB, created by another workstream; free disk is now about 28 GB. `data/raw` also holds byte-identical duplicates: `fonts/UthmanicHafs_V22.ttf` = `fonts/kfgqpc-uthmanic-hafs/UthmanicHafs_V22.ttf`, `qac/…morphology-0.4.txt` = `qac-morphology-0.4/…`, and `tanzil/quran-uthmani.txt` = `tanzil/quran-uthmani-nomarks.txt`. I did not touch them.

## Appendix A — files saved by this research

| Path under `data/raw/` | Bytes | What |
| --- | --- | --- |
| `tafsir_api/editions.json` | 29,000 | 123 editions @v1.2.2 |
| `tafsir_api/ar-tafsir-muyassar.json` | 3,038,625 | Full QUL-38 Muyassar, merged |
| `tafsir_api/ar-tafseer-al-saddi.json` | 6,167,109 | Full QUL-24 Sa'di, merged (59 empty ayahs listed) |
| `tafsir_api/ar-tafsir-as-saadi.json` | 38,933,247 | Full QUL-308 Sa'di, merged |
| `quranenc/arabic_moyassar/arabic_moyassar.sqlite` | 2,686,976 | Muyassar, 6236 rows |
| `quranenc/arabic_mokhtasar/arabic_mokhtasar.sqlite` | 2,097,152 | Mukhtasar, 6236 rows |
| `quranenc/english_saheeh/english_saheeh.sqlite` | 1,245,184 | Saheeh International v1.1.2 |
| `quranenc/english_rwwad/english_rwwad.sqlite` | 1,245,184 | Rowwad v1.0.19 |
| `quranenc/*_sura1.json`, `english_saheeh_1_1.json`, `translations_list_all.json` | small | API samples and listing |
| `tanzil-trans/en.sahih.txt`, `en.pickthall.txt`, `en.yusufali.txt`, `ar.muyassar.txt` | 0.86–2.5 MB | Reference copies only (Tanzil non-commercial terms) |
| `quran-com-api/*.json` | small | Resource lists, Muyassar 1:1, words 1:1 and ch.1, recitations, QDC segments, reciters |
| `everyayah/recitations.js` | 10,907 | 79 reciter folders |
| `quran-align/quran-align-data-2016-11-24.zip` + `data/{Alafasy_128kbps.json, README, LICENSE}` | 5,807,871 + 2,338,655 | CC BY 4.0 timings |
| `audio-samples/*.mp3` | 273,969 total | 3 sample MP3s |
| `fawazahmed0-hadith-api/{editions,info}.json` + 2 Arabic samples | 10,352,893 | Hadith survey |
| `lk-hadith-corpus/Bukhari_Chapter1.csv` | 81,267 | Isnad/matn sample |

## Appendix B — how the numbers were produced

- Tafsir completeness: a script fetched `{slug}/{1..114}.json` and every `{slug}/{s}/empty_ayahs.json` at `v1.2.2`. It asserted `ayah_data.json` sums to 6236, then computed present/missing keys, empty texts, identical-text groups, contiguity and unique characters.
- Muyassar comparison: normalisation removed harakat, Qur'anic small marks and tatweel, unified alif forms, ى and ة, expanded ﷺ, dropped the intro block, and stripped non-letters. The comparison then ran `difflib.SequenceMatcher` on each of the 6,236 ayahs.
- CSV versus Quran.com: `GET /api/v4/verses/by_chapter/2?words=true&word_translation_language=en&per_page=100` (pages 1–3) compared to the CSV's `ID` and `Translation` columns, word by word.
- Audio identity: `md5` of the three Alafasy 001001 copies. URL liveness: HEAD requests (HTTP 200 + `audio/mpeg`).
- QUL login requirement: every `<a>` whose text starts with "Download" on 6 resource pages pointed at `/users/sign_in`.
