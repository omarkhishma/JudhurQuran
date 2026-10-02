# DECISIONS & LESSONS

> One file for decisions (with the reason) and lessons. Superseded entries are removed, not left to rot. Format: `[date] Decision — reason`.

## Decisions

### Product and scope
- [2026-10-02] **Build fresh in this folder; reuse the sibling `Judhur` project as research input only.** — The brief points here and describes a different product shape (data-driven lexicon + user graphs from the Claude Design handoff) than Judhur (editorial waqf, owner-authored meanings, read-only canvas). Judhur's verified license register, lessons and pinned artefacts were reused with credit; its code was not. Flagged to the owner.
- [2026-10-02] **Product laws (PLAN §1).** — Mushaf integrity and "no generated religious content" are the owner's own laws from Judhur and match the brief's insistence on respect; the rest come from the design handoff's non-negotiables.
- [2026-10-02] **Working title جُذور / Judhur; name in one config constant.** — "Jadhr" from the handoff collides with jadhr.app (same niche, paid plans). Public name is an owner call.
- [2026-10-02] **Arabic is the default UI language and direction; English is a full second locale (`/en`).** — Brief: "Main/default Language: Arabic". Logical CSS only. No Accept-Language redirect (canonical Arabic URLs must not flip by header).
- [2026-10-02] **Non-commercial assumption for licensing until the owner says otherwise.** — EveryAyah audio is CC BY-NC, corpus terms mention non-commercial use, Judhur was framed as a waqf. If the site will be commercial, audio and some data sources must change (research 03 §9.6).

### Architecture
- [2026-10-02] **Next.js 16 App Router + React 19 + TypeScript for the web.** — SSR is required for verse/root/word pages (Arabic SEO is the clearest market gap per research 04), and the reader/editor are client-heavy.
- [2026-10-02] **Previous caching model (fetch revalidate + tags), not Cache Components.** — Stable with next-intl's static rendering; content is immutable per dataset release, so `revalidate: 86400` + a `dataset` tag is enough.
- [2026-10-02] **FastAPI (Python) API + Python pipeline, separate from the web app.** — Owner suggested Python; the public API is a product (versioning, OpenAPI docs, own limits); the Arabic data tooling is Python. The browser reaches the API same-origin through a Next rewrite of `/api/v1/*`.
- [2026-10-02] **Search on Postgres (normalised shadow columns + pg_trgm), behind one module.** — Quran scale does not need a search cluster; all Arabic search assertions pass. Revisit when lexicon/hadith full-text relevance is measured to need OpenSearch.
- [2026-10-02] **Two Arabic search shadows: imlāʾī (KFGQPC "emlaey" text aligned per word) and Uthmani-stripped; the query picks one.** — Everyday spelling matches the imlāʾī shadow (الصلاة → ٱلصَّلَوٰة); text pasted from a mushaf (detected by dagger alef, wasla or Quranic marks) matches the Uthmani shadow. Lemmas also carry a heuristic plain spelling (وٰ→ا etc.) for matching only.
- [2026-10-02] **Graph canvas: @xyflow/react + elkjs, bounded expansion.** — The handoff editor is rich editable DOM cards; scale is handled by bounding, not a canvas renderer.
- [2026-10-02] **Postgres 17 in Docker for dev (host 5442); web dev on port 3210, API on 8000.** — Match prod major; port 3000 belongs to another of the owner's projects.

