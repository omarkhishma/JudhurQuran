import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * Meaning search (B12): the verses whose tafsir, gharīb meaning or translation holds the query, each with up to three
 * of its sources credited to their works and the words marked, said to be their words, counted and paged, a filter of
 * their own. Every number and title read from the API.
 */

type Meanings = { totals: Record<string, number>; results: { meanings: { verse: { key: string; surah: number; ayah: number }; sources: { kind: string; work: { title_ar?: string; title_en?: string } }[] }[] } };
const group = (page: Page, name: string) => page.locator(".result-group", { has: page.getByRole("heading", { name, exact: true }) });

test("what the sources say holds the query: the verses, their credited words, counted and paged (B12)", async ({ page, isMobile }) => {
  const d = await api<Meanings>(page, `/search?q=${encodeURIComponent("الصبر")}&limit=30`);
  expect(d.totals.meanings).toBeGreaterThan(10);
  await page.goto(`/search?q=${encodeURIComponent("الصبر")}`);
  const meanings = group(page, "في المعاني");
  await expect(meanings.locator(".mono").first()).toHaveText(ar(d.totals.meanings));
  await expect(meanings).toContainText("لا نجيب نحن");
  const rows = meanings.locator(".result-row");
  await expect(rows).toHaveCount(5);
  const first = d.results.meanings[0];
  await expect(rows.first().getByRole("link").first()).toHaveAttribute("href", `/quran/${first.verse.surah}/${first.verse.ayah}`);
  for (const s of first.sources) await expect(rows.first()).toContainText(s.work.title_ar!);
  await expect(rows.first().locator("mark.kwic-key").first()).toBeVisible();
  await meanings.getByRole("button", { name: /اعرض المزيد/ }).click();
  await expect(rows).toHaveCount(10);
  const results = await new AxeBuilder({ page }).include(".result-group:has(.result-row a[href^='/quran/'])").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // a filter of their own, counted
  if (isMobile) await page.getByRole("button", { name: "التصفية" }).click();
  const box = page.getByRole("checkbox", { name: /المعاني في التفاسير والترجمات/ });
  await box.uncheck();
  await expect(page).toHaveURL(/[?&]k=/);
  await expect(group(page, "في المعاني")).toHaveCount(0);
  await expect(group(page, "في المعاجم")).toBeVisible();
});

test("in English the translations answer, each credited (B12)", async ({ page }) => {
  const d = await api<Meanings>(page, "/search?q=patience&limit=30");
  await page.goto("/en/search?q=patience");
  const meanings = group(page, "In the meanings");
  await expect(meanings.locator(".mono").first()).toHaveText(String(d.totals.meanings));
  const first = d.results.meanings[0];
  const row = meanings.locator(".result-row").first();
  await expect(row.getByRole("link").first()).toHaveAttribute("href", `/en/quran/${first.verse.surah}/${first.verse.ayah}`);
  for (const s of first.sources) await expect(row).toContainText(`${s.work.title_en} • translation`);
  await expect(row.locator("mark.kwic-key").first()).toHaveText(/patience/i);
});
