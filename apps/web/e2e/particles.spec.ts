import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/** Particles in the Meanings section (P3.8): the books on particles reached by the word or by its affix. */

type Link = { id: string; headword_ar: string; via: { kind: string; text?: string; label?: { ar: string } } };
type Entry = { senses: { text_ar: string }[]; source: { attribution_ar: string } };
const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const PREFS = { state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 };
const region = (page: Page) => page.locator('.reader-panel [data-section="senses"], .reader-sheet [data-section="senses"]').first().getByRole("region", { name: "عند النحاة" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([r, p]) => {
      localStorage.setItem("jadhr-personal", JSON.stringify(r));
      localStorage.setItem("jadhr-prefs", JSON.stringify(p));
    },
    [RETURNING, PREFS] as const,
  );
});

test("فِي opens on Ibn Hishām and al-Murādī; an entry unfolds into its senses, verbatim, with the credit", async ({ page }) => {
  const loc = "2:2:5";
  const { slug } = await api<{ slug: string }>(page, `/locations/${loc}/word`);
  const w = await api<{ root: unknown; particles: Link[] }>(page, `/words/${slug}?limit=0&at=${loc}`);
  expect(w.root).toBeNull();
  const lemmaLinks = w.particles.filter((p) => p.via.kind === "lemma");
  expect(lemmaLinks.length).toBeGreaterThan(0);
  await page.goto(`/quran/2?w=${slug}&at=${loc}#v2`);
  const box = region(page);
  await expect(box.locator(".particle-item")).toHaveCount(w.particles.length);
  const first = box.locator(".particle-item").first();
  await expect(first).toContainText(lemmaLinks[0].headword_ar);
  const e = await api<Entry>(page, `/particles/${lemmaLinks[0].id}`);
  await first.locator(".particle-head").click();
  await expect(first.locator(".particle-sense")).toHaveCount(e.senses.length);
  await expect(first.locator(".particle-sense").first()).toContainText(e.senses[0].text_ar.slice(0, 40));
  await expect(first).toContainText(e.source.attribution_ar);
  // the typing's hemistich mark is drawn as a gap, never shown as "%"
  if (e.senses.some((x) => /(^|[\s(])%(?=[\s)]|$)/.test(x.text_ar))) await expect(first.locator(".particle-body")).not.toContainText("%");
});

test("the و of وَإِذْ reaches the entries on wāw through its corpus tag", async ({ page }) => {
  const w = await api<{ particles: Link[] }>(page, "/words/idh?limit=0&at=2:30:1");
  const viaWaw = w.particles.filter((p) => p.via.kind === "affix");
  expect(viaWaw.length).toBeGreaterThan(0);
  await page.goto("/quran/2?w=idh&at=2:30:1#v30");
  const box = region(page);
  await expect(box.locator(".particle-item", { hasText: `«${viaWaw[0].via.text}» في هذه الكلمة: ${viaWaw[0].via.label!.ar}` })).toHaveCount(viaWaw.length);
});
