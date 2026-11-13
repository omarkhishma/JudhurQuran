# 27 · UI/UX audit — the whole product, 2026-11-13

The first stage of the quality loop the owner asked for on 2026-11-13: the product used as its audiences use it, on the production build, before any fix. The loop's passes (below) build the fixes; the findings that would change the product's identity go to the owner and do not block the rest.

**How.** A real browser (Chromium) kept open between steps, driven by hand step by step: every screen read as a screenshot, every action taken as a reader would — typing, tapping on an emulated Pixel 7 with touch, signing in through the e-mail link, an administrator's tools. Desktop at 1440 × 900, phone at 412 × 839, both themes. Claude in Chrome could not be used: Chrome asks for an "Allow" on localhost that only the owner can give. Journeys walked: A (curiosity → panel → trail → map) on desktop and phone, the hub, search, the omnibox, a root page, the editor's root map, the administration's dashboard and its passages tool (journey G's first half), mind maps, and a read of every other screen (Explore, Library, Concordance, Analyser, Notebook, Review queue, Classroom, the gallery, Profile, Data & API, statistics, Ask the Quran, the dictionary, a hadith, the English hub). Journeys B–F's flows are held by the e2e suite (913 passed today); this audit looked at how their screens read, not whether they work.

**References.** The comparison set is the products themselves (research 04: quran.com, corpus.quran.com, tafsir.app and the rest). Mobbin and Refero hold no Quran product, and their free tiers show too little to add to it.

## Findings, most harmful first

