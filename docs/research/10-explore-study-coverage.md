# 10 · Explore and study coverage — Hub, Collections, Notebook and the review deck against the built code

Audited 2026-10-03 against commit `6fa2c84` (branch `build/vision`; read in the worktree branch `worktree-agent-ae4c5d57a8fc5261f` at the same commit, no other change). Scope: phase P5 "Explore and study" of `docs/PLAN.md` against `docs/research/05-design-inventory.md` — Part 3 §2 Hub (HUB-01…50, HUB-Q01…Q08), Part 3 §3 Collections (COL-01…54, COL-Q01…Q07), Part 4 §2 Notebook (NTB-01…54, NTB-Q01…Q10), Part 1 §25 the review deck (RDR-344…360) with RDR-536, and the shared-shell items the hub depends on (SHL-18…28, SHL-40). The hard-won fixes that carry the same prefixes (HUB-F01…F03 and COL-F01…F02 in Part 3 §8, NTB-H01…H05 in Part 4 §6) are included too: PLAN §7 counts P5 as HUB 61 · COL 63 · NTB 69 = 193, and those totals include them. Judged with `CLAUDE.md`, PLAN §2 (laws) and §4 (D1–D29), the PLAN P5 section and `docs/DECISIONS.md`.

**Method.** Read in full: inventory Part 3 §0–§3 and §8–§9, Part 4 §0, §2, §6 and §7, Part 1 §25 and the RDR-536 line; PLAN; DECISIONS; research 09 (the model for this report); `app/[locale]/(site)/page.tsx`, `explore/page.tsx`, `notebook/page.tsx` and the site layout; every file in `components/home/`, `components/explore/`, `components/notebook/`; `components/reader5/ReviewDeck.tsx`; `lib/store/review.ts` and `review.test.ts`, `lib/store/notebook.ts`, `lib/store/safeStorage.ts`, `lib/notebook/mentions.ts` and `mentions.test.ts`, `lib/destinations.ts`, `lib/daily.ts`, `lib/collections.ts`, `lib/format.ts`, `lib/localData.ts`, `lib/arabic/normalize.ts`; `components/shell/` (SiteHeader, SiteFooter, NavLinks, MobileMenu, ScreenSkeleton), `components/ui/Dialog.tsx` and `Segmented.tsx`, `components/search/SearchLauncher.tsx`; the hub, explore, review-deck and notebook rules of `app/globals.css` (3375–4217) and its shared recipes (205–330); the `hub`, `explore`, `review`, `notebook`, `footer`, `nav` and `screens` namespaces of `messages/ar.json` and `en.json`; `services/api/src/jadhr_api/daily.py`, `collections.py`, `review.py` and their routes in `main.py`; `pipeline/src/jadhr_pipeline/collections.py`; `data/collections.yaml`; the e2e specs `hub`, `explore`, `notebook`, `review-deck`, `journey-b` and `a11y`. Read in part: `lib/reader/store.ts` (sessions, context, word states, preferences), `components/reader5/ReaderHeader.tsx`, `ReaderShell.tsx`, `ResumeRedirect.tsx`, `Listen.tsx`, `Overlays.tsx` (the storage-error toast), `lib/store/saved.ts`, the placeholder routes `/split`, `/review`, `/classroom`, `/me`, and `data/patterns.yaml` (the source attributions a set quotes). Nothing was run — no server, build or test — and nothing was fetched. Evidence is a file and line read in this audit, or the title of a test that exercises the item; a test title shows the coverage exists, not that it passed today. Every count below is computed from the item rows, and the rows were checked one to one against the inventory's own IDs by a script that fails on any mismatch (see "How the counts were checked").

**Status rules.** `done` — built as the design says, or better. `adapted` — built differently on purpose, with the reason named (a decision in DECISIONS, a Quran note, or a plain reason stated in the row). `bug-fixed` — a prototype defect the inventory flags that our build fixes or cannot have. `n/a` — a design artefact or a placeholder that must never ship. `open` — buildable now and not built, or built with a fault that makes the item behave wrong; the row names what is missing. `waiting` — depends on a later phase or an owner decision, which the row names. A missing function, state, control, data field or accessibility property makes an item `open`; pixel sizes, colours and copy wording do not (every string is rewritten in Arabic by design), but a number or a claim on screen that the data does not hold does. "(minor)" marks a small open item.

**Paths.** Bare component names are in `apps/web/src/components/{home,explore,notebook}/` or `components/reader5/` (ReviewDeck); `shell/`, `ui/`, `search/` are in `apps/web/src/components/`; `lib/…` is `apps/web/src/lib/…`; route files (`page.tsx` for the hub, `explore/page.tsx`, `notebook/page.tsx`) are under `apps/web/src/app/[locale]/(site)/`; `globals.css` is `apps/web/src/app/globals.css`; `ar.json`/`en.json` are `apps/web/src/messages/`; `daily.py`, `collections.py` (API), `review.py`, `main.py` are in `services/api/src/jadhr_api/`; the build's `collections.py` is named "pipeline collections.py" (`pipeline/src/jadhr_pipeline/collections.py`); `store.ts` is `lib/reader/store.ts`. Quoted e2e titles come from `apps/web/e2e/*.spec.ts`, shortened with "…" where long.

## Summary

| Status | Items |
|---|---|
| done | 133 |
| adapted | 39 |
| bug-fixed | 19 |
| n/a | 1 |
| open | 17 |
| waiting | 14 |
| **total** | **223** |

Closed (done + adapted + bug-fixed + n/a): 192 of 223. Open: 17, all buildable now in these screens (group A). Waiting: 14, on P6 (accounts), P7 (contribution), P8 (graph platform), P9 (classroom) and P11 (the ecosystem) — group B. No item needs an owner decision beyond the decisions the approved plan already names.

| Screen | Items | done | adapted | bug-fixed | n/a | open | waiting | closed |
|---|---|---|---|---|---|---|---|---|
| Hub | 61 | 38 | 12 | 0 | 1 | 3 | 7 | 51 of 61 |
| Collections | 63 | 37 | 17 | 5 | 0 | 4 | 0 | 59 of 63 |
| Notebook | 69 | 45 | 4 | 10 | 0 | 5 | 5 | 59 of 69 |
| Review deck | 18 | 9 | 2 | 2 | 0 | 5 | 0 | 13 of 18 |
| Shared shell | 12 | 4 | 4 | 2 | 0 | 0 | 2 | 10 of 12 |
| **Total** | **223** | **133** | **39** | **19** | **1** | **17** | **14** | **192 of 223** |

The brief's ranges alone (HUB-01…50 + Q, COL-01…54 + Q, NTB-01…54 + Q, RDR §25 + 536, SHL-18…28 + 40) are 213 items; the 10 hard-won fixes (HUB-F, COL-F, NTB-H) make the 223, and all 10 are closed.

