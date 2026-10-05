import { expect, type Page, test } from "@playwright/test";

/**
 * A part of a page that reads the API on the browser never takes the page down when the API answers with an error — a
 * rate limit, a fault: the part shows nothing or says it failed, and the rest of the page stays (lesson 2026-10-05).
 */

const broken = (page: Page, pattern: string) => page.route(pattern, (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"code":"internal"}}' }));
const whole = async (page: Page) => {
  await expect(page.getByRole("alert").filter({ hasText: "حدث خطأ غير متوقع" })).toHaveCount(0);
  await expect(page.locator("main")).toBeVisible();
};

test("the root builder, the concordance and a lexicon's full article survive their endpoint failing", async ({ page }) => {
  await broken(page, "**/api/v1/roots?**");
  await page.goto("/roots");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await whole(page);

  await page.unrouteAll();
  await broken(page, "**/api/v1/roots/*/occurrences**");
  await page.goto(`/roots/${encodeURIComponent("علم")}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await whole(page);

  await page.unrouteAll();
  await broken(page, "**/api/v1/dictionary/entries/**");
  await page.goto(`/dictionary/${encodeURIComponent("علم")}`);
  await page.getByRole("button", { name: "اقرأ المادة كاملة" }).first().click();
  await whole(page);
  await expect(page.getByRole("tablist")).toBeVisible();
});

test("the reader survives the recitations failing", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });
  await broken(page, "**/api/v1/recitations**");
  await page.goto("/quran/1");
  await expect(page.locator('.passage[data-verse="1:1"]')).toBeVisible();
  await whole(page);
});
