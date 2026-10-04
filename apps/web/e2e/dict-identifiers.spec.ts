import { expect, test } from "@playwright/test";
import { api } from "./helpers";

/**
 * The lexica's articles as citable things (P1.7a): each article closes its citation with its identifier
 * (`dict:<work>:<root>`), which is its own address — the root's page opened at it, its lexicon's tab chosen — and a
 * search hit in the dictionaries leads to the article itself. Expectations read from the API.
 */

type Root = { key: string; works: { id: string; title_ar: string; articles: { id: number; uri: string; headword: string }[] }[] };

test("an article's identifier is its address: the root's page opens at it, on its lexicon's tab (P1.7a)", async ({ page }) => {
  const root = await api<Root>(page, `/dictionary/roots/${encodeURIComponent("علم")}`);
  // an article of a lexicon that is not the first tab, so the address has to choose it
  const work = root.works[2];
  const art = work.articles[0];
  expect(art.uri.startsWith(`dict:${work.id}:`)).toBe(true);
  await page.goto(`/dictionary/${encodeURIComponent(root.key)}#${encodeURIComponent(art.uri)}`);
  await expect(page.getByRole("tab", { name: work.title_ar })).toHaveAttribute("aria-selected", "true");
  const target = page.locator(".dict-anchor.is-target");
  await expect(target).toHaveCount(1);
  await expect(target).toHaveAttribute("id", art.uri);
  await expect(target).toBeInViewport();
  // the citation ends with the identifier, a link to this very address
  const link = target.getByRole("link", { name: art.uri });
  await expect(link).toHaveAttribute("href", `/dictionary/${encodeURIComponent(root.key)}#${encodeURIComponent(art.uri)}`);
  // by the identifier, the API gives the same article as by its row
  const byUri = await api<{ id: number; headword: string }>(page, `/dictionary/entries/${encodeURIComponent(art.uri)}`);
  expect([byUri.id, byUri.headword]).toEqual([art.id, art.headword]);
  // the reader's English page too
  await page.goto(`/en/dictionary/${encodeURIComponent(root.key)}#${encodeURIComponent(work.articles[0].uri)}`);
  await expect(page.locator(".dict-anchor.is-target")).toHaveAttribute("id", art.uri);
});

test("a search hit in the dictionaries opens the article itself (P1.7a)", async ({ page }) => {
  const s = await api<{ results: { dictionary?: { uri: string; dict_root: string | null }[] } }>(page, `/search?q=${encodeURIComponent("علم")}&limit=8`);
  const hit = s.results.dictionary?.find((d) => d.dict_root && d.uri);
  expect(hit).toBeTruthy();
  await page.goto(`/search?q=${encodeURIComponent("علم")}`);
  const row = page.locator(`a.result-row[href$="#${encodeURIComponent(hit!.uri)}"]`).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${encodeURIComponent(hit!.dict_root!)}#`));
  await expect(page.locator(".dict-anchor.is-target")).toHaveAttribute("id", hit!.uri);
});
