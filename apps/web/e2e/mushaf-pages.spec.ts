import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * The mushaf by its pages (B1, page mode): a page holds the verses the API places on it, each sūra that begins there
 * headed and opened with the basmala, every word the reader's own; the pages turn by links, the arrow keys and a swipe;
 * the index finds a page by number and by its part. Every expectation read from the API.
 */

type V = { key: string; surah: number; ayah: number };
type S = { number: number; name_ar: string; page_start: number; page_end: number };

const seed = (page: Page) =>
  page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });

test("a page holds its verses, heads the sūras that begin on it, and turns (B1)", async ({ page, isMobile }) => {
  await seed(page);
  const { verses } = await api<{ verses: V[] }>(page, "/pages/50");
  const surahs = (await api<{ data: S[] }>(page, "/surahs")).data;
  await page.goto("/mushaf/50");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`الصفحة ${ar(50)}`);
  await expect(page.locator(".passage")).toHaveCount(verses.length);
  expect(await page.locator(".passage").evaluateAll((els) => els.map((e) => e.getAttribute("data-verse")))).toEqual(verses.map((v) => v.key));
  // a sūra that begins on the page: its name and the basmala before its first verse
  const begins = verses.filter((v) => v.ayah === 1).map((v) => surahs.find((s) => s.number === v.surah)!);
  expect(begins.length).toBeGreaterThan(0);
  for (const s of begins) await expect(page.getByRole("heading", { level: 2, name: `سورة ${s.name_ar}` })).toBeVisible();
  await expect(page.locator(".page-surah-head .basmala")).toHaveCount(begins.filter((s) => s.number !== 1 && s.number !== 9).length);
  // the page as it opens (the word's panel is the reader's, checked with the reader)
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // a word is the reader's: it opens its entry, the page keeping its own address
  const last = verses[verses.length - 1];
  const word = page.locator(`.passage[data-verse="${last.key}"] .w`).first();
  await word.click();
  await expect(page.locator(".reader-panel, .reader-sheet").first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/mushaf/50\\?w=[^&]+&at=${encodeURIComponent(`${last.key}:1`)}$`));
  // the pages turn: the link, then the keyboard or a swipe as the mushaf lies — the next page to the left
  await page.reload();
  await page.getByRole("navigation", { name: "تقليب الصفحات", exact: true }).getByRole("link", { name: "الصفحة التالية" }).click();
  await expect(page).toHaveURL(/\/mushaf\/51$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`الصفحة ${ar(51)}`);
  if (isMobile) {
    await page.evaluate(() => {
      const touch = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
      const on = document.querySelector(".passages")!;
      on.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(300)], changedTouches: [touch(300)] }));
      on.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [touch(150)] }));
    });
    await expect(page).toHaveURL(/\/mushaf\/52$/);
  } else {
    await page.locator("body").press("ArrowRight");
    await expect(page).toHaveURL(/\/mushaf\/50$/);
    await page.locator("body").press("ArrowLeft");
    await expect(page).toHaveURL(/\/mushaf\/51$/);
  }
});

test("the last page heads each of its sūras and turns no further; the index finds a page (B1)", async ({ page }) => {
  await seed(page);
  const { verses } = await api<{ verses: V[] }>(page, "/pages/604");
  await page.goto("/mushaf");
  await page.getByRole("textbox", { name: "رقم الصفحة في مصحف المدينة" }).fill("٦٠٤");
  await page.getByRole("button", { name: "افتح الصفحة" }).click();
  await expect(page).toHaveURL(/\/mushaf\/604$/);
  await expect(page.locator(".page-surah-head")).toHaveCount(new Set(verses.map((v) => v.surah)).size);
  await expect(page.getByRole("link", { name: "الصفحة التالية" })).toHaveCount(0);
  // a part begins where the divisions say
  const parts = (await api<{ juz: { number: number; page: number }[] }>(page, "/divisions")).juz;
  await page.goto("/mushaf");
  await page.getByRole("link", { name: new RegExp(`^الجزء ${ar(30)}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/mushaf/${parts[29].page}$`));
});

test("a sūra's pages open in page mode from the reader (B1)", async ({ page }) => {
  await seed(page);
  const s = (await api<{ data: S[] }>(page, "/surahs")).data.find((x) => x.number === 2)!;
  await page.goto("/quran/2");
  await page.getByRole("link", { name: `الصفحات ${ar(s.page_start)}–${ar(s.page_end)}` }).click();
  await expect(page).toHaveURL(new RegExp(`/mushaf/${s.page_start}$`));
  await expect(page.locator('.passage[data-verse="2:1"]')).toBeVisible();
});
