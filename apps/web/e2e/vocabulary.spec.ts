import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** P3.6: how common a verse's and a sūra's words are in the Quran, shown as what it measures (L4). */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
type Profile = { words: number; c100: number; c20: number; c1: number; level: number; verse_levels?: Record<string, number> };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((v) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v));
  }, RETURNING);
});

test("verse mode states the verse's lexical level, its share of common words and its words found nowhere else", async ({ page }) => {
  const v = await api<{ lexical_profile: Profile }>(page, "/verses/2:255");
  const p = v.lexical_profile;
  await page.goto("/quran/2/255");
  const line = page.locator(".vocab-line");
  await expect(line).toBeVisible();
  await expect(line).toContainText(`المستوى المعجمي ${ar(p.level)} من ${ar(5)}`);
  const pct = new Intl.NumberFormat("ar-EG", { style: "percent" }).format((p.c100 + p.c20) / p.words);
  await expect(line).toContainText(`${pct} من كلماتها مما يرد في القرآن ٢٠ مرة فأكثر`);
  expect(p.c1).toBe(2);
  await expect(line).toContainText("كلمتان لا تردان في القرآن إلا هنا");
  await expect(line.locator(".term")).toHaveCount(1);
});

test("a sūra's About counts its verses by lexical level", async ({ page }) => {
  const s = (await api<{ data: { number: number; verse_count: number; lexical_profile: Profile }[] }>(page, "/surahs")).data.find((x) => x.number === 67)!;
  await page.goto("/quran/67");
  await page.locator("[data-about]").first().click();
  const box = page.getByRole("region", { name: "مفردات السورة" });
  await expect(box).toBeVisible();
  const ord = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس"];
  const lv = s.lexical_profile.verse_levels!;
  await expect(box.locator(".vocab-levels")).toHaveText(ord.map((o, i) => `${o} ${ar(lv[String(i + 1)] ?? 0)}`).join("، "));
  expect(Object.values(s.lexical_profile.verse_levels!).reduce((a, b) => a + b, 0)).toBe(s.verse_count);
});
