import { expect, test } from "@playwright/test";
import { api, ar, expectNoHorizontalScroll } from "./helpers";

type Word = { location: string; root: { key: string; spaced: string; occurrences: number } | null; verse: { key: string } };

// The core journey (PLAN phase 4 exit): open a surah → tap a word → see its root family →
// open the root → follow an occurrence → read the verse's tafsir.
test("surah → word → root → occurrence → tafsir", async ({ page }) => {
  const w = await api<Word>(page, "/words/1:1:3");
  expect(w.root?.key).toBe("رحم");

  // a returning reader (a first visit opens Ask — see reader.spec)
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 1 })));
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:3"]').click();
  await expect(page.locator(".reader-panel, .reader-sheet").getByRole("button", { name: new RegExp(w.root!.spaced) }).first()).toBeVisible();
  // The panel states the root's count exactly as the dataset has it.
  await expect(page.getByText(ar(w.root!.occurrences), { exact: false }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  // The root's own page (reached from the omnibox's Roots group).
  await page.goto(`/roots/${encodeURIComponent(w.root!.key)}`);
  await expect(page.getByText(ar(w.root!.occurrences)).first()).toBeVisible();

  // Follow the first occurrence in the concordance to its verse.
  // The concordance renders a desktop and a phone layout; follow the one on screen.
  const occurrence = page.locator("#occurrences a[href*='/quran/']:visible").first();
  await expect(occurrence).toBeVisible();
  await occurrence.click();
  await expect(page).toHaveURL(/\/quran\/\d+/);

  // The verse's tafsir is one tap away and is credited.
  await page.goto(`/quran/${w.verse.key.replace(":", "/")}`);
  await expect(page.getByText("التفسير الميسر").first()).toBeVisible();
});

test("every Arabic page answers without redirects and in Arabic", async ({ page }) => {
  for (const path of ["/", "/quran", "/roots", "/about", "/sources"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(200);
    expect(r?.request().redirectedFrom(), `${path} redirected`).toBeNull();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  }
  const en = await page.goto("/en/about");
  expect(en?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("the sources page lists every layer the reader sees, each with its licence, and fits a phone", async ({ page }) => {
  type S = { attribution_ar: string };
  const d = await api<{ layers: { relations: S[]; patterns: S[]; particles: S[]; gharib: S[]; knowledge: S[] } }>(page, "/sources");
  await page.goto("/sources");
  for (const [title, list] of [
    ["الوجوه والنظائر والفروق والأضداد", d.layers.relations],
    ["كتب الصرف: ما يدل عليه الوزن", d.layers.patterns],
    ["كتب حروف المعاني", d.layers.particles],
    ["غريب القرآن في موضعه", d.layers.gharib],
    ["طبقات المعرفة القرآنية", d.layers.knowledge],
  ] as const) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    for (const s of list) await expect(page.getByText(s.attribution_ar, { exact: false }).first()).toBeAttached();
  }
  await expectNoHorizontalScroll(page);
});

test("unknown paths are real 404s", async ({ page }) => {
  for (const path of ["/no-such-page", "/en/no-such-page", "/quran/999", "/word/1:1:99"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
  }
});
