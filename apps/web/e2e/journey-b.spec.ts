import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * Journey B (01 §1.5; PLAN P5.5 exit), without an account: Library or Collections → the reader → a word →
 * a star → the header's Review shows what is due → the deck drills the root's family, then in context → the
 * grades feed the scheduler. On the Quran a tap does not mark a word "learning" (D20, an opt-in study mode);
 * the star and the deck's Keep are what bring a word to review.
 */

type Word = { slug: string; root: { key: string; spaced: string } | null };

test("journey B: the shelf → a word starred → due in the header → the family drilled → in context → scheduled", async ({ page, isMobile }) => {
  test.skip(isMobile, "the header's Review button is a wide-screen control; phones reach the deck from the ⋯ menu");
  await page.clock.install({ time: new Date("2026-10-03T09:00:00Z") });
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, wordStates: {} }, version: 2 }));
  });
  const w = await api<Word>(page, "/words/1:2:1");

  // the Library's Quran card opens the reader
  await page.goto("/library");
  await page.locator(".book-card").first().click();
  await expect(page).toHaveURL(/\/(read|quran)/);
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:2:1"]').click();
  await page.getByRole("button", { name: "احفظ في قائمتك" }).first().click();

  // the header counts the family due (never reviewed: due now)
  const review = page.getByRole("button", { name: /^المراجعة/ });
  await expect(review).toContainText(ar(1));
  await review.click();
  const deck = page.getByRole("dialog", { name: "المراجعة" });
  await expect(deck.locator(".review-card")).toContainText(w.root!.spaced);

  // the family drilled, then the same root in context
  await deck.getByRole("button", { name: "اكشفها" }).first().click();
  await deck.getByRole("button", { name: "في السياق" }).click();
  await expect(deck.locator(".review-blank").first()).toBeVisible();
  await deck.getByRole("button", { name: "تحقّق" }).click();
  await deck.getByRole("button", { name: /• التالي$/ }).click();
  await expect(deck).toContainText("انتهت الجلسة");

  // the grade is in the scheduler: the root is not due again today
  const card = await page.evaluate((k) => JSON.parse(localStorage.getItem("jadhr-review") ?? "{}").state.cards[k], w.root!.key);
  expect(card.grade).toBe("forgot"); // nothing was typed in context, so the family was forgotten…
  expect(card.due - card.last).toBe(10 * 60_000); // …and comes back first, ten minutes after the grade
  await deck.getByRole("button", { name: "عُد إلى القراءة" }).click();
  await expect(review).toContainText(ar(0));

  // from Collections: the study deck's Keep stars a word, and its family joins the queue
  await page.goto("/explore?set=ilm");
  await page.getByRole("button", { name: "ادرسها بالبطاقات" }).click();
  await page.keyboard.press("ArrowRight");
  await page.goto("/quran/1");
  await expect(page.getByRole("button", { name: /^المراجعة/ })).toContainText(ar(1));
});

test("journey B on a phone: a word starred in the sheet, the deck from the ⋯ menu, the family drilled and scheduled", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone path");
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, wordStates: {} }, version: 2 }));
  });
  const w = await api<Word>(page, "/words/1:2:1");
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:2:1"]').click();
  await page.getByRole("button", { name: "احفظ في قائمتك" }).first().click();
  await page.getByRole("button", { name: "المزيد" }).click();
  await page.getByRole("menuitem", { name: "راجع الجذور التي مررت بها" }).click();
  const deck = page.getByRole("dialog", { name: "المراجعة" });
  await expect(deck.locator(".review-card")).toContainText(w.root!.spaced);
  await deck.getByRole("button", { name: "عرفتها كلها" }).click();
  await expect(deck).toContainText("انتهت الجلسة");
  const card = await page.evaluate((k) => JSON.parse(localStorage.getItem("jadhr-review") ?? "{}").state.cards[k], w.root!.key);
  expect([card.grade, card.interval]).toEqual(["good", 1]);
});
