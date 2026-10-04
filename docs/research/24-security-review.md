# 24 · Security review — P12

Reviewed 2026-10-05 at commit `5577450`; fixes through the commits named in each row. Scope: the API (`services/api`), the web app (`apps/web`), the production stack (`infra/`), the development stack and the dependencies. Not in scope: `pipeline/`, which runs offline over pinned licensed downloads and is never reached by a reader.

**Method.** A static read of the code by a review agent: every route, every SQL statement, every place a reader's input or another site's answer is used, the headers, the containers. Every finding was then checked against the code before it was fixed, and each fix carries a test that fails without it. The dependency audits ran separately: `pnpm audit --prod` and `pip-audit` over the locked requirements.

**Status rules.** `fixed` — changed, with the test or check named. `accepted` — left as it is on purpose, the reason given; the owner can overrule it. `owner` — needs something only the owner can supply.

## 1. Summary

| Severity | Found | Fixed | Fixed in part, rest accepted | Accepted |
|---|---|---|---|---|
| Critical, high | 0 | — | — | — |
| Medium | 3 | 3 | 0 | 0 |
| Low | 12 | 10 | 2 (L4, L6) | 0 |
| Info | 4 | 3 | 1 (I2) | 0 |
| Dependencies | 1 high (lint tool) | 0 | 0 | 1 |

## 2. Findings

