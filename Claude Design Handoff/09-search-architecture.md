# 9 · Search architecture — OpenSearch with an Arabic analyser

**This was the chosen approach.** It is the right call for this product: three of the four search surfaces (Search, Concordance KWIC, omnibox) need scoring, highlighting, and multi-field matching across Arabic, transliteration, and English simultaneously, and Postgres full-text will not do that well for Arabic. But be clear-eyed: this adds a stateful cluster to operate from day one.

Everything below assumes **OpenSearch 2.x** (or Elasticsearch 8.x — the mappings are compatible). Postgres remains the system of record; the index is derived and fully rebuildable.

---

## 9.1 Division of labour

| Surface | Engine | Why |
|---|---|---|
| Search page, omnibox | **OpenSearch** | Multi-kind, scored, highlighted, fuzzy |
| Concordance KWIC | **OpenSearch** | Needs highlighting + sort on context |
| Concordance distribution | **Postgres** | Pure aggregation over `tokens`, no scoring |
| Word panel, family, patterns | **Postgres** | Known-key lookups; the index adds nothing |
| Root builder (3 letters) | **Postgres** | `roots.letters` array match — exact, no scoring |
| Analyser | **Neither** | Morphological service, §9.5 |
| Classroom heat-map | **Postgres** | Aggregation over `lookup_events` |

**Do not route known-key lookups through OpenSearch.** The word panel is the hottest path in the product and it is a primary-key read.

---

## 9.2 The Arabic analyser chain

This is the part that determines whether search feels right. Four analysers on the same text.

```json
PUT /jadhr_words
{
  "settings": {
    "index": { "number_of_shards": 1, "number_of_replicas": 1 },
    "analysis": {
      "char_filter": {
        "strip_tashkil": {
          "type": "pattern_replace",
          "pattern": "[\\u064B-\\u0652\\u0670\\u0640]",
          "replacement": ""
        },
        "fold_hamza": {
          "type": "mapping",
          "mappings": [ "أ=>ا", "إ=>ا", "آ=>ا", "ٱ=>ا",
                        "ى=>ي", "ئ=>ي", "ؤ=>و", "ة=>ه" ]
        }
      },
      "filter": {
        "ar_stop":  { "type": "stop", "stopwords": "_arabic_" },
        "ar_norm":  { "type": "arabic_normalization" },
        "ar_stem":  { "type": "arabic_stem" },
        "edge_2_20":{ "type": "edge_ngram", "min_gram": 2, "max_gram": 20 },
        "latin_fold": { "type": "asciifolding", "preserve_original": true }
      },
      "analyzer": {
        "ar_exact": {
          "comment": "diacritic-faithful; for phrase match and highlighting",
          "tokenizer": "standard",
          "filter": ["lowercase"]
        },
        "ar_bare": {
          "comment": "PRIMARY. strip tashkil + fold + normalise. no stemming.",
          "char_filter": ["strip_tashkil", "fold_hamza"],
          "tokenizer": "standard",
          "filter": ["lowercase", "ar_norm"]
        },
        "ar_stemmed": {
          "comment": "recall fallback only, low boost — see 9.2 note",
          "char_filter": ["strip_tashkil", "fold_hamza"],
          "tokenizer": "standard",
          "filter": ["lowercase", "ar_norm", "ar_stop", "ar_stem"]
        },
        "ar_prefix": {
          "comment": "type-ahead for the omnibox",
          "char_filter": ["strip_tashkil", "fold_hamza"],
          "tokenizer": "standard",
          "filter": ["lowercase", "ar_norm", "edge_2_20"]
        },
        "translit": {
          "comment": "kataba / kitāb / kitab all match",
          "tokenizer": "standard",
          "filter": ["lowercase", "latin_fold"]
        },
        "translit_prefix": {
          "tokenizer": "standard",
          "filter": ["lowercase", "latin_fold", "edge_2_20"]
        }
      }
    }
  }
}
```

**Important note on `ar_stemmed`.** The built-in `arabic_stem` is a light affix stripper designed for modern news Arabic. It is **not** root extraction and it will mangle classical forms. Include it only as a low-boost recall fallback, never as the primary matching field, and never as the thing that decides what a word's root is. **Root identity comes from the database** (`words.root_id`, hand-verified in the seed data), not from a stemmer. Getting this backwards is the single most likely way to make this product linguistically wrong.

