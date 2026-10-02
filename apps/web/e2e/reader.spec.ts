import { expect, type Page, test } from "@playwright/test";
import { api, arCount, expectNoHorizontalScroll } from "./helpers";

/**
 * Reader v5 (PLAN P2, design 03): journey A and a regression test for each prototype bug that applies
 * to the Quran reader (inventory RDR-516…540, RDR-577…605). Numbers come from the API, never typed in.
 */

type WordPayload = {
  slug: string;
  ar: { full: string; translit: string };
  root: { key: string; ar_spaced: string; occurrences: number; lemma_count: number } | null;
  family: { members: { slug: string }[] }[];
};

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };

async function returning(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), { ...RETURNING, state: { ...RETURNING.state, ...extra } });
}

const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");

/** The lemma slug of the word at a location, from the sūra payload the page itself renders. */
async function slugAt(page: Page, loc: string): Promise<string> {
  const [s, a, p] = loc.split(":").map(Number);
  const d = await api<{ verses: { ayah: number; words: { position: number; lemma_slug: string }[] }[] }>(page, `/surahs/${s}`);
  return d.verses.find((v) => v.ayah === a)!.words.find((w) => w.position === p)!.lemma_slug;
}

test("journey A: tap a word → entry with its root counts → family → verse → tafsir", async ({ page }) => {
  await returning(page);
  const loc = "1:1:3";
  const slug = await slugAt(page, loc);
  const w = await api<WordPayload>(page, `/words/${slug}?at=${loc}`);
  expect(w.root?.key).toBe("رحم");

  await page.goto("/quran/1");
  await page.locator(`.w[data-w="${loc}"]`).click();
  // The address bar carries the selection (RDR-449/513) …
  await expect(page).toHaveURL(new RegExp(`[?&]w=${slug}&at=${loc.replace(/:/g, "(:|%3A)")}`));
  // … the word is marked in the text and its family underlined (RDR-553).
  await expect(page.locator(`.w[data-w="${loc}"]`)).toHaveClass(/is-selected/);
  await expect(page.locator('.w[data-w="1:1:4"]')).toHaveClass(/is-family/);
  // The entry states the root's counts exactly as the dataset has them.
  const p = panel(page);
  await expect(p.getByRole("heading", { name: w.ar.full })).toBeVisible();
  await expect(p.getByRole("button", { name: new RegExp(w.root!.ar_spaced) }).first()).toBeVisible();
  const occ = arCount(w.root!.occurrences, { one: "موضع واحد", two: "موضعان", few: "# مواضع", many: "# موضعًا", other: "# موضع" });
  const lem = arCount(w.root!.lemma_count, { one: "صيغة واحدة", two: "صيغتان", few: "# صيغ", many: "# صيغة", other: "# صيغة" });
  await expect(p.getByText(`${occ} · ${lem}`).first()).toBeVisible();
  // Every lemma on the root is in the family section.
  const family = p.locator('[data-section="family"]');
  await expect(family.locator(".family-group .word-chip")).toHaveCount(w.family.reduce((a, g) => a + g.members.length, 0));
  await expectNoHorizontalScroll(page);

  // The verse number opens verse mode with its tafsir, credited.
  await page.locator('[data-verse-btn="1:2"]').click();
  await expect(page).toHaveURL(/\/quran\/1\/2$/);
  await expect(p.getByText("التفسير الميسر").first()).toBeVisible();
});

test("a ?w= deep link takes the same path as a tap (RDR-539) and is recorded in the trail (RDR-587)", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  await expect(page.locator('.w[data-w="20:114:17"]')).toHaveClass(/is-selected/);
  await expect(panel(page).getByRole("heading", { name: "عِلْم" })).toBeVisible();
  const trail = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.trail ?? []);
  expect(trail.map((s: { id: string }) => s.id)).toContain("ilm");
});

