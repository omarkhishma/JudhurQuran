import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** The review deck (P5.3, inventory RDR §25, RDR-344…360): the reader's due roots, root card and in context,
 * graded into a scheduler that keeps its promise. Desktop: the header's Review button and its badge. */

type RootReview = { root: { spaced: string; lemma_count: number }; family: { slug: string; ar: { full: string } }[]; context: { blanks: { surface: string }[]; verse_key: string } };
const seed = (stars: string[]) => ({
  personal: { state: { visited: true, onboarded: true, wordStates: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 2 },
  saved: { state: { bookmarks: stars.map((k, i) => ({ kind: "lemma", key: k, label: k, at: i })), notes: {}, history: [] }, version: 2 },
});
const prime = async (page: Page, stars: string[]) =>
  page.addInitScript((s) => {
    if (localStorage.getItem("jadhr-personal")) return;
    localStorage.setItem("jadhr-personal", JSON.stringify(s.personal));
    localStorage.setItem("jadhr-saved", JSON.stringify(s.saved));
  }, seed(stars));
const deck = (page: Page) => page.getByRole("dialog", { name: "المراجعة" });
const cards = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-review") ?? "{}").state?.cards ?? {});

test.beforeEach(({ isMobile }) => test.skip(isMobile, "the header's Review button is a wide-screen control; phones reach it from the ⋯ menu"));

test("the reader's starred words make the queue; the badge counts what is due; grades go to the scheduler and the forgotten root comes back first (RDR-345, 346, 358, 359)", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-03T09:00:00Z") });
  await prime(page, ["ilm", "kitab"]);
  await page.goto("/quran/1");
  const review = page.getByRole("button", { name: /^المراجعة/ });
  await expect(review).toContainText(ar(2));
  await review.click();
  await expect(deck(page)).toContainText("جذور كلماتك المحفوظة");
  await expect(deck(page)).toContainText(`${ar(1)} من ${ar(2)}`);
  const first = (await deck(page).locator(".review-card .text-root").nth(1).innerText()).trim();
  await deck(page).getByRole("button", { name: "نسيت العائلة" }).click();
  await deck(page).getByRole("button", { name: "عرفتها كلها" }).click();
  await expect(deck(page)).toContainText(`تذكّرت ${ar(1)} من ${ar(2)}`);
  const c = await cards(page);
  expect(Object.values(c).map((x) => (x as { grade: string }).grade).sort()).toEqual(["forgot", "good"]);
  await deck(page).getByRole("button", { name: "عُد إلى القراءة" }).click();
  // nothing is due now: the forgotten root waits ten minutes, the known one a day
  await expect(review).toContainText(ar(0));
  await page.clock.fastForward("15:00");
  await expect(review).toContainText(ar(1), { timeout: 70_000 });
  await review.click();
  await expect(deck(page).locator(".review-card .text-root").nth(1)).toHaveText(first);
});

test("the root card: the family hidden by pattern and part of speech, revealed one by one, each opening its entry (RDR-349, 350)", async ({ page }) => {
  const d = await api<RootReview>(page, `/roots/${encodeURIComponent("علم")}/review`);
  await prime(page, ["ilm"]);
  await page.goto("/quran/1?mode=review");
  const card = deck(page).locator(".review-card");
  await expect(card).toContainText(d.root.spaced);
  const rows = card.locator(".review-row");
  await expect(rows).toHaveCount(d.family.length);
  await rows.first().getByRole("button", { name: "اكشفها" }).click();
  await expect(rows.first()).toContainText(d.family[0].ar.full);
  await expect(rows.first().getByRole("link", { name: "المدخل" })).toHaveAttribute("href", `/read?w=${d.family[0].slug}`);
  await page.keyboard.press("Escape");
  await expect(deck(page)).toHaveCount(0);
});

test("in context: the verse with the family blanked, typed with or without vowels, checked and graded by the score (RDR-352…357)", async ({ page }) => {
  const d = await api<RootReview>(page, `/roots/${encodeURIComponent("علم")}/review`);
  await prime(page, ["ilm"]);
  await page.goto("/quran/1?mode=review");
  await deck(page).getByRole("button", { name: "في السياق" }).click();
  const card = deck(page).locator(".review-card");
  await expect(card.locator(".review-blank")).toHaveCount(d.context.blanks.length);
  // the first blank typed bare, the rest left empty: some recalled, so «بعضها»
  const bare = d.context.blanks[0].surface.normalize("NFD").replace(/[ً-ٰٟۖ-ۭ]/g, "").replace(/ٱ/g, "ا");
  await card.getByRole("textbox", { name: `الفراغ ${ar(1)}` }).fill(bare);
  await card.getByRole("button", { name: "تحقّق" }).click();
  await expect(card).toContainText(`تذكّرت ${ar(1)} من ${ar(d.context.blanks.length)} في السياق.`);
  await expect(card.locator(".review-blank.is-right")).toHaveCount(1);
  await expect(card.getByRole("button", { name: d.context.blanks.length > 1 ? "بعضها • التالي" : "عرفتها كلها • التالي" })).toBeVisible();
});

test("with nothing of their own, the reader reviews this sūra's roots; with nothing due, they are told when (RDR-345)", async ({ page }) => {
  await prime(page, []);
  await page.goto("/quran/1?mode=review");
  await expect(deck(page)).toContainText("جذور هذه السورة");
  await expect(deck(page).locator(".review-card")).toBeVisible();
});
