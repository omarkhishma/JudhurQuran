# 18 · Data & API: baseline and build plan (P10)

Date: 2026-10-04. Scope: the 67 DAT items of research 05 Part 4 §5 (DAT-01…55, DAT-Q01…Q08, DAT-H01…H04), against the code at commit `8925ae3`, with the approved decisions D2 (launch non-commercial, every layer's licence recorded) and D14 (CC BY-SA 4.0 for our own derived layers, per-source licences for the rest; a DOI needs the owner's Zenodo account).

## 1. What exists

- `/data` is a skeleton with the live changelog of merged contributions under it (P7.3: `components/contrib/Changelog.tsx`, re-read on focus). `/developers` lists thirteen endpoints in prose, Arabic and English. `/sources` lists the sources and their licences.
- The API (`/api/v1`) answers everything the site reads: search with typed detection (Arabic word, transliteration, English, root, pattern, verse — DAT-51's six kinds), roots, words, patterns, a root's concordance, lexicon articles (display only, D22), the analyser on the reader's own text (`POST /analyse/tokens`), graphs. Every content answer carries `X-Dataset-Version` and `X-Dataset-Release` headers and a strong ETag; an unknown id is a 404. The OpenAPI document is served at `/api/v1/openapi.json`. Requests are limited per IP (600 a minute by default); there are no keys.
- `jadhr_pipeline.release` builds `data/release/<version>/`: verses, words, lemmas, roots and a root-variants table as JSON Lines and CSV, a `MANIFEST.json` with each file's sha256 and rows, the sources, the copyright notices reproduced verbatim, and `publication_hold` — the core files are held: the corpus-derived files wait on D19 (asking the corpus's maintainers) and D2, the KFGQPC Unicode data on the Complex's confirmation. The CSVs end lines with LF, so they are not RFC 4180 (CRLF).
- Nothing yet: TEI or LMF, a record of releases in the database, release files served by the API, a citation, a playground, API keys, a public envelope.

## 2. Held for the owner, and why it does not stop the build

- **Publication** (D19, D2): the release is built and served with its hold; files under the hold are listed with the reason and not served. Lifting it is one command the owner runs, or tells me to run.
- **DOI** (D14): needs the owner's Zenodo account. Until then a release is cited by its own immutable address (version + manifest + sha256), and the DOI field is shown only when there is one (DAT-Q04: no placeholder DOI).
- **Hosting and object storage** (D12): release files are served from the release directory by the API, immutable by version; object storage is a deployment setting later.

## 3. The items, by step

