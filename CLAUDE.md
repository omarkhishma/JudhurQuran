# جُذور (Judhur, working title) — Quran roots platform

Read `docs/PLAN.md` (status) and `docs/DECISIONS.md` (decisions + lessons) before touching code. `docs/DATA-VALIDATION.md` is generated; `docs/DEPLOY.md` is the runbook; `docs/research/` holds the source and licence research.

## Product laws (never break)

- The Quranic text is the KFGQPC file verbatim; it is hash-checked on every load. Never normalise or edit stored text — derived shadows only.
- No generated religious content: meanings, tafsir and glosses come only from cited sources, shown verbatim. Our own copy is UI and plain grammar explanations (`apps/web/src/lib/terms.ts`), flagged for review.
- Disagreements are shown with attribution; particles get "no root", never a pseudo-root.
- No tracking, ads or cookies; personal data stays in the browser.

## Layout

- `apps/web` — Next.js 16 (read `apps/web/AGENTS.md`: this Next differs from training data; docs in `node_modules/next/dist/docs/`). Arabic at `/`, English at `/en`.
- `services/api` — FastAPI + Alembic (hand-written SQL migrations) + `judhur_api.loader`.
- `pipeline` — dataset build from pinned raw sources in `data/raw/` (gitignored, licensed downloads).
- `packages/arabic-py` — Arabic normalisation, Buckwalter, root input parsing.
- `infra/` — production compose + Caddyfile.

## Commands

| What | Command |
|---|---|
| DB (Postgres 17, port 5442) | `docker compose up -d` |
| API (port 8000) | `uv run uvicorn judhur_api.main:app --port 8000 --reload --reload-dir services/api/src --reload-dir packages/arabic-py/src` |
| Web (port 3210 — 3000 belongs to another project) | `pnpm dev` |
| Build dataset (fails on pin drift) | `uv run judhur-pipeline build` |
| Load it (+ expire web cache) | `uv run python -m judhur_api.loader data/build/2026.10.0 data/sources.yaml` |
| Expire web cache only (after API changes) | `uv run python -m judhur_api.loader --revalidate` |
| Validation report / release | `uv run python -m judhur_pipeline.validation` · `uv run python -m judhur_pipeline.release` |
| Python tests (strict, with data) | `JUDHUR_REQUIRE_DATA=1 uv run pytest packages/arabic-py pipeline services/api -q` |
| Web checks | `pnpm lint && pnpm typecheck && pnpm build` |
| E2E + axe (needs the dev stack) | `cd apps/web && pnpm exec playwright test` |

## Working rules for this repo

- Run the production build before calling a web change done; dev mode hides caching and routing bugs.
- Patch scripts assert their match count — a silent non-match has bitten this repo several times.
- Compare Arabic strings after NFC; never trust typed combining-mark literals.
- UI work is verified at 1440 and 390 px in both themes by reading screenshots, and by the e2e/axe suite.
- Commit one task per commit; split hunks when two tasks touch one file.
