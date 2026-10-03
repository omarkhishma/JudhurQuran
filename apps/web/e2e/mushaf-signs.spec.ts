import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** P3.9: the signs written in the mushaf, explained in the Madinah Mushaf's own note, on a word and in a verse. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
type Sign = { id: string; label_ar: string; text_ar: string; kind: string; chars: string };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((v) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v));
  }, RETURNING);
});

test("a word's entry explains the sign written on it, credited to the mushaf's note", async ({ page }) => {
  const signs = (await api<{ data: Sign[] }>(page, "/mushaf-signs")).data;
  const muanaqa = signs.find((s) => s.id === "muanaqa")!;
  await page.goto("/quran/2?w=rayb&at=2:2:4");
  const box = panel(page).getByRole("region", { name: "علامة مكتوبة على هذه الكلمة" });
  await expect(box).toContainText(muanaqa.text_ar);
  await expect(box.locator(".sign-label")).toHaveText(muanaqa.label_ar);
  await expect(box).toContainText("«التعريف بهذا المصحف»");
});

test("verse mode lists every sign in the verse after the word it is written on", async ({ page }) => {
  const signs = (await api<{ data: Sign[] }>(page, "/mushaf-signs")).data;
  const v = await api<{ tokens: { text: string }[] }>(page, "/verses/2:2");
  const expected = v.tokens.flatMap((t) => signs.filter((s) => s.kind !== "hizb" && [...s.chars].some((c) => t.text.endsWith(c))).map(() => t.text));
  expect(expected.length).toBe(2);
  await page.goto("/quran/2/2");
  const layer = panel(page).getByRole("button", { name: new RegExp(`علامات الآية\\s*${ar(expected.length)}`) });
  await layer.click();
  const lines = panel(page).locator(".verse-signs .sign-line");
  await expect(lines).toHaveCount(expected.length);
  for (const [i, w] of expected.entries()) await expect(lines.nth(i)).toContainText(`بعد «${w}»`);
});
