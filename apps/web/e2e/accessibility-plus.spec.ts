import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * Accessibility beyond AA (B9): more contrast — chosen, or the system's request followed — at 7:1 in both themes;
 * wider spacing that never spaces an Arabic word's letters apart; and reading verse by verse with a screen reader,
 * each verse one stop named in today's spelling, ↑ ↓ between verses, Enter opening the verse.
 */

const seed = (page: Page, prefs: object = {}) =>
  page.addInitScript((p) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: p, version: 2 }));
  }, prefs);

const color = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).color);

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

test("more contrast: chosen and kept, or the system's request followed, in both themes (B9)", async ({ page }) => {
  await seed(page);
  await page.goto("/me");
  const contrast = page.getByRole("group", { name: "التباين" });
  await contrast.getByRole("button", { name: "أعلى" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "more");
  expect(await color(page, "body")).toBe("rgb(0, 0, 0)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "more");
  await axe(page);
  await page.evaluate(() => localStorage.setItem("jadhr-theme", "dark"));
  await page.reload();
  expect(await color(page, "body")).toBe("rgb(255, 255, 255)");
  await axe(page);
  // back to the system's: none asked, the ordinary colours; asked, the same as chosen
  await page.getByRole("group", { name: "التباين" }).getByRole("button", { name: "كما في النظام" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-contrast", /./);
  expect(await color(page, "body")).not.toBe("rgb(255, 255, 255)");
  await page.emulateMedia({ contrast: "more" });
  expect(await color(page, "body")).toBe("rgb(255, 255, 255)");
});

test("wider spacing: taller lines and wider gaps, an Arabic word's letters never apart (B9)", async ({ page }) => {
  await seed(page);
  await page.goto("/about");
  const p = page.locator("main p").first();
  const before = await p.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) / parseFloat(getComputedStyle(e).fontSize));
  await page.evaluate(() => {
    localStorage.setItem("jadhr-spacing", "wide");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-spacing", "wide");
  const after = await p.evaluate((e) => ({ line: parseFloat(getComputedStyle(e).lineHeight) / parseFloat(getComputedStyle(e).fontSize), letters: getComputedStyle(e).letterSpacing, words: getComputedStyle(e).wordSpacing }));
  expect(after.line).toBeGreaterThan(before + 0.2);
  expect(after.letters).toBe("normal");
  expect(parseFloat(after.words)).toBeGreaterThan(0);
  await axe(page);
});

test("reading verse by verse with a screen reader: each verse one stop, named in today's spelling (B9)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the keys are a keyboard's; on a phone the screen reader's own gestures move through the verses");
  const lines = (await api<{ data: Record<string, string> }>(page, "/surahs/1/lines?kind=imlaei")).data;
  await seed(page, { readByVerse: true });
  await page.goto("/quran/1");
  const first = page.locator('.passage[data-verse="1:1"]');
  await expect(first).toHaveAttribute("aria-label", `الآية ${ar(1)}:${ar(1)}: ${lines["1"]}`);
  await expect(first).toHaveAttribute("tabindex", "0");
  await expect(first.locator(".verse-line")).toHaveAttribute("aria-hidden", "true");
  await expect(first.locator(".w").first()).toHaveAttribute("tabindex", "-1");
  await first.focus();
  await page.keyboard.press("ArrowDown");
  const second = page.locator('.passage[data-verse="1:2"]');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-label", new RegExp(lines["2"]));
  await page.keyboard.press("Enter");
  await expect(page.locator(".reader-panel").getByRole("article", { name: `الآية ${ar(1)}:${ar(2)}` })).toBeVisible();
  await axe(page);
  // off again, the words come back to the keyboard and to the screen reader
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jadhr-prefs") ?? "{}");
    s.state.readByVerse = false;
    localStorage.setItem("jadhr-prefs", JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator('.passage[data-verse="1:1"] .verse-line')).not.toHaveAttribute("aria-hidden", /./);
  await expect(page.locator('.passage[data-verse="1:1"]')).not.toHaveAttribute("tabindex", /./);
});
