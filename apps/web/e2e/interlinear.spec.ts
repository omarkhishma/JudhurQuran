import { expect, test } from "@playwright/test";
import { api } from "./helpers";

/**
 * Word by word (B2): under each word its meaning at its place (al-Muyassar fī Gharīb al-Qurʾān's, verbatim, in
 * Arabic; the corpus's gloss in English), its root and its pattern — the source named above the text; off, nothing
 * left on the words. Every line read from the API.
 */

type Il = { words: Record<string, [string | null, string | null, string | null, string | null]> };

for (const locale of ["ar", "en"] as const)
  test(`each word with its meaning, its root and its pattern underneath, ${locale} (B2)`, async ({ page }) => {
    const il = await api<Il>(page, "/surahs/1/interlinear");
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
      localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { interlinear: true }, version: 2 }));
    });
    await page.goto(locale === "ar" ? "/quran/1" : "/en/quran/1");
    const [meaning, gloss, root, pattern] = il.words["1:1:3"];
    const word = page.locator('.w[data-w="1:1:3"]');
    await expect(word).toHaveAttribute("data-il", [locale === "ar" ? meaning : gloss, root, pattern].filter(Boolean).join("\n"));
    // drawn under the word, not over it
    const shown = await word.evaluate((e) => getComputedStyle(e, "::after").content);
    expect(shown).not.toBe("none");
    await expect(page.locator(".interlinear-credit")).toContainText(locale === "ar" ? "الميسر في غريب القرآن الكريم" : "Quranic Arabic Corpus");
    // a word of a phrase the gharīb explains under its first word: the root and pattern only
    if (locale === "ar") await expect(page.locator('.w[data-w="1:1:2"]')).toHaveAttribute("data-il", [il.words["1:1:2"][2], il.words["1:1:2"][3]].filter(Boolean).join("\n"));
    // off: nothing left on the words
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("jadhr-prefs") ?? "{}");
      s.state.interlinear = false;
      localStorage.setItem("jadhr-prefs", JSON.stringify(s));
    });
    await page.reload();
    await expect(page.locator(".w[data-il]")).toHaveCount(0);
    await expect(page.locator(".interlinear-credit")).toHaveCount(0);
  });
