# 10 · Open questions

**Read this before estimating or committing to a launch date.** The design is complete; these are the decisions it *assumes* and does not settle. Each one can change scope materially, and the first two can change whether parts of the product are shippable at all.

Ordered by how much damage they do if deferred.

---

## 1 · Lexicon sourcing and licensing 🔴 blocking

The product's central scholarly promise is **nine historical dictionaries, side by side, on one word**. The prototypes fill these with generated placeholder prose (`lexEntry()` in `lexicon-data.js`) of realistic length and register so the layout could be judged. **None of it is real content.**

The nine sources and their rough status:

| Dictionary | Author | d. | Copyright status |
|---|---|---|---|
| كتاب العين | al-Khalīl ibn Aḥmad | 786 | Text public domain; **modern critical editions are not** |
| تهذيب اللغة | al-Azharī | 980 | Same |
| الصحاح | al-Jawharī | 1003 | Same |
| مقاييس اللغة | Ibn Fāris | 1004 | Same |
| المفردات | al-Rāghib al-Iṣfahānī | 1108 | Same |
| لسان العرب | Ibn Manẓūr | 1311 | Same |
| القاموس المحيط | al-Fayrūzābādī | 1414 | Same |
| تاج العروس | al-Zabīdī | 1791 | Same |
| Lane's Lexicon | E. W. Lane | 1893 | Public domain; **good digitisations have their own terms** |

**The trap:** the *works* are centuries out of copyright, but every usable digital text is either (a) a modern critical edition with its own copyright in the editorial apparatus, vocalisation, and pagination, or (b) a community digitisation under terms that may not permit the redistribution the Data & API page promises.

**Decisions needed:**
1. For each of the nine: which specific digitisation, under what license, with what attribution requirement?
2. Does that license permit **redistribution** as a bulk dataset? The Data & API page offers JSON/TEI/LMF/CSV downloads under `CC-BY-SA` with a DOI. **That claim cannot ship until this is answered per source.** Shipping it wrong is a legal and reputational problem in a community that cares intensely about provenance.
3. Fallback if a source cannot be redistributed: display-only with attribution, excluded from bulk export, and the apparatus view degrades gracefully.

**Design impact if constrained:** the apparatus and side-by-side views assume ≥2 sources per word. Nine is the design target; the layout survives down to about four. Below that, those modes should be hidden rather than shown sparse.

**Also needed:** a `license` and `source_note` per dictionary in the schema (already present in `07-data-model.md`), surfaced in the UI on every article. Provenance must be visible, not buried in a footer.

---

## 2 · Audio 🟠 significant

The Ask card and the Collections study deck both have prominent pronunciation buttons. The prototypes use the browser's `speechSynthesis`, which for classical Arabic with tashkīl produces something between unhelpful and wrong.

**Options:**
| Option | Quality | Cost | Notes |
|---|---|---|---|
| Recorded human audio | Best | High, slow | ~35 words in the seed set is trivial; a real lexicon is tens of thousands. Needs a reciter and QA |
| Commercial Arabic TTS with diacritic support | Good | Per-character, ongoing | Must accept vocalised input; most consumer TTS ignores tashkīl and guesses |
| Keep browser TTS | Poor | Free | Acceptable only as a labelled fallback, never as the default |
| No audio | — | — | Cut the button rather than ship a bad one |

**Recommendation:** record audio for the curated sets and the highest-frequency words (a few hundred covers most of what casual explorers will hear), TTS the long tail, and label which is which. `words.audio_url` is nullable in the schema; the UI must handle null by hiding the button, not by showing a broken one.

**Open:** is audio needed for *passages* too, or only single words? The design only shows word-level audio, but Qurʾān and ḥadīth recitation is an obvious expectation for this audience and would be a larger project.

---

## 3 · Text ingestion 🟠 significant

The Library offers three ways to add a text: **Paste**, **URL**, **PDF**. Only Paste is implemented, and even that only tokenises against the 35-word prototype lexicon.

**Paste** — needs real passage segmentation (Arabic punctuation, verse markers, ḥadīth numbering), tokenisation, and morphological tagging. Tractable.

**URL** — fetch, extract main content, sanitise, detect Arabic, handle encoding (a real problem with older Arabic web pages), then the Paste pipeline. Tractable but fiddly.

**PDF — genuinely hard, and worth treating as its own project.** Arabic PDFs commonly present:
- Glyph-order text extraction that comes out visually reversed
- Ligatures and presentation forms (`ﻻ`, `ﻢ`) that must be normalised back to base letters
- Tashkīl either dropped entirely or attached to the wrong base character
- Two-column classical layouts with footnote apparatus interleaved into the body
- Scanned images needing Arabic OCR, which is a separate quality problem again

**Recommendation:** ship Paste in Phase 1. URL in Phase 2. **Do not promise PDF in the first release** — either hide the option or label it explicitly as experimental with a preview-and-correct step where the user fixes extraction before the text is saved. A silently mangled text is worse than no import.

**Open:** what is the cap on user-uploaded text size, and are user texts private by default? (The design implies private; confirm.)

---

## 4 · Auth, accounts, and the local-first promise 🟡 needs a decision

The product **works with no account** — reading, lookups, word states, notes, and progress all persist locally. Signing in is framed as sync, not access. This is a deliberate, good decision and it has consequences:

