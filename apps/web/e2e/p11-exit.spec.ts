import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

/**
 * P11's exit (PLAN P11.5 ◆): one root followed from a hadith to the Quran to a lexicon article to a book passage
 * without leaving the product — by the links a reader clicks, nothing typed into an address. The root is the one the
 * hadith's word reads to; every expectation comes from the API.
 */

const enc = encodeURIComponent;
type Seg = { t: string; w?: number; p?: string };
type Rec = { segments: Seg[]; words: number[]; forms: Record<string, { readings: { root: string | null; dict_root: string | null }[] }> };
type Dict = { key: string; works: { title_ar: string; articles: { headword: string }[] }[] };
type Life = { data: { uri: string; ref: string; text: { slug: string; kind: string } }[] };

test("one root from a hadith to the Quran, a lexicon article and a book passage", async ({ page, isMobile }) => {
  // the hadith: al-Bukhārī 1, «الأعمال» in what it reports
  const rec = (await (await page.request.get("/api/v1/texts/bukhari/passages/1")).json()) as Rec;
  const word = rec.segments.find((s) => s.w !== undefined && s.p === "matn" && rec.forms[String(rec.words[s.w])]?.readings[0]?.root === "عمل")!;
  const reading = rec.forms[String(rec.words[word.w!])].readings[0];
  await page.goto("/hadith/bukhari/1");
  await page.locator(".hadith-text .hp-matn").getByRole("button", { name: word.t, exact: true }).click();
  const panel = page.getByRole("complementary", { name: "الكلمة" });
  // to the Quran: the root's page
  await panel.getByRole("link", { name: "الجذر في القرآن" }).click();
  await expect(page).toHaveURL(new RegExp(`/roots/${enc(reading.root!)}$`));
  await expect(page.locator("#lexicon")).toBeVisible();
  // to a lexicon article: the dictionary's page of the same root, its articles in the lexica
  const dict = (await (await page.request.get(`/api/v1/dictionary/roots/${enc(reading.dict_root!)}`)).json()) as Dict;
  await page.getByRole("link", { name: "كل مواد هذا الجذر في المعجم" }).click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${enc(dict.key)}$`));
  const lexica = page.getByRole("tablist", { name: "المعاجم", exact: true });
  await expect(lexica.getByRole("tab")).toHaveCount(dict.works.length);
  await expect(page.getByRole("tabpanel")).toContainText(dict.works[0].articles[0].headword);
  // to a book passage: the root's life in the books, its first passage, the paragraph's own page
  const books = (await (await page.request.get(`/api/v1/roots/${enc(dict.key)}/texts?kind=book&limit=1`)).json()) as Life;
  const section = page.locator("section[aria-labelledby=texts-h]");
  await section.getByRole("link", { name: "كل مواضعه في الكتب" }).click();
  await expect(page).toHaveURL(/kind=book/);
  const first = books.data[0];
  await page.locator(`a[data-uri="${first.uri}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/books/${first.text.slug}/p/${first.ref}$`));
  // the paragraph holds the root's word, and its citation stands under it
  await expect(page.locator(".bk-body")).toBeVisible();
  await expect(page.locator(".bk-cite-text")).not.toBeEmpty();
  if (isMobile) await expectNoHorizontalScroll(page);
});
