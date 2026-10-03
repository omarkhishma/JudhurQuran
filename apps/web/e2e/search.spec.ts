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

test("search: what the query was understood as, and Enter on a reference goes to the verse (SRC-03/05, SRC-Q01)", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("٢:٢٥٥")}`);
  await expect(page.locator(".detect-pill")).toHaveText("رقم آية");
  await page.getByRole("searchbox").or(page.getByRole("textbox", { name: "البحث" })).first().press("Enter");
  await expect(page).toHaveURL(/\/quran\/2\/255$/);
});

test("search: live results, kind facets with counts, and hiding a kind removes it from the total (SRC-12/26)", async ({ page, isMobile }) => {
  await page.goto("/search");
  const box = page.getByRole("textbox", { name: "البحث" });
  await box.fill("رحمة");
  await expect(page).toHaveURL(/q=%D8%B1%D8%AD%D9%85%D8%A9/);
  const verses = page.locator(".result-group", { has: page.getByRole("heading", { name: "الآيات" }) });
  await expect(verses.locator(".result-row").first()).toBeVisible();
  await expect(verses.locator("mark").first()).toContainText("رحمة");
  const total = page.locator(".search-bar [aria-live]");
  const before = await total.innerText();
  if (isMobile) await page.getByRole("button", { name: "التصفية" }).click(); // facets fold away on phones
  await page.getByRole("checkbox", { name: /آيات/ }).first().uncheck();
  await expect(verses).toHaveCount(0);
  await expect(total).not.toHaveText(before);
});

test("search: the root builder is positional, first radical on the right (SRC-14/37, SRC-Q04)", async ({ page, isMobile }) => {
  await page.goto("/search");
  if (isMobile) await page.getByRole("button", { name: "التصفية" }).click();
  await page.getByRole("textbox", { name: "الحرف ١" }).fill("ك");
  await expect(page.getByRole("textbox", { name: "الحرف ٢" })).toBeFocused();
  await page.keyboard.type("ت");
  await page.keyboard.type("ب");
  const roots = page.locator(".result-group", { has: page.getByRole("heading", { name: "الجذور" }) });
  await expect(roots.locator(".result-row").first()).toContainText("ك ت ب");
});

test("search: an empty result offers Ask mode (SRC-39)", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("zzqqxx")}`);
  await expect(page.getByRole("link", { name: /اسأل عنها/ })).toHaveAttribute("href", /\/read\?mode=ask&q=zzqqxx/);
});