1. **Anonymous state must migrate on sign-in.** `POST /me/migrate-anon` exists in the contract. Merge semantics need deciding: what happens when a user has anonymous word states *and* existing account state for the same word? (Recommendation: newest `updated_at` wins per record, and never destroy — keep a recoverable copy for 30 days.)
2. **Which auth methods?** Email magic link is the least friction and fits an academic audience. Institutional SSO will be asked for by universities. OAuth is fine but adds a dependency.
3. **Roles.** The schema has `member` / `reviewer` / `instructor` / `admin`. Who grants `reviewer`? Self-serve, invite, or earned by contribution count? This directly affects the Review Queue's trustworthiness — see §6.
4. **Is an account required to propose an edit?** It must be (proposals carry attribution and the credit line is the incentive), but the design never shows that gate. Design the prompt: it should appear *after* the user writes their proposal, not before, so their work is never lost to a sign-in wall.

---

## 5 · Real-time collaboration 🟡 needs a decision

The Editor shows **presence avatars and a "Live" indicator**, and the Classroom has a **live activity feed**. In the prototypes both are simulated.

**Three levels, pick one deliberately:**

| Level | Effort | What users get |
|---|---|---|
| **Presence only** | Low — WebSocket channel per graph, ephemeral | Avatars, "who's here", live activity feed. No concurrent editing. Last-write-wins on save. |
| **Live cursors + soft locks** | Medium | See where others are working, cards lock while being edited. Prevents most conflicts without CRDT complexity. |
| **True concurrent editing (CRDT)** | High | Yjs/Automerge, real multiplayer. Changes the autosave endpoint, the undo model, and the document format. |

**Recommendation: presence only for the first release**, which delivers everything the *designs* actually show, then soft locks. Do not start with a CRDT — it would restructure the editor's state model (`PUT /graphs/:id` sends whole documents; a CRDT sends operations) and the design does not require it.

**But decide now**, because the choice changes the graph document format and the autosave path. Retrofitting a CRDT later is a rewrite of the editor's core.

**Open:** the Classroom's shared workspace — is it one graph the whole cohort edits, or per-learner graphs the instructor reviews? The design reads as the former; confirm, because it changes the permission model.

---

## 6 · Moderation and editorial authority 🟡 needs a decision

The Review Queue implements clear mechanics: two distinct approvals merge a proposal, no self-approve, no double-approve. What it does not settle is **who holds the approving vote**.

Open questions:
1. **Who becomes a reviewer?** Two approvals from arbitrary members is not a scholarly review process — and this product's credibility rests on being taken seriously. Consider: reviewers are appointed, or earned after N merged proposals, or a designated editorial board holds final say on contested entries.
2. **Can a merge be reverted?** Senses are versioned in `07-data-model.md` only implicitly. Add sense revision history and an explicit revert path — you will need it.
3. **Abuse handling.** Proposals are free text. Needs reporting, rate limits per user, and a block mechanism.
4. **Disputes.** Two scholars can legitimately disagree about a sense. Does the product support *competing* senses with attribution, or force one winner? (The design shows one text with one credit line. Competing senses would be a real feature and arguably the more honest one for this domain — worth discussing with subject-matter advisors before locking it.)
5. **Does the canonical dataset ever diverge from community edits?** i.e. is there a "reviewed" dataset and a "community" layer, or one merged truth?

**This is the question most likely to need a domain expert rather than an engineering decision.**

---

## 7 · Smaller open items

- **Dataset versioning cadence.** `dataset_releases` exists; who cuts a release, how often, and does every merged proposal wait for the next release or go live immediately? (The changelog implies immediate; the DOI implies periodic. Both can be true — live data, periodic citable snapshots — but say so explicitly.)
- **Corpus scope at launch.** The seed has one prose text, 2 sūras, and 2 ḥadīth. What is the real launch corpus? Full Qurʾān is bounded and high value. Full Bukhārī is much larger. Classical poetry raises fresh licensing questions.
- **Cited-count integrity.** `POST /published/:slug/cite` increments a counter from an unauthenticated public page. Trivially inflatable. Either authenticate it, rate-limit it hard, or present it as "citation copied N times" rather than implying scholarly citations.
- **Difficulty scores.** Passages carry a 1–5 difficulty shown in the Reader's contents. How is it computed? (Suggestion: a function of rare-root density and passage length — but it must be defined and consistent, because learners will navigate by it.)
- **`next_steps` determinism across dataset versions.** Trails are shareable, so the three doors must be stable. Seed the choice from the word slug plus the dataset version, and accept that trails shift between releases.
- **Offline scope.** Local-first implies some offline reading. How much — the current text only, or the whole library? Service worker scope and cache budget follow from that.
- **Search-index freshness SLA.** How soon after a merge must search reflect it? (Suggestion: under 30 seconds via the outbox worker; no user expectation of instant.)
- **Analytics and privacy.** `lookup_events` is a detailed record of what a user read and struggled with. For an audience that includes religious study, that is sensitive. Decide retention, aggregation, and whether it is opt-out — and say so plainly in the product, not just a policy page.
- **Arabic-language UI.** Everything is currently English chrome around Arabic content. An Arabic-speaking audience will expect an Arabic interface, which means full RTL layout mirroring — not a small job, and much cheaper if the layout is built RTL-aware from the start (logical CSS properties: `margin-inline-start`, not `margin-left`). **Even if Arabic UI is out of scope for v1, write the CSS logically now.**
