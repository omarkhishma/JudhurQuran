import { expect, test } from "@playwright/test";

// A word must be findable four ways (PLAN phase 5 exit), plus by verse reference.
const CASES: [string, string, RegExp][] = [
  ["Arabic without marks", "الرحمن", /ر ح م/],
  ["Arabic pasted from the mushaf", "ٱلرَّحۡمَٰنِ", /ر ح م/],
  ["root letters", "ر ح م", /ر ح م/],
  ["transliterated root", "r-h-m", /ر ح م/],
];

for (const [name, q, expected] of CASES) {
  test(`search: ${name}`, async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(q)}`);
    await expect(page.locator("main")).toContainText(expected);
  });
}

test("search: verse reference", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("2:255")}`);
  await expect(page.locator("main a[href*='/quran/2/255'], main a[href*='/quran/2#v255']").first()).toBeVisible();
});

test("search: English meaning", async ({ page }) => {
  await page.goto(`/en/search?q=${encodeURIComponent("mercy")}`);
  await expect(page.locator("main")).toContainText(/ر ح م/);
});
