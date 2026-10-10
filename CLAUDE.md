# جذر (Jadhr) — Quran roots platform

Read `docs/PLAN.md` (status) and `docs/DECISIONS.md` (decisions + lessons) before touching code. `docs/DATA-VALIDATION.md` is generated; `docs/DEPLOY.md` is the runbook; `docs/research/` holds the source and licence research.

## Product laws (never break)

- The Quranic text is the KFGQPC file verbatim; it is hash-checked on every load. Never normalise or edit stored text — derived shadows only.
- No generated religious content: meanings, tafsir and glosses come only from cited sources, shown verbatim. Our own copy is UI and plain grammar explanations (`apps/web/src/lib/terms.ts`), flagged for review.
- Disagreements are shown with attribution; particles get "no root", never a pseudo-root.
- No tracking, ads or cookies; personal data stays in the browser.

## Ownership of the vision

- The measure of done is the owner's vision (`Quran Idea.md`, the owner's later messages) and the full design handoff (`Claude Design Handoff/`, every screen, state and journey) — never a phase list I wrote myself. A plan is a path toward the vision; finishing the plan without the vision is not done, and is never reported as done or "ready for production".
- Thinking beyond the vision is part of the job: at every phase boundary, and whenever the work reveals an opportunity, add concrete proposals (what, why it serves the reader, cost, risks) to the "Beyond the vision" section of `docs/PLAN.md`. The owner reviews them; proposals that change the product's identity wait for that review, the rest are built.
- Never move part of the vision to "later" without the owner's agreement. If something truly cannot be built now, name it, say why, and put it in front of the owner.
- This project's vision is its own. Nothing is taken from any other project — no code, data, names, wording, decisions or lessons (global rule "Project boundaries").

## Layout

- `apps/web` — Next.js 16 (read `apps/web/AGENTS.md`: this Next differs from training data; docs in `node_modules/next/dist/docs/`). Arabic at `/`, English at `/en`.
- `services/api` — FastAPI + Alembic (hand-written SQL migrations) + `jadhr_api.loader`.
- `services/embed` — the embedding service (P17, D34): a pinned open model as ONNX, for the build's verse vectors and the readers' searches.
- `pipeline` — dataset build from pinned raw sources in `data/raw/` (gitignored, licensed downloads).
- `packages/arabic-py` — Arabic normalisation, Buckwalter, root input parsing.
- `infra/` — production compose + Caddyfile.

## Commands

| What | Command |
|---|---|
| DB + search (Postgres 17 on 5442, OpenSearch on 9201) | `docker compose up -d` |
| Rebuild the search index (the loader does it after each load) | `uv run python -m jadhr_api.searchindex reindex` |
| Python environment (every workspace package; plain `uv sync` removes the members') | `uv sync --all-packages` |
| Embedding model, once (pinned, sha256-checked, into `data/tools/models`) · the service (port 8010; search by meaning) | `uv run python -m jadhr_embed fetch` · `uv run python -m jadhr_embed serve` |
| API (port 8000) | `uv run uvicorn jadhr_api.main:app --port 8000 --reload --reload-dir services/api/src --reload-dir packages/arabic-py/src` |
| Web (port 3210 — 3000 belongs to another project) | `pnpm dev` |
| Build dataset (fails on pin drift; needs the embedding model, above) | `uv run jadhr-pipeline build` |
| Load it (+ expire web cache) | `uv run python -m jadhr_api.loader data/build/2026.10.0 data/sources.yaml` |
| Expire web cache only (after API changes) | `uv run python -m jadhr_api.loader --revalidate` |
| Validation report / release (built once; `--force` before it is recorded) | `uv run python -m jadhr_pipeline.validation` · `uv run python -m jadhr_pipeline.release` |
| Jing for the release's TEI Lex-0 check (once; needs Java) | `uv run python -m jadhr_pipeline.lexicon_xml fetch-jing` |
| Record a built release (once; publishing it is the owner's go) | `uv run python -m jadhr_api.releases record data/release/2026.10.0` · `… publish 2026.10.0` · `… doi 2026.10.0 <doi>` |
| Expert review packets (D15, P3.10; outside git) | `uv run python -m jadhr_api.packets data/review/2026.10.0` |
| Python tests (strict, with data and the model) | `JADHR_REQUIRE_DATA=1 uv run pytest packages/arabic-py pipeline services/api services/embed -q` |
| Web checks | `pnpm lint && pnpm typecheck && pnpm build` |
| The API's own database role (once per database; production's loader does it) | `JADHR_APP_DB_PASSWORD=<pw> uv run python -m jadhr_api.dbroles` |
| E2E + axe, against the production build | API started as that role, as in production (`JADHR_DATABASE_URL=postgresql+psycopg://jadhr_api:<pw>@localhost:5442/jadhr`; a missing grant shows only so), with `JADHR_MAIL_BACKEND=dev` (in `.env`; the suite reads sign-in links from its outbox, and unset no mail is sent) and `JADHR_RATE_LIMIT_PER_MINUTE=100000 JADHR_MAIL_PER_IP_PER_HOUR=100000 JADHR_ACCOUNT_RATE_PER_MINUTE=100000 JADHR_INTAKE_ALLOW_PRIVATE=1` (every browser shares one address, the suite signs in dozens of times, and the intake test serves its web page on loopback — never set the last one in production); `pnpm build && JADHR_REVALIDATE_SECRET=e2e pnpm exec next start --port 3215`; `E2E_REVALIDATE_SECRET=e2e E2E_BASE_URL=http://localhost:3215 pnpm exec playwright test` (the secret lets the tests expire that server's cached pages after the board approves) |

## Working rules for this repo

- Run the production build before calling a web change done; dev mode hides caching and routing bugs.
- Patch scripts assert their match count — a silent non-match has bitten this repo several times.
- Compare Arabic strings after NFC; never trust typed combining-mark literals.
- UI work is verified at 1440 and 390 px in both themes by reading screenshots, and by the e2e/axe suite.
- Commit one task per commit; split hunks when two tasks touch one file.
