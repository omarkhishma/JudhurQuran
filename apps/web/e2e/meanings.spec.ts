import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/** The Meanings section's sourced layers (P3.1): al-Muyassar for this place, al-Rāghib for the word. */

type W = {
  occurrence: { meanings_here: { phrase_ar: string; meaning_ar: string; title_ar: string }[] };
  mufradat: { subentries: { headword_ar: string; text_ar: string; senses: { text_ar: string; list_no: number }[] }[] } | null;
};
const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const PREFS = { state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 };
const meanings = (page: Page) => page.locator('.reader-panel [data-section="senses"], .reader-sheet [data-section="senses"]').first();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([r, p]) => {
      localStorage.setItem("jadhr-personal", JSON.stringify(r));
      localStorage.setItem("jadhr-prefs", JSON.stringify(p));
    },
    [RETURNING, PREFS] as const,
  );
});

test("Meanings opens with al-Muyassar's meaning of this very phrase, credited and marked display-only", async ({ page }) => {
  const w = await api<W>(page, "/words/amana?limit=0&at=2:3:2");
  const m = w.occurrence.meanings_here[0];
  await page.goto("/quran/2?w=amana&at=2:3:2#v3");
  const first = meanings(page).locator(".sense-row").first();
  await expect(first).toContainText(m.phrase_ar);
  await expect(first).toContainText(m.meaning_ar);
  await expect(first).toContainText("المعنى في هذا الموضع");
  await expect(first).toContainText(m.title_ar);
  await expect(first).toContainText("للعرض فقط");
});

test("al-Rāghib's numbered senses for a word he treats, verbatim, with the status said", async ({ page }) => {
  const w = await api<W>(page, "/words/ilm?limit=0&at=20:114:17");
  const sub = w.mufradat!.subentries.find((s) => s.senses.length > 0)!;
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const box = meanings(page).getByRole("region", { name: "عند الراغب في المفردات" });
  const art = box.locator(".mufradat-sub", { hasText: sub.headword_ar }).first();
  await expect(art.locator("ol > li")).toHaveCount(sub.senses.length);
  // one list per numbered list in the text, the later ones nested
  const lists = new Set(sub.senses.map((x) => x.list_no)).size;
  await expect(art.locator("ol")).toHaveCount(lists);
  for (const [i, s] of sub.senses.entries()) await expect(art.locator("ol > li").nth(i)).toContainText(s.text_ar);
  await expect(box).toContainText("لم يراجعها محرر بعد");
});

test("a word al-Rāghib does not treat shows no al-Mufradāt block", async ({ page }) => {
  const w = await api<W>(page, "/words/malik-2?limit=0&at=1:4:1");
  expect(w.mufradat).toBeNull();
  await page.goto("/quran/1?w=malik-2&at=1:4:1");
  await expect(meanings(page).locator(".sense-row").first()).toBeVisible();
  await expect(meanings(page).getByRole("region", { name: "عند الراغب في المفردات" })).toHaveCount(0);
});
