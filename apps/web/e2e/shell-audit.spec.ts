import { expect, test } from "@playwright/test";

/** Shell and reader items the research-screens audit found open (research 09): Ask in the nav, patterns in
 * the site omnibox, the Analyse verse tool, and Ask's way to the Analyser. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 2 };
test.beforeEach(async ({ page }) => {
  await page.addInitScript((r) => localStorage.getItem("jadhr-personal") || localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);
});

test("the shared nav offers Ask, the plain way in (SHL-32)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the strip folds into the menu on phones");
  await page.goto("/library");
  const ask = page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link", { name: "اسأل", exact: true });
  await expect(ask).toHaveAttribute("href", "/read?mode=ask");
});

test("the site omnibox offers patterns, each leading to its words (SHL-Q07)", async ({ page }) => {
  await page.goto("/library");
  await page.keyboard.press("ControlOrMeta+k");
  const box = page.getByRole("dialog", { name: "البحث في القرآن الكريم" });
  await box.getByRole("combobox").or(box.getByRole("textbox")).first().fill("فاعل");
  const row = box.getByRole("option").filter({ hasText: "فَاعِل" }).filter({ hasText: "وزن" }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent("فَاعِل")}`));
  await expect(page.locator(".detect-pill")).toContainText("وزن");
});

test("a verse's Analyse tool opens it word by word in the Analyser (RDR-150)", async ({ page }) => {
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] [data-tool="analyse"]').click();
  await expect(page).toHaveURL(/\/analyse\?q=1%3A2$/);
  await expect(page.locator(".analyse-source")).toContainText("الآية ١:٢");
});

test("Ask with no Quranic match leads to the Analyser (RDR-172)", async ({ page }) => {
  await page.goto("/quran/1?mode=ask");
  await page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" }).fill("بالتعلم");
  const link = page.getByRole("link", { name: "حلّلها على أي حال ←" });
  await expect(link).toHaveAttribute("href", `/analyse?q=${encodeURIComponent("بالتعلم")}`);
});
