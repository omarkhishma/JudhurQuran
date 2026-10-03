import { expect, type Page, test } from "@playwright/test";

/**
 * Digits follow the interface language (DECISIONS, SHL-Q05): an Arabic page writes a verse key or a word's place
 * in Arabic-Indic digits — «٢:٢٥٥», never «2:255» — wherever it shows one: the reading surface's labels, the
 * panel's titles and occurrence lines, the senses' verse chips, the concordance rows, the doors, the omnibox.
 * English text inside the page (marked lang="en"), citations in English formats and what the reader typed are
 * left as they are.
 */

const OPEN = { layerOpen: { senses: true, family: true, patterns: true, lexica: true, timeline: true, usage: true } };

async function latinKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest("pre, textarea, input, [lang=en], script, style, [aria-hidden=true], .sr-only")) continue;
      if (!el.getBoundingClientRect().width) continue;
      for (const m of n.textContent?.match(/\b\d{1,3}:\d{1,3}(?::\d{1,3})?\b/g) ?? []) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} ${m}`);
    }
    return out;
  });
}

for (const path of ["/quran/2?w=ilm&at=2:120:59", "/quran/2/255", `/roots/${encodeURIComponent("علم")}`, "/concordance", "/search?q=%D8%B5%D8%A8%D8%B1", "/analyse?q=2%3A255", "/explore", "/notebook", "/me", "/data", "/library", "/"])
  test(`Arabic digits for verse keys: ${decodeURIComponent(path)}`, async ({ page }) => {
    await page.addInitScript((open) => {
      localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
      localStorage.setItem("jadhr-prefs", JSON.stringify({ state: open, version: 2 }));
    }, OPEN);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(await latinKeys(page)).toEqual([]);
  });

test("Arabic digits in the omnibox's references", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:1"]').waitFor();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "ابحث في كل شيء" }).fill("2:255:3");
  await expect(page.getByRole("option").first()).toContainText("٢:٢٥٥:٣");
  expect(await latinKeys(page)).toEqual([]);
});
