import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Shell and reader items the research-screens audit found open (research 09): Ask in the nav, patterns in
 * the site omnibox, the Analyse verse tool, and Ask's way to the Analyser. */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 2 };
test.beforeEach(async ({ page }) => {
  await page.addInitScript((r) => localStorage.getItem("jadhr-personal") || localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);
});

test("the shared nav offers Ask, the plain way in (SHL-32)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the strip folds into the menu on phones");
  await page.goto("/library");
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await nav.getByRole("button", { name: "ابحث" }).click();
  const ask = nav.getByRole("link", { name: "اسأل عن كلمة", exact: true });
  await expect(ask).toHaveAttribute("href", "/read?mode=ask");
});

test("the header's nav is five groups, each a disclosure of its destinations (P-UX1)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone's menu is checked below");
  await page.goto("/library");
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await expect(nav.getByRole("button")).toHaveText(["اقرأ (القسم الحالي)", "ابحث", "افهم", "ارسم", "مساحتي"]);
  await expect(nav.getByRole("link")).toHaveCount(0);
  // a press opens a group; its links carry their purpose as their description
  const read = nav.getByRole("button", { name: "اقرأ (القسم الحالي)" });
  await read.click();
  await expect(read).toHaveAttribute("aria-expanded", "true");
  const library = nav.getByRole("link", { name: "المكتبة", exact: true });
  await expect(library).toHaveAttribute("aria-current", "page");
  await expect(library).toHaveAccessibleDescription("رفّك، وتقدمك في السور، ونصوصك أنت");
  // while one is open, pointing at another opens that one in its place
  await nav.getByRole("button", { name: "افهم" }).hover();
  await expect(nav.getByRole("link")).toHaveText(["اسأل القرآن", "القرآن بالأرقام", "خرائط ذهنية"].map((t) => new RegExp("^" + t)));
  // a press outside closes it
  await page.getByRole("heading", { level: 1 }).click();
  await expect(nav.getByRole("link")).toHaveCount(0);
  // the keyboard: down opens on the first link, the arrows wrap, Escape returns to the button
  const find = nav.getByRole("button", { name: "ابحث" });
  await find.focus();
  await page.keyboard.press("ArrowDown");
  await expect(nav.getByRole("link", { name: "البحث", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(nav.getByRole("link", { name: "المحلّل الصرفي", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(find).toBeFocused();
  await expect(find).toHaveAttribute("aria-expanded", "false");
  // Tab out of an open group closes it
  await page.keyboard.press("Enter");
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab"); // the button, its seven links, and out
  await expect(find).toHaveAttribute("aria-expanded", "false");
  // the work of a role is not shown to a reader without it
  await nav.getByRole("button", { name: "مساحتي" }).click();
  await expect(nav.getByRole("link", { name: "دفتري", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "طلبات التعديل" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "منصة التحرير" })).toHaveCount(0);
  await new AxeBuilder({ page }).include("header").analyze().then((r) => expect(r.violations.map((v) => v.id)).toEqual([]));
  // a link opens its page and closes the panel
  await nav.getByRole("link", { name: "دفتري", exact: true }).click();
  await expect(page).toHaveURL(/\/notebook$/);
  await expect(nav.getByRole("button", { name: "مساحتي (القسم الحالي)" })).toHaveAttribute("aria-expanded", "false");
});

test("the phone's menu holds the same five groups, the reader's page marked (P-UX1)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the desktop's groups are checked above");
  await page.goto("/hadith");
  await page.getByRole("button", { name: "القائمة" }).click();
  const menu = page.getByRole("dialog", { name: "التنقل الرئيسي" });
  await expect(menu.getByRole("heading", { level: 2 })).toHaveText(["اقرأ", "ابحث", "افهم", "ارسم", "مساحتي"]);
  await expect(menu.getByRole("region", { name: "اقرأ" }).getByRole("link", { name: "الحديث", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "البيانات", exact: true })).toBeVisible();
  await new AxeBuilder({ page }).include("#mobile-menu").analyze().then((r) => expect(r.violations.map((v) => v.id)).toEqual([]));
  await menu.getByRole("region", { name: "افهم" }).getByRole("link", { name: "اسأل القرآن" }).click();
  await expect(page).toHaveURL(/\/ask$/);
  await expect(menu).toHaveCount(0);
});

test("every group of the nav shows its copy, not its keys, under each layout that carries the header", async ({ page, isMobile }) => {
  // each route group sends the browser its own part of the copy; the drawing pages once lacked the nav's and showed «hub.dest.…»
  const key = /\b[a-z]+\.[a-z]+\.[a-zA-Z]+\b/;
  for (const path of ["/graph", "/library", "/en/graph"]) {
    await page.goto(path);
    if (isMobile) {
      await page.getByRole("button", { name: /^(القائمة|Menu)$/ }).click();
      const menu = page.locator("#mobile-menu");
      await expect(menu.getByRole("heading", { level: 2 })).toHaveCount(5);
      await expect(menu).not.toContainText(key);
      await page.keyboard.press("Escape");
      continue;
    }
    const nav = page.locator("header nav").first();
    const groups = nav.locator("button[data-group]");
    await expect(groups).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await groups.nth(i).click();
      await expect(nav.locator(".nav-panel:not([hidden]) a").first()).toBeVisible();
      await expect(nav.locator(".nav-panel:not([hidden])")).not.toContainText(key);
      await page.keyboard.press("Escape");
    }
  }
});

test("the site omnibox offers patterns, each leading to its words (SHL-Q07)", async ({ page }) => {
  await page.goto("/library");
  // the header's search button opens the omnibox at every width (⌘K is a desktop affordance)
  await page.locator("header").getByRole("button", { name: "بحث", exact: true }).click();
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