test("a returning reader is never sent back to Ask (RDR-516); a first visit lands in Ask", async ({ page }) => {
  await page.goto("/quran/1");
  await expect(page.getByRole("heading", { name: "عن أي كلمة تتساءل؟" })).toBeVisible();
  // Leaving Ask and reloading keeps the reader in the text: the visit is remembered.
  await page.getByRole("button", { name: "اسأل" }).click();
  await page.reload();
  await expect(page.locator('.w[data-w="1:1:1"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "عن أي كلمة تتساءل؟" })).toHaveCount(0);
});

test("Ask finds a word without vowels and Go deeper opens its full entry", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/1?mode=ask");
  await page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" }).fill("علم");
  const card = page.locator(".ask-card, .ask-deck").first();
  await expect(card).toContainText("ع ل م");
  await page.getByRole("button", { name: /تعمّق/ }).first().click();
  await expect(panel(page).locator("h2").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "عن أي كلمة تتساءل؟" })).toHaveCount(0);
});

test("links into a folded section open and scroll to it (RDR-527/589)", async ({ page }) => {
  await returning(page);
  await page.addInitScript(() =>
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 })),
  );
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const p = panel(page);
  const family = p.locator('[data-section="family"]');
  await expect(family.locator(".layer-head")).toHaveAttribute("aria-expanded", "false");
  await p.locator(".root-chip").click();
  await expect(family.locator(".layer-head")).toHaveAttribute("aria-expanded", "true");
  await expect(family.locator(".layer-head")).toBeInViewport();
});

test("folding the last open layer keeps Meanings open (RDR-577)", async ({ page }) => {
  await returning(page);
  await page.addInitScript(() =>
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 })),
  );
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const head = panel(page).locator('[data-section="senses"] .layer-head');
  await head.click();
  await expect(head).toHaveAttribute("aria-expanded", "true");
});

test("panel history: back and forward between entries (RDR-590)", async ({ page }) => {
  await returning(page);
  const head = async (loc: string) => {
    const slug = await slugAt(page, loc);
    return (await api<WordPayload>(page, `/words/${slug}`)).ar.full;
  };
  const [a, b] = [await head("1:1:3"), await head("1:2:2")];
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:3"]').click();
  await expect(panel(page).getByRole("heading", { name: a, exact: true })).toBeVisible();
  await page.locator('.w[data-w="1:2:2"]').click();
  await expect(panel(page).getByRole("heading", { name: b, exact: true })).toBeVisible();
  await panel(page).getByRole("button", { name: "رجوع" }).click();
  await expect(panel(page).getByRole("heading", { name: a, exact: true })).toBeVisible();
  await panel(page).getByRole("button", { name: "تقدّم" }).click();
  await expect(panel(page).getByRole("heading", { name: b, exact: true })).toBeVisible();
});

test("omnibox: Ctrl+K, a verse reference, Enter opens the verse (RDR-565)", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await returning(page);
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:1"]').waitFor();
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "ابحث في كل شيء" });
  await expect(box).toBeFocused();
  await box.fill("٢:٢٥٥");
  await expect(page.getByRole("option").first()).toContainText("2:255");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/quran\/2\/255$/);
});

test("cite: a dialog with a versioned permalink and the real access date; Esc returns focus (RDR-461/522)", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const cite = panel(page).getByRole("button", { name: "استشهد" }).first();
  await cite.click();
  const dlg = page.getByRole("dialog", { name: "استشهد بهذا" });
  await expect(dlg).toBeVisible();
  const version = (await api<{ dataset: { version: string } }>(page, "/meta")).dataset.version;
  await expect(dlg).toContainText(version);
  await expect(dlg).toContainText("/read?w=ilm");
  const today = new Date().toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
  await expect(dlg).toContainText(today);
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expect(cite).toBeFocused();
});

test("/read resumes on the last verse read with the resume marker (RDR-572/592)", async ({ page }) => {
  await returning(page, { progress: { quran: { chapter: 2, passage: 40, at: Date.now() - 86_400_000 } } });
  await page.goto("/read");
  await expect(page).toHaveURL(/\/quran\/2#v40$/);
  await expect(page.locator("#v40 .resume-mark")).toBeVisible();
  await expect(page.locator("#v40")).toBeInViewport();
});

test("verse tools: Roots drawer underlines the root in the sūra; Esc closes it", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/1");
  const tools = page.locator('[data-verse="1:2"] .passage-tools');
  await tools.locator('[data-tool="roots"]').click();
  await expect(tools.locator('[data-tool="roots"]')).toHaveAttribute("aria-pressed", "true");
  const drawer = page.locator('[data-verse="1:2"] .drawer');
  await drawer.getByRole("button", { name: /ح م د/ }).click();
  await expect(page.locator('.w[data-r="حمد"]').first()).toHaveClass(/is-focus/);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});