| § | Inventory section | Items | done | adapted | bug-fixed | n/a | open | waiting |
|---|---|---|---|---|---|---|---|---|
| 2.1 | Hub — Layout and elements (HUB-01…28) | 28 | 18 | 5 | 0 | 0 | 1 | 4 |
| 2.2 | Hub — Sign-in sheet (HUB-29…36) | 8 | 1 | 3 | 0 | 1 | 2 | 1 |
| 2.3 | Hub — Interactions, keyboard, URL, persistence (HUB-37…42) | 6 | 4 | 2 | 0 | 0 | 0 | 0 |
| 2.4 | Hub — Phone and dark mode (HUB-43…44) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 2.5 | Hub — Cross-check against 06 §6.1 and 01 §1.2 (HUB-45…50) | 6 | 5 | 1 | 0 | 0 | 0 | 0 |
| 2.6 | Hub — Quran adaptation notes (HUB-Q01…Q08) | 8 | 5 | 1 | 0 | 0 | 0 | 2 |
| 8 | Hub — Hard-won fixes (HUB-F01…F03) | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| | **Hub subtotal** | **61** | **38** | **12** | **0** | **1** | **3** | **7** |
| 3.1 | Collections — Header (COL-01) | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 3.2 | Collections — Home view (COL-02…18) | 17 | 8 | 5 | 3 | 0 | 1 | 0 |
| 3.3 | Collections — The curated sets (COL-19…28) | 10 | 0 | 9 | 1 | 0 | 0 | 0 |
| 3.4 | Collections — Set view (COL-29…38) | 10 | 7 | 1 | 1 | 0 | 1 | 0 |
| 3.5 | Collections — Study swipe deck (COL-39…44) | 6 | 5 | 0 | 0 | 0 | 1 | 0 |
| 3.6 | Collections — States, URL, persistence, keyboard (COL-45…48) | 4 | 2 | 2 | 0 | 0 | 0 | 0 |
| 3.7 | Collections — Phone and dark mode (COL-49…50) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 3.8 | Collections — Cross-check against 06 §6.2 (COL-51…54) | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| 3.9 | Collections — Quran adaptation notes (COL-Q01…Q07) | 7 | 6 | 0 | 0 | 0 | 1 | 0 |
| 8 | Collections — Hard-won fixes (COL-F01…F02) | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| | **Collections subtotal** | **63** | **37** | **17** | **5** | **0** | **4** | **0** |
| 2.1 | Notebook — Route, header, tabs (NTB-01…04) | 4 | 3 | 1 | 0 | 0 | 0 | 0 |
| 2.2 | Notebook — Notes list (NTB-05…18) | 14 | 10 | 0 | 4 | 0 | 0 | 0 |
| 2.3 | Notebook — Editor pane (NTB-19…34) | 16 | 8 | 0 | 3 | 0 | 3 | 2 |
| 2.4 | Notebook — Note shapes from producers (NTB-35…38) | 4 | 3 | 1 | 0 | 0 | 0 | 0 |
| 2.5 | Notebook — Journal (NTB-39…53) | 15 | 8 | 2 | 3 | 0 | 1 | 1 |
| 2.6 | Notebook — Phone and dark (NTB-54) | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2.7 | Notebook — Quran adaptation notes (NTB-Q01…Q10) | 10 | 7 | 0 | 0 | 0 | 1 | 2 |
| 6 | Notebook — Hard-won fixes (NTB-H01…H05) | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| | **Notebook subtotal** | **69** | **45** | **4** | **10** | **0** | **5** | **5** |
| 25 | Review deck (RDR-344…360) | 17 | 9 | 2 | 1 | 0 | 5 | 0 |
| 39 | Prototype bugs — review (RDR-536) | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| | **Review deck subtotal** | **18** | **9** | **2** | **2** | **0** | **5** | **0** |
| 1.2 | Shared shell — Hub-only parts (SHL-18…28) | 11 | 4 | 4 | 2 | 0 | 0 | 1 |
| 1.3 | Shared shell — Footer (SHL-40) | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| | **Shared shell subtotal** | **12** | **4** | **4** | **2** | **0** | **0** | **2** |
| | **Total** | **223** | **133** | **39** | **19** | **1** | **17** | **14** |

## Defects found while auditing

Beyond parts not yet built, reading the code found these faults in what is built. The ones that make an item misbehave are also its row's reason for `open`.

### Wrong behaviour

- **The in-context card marks the everyday spelling wrong** (RDR-355): each blank is checked against the word's Uthmani form only (`w.text_uthmani as surface`, review.py:87-93), folded by `normalize`, which strips the dagger alif U+0670 with the other marks (lib/arabic/normalize.ts:10-11) and keeps the mushaf's wāw for alif and open tāʾ (ReviewDeck.tsx:246-250). So «الكتاب» typed for «ٱلْكِتَٰبَ» folds to «الكتاب» against «الكتب», «العالمين» for «ٱلْعَٰلَمِينَ» to «العالمين» against «العلمين», «الصلاة» for «ٱلصَّلَوٰةَ» to «الصلاه» against «الصلوه» — each "wrong", though the card says "type each, with or without vowels" (ar.json review.contextNote). The e2e test pins the fault: it types the Uthmani skeleton with the dagger alif stripped, not what a reader types (review-deck.spec.ts:70). The words table already carries the imlāʾī form and its shadows (`text_imlaei`, `norm`, `norm_plain`; analyse.py:119, concordance.py:68).
- **"Review kept words" does not review the words kept in the set** (COL-38, RDR-360): the set row's Keep only sets the word "learning" (ExploreScreen.tsx:242, 277); the review queue takes starred and known words (ReviewDeck.tsx:36). A reader who presses Keep on five words and then «راجع ما احتفظت به» (ExploreScreen.tsx:225) reviews none of them. Only the study deck's Keep also stars (StudyDeck.tsx:48-49), which is the path journey B tests (journey-b.spec.ts:51-56).
- **The deck's key hint is reordered in Arabic** (COL-41): `<p dir="ltr">` around «← تخطَّ • → احتفظ» (StudyDeck.tsx:142; ar.json explore.deckKeys). In a left-to-right paragraph the neutrals between the two Arabic words take the right-to-left direction, so the line draws as «← احتفظ → • تخطَّ»: both arrows flank «احتفظ» (keep) and the left arrow, which skips, sits beside it.
- **The hub shows the split view as working** (HUB-19): its destination has no `phase` (lib/destinations.ts:21), so the tile carries no «قيد البناء», while `/split` renders the "being built" placeholder for P8 ((app)/split/page.tsx:13). The hub test only checks that every link answers under 400 (hub.spec.ts:90-94), which a placeholder does.
- **Emptying a verse note in the Notebook keeps the old text** (NTB-35, minor): the editor writes only non-empty text, since an empty write deletes the note in the saved store (NotebookScreen.tsx:284-285); the field shows empty, the old note stays and comes back on the next visit, with no word said.
- **A failed save on the Notebook or Explore is silent** (NTB-Q01): free notes and word states are written to localStorage (lib/store/notebook.ts:35; safeStorage.ts:23-29), whose quota every `jadhr-` store shares; a failed write raises `jadhr:storage-error`, which only the reader listens for (reader5/Overlays.tsx:36-40). On `/notebook` a note that could not be stored looks saved and is gone at reload.
- **The study deck plays a slice without its warning** (COL-44, minor): the recording button appears (StudyDeck.tsx:139) without `WordAudioNote` (reader5/Listen.tsx:23-33), though DECISIONS (2026-10-03, word audio) says each slice's flags (waṣl, joined, uncertain…) are said under the play button.

### Claims the data does not hold

- **"Never sent to any server"** (HUB-31, NTB-Q02): the hub says «قراءتك ونجومك وملاحظاتك محفوظة في هذا المتصفح وحده، ولا تُرسل إلى أي خادم» (ar.json hub.promptBody) and the Notebook «دفترك في هذا المتصفح وحده، لا يُرسل إلى أي خادم» (ar.json notebook.private). Once the reader has starred or known any word, the whole list is POSTed to `/lemmas/roots` from every reader page and from the Notebook (ReaderHeader.tsx:40 → ReviewDeck.tsx:32-50), the words met to `/lemmas/coverage` (ExploreScreen.tsx:130; lib/collections.ts:33-37), and every @-mention of a note to `GET /search` (below). They are not stored, but they are sent; the accurate claim is "never stored on a server", or the mentions must stop leaving the browser.
- **The hub's note count leaves out the Notebook** (HUB-30): «على هذا الجهاز: {saved} و{notes}» counts the saved store's verse notes only (LocalFirstPrompt.tsx:21-24); free notes (`jadhr-notebook`) and saved trails are not counted, so a reader with only Notebook notes is told «كل ما هنا يعمل بلا حساب» as if the device held nothing.
- **"All time" in the journal is the last 60 sessions** (NTB-45): the roots-met count is built from the session log (NotebookScreen.tsx:459, 516), which keeps 60 sessions (store.ts:253, 345); after sixty reading days «منذ البداية» undercounts.
- **The progress card reads "٠ roots" while it loads** (COL-11): `roots: cov.data?.roots ?? 0` (ExploreScreen.tsx:137) prints ٠ until the coverage POST returns, and for good if it fails — the request has no error state.
- **The review deck's meta names only stars** (minor): «جذور كلماتك المحفوظة» / "roots of your starred words" (ar.json review.metaMine) while the queue also takes words marked known (ReviewDeck.tsx:36).
- **The Read door promises the reader's own texts** (HUB-07, minor): «— ونصوصك أنت أيضًا» (ar.json hub.doorReadSub) on a door that opens `/read` (page.tsx:65), the Quran reader, which cannot open them; they are read at `/library/text/{id}`, and "the reader's texts in the full reader" waits on P11 (PLAN P4.4).

### Privacy

