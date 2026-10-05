import { expect, type Page, test } from "@playwright/test";
import { api, arKey } from "./helpers";

/**
 * One regression test for each prototype bug of RDR-516…540 that applies to the Quran reader and had none
 * (P2.11). The others are tested where their feature is: 516, 522, 527, 532, 539 (reader), 520 (personal),
 * 524 (hover-card), 528 (graph-handoff), 535 (reader). RDR-536 belongs to the review deck (P5). RDR-540 is
 * not observable in a browser: React drops a state update that lands after unmount, so the cleanup in
 * ReadingSurface (the long-press timer cleared on unmount) is kept by review, not by a test that cannot fail.
 */

const BASE = { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [] as unknown[], savedTrails: [] };
const OPEN = (section: string) => ({ layerOpen: { senses: false, family: false, patterns: false, lexica: false, timeline: false, usage: false, [section]: true } });
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
const seed = (page: Page, extra: Record<string, unknown> = {}, prefs?: Record<string, unknown>) =>
  page.addInitScript(
    ([s, p]) => {
      if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: s, version: 1 }));
      if (p && !localStorage.getItem("jadhr-prefs")) localStorage.setItem("jadhr-prefs", JSON.stringify({ state: p, version: 2 }));
    },
    [{ ...BASE, ...extra }, prefs ?? null] as const,
  );

type Feat = { case?: { ar: string } | null };
type Att = { data: { location: string; verse_key: string; features: Feat }[] };

test("RDR-517: Grammar here is read from the occurrence opened, not from one stored analysis", async ({ page }) => {
  const att = await api<Att>(page, "/words/ilm/attestations?limit=200");
  const gen = att.data.find((x) => x.features.case?.ar === "مجرور")!;
  const nom = att.data.find((x) => x.features.case?.ar === "مرفوع")!;
  expect(gen && nom).toBeTruthy();
  await seed(page, {}, OPEN("senses"));
  for (const o of [gen, nom]) {
    await page.goto(`/quran/${o.verse_key.split(":")[0]}?w=ilm&at=${o.location}`);
    const box = panel(page).locator('[data-section="senses"]');
    await expect(box).toContainText(`كما وردت في الآية ${arKey(o.verse_key)}`);
    await expect(box.locator("dd", { hasText: o.features.case!.ar })).toHaveCount(1);
  }
});

test("RDR-518: a verse note is kept under its text's namespace, and an older bare-keyed note moves there", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-saved"))
      localStorage.setItem("jadhr-saved", JSON.stringify({ state: { bookmarks: [], history: [], notes: { "1:2": { verse: "1:2", text: "ملاحظة قديمة", at: 1 } } }, version: 1 }));
  });
  await page.goto("/quran/1");
  await expect(page.locator('[data-note="1:2"] .margin-note')).toContainText("ملاحظة قديمة");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}"));
  expect(stored.version).toBe(2);
  expect(Object.keys(stored.state.notes)).toEqual(["quran:1:2"]);
});

test("RDR-519: particles spelled with hamza (إنما، إذا، إلى) are words with their own entries", async ({ page }) => {
  await seed(page);
  const v = await api<{ words: { position: number; text_imlaei: string; lemma_slug: string | null }[] }>(page, "/verses/2:14");
  const ila = v.words.find((w) => w.text_imlaei === "إلى")!;
  expect(ila?.lemma_slug).toBeTruthy();
  await page.goto("/quran/2#v14");
  const btn = page.locator(`.w[data-w="2:14:${ila.position}"]`);
  await expect(btn).toHaveAttribute("data-l", ila.lemma_slug!);
  await btn.click();
  await expect(page).toHaveURL(new RegExp(`[?&]w=${ila.lemma_slug}`));
  await expect(panel(page).locator("h2").first()).toBeVisible();
});

test("RDR-521: one theme key, shared by the reader and the graph editor", async ({ page, isMobile }) => {
  await seed(page);
  await page.goto("/quran/1");
  // the phone header keeps the theme in its ⋯ menu
  if (isMobile) {
    await page.getByRole("button", { name: "المزيد" }).click();
    await page.getByRole("menuitem", { name: "الوضع الداكن" }).click();
  } else await page.getByRole("button", { name: "الوضع الداكن" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /theme/i.test(k)));
  expect(keys).toEqual(["jadhr-theme"]);
  await page.goto("/graph");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("RDR-523: the toast's animation does not hard-code a translate that jumps at its end", async ({ page }) => {
  await seed(page);
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] .ptool[data-tool="note"]').click();
  await page.locator('[data-verse="1:2"] textarea').fill("للاختبار");
  await page.locator('[data-verse="1:2"]').getByRole("button", { name: "احفظ الملاحظة" }).click();
  const toast = page.locator(".toast");
  await expect(toast).toBeVisible();
  const frames = await toast.evaluate((el) => {
    const name = getComputedStyle(el).animationName;
    const rules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const r of Array.from(sheet.cssRules)) if (r instanceof CSSKeyframesRule && r.name === name) rules.push(r.cssText);
      } catch {
        /* a sheet from another origin */
      }
    }
    return { name, rules };
  });
  expect(frames.name).not.toBe("none");
  expect(frames.rules.length).toBeGreaterThan(0);
  for (const r of frames.rules) expect(r).not.toMatch(/translate\(\s*-50%/);
});

