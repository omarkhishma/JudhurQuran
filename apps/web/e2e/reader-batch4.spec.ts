import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/** Verse furniture that is not a control (RDR-547). */

const BASE = { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [] as unknown[], savedTrails: [] };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
const seed = (page: Page, prefs?: Record<string, unknown>) =>
  page.addInitScript(
    ([s, p]) => {
      if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: s, version: 1 }));
      if (p) localStorage.setItem("jadhr-prefs", JSON.stringify({ state: p, version: 2 }));
    },
    [BASE, prefs ?? null] as const,
  );
const SAJDA = "۩";

test("the sajda sign stands beside its word, not inside it, and the words read back as stored (RDR-547)", async ({ page, context, browserName, isMobile }) => {
  const desktopClipboard = browserName === "chromium" && !isMobile;
  if (desktopClipboard) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page);
  const v = await api<{ tokens: { text: string }[] }>(page, "/verses/32:15");
  expect(v.tokens.some((t) => t.text.endsWith(SAJDA))).toBeTruthy();
  await page.goto("/quran/32#v15");
  const verse = page.locator('[data-verse="32:15"]');
  const mark = verse.locator(".sajda-mark");
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute("aria-label", "موضع سجدة التلاوة");
  await expect(verse.locator("button.w", { hasText: SAJDA })).toHaveCount(0);
  // what is drawn joins back to the stored tokens, letter for letter (L1)
  const shown = await verse.locator(".w").evaluateAll((els) =>
    els.map((w) => (w.textContent ?? "") + (w.nextElementSibling?.getAttribute("data-furniture") === "sajda" ? (w.nextElementSibling.textContent ?? "") : "")),
  );
  expect(shown).toEqual(v.tokens.map((t) => t.text));
  // the sign opens nothing
  await mark.click();
  await expect(page).not.toHaveURL(/[?&]w=/);
  if (desktopClipboard) {
    await page.locator('[data-verse-btn="32:15"]').click();
    await verse.locator('.ptool[data-tool="copy"]').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(v.tokens.map((t) => t.text).join(" "));
  }
});

test("waqf signs stay on the word they are written on (RDR-547)", async ({ page }) => {
  await seed(page);
  const v = await api<{ tokens: { text: string }[] }>(page, "/verses/2:2");
  const withSign = v.tokens.find((t) => /[ۖ-ۜ]$/.test(t.text));
  expect(withSign, "2:2 carries a waqf sign").toBeTruthy();
  await page.goto("/quran/2#v2");
  await expect(page.locator('[data-verse="2:2"] button.w', { hasText: withSign!.text })).toHaveCount(1);
});