Severity is harm to a reader: **critical** blocks a core journey, **high** misleads or breaks trust on a main surface, **medium** costs effort or looks unfinished, **low** is polish.

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| F22 | critical | Reader, first visit | A first visit to any sūra or verse address (`/quran/2`, `/quran/2/255`) opens Ask mode, «عن أي كلمة تتساءل؟», instead of the text. `ReaderShell.tsx` checks `?v=` but not a sūra or verse in the path, so everyone arriving from a shared link or a search result misses the verse they came for. | Ask on a first visit only at the generic entry; an address that names a sūra or verse opens it. |
| F15 | high | Reader, panel | A jump from the data card (for example «٨ موضوعات») scrolls `.reader-v5`, which is `overflow: hidden`, by 148 px. The header disappears and a blank strip opens under the audio bar until reload. | `overflow: clip` on the shell, so no programmatic scroll can move it. |
| F01 | high | Search | For a single word («صبر»), the page leads with two exact-string verses, then ten verses by meaning and the meanings section. The word sits at 3,027 px and the root at 3,243 px. The design orders Words · Roots · Patterns · Passages. | A best-match card first (lemma, root, count, plain meaning, open), then words and roots, then verses. |
| F02 | high | Omnibox | The same order: verses, then the root, then surface forms without vowels. | Lemma and root first. |
| F09 | high | Dictionary, Mufradāt | The honorific ligatures U+FD40–FD4F (﵁ ﵇ ﵄ ﵂ ﵀ …) render as empty boxes in 4,321 dictionary articles and 182 Mufradāt entries; ﵁ alone occurs 3,493 times. The symbols face covers only U+FDFA–FDFF. | Extend the symbols subset to U+FD40–FD4F. |
| F04 | high | Counts | Labels fixed beside a number skip agreement: «١٠٣ موضعًا» (→ مواضع), «٨ صيغة» (→ صيغ), in the root page's stat cards and the omnibox. | Every label beside a number goes through the plural rules; a sweep of the fixed ones. |
| F11 | high | Ask card | The lead "meaning" of صَبْر is a verse-specific gharīb reading, «﴿واستعينوا بالصبر﴾ أي: بالصوم», set large and bold. A casual reader takes "fasting" for the word's meaning. The Tafsir Center's «الصبر: حبس النفس عن الجزع» is held and cited, and shown only further down. | The Tafsir Center's meaning in this place leads; the gharīb passage follows, labelled with its verse. |
| F03 | medium | Search | Verses found by their words show Tanzil's plain text, without marks or a label, while verses found by meaning show the mushaf text. Law L1 requires a simplified spelling to be a labelled view. | Show the mushaf text, or label the plain text. |
| F12 | medium | Ask → «تعمّق» | The entry opens, but the text stays on al-Fātiḥa 1:1 while the panel says «في هذا الموضع: البقرة ٢:٤٥». | Move the text to the occurrence. |
| F16 | medium | Data card | With no administration content yet, every word shows «سياقها: لم يُحدَّد بعد» and «قريبة ٠ • مقابلة ٠», which reads as unfinished. The contextual layer already computes how the commentators group the verses. | The context row shows the commentators' grouping until the administration's range exists; the near and opposite row is hidden at zero. |
| F10 | medium | Headwords | In large headwords (the ask card, the panel, the phone sheet) the vowel marks float well above the letters. | Fix the headword face's mark positioning or line box. |
| F19 | medium | Digits | Western digits sit beside Arabic-Indic ones in the Arabic UI: «2:45» on the ask card, the trail and the trail map's cards, the cards' numbers 1–4, «الخطوة 2 من ٣». | The digits preference everywhere. |
| F14 | medium (a11y) | Panel | The section titles are buttons inside `section` with no heading; the headword is the panel's only heading, so a screen-reader user cannot move by section. | Each toggle inside an `h3` (the accordion pattern). |
| F23 | medium (phone) | Word sheet | The half sheet spends its height on the navigation row, the panel's search box and the trail. The word's meaning is below the fold. | On phones the half sheet leads with the headword and one line of meaning; search stays in the header. |
| F24 | medium (phone) | First-run tour | The tour's card covers the top of the verse the reader came to read, offers to take them to Ṭā Hā, shows «الخطوة 1 من ٣», and its skip button is 20 px wide. | A small note at the bottom on phones, consistent digits, a 44 px skip. |
| F05 | medium | Hub | The hub's search box suggests nothing while the reader types (the omnibox does). Enter leads to the results wall, not to a word. | The omnibox's suggestions under the hub's box. |
| F06 | medium | Hub | «كل ما في المنصة» is 26 tiles of equal weight with no grouping. Two tiles are titled «المعجم»; «الخريطة» and «ارسم الخريطة» repeat. | Groups with headings, no duplicate titles. |
| F25 | medium | Library | Each card's "cover" is an empty gradient, identical for every book of a kind, so it looks like an image that failed. «لم تعلّم كلمات منه بعد (في وضع الدراسة)» is repeated on all 45 cards for a reader who never used study mode. | Typographic covers (the title on the cover); the progress line only when there is progress. |
| F28 | medium | Naming | Two features are called "Ask": «اسأل» (a word, in the reader) and «اسأل القرآن» (questions). | Distinct names. |
| F29 | medium | Mind map | Radial labels rotate up to about 90°, which makes Arabic hard to read. The centre node sits at the bottom of the first screen. | Horizontal labels; the map fitted to the view. |
| F30 | medium | Zero | A lone Arabic-Indic zero is a dot. As a large stat headline (the administration's dashboard, the profile's counts) it reads as a bullet or a load that failed. | «لا شيء بعد» or «—» under a zero headline. |
| F07 | medium (IA, owner) | Header | Fifteen flat nav items, including the editorial queue and the classroom, are shown to a first-time reader. The design lists eleven. | Proposal for the owner: grouped navigation (below). |
| F13 | low | Tour | The tour starts mid-journey (step 2 of 3 after «تعمّق»). | Start it once, at the first reading. |
| F17 | low | Nahw layer | The same particle appears twice from two books, interleaved (أل, الباء, الباء, أل). One Mufradāt sub-entry is cut at «يقال:». | Group by particle. |
| F18 | low | Graph hand-off | «نسخ البذرة (JSON)» is offered to readers. | Move it under the dialog's details. |
| F20 | low | Trail | The trail records the same word twice (صبر › 2:45 › صبر). | Collapse a step that repeats the one before last. |
| F21 | low | Data card | Zero halves are shown: «(مكية ٣، مدنية ٠)». | Leave the zero half out. |
| F26 | low | Explore | A new visitor sees a large empty card, «تقدّمك: لم تلقَ كلمة بعد». | Offer a first step. |
| F27 | low | Copy | The nav says «الفصل» and the page heading says «الصف». | One word. |
| F31 | low | Header | Signed in, the nav overflows and its last item is cut mid-word with no fade. | A fade at the overflow edge. |
| F08 | low | Root page | The nav marks «الفهرس السياقي» active on `/roots`. «كيف نعدّ» and «كم مرة ذُكر؟ وكيف عددنا» sit together. | One count link; the right active item. |

## Found sound

The ask card's anatomy (forms, root, cousins, a verse, actions). The layers of meaning, each cited. The trail and its map. Tapping a word on a phone: the word stays above the sheet, highlighted. The editor's root map. The administration's passages tool, with each commentator's division one click away («خذ تقسيمه»). The sign-in sheet's honesty about merging, and the confirm step before a link is used. The dictionary's nine lexica. The hadith page's chain of narrators. The statistics on a phone. The root page's header. No console errors and no sideways scroll on any screen read.

