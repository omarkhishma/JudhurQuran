# PLAN — جُذور (working title) · Quran roots platform

> Source of truth for what is done, what is next, and how each phase is verified. Decisions and lessons live in `docs/DECISIONS.md`. Updated as work proceeds — never silently deviated from.

## 0 · The goal in one paragraph

An Arabic-first, bilingual (ar default / en) website where the Quran is rendered as real, selectable Unicode text in the authentic Madinah-mushaf script, and **every word is a door**: tap it to see its meaning, its root, its lemma and pattern, how many times the root occurs, every derived form, and every verse that shares the root — then step into a node-graph canvas of the whole root family, or build your own topic / meaning graphs. Tap a verse to read multiple tafsirs. Everything is backed by **our own database and versioned public API**, built from openly licensed, cited sources, cross-validated against independent sources, with provenance visible on every claim. Later the same graph grows into an Arabic dictionary, a hadith encyclopedia and a book reader — one ecosystem.

## 1 · Non-negotiable principles (product laws)

1. **Mushaf integrity.** The Quranic text is imported verbatim from a verified source, checksummed, and never modified. Search uses derived shadow columns only. A CI gate fails on any byte change.
2. **No generated religious content.** Meanings, tafsir and glosses come only from cited human sources. No LLM writes or paraphrases meaning. Our own copy is limited to UI and linguistic explanations (grammar terms), flagged for expert review.
3. **Uncertainty is visible.** Every root, lemma and morphology claim names its source; disagreements between sources render as attributed variants; particles show "no root" rather than a pseudo-root.
4. **Descriptive statistics only.** Counts and distributions — never numerical-miracle claims.
5. **Respect and focus.** No ads, no tracking, no streaks or loss-aversion, no autoplay. Quranic text is visually distinct from human commentary; translations are labelled "translation of meanings".
6. **Local-first and private.** Everything works without an account; personal data stays on the device until the owner decides on accounts.
7. **Accessible and fast.** WCAG AA contrast, keyboard and screen-reader support, 44px touch targets on phones, dark-theme parity, phone-first reading.

## 2 · Architecture (summary — details in DECISIONS)

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind 4 over the handoff tokens, next-intl (ar default at `/`, en at `/en`), logical CSS only |
| Graph canvas | @xyflow/react 12 + elkjs auto-layout, bounded expansion |
| API | FastAPI (Python 3.13) — `/api/v1`, OpenAPI docs, public read endpoints, ETag + long cache on content |
| Database | PostgreSQL 17 — content (immutable per dataset release) + later user data |
| Search | Postgres: normalised shadow columns + pg_trgm + FTS, behind a search module (OpenSearch only when measured need) |
| Pipeline | Python package `pipeline/`: pinned sources (URL + sha256 + license), parse → validate → cross-check → load → release artefacts |
| Local dev | `docker compose` (Postgres 17) · `pnpm` workspaces · `uv` for Python |

## 3 · Phases

Status legend: ✅ done (verified) · 🔄 in progress · ⏳ next · ⛔ blocked (owner) · ⬜ not started

### Phase 0 — Orientation, research, decisions ✅
- ✅ Idea + full design handoff read; prototypes captured at desktop and phone width
- ✅ Research reports in `docs/research/`: 01 text+morphology · 02 Arabic lexica · 03 tafsir/translation/audio/hadith · 04 competitive analysis
- ✅ Sibling project `../Judhur` found and used as research input (license register, lessons, pinned artefacts)
- ✅ Source registry `data/sources.yaml` + works registry `data/works.yaml`
- ✅ DECISIONS seeded and maintained; ⬜ project CLAUDE.md
**Exit:** every launch data source has a recorded license and a recommendation; stack decided.

### Phase 1 — Canonical dataset (pipeline) ✅
Done: official KFGQPC text (byte-identical, hash-checked) · Tanzil verification + juz · QAC v0.4 parse (multi-stem words) · token↔word alignment (7 known fusions/splits exposed) · imlāʾī search shadow · roots/lemmas/counts · root variants from QAC v2 + fork · 7 tafsirs + 2 English translations · lexica (Mufradat, Maqayis, Lisan, Sihah, Lane, Ibn Qutaybah) · recitations (12 reciters, word timings) · wazn for every lemma where certain · every build verifies all source pins · DATA-VALIDATION.md generated from computed numbers · English lemma glosses (QAC v2) · English word glosses + transliteration for every word (corpus Word by Word, verbatim) · release artefacts (redistributable JSONL + CSV with manifest, hashes and exclusion reasons).
- Pin + fetch sources with sha256 verification (fail on drift)
- Parse Tanzil Uthmani + metadata (114 surahs, 6,236 verses, juz/hizb/page/sajdah) and the QPC Hafs text; letter-stream cross-verification
- Parse QAC morphology (segments → words), align to Tanzil tokens (basmala convention, 4 known merges)
- Build roots, lemmas, word forms, POS/features (Arabic + English labels), verb forms, derived-noun types; compute counts (root occurrences, lemma occurrences, per-surah distribution)
- Pattern (wazn) derivation for lemmas where it is mechanically certain; null + reason otherwise
- Cross-validation: QAC vs owner CSV vs a second independent source → `docs/DATA-VALIDATION.md` with categories, counts, examples; disputed roots stored as attributed variants
- Import tafsirs, translations, word-by-word glosses, lexica entries per licenses
- Integrity test suite (counts, checksums, alignment, no orphan tokens, every root in ≥1 word)
- Release artefacts (JSON + CSV) with license manifest; dataset version `YYYY.MM.N`
**Exit:** `pipeline build` from a clean checkout reproduces the DB; all integrity tests green; validation report written from computed numbers.

