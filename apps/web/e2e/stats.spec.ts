import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, expectNoHorizontalScroll } from "./helpers";

/**
 * The Quran in numbers, its patterns and relations, and the mind maps (P16, PV-10…PV-17): every number on the page is
 * the API's, read here from the API and looked for on the page; each chart has its table; the charts answer a hover;
 * the pages pass axe in both themes and fit a phone. `SHOTS=<dir>` saves each page at its width in both themes.
 */

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
const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

type Overview = { words: number; verses: number; roots: number; lemmas: number; longest_verse: { key: string; words: number } };
type Freq = { items: { spaced: string; count: number }[] };

test("the Quran in numbers: the API's counts, the most frequent roots, the sūras' sizes, the roots across the sūras (P16)", async ({ page, isMobile }) => {
  const o = await api<Overview>(page, "/stats/overview");
  const f = await api<Freq>(page, "/stats/frequency?kind=root&limit=30&content=true");
  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "القرآن بالأرقام", level: 1 })).toBeVisible();
  const tiles = page.locator(".dash-tile");
  await expect(tiles.filter({ hasText: "الكلمات" }).first()).toContainText(ar(o.words));
  await expect(tiles.filter({ hasText: "الجذور" }).first()).toContainText(ar(o.roots));
  const bars = page.locator("#freq-t").locator("xpath=ancestor::figure").locator(".bar-row");
  await expect(bars).toHaveCount(30);
  await expect(bars.first()).toContainText(f.items[0].spaced);
  await expect(bars.first()).toContainText(ar(f.items[0].count));
  // a kind and a place change the list without leaving the page
  await page.getByRole("button", { name: "الأوزان", exact: true }).click();
  await expect(bars.first()).not.toContainText(f.items[0].spaced);
  // the sūras' columns: one per sūra, and their numbers as a table
  const sizes = page.locator("#sizes-t").locator("xpath=ancestor::figure");
  await expect(sizes.locator("svg path[fill]")).toHaveCount(114);
  await sizes.locator("summary").click();
  await expect(sizes.locator("tbody tr")).toHaveCount(114);
  // a hover names the sūra and its value (a pointer's; a phone has the table)
  if (!isMobile) {
    await sizes.locator("svg rect").first().hover();
    await expect(sizes.locator(".chart-tip")).toBeVisible();
  }
  await shoot(page, "stats");
});

test("a sūra in numbers: its own roots and once-only words as the API counts them, its nearest sūras (P16)", async ({ page }) => {
  const d = await api<{ words: number; unique_roots: { spaced: string }[]; neighbours: { name_ar: string }[] }>(page, "/stats/surahs/112");
  await page.goto("/stats/surah/112");
  await expect(page.getByRole("heading", { name: "سورة الإخلاص بالأرقام" })).toBeVisible();
  await expect(page.locator(".dash-tile").filter({ hasText: "الكلمات" }).first()).toContainText(ar(d.words));
  for (const r of d.unique_roots) await expect(page.locator("#sown-t").locator("xpath=ancestor::figure")).toContainText(r.spaced);
  await expect(page.locator("#snear-t").locator("xpath=ancestor::figure")).toContainText(d.neighbours[0].name_ar);
  await expect(page.locator("#spages-t").locator("xpath=ancestor::figure").locator("svg rect")).toHaveCount(604);
  await shoot(page, "stats-surah");
});

test("patterns and relations: the roots' network, the sūras' similarity, a root's companions with their measures (P16, PV-14)", async ({ page }) => {
  const net = await api<{ nodes: unknown[]; edges: unknown[] }>(page, "/stats/network?top=60&per_node=3");
  const col = await api<{ items: { spaced: string; verses: number }[] }>(page, `/stats/collocations?root=${encodeURIComponent("صبر")}&limit=20`);
  await page.goto("/stats/relations");
  await expect(page.getByRole("heading", { name: "أنماط وعلاقات", level: 1 })).toBeVisible();
  const netFig = page.locator("#net-t").locator("xpath=ancestor::figure");
  await expect(netFig.locator("svg circle")).toHaveCount(net.nodes.length);
  await expect(netFig.locator("svg line")).toHaveCount(net.edges.length);
  await expect(page.locator("#sim-t").locator("xpath=ancestor::figure").locator("canvas")).toBeVisible();
  // a root typed: its companions, each with the verses it shares
  const colFig = page.locator("#col-t").locator("xpath=ancestor::figure");
  await colFig.getByRole("textbox", { name: "اكتب جذرًا" }).fill("صبر");
  await colFig.getByRole("button", { name: "اعرض" }).click();
  await expect(colFig.locator(".bar-row").first()).toContainText(col.items[0].spaced);
  await expect(colFig.locator(".bar-row").first()).toContainText(`${ar(col.items[0].verses)} آية مشتركة`);
  await colFig.getByRole("textbox", { name: "اكتب جذرًا" }).fill("ززز");
  await colFig.getByRole("button", { name: "اعرض" }).click();
  await expect(colFig.getByRole("status")).toHaveText("لا جذر بهذه الحروف في القرآن.");
  await shoot(page, "stats-relations");
});

test("a word's and a root's mind maps: every node leads where it names (P16.4, PV-17)", async ({ page }) => {
  const fam = await api<{ family: { members: unknown[] }[] }>(page, `/roots/${encodeURIComponent("علم")}/family`);
  await page.goto(`/mindmap?root=${encodeURIComponent("علم")}`);
  await expect(page.getByRole("heading", { name: "خريطة الجذر ع ل م" })).toBeVisible();
  const groups = fam.family.filter((g) => g.members.length).slice(0, 8);
  const leaves = groups.reduce((a, g) => a + Math.min(6, g.members.length), 0);
  await expect(page.locator(".mind-branch")).toHaveCount(groups.length);
  await expect(page.locator(".mind-leaf")).toHaveCount(leaves);
  await shoot(page, "mindmap-root");
  await page.goto("/mindmap?word=ilm");
  await expect(page.getByRole("heading", { name: /خريطة الكلمة/ })).toBeVisible();
  await expect(page.locator(".mind-branch").first()).toBeVisible();
  await page.locator("svg a").filter({ has: page.locator(".mind-branch", { hasText: "ع ل م" }) }).first().click();
  await expect(page).toHaveURL(/\/roots\//);
});

test("the statistics pages pass axe in both themes, fit a phone and hydrate as rendered (P16)", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const hydration: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) hydration.push(m.text().slice(0, 200));
  });
  for (const path of ["/stats", "/stats/surah/2", "/stats/relations", `/mindmap?word=ilm`]) {
    await page.goto(path);
    await page.locator(".chart-fig").first().waitFor();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
      await page.waitForTimeout(200);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${theme} ${path} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    }
    if (isMobile) await expectNoHorizontalScroll(page);
  }
  expect(hydration).toEqual([]);
});
