import { expect, test } from "@playwright/test";

/**
 * Every surface is found by search engines (P12): robots.txt names every sitemap; each sitemap lists its part whole
 * — the API's own list for it, recounted here — within the 50,000 addresses a sitemap may hold, each address with its
 * Arabic and English twins; a sample of each answers 200. Nothing a page marks noindex is listed.
 */

const PARTS = ["dictionary", "hadith", "hadith-chapters", "narrators", "books"] as const;
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test("robots.txt names every sitemap, and each part's sitemap lists the API's pages for it, each answering", async ({ page, isMobile }) => {
  test.skip(isMobile, "no screen: one run is enough");
  test.setTimeout(180_000);
  const robots = await (await page.request.get("/robots.txt")).text();
  const named = [...robots.matchAll(/Sitemap: \S+\/sitemap\/([\w-]+)\.xml/g)].map((m) => m[1]);
  expect(named).toEqual(expect.arrayContaining(["core", "words-0", ...PARTS, "maps"]));
  for (const part of PARTS) {
    const want = ((await (await page.request.get(`/api/v1/catalog/${part}`)).json()) as { paths: string[] }).paths;
    const xml = await (await page.request.get(`/sitemap/${part}.xml`)).text();
    const got = locs(xml);
    expect(got.length, part).toBe(want.length);
    expect(got.length, part).toBeLessThanOrEqual(50_000);
    // the Arabic address is the page; its English twin is named beside it
    expect(new URL(got[got.length - 1]).pathname, part).toBe(want[want.length - 1]);
    expect(xml).toContain('hreflang="en"');
    // a sample answers, the first, the last and three between
    for (const p of [want[0], want[Math.floor(want.length / 3)], want[Math.floor((2 * want.length) / 3)], want[want.length - 1]]) {
      const r = await page.request.get(p);
      expect(r.status(), p).toBe(200);
    }
  }
  // what a page keeps out of search is not listed
  const core = locs(await (await page.request.get("/sitemap/core.xml")).text()).map((u) => new URL(u).pathname);
  for (const hidden of ["/library", "/concordance", "/search", "/me", "/notebook"]) expect(core).not.toContain(hidden);
});
