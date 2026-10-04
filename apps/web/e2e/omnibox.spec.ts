import { expect, test } from "@playwright/test";

/**
 * The site's omnibox reaches the whole ecosystem (SHL-Q07): beside the Quran's verses, roots and words, a query finds
 * the dictionary's roots, the hadith and the books' paragraphs — each row named by its kind and leading to its page.
 * Expectations read from the search API.
 */

type Hit = { uri: string; ref: string; text: { slug: string } };
type Search = { results: { dict_roots?: { key: string }[]; texts?: Hit[]; books?: Hit[] } };

test("a query in the header's omnibox finds the dictionary's root, a hadith and a book's paragraph (SHL-Q07)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the keyboard shortcut for the second search; the button opens the same box on the phone");
  const s = (await (await page.request.get(`/api/v1/search?q=${encodeURIComponent("علم")}&limit=8`)).json()) as Search;
  expect(s.results.dict_roots?.length).toBeTruthy();
  expect(s.results.texts?.length).toBeTruthy();
  expect(s.results.books?.length).toBeTruthy();
  await page.goto("/hadith");
  // the header's search opens it (⌘K too, once the page is live)
  const open = () => page.locator("header").getByRole("button", { name: "بحث", exact: true }).click();
  await open();
  const box = page.getByRole("combobox", { name: /اكتب كلمة أو جذرًا/ });
  await box.fill("علم");
  const options = page.getByRole("option");
  await expect(options.filter({ hasText: "المعجم" })).toHaveCount(Math.min(2, s.results.dict_roots!.length));
  await expect(options.filter({ hasText: "حديث" }).first()).toBeVisible();
  await expect(options.filter({ hasText: "كتاب" }).first()).toBeVisible();
  // the first hadith row opens that hadith
  await options.filter({ hasText: "حديث" }).first().click();
  const h = s.results.texts![0];
  await expect(page).toHaveURL(new RegExp(`/hadith/${h.text.slug}/${h.ref.replace(".", "_")}$`));
  // and a dictionary row its root's page, ⌘K from the page it opened
  await page.keyboard.press("Control+k");
  await box.fill("علم");
  await options.filter({ hasText: "المعجم" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${encodeURIComponent(s.results.dict_roots![0].key)}$`));
});
