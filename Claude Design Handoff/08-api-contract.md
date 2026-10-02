# 8 · API contract

Derived from what each screen actually needs. REST with JSON; adapt to GraphQL or tRPC if the chosen stack prefers it — the resource boundaries below are the part worth keeping.

All responses `application/json; charset=utf-8`. All Arabic in **NFC UTF-8**. All timestamps ISO 8601 UTC.

---

## 8.1 Conventions

**Base:** `/api/v1`

**Arabic string envelope** — every Arabic field the client displays comes as:
```json
{ "full": "مَكْتَبَة", "bare": "مكتبة", "translit": "maktaba" }
```
The client chooses `full` or `bare` from the tashkīl preference. **Never send a single pre-decided string** — the toggle is a client-side preference and a round trip to change it would be unacceptable.

**Pagination:** cursor-based. `?limit=` (default 25, max 200) and `?cursor=`; responses carry `{ "data": [...], "next_cursor": "..." }`.

**Error envelope:**
```json
{ "error": { "code": "not_found", "message": "No word with that slug.", "field": null } }
```
Codes: `bad_request` · `unauthorized` · `forbidden` · `not_found` · `conflict` · `rate_limited` · `unprocessable` · `server_error`.

**Auth:** `Authorization: Bearer <token>`. **Most read endpoints are public and unauthenticated** — the product is usable, linkable, and crawlable without an account. Only user data and mutations require auth. Anonymous clients send `X-Jadhr-Anon: <client-uuid>` so their local state can be migrated later.

**Rate limits:** public reads 120/min per IP; authenticated 600/min per user; the public data API 60/min per key with a documented burst. Return `429` with `Retry-After`.

**Caching:** content endpoints (`/words`, `/roots`, `/patterns`, `/texts`, `/dictionaries`) are immutable between dataset releases — serve with `ETag` and a long `max-age`. User endpoints are `no-store`.

---

## 8.2 Content

### `GET /words/:slug`
The Reader panel's primary call. Returns everything the six sections need in **one** request — the panel must not make six.

```json
{
  "slug": "maktaba",
  "ar": { "full": "مَكْتَبَة", "bare": "مكتبة", "translit": "maktaba" },
  "gloss_en": "library, bookshop",
  "pos": "noun",
  "corpus_freq": 7,
  "audio_url": null,
  "root": { "key": "ktb", "ar_spaced": "ك ت ب", "translit": "k-t-b",
            "gloss_en": "writing, inscribing, setting down",
            "gist_ar": "الخطِّ والرسمِ…", "corpus_freq": 319 },
  "pattern": { "key": "maf3ala", "ar": {…}, "function_en": "noun of place (fem.)",
               "plain_en": "…", "form_number": null },
  "senses": [
    { "id": "…", "ordinal": 1, "text_en": "a collection of books; a library",
      "credited_to": null },
    { "id": "…", "ordinal": 2, "text_en": "a shop where books are sold",
      "credited_to": { "handle": "nsaleh", "display_name": "N. Saleh" } }
  ],
  "family": [ { "slug": "kitab", "ar": {…}, "gloss_en": "book; writing",
                "pattern": { "key": "fi3al", "ar": {…}, "function_en": "verbal noun" } } ],
  "attestations": [
    { "passage_id": "…", "text": { "slug": "quran", "title_en": "The Qurʾān", "kind": "Qurʾān" },
      "ref": "2:31", "ar_full": "…", "trans_en": "…", "gram": "noun · accusative, indefinite",
      "surface": "مَكْتَبَةً" } ],
  "dict_articles": [
    { "dictionary": { "key": "lisan", "name_ar": "لسان العرب", "name_en": "Lisan al-Arab",
                      "author": "Ibn Manzur", "death_year": 1311, "kind": "general",
                      "license": "public-domain" },
      "body": "…", "body_lang": "ar", "page_ref": "…" } ],
  "timeline": { "min": 550, "max": 1920,
                "dictionaries": [ { "key": "lisan", "year": 1311, "attests": true } ],
                "corpora": [ { "id": "quran", "label": "Qurʾān", "year": 632, "attests": true } ] },
  "next_steps": [
    { "kind": "cousin",  "slug": "kitab",  "why": "same root, different shape" },
    { "kind": "passage", "passage_id": "…", "why": "where it appears" },
    { "kind": "pattern", "key": "maf3ala", "why": "the shape it is poured into" } ]
}
```
`next_steps` is computed **server-side and deterministically** — the same word yields the same three doors for everyone, which makes trails shareable and the result cacheable.

`?in_text=<textSlug>` scopes the `attestations` array to that text for the panel's "In this text" section, with siblings from other texts as a fallback when there are none.

### `GET /roots/:key`
Root record plus its full family grouped by pattern, plus corpus distribution. Powers the Concordance's distribution view and the panel's family section.

