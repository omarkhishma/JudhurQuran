# 19 · Lexicon formats: TEI Lex-0 and LMF for the release (P10.1a)

Date: 2026-10-04. Scope: DAT-13 and DAT-Q05 of research 05 (TEI Lex-0 and LMF for the lexicon, validated in the build), as set out in research 18 §3 and §5. Inputs read: research 18, research 05 §5 (DAT), `pipeline/src/jadhr_pipeline/release.py`, `data/release/2026.10.0/MANIFEST.json`, rows of `lemmas.jsonl`, `roots.jsonl` and `words.jsonl`, `data/lexica.yaml` (Lane), `data/registry/*.tsv` (slugs).

Method: every claim below was read at its source (URLs in §6). The schemas were downloaded, and sample documents built from real rows of release 2026.10.0 were validated with lxml 6.1.3 (libxml2 2.14.6, the version this repo resolves) and with Jing. Each check was also run against deliberately broken documents to show it can fail. Nothing was written to the repository except this file; the test files live in the session scratchpad.

## 1. Recommendation

- **Emit two lexicon formats, one file per licence scope.** Format 1 is **TEI Lex-0 0.9.5**, the dictionary view. Format 2 is **LMF in its ISO 24613-4:2021 TEI serialisation**, the NLP-lexicon view. The licence scopes are (a) the Quranic lexicon (roots, lemmas and attested word forms, derived from the Quranic Arabic Corpus, with our patterns), which is held like `words`, `lemmas` and `roots` (D19, D2), and (b) Lane's Lexicon (CC BY-SA 3.0 US, `redistributable: true` in `data/lexica.yaml`). Keeping the scopes in separate files means the hold on (a) does not block (b), and each file states exactly one set of terms.
- **TEI Lex-0 file.** The structure follows TEI Lex-0's own Arabic precedent. Each root is `<entry type="wordFamily">` with `<form type="root">`. Each lemma is a nested `<entry type="mainEntry">` holding `<form type="lemma">`, `<form type="scheme">` for the pattern (wazn), and `<gramGrp>`. The 175 lemmas that have no root (77 proper nouns, 21 nouns, and 77 particles, demonstratives and pronouns, as the corpus gives them) are top-level `mainEntry` elements, with no family and no pseudo-root. Lane's articles go in the Lane file as `<sense>`/`<def>`, verbatim, with `@source`.
- **LMF file.** The resource is `<teiCorpus type="lexicalResource">`; its header is the LMF GlobalInformation. It contains one `<TEI type="lexicon">`, whose header is the LexiconInformation. There is one flat `<entry>` per lemma (LexicalEntry), carrying:
  - `<form type="lemma">` (Lemma);
  - `<form type="root">` (Stem, the class ISO 24613-2 says "can be typed as a specific type of stem or root (e.g. type="arabicRoot")");
  - one `<form type="inflected">` with its `<gramGrp>` per attested word form (WordForm);
  - an entry-level `<gramGrp>` (GrammaticalInformation) that includes the pattern.
- **Schemas, vendored into the repo with their licence notices.** The build never fetches them.

| Schema | Use | Pinned download | sha256 | Licence |
|---|---|---|---|---|
| TEI Lex-0 0.9.5 RNG | the conformance target and release gate (Jing) | `https://lex-0.org/releases/v0.9.5/schema/lex-0.rng` | `35e73fef48526634714bdf3d16b924f958fca078a903d0bdc2dd4d7d116d1aaa` | BSD-3-Clause (BCDH/tei-lex-0), with TEI P5 material (TEI Consortium, BSD-2-Clause or CC BY 3.0) |
| TEI Lex-0 0.9.4 RNG | fast in-process regression test (lxml), no Java | `https://raw.githubusercontent.com/DARIAH-ERIC/lexicalresources/v0.9.4/Schemas/TEILex0/out/TEILex0.rng` | `f5270a718c377d18d3137d4fbbd883e3d39a01dca890fa62f5f580d43d1aa30a` | BSD-2-Clause (DARIAH-ERIC), with TEI P5 material |
| LMF (ISO 24613-4) RNG | LMF gate (lxml), with Jing as a second check | `https://raw.githubusercontent.com/DARIAH-ERIC/lexicalresources/c321c089d91dde4d814a40a97f4c607270d287f3/Schemas/LMFinTEI%20Specification/out/LMFinTEIspec.rng` | `6c1c0b906296efd5829a3c69d37ca4b65f2405041db4ad6cc799eec58b18ea72` | BSD-2-Clause (DARIAH-ERIC), with TEI P5 material |
| Jing 20241231 | RELAX NG validator for 0.9.5 | `https://github.com/relaxng/jing-trang/releases` (asset `jing-20241231.zip`; pin its sha256 like `data/raw`) | to compute at pinning | BSD-style (Thai Open Source Software Center), see `copying.txt` |

- **Validation that fails the build.**
  - Jing checks every TEI Lex-0 file against 0.9.5. If Java is missing, the build fails; it does not skip the check.
  - lxml checks every LMF file against the ISO 24613-4 RNG.
  - lxml checks every TEI Lex-0 file against 0.9.4 in pytest, so a regression is caught without Java.
  - Our own Python checks cover what no schema can see (§4.4): pointer integrity, language tags, NFC and byte equality with the JSONL, counts against the manifest, the licence statements, and the three TEI Lex-0 Schematron rules.
- **Why Jing.** libxml2, and therefore lxml and xmllint, did not finish compiling the 0.9.5 RNG: lxml was stopped after more than 9 minutes of CPU, and xmllint (libxml2 2.9.13) was killed after 4 minutes. The 0.9.4 RNG compiles in 0.01 s. libxml2 also rejects the 0.9.5 XSD: "The content model is not determinist". Jing validates 0.9.5 in under a second and gives precise messages (§4.1).
- **Not chosen for LMF** (§3.2):
  - The 2008 DTD (rev. 16) belongs to a withdrawn standard. It is published only as an informative annex of an ISO-copyright document, its original host is gone, and there is no licence under which to vendor it.
  - WN-LMF is for wordnets: every Sense must point at a Synset, it has a closed part-of-speech list, and its repository has no licence.
  - LBX (ISO 24613-5) has no public schema.
