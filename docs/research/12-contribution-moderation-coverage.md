# 12 · Contribution and moderation coverage — P7 against the design inventory and the code

Audited 2026-10-03 against commit `7caa827` (branch `build/vision`, working tree clean before this file was written; the P7 work is commits 1f40355, de6d63b, ca0b166, 15fb9b3, 47730fd, 40249ab, 3322993, dc11224 and 210c0e9, with P6.5 on top). Scope: phase P7 "Contribution and moderation" of `docs/PLAN.md` (§6 P7 and its build order, §7 "P7 | RVQ | 101") against `docs/research/05-design-inventory.md` — Part 4 §1 Review Queue (RVQ-01…81, RVQ-Q01…Q11), the Review Queue's hard-won fixes in Part 4 §6 (RVQ-H01…H09), Part 1 §23 "Suggest an edit, propose a sense, report an error" (RDR-311…325) — plus the three items audit 11 left waiting on P7: SHR-H05, PRF-18, MAP-03. PLAN decision D4 and the DECISIONS entries on contributions are checked in §2's last table.

**Method.** Read in full: inventory Part 1 §23, Part 4 §0, §1, §6 and §7; PLAN §3.2, §4, §6 P7, §7 and §8; DECISIONS; audit 11 (the model for this report) and audit 08's rows for RDR-123…135 and RDR-311…325; `alembic/versions/0020_contributions.py`; `contrib.py`, `routes_contrib.py`, `roles.py`; the parts of `accounts.py` they use (`tx`, `q`, `q1`, `current_user`, `optional_user`, the per-account limit, `update_me`), of `main.py` (the rate limiter, body limits, error handlers, routers) and of `sync.py` (`export`, `delete_account`); `tests/test_contrib_api.py`, and the export and delete tests of `test_accounts_api.py`; `lib/contrib.ts`; every file in `components/contrib/` (`ReviewQueue.tsx`, `ProposalForm.tsx`, `WordContributions.tsx`, `Changelog.tsx`); `review/page.tsx`, `data/page.tsx`; `reader5/sections/Meanings.tsx`, the SuggestDialog of `reader5/Overlays.tsx`, `ui/Dialog.tsx`, the proposal type and `addProposal` in `lib/reader/store.ts`; `ProposeFromNote` in `notebook/NotebookScreen.tsx`; the Profile's counts and contributions tab in `profile/ProfileScreen.tsx`; `account/SyncRunner.tsx` (the drafts' send), `lib/account/store.ts` (`authFetch`), `lib/account/errors.ts`, `lib/client.ts`, `shell/Providers.tsx`; `lib/destinations.ts`, `shell/NavLinks.tsx`, `shell/SiteFooter.tsx`; the queue, diff, merged-line and proposal sections of `globals.css`; the account section of `privacy/page.tsx`; the namespaces `contrib`, `wordContrib` and `changelog` of `ar.json` and `en.json`, with the `rd` keys the form uses and `me.noPublic`/`me.displayName`; e2e `journey-d.spec.ts`, the page and state lists of `a11y.spec.ts`, and a grep of every spec for `/review` and proposals; the installed `@tanstack/query-core` 5.104.1 (`fetchQuery`, `defaultQueryOptions`). Run: `git rev-parse --short HEAD`, the count script of §6, and read-only GET requests to the project's API on 127.0.0.1:8000 — `/api/v1/words/{ilm,rHm,ktb,qwl,Allah}` (every one `senses: []`), `/api/v1/proposals/not-a-uuid` and `/api/v1/proposals?filter=open&before=garbage` (both 500), `/api/v1/proposals?filter=open` (counts), `?filter=mine` (401), `/api/v1/changelog` (`Cache-Control: no-cache`, 0 entries). No browser, no test suite, no screenshot: every interface defect below was found by reading the code and none was reproduced on screen; the phone and dark claims rest on the CSS and the e2e named, not on screenshots taken for this audit.

**Status rules.** `done` — built as the item says, or better. `adapted` — built differently on purpose, with the reason named (a DECISIONS entry, a PLAN line, a code comment, a Quran note or a plain reason in the row). `bug-fixed` — a prototype defect the inventory flags that our code does not have. `n/a` — a prototype artefact with nothing to build. `open` — buildable now and not built, or built with a fault that makes the item behave wrong; the row names what is missing. `waiting` — needs a later phase, named.

**Paths.** `contrib/`, `reader5/`, `profile/`, `notebook/`, `account/`, `shell/`, `ui/` are in `apps/web/src/components/`; `lib/…` is `apps/web/src/lib/…`; `review/page.tsx`, `data/page.tsx`, `privacy/page.tsx` are under `apps/web/src/app/[locale]/(site)/`; `globals.css` is `apps/web/src/app/globals.css`; `ar.json`/`en.json` are `apps/web/src/messages/` (cited by key); `contrib.py`, `routes_contrib.py`, `roles.py`, `accounts.py`, `sync.py`, `main.py` are in `services/api/src/jadhr_api/`; `0020` is `services/api/alembic/versions/0020_contributions.py`; `test_contrib_api.py` and `test_accounts_api.py` are in `services/api/tests/`; e2e specs in `apps/web/e2e/`; `DECISIONS:n` and `PLAN.md:n` are line numbers in `docs/`. A file named without a folder after its first mention is the same file.

## 1. Summary

| Status | Items |
|---|---|
| done | 44 |
| adapted | 30 |
| bug-fixed | 8 |
| n/a | 9 |
| open | 26 |
| waiting | 2 |
| **total** | **119** |

Closed (done + adapted + bug-fixed + n/a): 91 of 119. Open: 26, all buildable now (§3). The moderation core holds — no self-approve and no double-approve in the API and the database, two distinct approvals with the board's to merge, decisions serialized on the proposal's row, merges shown beside their source and never over it, the chain from the Reader to the changelog and the Profile proven by journey D. What fails is around it: the queue's own state (a note typed for one proposal is sent with another; after a decision the queue reads its own stale cache, so the selection does not move on and nothing is re-read on focus), a revision that can never satisfy the source rule it was sent back for, reports and blocks that reach no one, a revert that leaves the proposal "merged", credit names frozen at merge time, and a privacy page that says names appear only on merged contributions while the queue shows them on every proposal. Waiting: 2, on P3 and P11 (§4). Thirty defects were found (§2); nineteen are the reasons for open items, the other eleven are listed after §3's table.

| Prefix | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|
| RVQ | 101 | 38 | 23 | 7 | 9 | 22 | 2 |
| RDR | 15 | 5 | 7 | 1 | 0 | 2 | 0 |
| Carried | 3 | 1 | 0 | 0 | 0 | 2 | 0 |
| Total | 119 | 44 | 30 | 8 | 9 | 26 | 2 |

| Group | Inventory section | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|---|
| RVQ-01…03 | Part 4 §1.1 Route, entry, params | 3 | 2 | 1 | 0 | 0 | 0 | 0 |
| RVQ-04…06 | §1.2 Header | 3 | 1 | 2 | 0 | 0 | 0 | 0 |
| RVQ-07…13 | §1.3 Filter semantics | 7 | 3 | 1 | 1 | 0 | 2 | 0 |
| RVQ-14…22 | §1.4 List column | 9 | 5 | 0 | 0 | 0 | 4 | 0 |
| RVQ-23…37 | §1.5 Detail pane | 15 | 11 | 3 | 0 | 0 | 1 | 0 |
| RVQ-38…48 | §1.6 Rules: the moderation logic | 11 | 4 | 2 | 2 | 0 | 3 | 0 |
| RVQ-49…61 | §1.7 Proposal kinds, producers, consumers | 13 | 3 | 8 | 0 | 0 | 1 | 1 |
| RVQ-62…69 | §1.8 Data shape, seed, persistence | 8 | 0 | 1 | 0 | 7 | 0 | 0 |
| RVQ-70…81 | §1.9 Parity gaps and defects | 12 | 2 | 3 | 4 | 0 | 3 | 0 |
| RVQ-Q01…Q11 | §1.10 Quran adaptation notes | 11 | 4 | 1 | 0 | 0 | 5 | 1 |
| RVQ-H01…H09 | Part 4 §6 Hard-won fixes (Review Queue) | 9 | 3 | 1 | 0 | 2 | 3 | 0 |
| RDR-311…325 | Part 1 §23 Suggest an edit, propose a sense, report an error | 15 | 5 | 7 | 1 | 0 | 2 | 0 |
| Carried from audit 11 | SHR-H05, PRF-18, MAP-03 | 3 | 1 | 0 | 0 | 0 | 2 | 0 |

**The count.** PLAN §7 gives P7 "RVQ 101". The inventory's own bullet lines give the same: 101 RVQ bullets (81 in §1.1–§1.9, 11 Quran notes in §1.10, 9 hard-won fixes in Part 4 §6), all inside Part 4. The suggest flows the plan's P7 heading names ("suggest flows RDR §23") are the 15 bold RDR bullets of Part 1 §23, RDR-311…325. With the three items audit 11 carried, 119 rows. The script in §6 computes all of this from the inventory and fails on any difference.

## 2. Defects found while auditing

Each is numbered F1…F30 (F for fault, so they cannot be mistaken for PLAN's decisions D1–D29 or audit 11's F1–F28, which are a different list) so the item rows can point to it. Where a defect makes an item behave wrong it is also that item's reason for `open`.

### Moderation and the queue's state

- **F1 · A note typed for one proposal is sent with another.** `Detail` is rendered without a key (contrib/ReviewQueue.tsx:116) and keeps the reviewer's note in its own state (136), which is cleared only after a decision (160). Clicking another row (93) or switching to a filter whose list is cached re-renders the same instance with a new `id`, so the note typed for proposal A is still in the box under proposal B and is sent with B's decision — the exact fault RVQ-H07 exists to prevent. The same holds for an error message (137), the revert note (311), and the revise form (356-358): between two proposals in "changes requested" whose details are cached (no skeleton in between, 140), the form still holds A's wording and rationale, and "Send it back for review" sends them as B's revision. Fix: `key={current}` on `Detail` (and so on its children). (RVQ-12, RVQ-18, RVQ-H07)
- **F2 · After a decision the queue reads its own stale cache, and nothing is re-read on focus.** The app's QueryClient makes every query fresh for an hour and never refetches on focus (shell/Providers.tsx:14); the queue (ReviewQueue.tsx:30) and a proposal's detail (135) do not override either. `decided()` asks `qc.fetchQuery` for the filter's list before invalidating it (49-51); `fetchQuery` applies the default `staleTime` and returns the cached list (query-core 5.104.1 `queryClient.js:386-390, 604-611`), which still holds the item just decided, so `setSelected(p.id)` keeps it (52). When the background refetch drops it, `current` falls back to the list's first row, or to nothing when the filter is empty (33), so the selection never moves to the next item, an emptied filter never switches to Merged or Declined (RVQ-45), and a reviewer who arrived by a link (`?id=`) stays on the settled proposal. A proposal sent from the Reader is not added to the queue or the reader's "What you proposed" (ProposalForm.tsx:65-71 invalidates nothing); a decision or merge made elsewhere is not seen until the page is reloaded or an hour passes in the queue, a minute or thirty seconds in the reader (WordContributions.tsx:15, 118) — RVQ-80's fault, kept. Fix: `staleTime: 0` (or invalidate first) in `decided()`, `staleTime` of a few seconds and `refetchOnWindowFocus` on the queue, the proposal and the reader's contribution reads, and invalidation of `["queue"]` and `["my-proposals"]` after sending. (RVQ-44, RVQ-45, RVQ-80, RVQ-H04, RVQ-H09, RDR-324)
- **F3 · A meaning sent back for a source can never be approved.** Approval needs a structured source for an edit, a sense or a gloss (contrib.py:25, 391-392), and `structured()` never counts `other` (81-85). The revise form keeps the old sources and can only add one of kind `other` (ReviewQueue.tsx:365, 374); it has no lexicon, verse or grammar field. So the commonest request — "cite a source" on a sense sent without one, which the proposal form allows (ProposalForm.tsx:52, 160) — is answered with a source that does not count, and the proposal can be declined, sent back again or withdrawn, never approved. The API test revises with `{"work": "lisan"}` (test_contrib_api.py:236-245), which no screen can send. Fix: the proposal form's source fields in the revise form. (RVQ-42)
- **F4 · Reports reach no one, and blocking exists only in SQL.** `report()` inserts a row (contrib.py:564-578) and nothing anywhere reads `contributions.reports` or sets `resolved_at` (0020:122-130; a grep of the API finds only the insert); no endpoint, screen or command sets `accounts.users.blocked_at` (0020:30; `roles.py` grants roles only; the test blocks by SQL, test_contrib_api.py:284-289). Yet the reader is told «وصل البلاغ إلى المحرّرين» / "The editors have your report." (contrib.reported). A blocked account can still report, since `report()` skips `_check_active` (contrib.py:564-578 against 140-142), and the API lets a proposer report their own proposal (the screen hides it, 361). RVQ-74's abuse handling and PLAN P7.1a's "reports and blocks" are a table and a column. (RVQ-74)
- **F5 · A reverted merge stays "merged".** `revert()` marks the merge and writes the changelog but leaves `proposals.status = 'merged'` (contrib.py:581-601), so the item stays under the Merged filter and in its count (212-218, 279-283), the Profile counts it among «مساهمات مدموجة» and labels its row «اعتُمدت» (profile/ProfileScreen.tsx:156, 388-389, 409), and it counts toward the ten merges that earn the reviewer role (contrib.py:499-509). Only the detail's banner says it was reverted (ReviewQueue.tsx:319). (RVQ-09, PRF-18)
- **F6 · The queue and the changelog show only their newest 50 and 100.** The API pages the queue (`before`, `more`, contrib.py:265-295; routes_contrib.py:56) but the screen never passes `before` and ignores `more` (ReviewQueue.tsx:30; lib/contrib.ts:72), so once a filter holds more than 50, the oldest open proposals — the ones waiting longest — can be reached only by a link. The changelog takes 100 with no paging at all (routes_contrib.py:112; contrib.py:641-664; Changelog.tsx:18) while its lead says «كل ما اعتمده المحرّرون … وكل ما ردّوه»; `/me/proposals` stops at 500 (contrib.py:687), which the Profile's counts inherit.
- **F7 · The "before" of most kinds is whatever the browser sent.** Only an edit's and a gloss's current text are read from the dataset; for a morphology correction, an error report, a sense, an attestation and an entry the server stores the body's `current_text` (contrib.py:152). The queue shows it as the current value in the diff (ReviewQueue.tsx:204-211) and, once merged, it is struck through on the word as the value corrected (WordContributions.tsx:96-100) and in the changelog (Changelog.tsx:45). Our own form sends the dataset's value, so this needs a hand-made request — but then a reviewer reads a false "before". A morphology "before" is also the label in the proposer's interface language (reader5/sections/Meanings.tsx:158-170). Fix: compute it on the server for every kind that has one.
- **F8 · Revert and withdraw are one click and final** (minor): neither asks first (ReviewQueue.tsx:267-271, 321-335), a reverted merge cannot be merged again (the proposal stays settled and `merges.proposal_id` is unique, 0020:95), and a withdrawn proposal cannot come back (contrib.py:548-561).

### Sources and the product laws

- **F9 · A lexicon with no entry or page counts as a source** (minor). `structured()` accepts any lexicon or verse whatever its reference (contrib.py:81-85), and the form's warning goes away as soon as a lexicon chip is on (ProposalForm.tsx:51, 160); its one entry-or-page box is shared by every lexicon chosen (155). RVQ-Q05 asks for "lexicon plus entry or page, or a grammar reference". (RVQ-Q05)
- **F10 · Error reports and attestations need no source, and an attestation need not name a verse** (not sure this is a fault; it is a policy question for the board): only edit, sense and gloss need one (contrib.py:25); an accepted error report, attestation or entry is shown on the word as an editors' note with whatever text it carries (WordContributions.tsx:81-109), so a meaning written as an "error report" reaches readers through two approvals without any source, which law L2 does not foresee. An attestation's place is not checked against the dataset (contrib.py:123-137 checks gloss and morphology places only).
- **F11 · The changelog crosses out the source's own words** (minor, presentation): every entry prints `previous_text` struck through (Changelog.tsx:45) — for a gloss that is the corpus gloss, which the Reader keeps whole beside the merged wording (reader5/sections/Meanings.tsx:117-123). A crossed-out source reads as replaced, against DECISIONS:119 ("never over it"). The owner may accept it as a diff convention; the Reader's own rule says otherwise.
- **F12 · Merged senses are numbered from 01 again.** A merged sense takes `max(content.senses.ordinal) + 1` (contrib.py:443-458); no lemma has a sense list (no `senses.jsonl` in `data/build/2026.10.0`, though `loader.py:67` loads one; `GET /api/v1/words/ilm` and four others answer `senses: []`), so the first merged sense is 01, shown under its own heading (WordContributions.tsx:57-79) a few lines below the sourced lines numbered 01…N (reader5/sections/Meanings.tsx:111). P7.3 and DECISIONS:119 say "numbered after the sourced ones". Two board approvals of two senses of one lemma at the same moment can also take the same ordinal: nothing locks the lemma and nothing in `merges` is unique on it (0020:93-112). The API test checks only `>= 1` (test_contrib_api.py:252). (RVQ-60)
- **F13 · An error report splices the English gloss into the headword's text** (minor): its current text is `` `${w.ar.full} — ${w.gloss_en}` `` (reader5/sections/Meanings.tsx:152), and a proposal has one wording field (0020:42), so Arabic and English are not kept apart as SHR-H05 asks. (SHR-H05)

### Privacy and credit

- **F14 · Credit names are frozen when a contribution merges.** `_merge` copies the proposer's and the reviewers' display names into the merge (contrib.py:438-442, 476-488) and the Reader, the changelog and every credit line read the copies (619-638); `update_me` never touches them (accounts.py:341-362). A reader who clears their name to withdraw it from public view stays named on everything merged — only deleting the account removes it (722-741) — and one who sets a name after a merge stays «مساهم», although the Account tab calls the field «الاسم الذي تُنسب إليه مساهماتك» (me.displayName). The queue meanwhile joins the live name (204-207), so the queue and the Reader name one contribution differently. RVQ-Q09 asks for names only with consent. (RVQ-Q09)
- **F15 · The privacy page and the Account tab say a name appears only on merged contributions; the account export leaves the contributions out.** «لا يظهر اسمك إلا على المساهمات التي تُدمج» / "your name appears only on contributions merged into the lexicon" (privacy/page.tsx:39, 88) and me.noPublic say the same, but the queue is public (DECISIONS:121; routes_contrib.py:51-63) and shows the proposer's chosen name on every proposal, open, declined or withdrawn (contrib.py:204-207, 258), and each reviewer's name on every decision (313-343). The page says the account's copy "holds everything the server keeps for you" (58, 107), but `GET /me/export` returns nothing of `contributions` — proposals, decisions, reports, role grants (sync.py:337-381) — and the test that "every table is accounted for" lists the `accounts` schema only (test_accounts_api.py:456-497). (RVQ-Q09)
- **F16 · Names in the public queue are not checked.** A display name is trimmed and cut to 120 characters, nothing more (accounts.py:343-346): a member can be called «هيئة التحرير» or "editorial board" and be credited as such (WordContributions.tsx:27-32; ReviewQueue.tsx:103, 181, 197, 282), and a name carrying a right-to-left override (U+202E) reverses the rest of its line, since names are interpolated into one text run with no isolation (`<bdi>` or `unicode-bidi: isolate`). The same goes for a proposal's text and rationale inside their lines.

### The form and drafts

- **F17 · A draft the queue refuses stays "being sent" for ever.** `sendDrafts()` keeps a refused draft and records nothing (lib/contrib.ts:100-120), although its comment says it "stays, with why" (98); the Reader then labels it «يُرسل إلى المراجعة الآن» indefinitely (WordContributions.tsx:135), and it is sent again, and refused again, on every page load while signed in (account/SyncRunner.tsx:83-92). A draft whose sense left the dataset, whose wording equals the current one or whose source is refused (contrib.py:88-137, 154-156, 60-78) never leaves this state. (RVQ-Q02)
- **F18 · A verse typed in Arabic-Indic digits disables the form without a word.** The verse source is checked with `/^\d{1,3}:\d{1,3}$/` (ProposalForm.tsx:21), and JavaScript's `\d` is ASCII only, so «٢:٢٥٥» — what an Arabic keyboard types — makes `valid` false (52) and marks the field invalid with no message (157); the Arabic placeholder shows Latin digits («مثل 2:255», contrib.versePlaceholder). DECISIONS:42 says every reference parser accepts both; the server's Python `\d` does (contrib.py:46). (RDR-318)
- **F19 · English error messages and raw exceptions in the Arabic interface.** The queue and the form show the API's English `detail` ("A source is needed before this can be approved.", "You have already approved this proposal.", "The wording is the same as the current one.", contrib.py:142-400) and `String(e)` for anything else — "TypeError: Failed to fetch" offline, a bare "Error" when the session has ended (`SignedOut` carries no message, lib/account/store.ts:43) (ReviewQueue.tsx:163, 330, 368; ProposalForm.tsx:70) — the fault audit 11's F21 found and P6.5 fixed for the Account tab with `lib/account/errors.ts`, not reused here. «أرسلت ما يكفي من المقترحات لليوم» is said for any 429, including the hundred-open cap and the per-address limit (ProposalForm.tsx:70; contrib.py:177-178). Reporting has no error path at all (ReviewQueue.tsx:404). (RVQ-Q08)

### Copy, Arabic and raw identifiers

- **F20 · The diff lines take their direction from a hidden label, not the text.** Each line is `dir="auto"` and begins with the screen-reader label «قبل:»/«بعد:» or "before:"/"after:" (ReviewQueue.tsx:205-218), so the first strong character is always the interface language's: in Arabic an English gloss («(the) knowledge», a trailing full stop) is laid out right to left and its brackets and punctuation jump; in English an Arabic sense is laid out left to right. The form's "Current" box, the merged lines and the changelog put `dir="auto"` on the text alone and are right. (RVQ-Q08)
- **F21 · The list's amber warning can never show** (minor): a row turns amber only when `!p.has_source && !p.why` (ReviewQueue.tsx:102), and a rationale is required by the API and the database (routes_contrib.py:39; 0020:43). A sense that cannot be approved for want of a source looks like any other row. (RVQ-16)
- **F22 · "Approve (3 of 2)"** (minor): once two reviewers have approved, a third who is not on the board is still offered Approve (contrib.py:354-356, `live` includes `approved`), labelled «وافق (٣ من ٢)» (ReviewQueue.tsx:150-151, 254); the approval changes nothing. (RVQ-32)
- **F23 · The empty queue points at a button no word has** (minor): «تصل المقترحات من «اقترح تعديلًا» على أي معنى في القارئ» and «جرّب «اقترح تعديلًا» على معنى في القارئ» (contrib.empty.open, contrib.empty.mine), but "Suggest an edit" is drawn only on a sense list (reader5/sections/Meanings.tsx:85-101), which no lemma has (F12). Every word offers «اقترح معنى حرفيًا أدق», «اقترح معنى», «أبلغ عن خطأ» and «اقترح تصحيحًا». The Profile's empty contributions copy says the same (me.empty.contributions; profile.spec.ts:84 pins it). (RVQ-19, RVQ-20)
- **F24 · Small copy faults** (minor): the revert note is glued to the sentence — «…ردّته هيئة التحرير{note}» with no separator (contrib.reverted; ReviewQueue.tsx:319); places and an edit's sense number in Latin digits in the Arabic interface («2:32:4», «المعنى 01»: ReviewQueue.tsx:183; WordContributions.tsx:94, 130, 143; ProposalForm.tsx:19, 102), where DECISIONS:42 puts verse keys in Arabic-Indic; Arabic «» and «؛» in the English interface (ReviewQueue.tsx:285, 303, 348; WordContributions.tsx:33); «المراجعة {n}» for a revision (contrib.revision) reads as "the review"; a proposal whose author deleted the account is «مساهم» in the queue (ReviewQueue.tsx:181) and «مساهم سابق» in the Reader (WordContributions.tsx:27). (RVQ-Q08)
- **F25 · The page says "Nothing waiting" before it has looked** (minor): the queue's query waits for `useIsClient()` (ReviewQueue.tsx:24, 30), which is false on the server and through hydration (lib/client.ts:8-10), so the server's HTML and first paint show the empty copy (81-88) until the list arrives. A signed-out reader on `?filter=mine` is told «لم تقترح شيئًا بعد» with no filter pressed (72, 30).

### Robustness

- **F26 · A malformed id answers 500.** `GET /api/v1/proposals/not-a-uuid` and `GET /api/v1/proposals?filter=open&before=garbage` both return a bare "Internal Server Error" (run for this audit): `cast(:id as uuid)` and `cast(:before as timestamptz)` raise in Postgres (contrib.py:273, 310), and the API's handlers cover HTTP and validation errors only (main.py:899-920), so it is not the error envelope. The decision, revise, withdraw, report and revert routes cast the same way (382, 524, 550, 567, 589).

### Accessibility and tests

- **F27 · Focus is dropped after every decision and on a phone's every switch.** Pressing Decline, Request changes or Approve disables the button and then removes it (the skeleton, the "You approved" text, or another proposal) (ReviewQueue.tsx:154-167, 140, 250-256); on a phone, a row hides the list it sits in and Back hides the pane it sits in (93, 113-115; globals.css:4841-4844) — focus falls to the page each time, and nothing announces that the decision was taken or which proposal is now shown. Opening "Report to the editors" replaces the button with its form (395-411). (RVQ-81)
- **F28 · axe never sees the queue, a proposal, the proposal form or the changelog**: `/review` and `/data` are not in its page list, and none of its states opens a proposal or the form (a11y.spec.ts:5, 80-93). Unchecked, among others: the approval tracker's `aria-label` on a `div` with no role (ReviewQueue.tsx:189), which ARIA 1.2 does not allow and screen readers ignore; green text on the merged banner's green tint (globals.css:4914-4918), in both themes.
- **F29 · Journey D has a check that cannot fail, and whole paths have none.** It asserts that the Merged filter button is visible after the merge (journey-d.spec.ts:119), which it always is (ReviewQueue.tsx:72-77). Nothing in the browser tests the selection moving on, the note being cleared, a revision, a withdrawal, a report, a revert, a merged sense, or the Notebook's Propose sending (a grep of every spec).

### Latent

- **F30 · Merged glosses would vanish once a word has a sense list** (not sure; P3 may reshape the section): the sourced lines and the merged glosses beside them are drawn only while `w.senses.length === 0` (reader5/sections/Meanings.tsx:105-131); the sense-list branch draws merged edits only (85-101).

Checked and sound: no self-approve in the API (contrib.py:386-387) and the database (trigger, 0020:80-90), tested both ways (test_contrib_api.py:126-139) and in the browser (journey-d.spec.ts:105); no double-approve in the API (contrib.py:393-400) and the database (partial unique index, 0020:76-77), tested both ways (test_contrib_api.py:146-161); members cannot decide (contrib.py:376-377), only the board reverts (583-584), only the proposer revises or withdraws (528-532, 553), only an administrator grants roles (698-699), and every grant is recorded (708-718); decisions, revisions and withdrawals take the proposal's row `for update` (381-383, 523-525) or update it in one statement (550-556), so two decisions cannot both merge and a withdrawal cannot cross an approval, and `merges.proposal_id` is unique (0020:95); the merge, its credit and its changelog entry are one transaction (contrib.py:436-497); proposals write only `contributions.*` and a role in `accounts.users` — no path writes `content.*`, the kinds are seven, the morphology fields eleven, every target is checked against the dataset (23-38, 88-137) and an unknown kind is refused (test_contrib_api.py:110); every proposal, name, note and source is rendered as React text — no `dangerouslySetInnerHTML` in the contribution components or the Reader's merge blocks; the session is a bearer header, never a cookie, so a cross-site form cannot decide; public reads are `no-cache` or `no-store` (routes_contrib.py:15-17) and are made in the browser, so no ISR page holds a stale merge; a body needs a length and stays under the limit (main.py:875-881); proposals are limited per account (thirty a day, a hundred open, contrib.py:43-44, 160-178) as well as per address; deleting an account deletes its unmerged proposals and clears every name it left, and no row anywhere still points at it (contrib.py:722-741; test_accounts_api.py:321-341; test_contrib_api.py:295-321).

### The plan's P7 and the decisions, against the code

| Plan line or decision | What serves it | Holds |
|---|---|---|
| D4: an appointed board; the reviewer role earned by merged contributions; competing senses with attribution | editor role granted by an administrator or `roles.py` (contrib.py:694-719); reviewer at ten merges (42, 498-515); two merged edits of one sense both shown (reader5/sections/Meanings.tsx:92-94) | yes — the ten merges count reverted ones (F5) |
| DECISIONS:119: never over a source; a correction as an editors' note | merged edits above the source's wording, merged glosses after their source line (Meanings.tsx:91-95, 117-123); corrections, errors, attestations, entries as editors' notes (WordContributions.tsx:81-109) | yes in the Reader; the changelog strikes the source through (F11); merged senses misnumbered (F12) |
| DECISIONS:120: two distinct approvals, one the board's; none self, none double, in the database and the API; no approval of wording without a structured source | contrib.py:386-422; 0020:76-90; 391-392 | yes — a lexicon alone counts (F9) and a revision cannot add one (F3) |
| DECISIONS:121: the queue readable by anyone, the proposer under their chosen name or «مساهم», said before sending; deleting an account deletes unmerged proposals, credits "a former contributor" | routes_contrib.py:51-63; contrib.py:204-207; contrib.footSigned, sentBody; contrib.py:722-741 | yes — but the privacy page and the Account tab say otherwise (F15), and clearing a name does not reach merged credits (F14) |
| Drafts kept when signed out, sent on sign-in (RVQ-Q02, 10 §4.4) | ProposalForm.tsx:59-63, 89-97; lib/contrib.ts:100-120; SyncRunner.tsx:83-92; journey-d.spec.ts:148-170 | yes — a refused draft is stuck (F17) |
| P7.1a schema `contributions` (0020) | proposals with kind, lemma, sense, place, field, structured sources, revisions; decisions as the audit log; merges with history and revert; changelog; reports; role grants; roles member · reviewer · editor · instructor · admin (0020:26-140) | yes — "one decision per reviewer and revision" is one approval (0020:76-77); reports and blocks are inert (F4) |
| P7.1b API | propose, queue, detail, decisions, revise, withdraw, report, revert, changelog, a lemma's merges, the reader's own, role grants (routes_contrib.py:43-135) | yes — 500 on malformed ids (F26); paging unused (F6) |
| P7.2 `/review` | filters with counts and empty copy, list and detail, tracker, note per decision, phone list-then-detail, the URL (ReviewQueue.tsx) | partly — F1, F2, F27 |
| P7.3 the chain | the form submits or keeps (ProposalForm.tsx); the Reader's merges and the reader's own proposals (WordContributions.tsx); the changelog on Data & API (data/page.tsx:19); the Profile from the server (ProfileScreen.tsx:155-164, 404-417); the Notebook's Propose prefilled (NotebookScreen.tsx:457-487); the hub tile (lib/destinations.ts:25), the nav item (shell/NavLinks.tsx:19) and the footer's Contribute (shell/SiteFooter.tsx:26-27) live | yes |
| P7.4 exit: journey D with two real reviewer accounts | a reviewer and an editor, real sign-ins, roles by the command (journey-d.spec.ts:82-146) | yes — one of its checks cannot fail (F29) |

### Stale or inconsistent lines elsewhere (not edited here)

- PLAN.md:265 keeps P7 at 🟡 with no status line, though P7.1a through P7.4 are committed (de6d63b … 210c0e9). PLAN §3.2 still says "Propose from a note waits on P7" (PLAN.md:69), Review queue ⬜ "Needs accounts + proposals" (70), Profile "P6.3, in progress" (73) and Data & API "Missing: … changelog" (74); P5's status lines still list the queue, contributions, the footer's Contribute and proposing from a note as waiting on P7 (232, 238, 248).
- PLAN.md:67, 224 and 228 say the Analyser's chosen analyses go to the review queue in P7; P7's build order (PLAN.md:270-274) does not include it and nothing in `components/analyse/` proposes anything. It needs a place in the plan or the owner's word to drop it.
- PLAN.md:271 says the database enforces "one decision per reviewer and revision"; it enforces one approval per reviewer and revision (0020:76-77), and a reviewer may approve and then decline.
- The development database holds four open gloss proposals on ilm, each with one approval, made between 12:14 and 12:21 on 2026-10-03 by journey-D runs whose accounts were never deleted; they show in the dev server's public queue and its counts. Not touched.

## 3. Open — buildable now

| ID | What is missing | Files |
|---|---|---|
| RVQ-09 | a revert that takes the proposal out of Merged (a `reverted` status, or the filter reading `merges.reverted_at`), and counts that leave reverted merges out (F5) | contrib.py:212-218, 279-283, 581-601 |
| RVQ-12 | the note draft cleared when the filter changes (F1) | contrib/ReviewQueue.tsx:42-46, 116, 136 |
| RVQ-16 | (minor) the row amber when a meaning has no structured source — the condition approval is blocked on (F21) | ReviewQueue.tsx:102 |
| RVQ-18 | the note, the error, the revise and revert forms reset per proposal: `key={current}` on `Detail` (F1) | ReviewQueue.tsx:116, 136-137, 311, 356-358 |
| RVQ-19 | (minor) empty copy naming the proposal buttons a word has today (F23) | ar.json/en.json contrib.empty.open |
| RVQ-20 | (minor) the same for Mine (F23) | ar.json/en.json contrib.empty.mine |
| RVQ-32 | (minor) no Approve for a reviewer outside the board once two have approved, or a label saying it waits for the board (F22) | contrib.py:354-356; ReviewQueue.tsx:148-151, 254 |
| RVQ-42 | a revise form with the proposal form's sources — a lexicon with its entry, a verse, a grammar reference (F3) | ReviewQueue.tsx:354-385 |
| RVQ-44 | the next item after a decision, read from a fresh queue (F2) | ReviewQueue.tsx:49-58 |
| RVQ-45 | an emptied filter switching to where the item went (F2) | ReviewQueue.tsx:49-58 |
| RVQ-60 | merged senses numbered after the sourced lines the Reader shows, and an ordinal unique per lemma (F12) | contrib.py:443-458; 0020:93-112; reader5/sections/Meanings.tsx:111, 138; contrib/WordContributions.tsx:67 |
| RVQ-74 | reports the board can read and resolve, blocking and unblocking by endpoint or command, blocked accounts kept from reporting — or copy that does not promise the editors have it (F4) | contrib.py:564-578; 0020:30, 122-130; roles.py; contrib.reported |
| RVQ-80 | the queue and a proposal re-read on focus and after a proposal is sent (F2) | ReviewQueue.tsx:30, 135; shell/Providers.tsx:14; contrib/ProposalForm.tsx:65-71 |
| RVQ-81 | (minor) focus to the proposal's heading when a phone shows it, back to its row on return, and after a decision to the pane with the outcome announced (F27) | ReviewQueue.tsx:93, 113-115, 154-167; globals.css:4837-4847 |
| RVQ-Q02 | a refused draft kept with the server's reason, said in the Reader and on the Profile, not resent unchanged (F17) | lib/contrib.ts:96-120; WordContributions.tsx:135; account/SyncRunner.tsx:83-92 |
| RVQ-Q05 | (minor) a lexicon counted only with its entry or page, one reference per lexicon (F9) | contrib.py:81-85; ProposalForm.tsx:51, 155, 160 |
| RVQ-Q06 | written reviewer guidelines — theological framing, competing senses, what counts as a source, when to send back — drafted for the owner and the advisors D15 names, linked from the queue's footer | docs/; contrib.footer |
| RVQ-Q08 | the diff's direction from its text (F20); errors in the reader's language (F19); the small copy faults (F24) | ReviewQueue.tsx:163, 183, 203-220, 285, 303, 319, 330, 348, 368, 404; ProposalForm.tsx:19, 70; WordContributions.tsx:33 |
| RVQ-Q09 | credit names read from the account, so clearing or changing a name reaches merged credits (F14); the privacy page and the Account tab saying the queue is public and names appear on every proposal and decision, and the account export holding its contributions (F15) | contrib.py:438-488, 619-638; accounts.py:341-362; privacy/page.tsx:39, 58, 88, 107; me.noPublic; sync.py:337-381; test_accounts_api.py:456-497 |
| RVQ-H04 | as RVQ-44 and RVQ-45 (F2) | ReviewQueue.tsx:49-58 |
| RVQ-H07 | as RVQ-18 (F1) | ReviewQueue.tsx:116, 136 |
| RVQ-H09 | (minor) the reader's proposals and a word's merges re-read on focus (F2) | WordContributions.tsx:15, 118 |
| RDR-318 | (minor) a verse accepted in Arabic-Indic digits, and an invalid one said, not only marked (F18) | ProposalForm.tsx:21, 51-52, 157; contrib.versePlaceholder |
| RDR-324 | (minor) as RVQ-H09 (F2) | WordContributions.tsx:15, 118 |
| SHR-H05 | (minor) an error report's current text without the English gloss spliced in, and a morphology "before" kept in one language (F13) | reader5/sections/Meanings.tsx:152, 158-170 |
| PRF-18 | (minor) a reverted merge shown and counted as reverted on the Profile (F5) | profile/ProfileScreen.tsx:155-164, 388-417 |

Defects outside these items, to fix in the same pass: F6 (paging), F7 (the server's own "before"), F8 (confirm revert and withdraw), F10 (sources for error reports and attestations — the board's call), F11 (the changelog's strike-through — the owner's call), F16 (names: reserved words, control characters, isolation), F25 (the empty flash), F26 (500s), F28 (axe on the queue, a proposal, the form and the changelog, both themes), F29 (browser tests for the paths named), F30 (latent, with P3).

## 4. Waiting on later phases

| ID | What | Phase |
|---|---|---|
| RVQ-50 | the per-sense "Suggest an edit": built, but drawn only on a sense list, which no lemma has before P3's sense lists (P3.1, P3.4a) | P3 |
| RVQ-Q11 | one queue model for the dictionary and hadith products, targets namespaced by product (quran:word, dict:entry, hadith:narration) | P11 |

## 5. All items

### Review Queue (RVQ-01…81)

| ID | status | evidence / notes |
|---|---|---|
| RVQ-01 | done | `/review` (review/page.tsx), rendered per request, not indexed (6, 12-13) |
| RVQ-02 | done | `?filter=` with the six filters and `?id=` read on the server (review/page.tsx:8, 18-20) and written back without a request (ReviewQueue.tsx:35-40) |
| RVQ-03 | adapted | Named «طلبات التعديل», apart from the study review (PLAN §8 B8; contrib.title). Inbound: the hub tile (lib/destinations.ts:25), the nav (shell/NavLinks.tsx:19), the footer's Contribute (shell/SiteFooter.tsx:26-27), the form after sending, from the Reader or the Notebook (ProposalForm.tsx:80-82), the Reader's "What you proposed" (WordContributions.tsx:150), Profile rows (ProfileScreen.tsx:413), every credit line (WordContributions.tsx:35); Data & API's "add yours" waits with that page (P10), whose changelog rows link to their decisions |
| RVQ-04 | done | ReviewQueue.tsx:65-69 (contrib.meta); "yours" counted by account id (contrib.py:282) |
| RVQ-05 | adapted | A segmented group with a count only when non-zero (ReviewQueue.tsx:71-78), carrying the union of the docs' and the prototype's filters (PLAN.md:267, 273); Mine shown only signed in |
| RVQ-06 | adapted | The union: Open • Mine • Approved • Changes requested • Merged • Declined (contrib.py:45); Approved now means two reviewers without the board (DECISIONS:120) |
| RVQ-07 | done | Open = `status = 'open'` (contrib.py:212) |
| RVQ-08 | bug-fixed | Mine = `proposer_id = viewer`, a stable account id, not a name (contrib.py:217; DEF-13) |
| RVQ-09 | open | Merged = `status = 'merged'` (contrib.py:215), but a reverted merge keeps that status and its count (F5) |
| RVQ-10 | adapted | Changes requested is a status and a filter of its own; Declined is declined and withdrawn (contrib.py:216, 281; PLAN.md:267) |
| RVQ-11 | done | Newest first (contrib.py:276) |
| RVQ-12 | open | A new filter selects its first item (ReviewQueue.tsx:42-46), but the note draft survives the switch when the list is cached (F1) |
| RVQ-13 | done | The proposal in the URL, else the first of the filter, Open by default (ReviewQueue.tsx:27-33) |
| RVQ-14 | done | The word in Amiri 19 px right to left or «—», the kind, a spacer, the age as «اليوم» or «قبل يومين» with Arabic plurals (ReviewQueue.tsx:94-101; contrib.daysAgo) |
| RVQ-15 | done | «{name} • {n} من موافقتين» then the sources counted or «بلا مصدر» (ReviewQueue.tsx:102-105) |
| RVQ-16 | open | (minor) The amber condition can never be true; a meaning that cannot be approved is not marked (F21) |
| RVQ-17 | done | `.queue-row.is-on`: card background and a 3 px inline-start border in the root colour (globals.css:4808-4822) |
| RVQ-18 | open | A row selects (ReviewQueue.tsx:93) but the note draft stays and is sent with the next decision (F1) |
| RVQ-19 | open | (minor) The Open filter's own copy exists, but names "Suggest an edit" on a sense, which no word has (F23) |
| RVQ-20 | open | (minor) The same for Mine (F23) |
| RVQ-21 | done | contrib.empty.merged |
| RVQ-22 | done | contrib.empty.declined; Approved and Changes requested have their own too |
| RVQ-23 | done | The kind, the sense number in two digits of the interface's own, «•», the word linked to the Reader (ReviewQueue.tsx:173-179) |
| RVQ-24 | done | «اقترحه {name} في {date}» and, for the proposer, «لا يقرّر صاحب المقترح فيه», with the revision, place and field (ReviewQueue.tsx:180-186) |
| RVQ-25 | adapted | Two slots, a green ✓ with the reviewer's name and the board marked (ReviewQueue.tsx:188-201; globals.css:4849-4877); an empty slot reads «تنتظر», never "you" (RVQ-77) |
| RVQ-26 | done | The before line only with a current text and not for an attestation, the after line always, each with a hidden label (ReviewQueue.tsx:203-220); their direction is F20, under RVQ-Q08 |
| RVQ-27 | done | «السبب والمصادر», the rationale or «لم يُذكر سبب», then the sources (ReviewQueue.tsx:221-229) |
| RVQ-28 | adapted | «المصادر: title — ref» in green when structured, titles from the API (ReviewQueue.tsx:295-306; contrib.py:245-252); no "auto-checked" claim (RVQ-79) |
| RVQ-29 | done | Amber, and stricter for meanings: «بلا مصدر — لا يُعتمد معنى قبل أن يُذكر مصدره», approval refused by the server (ReviewQueue.tsx:298-299; contrib.py:391-392) |
| RVQ-30 | done | «ملاحظتك لصاحب المقترح», two rows, «اختيارية — تظهر مع قرارك» (ReviewQueue.tsx:234-237) |
| RVQ-31 | done | Decline in red, Request changes, a spacer, the primary Approve, shown only while the viewer may decide (ReviewQueue.tsx:232-258; contrib.py:354-358) |
| RVQ-32 | open | (minor) «وافق (١ من ٢)», «وافق واعتمد» when this approval merges, «وافقت • تنتظر موافقة أخرى» after (ReviewQueue.tsx:148-151, 250-256); but «وافق (٣ من ٢)» once two have approved (F22) |
| RVQ-33 | done | «اعتُمد • يُنسب إلى {name} بجانب مصدره وفي سجل التغييرات» (ReviewQueue.tsx:315-320; contrib.merged) |
| RVQ-34 | done | «رُفض • «note»» (ReviewQueue.tsx:344-349) |
| RVQ-35 | done | «طُلب تعديله • «note»» (ReviewQueue.tsx:344-349) |
| RVQ-36 | adapted | The footer states the real rule — two independent approvals, one the board's, none self, none double, credit beside the source — with no prototype reviewer (ReviewQueue.tsx:119; contrib.footer) |
| RVQ-37 | done | «اختر مقترحًا.» (ReviewQueue.tsx:116) |
| RVQ-38 | adapted | Two distinct approvals of which one the board's merge; two without the board leave it Approved (contrib.py:408-422; DECISIONS:120; test_contrib_api.py:162-170) |
| RVQ-39 | bug-fixed | 409 from the API (contrib.py:393-400), a unique index in the database (0020:76-77), and the button replaced by «وافقت…» (ReviewQueue.tsx:250-252); tested both ways (test_contrib_api.py:146-161) |
| RVQ-40 | bug-fixed | 403 from the API (contrib.py:386-387) and a trigger in the database (0020:80-90); tested both ways and in journey D (test_contrib_api.py:126-139; journey-d.spec.ts:103-105) |
| RVQ-41 | done | One reviewer declines at once (contrib.py:424) |
| RVQ-42 | open | Request changes is a status and revise-and-resubmit returns it to the queue as a new revision (contrib.py:518-545; ReviewQueue.tsx:354-385); but a revision cannot add a source that counts (F3) |
| RVQ-43 | adapted | Every decision is kept with its note, role and revision (0020:63-74; contrib.py:401-407) and listed under «القرارات» (ReviewQueue.tsx:274-290); the proposal's `note` is the latest |
| RVQ-44 | open | Meant to move to the next item (ReviewQueue.tsx:48-55), but reads a stale list and stays (F2) |
| RVQ-45 | open | Meant to switch to the filter the item went to (ReviewQueue.tsx:56-57), but never reaches it (F2) |
| RVQ-46 | done | A first approval keeps the selection (ReviewQueue.tsx:52) |
| RVQ-47 | done | Each decision committed in its own transaction (contrib.py:379-432) |
| RVQ-48 | done | Word, sense, place, field, current and proposed text, rationale, sources, proposer, date, approvals, revision and every decision (contrib.py:229-262, 313-367) |
| RVQ-49 | adapted | Seven kinds labelled (contrib.kind.*); "from a note" is not a kind — a note proposes a sense, an error report or an attestation (NotebookScreen.tsx:482); an unknown kind is refused (contrib.py:147-148) |
| RVQ-50 | waiting | P3: the per-sense "Suggest an edit" with its dialog is built (reader5/sections/Meanings.tsx:85-101; ProposalForm.tsx:16-20) but drawn only on a sense list, which no lemma has (`senses: []`; no `senses.jsonl` in data/build/2026.10.0) |
| RVQ-51 | adapted | Every lexicon in the dataset, with an entry or page, a verse and a grammar reference (ProposalForm.tsx:49, 145-161) |
| RVQ-52 | adapted | «إلغاء» and «أرسل للمراجعة»; wording and a rationale required (the P2.0 rule, audit 08 RDR-318), a source required to approve rather than to send (ProposalForm.tsx:52, 168-175; RVQ-Q05) |
| RVQ-53 | adapted | The form says the proposal goes public under the chosen name (contrib.footSigned, footLocal, sentBody; DECISIONS:121), the prototype's "Only you see this" being false; a status panel instead of a toast (ProposalForm.tsx:74-88) |
| RVQ-54 | done | «اقترح معنى» on every word: an empty current text, no sense number (reader5/sections/Meanings.tsx:149-151) |
| RVQ-55 | done | «أبلغ عن خطأ» with «{ar} — {en}» as current (reader5/sections/Meanings.tsx:152-154); the splice is SHR-H05's fault (F13) |
| RVQ-56 | adapted | No "Propose entry" on the Quran, where every word has an entry (audit 08 RDR-129); the API takes `entry` with a checked place (contrib.py:94-98) for the texts that will have unknown words |
| RVQ-57 | adapted | Propose from a note opens a form prefilled with the note, which the reader edits and sends, a rationale required (NotebookScreen.tsx:457-487; NTB-Q07) |
| RVQ-58 | adapted | The Notebook offers «شاهد» (NotebookScreen.tsx:482) |
| RVQ-59 | adapted | A merged edit above the source's wording, never in its place (reader5/sections/Meanings.tsx:91-95; DECISIONS:119), a merged gloss after its source line (117-123), with its credit; the reader's own pending proposals in «ما اقترحته», dashed amber (WordContributions.tsx:112-158; globals.css:2956-2964) |
| RVQ-60 | open | Merged senses listed with their credit (WordContributions.tsx:57-79) but numbered from 01 beside the sourced lines' 01…N (F12) |
| RVQ-61 | done | The changelog on /data (data/page.tsx:19; Changelog.tsx) and the Profile's tab (ProfileScreen.tsx:404-417); journey D walks propose → review → merge → credit → changelog → Profile (journey-d.spec.ts:82-146) |
| RVQ-62 | adapted | `contributions.proposals`: kind, lemma, sense, place, field, current text, text, rationale, structured sources, proposer id, status, revision, note, dataset version, times (0020:34-58) |
| RVQ-63 | n/a | A prototype seed; no seed ships |
| RVQ-64 | n/a | A prototype seed's rationale |
| RVQ-65 | n/a | A prototype seed, with a fake check (RVQ-79) |
| RVQ-66 | n/a | A prototype seed |
| RVQ-67 | n/a | A prototype seed |
| RVQ-68 | n/a | The prototype's seed migration |
| RVQ-69 | n/a | The prototype's screenshot state |
| RVQ-70 | adapted | Statuses open, approved, changes, merged, declined, withdrawn (0020:46-47); decisions approve, decline, changes (0020:70) |
| RVQ-71 | adapted | A kind, a lemma, a nullable sense, a place and a field, with per-kind checks (0020:34-58); a root or passage target is not offered (PLAN.md:271 names lemma, sense, place or field) |
| RVQ-72 | done | Sources `{work, ref}`: a lexicon, a verse, a grammar reference or other (contrib.py:60-78) |
| RVQ-73 | adapted | One approval per reviewer and revision (0020:76-77); a reviewer may decline or send back after approving (contrib.py:388-424) |
| RVQ-74 | open | Reviewers appointed or earned (D4; contrib.py:42, 498-515, 694-719), revert with history (581-601), competing senses (reader5/sections/Meanings.tsx:92-94), the community layer beside the sources (DECISIONS:119), per-account limits (contrib.py:43-44, 160-178); but reports and blocks do nothing (F4) |
| RVQ-75 | done | Proposing needs a session (routes_contrib.py:47; test_contrib_api.py:93); signed out the draft is kept and sign-in offered after the writing (ProposalForm.tsx:59-63, 89-97); journey-d.spec.ts:148-170 |
| RVQ-76 | bug-fixed | A reader's proposal merges with real accounts (journey-d.spec.ts:82-146) |
| RVQ-77 | bug-fixed | An empty slot reads «تنتظر» (ReviewQueue.tsx:197) |
| RVQ-78 | bug-fixed | Sources by title, «القرآن» for a verse (contrib.py:607-616; ReviewQueue.tsx:300); tested (test_contrib_api.py:98, 180) |
| RVQ-79 | bug-fixed | No check is claimed anywhere; a structured source is only "cited" |
| RVQ-80 | open | Still not re-read on focus, nor for an hour within a session (F2) |
| RVQ-81 | open | (minor) List then proposal under 900 px with «→ القائمة» (globals.css:4837-4847; ReviewQueue.tsx:79, 113-115; journey-d.spec.ts:171-178), tokens for both themes; but focus is dropped at each switch (F27) and axe never runs here (F28) |

### Review Queue — Quran adaptation notes (RVQ-Q01…Q11)

| ID | status | evidence / notes |
|---|---|---|
| RVQ-Q01 | done | Accounts, roles, the audit log of decisions, 403 self, 409 double, two distinct approvals with the board's, merge, credit and changelog in one transaction (contrib.py:373-515; 0020); tests and journey D |
| RVQ-Q02 | open | Drafts kept on the device (lib/reader/store.ts:274-291, 410-411; ProposalForm.tsx:59-63) and sent after the first sync on sign-in (SyncRunner.tsx:83-92; lib/contrib.ts:100-120; journey-d.spec.ts:148-170); but a refused draft is stuck (F17) |
| RVQ-Q03 | done | Seven kinds, eleven morphology fields, every target checked against the dataset, nothing writes `content.*` (contrib.py:23-38, 88-137); «أما النص القرآني نفسه فلا يدخل في أي اقتراح» on every form (ProposalForm.tsx:176); tested (test_contrib_api.py:110). A hand-made "before" is F7 |
| RVQ-Q04 | adapted | The board appointed by an administrator or the command (contrib.py:694-719; roles.py), the reviewer role earned at ten merges (D4, approved by the owner), the board's approval on every merge (DECISIONS:120), reviewers named on every merge (WordContributions.tsx:28); no qualifications are stated |
| RVQ-Q05 | open | (minor) No approval of an edit, sense or gloss without a structured source (contrib.py:25, 391-392); but a lexicon with no entry or page counts (F9) |
| RVQ-Q06 | open | Competing senses shown with attribution (reader5/sections/Meanings.tsx:92-94; DECISIONS:119); no written reviewer guidelines exist in the repo or the product — a draft for the owner and the advisors of D15 |
| RVQ-Q07 | done | Revert by the board with its reason (contrib.py:581-601; ReviewQueue.tsx:321-335), a changelog event (0020:114-120), the previous text and sources kept with each merge (0020:93-111), every credit linked to its decisions (WordContributions.tsx:35) |
| RVQ-Q08 | open | Arabic copy for every label and filter, logical properties (globals.css:4816); but the diff's direction (F20), English errors (F19) and small copy faults (F24) |
| RVQ-Q09 | open | A chosen name or «مساهم», «أنت» for one's own, no reviewer statistics (contrib.py:258; ReviewQueue.tsx:103); but merged credits keep a name its owner cleared (F14), and the privacy page says names appear only on merged contributions (F15) |
| RVQ-Q10 | done | Every proposal and rationale is a person's; no automated check is claimed (RVQ-79) |
| RVQ-Q11 | waiting | P11: targets are Quran lemmas (0020:37); namespacing comes with the dictionary and hadith products |

### Hard-won fixes (RVQ-H01…H09)

| ID | status | evidence / notes |
|---|---|---|
| RVQ-H01 | n/a | A seeded approval for the prototype's demonstration; journey D merges with real accounts |
| RVQ-H02 | done | As RVQ-39 |
| RVQ-H03 | done | A new filter selects its first item (ReviewQueue.tsx:33, 42-46) |
| RVQ-H04 | open | As RVQ-44 and RVQ-45 (F2) |
| RVQ-H05 | done | Six filters, six empty copies (contrib.empty.*); two of them name a missing button (RVQ-19, RVQ-20) |
| RVQ-H06 | n/a | The prototype's seed versioning |
| RVQ-H07 | open | Cleared after a decision (ReviewQueue.tsx:160) but not when the selection changes (F1) |
| RVQ-H08 | adapted | Merged wording beside the source with its credit, never rewriting it (DECISIONS:119), and in the changelog; journey D |
| RVQ-H09 | open | (minor) Submit needs wording and a rationale (adapted, RVQ-52), and drafts follow other tabs (SyncRunner.tsx:20-30); but the reader's proposals and a word's merges are not re-read on focus (F2) |

### Suggest an edit, propose a sense, report an error (RDR-311…325)

| ID | status | evidence / notes |
|---|---|---|
| RDR-311 | adapted | «اقترح معنى» and «أبلغ عن خطأ» on every word (reader5/sections/Meanings.tsx:148-155), a gloss here or for the lemma (77, 80, 124-128), each morphology tag (158-170); the per-sense edit renders on a sense list only (RVQ-50); no "Propose entry" on the Quran (audit 08 RDR-129) |
| RDR-312 | bug-fixed | The shared Dialog: role dialog, modal, named, focus trapped and returned, the scrim closing it (ui/Dialog.tsx:33, 38-49; reader5/Overlays.tsx:347-356) |
| RDR-313 | done | «اقترح تعديلًا • المعنى {n}», «اقترح معنى جديدًا», «أبلغ عن خطأ», with the gloss, morphology and attestation titles (ProposalForm.tsx:13-20); the edit's number in Latin digits is F24 |
| RDR-314 | done | «الحالي», read-only on card-2 (ProposalForm.tsx:127-134) |
| RDR-315 | done | «صياغتك», three rows (two for morphology) (ProposalForm.tsx:135-138) |
| RDR-316 | done | «السبب والمصدر» with a red asterisk, required, with a placeholder (ProposalForm.tsx:139-144) |
| RDR-317 | adapted | Every lexicon in the dataset as chips, with an entry or page, a verse and a grammar reference (ProposalForm.tsx:145-161) |
| RDR-318 | open | (minor) Wording and a rationale required, an edit or gloss must differ from the current text (ProposalForm.tsx:52); but a verse in Arabic-Indic digits silently disables Submit (F18) |
| RDR-319 | done | «إلغاء» flex 1 and «أرسل للمراجعة» flex 2, primary only when valid, otherwise disabled (ProposalForm.tsx:168-175) |
| RDR-320 | adapted | The footnote says where it goes, that the queue is public, the two-approval rule and that the Quranic text is closed (ProposalForm.tsx:176); the queue link comes after sending (80-82) |
| RDR-321 | adapted | Signed in, `POST /proposals` and a status panel (ProposalForm.tsx:65-88); signed out, kept in `jadhr-personal` `proposals` with kind, slug, label, ordinal, place, field, current, text, why, sources, status, time (lib/reader/store.ts:274-291, 410-411) |
| RDR-322 | adapted | The reader's drafts and queued proposals with their status in «ما اقترحته», dashed amber, below the meanings (WordContributions.tsx:112-158), not as numbered senses: an unreviewed wording should not look like a sense (L2) |
| RDR-323 | adapted | Beside, never over (DECISIONS:119): «اقترحه {who} • راجعه {reviewers}», the board marked, the sources by title, a link to the decisions (WordContributions.tsx:23-54) |
| RDR-324 | open | (minor) Drafts follow other tabs; merges and statuses are not re-read on focus (F2) |
| RDR-325 | adapted | The rule is the server's and the database's; the Reader reads live merges (contrib.py:667-681) and the reader's own proposals in every unsettled status (WordContributions.tsx:118-119) |

### Carried from audit 11

| ID | status | evidence / notes |
|---|---|---|
| SHR-H05 | open | (minor) An error report's current text splices the English gloss into the headword's, and a proposal has one wording field (F13) |
| PRF-18 | open | (minor) The Profile counts merged and pending (ProfileScreen.tsx:155-164) and lists every proposal with its status, «{n} من موافقتين» while open, linking to `/review?filter=mine&id=` (404-417; journey-d.spec.ts:132-134); but a reverted merge is shown and counted as merged (F5) |
| MAP-03 | done | Decisions, merges, credit lines, the changelog, roles and revisions on the server (0020; contrib.py), drafts on the device until sign-in (RVQ-Q02) |

## 6. How the counts were checked

The script below reads the inventory and this file. It takes the in-scope IDs from the inventory's own bullet lines — every `- RVQ-…` bullet (failing if one lies outside Part 4) and every bold `- **RDR-…**` bullet inside Part 1 §23 — plus the three carried IDs, which must exist as inventory bullets; it groups them by the inventory heading they sit under and labels each group by its first and last ID. It fails unless every in-scope ID has exactly one row in §5 and no row is outside the scope, every status is one of the six, the counts it computes per prefix and per group equal both tables of §1 (items and every status column, totals included) and the status table at the top of §1, the IDs in §3 and §4 are exactly the `open` and `waiting` rows, each waiting row names a phase, and every F number a row cites is defined in §2. It prints `P7-COVERAGE-COUNTS-VERIFIED` only when every check passes; failures print `MISMATCH` lines and exit 1.

```python
import re, sys
from collections import Counter

STAT = ["done", "adapted", "bug-fixed", "n/a", "open", "waiting"]
CARRIED = ["SHR-H05", "PRF-18", "MAP-03"]
ID = r"[A-Z]{3}-[A-Z]?\d+"

inv_path, rep_path = sys.argv[1], sys.argv[2]
inv = open(inv_path, encoding="utf-8").read().splitlines()
rep = open(rep_path, encoding="utf-8").read()
bad = []

# the in-scope IDs, from the inventory's own bullet lines, each with the heading it sits under
part4 = next(i for i, l in enumerate(inv) if l.startswith("## Part 4"))
part5 = next(i for i, l in enumerate(inv) if l.startswith("## Part 5"))
s23 = next(i for i, l in enumerate(inv) if l.startswith("### 23. Suggest an edit"))
s23_end = next(i for i in range(s23 + 1, len(inv)) if inv[i].startswith("### "))
heading, under = "", {}
scope = []
for i, l in enumerate(inv):
    if l.startswith("#"):
        heading = l.lstrip("#").strip()
    m = re.match(r"^- (RVQ-[QH]?\d+)\b", l)
    if m:
        if not (part4 < i < part5):
            bad.append(f"MISMATCH {m.group(1)} is outside Part 4 (line {i + 1})")
        scope.append(m.group(1)); under[m.group(1)] = heading
    m = re.match(r"^- \*\*(RDR-\d+)\*\*", l)
    if m and s23 < i < s23_end:
        scope.append(m.group(1)); under[m.group(1)] = heading
bullets = {m.group(1) for l in inv if (m := re.match(rf"^- (?:\*\*)?({ID})\b", l))}
for c in CARRIED:
    if c not in bullets: bad.append(f"MISMATCH carried {c} is not an inventory bullet")
rvq = [x for x in scope if x.startswith("RVQ")]
rdr = [x for x in scope if x.startswith("RDR")]
print(f"inventory: RVQ bullets {len(rvq)} (main {sum(1 for x in rvq if re.match(r'RVQ-\d', x))}, Q {sum(1 for x in rvq if x.startswith('RVQ-Q'))}, H {sum(1 for x in rvq if x.startswith('RVQ-H'))}); RDR in Part 1 §23 {len(rdr)} ({rdr[0]}…{rdr[-1]}); carried {len(CARRIED)}")
scope = scope + CARRIED
if len(set(scope)) != len(scope): bad.append("MISMATCH duplicate IDs in the inventory scope")
print(f"in scope: {len(scope)}")

# groups: one per inventory heading, labelled by the first and last ID under it; carried items apart
groups = {}
for x in scope:
    groups.setdefault("Carried from audit 11" if x in CARRIED else under[x], []).append(x)
label = {}
for h, xs in groups.items():
    lab = h if h == "Carried from audit 11" else f"{xs[0]}…{xs[-1].split('-')[1]}"
    for x in xs: label[x] = lab
print("groups: " + "; ".join(f"{label[xs[0]]} {len(xs)}" for xs in groups.values()))

def prefix(i): return "Carried" if i in CARRIED else i.split("-")[0]

parts = re.split(r"^## ", rep, flags=re.M)
sec = {p.split(".")[0]: p for p in parts if re.match(r"\d\.", p)}
rows = re.findall(rf"^\| ({ID}) \| ([a-z/-]+) \|", sec["5"], flags=re.M)
ids = [r[0] for r in rows]
status = dict(rows)
for i, n in Counter(ids).items():
    if n > 1: bad.append(f"MISMATCH {i} has {n} rows")
for i in sorted(set(scope) - set(ids)): bad.append(f"MISMATCH {i} has no row")
for i in sorted(set(ids) - set(scope)): bad.append(f"MISMATCH {i} is not in scope")
for i, s in rows:
    if s not in STAT: bad.append(f"MISMATCH {i} has unknown status {s}")
print(f"report: {len(ids)} rows in §5")

def tally(key):
    t = {}
    for i, s in rows:
        if i in label or key is prefix: t.setdefault(key(i), Counter())[s] += 1
    return t

def check_table(t, cols_start):
    for lab, c in t.items():
        line = re.search(rf"^\| {re.escape(lab)} \|(.*)$", sec["1"], flags=re.M)
        if not line: bad.append(f"MISMATCH no §1 row for {lab}"); continue
        cells = [x.strip().strip("*") for x in line.group(1).split("|")][cols_start:cols_start + 7]
        want = [str(sum(c.values()))] + [str(c[s]) for s in STAT]
        if cells != want: bad.append(f"MISMATCH §1 {lab}: table {cells} computed {want}")

by_prefix = tally(prefix)
by_prefix["Total"] = sum(by_prefix.values(), Counter())
check_table(by_prefix, 0)
check_table(tally(lambda i: label[i]), 1)
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

# every defect a row names is defined in §2
faults = set(re.findall(r"^- \*\*(F\d+) ·", sec["2"], flags=re.M))
for i, s in rows:
    row = re.search(rf"^\| {re.escape(i)} \| {re.escape(s)} \|(.*)$", sec["5"], flags=re.M).group(1)
    for f in re.findall(r"\bF\d+\b", row):
        if f not in faults: bad.append(f"MISMATCH {i} names {f}, which §2 does not define")
print(f"defects defined in §2: {len(faults)}")

if bad:
    print("\n".join(bad)); sys.exit(1)
print(f"counts {dict(total)}")
print("P7-COVERAGE-COUNTS-VERIFIED")
```

Run on this file (`python3 check_p7.py docs/research/05-design-inventory.md docs/research/12-contribution-moderation-coverage.md`, exit 0):

```
inventory: RVQ bullets 101 (main 81, Q 11, H 9); RDR in Part 1 §23 15 (RDR-311…RDR-325); carried 3
in scope: 119
groups: RDR-311…325 15; RVQ-01…03 3; RVQ-04…06 3; RVQ-07…13 7; RVQ-14…22 9; RVQ-23…37 15; RVQ-38…48 11; RVQ-49…61 13; RVQ-62…69 8; RVQ-70…81 12; RVQ-Q01…Q11 11; RVQ-H01…H09 9; Carried from audit 11 3
report: 119 rows in §5
defects defined in §2: 30
counts {'done': 44, 'adapted': 30, 'bug-fixed': 8, 'open': 26, 'waiting': 2, 'n/a': 9}
P7-COVERAGE-COUNTS-VERIFIED
exit=0
```

Run on a copy with one status changed (RVQ-02 `done` → `open`, one exact edit asserted to match once), exit 1:

```
inventory: RVQ bullets 101 (main 81, Q 11, H 9); RDR in Part 1 §23 15 (RDR-311…RDR-325); carried 3
in scope: 119
groups: RDR-311…325 15; RVQ-01…03 3; RVQ-04…06 3; RVQ-07…13 7; RVQ-14…22 9; RVQ-23…37 15; RVQ-38…48 11; RVQ-49…61 13; RVQ-62…69 8; RVQ-70…81 12; RVQ-Q01…Q11 11; RVQ-H01…H09 9; Carried from audit 11 3
report: 119 rows in §5
defects defined in §2: 30
MISMATCH §1 RVQ: table ['101', '38', '23', '7', '9', '22', '2'] computed ['101', '37', '23', '7', '9', '23', '2']
MISMATCH §1 Total: table ['119', '44', '30', '8', '9', '26', '2'] computed ['119', '43', '30', '8', '9', '27', '2']
MISMATCH §1 RVQ-01…03: table ['3', '2', '1', '0', '0', '0', '0'] computed ['3', '1', '1', '0', '0', '1', '0']
MISMATCH status table done: 44 computed 43
MISMATCH status table open: 26 computed 27
MISMATCH §3 lists ['PRF-18', 'RDR-318', 'RDR-324', 'RVQ-09', 'RVQ-12', 'RVQ-16', 'RVQ-18', 'RVQ-19', 'RVQ-20', 'RVQ-32', 'RVQ-42', 'RVQ-44', 'RVQ-45', 'RVQ-60', 'RVQ-74', 'RVQ-80', 'RVQ-81', 'RVQ-H04', 'RVQ-H07', 'RVQ-H09', 'RVQ-Q02', 'RVQ-Q05', 'RVQ-Q06', 'RVQ-Q08', 'RVQ-Q09', 'SHR-H05'] but open rows are ['PRF-18', 'RDR-318', 'RDR-324', 'RVQ-02', 'RVQ-09', 'RVQ-12', 'RVQ-16', 'RVQ-18', 'RVQ-19', 'RVQ-20', 'RVQ-32', 'RVQ-42', 'RVQ-44', 'RVQ-45', 'RVQ-60', 'RVQ-74', 'RVQ-80', 'RVQ-81', 'RVQ-H04', 'RVQ-H07', 'RVQ-H09', 'RVQ-Q02', 'RVQ-Q05', 'RVQ-Q06', 'RVQ-Q08', 'RVQ-Q09', 'SHR-H05']
exit=1
```

Run on a copy with the MAP-03 row removed, exit 1:

```
inventory: RVQ bullets 101 (main 81, Q 11, H 9); RDR in Part 1 §23 15 (RDR-311…RDR-325); carried 3
in scope: 119
groups: RDR-311…325 15; RVQ-01…03 3; RVQ-04…06 3; RVQ-07…13 7; RVQ-14…22 9; RVQ-23…37 15; RVQ-38…48 11; RVQ-49…61 13; RVQ-62…69 8; RVQ-70…81 12; RVQ-Q01…Q11 11; RVQ-H01…H09 9; Carried from audit 11 3
report: 118 rows in §5
defects defined in §2: 30
MISMATCH MAP-03 has no row
MISMATCH §1 Carried: table ['3', '1', '0', '0', '0', '2', '0'] computed ['2', '0', '0', '0', '0', '2', '0']
MISMATCH §1 Total: table ['119', '44', '30', '8', '9', '26', '2'] computed ['118', '43', '30', '8', '9', '26', '2']
MISMATCH §1 Carried from audit 11: table ['3', '1', '0', '0', '0', '2', '0'] computed ['2', '0', '0', '0', '0', '2', '0']
MISMATCH status table done: 44 computed 43
MISMATCH status table total
exit=1
```

Run on a copy whose RVQ-16 row cites F31, which §2 does not define, exit 1:

```
inventory: RVQ bullets 101 (main 81, Q 11, H 9); RDR in Part 1 §23 15 (RDR-311…RDR-325); carried 3
in scope: 119
groups: RDR-311…325 15; RVQ-01…03 3; RVQ-04…06 3; RVQ-07…13 7; RVQ-14…22 9; RVQ-23…37 15; RVQ-38…48 11; RVQ-49…61 13; RVQ-62…69 8; RVQ-70…81 12; RVQ-Q01…Q11 11; RVQ-H01…H09 9; Carried from audit 11 3
report: 119 rows in §5
defects defined in §2: 30
MISMATCH RVQ-16 names F31, which §2 does not define
exit=1
```

The three copies were deleted after the runs.
