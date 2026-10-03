# 11 · Accounts, sync and Profile coverage — P6 against the design inventory and the code

Audited 2026-10-03 against commit `de0f5ea` (branch `build/vision`, read in the worktree branch `worktree-agent-a33ba7867de095e4e` at the same commit, no other change). Scope: phase P6 "Accounts and sync" of `docs/PLAN.md` (§6 P6, §7 "P6 | PRF 44 · SHR 25 · MAP 6 | 75") against `docs/research/05-design-inventory.md` Part 4 — §0 shared chrome and storage (SHR-01…20), §4 Profile (PRF-01…35, PRF-Q01…Q07), §6 hard-won fixes with these prefixes (SHR-H01…H05, PRF-H01…H02), §7 accounts versus local-first (MAP-01…06) — plus the six items audit 10 left waiting on P6: HUB-26, HUB-33, HUB-Q07, NTB-53, NTB-Q02, SHL-21.

**Method.** Read in full: inventory Part 4 §0, §4, §6, §7 and the six carried lines; PLAN §6–7; DECISIONS; audit 10 (the model for this report); `components/profile/ProfileScreen.tsx`, `AccountPanel.tsx`; `components/account/AccountButton.tsx`, `AuthScreens.tsx`, `SignInPanel.tsx`, `SyncRunner.tsx`; `components/home/LocalFirstPrompt.tsx`; `lib/account/store.ts`, `actions.ts`; `lib/sync/engine.ts`, `engine.test.ts`, `adapters.ts`, `run.ts`; `lib/localData.ts`; `lib/store/idbStorage.ts`, `safeStorage.ts`, `notebook.ts`, `analyseChoices.ts`; `lib/reader/store.ts` (personal store); `lib/graph/persist.ts`, `types.ts`; `lib/library/texts.ts`; `lib/profile.ts`, `lib/destinations.ts`; the routes `me`, `signin`, `auth/verify`, `auth/oidc/[provider]`, `privacy` and `app/api/auth/apple/route.ts`; the `me` and `account` namespaces of `ar.json` and `en.json`; the "Accounts and sync" and "Profile" sections of `globals.css`; `services/api/src/jadhr_api/accounts.py`, `sync.py`, `oidc.py`, `routes_me.py`, `settings.py` and the lifespan and middleware of `main.py`; `alembic/versions/0019_accounts.py`; `tests/test_accounts_api.py`; e2e `account-sync.spec.ts`, `profile.spec.ts`, `a11y.spec.ts`; `infra/compose.prod.yml`, `infra/Caddyfile`, `services/api/Dockerfile`, `docs/DEPLOY.md`; the handoff's `06-screens-community.md` §6.7, `08-api-contract.md` §8.1 and §8.4, `prototypes/Profile.dc.html` and `screenshots/14-profile.png`. Nothing was run but read-only commands: no server, no browser, no test suite (the brief forbids starting servers), so every defect below was found by reading the code and none was reproduced, and the phone and dark claims rest on the e2e and axe tests named, not on screenshots taken for this audit.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, with the reason named (a DECISIONS entry, a code comment, a Quran note or a plain reason in the row). `bug-fixed` — a prototype defect the inventory flags that our code does not have. `n/a` — a prototype artefact with nothing to build. `open` — buildable now and not built, or built with a fault that makes the item behave wrong; the row names what is missing. `waiting` — needs a later phase, named.

**Paths.** `profile/`, `account/`, `home/`, `shell/` are in `apps/web/src/components/`; `lib/…` is `apps/web/src/lib/…`; route files (`me/page.tsx`, `signin/page.tsx`, `auth/verify/page.tsx`, `privacy/page.tsx`, `notebook/page.tsx`) are under `apps/web/src/app/[locale]/(site)/`; `globals.css` is `apps/web/src/app/globals.css`; `ar.json`/`en.json` are `apps/web/src/messages/`; `accounts.py`, `sync.py`, `oidc.py`, `routes_me.py`, `settings.py`, `main.py` are in `services/api/src/jadhr_api/`; `0019_accounts.py` is in `services/api/alembic/versions/`; `test_accounts_api.py` in `services/api/tests/`; e2e specs in `apps/web/e2e/`; `compose.prod.yml` and `Caddyfile` in `infra/`; `DECISIONS:n` and `PLAN.md:n` are line numbers in `docs/`.

## 1. Summary

| Status | Items |
|---|---|
| done | 36 |
| adapted | 20 |
| bug-fixed | 8 |
| n/a | 2 |
| open | 8 |
| waiting | 7 |
| **total** | **81** |

Closed (done + adapted + bug-fixed + n/a): 66 of 81. Open: 8, all buildable now (§3); the faults behind them are privacy claims the code does not keep, an account export that leaves out four kinds of stored data, and three ways sync can lose or delete records it did not mean to. Waiting: 7, on P7, P8, P9, P10 and P11 (§4). Twenty-eight defects were found (§2); thirteen of them are the reasons for the open items, the other fifteen are listed after §3's table.

| Prefix | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|
| SHR | 25 | 12 | 7 | 3 | 1 | 1 | 1 |
| PRF | 44 | 21 | 10 | 5 | 1 | 4 | 3 |
| MAP | 6 | 1 | 1 | 0 | 0 | 1 | 3 |
| Carried | 6 | 2 | 2 | 0 | 0 | 2 | 0 |
| Total | 81 | 36 | 20 | 8 | 2 | 8 | 7 |

| Group | Inventory section | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|---|
| SHR-01…20 | Part 4 §0 Shared chrome and storage | 20 | 9 | 7 | 3 | 1 | 0 | 0 |
| SHR-H01…H05 | Part 4 §6 Hard-won fixes (shared) | 5 | 3 | 0 | 0 | 0 | 1 | 1 |
| PRF-01…08 | §4.1 Route, header, identity | 8 | 5 | 3 | 0 | 0 | 0 | 0 |
| PRF-09…14 | §4.2 Data controls | 6 | 3 | 0 | 2 | 0 | 1 | 0 |
| PRF-15…35 | §4.3 Tabs and rows | 21 | 8 | 6 | 3 | 1 | 1 | 2 |
| PRF-Q01…Q07 | §4.4 Quran adaptation notes | 7 | 4 | 0 | 0 | 0 | 2 | 1 |
| PRF-H01…H02 | §6 Hard-won fixes (Profile) | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| MAP-01…06 | §7 Accounts versus local-first | 6 | 1 | 1 | 0 | 0 | 1 | 3 |
| Carried from audit 10 | HUB-26, HUB-33, HUB-Q07, NTB-53, NTB-Q02, SHL-21 | 6 | 2 | 2 | 0 | 0 | 2 | 0 |

