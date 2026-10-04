# 16 · The classroom: baseline and build plan (P9)

Date: 2026-10-04. Scope: the 57 CLS items of research 05 §3 (CLS-01…46, CLS-Q01…Q07, CLS-H01…H04) and DEF-11, against the code at commit 26d6547, with D13's approved recommendation — both views (a lesson's passage view and the cohort's matrix) and one shared map per lesson with per-card confirmation — and the product's law that personal data stays in the browser unless its owner sends it.

## 1. What exists

- `/classroom` is a skeleton page (`ScreenSkeleton`, "being built").
- Accounts and sessions (P6), the `instructor` role among the roles an administrator grants (P7, `jadhr_api.roles`), the editorial board's two-person review (P3.0), shared maps on the server with revisions and comments (P8.1-E), presence over a WebSocket (P8.6).
- The reader records each lookup and the day's session in the browser only (RDR-113, 437, 441): nothing about what a reader looks up reaches the server today.
- No cohort, lesson, membership or event table; no endpoint under `/classroom`.

## 2. The privacy model (the condition for everything else)

The classroom is the one place where a reader's study leaves their browser for someone else to see. It does so only like this:

1. **Joining is the learner's act.** An instructor's class has a join link; a signed-in reader who opens it is told, before joining, exactly what the instructor will see, and joins or not. Leaving is one button, and takes everything the class held of theirs.
2. **Only the lessons' verses, only while a lesson is open.** The reader sends what it records — a word looked up, a note written (its count, never its words), a word confirmed or struggled with in the review deck — only for verses inside an assigned lesson's range, between its assignment and two weeks after its due date. Anything else stays in the browser as before.
3. **Counts, not a trail.** The server keeps, per lesson and learner, how many times each word was looked up, how many notes were written on it, and the day — never the time of day, never the order, never the note's text. A lesson's progress is when it was opened, whether the learner said they finished, and the active minutes the reader counted on its verses.
4. **Aggregates by default, and only above a floor.** The instructor sees class totals; any number about a word or a root is shown only when at least five members have joined (CLS-Q02's "no 'looked up by 1 of 3'"), and a cell counted from fewer than three learners is shown as "few". A learner's own row in the matrix, or their name beside "not started", appears only if that learner turned on "show my detail to the instructor" — off by default, changeable at any time.
5. **A class with minors** (an instructor's setting): no per-learner detail at all, whatever the learners chose; the join screen says the class is for minors and asks the learner to join with a parent's agreement. Whether that suffices legally is the owner's question (§6).
6. **Kept no longer than needed.** A lesson's events are deleted 90 days after its due date; a class deleted takes everything with it.

## 3. The items, by step

| Step | Items | What |
|---|---|---|
| P9.1a Classes and lessons (API) | CLS-01, 02, 26, 43, 44, 45, Q01, Q03, Q07 | Schema `classroom`: classes (instructor, name, minors flag, join code), members (consent, detail opt-in, joined), lessons (title, verse ranges, roots, assigned, due), instructor's lesson notes; endpoints for classes, joining with consent, leaving, lessons; a lesson pack exported as a file (CLS-Q07) |
| P9.1b Classes and lessons (web) | CLS-01, 02, 22, 26, Q02, Q07, H03 | `/classroom`: the instructor's classes and the learner's; create a class; the join page with its consent; the lesson builder (ranges, roots, due date); a learner's lessons opening the reader at their verses; the lesson pack |
| P9.2a The learner's signals | CLS-06, 07, 25, Q02, Q03 | The reader sends consented, lesson-scoped counts (lookups, notes, review confirmations and struggles) in batches; "I finished this lesson"; active minutes on its verses |
| P9.2b The instructor's views | CLS-03…05, 08…21, 23, 24, 46, Q04, Q05, H02, DEF-11 | The passage view: the lesson's verses in the mushaf's text with heat under the words (layers: lookups, notes, confirmed, struggling — the legend following the layer), a focus card, the class panel (members, finished, median minutes, most looked-up roots, needs a nudge — gently, privately, opt-in names), lesson notes saved, removable and reordered; the matrix: learners (opted-in) × the lesson's roots, layers lookups / confirmed / struggling, tight cells, a cell focusing its pair; heat never recolouring letters (CLS-Q04); dark and phone |
| P9.3 The shared map per lesson | CLS-27…42, 38, 39, 45, Q06, H01, H04 | One map per lesson on the server (P8.1-E), the real editor mounted, the instructor editing; learners propose cards and links, shown dashed with their name until the instructor confirms (merged as a revision) or declines; the activity feed in the product's vocabulary, coloured by the kind of thing touched; comments with mentions (P8.1-E); presence (P8.6); side tabs that work |
| P9.4 Exit ◆ | — | Journey F with a test cohort, end to end |

Adapted from the design, with reasons in DECISIONS when built: the heat sits on the lesson's Quranic verses (ayah ranges), not a prose chapter (CLS-Q03); the layers are the union of the prototype's and the docs' that can be measured honestly — lookups, notes, confirmed, struggling (per word); time is a passage's measure, not a word's (CLS-07's per-word time is not kept); the class panel's numbers are computed, never sample data (CLS-06, 16, 21, 23); "remind" is a notice on the learner's own classroom page, never an e-mail (no message goes out under anyone's name without their act).

## 4. Data

```
classroom.classes    id, instructor_id, name, minors, join_code, created_at, archived_at
classroom.members    class_id, user_id, joined_at, detail_opt_in, consent_version
classroom.lessons    id, class_id, title, ranges (surah, from, to)[], roots text[], assigned_at, due_at, graph_id
classroom.notes      id, lesson_id, location | root, text, position            (the instructor's lesson notes)
classroom.counts     lesson_id, user_id, location, kind (lookup|note|confirm|struggle), day, n
classroom.progress   lesson_id, user_id, opened_on, finished_on, minutes
classroom.nudges     lesson_id, user_id, sent_at, seen_at                       (a notice, not a message)
classroom.proposals  id, lesson_id, user_id, cards jsonb, links jsonb, status, decided_by, decided_at   (P9.3)
classroom.activity   id, lesson_id, who, kind, subject_ar, detail, at                                  (P9.3)
```

## 5. API

`GET/POST /classroom/classes` · `GET/PATCH/DELETE /classroom/classes/{id}` · `POST /classroom/join/{code}` (with the consent version) · `DELETE /classroom/classes/{id}/membership` · `PATCH /classroom/classes/{id}/membership` (detail opt-in) · `GET/POST /classroom/classes/{id}/lessons` · `GET/PATCH/DELETE /classroom/lessons/{id}` · `GET /classroom/lessons/{id}/pack` · `POST /classroom/lessons/{id}/counts` (the learner's batch) · `POST /classroom/lessons/{id}/progress` · `GET /classroom/lessons/{id}/heat?layer=` · `GET /classroom/lessons/{id}/matrix?layer=` · `GET/POST/PATCH/DELETE /classroom/lessons/{id}/notes` · `POST /classroom/lessons/{id}/nudges` · P9.3: `GET/POST /classroom/lessons/{id}/proposals`, `POST /classroom/proposals/{id}/decide`, `GET /classroom/lessons/{id}/activity?cursor=`.

## 6. For the owner

- Whether a class for minors with the learner's own consent and a parent's agreement asked on screen is enough, or a verified parental consent is needed before launch (legal advice; CLS-Q02).
- Whether any member may teach or only accounts given the instructor role (built: the role, granted by an administrator).
- Counts after this baseline: 57 open.
