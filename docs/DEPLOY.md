# DEPLOY — running جُذور in production

> Nothing here is run against production without the owner's explicit go. Every command below was run end to end on a local Docker host (2026-10-02): stack up, dataset loaded, every page 200 through Caddy.

## What runs

| Service | Image | Role |
|---|---|---|
| `caddy` | `caddy:2-alpine` | TLS (automatic HTTPS for the domain), gzip/zstd, routes `/api/v1/*` to the API and everything else to the web app, blocks `/api/revalidate` from outside |
| `web` | `apps/web/Dockerfile` | Next.js standalone server. Pages render on first request and stay cached until the next release |
| `api` | `services/api/Dockerfile` | FastAPI, read-only, ETag + long cache headers |
| `db` | `postgres:17-alpine` | the `content` schema, reloaded atomically per dataset release |
| `loader` (one-off) | API image | migrations, atomic load of `data/build/<version>`, then expires the web cache |

Files: `infra/compose.prod.yml`, `infra/Caddyfile`, `.env.example` (every variable explained).

## Owner inputs needed before the first deploy

- A server with Docker (2 vCPU / 4 GB is ample) and the domain pointed at it.
- `.env.production` on the server (never committed):

```
POSTGRES_PASSWORD=<long random>
REVALIDATE_SECRET=<long random>
PUBLIC_URL=https://<domain>
SITE_ADDRESS=<domain>
DATASET_VERSION=2026.10.0
```

`SITE_ADDRESS` set to the bare domain makes Caddy obtain and renew certificates itself (ports 80 and 443 must be open).

## Build the dataset (on a workstation with the raw sources)

The raw sources are licensed downloads kept out of git (`data/raw/`, every file sha256-pinned in `data/sources.yaml`, `data/lexica.yaml`, `data/recitations.yaml`).

```
uv run judhur-pipeline build                   # fails on any pin drift
uv run python -m judhur_pipeline.validation    # regenerates docs/DATA-VALIDATION.md
JUDHUR_REQUIRE_DATA=1 uv run pytest packages/arabic-py pipeline services/api -q
```

Copy `data/build/<version>/` and `data/sources.yaml` to the same paths in the server's checkout.

## First deploy

```
docker compose -f infra/compose.prod.yml --env-file .env.production up -d --build
docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader
```

The loader prints `"web_revalidate": "ok (200)"` when the web cache was expired. Until the first load the site answers 500 (no data).

## Smoke check after any deploy

```
for p in / /about /quran/2/255 /word/2:255:23 /roots/%D8%B9%D9%84%D9%85 /en/word/1:1:1 "/search?q=%D8%B5%D8%A8%D8%B1" /api/v1/meta /sitemap/core.xml /robots.txt; do
  curl -s -L -o /dev/null -w "%{http_code} redirects=%{num_redirects} $p\n" "https://<domain>$p"; done
```

Every line must read `200 redirects=0`. `curl -s https://<domain>/api/v1/meta` shows the loaded dataset version and its text hash, which must equal `text_sha256` in `data/build/<version>/report.json`.

## Releasing new content

1. Build and validate the new dataset version (above); keep the previous `data/build/<version>/` directory.
2. Copy it to the server, set `DATASET_VERSION`, run the loader. The load is one transaction: a failure leaves the previous release serving.
3. The loader expires the web cache; the API picks the new release up within 30 s (ETags change with the load time).
4. If a CDN sits in front of Caddy, purge it — pages are cached for a day (`s-maxage=86400`).

Rollback = run the loader with the previous version directory.

## Releasing new code

`git pull`, then `up -d --build`. The web build needs no data or API. Rollback = check out the previous tag and rebuild.

## Things that bite

- **`HOSTNAME=0.0.0.0`** must stay in the web image. Docker sets `HOSTNAME` to the container id; with that, the locale proxy's internal rewrite is treated as an external host and every Arabic page redirect-loops.
- **`JUDHUR_API_ORIGIN` is baked into the web build** (the `/api/v1` rewrite). Behind Caddy the rewrite is never used, but a deploy without Caddy must build with the right origin.
- **The revalidation secret** must be identical on `web` and `loader`; without it the loader reports `failed` and pages keep the old release for up to a day.
- **Backups**: the `content` schema is fully reproducible from `data/build/<version>`; keep those directories. There is no user data on the server (everything personal stays in the reader's browser).

## Before the site goes public (owner)

Licensing gates from the research reports: the non-commercial assumption (EveryAyah audio CC BY-NC, corpus terms), al-Sa'di in life+70 jurisdictions until 2027-01-01, QuranEnc's "keep the version, link the source" terms (shown on every tafsir/translation), and the corpus attribution link on every word panel. See `docs/research/` and the sources page.
