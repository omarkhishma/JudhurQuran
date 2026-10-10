import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { clean, drop, expire, person, tag } from "./board";
import { api, expectNoHorizontalScroll } from "./helpers";

/**
 * The word panel by layers (P15, D30): the data card under the header; Meanings as the layers of meaning — the
 * contextual (the context the administration set, or the commentators' groupings until it does, the context's
 * verses with the word marked, the meaning at this place from the Tafsir Center and al-Muyassar), the lexical, the
 * semantic (the administration's near and opposite words, the wujūh, the topics), the morphological (wazn and the
 * Center's sarf), the grammatical (the corpus's tags and the Center's iʿrāb) and the readings. `SHOTS=<dir>` saves
 * the panel at desktop and phone width in both themes.
 */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const PREFS = { state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet").first();
const shots = process.env.SHOTS;
async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/${name}-${theme}.png` });
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}
async function seed(page: Page) {
  await page.addInitScript(
    ([r, p]) => {
      localStorage.setItem("jadhr-personal", JSON.stringify(r));
      localStorage.setItem("jadhr-prefs", JSON.stringify(p));
    },
    [RETURNING, PREFS] as const,
  );
}

type Tc = { meaning: string[]; sarf: string[]; irab: string[]; qiraat_same: boolean };
type W = { slug: string; corpus_freq: number; occurrence: { location: string; tc: Tc } };

test("the layers of a word's meaning, each from its sources, and the data card's doors (P15)", async ({ page }) => {
  await seed(page);
  const w = await api<W>(page, "/words/kursiyy?limit=0&at=2:255:42");
  await page.goto("/quran/2?w=kursiyy&at=2:255:42#v255");
  const p = panel(page);
  await expect(p.locator(".data-card")).toBeVisible();
  await expect(p.locator(".data-card")).toContainText("تكرارها");
  for (const name of ["المعنى السياقي", "المعنى المعجمي", "المعنى الدلالي", "المعنى الصرفي", "المعنى النحوي", "القراءات والرسم"]) {
    await expect(p.locator(".meaning-layer-head", { hasText: name })).toHaveCount(1);
  }
  // the contextual layer: nothing set yet, said so, with the commentators' groupings; the meaning here is the Center's
  const ctx = p.locator("#layer-contextual");
  await expect(ctx).toContainText("لم تحدّد إدارة جذر سياق هذه الكلمة بعد.");
  await expect(ctx).toContainText("كيف يجمع أهل التفسير الآيات حولها:");
  await expect(ctx.locator(".sense-row").first()).toContainText(w.occurrence.tc.meaning[0]);
  await expect(ctx.locator(".ctx-word")).toHaveCount(1);
  await p.locator(".data-card").scrollIntoViewIfNeeded();
  await shoot(page, `panel-card-${test.info().project.name}`);
  await ctx.scrollIntoViewIfNeeded();
  await shoot(page, `panel-context-${test.info().project.name}`);
  // the data card's door opens the morphological layer: the Center's sarf statement of this word
  await p.locator(".data-door").nth(2).click();
  const morph = p.locator("#layer-morphological");
  await expect(morph.locator(".meaning-layer-head")).toHaveAttribute("aria-expanded", "true");
  await expect(morph).toContainText(w.occurrence.tc.sarf[0]);
  // the grammatical layer: the Center's iʿrāb of the word, and of the verse on request
  const gram = p.locator("#layer-grammatical");
  await expect(gram).toContainText(w.occurrence.tc.irab[0]);
  await gram.getByRole("button", { name: "إعراب الآية كاملة" }).click();
  const irab = await api<{ text: string }>(page, "/verses/2:255/irab");
  await expect(gram.locator("p.whitespace-pre-line")).toHaveText(irab.text);
  // the readings: opened from its head
  await p.locator(".meaning-layer-head", { hasText: "القراءات والرسم" }).click();
  await expect(p.locator("#layer-readings")).toContainText(w.occurrence.tc.qiraat_same ? "لا خلاف بين القراء في هذا الموضع." : "القراءات");
  await morph.scrollIntoViewIfNeeded();
  await shoot(page, `panel-morph-${test.info().project.name}`);
});

test("what the administration sets reaches the panel at once: the word's context with its meaning there, and its near and opposite words (P15, journey G in part)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the account is made in a desktop window");
  test.setTimeout(150_000);
  const a = await person(browser, `e2e-lay-${tag()}@example.org`, "admin");
  try {
    const put = async (kind: string, target: string, value: unknown, sources: unknown[] = []) => {
      const e = (await (await a.page.request.put(`/api/v1/editorial/${kind}/${encodeURIComponent(target)}`, { headers: a.h, data: { value, sources } })).json()) as { id: string };
      expect((await a.page.request.post(`/api/v1/editorial/entries/${e.id}/publish`, { headers: a.h })).status()).toBe(200);
    };
    await put("context_word", "2:256:6", { from: "2:255", to: "2:257", meaning_ar: "نص للاختبار فقط", meaning_en: "", note_ar: "" }, [{ work: "muyassar", ref: "2:256" }]);
    const words = await api<{ results: { lemmas: { slug: string; ar: string }[] } }>(a.page, "/search?q=" + encodeURIComponent("رشد") + "&limit=3");
    const near = words.results.lemmas[0].slug;
    await put("word_relations", "tabayyana", { links: [{ to: near, rel: "near", note_ar: "فرق للاختبار" }] });
    await expire(a.page);
    await seed(a.page);
    await a.page.goto("/quran/2?w=tabayyana&at=2:256:6#v256");
    const p = panel(a.page);
    const ctx = p.locator("#layer-contextual");
    await expect(ctx).toContainText("من ٢:٢٥٥ إلى ٢:٢٥٧");
    await expect(ctx).toContainText("حدّدته إدارة جذر");
    await expect(ctx).toContainText("نص للاختبار فقط");
    await expect(ctx.locator(".ctx-verse")).toHaveCount(3);
    await expect(p.locator(".data-card")).toContainText("من ٢:٢٥٥ إلى ٢:٢٥٧");
    const sem = p.locator("#layer-semantic");
    await expect(sem).toContainText("كلمات قريبة المعنى");
    await expect(sem).toContainText("فرق للاختبار");
    // the administrator's way to the tool, and back
    await ctx.getByRole("link", { name: "حدّد السياق" }).click();
    await expect(a.page.locator("#ctxw-h")).toBeVisible();
    await a.page.getByRole("link", { name: "← عُد إلى القارئ" }).click();
    await expect(a.page).toHaveURL(/\/quran\/2\?w=tabayyana/);
    // a near word opens in the panel
    await panel(a.page).locator("#layer-semantic .word-chip").first().click();
    await expect(panel(a.page).locator("h2").first()).toHaveText(words.results.lemmas[0].ar);
  } finally {
    clean([a.email]);
    await expire(a.page);
    await drop(a);
  }
});

test("the panel by layers passes axe in both themes and fits a phone (P15)", async ({ page, isMobile }) => {
  await seed(page);
  await page.goto("/quran/2?w=kursiyy&at=2:255:42#v255");
  await expect(panel(page).locator(".data-card")).toBeVisible();
  await expect(panel(page).locator("#layer-contextual .sense-row").first()).toBeVisible();
  await page.waitForTimeout(400);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.waitForTimeout(200);
    const results = await new AxeBuilder({ page }).include(".reader-panel, .reader-sheet").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${theme} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  }
  if (isMobile) {
    await expectNoHorizontalScroll(page);
    await shoot(page, "panel-390");
  }
});