- **A private note's mentions go out in a URL** (NTB-28): each @-mention is resolved by `GET /api/v1/search?q={mention}&limit=5` (NotebookScreen.tsx:349-355), debounced as the reader types (line 345). Words and roots from a note the screen calls private reach the access log and the URL-keyed response cache — the exact path the decision for the reader's texts closes ("never sits in a URL, a log line or a cache", DECISIONS 2026-10-03). Resolving roots and words needs either a POST endpoint or a match in the browser.
- **The open note is in the address bar and goes to the server** (minor): selecting a note does `router.replace('/notebook?note={id}')` (NotebookScreen.tsx:53-62) on a `force-dynamic` page that reads `searchParams` (notebook/page.tsx:6, 14-18), so each selection is a server request carrying the id — `v:2:255` for a verse note (which verse the reader wrote on), `n` + a base-36 timestamp for a free note (when it was written).
- **The review deck asks for each due root by GET with its repetition count** (minor): `/roots/{key}/review?pick={reps}` (ReviewDeck.tsx:174, 183; main.py:596-601). The server log gets the reader's due roots in order and how often each was reviewed, while the decision keeps the reader's word lists in POST bodies (DECISIONS 2026-10-03, the reader's own texts and P5.3).

### Accessibility, phone and dark mode

- **The review overlay is a dialog without a focus trap or focus return** (RDR-347, RDR-461's rule in PLAN P2.8: "every dialog has its role, label, focus trap and focus return"): `role="dialog" aria-modal="true"` and focus on «أنهِ الجلسة» (ReviewDeck.tsx:105-115, 130), but it does not use `ui/Dialog` — Tab walks into the reader behind it, and closing leaves focus nowhere. `data-autofocus` on the first blank (ReviewDeck.tsx:314) is read only by `ui/Dialog`, so it does nothing here.
- **The study deck loses focus at its end card** (minor): the focused card button is replaced by the end card (StudyDeck.tsx:82-98), focus falls to the body, and the dialog's trap only wraps from its first or last item (ui/Dialog.tsx:44-55), so the next Tab leaves the dialog.
- **Touch targets under 40 px on phones** (02 §2.6: ≥ 40 px, ≥ 44 in overlays; law L7: 44 px): `.hub-try` 32 px (globals.css:3535), `.hub-chip` 34 px (3421), `.hub-context-clear` 34 px (3436), `.wotd-pill` 30 px (3750), `.root-chip` 32 px (3863, used in the set rows, the set's side panel and the journal), the Notebook's linked chips 32 px (NotebookScreen.tsx:395), a tag's remove button 22 × 22 px (globals.css:4127-4128) and the tag input 26 px (4138). The phone rule that lifts `.btn` and `.seg` to 40 px (globals.css:313-322) does not reach them.
- **No axe run on most of these surfaces, none in dark** (a11y.spec.ts:4, 20): the light runs include `/`, `/explore` and an empty `/notebook`; nothing runs on a set (`/explore?set=…`), the study deck, the review overlay (`?mode=review`), `/notebook?tab=journal` or a note open, and the dark runs cover only `/en` among these pages. The review-deck spec skips phones entirely (review-deck.spec.ts:21); the in-context card is exercised on a phone by no test.

### Arabic digits and agreement

- **Latin digits in the Arabic UI**: the note placeholder's example «آية (@2:255)» (ar.json notebook.bodyPlaceholder; the parser accepts «@٢:٢٥٥»); the al-Shāfiya quote's attribution on `/explore?set=places` — «(ت 646هـ) … ط1، 1415هـ/1995م … الإصدار 2025.1.9» (data/patterns.yaml:169, shown by ExploreScreen.tsx:195); and the footer's «إصدار البيانات 2026.10.0» (ar.json footer.dataset; SiteFooter.tsx:30-34) — an identifier, so this one is the owner's call. No middle dot «·» was found in any file or message of these screens (a grep with a planted positive control).
- **«عائلات» whatever the number** (minor): «تذكّرت {k} من {n} عائلات كاملة» (ar.json review.doneSummary; ReviewDeck.tsx:153) reads «من ١ عائلات», «من ١٢ عائلات»; it needs the plural rules the other counts use.
- **Fixed counted nouns on the hub's doors** (latent): «{surahs} سورة و{verses} آية» and «{roots} جذرًا و{lemmas} كلمة» (ar.json hub.doorReadSub, doorLookupSub) are right for today's 114, 6,236, 1,642 and 4,832 only; PLAN P2.4 promises agreement in every count, and the e2e test pins the current forms (hub.spec.ts:83-84).

## Open and waiting items

### A · Open — buildable now in these screens (17)

| ID | Missing | Files it would touch |
|---|---|---|
| HUB-19 | (minor) the split-view tile marked «قيد البناء» like the other later surfaces | lib/destinations.ts:21 |
| HUB-30 | the note's count of notes including the Notebook's free notes (and saying trails, or not) | home/LocalFirstPrompt.tsx:21-28; ar.json/en.json hub.promptTitle |
| HUB-31 | a privacy sentence the code keeps: "never stored on a server" — or nothing personal sent at all (see NTB-28) | ar.json/en.json hub.promptBody, notebook.private |
| COL-11 | the roots count shown only once known, and an error state for the coverage request | explore/ExploreScreen.tsx:130-140 |
| COL-38 | Keep in a set row that brings the word into review (star it as the deck does, or let the queue take words kept from sets) | explore/ExploreScreen.tsx:242, 274-282; reader5/ReviewDeck.tsx:36; DECISIONS (study deck) |
| COL-41 | (minor) the key hint drawn in the right order in Arabic | explore/StudyDeck.tsx:142; ar.json explore.deckKeys |
| COL-Q06 | (minor) transliteration lines that follow the reader's transliteration preference (off by default in Arabic) | explore/ExploreScreen.tsx:75-78, 250; explore/StudyDeck.tsx:122; lib/reader/store.ts:170 |
| NTB-21 | (minor) tag autocomplete from the reader's existing tags | notebook/NotebookScreen.tsx:225-240 |
| NTB-28 | mentions resolved without putting the note's words in a GET URL | notebook/NotebookScreen.tsx:343-380; main.py (a POST resolver) or lib (a browser-side match) |
| NTB-31 | backlinks: the notes that mention a root, word or verse listed on its entry | reader5/WordEntry.tsx and the verse entry; app/[locale]/(site)/roots/[root]/page.tsx; lib/store/notebook.ts:12-13 (keep word slugs in `links`) |
| NTB-45 | (minor) an all-time roots count that outlives the 60-session cap, or a label that says what it counts | lib/reader/store.ts:253, 345; notebook/NotebookScreen.tsx:459, 516 |
| NTB-Q01 | (minor) notes in IndexedDB as the reader's texts are, and a failed write told to the reader on these pages | lib/store/notebook.ts:35; lib/library/texts.ts (the model); app/[locale]/(site)/layout.tsx or a shared listener for `jadhr:storage-error` |
| RDR-351 | (minor) the P2.0 resolution — Space to reveal, four grades — or a DECISIONS entry that keeps the prototype's three | reader5/ReviewDeck.tsx:196-243; lib/store/review.ts:13-28; DECISIONS |
| RDR-354 | (minor) the hint per blank before checking (its pattern and part of speech, as the root card gives) | review.py:87-93; reader5/ReviewDeck.tsx:294 |
| RDR-355 | an answer in everyday spelling accepted (compare with the imlāʾī form and the plain shadow too), and the test typing what a reader types | review.py:87-93; reader5/ReviewDeck.tsx:246-250; e2e/review-deck.spec.ts:70 |
| RDR-356 | (minor) "Revealed so far": after checking, each blank's word with its transliteration, gloss, part of speech and count | reader5/ReviewDeck.tsx:254-333 (the unused `review.revealed` message exists); review.py:87-93 |
| RDR-360 | Collections' Keep starring the word (the set row; the deck already does) | as COL-38 |

### B · Waiting on later phases (14)

| ID | Missing | Waits on |
|---|---|---|
| HUB-23 | the review queue behind its tile (listed «قيد البناء», lib/destinations.ts:25) | P7 |
| HUB-24 | the classroom behind its tile (destinations.ts:26) | P9 |
| HUB-25 | published graphs (a tile with no link, destinations.ts:27) | P8.5 |
| HUB-26 | the profile behind its tile (destinations.ts:28) | P6.3 |
| HUB-33 | sign-in providers | P6 (D3: email magic link, Google, Apple) |
| HUB-Q05 | the Arabic dictionary beyond the Quran, the hadith encyclopedia and the book reader among the destinations (the counts are computed) | P11.1–P11.3 |
| HUB-Q07 | the sign-in sheet's copy and options (the local-first promise and the export are built) | P6 (D3) |
| NTB-22 | "→ Description card" and "→ Propose" (Delete is built) | P8 (cards), P7 (proposals) |
| NTB-23 | a proposal from a note | P7 |
| NTB-53 | the journal on the server (`/me/journal` from opt-in lookup events) | P6.1–P6.2 |
| NTB-Q02 | opt-in sync, encryption at rest, a stated retention (local by default is built) | P6 |
| NTB-Q07 | a proposal form prefilled from the note, never an automatic submission | P7 |
| SHL-21 | the Sign in button and the signed-in avatar | P6 |
| SHL-40 | the footer's "Contribute" link | P7 |

## Stale or inconsistent lines in PLAN (not edited here)

- **P5's heading reads "✅ pending its inventory audit"** and P5.1–P5.5 read ✅; this audit leaves 17 items open, including two faults journey B does not reach (RDR-355, COL-38).
- **P2.0's review resolution is not what P5.3 built**: P2.0 says "review per the spec (scheduler, four grades, Space to flip) keeping the prototype's per-word reveal"; P5.3 and DECISIONS (2026-10-03, review deck) describe three grades and no Space key, and no entry says the resolution changed.
- **P5.1 says "twenty surfaces with visible purposes ('being built' where they are)"**: the split view is not marked (HUB-19).
- **§3.2 still lists the review deck and "Review with due count" as missing from the Reader**, and "Journeys A–F ⬜ None works end to end" — journey A (P2.11) and journey B (P5.5) have e2e tests.
- **§8 Tier 1 proposals placed in P5 have no status line and no code**: B4 "Hear the root" playlist (P2/P5) and B5 Quranic Arabic path by frequency (P5), both approved with the plan as "build inside the phase named". No new proposal was added to §8 at the P5 boundary, which `CLAUDE.md` asks for at every phase boundary.
- **P1.6's nav list** omits «اسأل», which the nav carries (shell/NavLinks.tsx:11).

Noticed outside these screens (not counted): the placeholders the hub's "being built" tiles open print a plan code to readers — «المرحلة في الخطة P7» (shell/ScreenSkeleton.tsx:18-20; ar.json screens.plan) — though DECISIONS (2026-10-03, the hub) says plan codes are not shown to readers; and the reader's trail toast says only «حُفظ المسار» where the design's says where it went ("see Notebook", NTB-36; ar.json rd.trailSaved).

## All items

### Hub

| ID | status | evidence / reason |
|---|---|---|
| HUB-01 | adapted | Paper from header to footer in both themes (globals.css:3376-3383; `--paper` at 20 and 55); the shared header instead of a bespoke one, the resume strip, the hero, the sections and the footer (page.tsx:46-115; (site)/layout.tsx:11-15); no sign-in sheet — a note on the page (LocalFirstPrompt.tsx). DECISIONS 2026-10-03 "The hub wears the shared header" |
| HUB-02 | adapted | The glyph is the root of the day for Mecca's date, linked to its root page, Amiri 44 px, root colour, letter-spacing .12em (RootOfTheDay.tsx:15-41; globals.css:3460-3475) — HUB-Q02; DECISIONS 2026-10-03 word of the day; e2e "the masthead: the root of the day for Mecca's date…" |
| HUB-03 | done | h1 «اقرأ القرآن الكريم من جذور كلماته», clamp(26px,4vw,36px)/600 (page.tsx:51; globals.css:3493-3503; ar.json hub.title); same e2e |
| HUB-04 | done | The premise rewritten for the Quran, 16 px, t2, `text-wrap: pretty`, max 640 px (page.tsx:62; globals.css:3511-3517; ar.json hub.lead) |
| HUB-05 | done | min(560px,100%), radius 12, `--sh`, search icon 18 px, placeholder, `aria-label`, `dir="auto"`, ↵ submit (HubSearch.tsx:39-65; globals.css:3518-3591) |
| HUB-06 | done | Three doors, `repeat(auto-fit, minmax(200px, 1fr))`, dot + title + visible sub-line, hover border (page.tsx:64-80; globals.css:3592-3622) |
| HUB-07 | adapted | The Read door opens the reader at the resume point (`/read`, page.tsx:65-69), not the Library, which has its own tile (destinations.ts:14); reason not recorded. Its sub-line promises the reader's own texts, which `/read` cannot open (defects) |
| HUB-08 | done | Look up → `/read?mode=lookup` with roots, lemmas and lexica counted from `/meta` and `/lexicon/works` (page.tsx:35-41, 70-74) — HUB-Q05; e2e "the doors count from the data…" |
| HUB-09 | done | Map → `/graph` (page.tsx:75-79) |
| HUB-10 | adapted | «كل ما في المنصة» over `repeat(auto-fill, minmax(200px, 1fr))` of 20 tiles, each title + visible purpose; no dots (HUB-50), no tags (HUB-28) (page.tsx:83-110; destinations.ts:10-31; globals.css:3631-3668); e2e "…every surface is listed with its purpose…" counts 20 with a purpose each |
| HUB-11 | done | Ask → `/read?mode=ask` (destinations.ts:12) |
| HUB-12 | done | Explore → `/explore` (destinations.ts:13) |
| HUB-13 | done | Reader → `/read` (destinations.ts:11) |
| HUB-14 | done | Library → `/library` (destinations.ts:14) |
| HUB-15 | done | Dictionary → `/read?mode=lookup` (destinations.ts:15) |
| HUB-16 | done | Concordance → `/concordance` (destinations.ts:17) |
| HUB-17 | done | Analyser → `/analyse` (destinations.ts:18) |
| HUB-18 | done | Graph → `/graph` (destinations.ts:20) |
| HUB-19 | open | (minor) The tile exists → `/split` (destinations.ts:21) but carries no `phase`, so it shows as working while `/split` is the P8 placeholder ((app)/split/page.tsx:13) (defects). The view itself is P8.6 |
| HUB-20 | done | Review → `/read?mode=review` (destinations.ts:22), opened by ReaderShell.tsx:54 |
| HUB-21 | done | Notebook → `/notebook` (destinations.ts:23) |
| HUB-22 | done | Search → `/search` (destinations.ts:19) |
| HUB-23 | waiting | P7: the tile is listed «قيد البناء» (destinations.ts:25; page.tsx:91); `/review` is a placeholder ((site)/review/page.tsx:13) |
| HUB-24 | waiting | P9: «قيد البناء» (destinations.ts:26) |
| HUB-25 | waiting | P8.5: «قيد البناء», no link (destinations.ts:27; page.tsx:101-105) |
| HUB-26 | waiting | P6.3: «قيد البناء» (destinations.ts:28) |
| HUB-27 | adapted | Two working tiles instead of one: the API (`/developers`) and Sources & licences (`/sources`) (destinations.ts:29-30); the designed Data & API screen (downloads, playground) is P10 |
| HUB-28 | done | No exploration tags; a later surface says «قيد البناء», never a plan code (page.tsx:91; destinations.ts:1-7) |
| HUB-29 | adapted | No sheet and no Sign in until accounts exist: an on-page note, dismissible (LocalFirstPrompt.tsx:25-41). DECISIONS 2026-10-03 the hub ("There is no sign-in button until accounts exist (P6)") |
| HUB-30 | open | Data-driven title with Arabic plurals — «على هذا الجهاز: {saved} و{notes}», else «كل ما هنا يعمل بلا حساب» (LocalFirstPrompt.tsx:21-29; ar.json hub.promptSaved, promptNotes); e2e "the local-first note…". Missing: the Notebook's free notes in the count (defects) |
| HUB-31 | open | Body copy present (LocalFirstPrompt.tsx:30; ar.json hub.promptBody). Its «ولا تُرسل إلى أي خادم» is not what the code does (defects) |
| HUB-32 | adapted | No ✕: «ليس الآن» hides the note for good (LocalFirstPrompt.tsx:19-23, 37-39; store.ts:397) |
| HUB-33 | waiting | P6 (D3): no providers before accounts |
| HUB-34 | done | «صدّر بياناتي» exports every `jadhr-` store now, «بلا تتبع ولا إعلانات», «ليس الآن» (LocalFirstPrompt.tsx:31-40; lib/localData.ts:31-55); e2e "the local-first note…" reads the downloaded file |
| HUB-35 | n/a | The fake identity is a prototype placeholder that must never ship; nothing writes an account |
| HUB-36 | adapted | Not a modal, so no scrim or Esc: one dismissal, persisted (LocalFirstPrompt.tsx:19-23, 37); e2e "…Not now stays dismissed" |
| HUB-37 | done | ⌘K / Ctrl+K, `preventDefault` first, focuses the hero field while it is on screen; scrolled away the omnibox opens (HubSearch.tsx:21-36; search/SearchLauncher.tsx:12-17); e2e "search: the Quran's own queries, ⌘K back to the field…" |
| HUB-38 | adapted | One field: the shared header has a search button that opens the omnibox, not a second input (search/SearchLauncher.tsx:38-50); Enter or ↵ → `/search?q=` (HubSearch.tsx:43-46); same e2e |
| HUB-39 | done | No URL parameter read on `/` (page.tsx:31-33 reads the locale only) |
| HUB-40 | adapted | Reads the personal store (context, its clear time, `progress.quran`, the dismissal) and the saved store (bookmarks, verse notes); writes the cleared context and the dismissal (ContextStrip.tsx:21-24; LocalFirstPrompt.tsx:19-22; store.ts:396-397) — our stores, no account (P6) |
| HUB-41 | done | First visit: no strip, the generic title; returning: the strip and the counted title (ContextStrip.tsx:46; LocalFirstPrompt.tsx:24-29); e2e "a first visit has nothing to resume…", "pick up where you left off…". The signed-in avatar is SHL-21 (P6) |
| HUB-42 | done | Strip and note render after hydration; the glyph slot keeps its height when the word of the day is missing (RootOfTheDay.tsx:26; globals.css:3460-3468) |
| HUB-43 | done | Hero padding clamp, doors one column at 390 px, tiles two columns ≤ 520 px, the shared header folds into a menu (globals.css:3444-3453, 3592-3599, 3678-3686; shell/NavLinks.tsx:42; shell/MobileMenu.tsx); e2e masthead test checks no horizontal scroll on phones. Small targets: defects |
| HUB-44 | done | Tokens only — paper, root colour, door dots as type tokens (globals.css:20, 55, 3376-3383); axe dark on `/en` (a11y.spec.ts:20) |
| HUB-45 | done | «معنى الاسم»: جَذْر with Ibn Fāris's statement and «ابن فارس، مقاييس اللغة ١/٤٣٦» (page.tsx:52-61); e2e masthead |
| HUB-46 | done | «تابع من حيث توقفت» from the reading position (sūra and verse), else the last verse, then word and root (ContextStrip.tsx:31-46); e2e "pick up where you left off…" |
| HUB-47 | done | A visible purpose on every tile (page.tsx:89-90; ar.json hub.dest.*.purpose); e2e checks each is non-empty |
| HUB-48 | done | On the page, saying everything works without an account (LocalFirstPrompt.tsx; ar.json hub.promptTitleEmpty, promptBody); e2e "the local-first note…" |
| HUB-49 | done | Footer and index kept (shell/SiteFooter.tsx; page.tsx:83-110) |
| HUB-50 | adapted | Type colours on the three doors only (text, root, form), tiles neutral (page.tsx:66-76; destinations.ts:5-6). DECISIONS 2026-10-03 the hub |
| HUB-Q01 | adapted | `<html lang dir>` per locale with Arabic at `/` (app/[locale]/layout.tsx:52); English is the `/en` link, not a stored preference — DECISIONS 2026-10-02 (canonical Arabic URLs) |
| HUB-Q02 | done | Quran-first premise and a live root of the day (page.tsx:50-62; RootOfTheDay.tsx; daily.py:37-55); e2e masthead |
| HUB-Q03 | done | «كلمة، أو جذر، أو آية» with example links «عِلْم» • «ع ل م» • «٢:٢٥٥» • «البقرة ٢٥٥» (English adds k-t-b) (HubSearch.tsx:54, 66-75; ar.json hub.searchExamples); e2e "search: the Quran's own queries…" |
| HUB-Q04 | done | Sūra name and verse, word, root; the text chip resumes at the verse `/quran/{s}#v{a}` (ContextStrip.tsx:32-45); e2e "pick up where you left off…" |
| HUB-Q05 | waiting | P11.1–P11.3: the counts are computed (page.tsx:35-41, 68, 73); the Arabic dictionary beyond the Quran, the hadith encyclopedia and the book reader are not among the destinations (destinations.ts) |
| HUB-Q06 | done | No tags; Arabic purposes on every destination (destinations.ts; ar.json hub.dest) |
| HUB-Q07 | waiting | P6 (D3): the local-first promise and the export are built (LocalFirstPrompt.tsx); sign-in copy and options come with accounts |
| HUB-Q08 | done | Local counts, reading position, context, destination catalogue with counts, search endpoint (page.tsx:35-41; ContextStrip.tsx; LocalFirstPrompt.tsx; HubSearch.tsx:45). Auth state is SHL-21 (P6) |
| HUB-F01 | done | `preventDefault()` and `stopPropagation()` before focusing, in the capture phase (HubSearch.tsx:28-34) |
| HUB-F02 | done | Never a wall: on the page, dismissible, the export offered, what works without an account said (LocalFirstPrompt.tsx:25-41) |
| HUB-F03 | done | The strip hides when it has nothing and has Clear (ContextStrip.tsx:46, 68-70); e2e "…Clear hides it and keeps the reading" |

### Collections

| ID | status | evidence / reason |
|---|---|---|
| COL-01 | done | «استكشف» active in the shared nav (shell/NavLinks.tsx:12); «اسأل عن كلمة» → `/read?mode=ask` (ExploreScreen.tsx:29-33) |
| COL-02 | done | Max 1100 px, padding, gap 24; top row `minmax(0,1fr) minmax(220px,280px)` (globals.css:3689-3701) |
| COL-03 | adapted | The headword is the link, not the whole card: the card also holds root and verse links, which cannot nest inside one (ExploreScreen.tsx:67-118); gradient with dark variants, radius 16 (globals.css:3702-3722). Plain reason, not in DECISIONS |
| COL-04 | adapted | «كلمة اليوم • {Mecca's date} • {Hijri, Umm al-Qurā}», formatted once on the server (explore/page.tsx:18-27, 40; ExploreScreen.tsx:68-70) — COL-10, COL-Q01; DECISIONS 2026-10-03 word of the day; e2e "the word of the day: Mecca's date with the Hijri one…" |
| COL-05 | done | Headword 46 px Amiri RTL; transliteration (and the gloss in English) in its own LTR span (ExploreScreen.tsx:71-79; globals.css:3732-3746) |
| COL-06 | adapted | No second sense or English root gloss (none cited, law L2): the root's statement in Ibn Fāris's words with work and page (ExploreScreen.tsx:89-97; daily.py:83-104) |
| COL-07 | adapted | Pills: the root (a link to its page), the pattern, the occurrences (ExploreScreen.tsx:80-88) |
| COL-08 | done | → `/read?mode=ask&q={word}` (ExploreScreen.tsx:72); e2e checks the href |
| COL-09 | done | SHA-256 of the date over √occurrence weights (daily.py:37-55); e2e reads `/word-of-the-day?date=` for Mecca's date |
| COL-10 | bug-fixed | Mecca's day for both the choice and the label (daily.py:27-34; explore/page.tsx:20-27); DECISIONS 2026-10-03 word of the day |
| COL-11 | open | Card built — label, «{n} كلمة لقيتها», known • learning • roots, coverage, no-streak line (ExploreScreen.tsx:122-144); e2e "progress counts words met…". Missing: the roots figure reads ٠ while the coverage POST is pending and if it fails (line 137) (defects) |
| COL-12 | adapted | Met = words marked learning or known (the third Keep writes "new", which is not met, ExploreScreen.tsx:17, 127); roots touched and coverage from `POST /lemmas/coverage` (ExploreScreen.tsx:129-130; collections.py:98-112) |
| COL-13 | done | No streak; «لا عدّاد أيام ولا خسارة: الكلمات تنتظرك.» (ExploreScreen.tsx:141; ar.json explore.noStreaks); same e2e |
| COL-14 | done | «مجموعات» + sub-line (ExploreScreen.tsx:42-46) |
| COL-15 | done | Cards as links (each set has a URL, COL-18), `repeat(auto-fill, minmax(230px, 1fr))`, 3px top border in the set colour, title, meta, sample joined «•», status (ExploreScreen.tsx:146-162; globals.css:3796-3817) |
| COL-16 | done | «جديدة» / «لقيت {k} من {n}» amber / «لقيتها كلها» green (ExploreScreen.tsx:151-152, 159); e2e "the sets: counted from the data…" |
| COL-17 | bug-fixed | ICU plurals for words and roots (ar.json explore.words, roots; ExploreScreen.tsx:157) |
| COL-18 | bug-fixed | The card is a link that pushes `/explore?set=` (ExploreScreen.tsx:154-155); e2e "…a set opens on its own URL that Back leaves" |
| COL-19 | adapted | ʿ-l-m kept as «عائلة واحدة: ع ل م», rule root علم, copy rewritten for the Quran (data/collections.yaml:12-21) — COL-Q03; DECISIONS 2026-10-03 curated sets |
| COL-20 | adapted | Every word of the root, most frequent first, no silent cap (collections.yaml:12-21 has no `limit`; pipeline collections.py:81-86) |
| COL-21 | adapted | «على وزن فاعِل»: active participles on fāʿil (collections.yaml:23-32) |
| COL-22 | adapted | Items computed by the build, the 12 most frequent (pipeline collections.py:81-92) |
| COL-23 | bug-fixed | A word the copy names goes in `mentions`; the build fails if the rule does not yield it (pipeline collections.py:87-90; collections.yaml:1-5); DECISIONS 2026-10-03 curated sets |
| COL-24 | adapted | «على وزنَي مَفْعَل ومَفْعِل», nouns, with al-Shāfiya's rule quoted with its source (collections.yaml:34-45; pipeline collections.py:94-116) |
| COL-25 | adapted | Computed as COL-22 |
| COL-26 | adapted | Not built as such: no cited source says which Quranic words travelled into Turkish, Persian or Urdu (law L2). The six sets are ʿ-l-m, fāʿil, mafʿal/mafʿil, the most frequent, particles, al-Suyūṭī's loanwords (collections.yaml:11-83). Plain reason, not in DECISIONS |
| COL-27 | adapted | As COL-26 |
| COL-28 | adapted | A `limit` per set (12) or none, most frequent first (collections.yaml:32, 43, 57, 68, 82; pipeline collections.py:81-86); a set under four items fails the build (91-92) |
| COL-29 | done | `minmax(0,1fr) 300px`, side panel on `--panel` (ExploreScreen.tsx:183-229; globals.css:3818-3834) |
| COL-30 | done | «→ كل المجموعات», the set title in its colour, «{n} كلمة» (ExploreScreen.tsx:185-189) |
| COL-31 | done | Intro, max 640 px (ExploreScreen.tsx:180, 190) |
| COL-32 | adapted | Ordinal (Arabic-Indic, zero-padded), headword → its entry, part of speech in Arabic or the gloss in English, transliteration • pattern • count • first place, root chip, actions (ExploreScreen.tsx:235-286). The pattern is named; its function text waits on the reviewed catalogue (P3.3, law L2) |
| COL-33 | done | Open → the Ask card (ExploreScreen.tsx:273) |
| COL-34 | done | Keep → «أتعلّمها» → «أعرفها ✓» → off, saved at once (ExploreScreen.tsx:242, 274-282); e2e "in a set: root chips per word, Keep cycles…" |
| COL-35 | bug-fixed | Stars live in the saved store and word states in the personal store, so Keep neither reads nor overwrites a star (ExploreScreen.tsx:239-242); DECISIONS 2026-10-03 the star |
| COL-36 | done | «لماذا هذه المجموعة», why copy, «جذور هذه المجموعة» as chips → concordance (ExploreScreen.tsx:207-221) |
| COL-37 | done | «اعرضها خريطة» → `/graph/seed?s=` with the set's words as a trail seed (ExploreScreen.tsx:181, 224); e2e checks the href |
| COL-38 | open | The link is there (ExploreScreen.tsx:225), but words kept with the row's Keep are not starred and the queue takes starred and known words only (ReviewDeck.tsx:36): they are not reviewed (defects) |
| COL-39 | done | «ادرسها بالبطاقات» opens the deck (ExploreScreen.tsx:223, 228; StudyDeck.tsx); e2e "the study deck: Space turns the card…" |
| COL-40 | done | The word on the front; tap or Space turns it; the recording beside the buttons (StudyDeck.tsx:94-136, 139) |
| COL-41 | open | (minor) Swipe, ← / → and buttons work (StudyDeck.tsx:57-70, 101-111, 137-141); e2e desktop and "the deck's buttons do the same on a phone…". Missing: the key hint reads in the wrong order in Arabic (StudyDeck.tsx:142) (defects) |
| COL-42 | done | Keep marks "learning" and stars (StudyDeck.tsx:45-50); e2e checks both stores; DECISIONS 2026-10-03 study deck |
| COL-43 | done | End card with counts and «اذهب إلى المراجعة» (StudyDeck.tsx:82-91); e2e |
| COL-44 | done | The word's recording at its first place, no button without one, never synthesised (StudyDeck.tsx:37-43, 139; reader5/Listen.tsx:14). Its QA flags are not said (defects) |
| COL-45 | adapted | `?set=` validated and fetched on the server (explore/page.tsx:34-38); an unknown id says so with a way back rather than falling back silently (ExploreScreen.tsx:172-178); sets are pushed, not replaced (COL-18); e2e "…an unknown set says so" |
| COL-46 | adapted | Word states, plus stars from the deck (saved store); the words met go to the coverage POST and are kept nowhere (ExploreScreen.tsx:126-130; StudyDeck.tsx:32-34; lib/collections.ts:32-37) |
| COL-47 | done | «لم تلقَ كلمة بعد», «جديدة»; a loading skeleton and a missing-set alert; the word of the day's failure said (ExploreScreen.tsx:64, 171-178); no empty set can be built (pipeline collections.py:91-92). The coverage error is COL-11 |
| COL-48 | done | Set cards and Open are links, Keep a button with `aria-pressed`; the deck's keys (ExploreScreen.tsx:155, 273-282; StudyDeck.tsx:57-70) |
| COL-49 | done | One column below 760 px, the side panel unstuck (globals.css:3916-3927); e2e "the deck's buttons do the same on a phone, and nothing overflows" and the word-of-the-day test check no horizontal scroll |
| COL-50 | done | Dark gradient (globals.css:3713-3722); set colours as type tokens (lib/collections.ts:30). No dark axe run on `/explore` (defects) |
| COL-51 | done | One attestation: the first verse with the word marked, linked into the reader (ExploreScreen.tsx:98-116; daily.py:67-120); e2e checks the marked tokens |
| COL-52 | done | A root chip per word, «لا جذر» for particles (ExploreScreen.tsx:267-271); e2e "in a set: root chips per word…" |
| COL-53 | done | Keep cycles to Known and back (ExploreScreen.tsx:242) |
| COL-54 | done | Words met (ExploreScreen.tsx:134) and each set's advance «لقيت {k} من {n}» (152) |
| COL-Q01 | done | Deterministic by date in Asia/Riyadh, `GET /word-of-the-day?date=`, cached per date (daily.py; main.py:623-648); Arabic label with the Hijri date (explore/page.tsx:18-27); e2e |
| COL-Q02 | done | The first verse, KFGQPC text, the word marked, the credited translation in English, a link to the verse (ExploreScreen.tsx:98-116); e2e |
| COL-Q03 | done | Sets defined in `data/collections.yaml`, computed by the build, served by `GET /collections` (pipeline collections.py; collections.py:20-95; main.py:557-571); copy Arabic first and checked against the items (COL-23); e2e "the sets…", "the loanword set…" |
| COL-Q04 | done | Coverage of the Quran's words by the words met, no streak (collections.py:98-112; ExploreScreen.tsx:129-140); e2e "progress counts words met and how much of the Quran they cover…" |
| COL-Q05 | done | Recording nullable per word (StudyDeck.tsx:37-43, 139); the deck's Keep stars, bringing the family into review; e2e "journey B: …" (Collections part) |
| COL-Q06 | open | (minor) RTL arrows («→ كل المجموعات») and Arabic labels built (ar.json explore.back, keep, learning, known). Missing: transliteration lines follow no preference — always shown (ExploreScreen.tsx:75-78, 250; StudyDeck.tsx:122) while the reader keeps `translitLine`, off in Arabic by default (store.ts:170) |
| COL-Q07 | done | Frequency, root, pattern, English gloss, first place, recording, set definitions, word states, editor seed (collections.py:43-95; daily.py; StudyDeck.tsx:38-43). No Arabic gloss per word by law L2: the entry carries al-Muyassar per place |
| COL-F01 | done | See COL-09, COL-Q01 |
| COL-F02 | done | See COL-13 |

### Notebook

| ID | status | evidence / reason |
|---|---|---|
| NTB-01 | done | `/notebook`; `?tab=journal` opens the journal, anything else the notes (notebook/page.tsx:14-18); e2e "the journal: …" opens `?tab=journal` |
| NTB-02 | done | «الملاحظات {n}» • «السجل» and «+ ملاحظة جديدة» (NotebookScreen.tsx:66-71) |
| NTB-03 | done | A new note is created, selected, and the Notes tab shown (NotebookScreen.tsx:70; lib/store/notebook.ts:26-31); e2e "a new note: …" |
| NTB-04 | adapted | Opens on the note named in `?note=`, else nothing selected (NotebookScreen.tsx:49-51; notebook/page.tsx:17): phones show the list or the note (globals.css:4207-4216), so a note chosen on load would hide the list. Plain reason (notebook.spec.ts:39-40), not in DECISIONS |
| NTB-05 | done | «ابحث في الملاحظات…» with its label; title, body and tags matched (NotebookScreen.tsx:123-124, 142); e2e "search folds Arabic…" |
| NTB-06 | bug-fixed | Both sides folded with `normalize` (NotebookScreen.tsx:122-124); same e2e |
| NTB-07 | done | «الكل» • «بالجذر» • «بالسورة» • «بالوسم» (NotebookScreen.tsx:143) |
| NTB-08 | done | Newest edit first (NotebookScreen.tsx:104) |
| NTB-09 | done | Real sections per root in Arabic order (NotebookScreen.tsx:126-137) — the spec's grouping (NTB-12, Q06) |
| NTB-10 | done | Sections per sūra in mushaf order (NotebookScreen.tsx:131, 135-136) |
| NTB-11 | bug-fixed | Sections per tag (NotebookScreen.tsx:131) |
| NTB-12 | done | Group headings, a note under each root, sūra or tag it carries (NotebookScreen.tsx:151-161); e2e "a new note: …" finds the «ع ل م» section |
| NTB-13 | done | Title, else the body's first line to 60 characters, else «ملاحظة بلا عنوان» (NotebookScreen.tsx:183) |
| NTB-14 | done | Kind, sūra and verse, roots, tags and date joined «•» (NotebookScreen.tsx:184-193) |
| NTB-15 | done | Card background and a 3px root-colour start border, `aria-current` (globals.css:4089-4092; NotebookScreen.tsx:191) |
| NTB-16 | done | Empty copy with a link to the reader (NotebookScreen.tsx:144-147; ar.json notebook.empty, emptyReader) |
| NTB-17 | bug-fixed | The link goes to `/read` (NotebookScreen.tsx:146) |
| NTB-18 | bug-fixed | «لا ملاحظات تطابق «{q}».» (NotebookScreen.tsx:148-149); e2e "search folds Arabic…" |
| NTB-19 | done | Title input with placeholder and label, focused on open (NotebookScreen.tsx:215) |
| NTB-20 | done | «{date} • في هذا المتصفح وحده», edited date, tag pills, «+ وسم» input, Enter adds (NotebookScreen.tsx:216-241) |
| NTB-21 | open | (minor) Tags removable and never duplicated (NotebookScreen.tsx:219-234); e2e "a new note: …" checks one pill after two Enters. Missing: autocomplete from the reader's tags |
| NTB-22 | waiting | Delete with a confirm step is built (NotebookScreen.tsx:247-255); «→ بطاقة وصف» waits on P8, «→ اقترح» on P7 — not offered until there is somewhere honest for them to go (DECISIONS 2026-10-03 the Notebook) |
| NTB-23 | waiting | P7 |
| NTB-24 | bug-fixed | No one-click proposal exists; when it comes it is a prefilled form (NTB-Q07; DECISIONS 2026-10-03 the Notebook) |
| NTB-25 | bug-fixed | Delete asks first, for notes, verse notes and trails (NotebookScreen.tsx:247-255, 289-297, 327-335); e2e "deleting asks first; …" |
| NTB-26 | done | Textarea, 10 rows, `dir="auto"`, placeholder teaching the mentions (NotebookScreen.tsx:242; ar.json notebook.bodyPlaceholder). The Arabic example uses Latin digits (defects) |
| NTB-27 | bug-fixed | Verses with the colon and Arabic-Indic digits, ranges, spaced and Latin roots, one word only, e-mail addresses ignored (lib/notebook/mentions.ts:15-43); unit "@-mentions in notes (NTB-27, NTB-Q04)"; e2e "a new note: …" |
| NTB-28 | open | Verse → `/quran/{s}/{a}` checked against the sūra's length; root → concordance; word → its entry; lexicon by Arabic or English name → `/sources` (NotebookScreen.tsx:343-380); e2e "a new note: …". Missing: resolution that keeps the note's words out of GET URLs (NotebookScreen.tsx:349-355) (defects) |
| NTB-29 | done | «مرتبطة بـ» with coloured dots per kind, unresolved mentions said (NotebookScreen.tsx:382-408) |
| NTB-30 | done | «لا روابط بعد — …» (NotebookScreen.tsx:388-389; ar.json notebook.linkedEmpty) — the copy no longer promises backlinks |
| NTB-31 | open | No backlinks: nothing outside the Notebook reads `jadhr-notebook` (only NotebookScreen.tsx and lib/store/notebook.ts use `useNotebook`). The notes keep the roots and verses their mentions resolve to (notebook.ts:12-13), so a root, word or verse entry can list them |
| NTB-32 | done | «على {sūra}: {āya}», the first 12 tokens of the KFGQPC text, whole on request, root-colour start border (NotebookScreen.tsx:270-283; globals.css:4146-4154); e2e "a note on a verse shows the verse verbatim…" |
| NTB-33 | done | «اختر ملاحظة، أو أنشئ واحدة.» (NotebookScreen.tsx:173) |
| NTB-34 | done | Saved on every keystroke; created and updated both kept (lib/store/notebook.ts:13, 32; NotebookScreen.tsx:215, 242) |
| NTB-35 | done | The reader's verse notes (saved store, `quran:2:255`) listed and edited here (NotebookScreen.tsx:90, 263-301); the reader's toast «حُفظت الملاحظة • في دفتري» (ar.json rd.noteSaved; reader5/VerseDrawer.tsx:117). Emptying one here keeps the old text (defects) |
| NTB-36 | done | Saved trails listed with their steps and linked (NotebookScreen.tsx:91-102, 303-339; store.ts:388); e2e "deleting asks first; a saved trail lists its steps" |
| NTB-37 | done | `{id, title, body, tags, created, updated, links}` (lib/store/notebook.ts:13, 26-31) |
| NTB-38 | adapted | Free notes in their own store, verse notes where the reader writes them, trails in the personal store, one list — DECISIONS 2026-10-03 "The Notebook gathers what the reader already keeps" |
| NTB-39 | done | «هذا الأسبوع» with sessions and lookups in the last seven days (NotebookScreen.tsx:468-472) |
| NTB-40 | done | Seven days to today, bars `max(6, n/max×44)` px and opacity .35 + .65 × n/max, empty days a 4 px bar, today's label darker, each day labelled for screen readers (NotebookScreen.tsx:450-480; globals.css:4161-4186); e2e "the journal: …" counts two bars |
| NTB-41 | adapted | Date, text and lookups, newest eight; no minutes — the prototype's minutes were lookups (NTB-51; store.ts:250-252) (NotebookScreen.tsx:462, 486-494) |
| NTB-42 | done | «جذور لقيتها» as chips → concordance, «• {n} كلمة فتحتها» (NotebookScreen.tsx:495-503); e2e counts two chips |
| NTB-43 | done | «ملاحظة: {120 characters}» with a root-colour border, matched on the reader's local day (NotebookScreen.tsx:488, 504-506; globals.css:4196-4201) |
| NTB-44 | done | «لا جلسات بعد — …» (NotebookScreen.tsx:482-483; ar.json notebook.journalEmpty) |
| NTB-45 | open | (minor) Roots met, known • learning, notes • saved (NotebookScreen.tsx:513-519); e2e "the journal: …". Missing: "All time" roots come from the last 60 sessions only (store.ts:253, 345) (defects) |
| NTB-46 | done | The scheduler's due count with «راجع» → `/read?mode=review` (NotebookScreen.tsx:520-525; ReviewDeck.tsx:62-69); e2e "…both due" |
| NTB-47 | bug-fixed | The Review link goes to `/read?mode=review` (NotebookScreen.tsx:524) |
| NTB-48 | bug-fixed | Stars read from the saved store, due from the scheduler — never "all roots met" (NotebookScreen.tsx:446-447; ReviewDeck.tsx:36, 62-69); same e2e |
| NTB-49 | done | «كل ما هنا مأخوذ من قراءتك، ولا شيء يطلب منك أن تحافظ على سلسلة أيام.» (NotebookScreen.tsx:526); same e2e |
| NTB-50 | done | One session per local day and text, `{day, text, words, roots, verses, lookups}`, +1 per lookup (store.ts:252, 337-347) |
| NTB-51 | adapted | No minutes ("a count of lookups, not a time", store.ts:250-252); the last 60 sessions kept (store.ts:253, 345) |
| NTB-52 | bug-fixed | The reader's local day for keys and labels (store.ts:255; NotebookScreen.tsx:449-454, 487-488) |
| NTB-53 | waiting | P6.1–P6.2: the journal is derived in the browser from the session log; the server's `/me/journal` from opt-in lookup events comes with accounts |
| NTB-54 | done | ≤ 820 px one column, the list or the note with «→ كل الملاحظات» (globals.css:4202-4216); tokens only; e2e "on a phone the list and the note take turns"; axe on an empty `/notebook` (a11y.spec.ts:4) |
| NTB-Q01 | open | (minor) Local-first, in the export and the delete (lib/localData.ts). Missing: notes in IndexedDB rather than localStorage (lib/store/notebook.ts:35; safeStorage.ts:15-30), and a failed write said on this page (defects). Sync is P6 |
| NTB-Q02 | waiting | P6: local by default and said on the page (NotebookScreen.tsx:72); opt-in sync, encryption at rest and stated retention come with accounts. The page's "never sent" is not accurate (defects) |
| NTB-Q03 | done | Verse anchors with the sūra's name, the mushaf text verbatim, the whole verse on request, a link to it (NotebookScreen.tsx:270-283); e2e |
| NTB-Q04 | done | Verses and ranges in either digits, roots spaced or in Latin, words, lexicons by Arabic or English name (mentions.ts; NotebookScreen.tsx:343-380); unit and e2e as NTB-27. «@علم» unspaced is read as the word, whose root is still recorded. Hadith references: P11 |
| NTB-Q05 | done | Search and lexicon matching folded (NotebookScreen.tsx:122-124, 367-369) |
| NTB-Q06 | done | See NTB-09…12 |
| NTB-Q07 | waiting | P7 |
| NTB-Q08 | done | No streak; Due reads the scheduler (NotebookScreen.tsx:520-526); e2e "the journal: …" |
| NTB-Q09 | done | Arabic UI in RTL; title, body and rows `dir="auto"` (NotebookScreen.tsx:192-193, 215, 242, 285) |
| NTB-Q10 | done | Markdown per note and for all notes (NotebookScreen.tsx:245, 287, 410-436); JSON in the complete local export (lib/localData.ts); e2e "a note exports as Markdown (NTB-Q10)" |
| NTB-H01 | done | See NTB-13 |
| NTB-H02 | done | A spaced root of three or four letters is one mention; colon and greedy capture fixed (mentions.ts:16; NTB-27) |
| NTB-H03 | done | See NTB-49 |
| NTB-H04 | done | 60 sessions (store.ts:253), a trail of 40 steps (store.ts:315), no minutes to cap |
| NTB-H05 | done | Each empty state names the action that fills it (ar.json notebook.empty, journalEmpty, linkedEmpty; review.empty) |

### Review deck

| ID | status | evidence / reason |
|---|---|---|
| RDR-344 | done | The header's Review (wide), «راجع الجذور التي مررت بها» in the ⋯ menu, `?mode=review`; Esc or «أنهِ الجلسة» closes (ReaderHeader.tsx:152-160, 312-314; ReaderShell.tsx:54; ReviewDeck.tsx:105-115, 145); e2e review-deck specs and "journey B on a phone: …" |
| RDR-345 | done | The roots of starred and known words, else the sūra's roots by how often they appear; an empty or caught-up session says so in a card instead of a toast (ReviewDeck.tsx:32-50, 96-101, 168-172); e2e "the reader's starred words make the queue…", "with nothing of their own, the reader reviews this sūra's roots…" |
| RDR-346 | done | The badge counts the roots due now, moving with the clock (ReviewDeck.tsx:52-69; ReaderHeader.tsx:155-159) — the spec's due count; same e2e |
| RDR-347 | done | Fixed, `--canvas`, z 92, fade; logo mark, «المراجعة», meta, mode control, 120 × 4 progress, «{n} من {of}», End; the bar wraps on phones (ReviewDeck.tsx:130-146; globals.css:3930-3972). No focus trap (defects) |
| RDR-348 | done | A mode change remounts the card (answers and reveals reset); the mode holds for the session, not persisted (ReviewDeck.tsx:92, 138, 174) |
| RDR-349 | adapted | Cap «جذر • {n} كلمة في القرآن», the root at 52 px, transliteration, instruction; Ibn Fāris's statement with its page stands where the prototype had an English gloss, which no cited source gives yet (P3.4, law L2) (ReviewDeck.tsx:202-211) |
| RDR-350 | done | Hidden rows dashed with two bars and «على وزن {pattern} • {pos}», «اكشفها»; shown rows with the word, transliteration, part of speech or gloss, «المدخل» closing the deck (ReviewDeck.tsx:212-235; globals.css:3995-4022); e2e "the root card: …" |
| RDR-351 | open | (minor) Three grades as the prototype, graded into the scheduler (ReviewDeck.tsx:236-240). PLAN P2.0 resolved "four grades, Space to flip"; neither is built and no DECISIONS entry keeps three |
| RDR-352 | adapted | One column 820 px wide — reference, sūra, root, the verse in the mushaf font with blanks, the credited translation in English — with each blank's result under its input instead of a 260 px side column, which has no phone layout (RDR-420) (ReviewDeck.tsx:269-331; globals.css:3992-3994) |
| RDR-353 | bug-fixed | One of the five verses richest in the root across the Quran, varied by repetitions — every root has one (review.py:69-76) |
| RDR-354 | open | (minor) Numbered gaps with the word-colour underline, one input per blank (`dir="rtl"`, «…», «الفراغ {n}»), Enter checks (ReviewDeck.tsx:276-322; globals.css:4023-4038). Missing: the per-blank hint before checking (ReviewDeck.tsx:294 shows only how many are blanked) |
| RDR-355 | open | Folded comparison, the conjunction optional, right / expected / skipped, the real words revealed in colour (ReviewDeck.tsx:246-250, 282-283, 316-320); e2e "in context: …". Missing: an answer in everyday spelling is marked wrong for any word whose mushaf spelling differs (defects) |
| RDR-356 | open | (minor) The note before checking and the score after (ReviewDeck.tsx:294). Missing: "Revealed so far" — after checking, each blank's word with transliteration, gloss, part of speech and count (the `review.revealed` message exists, unused) |
| RDR-357 | done | «تحقّق», then one button graded by the score: «عرفتها كلها • التالي» / «بعضها • التالي» / «نسيتها • التالي» (ReviewDeck.tsx:264-266, 323-329); e2e "in context: …" |
| RDR-358 | done | «انتهت الجلسة», «تذكّرت {k} من {n} …», rows with the root, when it returns and its grade, «عُد إلى القراءة» (ReviewDeck.tsx:150-167); e2e "the reader's starred words make the queue…" |
| RDR-359 | done | SM-2 per root in `jadhr-review`: one day, three days, then × ease; partial × 1.2; forgot back in ten minutes, ease never under 1.3; in the export (lib/store/review.ts:16-56); unit "the review scheduler (P5.3, RDR-359)"; e2e; DECISIONS 2026-10-03 review deck |
| RDR-360 | open | Starred or known words enter the queue (ReviewDeck.tsx:36) and the study deck's Keep stars (StudyDeck.tsx:48-49); e2e "journey B: …". Missing: the set row's Keep, as in the prototype, never stars (ExploreScreen.tsx:242, 277) (defects) |
| RDR-536 | bug-fixed | A scheduler that persists (RDR-359), a due count not a queue size (RDR-346), no in-context dead end (RDR-353) |

### Shared shell

| ID | status | evidence / reason |
|---|---|---|
| SHL-18 | adapted | The shared header on the hub: 52 px, sticky, logo and «جذر» (shell/SiteHeader.tsx:13-28) — DECISIONS 2026-10-03 "The hub wears the shared header" |
| SHL-19 | adapted | The shared nav carries Read, Ask, Look up and Graph (shell/NavLinks.tsx:8-22); study review is a hub tile and the reader's header button (destinations.ts:22; ReaderHeader.tsx:152) — same decision |
| SHL-20 | adapted | The header's search is a button that opens the omnibox, with ⌘K and «/» (search/SearchLauncher.tsx:12-50); the hero field is the hub's search (HUB-05) |
| SHL-21 | waiting | P6 (D3): no Sign in and no avatar before accounts |
| SHL-22 | done | Under the header, label, up to three chips, Clear outside the scroller, only when a chip exists (ContextStrip.tsx:46-73; globals.css:3384-3443) |
| SHL-23 | bug-fixed | The text chip opens the reader at the sūra and verse reached, or the last verse (ContextStrip.tsx:32-43); e2e checks `/quran/18#v10` |
| SHL-24 | bug-fixed | The word chip opens `/read?w=` (ContextStrip.tsx:44); e2e checks the href. Label: «الكلمة» and the Arabic word, no transliteration |
| SHL-25 | done | The root chip → `/concordance?root=` with spaced letters (ContextStrip.tsx:45); e2e |
| SHL-26 | done | `dir="auto"` on each label, `lang` on Arabic (ContextStrip.tsx:59) |
| SHL-27 | adapted | Clear forgets the place shown, not the reading (store.ts:396; ContextStrip.tsx:32) — DECISIONS 2026-10-03 "Clear on the resume strip forgets the place shown"; e2e "…Clear hides it and keeps the reading" |
| SHL-28 | done | Only the hub renders the strip (page.tsx:48 is its one import) |
| SHL-40 | waiting | P7 for "Contribute". Built: a footer on every page with attribution, the dataset version, Sources & licences and Developers (the API) (shell/SiteFooter.tsx:14-37); "Audit" and "Explorations" are design artefacts not to implement (01 §1.2) |

## How the counts were checked

A script read this file's "All items" tables (one row per ID, status in the second column) and the inventory's own bullet IDs for the scope above, and failed unless: every inventory ID in scope has exactly one row and no row is outside it (223 = HUB 61 + COL 63 + NTB 69 + RDR 18 + SHL 12); every status is one of the six; the per-screen and per-section counts it computes equal both summary tables; the open and waiting tables list exactly the IDs whose rows say `open` and `waiting`. A copy of the file with one row's status changed made it fail, so the check can fail.
