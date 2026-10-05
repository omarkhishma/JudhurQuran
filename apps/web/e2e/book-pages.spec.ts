import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * A book cited by the printed page each word stands on (B56): where a page begins inside a paragraph the page's number
 * is marked in the text, the paragraph names the pages it runs over, and a chosen word's citation names its own page —
 * every expectation read from the API.
 */

type Para = { ref: string; ar_full: string; meta: { pages: [number, number][]; breaks?: [number, number, number, number][] }; cite: { ar: string; key: string; base: string; by: string }; segments: { t: string; w?: number }[] };

test("a page turning inside a paragraph is marked where it turns, and a word is cited by its own page (B56)", async ({ page, isMobile }) => {
  // al-Ṭabarī's paragraph on pages 23–24, its turn where al-Turkī's print turns it
  const p = await api<Para>(page, "/texts/tabari-jamicbayan/passages/28");
  expect(p.cite.by).toBe("page");
  const [[v, first], [, last]] = [p.meta.pages[0], p.meta.pages[p.meta.pages.length - 1]];
  const [o, , opens] = p.meta.breaks![0];
  expect(opens).toBeGreaterThan(first);
  await page.goto(`/books/tabari-jamicbayan/p/${p.ref}`);
  const para = page.locator(".bk-para").first();
  // the pages it runs over, beside it
  await expect(para.locator(".bk-page")).toHaveText(`${ar(v)}/${ar(first)}–${ar(last)}`);
  // the turn, read aloud, standing before the words the page begins with
  const turn = para.getByRole("note", { name: `تبدأ هنا الصفحة ${ar(v)}/${ar(opens)}` });
  await expect(turn).toHaveText(`${ar(v)}/${ar(opens)}`);
  const after = await turn.evaluate((el) => {
    let text = "";
    for (let n = el.nextSibling; n && text.length < 40; n = n.nextSibling) text += n.textContent ?? "";
    return text;
  });
  expect(after.slice(0, 20)).toBe(p.ar_full.slice(o, o + 20));

  // a word before the turn is cited by the paragraph's first page, one after it by the page it begins
  const before = p.segments.findIndex((s) => s.w !== undefined);
  let at = 0;
  const afterIdx = p.segments.findIndex((s) => {
    const here = at;
    at += s.t.length;
    return s.w !== undefined && here >= o;
  });
  await para.locator(`button[data-w="${p.segments[before].w}"]`).click();
  // in the word's panel — beside the text on a computer, the sheet on a phone
  const place = page.getByRole("region", { name: "موضع الكلمة في المطبوع" });
  await expect(place).toContainText(`${p.cite.base}، ${ar(v)}/${ar(first)}`);
  // on a phone the sheet covers the text: closed first, as a reader closes it
  if (isMobile) await page.keyboard.press("Escape");
  await para.locator(`button[data-w="${p.segments[afterIdx].w}"]`).click();
  await expect(place).toContainText(`${p.cite.base}، ${ar(v)}/${ar(opens)}`);
  await expect(place.getByRole("button", { name: "انسخ الإحالة" })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((x) => `${x.id}: ${x.nodes[0]?.target.join(" ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a book whose turns are marked by its regular markers shows them in its chapters too (B56)", async ({ page }) => {
  // the first paragraph of Ibn Kathīr's first section that runs over two pages, read from the API
  const chapter = await api<{ passages: Para[] }>(page, "/texts/ibnkathir-tafsirquran/chapters/2");
  const p = chapter.passages.find((x) => x.meta.breaks?.length);
  test.skip(!p, "the section holds no paragraph over two pages");
  const [, v, opens] = p!.meta.breaks![0];
  await page.goto(`/books/ibnkathir-tafsirquran/2`);
  await expect(page.locator(`#p${p!.ref}`).getByRole("note", { name: `تبدأ هنا الصفحة ${ar(v)}/${ar(opens)}` })).toBeVisible();
});