test("RDR-525: a note's draft belongs to its verse; another verse starts empty", async ({ page, isMobile }) => {
  test.skip(isMobile, "on the phone the verse sheet covers the next verse; the drawer is the same component");
  await seed(page);
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] .ptool[data-tool="note"]').click();
  await page.locator('[data-verse="1:2"] textarea').fill("مسودة الآية الثانية");
  await page.locator('[data-verse-btn="1:3"]').click();
  await page.locator('[data-verse="1:3"] .ptool[data-tool="note"]').click();
  await expect(page.locator('[data-verse="1:3"] textarea')).toHaveValue("");
});

test("RDR-526: the dictionary count and list follow the dictionaries the reader shows", async ({ page }) => {
  const w = await api<{ dict_articles: { id: string; title_ar: string }[] }>(page, "/words/ilm?limit=0");
  const off = w.dict_articles.find((d) => d.id === "lisan")!;
  expect(off).toBeTruthy();
  await seed(page, {}, { ...OPEN("lexica"), dictOff: { lisan: true } });
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const sec = panel(page).locator('[data-section="lexica"]');
  const n = w.dict_articles.length - 1;
  await expect(sec.getByRole("button", { name: new RegExp(`^الكل\\s*${new Intl.NumberFormat("ar-EG").format(n)}$`) })).toBeVisible();
  await expect(sec).not.toContainText(off.title_ar);
  await expect(panel(page)).toContainText(`${new Intl.NumberFormat("ar-EG").format(n)} معاجم لها مادة`);
});

test("RDR-529: the root's table lists every word on a pattern, not one", async ({ page }) => {
  const w = await api<{ family: { pattern: { slug: string; ar: { full: string } } | null; members: { slug: string; ar: { full: string } }[] }[] }>(page, "/words/muhtadi?limit=0");
  const g = w.family.filter((x) => x.pattern).sort((a, b) => b.members.length - a.members.length)[0];
  expect(g.members.length).toBeGreaterThan(1);
  await seed(page, {}, OPEN("patterns"));
  await page.goto("/quran/1?w=muhtadi");
  const row = panel(page).locator(".shapes-table tr", { has: page.getByRole("button", { name: g.pattern!.ar.full, exact: true }) });
  await expect(row.locator(".word-chip")).toHaveCount(g.members.length);
  // the words themselves, compared whole (مُهْتَد is a prefix of مُهْتَدِي)
  const shown = await row.locator('.word-chip [lang="ar"]').allInnerTexts();
  expect(shown.map((x) => x.normalize("NFC")).sort()).toEqual(g.members.map((m) => m.ar.full.normalize("NFC")).sort());
});

test("RDR-530: on the phone, a new word starts the Ask deck at its first card", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the four-card deck is the phone layout");
  await seed(page);
  await page.goto("/quran/1?mode=ask");
  const input = page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" });
  await input.fill("علم");
  const deck = page.locator(".ask-deck");
  await expect(deck).toContainText("ع ل م");
  await deck.evaluate((el) => el.scrollTo({ left: -el.scrollWidth }));
  await expect(page.locator(".deck-dot").nth(0)).not.toHaveClass(/is-on/);
  await input.fill("صبر");
  await expect(deck).toContainText("ص ب ر");
  await expect.poll(() => deck.evaluate((el) => Math.abs(el.scrollLeft))).toBeLessThan(2);
  await expect(page.locator(".deck-dot").nth(0)).toHaveClass(/is-on/);
});

test("RDR-531: choosing a sūra at mid width closes the overlay rail and starts at the top", async ({ page, isMobile }) => {
  test.skip(isMobile, "mid width is a desktop window narrower than 1200px");
  await page.setViewportSize({ width: 1024, height: 800 });
  await seed(page);
  await page.goto("/quran/2");
  await page.evaluate(() => window.scrollTo(0, 3000));
  const toggle = page.getByRole("button", { name: "إظهار المحتويات أو إخفاؤها" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.locator(".reader-rail").getByRole("link", { name: /الكهف/ }).first().click();
  await expect(page).toHaveURL(/\/quran\/18(\?|#|$)/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
});

test("RDR-533: Esc closes the omnibox while its input has focus", async ({ page, isMobile }) => {
  test.skip(isMobile, "the shortcut belongs to a keyboard");
  await seed(page);
  await page.goto("/quran/1");
  const dlg = page.getByRole("dialog", { name: "ابحث في كل شيء" });
  // the shortcut is heard once the page's scripts are running: pressed again until it is
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dlg).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await dlg.getByRole("combobox").fill("علم");
  await expect(dlg.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
});

test("RDR-534: when copying fails the reader says so, never 'copied'", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")), readText: () => Promise.reject(new Error("denied")) }, configurable: true });
  });
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] .ptool[data-tool="copy"]').click();
  await expect(page.locator(".toast")).toHaveText("تعذّر النسخ");
});

test("RDR-537: Grammar here stays filled while a hover card is open", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover cards are for a mouse");
  await seed(page, {}, OPEN("senses"));
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const grammar = panel(page).locator('[data-section="senses"] dl');
  await expect(grammar.locator("dd").first()).toBeVisible();
  const before = await grammar.innerText();
  await page.locator('.w[data-w="20:114:2"]').hover();
  await expect(page.locator(".hover-card")).toBeVisible({ timeout: 5000 });
  expect(await grammar.innerText()).toBe(before);
});

test("RDR-538: a stored position that names no sūra opens al-Fātiḥa instead of a missing page", async ({ page }) => {
  await seed(page, { progress: { quran: { chapter: 999, passage: 4000, at: 1 } } });
  await page.goto("/read");
  await expect(page).toHaveURL(/\/quran\/1(\?|#|$)/);
  await expect(page.locator('.w[data-w="1:1:1"]')).toBeVisible();
});
