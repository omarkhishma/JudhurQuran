import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ar, expectNoHorizontalScroll } from "./helpers";

/**
 * A root's life across the texts (P11.4b): its Quran and dictionary pages show the hadith and the books holding it —
 * the sure apart from the possible, by text — with its first passages marked; the page of every passage filters by
 * kind, book and reading; the concordance takes a source. Expected numbers come from the API, never typed in.
 */

type Life = {
  root: { key: string; display: string };
  counts: { slug: string; kind: string; title_ar: string; sure: number; possible: number }[];
  totals: Record<"hadith" | "book", { sure: number; possible: number; texts: number }>;
  data: { uri: string; ref: string; text: { slug: string; kind: string }; kwic: { word: string } | null }[];
  total: number;
};
const enc = encodeURIComponent;
const life = async (page: import("@playwright/test").Page, q = "") => (await (await page.request.get(`/api/v1/roots/${enc("علم")}/texts${q}`)).json()) as Life;

async function axe(page: import("@playwright/test").Page) {
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

test("the Quran's root page and the dictionary's show the root in the hadith and the books", async ({ page }) => {
  const d = await life(page, "?limit=5");
  for (const path of [`/roots/${enc("علم")}`, `/dictionary/${enc("علم")}`]) {
    await page.goto(path);
    const section = page.locator("section[aria-labelledby=texts-h]");
    await expect(section.getByRole("heading", { name: "في الحديث والكتب" })).toBeVisible();
    await expect(section.locator("[data-kind=hadith]")).toContainText(ar(d.totals.hadith.sure));
    await expect(section.locator("[data-kind=book]")).toContainText(ar(d.totals.book.sure));
    // the first passages, each with the root's word marked, linked to where it is read
    const first = d.data[0];
    const row = section.locator(`a[data-uri="${first.uri}"]`);
    await expect(row.locator("mark.kwic-word")).toHaveText(first.kwic!.word);
    await expect(row).toHaveAttribute("href", first.text.kind === "hadith" ? `/hadith/${first.text.slug}/${first.ref}` : `/books/${first.text.slug}/p/${first.ref}`);
    await axe(page);
    await expectNoHorizontalScroll(page);
  }
});

test("every passage of a root: by kind, by book, the sure or the possible", async ({ page }) => {
  const books = await life(page, "?kind=book&which=possible&limit=40");
  await page.goto(`/dictionary/${enc("علم")}/texts`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("الجذر علم في الحديث والكتب");
  await page.getByRole("navigation", { name: "النوع" }).getByRole("link", { name: "في كتب التراث" }).click();
  await expect(page).toHaveURL(/kind=book/);
  await page.getByRole("navigation", { name: "القراءة" }).getByRole("link", { name: "المحتمل" }).click();
  await expect(page).toHaveURL(/kind=book.*which=possible|which=possible.*kind=book/);
  await expect(page.locator("p[aria-live=polite]")).toContainText(ar(books.total));
  await expect(page.locator("a[data-uri]")).toHaveCount(Math.min(40, books.total));
  await expect(page.locator("a[data-uri] .state-chip").first()).toHaveText("محتمل");
  await axe(page);
  await expectNoHorizontalScroll(page);
});

test("the concordance takes a source: the Quran's lines, the hadith's, the books'", async ({ page }) => {
  const hadith = await life(page, "?kind=hadith&limit=40");
  await page.goto(`/concordance?root=${enc("علم")}`);
  const source = page.getByRole("navigation", { name: "المصدر" });
  await expect(source.getByRole("link", { name: "القرآن" })).toHaveAttribute("aria-current", "page");
  await source.getByRole("link", { name: "الحديث" }).click();
  await expect(page).toHaveURL(/source=hadith/);
  await expect(page.locator("p[aria-live=polite]")).toContainText(ar(hadith.total));
  await expect(page.locator("a[data-uri]").first()).toHaveAttribute("data-uri", hadith.data[0].uri);
  await axe(page);
});
