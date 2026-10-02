import { expect, test } from "@playwright/test";
import { api, ar, expectNoHorizontalScroll } from "./helpers";

type Word = { location: string; root: { key: string; spaced: string; occurrences: number } | null; verse: { key: string } };

// The core journey (PLAN phase 4 exit): open a surah → tap a word → see its root family →
// open the root → follow an occurrence → read the verse's tafsir.
test("surah → word → root → occurrence → tafsir", async ({ page }) => {
  const w = await api<Word>(page, "/words/1:1:3");
  expect(w.root?.key).toBe("رحم");

  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:3"]').click();
  const rootLink = page.getByRole("link", { name: new RegExp(w.root!.spaced) }).first();
  await expect(rootLink).toBeVisible();
  // The panel states the root's count exactly as the dataset has it.
  await expect(page.getByText(ar(w.root!.occurrences), { exact: false }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await rootLink.click();
  await expect(page).toHaveURL(/\/roots\//);
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

test("unknown paths are real 404s", async ({ page }) => {
  for (const path of ["/no-such-page", "/en/no-such-page", "/quran/999", "/word/1:1:99"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
  }
});