- **The formats change no licence position.** Every file inherits the hold and the notices of its inputs, and goes into `MANIFEST.json` with its sha256, its count and its notice, exactly as the JSONL and CSV files do.

## 2. TEI Lex-0

### 2.1 Findings

- **TEI Lex-0 has moved.** It now lives at `github.com/BCDH/tei-lex-0`, with its site at `lex-0.org`. The DARIAH-ERIC repository's last commit (b038b2b, 2026-01-26) is "add redirects to new site", and the old guidelines URL (`dariah-eric.github.io/lexicalresources/pages/TEILex0/TEILex0.html`) now redirects to `lex-0.org`.
- **Current version is 0.9.5.** It was tagged `v0.9.5` (commit 8c2c50bd80d998e4218cb9adf26f8ae1d4995b70) and released 2026-02-08, per `CITATION.cff` and the tag date. The release page says "Current release v0.9.5". Its schema was generated on 2026-02-08 from TEI P5 4.10.2. 0.9.4 was the last DARIAH release (2025-05-14, TEI P5 4.9.0).
- **The schema is a build output, not a file in git** (`build/` is gitignored). lex-0.org publishes it per release:
  - `https://lex-0.org/releases/v0.9.5/schema/lex-0.rng`
  - the same release also has `.rnc` and `.xsd`, plus `xml.xsd`
  - `https://lex-0.org/schema/lex-0.rng` is the moving "latest" alias. Today it differs from the v0.9.5 file only in its build timestamp.
  - `dev.lex-0.org` carries an unreleased build on TEI P5 4.12.0. Do not use it.
  - The ODD source is `odd/lex-0.odd` at tag `v0.9.5`.
- **Licences.**
  - BCDH/tei-lex-0 is BSD-3-Clause ("Copyright (c) 2025, Boris Lehečka").
  - DARIAH-ERIC/lexicalresources is BSD-2-Clause ("Copyright (c) 2017, DARIAH-ERIC").
  - The generated RNG embeds TEI P5 material, which the TEI Consortium licenses as "both Creative Commons Attribution 3.0 Unported License and a BSD 2-Clause license".
  - lex-0.org links CC BY 4.0 for its pages; I did not read the exact wording of that statement.
- **What the RNG enforces.** This was read from the 0.9.5 and 0.9.4 RNGs and confirmed by validation:
  - `TEI/@type="lex-0"` is required (closed list).
  - `teiHeader` must have `fileDesc` and `profileDesc`. `profileDesc/langUsage` needs at least one `language`, with a required `@role` (objectLanguage, workingLanguage, sourceLanguage, targetLanguage).
  - `publicationStmt` must contain `availability`. The guidelines: "TEI Lex-0 requires the use of `<availability>` to record the `<licence>`".
  - `sourceDesc` is optional, but if present it holds `listBibl` with `biblStruct`.
  - `entry` requires `xml:id` and `xml:lang`. In 0.9.5 it also requires `@type`.
  - `sense` requires `xml:id`.
  - These value lists are closed: `xr/@type` (synonymy, hyponymy, hypernymy, meronymy, antonymy, related), `cit/@type`, `usg/@type`, `etym/@type`, `availability/@status` (free, unknown, restricted).
  - These are semi-open (listed values, plus any Name or token): `entry/@type` (mainEntry, wordFamily, homonymicEntry, relatedEntry), `form/@type` (simple, lemma, variant, compound, derivative, inflected, phrase), `gram/@type`, `ref/@type` (entry, sense, bibliography, and in 0.9.5 example).
- **Changes from 0.9.4 to 0.9.5 that touch us.**
  - `entry/@type` became required.
  - In `gram/@type`, `construction` was added and `government` dropped.
  - `ref/@type` gained `example`.
  - `dictScrap` is still defined but no longer referenced anywhere, so it cannot be used. Jing reports that `dictScrap` is "not allowed anywhere" in an `entry`.
- **Stricter than plain TEI, found while testing.** `catDesc` must be `<term>` plus an optional `<gloss>`. In `biblStruct`, `idno` goes inside `monogr`, not after it.
- **Precedent for Arabic roots.** It comes from TEI Lex-0 itself.
  - The Entries chapter (§2.3.2 "superEntry", still present in 0.9.5) says: "This is especially important for traditional root-based dictionaries, which start with the root as the main headword, followed by full-fledged lexicographic entries of derived headwords". Its examples, taken from al-Munjid (2014), encode the root as `<entry type="wordFamily" xml:lang="ar">` with `<form type="root"><orth>سيج</orth></form>` and nested `<entry type="mainEntry">`.
  - A second example (شهم) uses `<form type="scheme">` for the stem-vowel template.
  - Issue #12 (closed 2020-07-06) fixes the entry typology (mainEntry, wordFamily, homonymicEntry, relatedEntry) and points to these "word families … from Arabic dictionaries".
  - I found no other published Arabic dictionary in TEI Lex-0. That is unverified, not a negative finding: I searched only the TEI Lex-0 repositories, issues and guidelines.
- **The root is not etymology.** The etymology chapter was a stub in 0.9.4 ("This section needs to be transferred from Jack's and Laurent's paper"). `etym` and `cit type="etymon"` describe diachrony. A Semitic root is a synchronic morpheme shared by a word family, so neither is used for it.

### 2.2 Minimal valid skeleton