### Data
- [2026-10-02] **Display text = official KFGQPC Hafs data v2.0 (`hafsData_v2-0.json`), byte-identical; font = KFGQPC Uthmanic Hafs V22 (signed TTF, unmodified).** — Direct from the Complex (MD5/SHA-1 match its published checksums), with Madinah page and line numbers and an official imlāʾī search text. Rendering test: Tanzil text with this font shows a broken dotted-circle glyph (e.g. 7:195) and no pause marks; the KFGQPC text renders like the printed mushaf. The copy previously obtained via QUL/Quran.com was deleted (Quran Foundation terms forbid storing beyond one week).
- [2026-10-02] **The ayah-end medallion is drawn from Arabic-Indic digits, not the file's ayah-mark code point.** — The official text ends each verse with a font-specific code point (U+FC00 + ayah − 1) that renders as an unrelated ligature if the font fails; digits render identically with the font and degrade safely. The stored verse text keeps the code point verbatim.
- [2026-10-02] **Pages and lines from KFGQPC; juz from Tanzil.** — The KFGQPC JSON's juz field starts juz 4 at 3:92 and juz 11 at 9:94, contradicting the ۞ signs printed in its own text at 3:93 and 9:93 (a juz must start on a hizb boundary); Tanzil's juz table agrees with the printed signs. 56 page boundaries differ from Tanzil's older print; KFGQPC's numbering matches the edition we display.
- [2026-10-02] **Morphology: Quranic Arabic Corpus v0.4 as primary, unchanged; v2 (author's revision) and the mustafa0x fork stored as attributed root variants, never merged silently.** — Every other root dataset tested descends from QAC (research 01). Differences are classic scholarly disputes (الناس نوس/أنس, نادى ندو/ندي) and must be shown, not hidden.
- [2026-10-02] **Particles, pronouns and foreign proper nouns show "no root" — never a pseudo-root.** — The owner's example CSV gives 27,462 such words pseudo-roots (من → "م ن"); 49,085 CSV roots agree with QAC and 882 differ (independently reproduces Judhur's reconciliation: 49,085 / 27,463 / 883).
- [2026-10-02] **Tafsir launch set: al-Muyassar and al-Mukhtasar (QuranEnc, explicit re-publication grant), al-Sa'di (QUL 308), al-Baghawi, Ibn Kathir, al-Qurtubi, al-Tabari (public-domain authors; text via tafsir_api v1.2.2).** — Passages regrouped from the mirror's per-ayah copies; character counts match research 03's independent computation exactly.
- [2026-10-02] **English: Saheeh International and Rowwad via QuranEnc.** — Only explicitly re-publishable English found; Tanzil translations are non-commercial and non-redistributable; Yusuf Ali carries US risk.
- [2026-10-02] **Audio plan: EveryAyah verse audio + quran-align word timings (CC BY 4.0); word pronunciation = the word's slice of the verse audio.** — Per-word MP3s on Quran.com's CDN have no license.
- [2026-10-02] **Classical Arabic lexica launch display-only (al-Mufradat, Maqayis, Lisan, al-Sihah from the Shamela text, editor notes stripped); Lane (Perseus, CC BY-SA) is the only redistributable lexicon.** — Research 02.

## Lessons

- [2026-10-02] (from Judhur) Tanzil Uthmani and QPC Hafs differ systematically (embedded basmala, sukun U+0652 vs U+06E1, hamza carriers, spacing) while the letter stream is identical — normalise only inside the comparator, never the stored text.
- [2026-10-02] Strict parsers turn silent corruption into loud failures — the QAC v0.4 file ships with CRLF; the parser accepts consistent CRLF and rejects any stray CR.
- [2026-10-02] Never assert Arabic combining-mark strings as typed literals in tests — assert codepoint escapes.
- [2026-10-02] (from Judhur) `user-select: none` does not keep verse numbers out of copied text — the reader's copy handler rebuilds the text from word spans and appends the citation.
- [2026-10-02] A word can contain two stems (وَمِمَّا = و + مِن + مَا, 486 words) — features live per stem and the word exposes a primary stem (first with a root, else first content word).
- [2026-10-02] QAC writes a hamza radical as `A` (Amn, sAl, qrA) — map to ء; display it as أ (dictionary convention).
- [2026-10-02] Unlayered CSS beats Tailwind 4 utilities (which live in `@layer utilities`) — component recipes must sit in `@layer components` or responsive utilities like `max-sm:hidden` silently lose.
- [2026-10-02] A URL-sync effect that runs on the initial render wipes `?w=` before it is read under React strict mode — only write the URL after the panel actually changes.
- [2026-10-02] (from Judhur) Give every non-default compose file an explicit `name:`; a strict production CSP breaks `next dev` (relax only in development).