Likewise, `latin_fold` with `preserve_original: true` is what makes transliteration search forgiving: a user typing `kitab` matches `kitāb`, but the exact-diacritic form still scores higher.

---

## 9.3 Mappings

### `jadhr_words`
```json
{ "mappings": { "properties": {
  "slug":        { "type": "keyword" },
  "ar": {
    "type": "text", "analyzer": "ar_bare",
    "fields": {
      "exact":   { "type": "text", "analyzer": "ar_exact" },
      "stemmed": { "type": "text", "analyzer": "ar_stemmed" },
      "prefix":  { "type": "text", "analyzer": "ar_prefix", "search_analyzer": "ar_bare" },
      "kw":      { "type": "keyword" }
    }
  },
  "translit": {
    "type": "text", "analyzer": "translit",
    "fields": { "prefix": { "type": "text", "analyzer": "translit_prefix",
                            "search_analyzer": "translit" } }
  },
  "gloss_en":    { "type": "text", "analyzer": "english" },
  "senses_en":   { "type": "text", "analyzer": "english" },
  "def_ar":      { "type": "text", "analyzer": "ar_bare" },
  "root_key":    { "type": "keyword" },
  "root_ar":     { "type": "keyword" },
  "root_letters":{ "type": "keyword" },
  "pattern_key": { "type": "keyword" },
  "pattern_ar":  { "type": "keyword" },
  "pos":         { "type": "keyword" },
  "corpus_freq": { "type": "integer" }
} } }
```

### `jadhr_passages`
One document **per token occurrence**, not per passage. This is what makes KWIC and the concordance work — you need to sort and highlight around a specific occurrence, and a passage-level document cannot express "the third word in this verse".

```json
{ "mappings": { "properties": {
  "token_id":     { "type": "keyword" },
  "passage_id":   { "type": "keyword" },
  "text_slug":    { "type": "keyword" },
  "text_kind":    { "type": "keyword" },
  "chapter_ord":  { "type": "short" },
  "passage_ord":  { "type": "short" },
  "ref":          { "type": "keyword" },
  "token_ordinal":{ "type": "short" },
  "surface":      { "type": "text", "analyzer": "ar_bare",
                    "fields": { "exact": { "type": "text", "analyzer": "ar_exact" },
                                "kw": { "type": "keyword" } } },
  "word_slug":    { "type": "keyword" },
  "root_key":     { "type": "keyword" },
  "pattern_key":  { "type": "keyword" },
  "gram":         { "type": "keyword" },
  "passage_ar":   { "type": "text", "analyzer": "ar_bare",
                    "fields": { "exact": { "type": "text", "analyzer": "ar_exact" } } },
  "passage_en":   { "type": "text", "analyzer": "english" },
  "left_sort":    { "type": "keyword", "doc_values": true },
  "right_sort":   { "type": "keyword", "doc_values": true },
  "era_year":     { "type": "integer" }
} } }
```

`left_sort` and `right_sort` are **precomputed at index time**: the normalised context to the left and right of this token, reversed for `left_sort`, so the concordance's left/right sorting is a plain `sort` on a `keyword` field instead of a script. This is the standard concordance trick and it keeps KWIC fast.

### `jadhr_dict_articles`
```json
{ "mappings": { "properties": {
  "article_id":  { "type": "keyword" },
  "dict_key":    { "type": "keyword" },
  "dict_kind":   { "type": "keyword" },
  "word_slug":   { "type": "keyword" },
  "root_key":    { "type": "keyword" },
  "body":        { "type": "text", "analyzer": "ar_bare",
                   "fields": { "exact": { "type": "text", "analyzer": "ar_exact" } } },
  "body_lang":   { "type": "keyword" },
  "death_year":  { "type": "integer" }
} } }
```

Also index `jadhr_roots` and `jadhr_patterns` — both are small (single-digit thousands at most) but they are separate result kinds in the Search UI and deserve their own scoring.

---

## 9.4 Query recipes

### Search page / omnibox
One `msearch` across the four indices so the four result kinds come back in one round trip. Per-kind query:

