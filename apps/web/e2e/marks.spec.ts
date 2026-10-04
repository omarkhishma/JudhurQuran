import { expect, type Page, test } from "@playwright/test";

/**
 * The vowel marks of a text that is not the mushaf (D7): shown by default; hidden by the reader on a hadith, they are
 * hidden on the books, the dictionary's articles and the reader's own texts too — one preference, kept — and the
 * mushaf keeps every mark whatever it says. Texts are compared by their marks only, never typed with them.
 */

const MARK = /[\u064b-\u0652]/;

const marked = (page: Page, sel: string) => page.locator(sel).first().evaluate((el, re) => new RegExp(re).test(el.textContent ?? ""), MARK.source);

test("one switch hides the vowel marks of the hadith, the books and the dictionaries, never the mushaf's", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
  });
  await page.goto("/hadith/bukhari/1");
  const toggle = page.locator(".text-tools").getByRole("switch", { name: "التشكيل" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  // al-Bukhārī 1 is vowelled as the compilation gives it
  await expect.poll(() => marked(page, ".hadith-text")).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => marked(page, ".hadith-text")).toBe(false);
  // its words still open their readings: the text is shown bare, not changed
  await page.locator(".hadith-text .hp-matn button.w").first().click();
  await expect(page.getByRole("complementary", { name: "الكلمة" })).toBeVisible();
  // kept: the next hadith, and after a reload, open bare
  await page.reload();
  await expect.poll(() => marked(page, ".hadith-text")).toBe(false);
  // the mushaf keeps every mark
  await page.goto("/quran/1");
  await expect(page.locator('.w[data-w="1:1:1"]')).toBeVisible();
  await expect.poll(() => marked(page, ".w")).toBe(true);
  // the dictionary's articles follow the same switch
  await page.goto(`/dictionary/${encodeURIComponent("علم")}`);
  await expect(page.getByRole("switch", { name: "التشكيل" })).toHaveAttribute("aria-checked", "false");
  // the articles' words; the edition's line under them is our citation, not the lexicon's text
  await expect.poll(() => marked(page, "[role=tabpanel] article > div[lang=ar]")).toBe(false);
  await page.getByRole("switch", { name: "التشكيل" }).click();
  await expect(page.getByRole("switch", { name: "التشكيل" })).toHaveAttribute("aria-checked", "true");
});
