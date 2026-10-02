# DECISIONS & LESSONS

> One file for decisions (with the reason) and lessons. Superseded entries are removed, not left to rot. Format: `[date] Decision — reason`.

## Decisions

- [2026-10-02] **Build fresh in this folder; reuse the sibling `Judhur` project as research input only.** — The brief points here and describes a different product shape (data-driven lexicon + user graphs from the Claude Design handoff) than Judhur (editorial waqf, owner-authored meanings, read-only canvas). Judhur's verified license register, lessons and pinned source artefacts are reused with credit; its code is not, because the new brief asks for a Python backend and a different product. Flagged to the owner.
- [2026-10-02] **Product laws adopted (PLAN §1).** — Mushaf integrity and "no generated religious content" are the owner's own laws from Judhur (approved July 2026) and match the brief's insistence on respect; the rest come from the design handoff's non-negotiables.
- [2026-10-02] **Working title جُذور / Judhur.** — The handoff's "Jadhr" collides with an existing third-party site (jadhr.app, "Jadhr — Arabic Root Explorer"). جُذور is the owner's own prior working title. Name lives in one config constant; public name is an owner call.
- [2026-10-02] **Arabic is the default UI language and layout direction; English is a full second locale.** — Brief: "Main/default Language: Arabic". The handoff designs English chrome; we mirror it to RTL with logical CSS properties (the handoff itself requires logical CSS). Arabic at `/`, English at `/en`; no Accept-Language redirect (Judhur lesson: canonical Arabic URLs must not flip by header).
- [2026-10-02] **Frontend: Next.js 16 App Router + React 19 + TypeScript.** — Owner suggested React; SSR is required for verse/root/word pages (SEO for Arabic queries like "جذر كلمة", link previews, citations) and the reader/editor need heavy client state. Next.js is React with both.
- [2026-10-02] **Backend: FastAPI (Python) API service + Python data pipeline, separate from the web app.** — Owner suggested Python; the brief makes "our own all-in-one API" a product in itself (needs independent versioning, OpenAPI docs, its own rate limits), and the Arabic-NLP/data ecosystem (parsing, morphology tools, validation) is Python. The web app calls the API server-side.
- [2026-10-02] **Search on Postgres, not OpenSearch, for this release.** — Quran scale is ~77k words / ~1.7k roots / ~4.8k lemmas; normalised shadow columns + pg_trgm + FTS meet the five Arabic search assertions without operating a cluster (the handoff itself warns against over-provisioning). Search sits behind one module so OpenSearch can replace it when large lexica/hadith full-text relevance is measured to need it.
- [2026-10-02] **Graph canvas: @xyflow/react + elkjs, bounded expansion.** — The handoff's editor is rich editable DOM cards with fields, undo and comments — React Flow's model. Whole-family scale is handled by bounding (root → lemmas → forms → verse cards loaded on demand, ≤ ~150 visible nodes), not by a canvas renderer.
- [2026-10-02] **Postgres 17 in Docker for dev (prod target 17).** — Homebrew has PG14; dev must match prod major (Judhur lesson: pg_dump/restore must match server major).
- [2026-10-02] **No streaks, no ads, no autoplay, no tracking by default.** — Handoff ("progress without streaks") + respect for the subject.

## Lessons

- [2026-10-02] (from Judhur) Tanzil Uthmani and QPC Hafs differ systematically (embedded basmala, sukun U+0652 vs U+06E1, NBSP + digit medallions, ى/ي, hamza carriers, spacing) while the letter stream is identical — normalise only inside the comparator, never the stored text.
- [2026-10-02] (from Judhur) Strict parsers turn silent corruption into loud failures — CRLF once created 10 phantom roots; the Buckwalter mapper must throw on unknown characters.
- [2026-10-02] (from Judhur) Never assert Arabic combining-mark strings as typed literals in tests — assert codepoint sequences.
- [2026-10-02] (from Judhur) `user-select: none` does not keep verse numbers out of copied text — the copy handler must rebuild the text.
- [2026-10-02] (from Judhur) Search over Uthmani text needs alef-family folding (ٱ آ أ إ → ا, ى → ي) on both the shadow column and the query.
- [2026-10-02] (from Judhur) Give every non-default compose file an explicit `name:` — two compose files in one directory share a project and `down` on one removed the other's DB.
- [2026-10-02] (from Judhur) A strict production CSP breaks `next dev` (eval + HMR websocket) — relax only when `NODE_ENV=development`.