This is valid against 0.9.5 (Jing, exit 0) and 0.9.4 (lxml). Ellipses mark text to fill. Real values from release 2026.10.0 are used.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://lex-0.org/releases/v0.9.5/schema/lex-0.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" type="lex-0" xml:lang="en">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title type="full">Jadhr — Quranic roots and lemmas, dataset 2026.10.0</title>
        <title type="abbr">jadhr-quran-lexicon</title>
        <respStmt xml:id="jadhr"><resp>Compiled, converted and patterns derived by</resp><orgName>Jadhr</orgName></respStmt>
      </titleStmt>
      <editionStmt><edition n="2026.10.0">Dataset release 2026.10.0</edition></editionStmt>
      <publicationStmt>
        <publisher>Jadhr</publisher>
        <date when="2026-10-04"/>
        <idno type="URI">…/api/v1/releases/2026.10.0</idno>
        <availability status="restricted">
          <licence target="https://www.gnu.org/licenses/gpl-3.0.html" corresp="#src.qac">Lemmas, roots, parts of speech: derived from the Quranic Arabic Corpus … (corpus terms of use)</licence>
          <licence target="https://creativecommons.org/licenses/by-sa/4.0/">Patterns (wazn) and this file's structure: Jadhr, CC BY-SA 4.0.</licence>
          <p>[the corpus copyright block, verbatim]</p>
        </availability>
      </publicationStmt>
      <sourceDesc>
        <listBibl type="corpora">
          <biblStruct xml:id="src.qac">
            <monogr>
              <author>Kais Dukes</author>
              <title>Quranic Arabic Corpus — morphology</title>
              <idno type="URI">https://corpus.quran.com/</idno>
              <edition>0.4</edition>
              <imprint><date when="2011">2011</date></imprint>
            </monogr>
          </biblStruct>
        </listBibl>
      </sourceDesc>
    </fileDesc>
    <encodingDesc>
      <p>Arabic text is Unicode NFC, as converted from the source. Patterns are derived by Jadhr; @ana names the method.</p>
      <classDecl>
        <taxonomy xml:id="patternMethod">
          <category xml:id="pm.match"><catDesc><term>match</term><gloss>matched against the vocalised lemma</gloss></catDesc></category>
          <category xml:id="pm.tag"><catDesc><term>tag</term><gloss>from the corpus derivation tag</gloss></catDesc></category>
          <category xml:id="pm.verbForm"><catDesc><term>verb-form</term><gloss>from the corpus verb form</gloss></catDesc></category>
        </taxonomy>
      </classDecl>
    </encodingDesc>
    <profileDesc>
      <langUsage>
        <language ident="ar" role="objectLanguage">Arabic</language>
        <language ident="en" role="workingLanguage">English</language>
      </langUsage>
    </profileDesc>
  </teiHeader>
  <text>
    <body>
      <entry type="wordFamily" xml:id="root.رحم" xml:lang="ar" source="#src.qac">
        <form type="root"><orth>رحم</orth></form>
        <entry type="mainEntry" xml:id="lemma.rahman" xml:lang="ar" n="3">
          <form type="lemma"><orth>رَّحْمَٰن</orth></form>
          <form type="scheme" resp="#jadhr" ana="#pm.match"><orth>فَعْلَان</orth></form>
          <gramGrp><gram type="pos" norm="N">noun</gram></gramGrp>
        </entry>
        <entry type="mainEntry" xml:id="lemma.rahima" xml:lang="ar" n="1137">
          <form type="lemma"><orth>رَّحِمَ</orth></form>
          <form type="scheme" resp="#jadhr" ana="#pm.verbForm"><orth>فَعِلَ</orth></form>
          <gramGrp><gram type="pos" norm="V">verb</gram></gramGrp>
        </entry>
      </entry>
      <entry type="mainEntry" xml:id="lemma.min" xml:lang="ar" source="#src.qac">
        <form type="lemma"><orth>مِن</orth></form>
        <gramGrp><gram type="pos" norm="P">preposition</gram></gramGrp>
      </entry>
    </body>
  </text>