### Phase 2 — API ✅
Done: schema + atomic loader (+ web cache expiry) · meta/sources/catalog/surahs/verses/pages/words/roots/occurrences/lemmas/search/works/commentary/lexicon/recitations/root graph · ETags tied to the loaded release · error envelope · rate limit · plain-ASCII root input · tests against the loaded dataset.
- Schema + migrations (Alembic), loader from pipeline output
- Endpoints: meta/sources · surahs · verses (with words) · words · roots (+family, distribution, occurrences/KWIC) · lemmas · search (Arabic/translit/English/ref/root-letters) · tafsir · translations · lexica · root graph document
- Error envelope, cursor pagination, ETag/Cache-Control, rate limiting, CORS, OpenAPI docs
- Tests against the real loaded dataset, incl. the Arabic search assertions
**Exit:** `curl /api/v1/words/2:255:1` returns the full word panel payload; test suite green.

### Phase 3 — Web foundations ✅
- Next.js app, ar/en routing (RTL/LTR), tokens light/dark, fonts self-hosted (Quran font verified at reading size with all marks), shell + nav, error/404 pages
**Exit:** screenshots at 1440 and 390 in both themes show correct Quranic rendering and mirrored layout.

### Phase 4 — Quran reader + word panel + tafsir ✅
Done: surah index · reader (verse/flow layouts, size, translation/inline al-Muyassar, ۞ signs) · word panel (meaning in context, root family, morphology with wazn, counts, KWIC, variants, next steps) · verse panel (7 tafsirs, translation, copy/share) · verse page · word page · audio with word highlighting and listen-to-word · phone sheet · plain-language term cards (31 terms, "Explain terms" setting). The exit journey is an e2e test (desktop + phone).
- Surah index, surah reader (verse markers, basmala rules, delegated word clicks, copy that never injects verse numbers), verse page
- Word panel (layered): meaning · root & family · morphology (plain Arabic) · occurrences · dictionaries · where next; phone bottom sheet
- Verse panel: tafsir selector, translation, audio, copy/share/cite
- Word audio + verse audio
**Exit:** journey "open surah → tap word → see root family → open an occurrence → read its tafsir" works on desktop and phone.

### Phase 5 — Roots, concordance, search, home ✅
Done and e2e-tested: root page (family with wazn, stats, distribution, KWIC, lexica, variants), search (Arabic with/without marks, mushaf paste, root letters, ASCII or dotted transliteration, English meaning, references), root builder, home.
- Root page (family by lemma/form, stats, distribution, KWIC concordance, lexica), search page with root builder, omnibox ⌘K, home page
**Exit:** any word findable four ways (Arabic with/without diacritics, root letters, transliteration, English); root page numbers match the dataset.

### Phase 6 — Graph canvas ✅
Done: root family map (bounded, expand on demand), editor with palette, labelled undo, autosave, PNG/JSON export, share links.
- Auto root graph (root → lemmas → forms → verse cards, bounded, expand on demand), card anatomy per handoff, pan/zoom/fit/tidy, keyboard
- Editor: topic and semantic-field graphs from any word/verse/root/note; labelled undo/redo; local autosave; import/export JSON; PNG export; share-by-link
**Exit:** a user builds, saves, reloads and shares a graph; no work is ever lost.

### Phase 7 — Personal layer (local-first) ✅
Done: bookmarks, verse notes, history, reading resume, preferences, maps — in the browser only, export and delete all.
- Bookmarks, notes, word states, reading progress/resume, preferences, trails — IndexedDB, export/delete
**Exit:** all personal features work offline of any account; export/delete verified.

### Phase 8 — Launch readiness 🔄
Done: about/method (incl. wazn), sources & licenses, privacy, developers pages · SEO (per-page canonical + hreflang, sitemaps for every URL, robots, JSON-LD, share images) · axe WCAG 2.1 AA clean in both themes · CSP + security headers · production build with every content page cached (ISR) and no data needed at build · Docker images, production compose (Caddy TLS), CI, runbook (docs/DEPLOY.md) — all verified on local Docker. Performance: first-paint fonts only (711 → 443 KB), fonts compressed at the proxy; the longest surah page is 208 KB gzipped (2.2 MB raw, measured). 60 e2e tests and 156 Python tests pass. Deploy itself waits for the owner's go.
- About / methodology / sources & licenses / privacy pages; developer page (API docs)
- SEO: metadata, sitemaps, OG images for verses and roots, canonical/hreflang
- a11y audit (axe), performance budgets, security headers/CSP, Dockerfiles, CI, deploy runbook
**Exit:** all checks green; deployment needs only the owner's go + credentials.

### Later horizons (planned separately, not in this release)
Accounts + sync · published/forked graphs · community proposals with a scholarly review board · spaced-repetition review of root families · collections · hadith encyclopedia · full dictionary browsing · book reader · classroom.

## 4 · Owner decisions pending (tracked here, surfaced in the final report)
- Public product name (working title جُذور; "Jadhr" in the handoff collides with jadhr.app)
- Relationship to the sibling `Judhur` project (this repo is built fresh per the new brief; Judhur's verified research reused)
- Accounts/PII policy (Judhur decided "no accounts"; the new design assumes optional accounts)
- Hosting + credentials; domain
