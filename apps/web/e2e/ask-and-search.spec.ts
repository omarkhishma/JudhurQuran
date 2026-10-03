import { expect, type Page, test } from "@playwright/test";

/** Ask and the panel search (RDR-169, 185, 193, 428, 602). */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");

test.beforeEach(async ({ page }) => {
  await page.addInitScript((r) => localStorage.getItem("jadhr-personal") || localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);
});

test("Ask offers the noun before the verb for bare letters (RDR-169, 602)", async ({ page }) => {
  await page.goto("/quran/1?mode=ask");
  await page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" }).fill("علم");
  // the first match is the noun عِلْم, not the more frequent verb عَلِمَ
  await expect(page.locator(".ask-card, .ask-deck").first()).toContainText("عِلْم");
});

test("the panel search shows each word's part of speech and root, and the arrow keys choose (RDR-193, 428)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the panel search sits in the desktop panel");
  await page.goto("/quran/1");
  const box = panel(page).getByRole("combobox", { name: "ابحث عن كلمة أو جذر" });
  await box.fill("علم");
  const opts = panel(page).getByRole("option");
  await expect(opts.first()).toContainText("ع ل م");
  await expect(opts.first()).toContainText("اسم");
  await expect(opts.first()).toHaveAttribute("aria-selected", "true");
  await box.press("ArrowDown");
  await expect(opts.nth(1)).toHaveAttribute("aria-selected", "true");
  const second = (await opts.nth(1).locator(".ar-classical").first().innerText()).trim();
  await box.press("Enter");
  await expect(panel(page).getByRole("heading", { name: second })).toBeVisible();
});

test("Alt+P opens and closes the dictionary panel (RDR-428)", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await page.goto("/quran/1");
  const btn = page.locator(".reader-header").getByRole("button", { name: "المعجم", exact: true });
  const before = await btn.getAttribute("aria-pressed");
  await page.keyboard.press("Alt+KeyP");
  await expect(btn).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
  await page.keyboard.press("Alt+KeyP");
  await expect(btn).toHaveAttribute("aria-pressed", before ?? "false");
});

test("the phone Ask card lets the reader hear the verse (RDR-185)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the deck is the phone layout");
  await page.goto("/quran/1?mode=ask");
  await page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" }).fill("علم");
  const play = page.getByRole("button", { name: "استمع إلى الآية" });
  await play.scrollIntoViewIfNeeded();
  // the recitation of that verse is fetched for playing
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/v1/recitations/") && r.ok()), play.click()]);
  expect(res.url()).toMatch(/\/recitations\/[^/]+\/surahs\/\d+/);
});
