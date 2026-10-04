import { expect, test } from "@playwright/test";
import { api, arKey } from "./helpers";

/**
 * A verse's commentary in the books (B55): the verse mode opens «في كتب التفسير» with each tafsir book whose own
 * headings name the verse — the heading as printed, the section's opening verbatim with its citation, the way to the
 * paragraph and the whole section — and the books' source and licence. Expectations read from the API.
 */

type Book = { text: { slug: string; title_ar: string }; sections: { ordinal: number; heading: string; first: { ref: string; excerpt: string; cite: { ar: string } | null } | null }[] };

test("the verse mode opens the sections of the tafsir books on the verse, each by its own heading (B55)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same layer in the phone's sheet; the desktop's panel is checked");
  const key = "2:3";
  const d = await api<{ data: Book[] }>(page, `/verses/${key}/books`);
  expect(d.data.map((b) => b.text.slug)).toEqual(expect.arrayContaining(["tabari-jamicbayan", "jarallahzamakhshari-kashshaf", "ibnkathir-tafsirquran", "ibncatiyyaandalusi-muharrarwajiz", "hudhawwari-tafsir"]));
  // al-Zamakhsharī names the verse in his own heading
  const z = d.data.find((b) => b.text.slug === "jarallahzamakhshari-kashshaf")!;
  expect(z.sections[0].heading).toMatch(/^البقرة : \( 3 \)/);
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 })));
  await page.goto("/quran/2#v3");
  await page.locator(`[data-verse-btn="${key}"]`).click();
  const entry = page.locator(".reader-panel").getByRole("article", { name: `الآية ${arKey(key)}` });
  const layer = entry.locator("section.layer").filter({ has: page.locator(".layer-head", { hasText: "في كتب التفسير" }) });
  await layer.locator(".layer-head").click();
  await expect(layer.locator("[data-book]")).toHaveCount(d.data.length);
  const zb = layer.locator('[data-book="jarallahzamakhshari-kashshaf"]');
  await expect(zb).toContainText(z.sections[0].heading);
  await expect(zb).toContainText(z.sections[0].first!.excerpt.split(" ").slice(0, 6).join(" "));
  await expect(zb.getByRole("link", { name: "الفقرة" }).first()).toHaveAttribute("href", `/books/jarallahzamakhshari-kashshaf/p/${encodeURIComponent(z.sections[0].first!.ref)}`);
  await expect(zb.getByRole("link", { name: /^القسم/ }).first()).toHaveAttribute("href", `/books/jarallahzamakhshari-kashshaf/${z.sections[0].ordinal}`);
  // the books' source and licence, on screen
  await expect(layer.locator('a[rel~="license"]')).toHaveCount(1);
});
