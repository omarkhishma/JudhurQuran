# 25 · Semantic search — which model (P17.1, D34)

Measured 2026-10-10: eight open models, six multilingual and two trained for Arabic. The question: which open embedding model finds the Quran's verses best for a reader's words, in Arabic and in English, within what our server can carry (2 vCPU / 6 GB, `docs/DEPLOY.md`), and does it add to the meaning search we already have (B12, the sources' own words in OpenSearch)?

## Method

**Queries with known answers, used only to measure.** 300 Arabic queries: Quranpedia's topic names, each with the verses it gathers under it. 211 English queries: QSAC's English tags, each with the verses tagged. Neither is shown to a reader or used to rank anything; they are a yardstick. Their answer lists are incomplete (a topic lists the verses its editors chose, not every verse on the theme), so a verse the model finds and the list lacks counts as a miss: the absolute numbers are low for every engine alike, and only the comparison between engines means anything.

**Documents.** Each of the 6,236 verses twice: in Arabic, its plain text with al-Muyassar's explanation of it; in English, Saheeh International's translation. Arabic queries search the Arabic documents, English queries the English ones; "en→ar" asks English queries of the Arabic documents (a reader writing English about an Arabic verse).

**Scores.** recall@20 (the share of a query's verses in the first 20, capped at 20), nDCG@10 and MRR, averaged over the queries. Time: one query at a time on the CPU, two threads, as the service runs. Scripts and runs: the session's scratchpad (`embed-eval/evaluate.py` for the models under PyTorch, `evaluate_onnx.py` for the production path, `lexical.py` for the baseline).

## Results

recall@20 / nDCG@10 / MRR. PyTorch, full precision, sequences cut at 256 tokens:

| Model (licence) | ar→ar | en→en | en→ar | ms/query | parameters |
|---|---|---|---|---|---|
| multilingual-e5-small (MIT) | 0.193 / 0.154 / 0.291 | 0.162 / 0.196 / 0.400 | 0.082 / 0.087 / 0.198 | 6.7 | 118 M |
| multilingual-e5-base (MIT) | 0.191 / 0.152 / 0.285 | 0.203 / 0.226 / 0.435 | 0.118 / 0.127 / 0.285 | 18.5 | 278 M |
| **multilingual-e5-large (MIT)** | **0.239** / 0.176 / 0.309 | 0.194 / 0.229 / 0.467 | 0.193 / 0.206 / 0.379 | 60.8 | 560 M |
| BGE-M3 (MIT) | 0.208 / 0.172 / 0.324 | 0.176 / 0.195 / 0.367 | 0.167 / 0.183 / 0.352 | 55.2 | 568 M |
| gte-multilingual-base (Apache-2.0) | 0.152 / 0.119 / 0.237 | 0.251 / 0.279 / 0.492 | 0.142 / 0.158 / 0.317 | 22.2 | 305 M |
| Qwen3-Embedding-0.6B (Apache-2.0) | 0.183 / 0.145 / 0.280 | **0.305** / 0.333 / 0.534 | **0.198** / 0.220 / 0.408 | 76.9 | 596 M |
| GATE-AraBert-v1 (Apache-2.0; Arabic only) | 0.146 / 0.114 / 0.222 | 0.051 / 0.056 / 0.141 | 0.017 / 0.015 / 0.035 | 18.2 | 135 M |
| SILMA embedding v0.1 (Apache-2.0; Arabic and English) | 0.110 / 0.085 / 0.171 | 0.020 / 0.023 / 0.059 | 0.013 / 0.008 / 0.032 | 18.1 | 135 M |

The baseline, our lexical search through OpenSearch:

| Engine | ar | en |
|---|---|---|
| The sources' words (B12: tafsirs, translations, gharīb) | 0.175 / 0.142 / 0.252 | 0.143 / 0.186 / 0.336 |
| The verses' own words | 0.058 / 0.065 / 0.109 | 0.107 / 0.137 / 0.238 |

The production path — the authors' ONNX graphs quantised to 8-bit integers, through `jadhr_embed`'s encoder (onnxruntime, CPU, 512 tokens) — and each fused with the sources' words by reciprocal rank (k = 60). The first two rows read the documents sixteen at a time; the last reads each alone, as production does (see Limits):

| Model | ar→ar | en→en | en→ar | ar fused | en fused | ms/query | file |
|---|---|---|---|---|---|---|---|
| e5-base, 8-bit | 0.184 / 0.142 / 0.260 | 0.168 / 0.187 / 0.375 | 0.097 / 0.116 / 0.270 | 0.259 / 0.203 / 0.347 | 0.236 / 0.265 / 0.458 | 5.1 | 279 MB |
| e5-large, 8-bit | 0.236 / 0.177 / 0.310 | 0.194 / 0.227 / 0.457 | 0.197 / 0.205 / 0.392 | 0.298 / 0.233 / 0.381 | 0.254 / 0.297 / 0.527 | 16.8 | 562 MB |
| **e5-large, 8-bit, one text at a time (production)** | **0.229** / 0.182 / 0.332 | 0.195 / 0.237 / 0.490 | 0.196 / 0.206 / 0.385 | **0.289** / 0.230 / 0.382 | **0.259** / 0.301 / 0.531 | 16.1 | 562 MB |

## Reading

- **The model adds, and the fusion adds most.** In Arabic the model alone finds 30% more than the sources' words (0.229 against 0.175), and the two fused 65% more (0.289); in English 0.259 against 0.143. Each finds verses the other misses: the words find a verse whose explanation names the theme, the model one that speaks of it in other words.
- **Arabic decides.** The site is Arabic first. e5-large leads in Arabic among all eight; the two models trained for Arabic (both on AraBERT, the plan's "an Arabic model") are the weakest here — they were tuned on modern sentence pairs, and a verse read with its classical explanation is far from those; Qwen3 is far ahead in English (0.305) but behind in Arabic (0.183); gte is the reverse of what we need.
- **8-bit costs e5-large little** (0.229–0.236 against 0.239; English equal) and makes it fit: 562 MB on disk, about 0.7 GB in memory, where full precision would take 2.2 GB of a 6 GB server already holding Postgres, OpenSearch's 1 GB heap, the API and the web. e5-base at 8 bits loses more (English 0.203 → 0.168).
- **Time.** 17 ms a query on two threads here; a 2-vCPU server is slower, still well inside the search's budget (P17 tests: under 250 ms for the semantic part).

## Choice

**multilingual-e5-large, the authors' 8-bit ONNX graph (`e5-large-q8`), revision `3d7cfbda…`, MIT**, pinned by sha256 in `services/embed/src/jadhr_embed/models.py`, run by onnxruntime on the CPU in the embedding service; its search fused with the sources' words by reciprocal rank. The same graph builds the verses' vectors and embeds the readers' queries, so the two meet in one space; a vector carries its model's tag and is never compared with another's.

**Not chosen, and why:** GATE-AraBert and SILMA trail every multilingual model in Arabic here (0.146 and 0.110). Qwen3-Embedding-0.6B for its English — no ONNX graph from its authors (ours would have to be exported and checked), and a second model would double the service's memory; it is proposal B66 in PLAN.md for the owner. BGE-M3 is behind e5-large everywhere here at the same size. gte publishes no ONNX graph and is weakest in Arabic.

## When to show nothing

The model always has a nearest verse, even for words the Quran never speaks of. Calibrated on 25 real and 15 unrelated queries in each language (themes such as «اليتيم», "repentance"; "pizza", «هاتف ذكي», "zzqqxx"), with two signals: how far the best verse's cosine stands above the median verse's (the gap), and how many verses the sources' words found.

| Queries | gap, lowest–highest | verses found by the words |
|---|---|---|
| real, Arabic | 0.058–0.094 | 55–100, every one |
| unrelated, Arabic | 0.036–0.057 | 0, or 3 for two |
| real, English | 0.063–0.122 | 0 for two, 5–100 for the rest |
| unrelated, English | 0.048–0.074 | 0, every one |

The rule: **the group is shown when the words found at least 5 verses or the gap is at least 0.075.** Every real Arabic query passes and every unrelated one fails in both languages; one real English query (no hits in the words, gap 0.067) loses its group. The answer carries the gap and says `weak` when it shows nothing (`semantic.MIN_GAP`, `MIN_WORDS`; `test_semantic_api.py` holds both sides).

## Limits

- The yardsticks are two sources' editorial choices; the numbers rank engines against each other, not against a reader's judgement. A reader's own relevance judgements (the board's, D15) would be the next measure.
- A query is a topic name or a tag, short and nominal; a reader's full question is longer. P18 (questions) measures that separately with its own bank.
- The 8-bit graph takes its activations' scale from its whole input, padding included, so a text read in a batch came out at cosine 0.996 to itself read alone. Production reads every text alone (`Encoder.encode`, `test_embed.py` holds it): a vector depends on its text only. Against reading in batches, recall@20 moved by −0.007 in Arabic and +0.001 in English while nDCG and MRR rose — differences of the order of the yardsticks' noise.