test("keyboard: arrows move between words in reading order", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard");
  await returning(page);
  await page.goto("/quran/1");
  const first = page.locator('.w[data-w="1:1:1"]');
  await first.focus();
  await page.keyboard.press("ArrowLeft"); // reading order runs leftward in Arabic
  await expect(page.locator('.w[data-w="1:1:2"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('.w[data-w="1:1:2"]')).toHaveClass(/is-selected/);
});

test("phone: the sheet opens at half height, under the header, and grows to full (RDR-532/605)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await returning(page);
  await page.goto("/quran/1");
  // a persisted open panel never covers the text on load
  await expect(page.locator(".reader-sheet")).toHaveCount(0);
  await page.locator('.w[data-w="1:1:3"]').click();
  const sheet = page.locator(".reader-sheet");
  await expect(sheet).toHaveAttribute("data-sheet", "half");
  const header = await page.locator(".reader-header").boundingBox();
  await sheet.locator(".sheet-grabber").click();
  await expect(sheet).toHaveAttribute("data-sheet", "full");
  await page.waitForTimeout(300);
  const full = await sheet.boundingBox();
  expect(full!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  await expectNoHorizontalScroll(page);
});

test("onboarding: the demo word is عِلْمًا in Ṭā Hā 20:114 (RDR-570)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: false }, version: 1 })));
  await page.goto("/quran/1");
  const card = page.getByRole("dialog", { name: "تعريف سريع" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "أرني «عِلْمًا» في سورة طه" }).click();
  await expect(page).toHaveURL(/\/quran\/20/);
  await expect(page.locator('.w[data-w="20:114:17"]')).toHaveClass(/is-selected/);
  await expect(card).toContainText("كلمات كثيرة، جذر واحد.");
});

test("copy puts the reference after the verse text (RDR-555)", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "clipboard permissions");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await returning(page);
  await page.goto("/quran/1");
  await page.locator('[data-verse="1:2"]').hover();
  await page.locator('[data-verse="1:2"] [data-tool="copy"]').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^﴿.+﴾ \[الفاتحة: ٢\]$/);
});

test("verse mode carries the occasion of revelation verbatim with its source (P2.5a, P3.9)", async ({ page }) => {
  await returning(page);
  const k = await api<{ asbab: { text: string; source_id: string }[]; sources: Record<string, { attribution_ar: string }> }>(page, "/verses/2:6/knowledge");
  expect(k.asbab.length).toBeGreaterThan(0);
  await page.goto("/quran/2/6");
  const p = panel(page);
  const layer = p.locator(".layer", { has: page.getByRole("button", { name: /أسباب النزول/ }) });
  await expect(layer.locator(".kn-item")).toHaveCount(k.asbab.length);
  const first = k.asbab[0].text.replace(/\s+/g, " ").trim().slice(0, 24);
  await expect(layer).toContainText(first);
  await expect(layer).toContainText(k.sources[k.asbab[0].source_id].attribution_ar);
});

test("wujūh: a Quranic word's senses from the classical books, the sense citing this verse marked (P3.1)", async ({ page }) => {
  await returning(page);
  type Rel = { wujuh: { senses: { id: string; verses: string[] }[] }[] };
  const rel = await api<Rel>(page, "/words/ilm/relations");
  const att = await api<{ data: { location: string; verse_key: string }[] }>(page, "/words/ilm/attestations?limit=200");
  const cited = new Set(rel.wujuh.flatMap((e) => e.senses.flatMap((s) => s.verses)));
  const hit = att.data.find((a) => cited.has(a.verse_key))!;
  expect(hit, "an occurrence of عِلْم in a verse the wujūh books cite").toBeTruthy();
  const [s] = hit.verse_key.split(":");
  await page.goto(`/quran/${s}?w=ilm&at=${hit.location}`);
  const p = panel(page);
  await expect(p.getByText("الوجوه في القرآن")).toBeVisible();
  await expect(p.locator(".wujuh-sense.is-here").first()).toBeVisible();
  await expect(p.locator(".wujuh-sense.is-here .verse-chip.is-here").first()).toHaveText(hit.verse_key);
});