</TEI>
```

- **Cross-references.** A link between entries is `<xr type="related" subtype="…"><ref type="entry" target="#lemma.rahman">رَّحْمَٰن</ref></xr>`. `xr/@type` is closed, so put the specific relation in `@subtype`; `xr type="sameRoot"` fails validation. A link to the root family in another file is `target="lexicon-quran.tei.xml#root.رحم"`.
- **Lane file.** Same header shape, with `listBibl type="dictionaries"` holding Lane's `biblStruct` and `availability status="free"` (§5).
  - Each Lane root heading becomes `<entry type="wordFamily">` with `<form type="root">`.
  - Each article becomes `<entry type="mainEntry">` with its headword in `<form type="lemma">` and the article verbatim in `<sense xml:id="…"><def xml:lang="en">…</def></sense>`. 0.9.5 validated this; it also accepts `<note>` there.
  - The encoding description should say that each article is one unsplit sense, because the stored text has no sense markup (`data/lexica.yaml` rule `lane-markup-removed`).

### 2.3 Mapping of our fields

| Our field (release 2026.10.0) | TEI Lex-0 | Note |
|---|---|---|
| `roots.key` (e.g. رحم) | `entry[@type="wordFamily"]/@xml:id="root.{key}"` and `form[@type="root"]/orth` | Arabic letters are valid in `xml:id` (tested `root.رحم`, `root.ءاي`, harakat too) |
| `roots.translit` | `form[@type="root"]/orth[@xml:lang="ar-Latn"][@notation="translit"]` | optional; validated |
| `roots.spaced`, `occurrences`, `verse_count`, `surah_count`, `lemma_count` | not encoded | counts and presentation stay in JSONL and CSV; they are not dictionary content |
| `lemmas.id` | `entry/@n` | the numeric id of the row |
| lemma slug (`data/registry/lemma-slugs.tsv`, append-only) | `entry/@xml:id="lemma.{slug}"` | slugs can start with a digit, which is not an NCName, hence the prefix |
| `lemmas.ar` | `form[@type="lemma"]/orth` | verbatim, NFC |
| `lemmas.key_buckwalter` | second `orth` with `@notation="buckwalter"` | optional |
| `lemmas.root` | the nesting itself (the lemma's `entry` sits inside its root's `wordFamily`) | null root → top-level `mainEntry`, no root form |
| `lemmas.pos` | `gramGrp/gram[@type="pos"][@norm="{tag}"]` | `@norm` keeps the corpus tag, the text gives the label |
| `lemmas.pattern` | `form[@type="scheme"][@resp="#jadhr"]/orth` | "scheme" is the term in TEI Lex-0's Arabic example and in ISO 24613:2008's Arabic example (§3.1) |
| `lemmas.pattern_method` (match 2,121 · verb-form 1,045 · tag 927 · verb-form-I 429 · none 310) | `form[@type="scheme"]/@ana` → `category` in `encodingDesc/classDecl/taxonomy` | DAT-Q03: says the value is machine-derived and how |
| `lemmas.verb_form` (1,269 lemmas) | `gram[@type="verbForm"][@norm="IV"]` | outside TEI Lex-0's listed values (allowed by the Name fallback). TEI Lex-0 asks for new values by GitHub ticket |
| `lemmas.derivation` (ACT_PCPL, PASS_PCPL, VN) | `gram[@type="derivation"][@norm="ACT_PCPL"]` | same fallback; not `etym`, which is diachronic |
| `lemmas.occurrences`, `verse_count` | not encoded | in JSONL and CSV |
| senses | none in the Quranic file | no redistributable glosses today: qac-v2 glosses and al-Muyassar are excluded, and the classical lexica are display-only (D22). Lane's articles go in the Lane file |
| provenance | `@source="#src.qac"` (att.global.source) on entries; `@resp="#jadhr"` on what we derived | `biblStruct` ids live in `sourceDesc` |

## 3. LMF

### 3.1 The standard today

- **ISO 24613:2008 is withdrawn.** It was replaced by a multi-part series:
  - 24613-1 Core model: 2019, superseded by the second edition 24613-1:2024, published 2024-01-15 (SIS catalogue; ISO proof dated 2023);
  - 24613-2:2020, Machine-readable dictionary (MRD) model;
  - 24613-3:2021, Etymological extension;
  - 24613-4:2021, TEI serialization;
  - 24613-5:2022, Lexical base exchange (LBX) serialization;
  - 24613-6, Syntax and semantics;
  - 24613-7, Morphology, announced in "LMF Reloaded" (2019).
  - The publication status of parts 6 and 7 is unverified.
  - 24613-2 "merges two normative annexes from the previous edition, Annex A, Morphology extension, and Annex C, Machine-readable dictionary extension".
- **The model is decoupled from any one serialisation.** "LMF Reloaded" (Romary, Khemakhem, Khan, Bowers, Calzolari, George, Pet, Bański): "the proposed model has been decoupled from any single serialisation format, although two potential serialisations of the meta-model constitute parts iv and v of the standard (TEI and LBX respectively)".
- **ISO 24613-4, from the public sample of the FDIS (French).**
  - §5.1: LexicalResource "doit être implémentée au moyen de l'élément `<teiCorpus>`" with `@type="lexicalResource"`. With a single lexicon, this level may be omitted and the document starts at `<TEI>`.
  - §5.2: GlobalInformation is the `teiHeader` child of `teiCorpus`.
  - §5.3: Lexicon is `<TEI type="lexicon">`, with all entries under `text/body`.
  - §5.4: LexiconInformation is the `teiHeader` child of `TEI`.
  - §5.5: LexicalEntry is `<entry>`.
  - §4: every construct must be valid TEI, "un sous-ensemble strict des lignes directrices de la TEI". The document leaves LMF metadata to the TEI header, which is "par essence suffisamment riche". "Une spécification TEI ODD mise à jour correspondant au présent document est disponible à partir de la Référence [12]".
  - The sample stops before the bibliography, so what Reference [12] is remains unverified. "LMF Reloaded" footnotes the specification and examples as `DARIAH-ERIC/lexicalresources/Schemas/LMFinTEI Specification/`.
- **The ODD that ships with that schema** ("The present ODD specification structly covers the elements described in ISO 24613-4"; author Laurent Romary, 2019–2020) maps:
  - Lemma → `form type="lemma"`;
  - Stem → `form type="stem"` or `form type="root"` "(depending on the linguistic context)";
  - Word Part → `form type="affix|prefix|suffix"`;
  - GrammaticalInformation → `gramGrp`;
  - Sense → `sense` with a required `xml:id`;
  - Definition → `def`;
  - CrossREF → `xr` with the same closed relation list as TEI Lex-0. The commit of 2019-11-20 is titled "Aligning LMF-4 and TEI Lex 0".
- **ISO 24613-2:2020** (public sample):
  - §5.5.3: "Stem is a Form subclass containing a stem or root. The Stem class can be typed as a specific type of stem or root (e.g. type="arabicRoot"). The Stem class is in a zero-to-one aggregate association with the LexicalEntry class".
  - §5.5.1: WordForm "can manage simple lexemes, compounds, multi-word expressions, and sub-lexemes such as affixes and roots".
- **ISO 24613:2008's own Arabic example** (FDIS rev 16, Annex B.3.6, Figure B.8): "Arabic root is represented by a shared specific LexicalEntry instance". The verb كتب (kataba) has `partOfSpeech="verb"` and `scheme="fa'ala"`. The noun مكتبة (maktabatun) has `scheme="maf'alatun"`. Each has a RelatedForm with `type="hasARoot"` pointing at the LexicalEntry `type="root"` whose Lemma is "ktb".

### 3.2 The options compared

| | ISO 24613-4:2021 TEI serialisation | ISO 24613:2008 DTD rev 16 | WN-LMF 1.4 (Global WordNet Association) | ISO 24613-5:2022 LBX |
|---|---|---|---|---|
| Status | current | withdrawn with the 2008 standard | maintained (repository pushed 2026-08-11) | current |
| Schema file | `LMFinTEIspec.rng`, DARIAH-ERIC/lexicalresources at commit c321c089d91dde4d814a40a97f4c607270d287f3 | `DTD_LMF_REV_16.dtd`: `http://www.tagmatica.fr/lmf/DTD_LMF_REV_16.dtd` (now 404); archived at `http://web.archive.org/web/20211203093456id_/http://www.tagmatica.fr/lmf/DTD_LMF_REV_16.dtd` (sha256 `160db662…a482`); also in the FDIS Annex R | `https://globalwordnet.github.io/schemas/WN-LMF-1.4.dtd` (DTD only; there is no XSD in the repository, only a JSON schema) | XSD inside the paid standard; no public copy found |
| Licence of the schema | BSD-2-Clause, plus TEI's dual licence | none on the file. The FDIS says the document "is copyright-protected by ISO"; Annex R is "provided for information only" | none (GitHub reports no licence; no LICENSE file) | ISO copyright |
| Validates with lxml | yes: compiles at once; whole release validated in 1.49 s; Jing agrees | yes (DTD); IDREFS are checked | yes (DTD) | n/a |
| Fit for a root-and-pattern Quranic lexicon | good: Stem typed as root (ISO 24613-2), WordForm with features, a header per lexicon for licences, Sense/Definition for Lane | good on paper (ISO's own Arabic example), but every value is free `feat att/val` CDATA, so the DTD checks only structure | poor: `Sense` requires `synset` (IDREF); `Lemma/@partOfSpeech` is closed to n, v, a, r, s, t, c, p, x, u; no root or pattern | unknown |
| Weak points | the RNG was generated 2019-11-21 on TEI P5 3.6.0 and was not regenerated after the ODD's last edit (2020-08-27, etymology values); whether it matches the published 2021 text in every rule is unverified; no `namesdates` module (use `<name type="org">`, not `<orgName>`); no `language/@role` | withdrawn; no lawful copy to vendor is confirmed | wrong model for this data | not obtainable |
| Verdict | **chosen** | not chosen; can be added later if a consumer needs it and the DTD's licence is cleared | not appropriate | not usable |

Why ISO 24613-4 rather than the 2008 DTD, even though the DTD has the closer Arabic precedent:
- It is the serialisation the current standard names.
- Its schema is the only LMF schema published under an open licence, so it can be vendored.
- It compiles in lxml.
- Its TEI header is where a per-lexicon licence belongs.
- The 2008 shape (root as a LexicalEntry with `hasARoot` links) is still expressible in it, but ISO 24613-2 now offers the simpler Stem-typed-as-root.

Adoption: I found no published dataset in the ISO 24613-4 serialisation. Treat that as unverified, not as absence.

### 3.3 Minimal valid skeleton

This is valid against `LMFinTEIspec.rng` (lxml and Jing). Negative checks: `TEI type="lex-0"`, a `teiCorpus` without `@type`, and a `sense` without `xml:id` all fail. The single-lexicon form, with `<TEI type="lexicon">` as the root, is also valid (§5.1).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<teiCorpus xmlns="http://www.tei-c.org/ns/1.0" type="lexicalResource" xml:lang="en">
  <teiHeader><!-- GlobalInformation: the release -->
    <fileDesc>
      <titleStmt>
        <title>Jadhr — lexical resource, dataset 2026.10.0</title>
        <respStmt xml:id="jadhr"><resp>compiled by</resp><name type="org">Jadhr</name></respStmt>
      </titleStmt>
      <editionStmt><edition n="2026.10.0">Dataset release 2026.10.0</edition></editionStmt>
      <publicationStmt>
        <publisher>Jadhr</publisher>
        <date when="2026-10-04"/>
        <idno type="URI">…/api/v1/releases/2026.10.0</idno>
        <availability status="restricted"><p>Each lexicon states its own sources and licences in its own header.</p></availability>
      </publicationStmt>
      <sourceDesc><p>Born digital; sources are listed per lexicon.</p></sourceDesc>
    </fileDesc>
  </teiHeader>
  <TEI type="lexicon" xml:lang="ar">
    <teiHeader><!-- LexiconInformation: this lexicon's sources and licences -->
      <fileDesc>
        <titleStmt><title xml:lang="en">Quranic roots and lemmas (Quranic Arabic Corpus morphology)</title></titleStmt>
        <publicationStmt>
          <publisher>Jadhr</publisher>
          <availability status="restricted">
            <licence target="https://www.gnu.org/licenses/gpl-3.0.html">Derived from the Quranic Arabic Corpus … [copyright block verbatim]</licence>
            <licence target="https://creativecommons.org/licenses/by-sa/4.0/">Patterns (wazn): Jadhr, CC BY-SA 4.0.</licence>
          </availability>
        </publicationStmt>
        <sourceDesc>
          <listBibl>
            <biblStruct xml:id="src.qac">
              <monogr>
                <author>Kais Dukes</author>
                <title>Quranic Arabic Corpus — morphology</title>
                <idno type="URI">https://corpus.quran.com/</idno>
                <edition>0.4</edition>
                <imprint><date when="2011">2011</date></imprint>
              </monogr>
            </biblStruct>
          </listBibl>
        </sourceDesc>
      </fileDesc>
    </teiHeader>
    <text>
      <body>
        <entry xml:id="lemma.rahman" xml:lang="ar" source="#src.qac"><!-- LexicalEntry -->
          <form type="lemma"><orth>رَّحْمَٰن</orth></form><!-- Lemma -->
          <form type="root"><orth>رحم</orth></form><!-- Stem, typed as root (ISO 24613-2 §5.5.3) -->
          <form type="inflected" n="33"><!-- WordForm: an attested form, its features, its count in the Quran -->
            <orth>رَّحْمَٰنِ</orth>
            <gramGrp><gram type="case">genitive</gram><gram type="gender">masculine</gram><gram type="number">singular</gram></gramGrp>
          </form>
          <gramGrp><!-- GrammaticalInformation -->
            <gram type="pos">noun</gram>
            <gram type="pattern" resp="#jadhr">فَعْلَان</gram>
          </gramGrp>
        </entry>
        <entry xml:id="lemma.min" xml:lang="ar" source="#src.qac">
          <form type="lemma"><orth>مِن</orth></form>
          <gramGrp><gram type="pos">preposition</gram></gramGrp>
        </entry>
      </body>
    </text>
  </TEI>
</teiCorpus>
```

### 3.4 Mapping of our fields

| LMF class (ISO 24613-1/-2) | TEI construct (ISO 24613-4) | Our data |
|---|---|---|
| LexicalResource | `teiCorpus[@type="lexicalResource"]` | one per file |
| GlobalInformation | `teiCorpus/teiHeader` | release id and version, publisher, date, address (citation), a pointer to the per-lexicon licences |
| Lexicon | `TEI[@type="lexicon"][@xml:lang="ar"]` | one per licence scope (Quranic lexicon; Lane) |
| LexiconInformation | `TEI/teiHeader` | sources (`biblStruct`), `availability/licence`, notices verbatim |
| LexicalEntry | `entry[@xml:id="lemma.{slug}"]` | one per lemma (4,832), flat |
| Lemma | `form[@type="lemma"]/orth` | `lemmas.ar` |
| Stem (root) | `form[@type="root"]/orth` | `lemmas.root`; absent for the 175 lemmas without a root |
| WordForm | `form[@type="inflected"]/orth` + `gramGrp/gram[@type=case, gender, number, person, aspect, mood, voice…]`, `@n` = occurrences | the stem segment's text and features from `words.jsonl`: 13,517 distinct (form, features) pairs for the 4,832 lemmas of this release (computed) |
| GrammaticalInformation | `entry/gramGrp/gram` | `pos`, `pattern` (`@resp="#jadhr"`), `verbForm`, `derivation` |
| Sense, Definition | `sense[@xml:id]/def` | none in the Quranic lexicon; Lane's articles in the Lane lexicon |
| CrossREF | `xr[@type="related"]/ref[@type="entry"][@target]` | e.g. a Lane entry to our root family |

- **WordForm text needs the hold and the Tanzil notice.** The WordForm text comes from the corpus's copy of the Tanzil text (CC BY-ND 3.0, verbatim copies only). Those forms carry the same hold and the same Tanzil notice as `words.*`; the file's header must reproduce that notice.

## 4. Validation in Python

### 4.1 TEI Lex-0

- **Gate: Jing against the vendored 0.9.5 RNG**, run with `java -jar jing.jar lex-0.rng FILE.xml` from the release command through `subprocess.run(..., check=False)`. The exit code is 0 when valid and 1 when invalid, and each error comes with file:line:col. Measured here (Jing as bundled by `jingtrang`, build of 2009-11-11; the build should pin the upstream release, Jing 20241231):
  - the sample: exit 0;
  - an `entry` without `@type`: exit 1, "element "entry" missing required attribute "type"";
  - `xr type="sameRoot"`: exit 1, "must be equal to "antonymy", "hypernymy", "hyponymy", "meronymy", "related" or "synonymy"";
  - the whole release as TEI Lex-0 (1,642 families, 4,832 lemmas, 1.4 MB): exit 0, in under 1 s.
- **Why not lxml for 0.9.5.**
  - `etree.RelaxNG()` on the 0.9.5 RNG did not return: stopped after more than 9 minutes at 100% CPU (lxml 6.1.3, libxml2 2.14.6).
  - `/usr/bin/xmllint --relaxng` (libxml2 2.9.13) was killed after 240 s, also without finishing.
  - The same 0.9.4 schema rebuilt on the same TEI P5 4.10.2 compiles in 0.01 s, so the cause is a change between 0.9.4 and 0.9.5, not TEI 4.10.2.
  - The published 0.9.5 XSD (with its `xml.xsd`) is rejected by `etree.XMLSchema`: "local complex type: The content model is not determinist", line 9219.
- **In-process test: lxml against the vendored 0.9.4 RNG**, in pytest, with no Java.
  - Code: `rng = etree.RelaxNG(etree.parse(path)); ok = rng.validate(doc); rng.error_log`.
  - Measured: compile 0.01 s; whole release valid in 0.30 s.
  - Negatives that fail as expected: no `TEI/@type`, an `entry` without `xml:lang` or `xml:id`, a closed `xr/@type`, no `profileDesc`, no `availability`, a `sense` without `xml:id`, an `xml:id` with a space, an `xml:id` starting with a digit.
  - Keeping output valid under both versions costs nothing for our structure. The lists that differ are semi-open, `dictScrap` is not used, and every entry is typed anyway.
- **Error messages.** libxml2's messages are often vague ("Element body failed to validate content"). Use Jing's output to diagnose.

### 4.2 LMF (ISO 24613-4)

- **lxml `etree.RelaxNG` against the vendored `LMFinTEIspec.rng`** compiles at once. Measured:
  - the sample: valid;
  - the whole release with word forms (4,832 entries, 13,517 forms, 3.9 MB): valid in 1.49 s;
  - Jing agrees on both;
  - negatives that fail: `TEI type="lex-0"`, a `teiCorpus` without `@type`, a `sense` without `xml:id`.

### 4.3 Schematron

- **TEI Lex-0's rules file is not usable as published.** `TEILex0.sch` (DARIAH, 0.9.4) has three rules: one `text` per `TEI`, one `gramGrp` per parent, and nested entries must be typed. lxml's `isoschematron` rejects it as published, because `title` comes after `ns`, which ISO Schematron does not allow, and because it declares `queryBinding="xslt2"`.
- **It works after two fixes.** With `title` moved first and `queryBinding="xslt"`, it compiles and both tested rules fire. But they are `report` rules, and lxml counts only `assert`s unless it is built with `error_finder=isoschematron.Schematron.ASSERTS_AND_REPORTS`.
- **The Schematron embedded in the RNGs cannot be compiled by lxml.** It uses XPath 2 (`gt`, `>>`): "could not compile test expression 'string-length( normalize-space(.) ) gt 0'".
- **Recommendation: port the three rules to plain Python checks.** 0.9.5 already makes the third rule a schema rule. Whether 0.9.5 ships a separate `.sch` was not checked.

### 4.4 What no schema checks (proven) and our own checks

- **Gaps proven by test.**
  - A `ref/@target`, `@source` or `@ana` pointing at a missing id is accepted.
  - `xml:lang="qqqq"` is accepted (the datatype checks syntax, not the registry).
  - A duplicate `xml:id` is caught, but by the lxml parser, not the schema: "ID lemma.rahman already defined".
- **Checks to add, each failing the build.**
  - every `#id` pointer resolves within the file, and every cross-file pointer resolves in the named file;
  - `xml:lang` is in an allow-list (`ar`, `en`, `ar-Latn`);
  - every `orth` is NFC and equal to its JSONL value after NFC (repo rule);
  - counts match the manifest: entries = lemmas, families = roots, top-level lemma entries = lemmas without a root;
  - no `wordFamily` for a null root;
  - each file has `availability` with at least one `licence`, and the verbatim notice blocks (the corpus copyright block; Perseus's availability statement) byte-equal to the strings in `release.py` and `data/lexica.yaml`;
  - the three Schematron rules.
- **xml:id.** It is an NCName. Arabic letters and harakat are valid (tested), so roots can use `root.{key}`. Lemmas use `lemma.{slug}` from the append-only registry, so ids never change between releases. A prefix is required because slugs and pattern slugs can start with a digit (`2af3ala`), which fails.
- **Namespaces.** TEI is the default namespace, `http://www.tei-c.org/ns/1.0`. `xml:id` and `xml:lang` live in `http://www.w3.org/XML/1998/namespace`; in lxml, write `{http://www.w3.org/XML/1998/namespace}lang`. Build elements with the TEI namespace from the start; a no-namespace element named `entry` fails.
- **Arabic text.** Write UTF-8 with `etree.tostring(tree, xml_declaration=True, encoding="UTF-8")`, never as character references. XML keeps text whitespace, so multi-line notices survive. Bidirectional display is not an XML concern.
- **Size and streaming.** lxml offers no streaming RELAX NG validation; it validates a whole in-memory tree. At our sizes (1.4 MB and 3.9 MB) that is fine: the full scale test peaked at 215 MB RSS, most of it from loading `words.jsonl`.
- **Determinism.** Sort roots by key and lemmas by id. The header carries the release date, not the build time. Then a rebuild is byte-identical and its sha256 in the manifest stays stable.
- **Declare the target version in the file.** Use `<?xml-model href="https://lex-0.org/releases/v0.9.5/schema/lex-0.rng" …?>` so readers know which version it targets. Validators ignore the processing instruction.

## 5. Licences and attribution in the files

- **TEI Lex-0.**
  - The schema requires `publicationStmt/availability`, and the guidelines require the `licence` in it: "a TEI Lex-0 must include explicit information on the conditions under which the given resource can be used".
  - Put one `<licence target="…">` per component licence.
  - `availability/@status` is `restricted` for the Quranic file (verbatim-only terms) and `free` for Lane, matching Perseus's own header.
  - Sources are described in `sourceDesc/listBibl/biblStruct` with an `xml:id`. Entries and senses point at them with `@source`, and what we derived carries `@resp="#jadhr"`. So both each file and each value state where they came from.
- **LMF (ISO 24613-4).**
  - The standard leaves metadata to the TEI header (§4 of the FDIS).
  - GlobalInformation (the `teiCorpus` header) carries the release-level statement.
  - Each Lexicon's own `teiHeader` carries that lexicon's `availability`, `licence` elements and `biblStruct` sources.
  - That is why one lexicon per licence scope is the natural unit.
- **The 2008 DTD, for completeness.** GlobalInformation has only `feat att/val`; there are no standard licence data categories, so any licence would be our own `feat`. **WN-LMF** is the only format with a required `Lexicon/@license`, plus `dc:rights` and `dc:source`; it was not chosen (§3.2).
- **Quranic Arabic Corpus.**
  - Its terms ask that "This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all works derived from or containing substantial portion of this file". The block in `release.py` (`QAC_COPYRIGHT`) goes verbatim into `availability`.
  - A link to `http://corpus.quran.com` goes in the `licence` or the `biblStruct`.
  - The file stays under the publication hold (D19, D2) like the JSONL and CSV.
- **Tanzil.** Where WordForm text comes from the corpus's copy of Tanzil, `TANZIL_CORPUS_TEXT_NOTICE` goes into the same `availability` (CC BY-ND 3.0; verbatim only).
- **Patterns (wazn).** These are our derived layer, under CC BY-SA 4.0 (D14). They get a `licence` element of their own and `@resp="#jadhr"` on each value.
- **Lane.**
  - Perseus's header says: "You credit Perseus, as follows, whenever you use the document: "Text provided by Perseus Digital Library, with funding from The U.S. Department of Education and The Max Planck Society." You leave this availability statement intact. You offer Perseus any modifications you make." (research 02 §5.8).
  - So the Lane file's `availability` reproduces that statement intact. It adds `<licence target="https://creativecommons.org/licenses/by-sa/3.0/us/">` and our modification note (`attribution_en` in `data/lexica.yaml`: markup removed, transliteration converted).
  - "Offer Perseus any modifications" is an obligation of ours outside the file. Record it in DECISIONS when the Lane file ships.
- **Vendored schemas.**
  - Keep each schema next to its licence: BSD-3-Clause (BCDH, © 2025 Boris Lehečka) for 0.9.5; BSD-2-Clause (© 2017 DARIAH-ERIC) for 0.9.4 and the LMF RNG; the TEI Consortium notice (© 2011, BSD-2-Clause or CC BY 3.0) for the TEI material in all three; Jing's BSD-style notice.
  - None of these terms reaches the data files.

### Unverified, named

- What ISO 24613-4's Reference [12] points at. The public sample stops before the bibliography.
- Whether `LMFinTEIspec.rng` (2019) matches every rule of the published ISO 24613-4:2021.
- The publication status of ISO 24613-6 and 24613-7.
- Whether an LBX (ISO 24613-5) XSD is public anywhere.
- The exact licence wording on lex-0.org's pages.
- Whether any dataset is published in the ISO 24613-4 serialisation.
- Whether libxml2 would finish compiling 0.9.5 given more time, or on a newer version.
- Whether 0.9.5 ships a separate Schematron file.
- Whether other Arabic dictionaries are published in TEI Lex-0. Only the guidelines' examples were found.

## 6. Sources

TEI Lex-0:
- https://lex-0.org/ (current guidelines, "Version 0.9.5"; links to `schema/lex-0.rng`, `.rnc`, `.xsd`)
- https://lex-0.org/releases/ and https://lex-0.org/releases/v0.9.5/ ("Current release v0.9.5")
- https://lex-0.org/releases/v0.9.5/schema/lex-0.rng · https://lex-0.org/releases/v0.9.5/schema/lex-0.xsd · https://lex-0.org/releases/v0.9.5/schema/xml.xsd · https://lex-0.org/schema/lex-0.rng · https://lex-0.org/schema/lex-0.rnc
- https://lex-0.org/releases/v0.9.4/schema/lex-0.rng
- https://dev.lex-0.org/schema/lex-0.rng (unreleased build, not to be used)
- https://lex-0.org/releases/v0.9.5/entries.html (root-based dictionaries, Arabic wordFamily example) · https://lex-0.org/releases/v0.9.5/header.html (availability, profileDesc requirements)
- https://github.com/BCDH/tei-lex-0 (README, LICENSE, CITATION.cff; tags v0.9.5 and v0.9.4)
- https://raw.githubusercontent.com/bcdh/tei-lex-0/main/LICENSE · https://raw.githubusercontent.com/bcdh/tei-lex-0/main/CITATION.cff
- https://github.com/DARIAH-ERIC/lexicalresources (LICENSE BSD-2-Clause; commit b038b2b "add redirects to new site")
- https://raw.githubusercontent.com/DARIAH-ERIC/lexicalresources/v0.9.4/Schemas/TEILex0/out/TEILex0.rng
- https://raw.githubusercontent.com/DARIAH-ERIC/lexicalresources/v0.9.4/Schemas/TEILex0/TEILex0.sch
- https://raw.githubusercontent.com/DARIAH-ERIC/lexicalresources/v0.9.4/Schemas/TEILex0/TEILex0.examples/examples.xml (Arabic examples `syj`, `shahama`)
- https://github.com/DARIAH-ERIC/lexicalresources/tree/v0.9.4/Schemas/TEILex0/TEILex0.parts (header, entries, forms, senses, cross-references, etymology chapters)
- https://github.com/DARIAH-ERIC/lexicalresources/issues/12 (entry typology; Arabic word families)
- https://dariah-eric.github.io/lexicalresources/pages/TEILex0/TEILex0.html (now redirects to lex-0.org)
- https://github.com/TEIC/TEI/blob/dev/LICENSE.md (TEI dual licence)

LMF:
- https://arxiv.org/pdf/1906.02136 ("LMF Reloaded": the parts, decoupled serialisations, footnotes to the LMFinTEI specification)
- https://github.com/DARIAH-ERIC/lexicalresources/tree/master/Schemas/LMFinTEI%20Specification (`LMFinTEIspec.xml` ODD, `out/LMFinTEIspec.rng`, `examplesLMFinTEI.xml`)
- https://raw.githubusercontent.com/DARIAH-ERIC/lexicalresources/c321c089d91dde4d814a40a97f4c607270d287f3/Schemas/LMFinTEI%20Specification/out/LMFinTEIspec.rng
- https://cdn.standards.iteh.ai/samples/75411/2a89c6d6ccb64417b5e9d49fca93711f/ISO-FDIS-24613-4.pdf (ISO/FDIS 24613-4 sample, French: §4–§5.5)
- https://cdn.standards.iteh.ai/samples/75407/0cdefa3076e140a1a6659d94fe3973bc/ISO-24613-2-2020.pdf (ISO 24613-2:2020 sample: §5.5 Form subclasses, the foreword)
- https://cdn.standards.iteh.ai/samples/68516/cf0c31f0aa2f44ceb52cd0dd34635842/ISO-24613-1-2019.pdf (ISO 24613-1:2019 sample: the parts)
- https://cdn.standards.iteh.ai/samples/82014/112b5cf20c3742d89991bbf6c082941f/ISO-PRF-24613-1.pdf (ISO 24613-1 second edition proof: "cancels and replaces the first edition (ISO 24613-1:2019)")
- https://www.sis.se/en/produkter/standardization/terminology-/ISO-24613-12024/ (ISO 24613-1:2024, edition 2, 2024-01-15)
- https://www.iso.org/standard/75411.html · https://www.iso.org/standard/72099.html · https://www.iso.org/standard/75407.html · https://www.iso.org/standard/37327.html (ISO catalogue pages; they return 403 to automated fetches, so titles and statuses were taken from search results and the samples above)
- http://web.archive.org/web/20081031021410id_/http://www.tagmatica.fr:80/lmf/iso_tc37_sc4_n453_rev16_FDIS_24613_LMF.pdf (ISO/FDIS 24613:2008 rev 16: Annex B.3.6 Figure B.8 Arabic root; Annex K; Annex R DTD; copyright notice)
- http://web.archive.org/web/20211203093456id_/http://www.tagmatica.fr/lmf/DTD_LMF_REV_16.dtd (the 2008 DTD; the original URL returns 404)
- https://www.clarin.si/repository/xmlui/handle/11356/1039 (Sloleks: a lexicon that ships `DTD_LMF_REV_16.dtd`)
- https://github.com/globalwordnet/schemas · https://globalwordnet.github.io/schemas/ · https://raw.githubusercontent.com/globalwordnet/schemas/master/WN-LMF-1.4.dtd
- https://campus.dariah.eu/resources/hosted/standards-for-representing-lexicographic-data-an-overview (Costa, Roche, Salgado 2022: overview of the LMF parts and TEI Lex-0)

Validation tools:
- https://github.com/relaxng/jing-trang (releases V20241231; `copying.txt`)
- https://repo1.maven.org/maven2/org/relaxng/jing/20220510/jing-20220510.jar (an older Jing on Maven Central)
- https://pypi.org/project/jingtrang/ (bundles a 2009 Jing; used here for the test run only)

Repository inputs: `docs/research/18-data-api-baseline.md`, `docs/research/05-design-inventory.md` (DAT), `docs/research/02-arabic-lexica.md` §5.8 (Lane), `pipeline/src/jadhr_pipeline/release.py`, `data/release/2026.10.0/MANIFEST.json`, `data/lexica.yaml`, `data/registry/lemma-slugs.tsv`, `docs/DECISIONS.md` (Lane is the only redistributable lexicon; D22).
