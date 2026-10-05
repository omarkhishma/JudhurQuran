import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { drop, person, tag } from "./board";
import { ar } from "./helpers";

/**
 * Where the topics stop (B43): the 114 sūras shaded by the share of their verses a topic gathers — in the map's library
 * for readers, with the numbers as a table, and in the workbench for the board, a sūra's waiting suggestions one press
 * away. Every number read from the API.
 */

type Coverage = { surahs: { surah: number; verses: number; covered: number; placed: number }[]; verses: number; covered: number; placed: number };

test("the library shows where the topics stop, its numbers a table (B43)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the map editor is the desktop's (P8.6a)");
  test.setTimeout(90_000);
  const cov = (await (await page.request.get("/api/v1/topics/coverage")).json()) as Coverage;
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await page.getByRole("button", { name: "خريطة موضوع" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const library = page.getByRole("complementary", { name: "المكتبة" });
  await library.locator("summary", { hasText: "أين تتوقف الموضوعات" }).click();
  const strip = library.getByRole("region", { name: "أين تتوقف الموضوعات" });
  await expect(strip.locator(".topic-cell")).toHaveCount(cov.surahs.length);
  await expect(strip).toContainText(`${ar(cov.covered + cov.placed)} من ${ar(cov.verses)} آية لها موضوع`);
  // a sūra with no topic and one fully covered, as their cells say
  const none = cov.surahs.find((s) => s.covered + s.placed === 0)!;
  await expect(strip.locator(".topic-cell").nth(none.surah - 1)).toHaveAttribute("title", new RegExp(`${ar(0)} من ${ar(none.verses)} آية`));
  // the numbers as a table, for a screen reader and for anyone
  await strip.getByText("الأرقام سورةً سورة").click();
  const row = strip.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${ar(none.surah)}\\. `) }) });
  await expect(row).toContainText(ar(none.verses));
  const results = await new AxeBuilder({ page }).include(".library-section").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("the board's strip lists a sūra's waiting suggestions (B43)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the workbench's board works at a desk; its page is read at 390 px in the workbench's own tests");
  test.setTimeout(120_000);
  const a = await person(browser, `e2e-cov-${tag()}@example.org`, "editor");
  try {
    const cov = (await (await a.page.request.get("/api/v1/topics/coverage")).json()) as Coverage;
    const gap = cov.surahs.find((s) => s.covered + s.placed < s.verses && s.surah > 39)!;
    const waiting = (await (await a.page.request.get(`/api/v1/editorial/verdict?layer=topic_candidates&state=all&q=${gap.surah}:&limit=100`, { headers: a.h })).json()) as { total: number; data: { sub: string }[] };
    await a.page.goto("/workbench?kind=verdict&layer=topic_candidates&state=all");
    const strip = a.page.getByRole("region", { name: "أين تتوقف الموضوعات" });
    await strip.getByRole("button", { name: new RegExp(`آية لها موضوع`) }).nth(gap.surah - 1).click();
    await expect(a.page).toHaveURL(new RegExp(`q=${gap.surah}(%3A|:)`));
    await expect(a.page.getByRole("status").filter({ hasText: ar(waiting.total) }).first()).toBeVisible();
  } finally {
    await drop(a);
  }
});