test("About this sūra opens its card from the chapter head, verbatim (P3.9)", async ({ page }) => {
  await returning(page);
  const card = await api<{ card: { names: string } }>(page, "/surahs/1/card");
  await page.goto("/quran/1");
  await page.getByRole("button", { name: "عن السورة" }).first().click();
  await expect(page).toHaveURL(/[?&]mode=about/);
  const p = panel(page);
  await expect(p.getByRole("heading", { name: "سورة الفاتحة" })).toBeVisible();
  await expect(p).toContainText(card.card.names.replace(/\s+/g, " ").trim().slice(0, 20));
});

test("browser back and forward step through what was opened (P2.2)", async ({ page }) => {
  await returning(page);
  const [a, b] = [await slugAt(page, "1:1:3"), await slugAt(page, "1:2:2")];
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:3"]').click();
  await expect(page).toHaveURL(new RegExp(`w=${a}`));
  await page.locator('.w[data-w="1:2:2"]').click();
  await expect(page).toHaveURL(new RegExp(`w=${b}`));
  await page.locator('[data-verse-btn="1:3"]').click();
  await expect(page).toHaveURL(/\/quran\/1\/3$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`w=${b}`));
  await expect(page.locator('.w[data-w="1:2:2"]')).toHaveClass(/is-selected/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`w=${a}`));
  await expect(page.locator('.w[data-w="1:1:3"]')).toHaveClass(/is-selected/);
  await page.goForward();
  await expect(page.locator('.w[data-w="1:2:2"]')).toHaveClass(/is-selected/);
});

test("the trail records verses and roots as steps (RDR-568)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail is an overlay on phones");
  await returning(page);
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:3"]').click();
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator(".reader-rail .rail-root").first().click();
  await page.locator('.w[data-w="1:2:2"]').click();
  const crumbs = panel(page).locator(".trail .trail-step");
  await expect(crumbs).toHaveCount(4);
  await expect(crumbs.nth(1)).toHaveAttribute("data-kind", "verse");
  await expect(crumbs.nth(2)).toHaveAttribute("data-kind", "root");
  await crumbs.nth(1).click();
  await expect(page).toHaveURL(/\/quran\/1\/2$/);
});

test("phone: putting the sheet away keeps the word, with its gloss under the verse (RDR-605); the word stays above the sheet (RDR-416)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await returning(page);
  await page.goto("/quran/2");
  const word = page.locator('.w[data-w="2:7:5"]');
  await word.click();
  const sheet = page.locator(".reader-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(500);
  const [w, s] = [await word.boundingBox(), await sheet.boundingBox()];
  expect(w!.y + w!.height).toBeLessThanOrEqual(s!.y);
  await sheet.getByRole("button", { name: "إخفاء اللوحة" }).click();
  await expect(sheet).toHaveCount(0);
  const gloss = page.locator('[data-gloss="2:7"] .inline-gloss');
  await expect(gloss).toBeVisible();
  await expect(word).toHaveClass(/is-selected/);
  await gloss.click();
  await expect(page.locator(".reader-sheet")).toBeVisible();
});

test("a verse note shows under its verse (marginalia)", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click(); // the open verse shows all its tools, on phones too
  await page.locator('[data-verse="1:2"] [data-tool="note"]').click();
  await page.locator('[data-verse="1:2"] .drawer textarea').fill("الحمد ثناء");
  await page.locator('[data-verse="1:2"] .drawer').getByRole("button", { name: "احفظ الملاحظة" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-note="1:2"] .margin-note')).toContainText("الحمد ثناء");
  await page.reload();
  await expect(page.locator('[data-note="1:2"] .margin-note')).toContainText("الحمد ثناء");
});

test("every word opens an entry: the Quranic initials and free pronouns by location (RDR-547/548)", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/2");
  await page.locator('.w[data-w="2:1:1"]').click();
  await expect(page).toHaveURL(/[?&]at=2(:|%3A)1(:|%3A)1/);
  const p = panel(page);
  await expect(p.getByRole("heading", { name: "الٓمٓ" })).toBeVisible();
  await expect(p).toContainText("حروف مقطّعة");
  await p.getByRole("button", { name: /تفسير الآية/ }).click();
  await expect(page).toHaveURL(/\/quran\/2\/1$/);
  await page.goto("/word/2:255:5");
  await expect(panel(page).getByRole("heading", { name: "هُوَ" })).toBeVisible();
  await expect(panel(page)).toContainText("ضمير");
});

