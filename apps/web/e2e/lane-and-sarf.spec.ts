import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/**
 * Two pointers from a word to its sources (P3.1, P3.3): in Lane's article of the root, the paragraph on this very
 * word — the noun's and the verb's apart, verbatim, with Lane's headword, its page and how it was matched; and from
 * the Family and Shapes tables, «ما في كتب الصرف» opening the pattern's view on what the books of sarf say of it.
 * Every expectation read from the API.
 */

const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
type LaneWord = { para: number; headword: string; page_ref: string | null; rule: string; text: string };
type Payload = {
  dict_articles: { id: string; entries: { id: number; word?: LaneWord[] }[] }[];
  family: { pattern: { slug: string; ar: { full: string }; classical?: boolean } | null }[];
};

async function open(page: Page, slug: string, at: string, layers: Record<string, boolean>) {
  await page.addInitScript((l) => {
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: false, family: false, patterns: false, lexica: false, timeline: false, usage: false, ...l }, lexMode: "list" }, version: 2 }));
  }, layers);
  await page.goto(`/quran/${at.split(":")[0]}?w=${slug}&at=${at}`);
}

const laneWord = (w: Payload) => w.dict_articles.find((d) => d.id === "lane")?.entries.flatMap((e) => e.word ?? []) ?? [];

test("Lane's paragraph on the word: the noun's and the verb's apart, verbatim, with its headword and page (P3.1)", async ({ page }) => {
  const noun = laneWord(await api<Payload>(page, "/words/ilm?limit=0&at=20:114:17"));
  const verb = laneWord(await api<Payload>(page, "/words/alima?limit=0"));
  expect(noun).toHaveLength(1);
  expect(verb).toHaveLength(1);
  expect(noun[0].para).not.toBe(verb[0].para);
  await open(page, "ilm", "20:114:17", { lexica: true });
  // the panel on a desktop, the sheet on a phone (its layers stacked): the one on screen
  const lex = panel(page).locator('[data-section="lexica"]:visible');
  await expect(lex).toHaveCount(1);
  const block = lex.locator('[data-dict="lane"] .dict-word');
  await expect(block).toHaveCount(1);
  await expect(block.locator("bdi")).toHaveText(noun[0].headword);
  await expect(block.locator(".dict-body")).toContainText(noun[0].text.slice(0, 120));
  await expect(block).toContainText("رُبطت بالكلمة بحركاتها");
  if (noun[0].page_ref) await expect(block).toContainText(`ص ${noun[0].page_ref}`);
});

test("«ما في كتب الصرف» from the Family table opens the pattern's view on what the books say (P3.3)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the tables' layout is the desktop panel's; the phone shows the same view by its tab");
  const w = await api<Payload>(page, "/words/ilm?limit=0&at=20:114:17");
  const with_ = w.family.map((g) => g.pattern).filter((p) => p?.classical);
  const without = w.family.map((g) => g.pattern).filter((p) => p && !p.classical);
  expect(with_.length).toBeGreaterThan(0);
  await open(page, "ilm", "20:114:17", { family: true, patterns: true });
  const family = panel(page).locator('[data-section="family"]');
  // a link on each pattern the books speak of, and none on the others
  await expect(family.getByRole("button", { name: "ما في كتب الصرف" })).toHaveCount(with_.length);
  const target = with_[0]!;
  const classical = await api<{ classical: { rows: unknown[] } }>(page, `/patterns/${target.slug}`);
  await family.locator(".family-group").filter({ hasText: target.ar.full }).getByRole("button", { name: "ما في كتب الصرف" }).click();
  const shapes = panel(page).locator('[data-section="patterns"]');
  await expect(shapes.locator(".classical .classical-row")).toHaveCount(classical.classical.rows.length);
  if (without.length) await expect(family.locator(".family-group").filter({ hasText: without[0]!.ar.full }).getByRole("button", { name: "ما في كتب الصرف" })).toHaveCount(0);
});