| Step | Items | What |
|---|---|---|
| P10.1a Formats | DAT-11…13, Q05 | TEI Lex-0 and LMF (ISO 24613) for the lexical layers we may redistribute, validated against their published schemas in the build; the Quran morphology as a token table keyed by place (surah:ayah:word:segment); CSV in RFC 4180 (CRLF, quoted), UTF-8, NFC; checks that fail the build |
| P10.1b Releases | DAT-07…10, 55, Q01, Q04 | `content.dataset_releases`, immutable (a version's files and hashes never change); the loader records each release; `GET /api/v1/releases`, `/releases/{version}` (its manifest), `/releases/{version}/{file}` (the file, sha256 in a header) — held files listed, not served; past releases kept retrievable |
| P10.2a The public API | DAT-29…37, 42…53, Q02, Q03, Q07, H02 | `/api/v1/public/…` with the envelope `{meta: {dataset_version, release, license, sources, generated_at}, data}` (08 §8.8): lookup, roots, words, patterns, concordance (paginated), lexica (as the site shows them: display only), releases; namespaced by product (`quran`, `lexicon`) per DAT-Q07; provenance per layer — every record its source ids, machine-derived values said to be so |
| P10.2b Keys and limits | DAT-37, 48, Q01 | Keys made by a signed-in reader on their Profile, shown once, stored hashed, revocable; reads without a key at a lower limit per IP, with a key at the key's own limit (08 §8.1, §8.8); limits stated in the docs and in `RateLimit-*` headers |
| P10.3a The Dataset tab | DAT-01…06, 14…27, Q04, Q06, H01, H03, H04 | `/data` with the tabs Dataset · API playground (`?tab=api`); stats computed from the release; releases with their files, formats, sizes, hashes and their hold; the changelog (exists); "Cite the dataset" — BibTeX, RIS, Chicago, APA and an Arabic form, copied with a toast that shows either way; sources and licences per layer from the manifest; no "used by" |
| P10.3b The playground | DAT-28, 38…41, 50, Q08 | The public endpoints in a list, a request with an editable parameter, Send — the real call, its real status, time and headers — and curl that is valid for GET and POST |
| P10.3c Docs | P10.2 | `/developers` rewritten around the public API in Arabic and English, each endpoint with its parameters, limits, licences and an example |
| P10.4 Exit ◆ | P10.4 | A citation copied from `/data` resolves to the immutable artefact it names: the address in it serves the release's manifest, and every file's sha256 matches |

Adapted from the design, with reasons in DECISIONS when built: the playground's endpoints are the public API's (DAT-47 against 08 §8.8: the design's list mixes both); the licence header names our licence for our layers and each source's for theirs, not one "CC BY-SA 4.0 · code MIT" line (DAT-02, 23, 24); a DOI is shown only when minted (DAT-19…22, Q04); "Used by" is left out until it can be counted (DAT-25); the citation formats are the union of the design's and the docs' (DAT-22, Q06).

## 4. Baseline per item

| Items | At baseline |
|---|---|
| DAT-01…06 route, header, title, stats | open (skeleton) |
| DAT-07…10 releases | open — one release built locally, not listed or served |
| DAT-11, 12 CSV | partial — CSVs exist, LF line endings (not RFC 4180) |
| DAT-13 TEI, LMF | open |
| DAT-14…17 changelog | exists (P7.3), live, re-read on focus |
| DAT-18…22 citation | open |
| DAT-23, 24 sources and licences | partial — `/sources` and the manifest; not on `/data` |
| DAT-25 used by | to leave out (fake) |
| DAT-26, 27 footer, toast | open |
| DAT-28…41 playground | open (the API exists) |
| DAT-42…44 response shapes | partial — our own shapes, documented by OpenAPI |
| DAT-45, 46 provenance | partial — headers only |
| DAT-47 public endpoints | open |
| DAT-48 keys and limits | partial — per IP only |
| DAT-49 not found | done — 404 with a reason |
| DAT-50 curl | open |
| DAT-51 query detection | done — six kinds |
| DAT-52 fake lexica | not ours — articles are real, display only |
| DAT-53 concordance | done — the Quran's |
| DAT-54 phone, dark | open |
| DAT-55 production releases | open |
| DAT-Q01…Q08 | Q02 recorded (manifest, `/sources`), Q03 partial, Q05 partial, Q06 the reader's cite dialog exists; the rest open |
| DAT-H01, H04 | done (changelog); H02 partial; H03 open |

## 5. Formats: what has to be decided by reading the standards

- **TEI Lex-0** (DARIAH's TEI customisation for dictionaries): its RelaxNG schema, from the project's own repository; which of our layers become `entry` (lemmas with their root, forms, senses from the sources we may redistribute), and what may not (the classical lexica are display-only, D22).
- **LMF**: ISO 24613-1:2019 is the model; its XML serialisations are ISO 24613-4 (TEI-based) and the older 2008 DTD. Research 19 names the serialisation and the schema we validate against, and maps lemmas, roots, patterns and forms onto it.
- **Morphology token table**: one row per segment, keyed `surah:ayah:word:segment`, with the corpus's notice reproduced (its terms ask for it in derived works).

## 6. For the owner

- Lifting the publication hold once D19's answers come (the corpus maintainers, the Complex).
- A Zenodo account for the DOI (D14), or the decision to cite by our own addresses only.
- Whether API keys are for anyone signed in (my recommendation: yes, self-service, revocable) or granted.
- Counts at this baseline: 67 items — 9 done (DAT-14…17, 49, 51, 53, H01, H04), 1 not ours (DAT-52), 16 partial (DAT-03, 11, 12, 23, 24, 42…46, 48, H02, Q02, Q03, Q05, Q06), 41 open (DAT-25 among them, to be left out).
