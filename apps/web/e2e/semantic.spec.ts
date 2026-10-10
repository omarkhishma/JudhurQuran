import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, expectNoHorizontalScroll } from "./helpers";

/**
 * Search by meaning (P17, PV-08, PV-09, PV-14): the verses close in meaning to a search, as the API ranks them, each
 * with how it was found and the source text the model read, credited; the group says it is computed, can be turned
 * off, pages, and is in English too; the omnibox offers them; a verse's nearest verses in its knowledge; axe in both
 * themes and a phone's width. `SHOTS=<dir>` saves the pages.
 */

type Hit = { verse: { key: string; surah: number; ayah: number }; source: { work: { id: string; title_ar: string; title_en: string }; text: string }; by_meaning: number | null; by_words: number | null };
type Search = { results: { semantic?: Hit[] }; totals: { semantic?: number }; semantic?: { status: string; lang: string } };

const shots = process.env.SHOTS;
async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/${name}-${test.info().project.name}-${theme}.png`, fullPage: true });
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

// a returning reader: the reader opens at the verse, not at the first visit's welcome
const returning = (page: Page) => page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
const group = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) }).first();

test("an Arabic search: the verses close in meaning as the API ranks them, how each was found and al-Muyassar's text, credited (P17)", async ({ page }) => {
  const d = await api<Search>(page, `/search?q=${encodeURIComponent("اليتيم")}&limit=30`);
  expect(d.semantic?.status).toBe("ok");
  const hits = d.results.semantic!;
  await page.goto(`/search?q=${encodeURIComponent("اليتيم")}`);
  const g = group(page, "قريبة في المعنى");
  await expect(g).toBeVisible();
  await expect(g).toContainText("ترتيب يحسبه نموذج لغوي مفتوح على خادمنا");
  const rows = g.locator("li[data-semantic]");
  await expect(rows).toHaveCount(5);
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-semantic")))).toEqual(hits.slice(0, 5).map((h) => h.verse.key));
  const first = rows.first();
  await expect(first).toContainText(`قرأ النموذج الآية مع: ${hits[0].source.work.title_ar}`);
  await expect(first).toContainText(hits[0].source.text.slice(0, 40));
  const how = hits[0].by_meaning && hits[0].by_words ? "وُجدت بالمعنى وبكلمات المصادر" : hits[0].by_meaning ? "وُجدت بالمعنى" : "وُجدت بكلمات المصادر";
  await expect(first).toContainText(how);
  // more of the same ranking, then the verse itself
  await g.getByRole("button", { name: /المزيد|عرض/ }).first().click();
  await expect(rows).toHaveCount(10);
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-semantic")))).toEqual(hits.slice(0, 10).map((h) => h.verse.key));
  await shoot(page, "search-semantic");
  await first.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/quran/${hits[0].verse.surah}/${hits[0].verse.ayah}`));
});

test("the group can be turned off with its facet, and a reference or a root is not searched by meaning (P17)", async ({ page, isMobile }) => {
  await page.goto(`/search?q=${encodeURIComponent("الصبر على البلاء")}`);
  const g = group(page, "قريبة في المعنى");
  await expect(g).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "التصفية" }).click();
  await page.getByRole("checkbox", { name: /بالمعنى \(ترتيب محسوب\)/ }).uncheck();
  await expect(g).toHaveCount(0);
  for (const q of ["2:255", "ك ت ب"]) {
    await page.goto(`/search?q=${encodeURIComponent(q)}`);
    await expect(page.locator("li[data-semantic]")).toHaveCount(0);
  }
});

test("an English search reads the translation, without its verse number (P17)", async ({ page }) => {
  const q = "orphans and their property";
  const d = await api<Search>(page, `/search?q=${encodeURIComponent(q)}&limit=30`);
  expect(d.semantic?.lang).toBe("en");
  await page.goto(`/en/search?q=${encodeURIComponent(q)}`);
  const g = group(page, "Close in meaning");
  await expect(g).toContainText("compares what you wrote with each verse's translation (Saheeh International)");
  const first = g.locator("li[data-semantic]").first();
  await expect(first).toHaveAttribute("data-semantic", d.results.semantic![0].verse.key);
  await expect(first).toContainText(`The model read the verse with: ${d.results.semantic![0].source.work.title_en}`);
  await expect(first.locator("[lang=en][dir=ltr]")).not.toContainText(/^\(\d+\)/);
});

test("the omnibox offers verses close in meaning beside those holding the words (P17)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the omnibox opens from the desktop's header");
  await page.goto("/hadith");
  await page.locator("header").getByRole("button", { name: "بحث", exact: true }).click();
  await page.getByRole("combobox", { name: /اكتب كلمة أو جذرًا/ }).fill("الصبر على البلاء");
  await expect(page.getByRole("option").filter({ hasText: "قريبة المعنى" }).first()).toBeVisible();
});

test("a verse's nearest verses, computed, in its knowledge layers, as the API serves them (P17)", async ({ page }) => {
  const sim = await api<{ items: { verse: { key: string } }[] }>(page, "/verses/2:153/similar");
  expect(sim.items).toHaveLength(10);
  await returning(page);
  await page.goto("/quran/2/153");
  const layer = page.locator(".layer").filter({ hasText: "آيات قريبة المعنى (محسوبة)" });
  await layer.locator(".layer-head").click();
  await expect(layer).toContainText("لا حكم بأن الآيتين بمعنى واحد");
  const links = layer.locator("li a");
  await expect(links).toHaveCount(10);
  const ar = (k: string) => k.replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[+c]);
  await expect(links.first()).toHaveText(ar(sim.items[0].verse.key));
  await shoot(page, "verse-similar");
});

test("search by meaning passes axe in both themes and fits a phone (P17)", async ({ page, isMobile }) => {
  await page.goto(`/search?q=${encodeURIComponent("اليتيم")}`);
  await expect(group(page, "قريبة في المعنى")).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.waitForTimeout(200);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${theme} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  }
  if (isMobile) await expectNoHorizontalScroll(page);
});
