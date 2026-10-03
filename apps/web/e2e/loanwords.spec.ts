import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** P3.7a: a word al-Suyūṭī reports as non-Arabic — his entry verbatim, the dispute with each view, the family's mark. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const PREFS = { state: { layerOpen: { senses: true, family: true, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
type W = { loanwords: { text_ar: string; page: number }[] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([r, p]) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(r));
    localStorage.setItem("jadhr-prefs", JSON.stringify(p));
  }, [RETURNING, PREFS] as const);
});

test("al-Suyūṭī's entry on «إستبرق», his page, and the dispute over loanwords view by view", async ({ page }) => {
  const w = await api<W>(page, "/words/istabraq?limit=0");
  await page.goto("/read?w=istabraq");
  const box = panel(page).getByRole("region", { name: "في المعرّب" });
  await expect(box.locator(".loanword-entry")).toHaveCount(1);
  await expect(box).toContainText(w.loanwords[0].text_ar.slice(0, 40));
  await expect(box).toContainText(`ص ${ar(w.loanwords[0].page)}`);
  await expect(box).toContainText("الفارسية");
  await box.getByRole("button", { name: "الخلاف في وقوع المعرّب في القرآن" }).click();
  for (const v of ["مَن نفى وقوعه", "مَن أثبته", "اختيار السيوطي", "مَن جمع بين القولين"]) await expect(box.getByRole("region", { name: v })).toBeVisible();
  await expect(box.getByRole("region", { name: "مَن نفى وقوعه" })).toContainText("الشافعي");
});

test("the family marks the word al-Suyūṭī reports apart from the rest of the root («أليم» in أ ل م)", async ({ page }) => {
  const w = await api<{ family: { members: { slug: string; ar: { full: string }; loanword?: boolean }[] }[] }>(page, "/words/alim-2?limit=0");
  const members = w.family.flatMap((g) => g.members);
  const claimed = members.filter((m) => m.loanword);
  expect(claimed.map((m) => m.slug)).toEqual(["alim-2"]);
  expect(members.length).toBeGreaterThan(1);
  await page.goto("/read?w=alim-2");
  const fam = panel(page).locator('[data-section="family"]');
  await expect(fam.locator(".word-chip").first()).toBeVisible();
  const marked = fam.locator(".word-chip", { has: page.locator(".loan-mark") });
  await expect(marked).toHaveCount(1);
  await expect(marked).toContainText(claimed[0].ar.full);
});
