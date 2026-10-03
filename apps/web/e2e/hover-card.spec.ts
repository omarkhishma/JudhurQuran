import { expect, test } from "@playwright/test";
import { api } from "./helpers";

/** The hover card (RDR-117…122, 524, 583, 584): a mouse-only preview of a word, timed so it can be used. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(isMobile, "a mouse-only preview: no hover on touch");
  await page.addInitScript((r) => localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);
});

test("resting on a word shows its card above it, with the dictionary form, root, meaning and grammar", async ({ page }) => {
  const { slug } = await api<{ slug: string }>(page, "/locations/2:3:2/word");
  const w = await api<{ ar: { full: string }; root: { ar_spaced: string } }>(page, `/words/${slug}?limit=0&at=2:3:2`);
  await page.goto("/quran/2#v3");
  const word = page.locator('.w[data-w="2:3:2"]');
  await word.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await word.hover();
  const card = page.getByRole("dialog", { name: "بطاقة الكلمة" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(w.ar.full);
  await expect(card).toContainText(w.root.ar_spaced);
  const [c, r] = [await card.boundingBox(), await word.boundingBox()];
  if (c!.y + c!.height <= r!.y + 1) expect(c!.y + c!.height).toBeLessThanOrEqual(r!.y);
  else expect(c!.y).toBeGreaterThanOrEqual(r!.y + r!.height - 1); // flipped below for lack of room
  // its centre stays inside the window by at least 160 px (RDR-583)
  const vw = page.viewportSize()!.width;
  expect(c!.x + c!.width / 2).toBeGreaterThanOrEqual(159);
  expect(c!.x + c!.width / 2).toBeLessThanOrEqual(vw - 159);
});

test("near the top of the window the card opens below the word (RDR-524)", async ({ page }) => {
  await page.goto("/quran/2#v10");
  const first = page.locator('.w[data-w="2:10:1"]');
  await expect(first).toBeInViewport();
  const header = (await page.locator(".reader-header").boundingBox())!;
  const top = header.y + header.height;
  // bring the word to just under the header: less room above it than a card needs
  await page.mouse.move(700, 600);
  await page.mouse.wheel(0, (await first.boundingBox())!.y - top - 24);
  await expect.poll(async () => (await first.boundingBox())!.y - top).toBeLessThan(80);
  await page.mouse.move(0, 0);
  await first.hover();
  const card = page.getByRole("dialog", { name: "بطاقة الكلمة" });
  await expect(card).toBeVisible();
  const [c, r] = [await card.boundingBox(), await first.boundingBox()];
  expect(c!.y).toBeGreaterThanOrEqual(r!.y + r!.height - 1);
});

test("the pointer can move into the card and use it; leaving it, Esc or a click put it away (RDR-122, 584)", async ({ page }) => {
  await page.goto("/quran/1");
  const word = page.locator('.w[data-w="1:2:2"]');
  const card = page.getByRole("dialog", { name: "بطاقة الكلمة" });
  await page.mouse.move(0, 0);
  await word.hover();
  await expect(card).toBeVisible();
  // straight into the card: it stays
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
  // away from it: gone
  await page.mouse.move(5, 300, { steps: 4 });
  await expect(card).toHaveCount(0);
  // Esc
  await page.mouse.move(5, 300);
  await word.hover();
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  // the full entry from the card (move off and back: Esc holds until the pointer moves to a word again)
  await page.mouse.move(5, 300);
  await word.hover();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "المدخل كاملًا" }).click();
  await expect(page).toHaveURL(/[?&]at=1(:|%3A)2(:|%3A)2/);
  await expect(card).toHaveCount(0);
});