### `GET /patterns/:key`
Pattern, its function, plain-language explanation, and every word using it.

### `GET /dictionaries`
The nine lexica with names, authors, death years, kinds, licenses. Cacheable indefinitely.

### `GET /texts` · `GET /texts/:slug`
Library shelf; then the text with chapters, passage counts, and per-passage difficulty. `?include=passages` for the full body.

### `GET /passages/:id`
One passage with its tokens fully resolved:
```json
{ "id": "…", "ref": "2:31", "ar_full": "…", "translit": "…", "trans_en": "…",
  "difficulty": 2,
  "tokens": [ { "ordinal": 0, "surface": "وَعَلَّمَ", "word_slug": "allama",
                "root_key": "ilm", "pattern_key": "fa33ala",
                "gram": "verb · Form II perfect", "confidence": 1.0 } ] }
```

### `GET /glossary`
The ~30 plain-language terms. Cacheable indefinitely; the client needs all of them to render dotted terms inline.

### `GET /word-of-the-day?date=YYYY-MM-DD`
Deterministic by date. Same answer for everyone, cacheable until midnight UTC.

### `GET /collections` · `GET /collections/:id`
The four curated sets with their items.

---

## 8.3 Search

### `GET /search`
`?q=` · `?kinds=words,roots,patterns,passages` · `?limit=` · `?cursor=`

```json
{ "query": "kitab",
  "detected": { "kind": "translit", "label": "transliteration" },
  "results": {
    "words":    [ { "slug": "kitab", "ar": {…}, "gloss_en": "book; writing",
                    "root": { "key":"ktb", "ar_spaced":"ك ت ب" }, "score": 8.4 } ],
    "roots":    [ … ], "patterns": [ … ],
    "passages": [ { "passage_id":"…", "ref":"2:31", "snippet_ar":"…",
                    "highlight": [[12,19]], "text": {…} } ] } }
```
`detected` drives the Search page's honest "here's what I think you typed" label. Must classify: Arabic word · transliteration · English gloss · root · pattern · empty.

### `GET /search/by-root-letters?l1=ك&l2=ت&l3=ب`
Backs the three-box root builder. Partial input allowed — omitted letters are wildcards.

### `GET /concordance`
`?root=<key>` (or `?word=<slug>`) · `?view=kwic|dist` · `?sort=left|right` · `?pattern=<key>`

KWIC rows come **pre-split by the server**, because splitting Arabic context around a keyword correctly is not something to do twice:
```json
{ "root": { "key": "ilm", … },
  "total": 854,
  "rows": [ { "passage_id": "…", "ref": "2:32",
              "left": "قَالُوا سُبْحَانَكَ لَا",
              "keyword": "عِلْمَ",
              "right": "لَنَا إِلَّا مَا عَلَّمْتَنَا",
              "word_slug": "ilm", "gram": "noun · accusative, indefinite" } ] }
```
`view=dist` instead returns counts per text, per chapter, and per corpus era.

### `POST /analyse`
```json
// request
{ "text": "وَالمَكْتَبَةِ كِتَابٌ" }
// response
{ "tokens": [
  { "surface": "وَالمَكْتَبَةِ",
    "segments": [ { "text": "وَ", "gram": "conj.",  "kind": "prefix" },
                  { "text": "المَكْتَبَة", "gram": "stem", "kind": "stem" },
                  { "text": "ِ", "gram": "gen.", "kind": "suffix" } ],
    "candidates": [ { "root_key": "ktb", "word_slug": "maktaba", "confidence": 0.99 },
                    { "root_key": "ktb", "word_slug": null, "confidence": 0.7 } ],
    "pattern_key": "maf3ala",
    "gram": "conj. · gen.",
    "confidence": 0.99 } ] }
```
Rules the UI depends on: candidates **ranked, deduped by root, max 3**; harakat-only segments **omitted**; particles return `candidates: []` and `pattern_key: null` so the table can print `—`; `confidence` **always present**.

---

## 8.4 User data

All require auth (or a valid `X-Jadhr-Anon` for local-only clients that have not signed in).

| Method | Path | Notes |
|---|---|---|
| `GET` | `/me` | Profile, role, counts per Profile tab |
| `GET`/`PATCH` | `/me/preferences` | Transliteration, tashkīl, tint, panel mode, explain-terms, text size, dictionaries shown, theme |
| `GET` | `/me/word-states` | `{ [wordSlug]: 'learning'\|'known'\|'starred' }` |
| `PUT` | `/me/word-states/:wordSlug` | `{ "state": "starred" }`; `DELETE` clears |
| `GET`/`PUT` | `/me/progress/:textSlug` | `{ chapter_ord, passage_ord }` |
| `GET`/`POST` | `/me/notes` | List / create; `PATCH`/`DELETE` on `/me/notes/:id` |
| `GET` | `/me/journal` | Sessions grouped by day, for Notebook's journal tab |
| `POST` | `/me/events` | Batched lookup events: `{ events: [{ kind, word_slug, passage_id, at }] }`. **Batch and debounce** — every word click is an event |
| `GET` | `/me/export` | Whole-account JSON. Profile's "Export everything" |
| `DELETE` | `/me/data` | Destructive. Requires a confirmation token |
| `POST` | `/me/migrate-anon` | `{ "anon_id": "…" }` — merges anonymous local state into the account on sign-in |

