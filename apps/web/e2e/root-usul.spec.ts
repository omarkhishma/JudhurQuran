import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/** P3.7a: where Ibn Fāris gives a root several uṣūl, the family view says its words share letters, not one meaning. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const PREFS = { state: { layerOpen: { senses: false, family: true, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
type W = { root: { gist_source: { usul: string } | null } };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([r, p]) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(r));
    localStorage.setItem("jadhr-prefs", JSON.stringify(p));
  }, [RETURNING, PREFS] as const);
});

test("a root with unrelated uṣūl, one with several, and one with a single aṣl", async ({ page }) => {
  for (const [slug, usul, text] of [
    ["fidya", "unrelated", "أصول هذا الجذر متباينة"],
    ["karim", "several", "أكثر من أصل"],
    ["ilm", "one", null],
  ] as const) {
    const w = await api<W>(page, `/words/${slug}?limit=0`);
    expect(w.root.gist_source?.usul).toBe(usul);
    await page.goto(`/read?w=${slug}`);
    const fam = panel(page).locator('[data-section="family"]');
    await expect(fam.locator(".ar-classical").first()).toBeVisible();
    if (text) await expect(fam.locator(".usul-note")).toContainText(text);
    else await expect(fam.locator(".usul-note")).toHaveCount(0);
  }
});
