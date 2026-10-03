import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/** Word audio (P3.7, D10): a word is heard as its slice of al-Ḥuṣarī's teaching recitation whatever reciter
 * the verses play in; what keeps the slice from being clean is said; an untimed word has no button. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
type Audio = { name_ar: string; url: string; start_ms: number; flags: string[] } | null;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((v) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v));
  }, RETURNING);
});

test("a word plays its slice of the teaching recitation, and its note says why the cut is not clean", async ({ page }) => {
  const w = await api<{ occurrence: { audio: Audio } }>(page, "/words/huda?at=2:2:6&limit=0");
  const audio = w.occurrence.audio!;
  expect(audio.flags).toContain("joined");
  await page.goto("/quran/2?w=huda&at=2:2:6");
  const btn = panel(page).getByRole("button", { name: `استمع إليها بصوت ${audio.name_ar}` });
  await expect(btn).toBeVisible();
  await expect(panel(page).locator(".audio-note")).toContainText("يتصل صوتها بالكلمة المجاورة");
  await btn.click();
  const el = page.locator("audio");
  await expect(el).toHaveAttribute("data-src", audio.url);
  await expect(el).toHaveAttribute("data-mode", "word");
});

test("a word the aligner could not time has no play button", async ({ page }) => {
  const w = await api<{ occurrence: { audio: Audio } }>(page, "/words/alim?at=2:181:13&limit=0");
  expect(w.occurrence.audio).toBeNull();
  await page.goto("/quran/2?w=alim&at=2:181:13");
  await expect(panel(page).locator("h2").first()).toBeVisible();
  await expect(panel(page).locator(".listen-btn")).toHaveCount(0);
  // the same entry at a timed place has one (the absence above is not a missing button everywhere)
  await page.goto("/quran/2?w=huda&at=2:2:6");
  await expect(panel(page).locator(".listen-btn")).toHaveCount(1);
});