```json
{ "query": { "bool": { "should": [
  { "match_phrase": { "ar.exact":   { "query": "<q>", "boost": 10 } } },
  { "match":        { "ar":         { "query": "<q>", "boost": 6 } } },
  { "match":        { "ar.prefix":  { "query": "<q>", "boost": 3 } } },
  { "match":        { "translit":   { "query": "<q>", "boost": 5, "fuzziness": "AUTO" } } },
  { "match":        { "translit.prefix": { "query": "<q>", "boost": 2 } } },
  { "match":        { "gloss_en":   { "query": "<q>", "boost": 4 } } },
  { "match":        { "senses_en":  { "query": "<q>", "boost": 2 } } },
  { "match":        { "ar.stemmed": { "query": "<q>", "boost": 1 } } }
  ], "minimum_should_match": 1 } },
  "indices_boost": [ { "jadhr_words": 1.4 }, { "jadhr_roots": 1.2 } ]
}
```

Blend a mild `corpus_freq` signal via `function_score` with `field_value_factor` (`modifier: log1p`, `factor: 0.3`) so common words surface first — but keep it mild; rare words are often exactly what a scholar is searching for.

**Query-type detection** (the `detected` field in the API response) is a cheap pre-classifier on the raw string, not an OpenSearch concern:
- Contains Arabic script → Arabic (with tashkīl → `ar_exact` boost; without → `ar_bare`)
- 3 letters separated by spaces/hyphens → root
- Latin with `ʿ ʾ ā ī ū ḥ ṣ ṭ` → transliteration
- Matches a known pattern shape → pattern
- Otherwise Latin → English gloss

### Concordance KWIC
```json
{ "query": { "term": { "root_key": "ilm" } },
  "sort": [ { "right_sort": "asc" } ],
  "size": 50,
  "_source": ["passage_id","ref","text_slug","token_ordinal","word_slug","gram","surface"] }
```
Swap `right_sort` for `left_sort` per the UI's sort control; add `{ "term": { "pattern_key": … } }` for the pattern filter. **Split the KWIC context server-side from the token store** rather than relying on highlighter fragments — you need exact control of where the keyword column starts and ends, and the columns must hug the keyword.

### Diacritic-insensitive equality
Search the `ar` field (`ar_bare` analyser). Both `كِتَابَة` and `كتابة` reduce to the same terms. Display always uses the stored `full` form. This is the behaviour the whole product assumes.

---

## 9.5 Morphological analysis — separate from search

The Analyser screen is **not** a search problem and must not be built on the stemmer.

`analyse()` in `prototypes/lexicon-data.js` is a heuristic: strip a known prefix, strip a known suffix, match the remaining skeleton against known roots, score candidates. It is honest about being a guess — it returns ranked candidates with confidence. **Keep that contract** (`08-api-contract.md` §8.3) and replace the implementation with a real analyser.

Three viable routes, in order of recommendation:

1. **A dedicated morphology service** (CAMeL Tools, Farasa, or an equivalent) behind an internal HTTP endpoint, with results cached in Postgres keyed by surface form. Best quality; adds a Python service to the deployment.
2. **A lexicon-driven analyser** — for every word in the database, precompute all inflected surface forms from its pattern, index them, and analyse by lookup. Excellent for in-corpus text, silent on out-of-corpus text. Cheap, fully deterministic, and a good Phase-1 answer.
3. **The prototype heuristic, promoted** — expand the affix tables, keep the confidence scoring. Acceptable only as a stopgap, and only because the UI already admits uncertainty.

Route 2 then 1 is the pragmatic path: ship the lexicon-driven analyser, add the service when out-of-corpus text (pasted text, PDFs, URLs) becomes a real use case — which it does the moment the Library's ingest works.

**Cache analysis results.** Surface → analysis is a pure function of the surface form and the dataset version. The same tokens recur constantly.

---

## 9.6 Operations

- **Postgres is the source of truth. The index is disposable.** Ship a `reindex` command that rebuilds every index from scratch and run it in CI. You will change the analyser chain more than once.
- **Index via the outbox pattern**: content mutations write an outbox row in the same transaction; a worker drains it into OpenSearch. Never index inline in a request.
- **Alias-based reindexing**: `jadhr_words` is an alias onto `jadhr_words_v<n>`. Build the new version, verify, flip the alias. Zero-downtime analyser changes.
- **Sizing:** the corpus is small (tens of thousands of tokens at seed, plausibly low millions at scale). One shard per index, one replica. This does not need a big cluster — resist over-provisioning.
- **Test with real Arabic.** The test suite must assert: `كِتَابَة` finds `كتابة`; `kitab` finds `kitāb`; `أمر` finds `امر`; a tashkīl-marked query still ranks the exact form first; and a root query returns the whole family. These are the five assertions that catch nearly every analyser regression.