| ID | Finding | Status | What changed | Held by |
|---|---|---|---|---|
| M1 | A sign-in link someone asked for their own address and sent to a reader signed the reader in to the sender's account, and this browser's notes, saved items, texts and maps went up to it at the first sync. | fixed (`852dd0f`) | The link's page names the account before the button (`POST /auth/link` reads a link without spending it) and warns when another browser asked for it (the asking browser keeps a random value, the link its hash). This browser's own records go to the first account it signs in to only on the reader's word, in a question naming that account. | `test_accounts_api.py::test_a_link_names_its_address…`; `account-sync.spec.ts` (the attack itself) |
| M2 | Text intake had no total time limit: a site sending a byte every few seconds, or a crafted PDF, held a thread of the pool every route shares; about 80 requests stalled the API. | fixed (`7c552be`) | A page is fetched within 15 s in all (5 s per wait). A PDF is read in a process of its own under limits of CPU and memory, killed at 60 s. One intake at a time per address, four per worker. | `test_intake_api.py` (a slow site, a PDF past its deadline, the slots) |
| M3 | `/api/v1/docs` loaded a floating Swagger UI (`@5`) from a CDN, with no integrity check, on the site's own origin, where a script could read a reader's session. | fixed (`bc6fb7c`) | Swagger UI 5.33.1 served from the API's own files (tarball checked against the registry, file hashes recorded), under a policy that admits its own files and one inline script by hash. | `test_api_docs.py`; a browser render with no outside request |
| L1 | The intake's address check let 100.64.0.0/10 (shared address space: Tailscale, carrier NAT, some clouds' metadata) through. | fixed (`7c552be`) | Only `is_global` addresses; an IPv4 address inside IPv6 is judged as itself. | `test_intake_api.py` |
| L2 | The DNS-rebinding check read the peer after the request was sent, passed when no peer was known, and proxies from the environment applied. | fixed (`7c552be`) | The name is resolved once and checked, and the request goes to that address, with the name as Host and TLS name. Environment proxies are ignored. | `test_intake_api.py::test_the_request_goes_to_the_address_checked`; a real https fetch and a wrong-host certificate refused |
| L3 | After sign-in, `/signin?next=/%09/evil.com` sent the reader to another site: the URL parser drops the tab. | fixed (`e632a3c`) | A return path with any control character or white space, a backslash or two slashes goes to the account page, on the server and in the browser. | `test_accounts_api.py::test_a_return_path…`; `paths.test.ts` |
| L4 | Rate limits were keyed on the full address (an IPv6 /64 holds 2^64 of them), did not cover the WebSocket, and a page rendered on the server reached the API unlimited. | fixed in part (`a4c57a0`, `4b19e5e`, `9912390`) | Every limit counts an IPv6 address by its /64. The WebSocket has limits of its own. The web's proxy counts the pages each address asks for: 1200 a minute in all, 120 of the pages that read the API afresh. **Accepted:** the counts stay in each worker's memory, so the limit a worker enforces is per worker (two workers: twice the stated figure). A shared store (Redis or a table written on every request) costs more than the difference is worth at this scale. | `test_clients.py`; `pageLimit.test.ts`; checked on the production build |
| L5 | `POST /ops/errors` takes no sign-in: anyone could add a new row with each report, bury real errors, and put terminal escapes into the CLI's report. | fixed (`03a12de`) | A kind must be a name and a place a path; control and direction characters are removed. 500 kinds a day per source, the rest counted in one row. 30 reports a minute per address. | `test_ops_api.py` |
| L6 | The content policy allows inline scripts, the session token sits in localStorage, and deleting the account needed no re-authentication: one future injection would be account takeover or deletion. | fixed in part (`5345456`) | Deleting the account now needs a sign-in on the device within the last quarter of an hour (a fresh link to the address, or the provider again). **Accepted:** inline scripts stay allowed, because a nonce would make every page dynamic and lose the cached pages (DECISIONS 2026-10-02). The token stays in localStorage, because the product sets no cookies (product law). No injection was found: React escapes every reader's string, JSON-LD escapes `<`, and the policy admits no other origin. | `test_accounts_api.py::test_deleting_an_account_asks_for_a_recent_sign_in` |
| L7 | Anyone could open unlimited presence sockets on a shared map; about 50 windows overflowed Postgres's 8000-byte notification, and presence across workers silently stopped. | fixed (`4b19e5e`) | Windows are admitted before their hello: 200 per map, 20 held and 60 opened a minute per address, 4000 per worker. A worker's message fits one notification: guests are counted, and past what fits a signed-in window is counted rather than named. Messages are capped at 64 KB. | `test_presence_api.py` |
| L8 | `/api/auth/apple` read any body whole; Caddy set no body limit. | fixed (`bec6620`) | Caddy passes at most 10 MB anywhere, 64 KB to that handler, which also needs a stated length within it. | Caddy 2 run with the Caddyfile and capabilities dropped, before upstreams that read every byte: 100 KB to that handler and 11 MB to the API or the web refused (413), 5 MB passed |
| L9 | The API, the monitor and the backup connected as the database superuser. | fixed (`6577b1a`) | A role of its own, `jadhr_api` in `jadhr_app`: it reads `content` and `releases` and reads and writes the readers' schemas, and makes nothing. The superuser only migrates and loads. | `test_dbroles.py` (every schema and table, and a role refused writes, tables and programs); the full e2e suite run with the API as that role; the backup's `pg_dump` run as it; the API image run as it |
| L10 | The development stack published Postgres (password `jadhr`) and OpenSearch (no security) on every interface. | fixed (`c63ae18`) | Bound to 127.0.0.1. | `docker compose ps` |
| L11 | An unhandled error was stored as `str(exc)`, which for a database error carries the statement and its values: an address or a note could be kept for 30 days. | fixed (`03a12de`) | An API error is kept as its type and its place in our code, never its message. A page's message keeps its shape, with what it quotes, any address, query string and long number taken out. | `test_ops_api.py` |
| L12 | Direction controls were stripped from display names only; a map's title could pass for another's in the gallery. | fixed (`c88f695`) | The controls that reorder text are taken out of every public string as it is saved, and one-line names lose the marks too. | `test_plain.py` |
| I1 | With nothing set, the mail backend was `dev`: any server started without `JADHR_ENVIRONMENT=production` handed anyone any address's sign-in link. | fixed (`6cdc290`) | The default is `none`; development sets `dev` in `.env`. | `test_accounts_api.py::test_a_server_started_with_nothing_set…` |
| I2 | Caddy runs as root (image default), and image tags float within a version. | fixed in part (see §3) | Every capability dropped and none to gain; the tags stay floating, on purpose. | the API image run with no capability (uid 10001; health, docs, search, a PDF read in its own process; a 400 MB allocation refused under the PDF process's 200 MB limit on Linux); Caddy run likewise |
| I3 | The internal token was compared with `==`. | fixed (`a838011`) | `hmac.compare_digest`, as bytes. | `test_api.py::test_internal_token…` |
| I4 | The word share image put an unchecked path segment into the API's address. | fixed (`c9db80f`) | Only a word's place (s:a:w). | — |

## 3. Containers and images (I2)

The images float within a version on purpose (`postgres:17-alpine`, `caddy:2-alpine`, `python:3.13-slim`, `node:…-alpine`): a rebuild takes the version's security patches, and nobody maintains pinned digests here. A digest pinned and never bumped would keep a known hole longer than a floating tag can open one. The containers themselves are bounded: Caddy, the API, the web, the monitor, the backup and the loader run with every capability dropped (Caddy keeps only binding ports below 1024) and cannot gain privileges (`infra/compose.prod.yml`). Postgres and OpenSearch keep their images' defaults: their entrypoints change users and owners. The web image was not built for this check (the disk was near full); its process runs as `node` and asks for no capability. The API runs as uid 10001 and the web as `node`. Only Caddy publishes ports.

## 4. Dependencies

- `pnpm audit --prod`: no known vulnerability.
- `pip-audit` over the locked requirements: no known vulnerability.
- `pnpm audit` with dev dependencies: `braces` 3.0.3, GHSA-vfj7-8cjw-p6xm (high; stack exhaustion from deeply nested patterns), reached only through `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch`. No patched version exists. **Accepted:** it runs only while linting, over the repository's own glob patterns, and is never in a build or on a server.

## 5. What was checked and found sound

Every value from a request reaches SQL as a bound parameter; the SQL built with f-strings is assembled from constants and allow-listed names. User content is rendered as React text, with no `dangerouslySetInnerHTML` other than JSON-LD, which escapes `<`. Every postMessage handler checks the origin and the source. Sign-in links and sessions are 256-bit and stored hashed. A link is spent once and atomically, after 15 minutes, and only when the button is pressed. Google and Apple use PKCE, with the ID token's signature, audience, issuer and expiry verified. Every route that changes data has its owner and role checks. There is no CSRF surface: no cookie authenticates anything. Release files are served only from a recorded manifest, with their sizes matched. Synced records are sealed with AES-GCM, bound to the user and the store. The internal token never reaches the browser. No secrets are committed, in the tree or in its history.

## 6. Not checked here

- Behaviour inside libraries that was read from our side only: Caddy replacing a client's `X-Forwarded-For`, which every per-address limit relies on (Caddy 2.5+ trusts no proxy by default), and pypdf's own decompression caps.
- The server itself: firewall, SSH, `.env.production`, and whether the host sits on a network with a metadata endpoint. The intake refuses every non-global address either way.
- Real Google and Apple sign-ins, which need the owner's credentials.
