# DEPLOY — running Jadhr (جذر) in production

> Nothing here is run against production without the owner's explicit go. Every command below was run end to end on a local Docker host (2026-10-02): stack up, dataset loaded, every page 200 through Caddy.

## What runs

| Service | Image | Role |
|---|---|---|
| `caddy` | `caddy:2-alpine` | TLS (automatic HTTPS for the domain), gzip/zstd, routes `/api/v1/*` to the API and everything else to the web app, blocks `/api/revalidate` from outside |
| `web` | `apps/web/Dockerfile` | Next.js standalone server. Pages render on first request and stay cached until the next release |
| `api` | `services/api/Dockerfile` | FastAPI, read-only, ETag + long cache headers |
| `db` | `postgres:17-alpine` | the `content` schema, reloaded atomically per dataset release — the source of truth |
| `search` | `opensearchproject/opensearch:2.19.3` | the derived search index (words, roots, patterns, passages, word occurrences, dictionary articles); disposable, rebuilt from Postgres |
| `loader` (one-off) | API image | migrations, atomic load of `data/build/<version>`, search reindex (aliases flip atomically), then expires the web cache |

Files: `infra/compose.prod.yml`, `infra/Caddyfile`, `.env.example` (every variable explained).

## Owner inputs needed before the first deploy

- A server with Docker (2 vCPU / 6 GB: OpenSearch takes a 1 GB heap by default, `SEARCH_HEAP` to change) and the domain pointed at it.
- `.env.production` on the server (never committed):

```
POSTGRES_PASSWORD=<long random>
REVALIDATE_SECRET=<long random>
INTERNAL_TOKEN=<long random>   # the web server's renders send it to the API and skip the per-IP rate limit
PUBLIC_URL=https://<domain>
SITE_ADDRESS=<domain>
DATASET_VERSION=2026.10.0
```

`SITE_ADDRESS` set to the bare domain makes Caddy obtain and renew certificates itself (ports 80 and 443 must be open).

## Build the dataset (on a workstation with the raw sources)

The raw sources are licensed downloads kept out of git (`data/raw/`, every file sha256-pinned in `data/sources.yaml`, `data/lexica.yaml`, `data/recitations.yaml`).