**The count.** The brief's pattern (`PRF-\d+|PRF-Q\d+|SHR-\d+|MAP-\d+` as list items) finds 68 items in the inventory: PRF 42, SHR 20, MAP 6. PLAN §7's 75 (PRF 44, SHR 25, MAP 6) also counts the seven hard-won fixes that carry these prefixes with an H — SHR-H01…H05 and PRF-H01…H02, in Part 4 §6 — which the pattern does not match. Both figures were computed (§6); 75 is right for P6, and this report covers all 75 plus the 6 carried items: 81 rows.

## 2. Defects found while auditing

Each is numbered F1…F28 (F for fault, so they cannot be mistaken for PLAN's decisions D1–D29) so the item rows can point to it. Where a defect makes an item behave wrong it is also that item's reason for `open`.

### Privacy: claims the code does not keep

- **F1 · The server keeps IP addresses and paths, not "transiently for rate limiting only".** The privacy page says the IP address "is used transiently for rate limiting only" (privacy/page.tsx:60, 106). Caddy writes a JSON access log of every request to stdout (Caddyfile:40-43) — the client address and the full URI with its query (`/quran/2/255`, `/word/…`, `/roots/…`, `/notebook?note=v:2:255`, `/auth/verify?token=…`); the API runs uvicorn without `--no-access-log` (services/api/Dockerfile:23), whose default log line is the client address and the request line; `compose.prod.yml` sets no `logging` options, so Docker keeps both until the container is recreated. The rate limiter also keeps every address it has seen as a key of `_hits` until the process restarts (main.py:808, 866-874). Fix: switch the access logs off or strip the address and query (and set a rotation), or say on the page what is logged and for how long.
- **F2 · "Each synced item is stored encrypted" — only its value is.** The page says each synced item is stored encrypted, bound to the account and its place (privacy/page.tsx:35, 81). `accounts.records` keeps `store`, `key` and `updated_at` in plain columns (0019_accounts.py:68-77; sync.py:160-175), and the keys are the content: `b:lemma:{slug}` (a starred word), `n:quran:2:255` (a verse the reader wrote on), `w:{slug}` (word states), `rm:{root}` (a root looked up), `c:{root}` (review cards), `s:{day}:{text}:{device}` (a day of the journal), the Analyser's chosen written forms (lib/store/analyseChoices.ts:8-14, keys of `tk.key`), each with its time. `record_history` likewise, and `lookup_events` holds lemma, root and verse in plain text (0019_accounts.py:98-104; sync.py:268-284). The daily dumps carry all of it. Fix: store an HMAC of the key under the data key and the key itself sealed, or say what is not encrypted.
- **F3 · The journal is opt-in, but every root looked up, with when, syncs without the choice.** The account card says "The day-by-day record of what you looked up is private, so it stays on this device unless you turn this on" (en.json me.syncJournalHelp; AccountPanel.tsx:145). The `personal` store, which always syncs (run.ts:100), carries `rm:{root}` for every root ever looked up with the time it was first met, `ctx` — the last word, root and verse looked up with its time — and `r:quran:{sūra}`, the furthest verse read (adapters.ts:66-72; lib/reader/store.ts:352-363). The privacy page's "What we keep" omits these, and the Analyser's choices, proposal drafts, saved trails, verse links and topics (privacy/page.tsx:34, 80). Fix: sync `rm:`, `ctx` and `cc` only while the journal syncs, and make the list on the page complete.
- **F4 · Backups are kept fifteen days, not fourteen, and the runbook keeps copies with no limit.** The backup loop deletes with `find /backups -name 'accounts-*.sql.gz' -mtime +14 -delete` once a day (compose.prod.yml:111-115); `-mtime +14` matches files at least 15 whole days old, so each dump lives 15 days (15 dumps at a time) and an account deleted just after a dump stays in the backups up to 15 days, while the page says "kept 14 days, so a deleted account leaves them within 14 days" (privacy/page.tsx:49, 95). DEPLOY.md:88 says "Copy the volume off the server too" with no retention for the copies, and its restore command puts back every account deleted since the dump. Fix: `-mtime +13` (or minutes), the same period for off-server copies, and a restore step that deletes again the accounts deleted after the dump.
- **F5 · The account export leaves out four kinds of stored data.** `GET /me/export` returns the account, its devices and the live records (routes_me.py:156-161; sync.py:226-233). It leaves out the replaced versions (`record_history`, kept 30 days and restorable from the Account tab), the shared lookups (`lookup_events`, kept a year), the sign-in identities (`identities`: provider, subject, address) and the tombstones (`deleted` rows: which items were deleted, and when). The privacy page offers "your account's copy" (privacy/page.tsx:54, 100) and PLAN P6.3 says a test enumerates the server tables for export and delete; the only such test is for delete (test_accounts_api.py:254-314). Shared lookups also cannot be seen or removed short of deleting the account: turning sharing off keeps them (accounts.py:297-303 acts on the journal only). (PRF-14, PRF-Q03)
- **F6 · Deleted items stay on the server as tombstones for as long as the account exists.** A deletion is a row with its plain key and time (sync.py:160-175), and `purge()` has no rule for them (accounts.py:321-341); the page's periods do not mention them. They also count towards the 20,000-record cap (F14). Fix: purge tombstones after a stated period, with a full resync for a device whose cursor is older.
- **F7 · The sign-in sheet promises "the newer is kept"; a first sign-in does not do that for records that carry no time of their own.** «ما على هذا الجهاز ينضم إلى حسابك … إن اختلفت نسختان أُخذت الأحدث» (ar.json account.bring). On a first sync, records with no time of their own — word states, settings, links, topics, Analyser choices, furthest verses — go up with time 1 and lose to the account's version whatever their age (engine.ts:10-12, 87; adapters.ts:59-69; DECISIONS:66). Nothing is lost (the loser is kept 30 days), but the sentence is wrong. (HUB-Q07)
- **F8 · Signing in with a second account on a device moves the first account's data into it.** Signing out keeps this device's data and forgets sync's memory (lib/account/store.ts:31-37; actions.ts:91-92), so the next sign-in, by anyone, is a first sync that sends everything on the device — including what the first account synced down: notes, stars, texts, maps — into the new account (engine.ts:10-12; run.ts:22-28). The sign-out card says only that the account keeps everything (en.json me.signOutHelp). Fix: remember which account the device's records came from and ask before merging them into another.
- **F9 · A note's verse travels in a link** (minor). The Profile's Notes tab links verse notes as `/notebook?note=v:2:255` (ProfileScreen.tsx:296), a `force-dynamic` page that reads `searchParams` (notebook/page.tsx:6, 14-16), so following the row sends the verse the reader wrote on to the server in a URL, and into the logs of F1; the page says words from notes travel "never in a link" (privacy/page.tsx:28, 74).

### Sync: correctness and tombstone safety

- **F10 · Pushes for one account are not serialized: a device can miss a change, and a new record can be overwritten by an older one.** `seq` is taken from a sequence at insert time (sync.py:160-175; 0019_accounts.py:67) and a pull returns `seq > since` (sync.py:66-82). If device A's push holds seq 100 uncommitted while device B's push commits 101 and B pulls, B's cursor moves to 101 and A's record 100, committed a moment later, never reaches B until it changes again. And `select … for update` locks only rows that exist (sync.py:113-117): two first pushes of one new key both see none, and the later commit's `on conflict do update` overwrites the other whatever its `updated_at`, with no history row. Fix: lock the account's row (`select … from accounts.users where id = :u for update`) at the start of `push` and `restore`.
- **F11 · A failed IndexedDB read deletes every note on every device.** `idbStorage.getItem` swallows an IndexedDB error and falls back to localStorage, which no longer holds the moved notebook, and returns null (lib/store/idbStorage.ts:22-33); the notebook hydrates empty, `whenHydrated` resolves (run.ts:90), and `plan()` turns every note in the shadow into a tombstone (engine.ts:104-111) that the other devices apply (engine.ts:156-158). The notes come back only one by one from the replaced versions, within 30 days, and a single edit on the emptied device can overwrite its own copy. Fix: let a read error fail hydration and stop that store's sync, and a guard in `plan()` that will not send more than a few deletions, or a large share of a store, in one run without the reader's word.
- **F12 · The maps' and texts' indexes can drop an entry, which sync then deletes everywhere.** `putGraph`, `deleteGraph`, `putText` and `deleteText` read the index, change it and write it back in separate steps (lib/graph/persist.ts:35-46; lib/library/texts.ts:47-59). An autosave or a delete that interleaves with sync writing a document from another device can lose the sync's entry from the index (the last writer wins); `read()` lists documents from the index (adapters.ts:226-260), so a dropped document that had synced becomes a tombstone. (A smaller window: another tab's notebook re-read after a BroadcastChannel message is asynchronous, SyncRunner.tsx:49-53, and a sync starting in that tab before it lands compares an old list.) Fix: update the index in one IndexedDB transaction (idb-keyval `update`) or list documents by key prefix.
- **F13 · A device whose clock runs ahead wins every conflict** (minor): the server takes `updated_at` from the device (sync.py:112, 122) without bounding it by its own time; the losers are kept 30 days.
- **F14 · A full account stops all sync.** At 20,000 records (tombstones included) a push carrying one new record raises 413 for the whole chunk (sync.py:142-143), so edits to existing records in it fail too, and the client retries the same chunk on every run with the status «تعذّرت المزامنة: 413 …». The cap is checked against a count taken once per push (sync.py:97), so one push can pass it by up to 1,999. Fix: refuse per record and report it as too large to sync.
- **F15 · Deleting this device's data can be undone by another tab or by a sync in flight.** `deleteLocalData` neither waits for a running sync nor tells other tabs (lib/localData.ts:64-76): a run finishing between the removal and the reload writes `jadhr-sync` and pulled records back (run.ts:132-133); another open tab only re-reads its stores on the storage event (SyncRunner.tsx:42-46), and zustand's persist keeps the in-memory state when the key is gone (zustand's documented default `merge` lays the stored state over the current one, so nothing stored leaves the current one as it is; read, not run here), so that tab writes everything back on its next change. sessionStorage `jadhr-oidc` (state, PKCE verifier, return path) is not cleared either (actions.ts:57). (PRF-Q03)

### Security

- **F16 · No size limit on account requests, and the per-user rate limit is per address.** A push takes 2,000 records of up to 1 MB each (routes_me.py:129-143; sync.py:33, 110), lookups take 500 events of unbounded strings (routes_me.py:182-188; sync.py:272-283), Caddy sets no `request_body` limit and accounts are free, so one client can send a body of about 2 GB. The contract's 600/min per user (08 §8.1) is 600/min per address (main.py:856-877); sign-in mail is capped at three links per address per 15 minutes but not per sender, so one address can send up to 600 sign-in mails a minute to strangers (accounts.py:159-170) — a risk to the mail domain's reputation.
- **F17 · The sign-in link is spent as soon as the page runs.** `VerifyScreen` posts the token on mount (account/AuthScreens.tsx:45-63); a mail gateway that opens links in a browser spends it and opens a session on its own machine, and the reader sees «انتهت صلاحية هذا الرابط أو استُعمل من قبل». Fix: a "Sign in" button on the verify page. The token also appears in the access log's request line (F1); it is single-use and spent within a second, so that part is low risk.
- **F18 · The session is readable by any script on the page** (a consequence of PLAN decision D3 and law L6, noted, not a bug): the bearer token lives in localStorage `jadhr-auth` (lib/account/store.ts:22-41) for 90 days and the CSP allows inline scripts (apps/web/next.config.ts:16). A shorter session or rotation would bound what an injected script could take.
- **F19 · sessionStorage is used without try/catch** (minor): `startOidc` writes and `finishOidc` removes `jadhr-oidc` outside a guard (actions.ts:57, 70); with storage blocked the start throws, `go()` does not catch it (SignInPanel.tsx:38-44) and both provider buttons stay disabled on «ننقلك إلى …». (SHR-H04)

Checked and sound: sign-in links, sessions and delete confirmations are 32 random bytes stored as SHA-256 hashes (accounts.py:65-70, 176, 199-207; sync.py:236-247); a link works once and only within 15 minutes (accounts.py:220-233), the delete confirmation within 10 (sync.py:243, 255-259); asking for a link never says whether the address has an account (test "a link works once and the answer never tells who has an account"); return paths stay on the site (accounts.py:152-156; signin/page.tsx:18); the verify and provider pages take the token or code out of the address bar and history at once (AuthScreens.tsx:48, 77); the local export leaves out `jadhr-auth`, `jadhr-sync` and `jadhr-device` (lib/localData.ts:32-38) and the account export gives devices only a 12-character prefix of the session hash (accounts.py:254-267); Google and Apple ID tokens are checked against the provider's keys, issuer, audience and expiry, with PKCE and a state checked in the tab (oidc.py:113-145; actions.ts:65-72); the development outbox answers 404 in production (routes_me.py:63-69); the API refuses to start syncing in production without the data key (accounts.py:76-88).

### Copy, Arabic and raw identifiers

- **F20 · Replaced versions are listed by raw ids and English values.** `preview()` falls back to the record key and value when the value has no label, title, text, body or root (AccountPanel.tsx:231-239): a word state reads "Eilom — known", a setting "size — 1.2", a position "p:quran", a journal day "quran" — Latin, in the Arabic UI, in the list the reader restores from (the class of PRF-19).
- **F21 · English error messages in the Arabic UI.** The API's messages are English ("Check the ORCID (0000-0000-0000-0000).", accounts.py:296; "This account holds as many records as it can", sync.py:143; and the rest of routes_me.py and sync.py), shown as they are inside «تعذّر الحفظ: {error}», «تعذّرت المزامنة: {error}» and «تعذّر الحذف: {error}» (AccountPanel.tsx:15, 74, 149, 272; ProfileScreen.tsx:185), as is the browser's "Failed to fetch".
- **F22 · Agreement in «فيبقى»** (minor): ar.json me.tooLarge ends «…، فيبقى على هذا الجهاز» after every plural form, where the dual needs «فيبقيان» and «{n} عناصر» (three to ten) «فتبقى»; the English "{n} items are too large to sync and stay on this device" says they are too large to stay.
- **F23 · The status says "syncing…" when nothing syncs** (minor): with sync idle and `GET /me` failed, `devices` is null and the line falls to «تجري المزامنة…» (ProfileScreen.tsx:179-188).

### Accessibility and phone

- **F24 · The sync line is a live region holding a button** (ProfileScreen.tsx:190-197): each run — every five minutes and three seconds after each edit (SyncRunner.tsx:29-30) — re-announces the status, the last sync time and «زامن الآن».
- **F25 · Deleting the account drops focus**: «احذف حسابي» is replaced by the confirm and cancel buttons (AccountPanel.tsx:289-302), so focus falls to the page; Cancel drops it again.
- **F26 · Buttons with the same name**: every device's «أخرجه» and every version's «استرجعها» (up to 100) have one accessible name each, with no device or item in it (AccountPanel.tsx:173-175, 220-222).
- **F27 · Phone**: «زامن الآن» is 36 px — the `min-h-[36px]` utility beats the 40 px `.btn` rule, which sits in the components layer (ProfileScreen.tsx:195; globals.css:179, 313-324); and the data controls come after the whole list of the open tab (globals.css:4609-4615). (PRF-35)
- **F28 · axe never sees the signed-in Account tab** (choices, devices, replaced versions, delete) or `/auth/verify`; it runs on `/me` and `/me?tab=account` signed out, in both themes (a11y.spec.ts:55-56).

### Stale or inconsistent lines elsewhere (not edited here)

- PLAN.md:255 (P6 status) still lists as "Next" the Profile, the privacy page, lookups opt-in in the browser and the P6.4 exit test; all are committed (b88ccab, 5b9db72, 0f594aa, 4e560ec, 6700ea0). P6.3's "a test enumerates all storage keys and server tables" holds for delete, not for export (F5).
- DEPLOY.md:89 says "the dumps are encrypted with it too"; only record values are — addresses, keys, devices and lookups are plain in the dumps (F2).
- The web hard-codes the link's 15 minutes (account/SignInPanel.tsx:12) and the privacy page every period, while the API reads them from settings (settings.py:42-45); the page's comment says to change them together, but nothing checks it.

### The API contract (08 §8.1, §8.4) against record sync

| Contract | Its purpose | What serves it | Served |
|---|---|---|---|
| `GET /me` | profile, role, counts per Profile tab | `GET /me`: account, role, settings, devices, record total (accounts.py:254-267); tab counts from the synced stores in the browser (ProfileScreen.tsx:131-164) | yes |
| `GET`/`PATCH /me/preferences` | reading preferences on every device | `prefs` and `audio` records, one per choice that differs from the default (adapters.ts:186-209); theme and panel sizes stay on the device (DECISIONS:66) | yes |
| `/me/word-states` | word states | `personal` records `w:{slug}` (adapters.ts:60) | yes |
| `/me/progress/:textSlug` | reading position | `personal` records `p:{text}` (adapters.ts:61) | yes |
| `/me/notes` | notes | `notebook` records and `saved` `n:` records (adapters.ts:27-50, 158-170) | yes |
| `GET /me/journal` | sessions by day | `journal` records per day, text and device, only when turned on, merged by day in the browser (adapters.ts:129-154; lib/reader/store.ts:254-262) | yes, by choice |
| `POST /me/events` | batched lookup events | `POST /me/lookups`, only when turned on, sent with the next sync (run.ts:49-55, 134-141); no `kind`; the time is the server's on arrival; the queue lives in memory and is lost on reload | partly |
| `GET /me/export` | the whole account | live records, account, devices (sync.py:226-233) | partly (F5) |
| `DELETE /me/data` with a token | destructive delete | `POST /me/delete` → a token for 10 minutes → `POST /me/delete/confirm` deletes the account and every row (routes_me.py:164-179; sync.py:236-265) | yes (the whole account) |
| `POST /me/migrate-anon`, `X-Jadhr-Anon` | bring anonymous state into the account | nothing anonymous is on the server; the first sync of each store is the migration (engine.ts:10-12; DECISIONS:66) | yes, with the time-1 rule (F7) |
| `/me/review/due`, `/grade`, `/counts` | spaced repetition | scheduled in the browser (DECISIONS:52); cards sync as `review` records (adapters.ts:172-184) | yes |
| 600/min per user | fair use | 600/min per address (main.py:856-877) | no (F16) |
| error envelope | one error shape | `{error: {code, message, field}}` (main.py:879-897) | yes |
| cursor pagination | paging | `since` → `cursor`, `more` (sync.py:66-82) | yes (own shape; F10) |
| ISO 8601 times | one time format | sync uses epoch milliseconds (sync.py:42-47); `/me` gives ISO times | differs |

§8.5 proposals, §8.6 graphs and §8.7 classroom belong to P7, P8 and P9.

## 3. Open — buildable now

| ID | What is missing | Files |
|---|---|---|
| SHR-H04 | (minor) sessionStorage calls inside try/catch, and `go()` catching a failed start (F19) | lib/account/actions.ts:57, 70; account/SignInPanel.tsx:38-44 |
| PRF-14 | an account export with the replaced versions, shared lookups, identities and tombstones, and a test that enumerates the account schema's tables for the export as the delete test does (F5) | sync.py:226-233; routes_me.py:156-161; test_accounts_api.py |
| PRF-35 | (minor) the data controls within reach on a phone (a link in the rail, or the order identity, data, tabs) and «زامن الآن» at 40 px (F27) | globals.css:4609-4615; profile/ProfileScreen.tsx:195 |
| PRF-Q01 | a true account of what syncs and what the server keeps — logs, plain keys, the roots met and reading place, backup period, tombstones — or code that matches the page (F1–F4, F6) | privacy/page.tsx:22-108; ar.json/en.json me.syncJournalHelp; Caddyfile:40-43; services/api/Dockerfile:23; compose.prod.yml:111-115 |
| PRF-Q03 | the account export of PRF-14; a local delete that waits for a running sync, resets other tabs and clears `jadhr-oidc` (F5, F15) | lib/localData.ts:64-76; account/SyncRunner.tsx:42-53; lib/sync/run.ts:145-191 |
| MAP-02 | pushes serialized per account; a notebook read error that stops sync instead of reading as empty, and a guard against mass deletions; index updates in one transaction (F10–F12) | sync.py:92-177, 191-223; lib/store/idbStorage.ts:22-33; lib/sync/engine.ts:74-114; lib/graph/persist.ts:35-46; lib/library/texts.ts:47-59 |
| HUB-Q07 | (minor) the `bring` sentence saying what a first sign-in does with records that carry no time (F7) | ar.json/en.json account.bring |
| NTB-Q02 | roots met and the reading place synced only with the journal on, or said so; record keys sealed (F2, F3) | lib/sync/adapters.ts:56-73; lib/sync/run.ts:94-100; sync.py:160-175; privacy/page.tsx:34-38, 80-84 |

Defects outside these items, to fix in the same pass: F8 (second account on a device), F9 (note links), F13 (clock), F14 (full account), F16 (request limits), F17 (verify button), F20–F23 (copy), F24–F26 and F28 (accessibility). F18 is the cost of PLAN decision D3 and needs the owner only if a shorter session is wanted.

## 4. Waiting on later phases

| ID | What | Phase |
|---|---|---|
| SHR-H05 | Arabic and English in separate fields of a proposal | P7 |
| PRF-18 | merged and pending n/2 statuses, the row linking to the Review queue | P7 |
| PRF-20 | published graphs (the tab lists local maps today; the first root card's Arabic could be shown now, GraphMeta lacks it) | P8 |
| PRF-Q07 | one account and one data page across the dictionary, hadith and book products, with a section per product in the export | P11 |
| MAP-03 | review decisions, merges, credit lines, changelog, reviewer roles | P7 |
| MAP-04 | the Classroom (lookups are already collected by choice) | P9 |
| MAP-05 | graph publishing; dataset releases, DOIs, API keys and limits | P8, P10 |

## 5. All items

### Shared chrome and storage (SHR)

| ID | status | evidence / notes |
|---|---|---|
| SHR-01 | adapted | The shared header: 52 px, panel background, bottom border, an 18 px rounded square in the root colour linking home (shell/SiteHeader.tsx:14-18); the wordmark is the Arabic name in Amiri 19 px bold rather than "Jadhr" in Plex 14/600 — the product's name is Arabic (DECISIONS:11) |
| SHR-02 | done | `.nav-track`: a pill on `--card-3`, radius 9, `overflow-x: auto`, scrollbar hidden, `min-width: 0` (globals.css:413-425); the actions beside it are `shrink-0` (SiteHeader.tsx:21) |
| SHR-03 | adapted | The design's eleven in its order with Ask added after Read (SHL-32): Read, Ask, Explore, Library, Look up, Concordance, Analyser, Graph, Notebook, Review queue, Classroom, Data (shell/NavLinks.tsx:8-22) |
| SHR-04 | done | No Profile in `NAV_ITEMS` (NavLinks.tsx:8-22), so nothing is active on /me; reached from the avatar (account/AccountButton.tsx:29-36), the hub tile (lib/destinations.ts:28) and the phone menu's secondary links (shell/MobileMenu.tsx:66-68) |
| SHR-05 | done | `aria-current="page"` from `isActive` (NavLinks.tsx:24-26, 48); active: card background, weight 500, 0 1px 2px shadow; inactive `--t2` (globals.css:426-447) |
| SHR-06 | done | `.seg` with `aria-pressed`/`aria-selected` (globals.css:289-299), `.chip` and `.chip.is-on` (249-266), `.dot` (268) |
| SHR-07 | adapted | Tokens instead of constants (globals.css:17-36, dark 52-71); root, word, t3, amber and good are darker than the prototype's to pass axe AA (commit 874e4e8, "axe … and the fixes they found") |
| SHR-08 | adapted | Amiri, IBM Plex Sans with Plex Sans Arabic, Plex Mono (lib/fonts.ts:2-46) and the KFGQPC font for the Quran; labels 11 px uppercase .09em, in Arabic 12 px with no case or letter-spacing, which Arabic script does not take (globals.css:196-207) |
| SHR-09 | done | `:focus-visible` 2 px solid `--ring` at 2 px offset on every element (globals.css:150-154) |
| SHR-10 | done | Every persisted store goes through `safeJSONStorage` (lib/store/safeStorage.ts:21-45) or `idbStorage` (lib/store/idbStorage.ts:20-58), both fail-safe and telling the reader once |
| SHR-11 | adapted | Our own keys, all prefixed `jadhr-`: prefs, personal (word states, positions, sessions, context, proposals, onboarded), saved (stars, verse notes), notebook, review, audio, analyse-choices, auth, theme; maps and texts in IndexedDB; export and delete walk the prefix, not a list (lib/localData.ts:6-30) |
| SHR-12 | bug-fixed | No list to miss: export and delete walk every `jadhr-` key in localStorage and IndexedDB (localData.ts:16-30, 36-76); e2e "your data: the export holds every key the site keeps, every key is the site's, and deleting leaves nothing of the reader" |
| SHR-13 | bug-fixed | The star writes `jadhr-saved`, which Saved, the review queue, the Notebook and the Profile read (DECISIONS:81; ProfileScreen.tsx:137, 268) |
| SHR-14 | n/a | The prototype's loading mechanism; our pages render on the server, and the Profile shows "–" and a pulse until the browser's stores are read (ProfileScreen.tsx:143, 315) |
| SHR-15 | done | The Profile, sign-in and privacy pages use the tokens and the shared theme; axe in light and dark on "the profile", "the profile's account tab, signed out", "the sign-in page", "the privacy page", "the sign-in sheet" (a11y.spec.ts:42-69); the Review queue, Classroom and Data screens carry it as RVQ-81, CLS-46, DAT-54 |
| SHR-16 | done | The Profile is one column under 900 px (globals.css:4609-4615), its controls 40 px and its fields and choices 44 (AccountPanel.tsx:80; globals.css:4720-4726); e2e "signed out: …" checks no sideways scroll on the phone project; other screens: RVQ-81, CLS-46, DAT-54 (the 36 px button is PRF-35) |
| SHR-17 | done | The Profile's status line wraps (`.profile-status` flex-wrap, globals.css:4659-4666) |
| SHR-18 | adapted | Purposes rewritten for this product, the Profile's as "Your contributions, and your data to export" (ar.json/en.json hub.dest.reviewQueue, notebook, classroom, profile, api; audit 10 HUB-10…27) |
| SHR-19 | adapted | No fake account: a real sign-in (account/SignInPanel.tsx); the footer keeps "Export my data instead" → /me and "No tracking, no ads" (SignInPanel.tsx:118-125), without "grant-funded, open licence", a funding claim nobody has made |
| SHR-20 | bug-fixed | Accounts have stable UUIDs (0019_accounts.py:26-36); sync's memory is keyed by the account id (lib/sync/run.ts:22-28); the credited name is one field the reader sets (AccountPanel.tsx:61-106); proposal authorship by id comes with P7 |
| SHR-H01 | done | NavLinks.tsx:28-31; `.nav-track` scrolls (globals.css:413-425) while the actions stay `shrink-0` (SiteHeader.tsx:21) |
| SHR-H02 | done | NavLinks.tsx:48 |
| SHR-H03 | done | One key `jadhr-theme` (lib/site.ts:11), read before paint, light by default (app/[locale]/layout.tsx:41); the Profile follows it; the theme stays on the device (DECISIONS:66) |
| SHR-H04 | open | (minor) sessionStorage in `startOidc` and `finishOidc` outside try/catch (lib/account/actions.ts:57, 70) — F19 |
| SHR-H05 | waiting | P7: a proposal's Arabic and English in separate fields; P6 shows a draft's Arabic label and its text in separate spans (ProfileScreen.tsx:280, 323-330) |

### Profile (PRF)

| ID | status | evidence / notes |
|---|---|---|
| PRF-01 | done | `/me` (me/page.tsx), dynamic, not indexed |
| PRF-02 | done | `?tab=` read on the server (me/page.tsx:15-18) and written without a request (ProfileScreen.tsx:52-56); e2e "signed out: …" opens `/me?tab=journal` |
| PRF-03 | done | Avatar → /me (AccountButton.tsx:32), hub tile (destinations.ts:28), "Export my data instead" → /me (SignInPanel.tsx:119-121), phone menu (MobileMenu.tsx:66-68) |
| PRF-04 | adapted | Amber dot with "saved on this device only", green with "synced • n devices", plus syncing, offline, error, last sync and Sync now (ProfileScreen.tsx:166-200); beside the page title, since the shared header carries no page meta |
| PRF-05 | done | The real number of signed-in devices from `GET /me` (accounts.py:254-267; ProfileScreen.tsx:69, 186-187); e2e "signed in: …" sees «متزامن • جهاز واحد» |
| PRF-06 | done | 64 px avatar in the root colour, empty signed out, the initial signed in; name 17 px/600; affiliation or address; ORCID in mono 11 px; the role (ProfileScreen.tsx:89-129; globals.css:4617-4628) |
| PRF-07 | adapted | The callout (ar.json me.localCallout) with a Sign in button that opens the sheet on this page rather than sending the reader to the hub (ProfileScreen.tsx:102-108) |
| PRF-08 | adapted | Seven counts from the browser: merged (0 until P7, commented), proposal drafts, maps, texts, notes (Notebook and verse notes), saved, review cards (ProfileScreen.tsx:131-164); "Published graphs" is "Maps" since nothing is published before P8 |
| PRF-09 | bug-fixed | As SHR-12 (localData.ts:6-12); e2e "your data: …" |
| PRF-10 | done | Downloads `jadhr-my-data-YYYY-MM-DD.json`: every localStorage key and IndexedDB document under the prefix, the session and sync's memory left out (localData.ts:32-60); signed in, the account's copy is a second button (ProfileScreen.tsx:220-242) |
| PRF-11 | done | `jadhr-texts-….json` with each text in full (ProfileScreen.tsx:214-219); e2e checks the titles |
| PRF-12 | done | One button whose label changes, reverting after 3 s; the second click deletes (ProfileScreen.tsx:206-232, 246-248); signed in, this device leaves the account first (localData.ts:64-69); e2e "your data: …" with a fake clock |
| PRF-13 | bug-fixed | Blob URLs revoked (ProfileScreen.tsx:29; localData.ts:59); "Exported." and "This device's data is deleted." as status (ProfileScreen.tsx:250-254); no undo — the two clicks guard it and, signed in, the account still holds everything |
| PRF-14 | open | Built: `GET /me/export`, delete with a 10-minute token, the first sync as migration, settings and sign-in/out in the Account tab (routes_me.py:156-179; sync.py:226-265; AccountPanel.tsx). Missing: the export's replaced versions, lookups, identities and tombstones, and a test for it (F5) |
| PRF-15 | adapted | Seven tabs: contributions, saved, notes, maps, library, journal, account (lib/profile.ts:2) — PRF-Q06's additions and the account settings 06 §6.7 puts on this page |
| PRF-16 | done | A link card: dot, Arabic in Amiri 20 px RTL at least 70 px, text 13 px truncated, when 11.5 px; hover border `--ring` (ProfileScreen.tsx:318-335; globals.css:4684-4696) |
| PRF-17 | done | Every proposal on this device (all are the reader's), newest first, the kind from messages, " • ", the first 90 characters (ProfileScreen.tsx:277-280) |
| PRF-18 | waiting | P7: merged and pending n/2, the link to the Review queue; today «مسودة على هذا الجهاز • date», an amber dot, the row opening its word (ProfileScreen.tsx:280) |
| PRF-19 | bug-fixed | Every kind through messages (me.kind.edit, sense, error, gloss, morphology) with one separator " • " (ProfileScreen.tsx:280) |
| PRF-20 | waiting | P8 (publishing): the tab lists the reader's local maps, "{title} • n cards", date, form colour, opening the editor (ProfileScreen.tsx:301-304); the first root card's Arabic is not shown (lib/graph/types.ts:45) |
| PRF-21 | adapted | One document format (version 1) and no frames, so the count is the nodes (lib/graph/types.ts:32-43; persist.ts:38); tolerance of another format and frame exclusion come with P8's format |
| PRF-22 | done | Title in Arabic, "n words • n entries in the lexicon", date, sentence colour (ProfileScreen.tsx:305-308) |
| PRF-23 | bug-fixed | `/library/text/{id}` (ProfileScreen.tsx:307); e2e "signed out: …" checks the link |
| PRF-24 | adapted | One row per day and text with devices merged (lib/reader/store.ts:254-262), newest first, up to three roots in Arabic rather than transliterations, the text and its lookups, the day with its weekday, → `/notebook?tab=journal` (ProfileScreen.tsx:309-312) |
| PRF-25 | done | Verbatim in en.json me.empty.contributions, written in ar.json; e2e "signed out: …" checks the Arabic |
| PRF-26 | adapted | "No maps yet — make one from Map." (me.empty.graphs): nothing is published before P8 |
| PRF-27 | done | me.empty.library |
| PRF-28 | done | me.empty.journal, "reading days" since a session is a day per text |
| PRF-29 | done | me.credit under every tab but Account (ProfileScreen.tsx:79) |
| PRF-30 | done | `accounts.users`: display_name, affiliation, ORCID (checked), role, created_at (0019_accounts.py:26-36); the published-graph shape is P8's |
| PRF-31 | bug-fixed | Stable account ids (SHR-20); the credited name is the one the reader sets (AccountPanel.tsx:61-106; me.noPublic) |
| PRF-32 | adapted | The role is shown (ProfileScreen.tsx:125; me.role.*); tab counts come from the synced stores in the browser (ProfileScreen.tsx:131-164), `/me` gives devices and the record total (accounts.py:254-267) |
| PRF-33 | adapted | The newer `updated_at` wins per record and the other is kept 30 days and restorable (sync.py:92-223; AccountPanel.tsx:184-229); on a first sign-in records with no time go up with time 1 so the account's win (engine.ts:10-12; DECISIONS:66); e2e "an edit travels both ways…" |
| PRF-34 | n/a | A capture of the prototype's own session (two graphs published earlier) |
| PRF-35 | open | (minor) A phone layout and dark exist (globals.css:4609-4615; axe light and dark on /me) but the data controls come after the whole tab list, the fault the item names, and «زامن الآن» is 36 px (F27) |
| PRF-Q01 | open | The local reader works fully (e2e "signed out: …") and the status says local or synced, but what syncs is not said honestly: logs, plain keys, the roots met and reading place, the backup period, tombstones (F1–F4, F6) |
| PRF-Q02 | done | Optional accounts; an e-mail link (accounts.py:159-233), Google and Apple when configured (oidc.py); what the device holds joins on sign-in (e2e "what a device holds joins the account on sign-in, and a second device gets all of it…") |
| PRF-Q03 | open | Local export and delete complete by prefix (e2e "your data: …"); server delete by token, every table (test "deleting the account leaves nothing of it in any table"). Missing: the account export (F5); a delete other tabs and a sync in flight cannot undo (F15) |
| PRF-Q04 | done | No public profile, a chosen name, optional affiliation and ORCID (AccountPanel.tsx:61-106; me.noPublic; privacy/page.tsx:36, 82) |
| PRF-Q05 | done | No points, badges or scores anywhere on the page; the credit line (me.credit) |
| PRF-Q06 | done | Arabic UI with Saved, Notes, Contributions and Journal among the tabs (lib/profile.ts:2; ar.json me.tab.*) |
| PRF-Q07 | waiting | P11: one account across the dictionary, hadith and book products, with a section per product in the export |
| PRF-H01 | done | As PRF-12 (ProfileScreen.tsx:206-232) |
| PRF-H02 | adapted | As PRF-21 |

### Accounts versus local-first (MAP)

| ID | status | evidence / notes |
|---|---|---|
| MAP-01 | done | The Notebook and the Profile work with no account (e2e "signed out: …"; notebook.spec.ts, where no test signs in); the Data & API screens are DAT, P10 |
| MAP-02 | open | Built as record sync rather than `X-Jadhr-Anon` and `/me/migrate-anon` — nothing anonymous is on the server (DECISIONS:66) — with the journal by choice and 30-day copies; built wrong in three places: F10, F11, F12 |
| MAP-03 | waiting | P7; proposal drafts stay on the device and sync (adapters.ts:62) |
| MAP-04 | waiting | P9; lookups are collected only by choice (run.ts:49-55; sync.py:268-284) |
| MAP-05 | waiting | P8 (graph publishing), P10 (releases, DOIs, API keys and limits) |
| MAP-06 | adapted | PLAN §6–7: the Notebook local-first in P5 before accounts, accounts and the Profile in P6, proposals P7, the Classroom P9, Data & API P10 |

### Carried from audit 10

| ID | status | evidence / notes |
|---|---|---|
| HUB-26 | done | The tile opens /me with no "being built" mark (lib/destinations.ts:28), purpose «مساهماتك، وتصدير بياناتك» |
| HUB-33 | adapted | An e-mail link, then Google and Apple only when configured, one per row at equal width (SignInPanel.tsx:68-114); no ORCID or Institution button — PLAN decision D3 and DECISIONS:68 |
| HUB-Q07 | open | (minor) Arabic copy, no scholar-only buttons, the local-first promise and the export stay (ar.json account.*), but the `bring` sentence promises "the newer is kept" (F7) |
| NTB-53 | adapted | The journal syncs as one record per day, text and device, merged by day in the browser (adapters.ts:129-154; lib/reader/store.ts:252-262; NotebookScreen.tsx:479-480); a count of lookups, never minutes (store.ts:250-252) |
| NTB-Q02 | open | Off until turned on (AccountPanel.tsx:108-154; run.ts:94-100), values encrypted (sync.py:160-175), removed with its history when turned off (accounts.py:297-303), said in the product (me.syncJournalHelp); but roots met and the reading place sync without the choice and the keys are plain (F2, F3) |
| SHL-21 | done | Signed out, Sign in opens the sheet; signed in, an avatar in the root colour with the initial, «حسابي: name» as title and label, → /me, with a dot when sync is offline or failing (AccountButton.tsx:20-47; globals.css:4268-4296); e2e signs in and finds the «حسابي:» link |

## 6. How the counts were checked

The script below reads the inventory and this file. It takes the in-scope IDs from the inventory's own bullet lines (with and without the hard-won fixes) plus the six carried IDs, which must exist as inventory bullets; it fails unless every in-scope ID has exactly one row in §5 and no row is outside the scope, every status is one of the six, the counts it computes per prefix and per section equal both tables of §1 (items and every status column, totals included) and the status table at the top of §1, and the IDs in §3 and §4 are exactly the `open` and `waiting` rows, each waiting row naming a phase. It prints `P6-COVERAGE-COUNTS-VERIFIED` only when every check passes; failures print `MISMATCH` lines and exit 1.

```python
import re, sys
from collections import Counter

STAT = ["done", "adapted", "bug-fixed", "n/a", "open", "waiting"]
CARRIED = ["HUB-26", "HUB-33", "HUB-Q07", "NTB-53", "NTB-Q02", "SHL-21"]
ID = r"[A-Z]{3}-[A-Z]?\d+"

def section(i):
    if i in CARRIED: return "Carried from audit 10"
    p, rest = i.split("-")
    if p == "SHR": return "SHR-H01…H05" if rest.startswith("H") else "SHR-01…20"
    if p == "MAP": return "MAP-01…06"
    if rest.startswith("Q"): return "PRF-Q01…Q07"
    if rest.startswith("H"): return "PRF-H01…H02"
    n = int(rest)
    return "PRF-01…08" if n <= 8 else "PRF-09…14" if n <= 14 else "PRF-15…35"

def prefix(i): return "Carried" if i in CARRIED else i.split("-")[0]

inv_path, rep_path = sys.argv[1], sys.argv[2]
inv = open(inv_path, encoding="utf-8").read().splitlines()
rep = open(rep_path, encoding="utf-8").read()
bad = []
brief = [m.group(1) for l in inv if (m := re.match(r"^- (PRF-\d+|PRF-Q\d+|SHR-\d+|MAP-\d+)\b", l))]
full = [m.group(1) for l in inv if (m := re.match(r"^- (PRF-[QH]?\d+|SHR-H?\d+|MAP-\d+)\b", l))]
bullets = {m.group(1) for l in inv if (m := re.match(rf"^- ({ID})\b", l))}
for c in CARRIED:
    if c not in bullets: bad.append(f"MISMATCH carried {c} is not an inventory bullet")
scope = full + CARRIED
print(f"inventory: brief pattern {len(brief)} {dict(Counter(x.split('-')[0] for x in brief))}; with hard-won fixes {len(full)}; in scope with carried {len(scope)}")
if len(set(scope)) != len(scope): bad.append("MISMATCH duplicate IDs in the inventory scope")

parts = re.split(r"^## ", rep, flags=re.M)
sec = {p.split(".")[0]: p for p in parts if re.match(r"\d\.", p)}
rows = re.findall(rf"^\| ({ID}) \| ([a-z/-]+) \|", sec["5"], flags=re.M)
ids = [r[0] for r in rows]
status = dict(rows)
for i, n in Counter(ids).items():
    if n > 1: bad.append(f"MISMATCH {i} has {n} rows")
for i in set(scope) - set(ids): bad.append(f"MISMATCH {i} has no row")
for i in set(ids) - set(scope): bad.append(f"MISMATCH {i} is not in scope")
for i, s in rows:
    if s not in STAT: bad.append(f"MISMATCH {i} has unknown status {s}")
print(f"report: {len(ids)} rows in §5")

def tally(key):
    t = {}
    for i, s in rows: t.setdefault(key(i), Counter())[s] += 1
    return t

def check_table(t, cols_start):
    for label, c in t.items():
        line = re.search(rf"^\| {re.escape(label)} \|(.*)$", sec["1"], flags=re.M)
        if not line: bad.append(f"MISMATCH no §1 row for {label}"); continue
        cells = [x.strip().strip("*") for x in line.group(1).split("|")][cols_start:cols_start + 7]
        want = [str(sum(c.values()))] + [str(c[s]) for s in STAT]
        if cells != want: bad.append(f"MISMATCH §1 {label}: table {cells} computed {want}")

by_prefix = tally(prefix)
by_prefix["Total"] = sum(by_prefix.values(), Counter())
check_table(by_prefix, 0)
check_table(tally(section), 1)
total = by_prefix["Total"]
for s in STAT:
    m = re.search(rf"^\| {re.escape(s)} \| (\d+) \|", sec["1"], flags=re.M)
    if not m or int(m.group(1)) != total[s]: bad.append(f"MISMATCH status table {s}: {m and m.group(1)} computed {total[s]}")
m = re.search(r"^\| \*\*total\*\* \| \*\*(\d+)\*\* \|", sec["1"], flags=re.M)
if not m or int(m.group(1)) != len(ids): bad.append("MISMATCH status table total")

for num, s in (("3", "open"), ("4", "waiting")):
    listed = re.findall(rf"^\| ({ID}) \|(.*)$", sec[num], flags=re.M)
    if {i for i, _ in listed} != {i for i, x in rows if x == s} or len(listed) != total[s]:
        bad.append(f"MISMATCH §{num} lists {sorted(i for i, _ in listed)} but {s} rows are {sorted(i for i, x in rows if x == s)}")
    if s == "waiting":
        for i, rest in listed:
            if not re.search(r"\| P\d+", rest): bad.append(f"MISMATCH waiting {i} names no phase")

if bad:
    print("\n".join(bad)); sys.exit(1)
print(f"counts {dict(total)}")
print("P6-COVERAGE-COUNTS-VERIFIED")
```

Run on this file (`python3 check_p6.py docs/research/05-design-inventory.md docs/research/11-accounts-profile-coverage.md`, exit 0):

```
inventory: brief pattern 68 {'SHR': 20, 'PRF': 42, 'MAP': 6}; with hard-won fixes 75; in scope with carried 81
report: 81 rows in §5
counts {'adapted': 20, 'done': 36, 'bug-fixed': 8, 'n/a': 2, 'open': 8, 'waiting': 7}
P6-COVERAGE-COUNTS-VERIFIED
exit=0
```

Run on a copy with one status changed (PRF-02 `done` → `open`, one exact edit asserted to match once), exit 1:

```
inventory: brief pattern 68 {'SHR': 20, 'PRF': 42, 'MAP': 6}; with hard-won fixes 75; in scope with carried 81
report: 81 rows in §5
MISMATCH §1 PRF: table ['44', '21', '10', '5', '1', '4', '3'] computed ['44', '20', '10', '5', '1', '5', '3']
MISMATCH §1 Total: table ['81', '36', '20', '8', '2', '8', '7'] computed ['81', '35', '20', '8', '2', '9', '7']
MISMATCH §1 PRF-01…08: table ['8', '5', '3', '0', '0', '0', '0'] computed ['8', '4', '3', '0', '0', '1', '0']
MISMATCH status table done: 36 computed 35
MISMATCH status table open: 8 computed 9
MISMATCH §3 lists ['HUB-Q07', 'MAP-02', 'NTB-Q02', 'PRF-14', 'PRF-35', 'PRF-Q01', 'PRF-Q03', 'SHR-H04'] but open rows are ['HUB-Q07', 'MAP-02', 'NTB-Q02', 'PRF-02', 'PRF-14', 'PRF-35', 'PRF-Q01', 'PRF-Q03', 'SHR-H04']
exit=1
```

Run on a copy with the MAP-06 row removed, exit 1:

```
inventory: brief pattern 68 {'SHR': 20, 'PRF': 42, 'MAP': 6}; with hard-won fixes 75; in scope with carried 81
report: 80 rows in §5
MISMATCH MAP-06 has no row
MISMATCH §1 MAP: table ['6', '1', '1', '0', '0', '1', '3'] computed ['5', '1', '0', '0', '0', '1', '3']
MISMATCH §1 Total: table ['81', '36', '20', '8', '2', '8', '7'] computed ['80', '36', '19', '8', '2', '8', '7']
MISMATCH §1 MAP-01…06: table ['6', '1', '1', '0', '0', '1', '3'] computed ['5', '1', '0', '0', '0', '1', '3']
MISMATCH status table adapted: 20 computed 19
MISMATCH status table total
exit=1
```

Both copies were deleted after the runs.