test("study mode: words are marked only by the reader, and the rail shows each sūra's coverage (D20, RDR-552/571)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail is an overlay on phones");
  await returning(page);
  await page.addInitScript(() => localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { wordStates: true }, version: 2 })));
  const sets = await api<{ data: Record<string, string[]> }>(page, "/surahs/lemma-sets");
  await page.goto("/quran/112");
  const first = page.locator('.w[data-w="112:1:1"]');
  await first.click();
  // a tap opens the word but does not mark it
  const states = () => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.wordStates ?? {});
  expect(Object.keys(await states())).toHaveLength(0);
  const slug = await first.getAttribute("data-l");
  await panel(page).getByRole("button", { name: "معروفة" }).click();
  expect((await states())[slug!]).toBe("known");
  const pct = new Intl.NumberFormat("ar-EG", { style: "percent", maximumFractionDigits: 0 }).format(1 / sets.data["112"].length);
  await expect(page.locator('.reader-rail [aria-current="page"]')).toContainText(pct);
});

test("rail: ajzāʾ and a mushaf page take the reader where they begin (P2.1)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail is an overlay on phones");
  await returning(page);
  const d = await api<{ juz: { number: number; surah: number; ayah: number }[] }>(page, "/divisions");
  await page.goto("/quran/1");
  const rail = page.locator(".reader-rail");
  await rail.getByRole("button", { name: "الأجزاء" }).click();
  const j4 = d.juz[3];
  await rail.locator(`a[href$="/quran/${j4.surah}#v${j4.ayah}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/quran/${j4.surah}#v${j4.ayah}$`));
  await expect(page.locator(`#v${j4.ayah}`)).toBeInViewport();
  const pg = await api<{ verses: { surah: number; ayah: number }[] }>(page, "/pages/300");
  await rail.getByRole("button", { name: "الصفحة" }).click();
  await rail.getByRole("textbox").fill("٣٠٠");
  await rail.getByRole("button", { name: "اذهب إلى الصفحة" }).click();
  await expect(page).toHaveURL(new RegExp(`/quran/${pg.verses[0].surah}#v${pg.verses[0].ayah}$`));
});

test("In the Quran: the whole root and a sūra filter (RDR-558)", async ({ page }) => {
  await returning(page);
  const all = await api<{ total: number }>(page, "/words/ilm/attestations?scope=root&surah=2&limit=1");
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const p = panel(page);
  const usage = p.locator('[data-section="usage"]');
  await usage.locator(".layer-head").click();
  await usage.getByRole("button", { name: /الجذر كله/ }).click();
  await usage.getByRole("combobox").selectOption("2");
  await expect(usage).toContainText(`المطابق: ${new Intl.NumberFormat("ar-EG").format(all.total)}`);
  await expect(usage.locator(".kwic-row").first()).toContainText("2:");
});

test("tafsir side by side: up to three works at once (P2.10)", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/2/255");
  const p = panel(page);
  await p.getByRole("button", { name: "جنبًا إلى جنب" }).click();
  await expect(p.locator(".tafsir-cols.is-compare > article")).toHaveCount(2);
  const chips = p.getByRole("group", { name: "اختر التفسير" }).locator('button[aria-pressed="false"]');
  await chips.first().click();
  await expect(p.locator(".tafsir-cols.is-compare > article")).toHaveCount(3);
  await chips.first().click();
  await expect(p.locator(".tafsir-cols.is-compare > article")).toHaveCount(3);
});

test("recitation speed cycles 1×, 0.75×, 0.5× and repeat toggles (RDR-554)", async ({ page }) => {
  await returning(page);
  await page.goto("/quran/1");
  const speed = page.getByRole("button", { name: /سرعة التلاوة/ });
  await expect(speed).toHaveText("1×");
  await speed.click();
  await expect(speed).toHaveText("0.75×");
  await speed.click();
  await expect(speed).toHaveText("0.5×");
  const repeat = page.getByRole("button", { name: "كرّر الآية" });
  await repeat.click();
  await expect(repeat).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: /سرعة التلاوة/ })).toHaveText("0.5×");
});
