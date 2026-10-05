import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * What we know and what we do not yet (B17): every layer with the share of the text it covers, whether a source gave it
 * or our rules derived it, where the sources disagree; no expert signature claimed while there is none. Every number
 * read from the API.
 */

type Layer = { id: string; count: number; of: number; how: string; disagree?: number };

test("each layer's numbers as the data counts them, and no signature claimed (B17)", async ({ page }) => {
  const d = await api<{ layers: Layer[]; signed: number; review: Record<string, number> }>(page, "/transparency");
  await page.goto("/transparency");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ما نعرفه وما لا نعرفه بعد");
  if (d.signed === 0) await expect(page.getByRole("note")).toContainText("لم يوقّع خبيرٌ بعدُ على أي طبقة");
  const fmt = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
  for (const id of ["roots", "narrators", "hadith-split", "book-pages"]) {
    const l = d.layers.find((x) => x.id === id)!;
    const row = page.locator("li").filter({ hasText: `${fmt(l.count)} من ${fmt(l.of)}` }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(l.how === "rule" ? "بقواعدنا، لم يُراجَع" : "من مصدره");
  }
  const roots = d.layers.find((x) => x.id === "roots")!;
  await expect(page.getByText(`${fmt(roots.disagree!)} كلمة تختلف فيها المصادر في جذرها`)).toBeVisible();
  await expect(page.getByRole("region", { name: "المراجعة" }).getByText(ar(d.review.proposals_open ?? 0), { exact: true }).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