```
uv run jadhr-pipeline build                   # fails on any pin drift
uv run python -m jadhr_pipeline.validation    # regenerates docs/DATA-VALIDATION.md
JADHR_REQUIRE_DATA=1 uv run pytest packages/arabic-py pipeline services/api -q
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

When the API changed (search behaviour, payload fields), expire the pages and responses the web app cached from the old API:

```
docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader python -m jadhr_api.loader --revalidate
```

## Dataset releases (P10)

A dataset release is the redistributable part of a build — `data/release/<version>/`, a `MANIFEST.json` and its files (JSON Lines, CSV, and the lexicon as TEI Lex-0 and LMF). It is built once, recorded once and published once; the database refuses any change to a recorded release.

1. Build it where the dataset was built. The TEI Lex-0 files are checked with Jing, which needs Java 11 or later; fetch Jing once (pinned by its sha256). Every file is checked as it is built, and a failure writes no manifest.

   ```
   uv run python -m jadhr_pipeline.lexicon_xml fetch-jing
   uv run python -m jadhr_pipeline.release <version>
   ```

2. Copy `data/release/<version>/` to the server's `data/release/` (the API and the loader mount it read-only at `/data/release`).
3. Record it — every file's size and sha256 are checked against the manifest first:

   ```
   docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader python -m jadhr_api.releases record /data/release/<version>
   ```

4. Publish it — **only on the owner's go** (`… releases publish <version>`). From then on its files are served, except those under a hold in its manifest (`publication_hold`), which stay listed with their reason until a later release lifts the hold. Before Lane's files are published, the owner offers Perseus our modifications (its terms; docs/DECISIONS.md).
5. When a DOI is minted: `… releases doi <version> <doi>`.

Keep `data/release/<version>/` for good: a recorded release whose folder is gone answers 410 for its files, and its citation names those bytes.

## Things that bite

- **`HOSTNAME=0.0.0.0`** must stay in the web image. Docker sets `HOSTNAME` to the container id; with that, the locale proxy's internal rewrite is treated as an external host and every Arabic page redirect-loops.
- **`JADHR_API_ORIGIN` is baked into the web build** (the `/api/v1` rewrite). Behind Caddy the rewrite is never used, but a deploy without Caddy must build with the right origin.
- **The revalidation secret** must be identical on `web` and `loader`; without it the loader reports `failed` and pages keep the old release for up to a day.
- **Backups**: the `content` schema is fully reproducible from `data/build/<version>`; keep those directories. The `accounts` and `contributions` schemas hold readers' data (P6, P7): the `backup` service dumps both daily into the `account_backups` volume and removes each dump before it is fourteen days old — the privacy page states that period, so change both together. Copies made off the server keep the same fourteen days and no longer. Restore: `gunzip -c accounts-….sql.gz | docker compose -f infra/compose.prod.yml --env-file .env.production exec -T db psql -U jadhr -d jadhr`, then at once `docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader python -m jadhr_api.maintenance reapply-deletions`, which deletes again every account deleted since the dump (their ids alone are kept fifteen days for this).
- **`DATA_KEY`** encrypts every synced record's key and value, and every shared lookup (AES-GCM, bound to the account and the store), and keys the hash that finds a record. The API refuses to start syncing in production without it, and the loader needs it for the migrations. Generate it once (`openssl rand -base64 32`), keep a copy off the server, and never rotate it without a re-encryption script: a lost key is every synced record lost. In the dumps, e-mail addresses, chosen names, ORCIDs, device names and the times of records are not encrypted; record keys and values are.
- **Logs**: Caddy's access log is the only request log — the page without its query string, the address shortened, no headers — written to the `caddy_data` volume, a new file each day, rolled files kept six days, so no line is older than seven (`infra/Caddyfile`; `services/api/tests/test_privacy_page.py` holds the privacy page to it). The API writes no access log (`--no-access-log`); every container's own log rotates at 3 × 10 MB.

## Accounts (P6)

Optional for readers; everything works without them. Before enabling sign-in in production (owner):

1. `DATA_KEY` set (above).
2. E-mail links: an SMTP provider for `MAIL_FROM` with SPF and DKIM on the domain; `MAIL_BACKEND=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`. Until then the sign-in sheet says sign-in is not available here, and nothing else changes.
3. Google (optional): an OAuth client of type "Web application" with the redirect URI `https://<domain>/auth/oidc/google`; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Apple (optional): a Services ID with the return URL `https://<domain>/api/auth/apple` and a Sign in with Apple key; `APPLE_CLIENT_ID` (the Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (the .p8 contents, newlines as `\n`).
5. The API purges what the privacy page promises daily (expired links and sessions, replaced versions after 30 days, shared lookups after a year).
6. The editorial board (P7, D4) is appointed: once a person has signed in, give them the role from the command line — `docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader python -m jadhr_api.roles <email> editor` (or `admin`, who can then appoint others in the app). Every grant is recorded in `contributions.role_grants`. Reviewers also earn the role after ten merged contributions.

## Before the site goes public (owner)

Licensing gates from the research reports: the non-commercial assumption (EveryAyah audio CC BY-NC, corpus terms), al-Sa'di in life+70 jurisdictions until 2027-01-01, QuranEnc's "keep the version, link the source" terms (shown on every tafsir/translation), and the corpus attribution link on every word panel. See `docs/research/` and the sources page.

## Search index

OpenSearch holds only derived data. If it is down, `/api/v1/search` answers from Postgres and says so (`"engine": "postgres"`); nothing else depends on it. Rebuild by hand at any time — new indices are built and checked against Postgres document counts before the aliases move:

```
docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader python -m jadhr_api.searchindex reindex
docker compose -f infra/compose.prod.yml --env-file .env.production run --rm loader python -m jadhr_api.searchindex status
```
