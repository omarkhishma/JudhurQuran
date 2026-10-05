import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * My roots (B16): the roots a reader looked up, kept in their browser with the day each was first met — how many of
 * the Quran's, a line of how the count grew with its numbers as a table, the latest met, and the way to open them as
 * a map. The roots and their days are this test's; the Quran's count is the API's.
 */

const DAY = 86_400_000;

test("the roots a reader has met, how their count grew, and the way to a map of them (B16)", async ({ page }) => {
  const total = (await api<{ dataset: { counts: { roots: number } } }>(page, "/meta")).dataset.counts.roots;
  // four roots over three days: two on the first, one on the second, one on the third
  const first = new Date(2026, 8, 1, 12).getTime();
  const met = { "علم": first, "كتب": first + 3_600_000, "رحم": first + DAY, "قول": first + 2 * DAY };
  await page.addInitScript((m) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, rootsMet: m }, version: 3 }));
  }, met);
  await page.goto("/explore");
  const mine = page.getByRole("region", { name: "جذوري" });
  await expect(mine).toContainText(`${ar(4)} جذور من ${new Intl.NumberFormat("ar-EG").format(total)}`);
  // the line ends at the last root met, its count there; the table holds every day, the count never falling
  await expect(mine.locator("figcaption")).toContainText(`${ar(4)} حتى`);
  await mine.getByText("الأرقام يومًا يومًا").click();
  const cells = await mine.locator("tbody td").allTextContents();
  expect(cells).toEqual([ar(2), ar(3), ar(4)]);
  // the latest first, each to its root's page; the map of them
  const chips = mine.getByRole("link", { name: /^[ء-ي] [ء-ي] [ء-ي]$/ });
  await expect(chips.first()).toHaveText("ق و ل");
  await expect(chips.first()).toHaveAttribute("href", `/roots/${encodeURIComponent("قول")}`);
  await expect(mine.getByRole("link", { name: `افتح آخر ${ar(4)} منها خريطة` })).toHaveAttribute("href", /^\/graph\/seed\?s=/);
  const results = await new AxeBuilder({ page }).include("section:has(#explore-my-roots)").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a reader who has met no root sees no empty chart (B16)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 })));
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "استكشف" })).toBeVisible();
  await expect(page.getByRole("region", { name: "جذوري" })).toHaveCount(0);
});