### Review (study)
| Method | Path | Notes |
|---|---|---|
| `GET` | `/me/review/due?limit=20&mode=root\|context` | Due **root** cards. `mode=context` also returns a passage per card with the family members' token positions to blank |
| `POST` | `/me/review/grade` | `{ card_id, grade: 1-4, mode, passage_id? }` → returns the next due time |
| `GET` | `/me/review/counts` | The header badge |

---

## 8.5 Proposals

| Method | Path | Notes |
|---|---|---|
| `GET` | `/proposals?status=open\|approved\|merged\|declined` | Queue list |
| `GET` | `/proposals/:id` | Detail with decisions so far |
| `POST` | `/proposals` | `{ word_slug, sense_id, proposed_text, rationale, sources }` |
| `POST` | `/proposals/:id/decisions` | `{ decision: 'approve'\|'decline', note }` |

Server-enforced, not UI-enforced: **no self-approve** (`403 forbidden`), **no double-approve** (`409 conflict`), **two distinct approvals merge**. On merge, in one transaction: rewrite the sense, set `credited_to`/`credited_at`, set the proposal `merged`, and append to the pending dataset changelog.

### `GET /changelog?since=`
Merged proposals with word, sense, before, after, contributor, timestamp. Powers Data & API's changelog.

---

## 8.6 Graphs

| Method | Path | Notes |
|---|---|---|
| `GET` | `/graphs` | The user's graphs |
| `POST` | `/graphs` | `{ title, doc }` |
| `GET` | `/graphs/:id` | Full document |
| `PUT` | `/graphs/:id` | `{ title?, doc? }`. Autosave target — **debounce ~800ms and send the whole document**; the editor's undo stack is client-side and the server stores states, not operations. If real-time collaboration lands, this endpoint is replaced, not extended (see `10-open-questions.md` §5) |
| `DELETE` | `/graphs/:id` | |
| `POST` | `/graphs/:id/publish` | `{ slug?, description? }` → `{ slug }`. Snapshots `doc` immutably |
| `GET` | `/published` | List, for the Published Graph sidebar |
| `GET` | `/published/:slug` | `{ title, description, owner, doc, doc_version, counts, fork_count, cited_count, published_at }` — **public, no auth** |
| `POST` | `/published/:slug/fork` | Creates an editable copy, increments `fork_count` → `{ graph_id }` |
| `POST` | `/published/:slug/cite` | Increments `cited_count`, returns BibTeX/RIS/plain |
| `GET`/`POST` | `/graphs/:id/comments` | `PATCH /comments/:id` to resolve |

**`doc_version` must be honoured.** Published graphs are citable artefacts; a reader opening a three-year-old published graph must see it render. Keep the legacy fallback path the prototype has.

---

## 8.7 Classroom

| Method | Path | Notes |
|---|---|---|
| `GET` | `/cohorts` · `/cohorts/:id` | Membership-scoped |
| `POST` | `/cohorts/:id/lessons` | `{ title, passage_ids, root_ids, due_at }` |
| `GET` | `/cohorts/:id/heatmap?lesson=&layer=lookups\|confirmed\|struggling` | `{ learners: [...], roots: [...], cells: [{ user_id, root_id, value }] }` |
| `GET` | `/cohorts/:id/activity?cursor=` | The feed. Entries carry `{ who, kind, subject_ar, subject_translit, detail, at }` so the client can render the product's own vocabulary rather than generic strings |
| `POST` | `/cohorts/:id/confirm` | `{ node_id }` — instructor confirms a learner's card |

---

## 8.8 Public data API

The scholarly-credibility surface. Separately rate-limited, key-authenticated, versioned, and **documented publicly**.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/public/lookup?q=` | The playground's default endpoint. Diacritic-insensitive; accepts Arabic, transliteration, or English |
| `GET` | `/public/roots/:key` | Root + family |
| `GET` | `/public/concordance?root=` | Paginated |
| `GET` | `/public/releases` | Dataset releases with DOIs |
| `GET` | `/public/releases/:version/:format` | `json` · `tei` · `lmf` · `csv`. **Pre-generated artefacts from object storage, not built per request** |

Every public response carries the dataset version and license in its body, so downstream users cannot lose provenance:
```json
{ "meta": { "dataset_version": "v2026.09", "license": "CC-BY-SA-4.0",
            "doi": "10.5281/zenodo.…", "generated_at": "…" }, "data": {…} }
```