## For the owner: proposals that change the product's shape

- **P-UX1 Grouped navigation (F07).** Five groups replace the fifteen flat items: اقرأ (the mushaf, the library) · ابحث (search, the dictionary, the concordance) · افهم (ask the Quran, statistics, mind maps, the analyser) · ارسم (maps, the gallery) · أنا (notebook, review, profile); the editorial queue, the classroom and the administration under the account menu for those who hold the role. Why: a first-time reader meets three doors, not fifteen. Cost: M. Risk: the design handoff fixes its own list of eleven. **Approved by the owner and built 2026-11-13:** five groups (اقرأ · ابحث · افهم · ارسم · مساحتي), each a button opening a panel of its destinations, every link with its purpose line; the analyser went to ابحث with the other word tools. The edit requests and the workbench show in مساحتي to the role's holders only (the role read from `/me` on each load), the classroom to everyone. The phone menu shows the same groups, and «البيانات» moved to the footer.
- **P-UX2 System dark mode.** Follow the device's dark preference when the reader has not chosen a theme. Today light is the default by design (a unit test holds it). Cost: S. **Approved by the owner and built 2026-11-13:** the device's preference leads, followed live, until the reader chooses; choosing the theme the device already has clears the choice, so the one toggle stays the whole control.

## Loop passes

### Pass 1 — 2026-11-13: the findings, most harmful first

27 of the 31 findings fixed, 26 commits, each with the test that holds it where a test can (`git log 0bcba4c..d9ffe7c`). Fixed: F22, F15, F01, F02, F03, F09, F04, F11, F12, F16, F21, F19, F14, F24, F23, F05, F06, F25, F28, F27, F30, F29, F20, F26, F31, F18 and F17.

What changed along the way:

- **F23.** The half sheet hides its search box. The entry also leads with the word's meaning at its place, from the Tafsir Center: in Arabic it had opened on the corpus's English gloss.
- **F24.** On a phone the tour is now a compact strip. A low card would have covered the tapped word, which the reader keeps just above the sheet.
- **F25.** «لم تعلّم كلمات منه بعد» is still said once, on the Quran's card, to keep LIB-12's promise.
- **F05.** The hub and the omnibox now share one suggestion hook.

Not changed, with the reason:

- **F10.** This is Amiri's design, not a fault. It sets the marks above short letters at one height, level with the tall letters, and the same word drawn alone in Amiri shows the same thing.
- **F13.** The tour moving to its second step when the first word opens is the tour following the reader. It now sits where it hides nothing (F24).
- **F08.** The two counting links serve two ends: a note in place, and the count page that answers «كم مرة ذكرت» for search engines (B8a). The concordance is the root pages' nav item by design.
- **F07.** Grouped navigation was the owner's call (P-UX1); approved and built 2026-11-13.
- The «٢٠٩ مقطعًا» first listed under F04 was a misread «٢٥٩», which agrees.

Two findings the e2e suite could never have caught:

- **F22.** Every test seeds a returning reader.
- **F15.** No test pressed a door and then measured the shell.

Both now have tests.

### Verification after pass 1, and pass 2

**Full run of pass 1 on the production build:** 911 passed, 147 skipped by device, 20 failed. Nothing failed in the new features themselves. The causes, all fixed:

- **16 axe failures**, one cause: the current word chip's count. The first fix sat in Tailwind's components layer, which the `text-t3` utility outranks, so the class is now set in the component.
- **2 failures of the `/read` first visit.** On the production build `?mode=ask` stayed in the address after the reader left Ask, so a reload brought Ask back. The first visit's Ask is now set in the reader's state.
- **2 tests** read the old forms of the counted noun and of the Go-deeper path; they were updated.

**Rerunning the 20:** all passed. **The final full run on the production build:** 931 passed, 147 skipped by device, 0 failed (18.1 min). Lint, typecheck, and vitest (179) are clean.

**Pass 2: the product used again, after the fixes.** Desktop and an emulated phone, fresh visitors, both themes. Checked:

- The home page box suggests while you type.
- «رحمة» and «علم» are answered by their best match.
- On the phone, the search leads with the word.
- On the phone, Ask then Go deeper lands on 2:7 with «قُلُوبِهِمْ» selected and the Tafsir Center's meaning first.
- The root page reads «١٠٣ مواضع، ٩٣ آية، ٤٥ سورة، ٨ صيغ», and its title agrees.
- The mind map's labels read level.
- The library's covers carry their pattern.
- In the dark theme, the best-match card and the home page suggestions read clearly.

Pass 2 found nothing new worth changing beyond the two faults the full run caught, so the loop stops here, as its rules say.

