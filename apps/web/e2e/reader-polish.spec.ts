import { expect, type Page, test } from "@playwright/test";

/** Small reader fixes from the coverage audit (RDR-012, 144, 444, 461, 612). */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const seed = (page: Page) => page.addInitScript((r) => localStorage.getItem("jadhr-personal") || localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);

test("a term card sits above the header, outside the panel's stacking (RDR-012)", async ({ page }) => {
  await seed(page);
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const term = page.locator(".reader-panel .term, .reader-sheet .term").first();
  await term.click();
  const card = page.locator(".term-card");
  await expect(card).toBeVisible();
  expect(await card.evaluate((el) => el.parentElement === document.body)).toBeTruthy();
  const [z, header] = await Promise.all([card.evaluate((el) => Number(getComputedStyle(el).zIndex)), page.locator(".reader-header").evaluate((el) => Number(getComputedStyle(el).zIndex) || 0)]);
  expect(z).toBeGreaterThan(header);
});

test("the verse being recited shows it on its Recite tool, which stops it (RDR-144)", async ({ page }) => {
  await seed(page);
  await page.goto("/quran/1");
  const recite = page.locator('[data-verse="1:2"] .ptool[data-tool="audio"]');
  await recite.click();
  await expect(recite).toHaveAttribute("aria-pressed", "true");
  await expect(recite).toHaveAttribute("aria-label", "أوقف التلاوة");
  await recite.click();
  await expect(recite).toHaveAttribute("aria-pressed", "false");
});

test("Esc on the Reading popover hands focus back to its button; a dictionary switched back on leaves no trace (RDR-461, 612)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the Reading popover opens from the ⋯ menu on phones");
  await seed(page);
  await page.goto("/quran/1");
  const btn = page.getByRole("button", { name: "القراءة", exact: true });
  await btn.click();
  const dlg = page.getByRole("dialog", { name: "تفضيلات القراءة" });
  await expect(dlg).toBeVisible();
  // a dictionary's own switch, by name: "the last switch" changed under the test while the list was loading
  const sw = dlg.getByRole("switch", { name: /معجم لين العربي الإنجليزي/ });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  const off = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-prefs") ?? "{}").state?.dictOff ?? {});
  expect(off).toEqual({});
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(btn).toBeFocused();
});

test("when the browser refuses to store, the reader is told once and keeps working (RDR-444)", async ({ page }) => {
  await page.addInitScript((r) => {
    localStorage.setItem("jadhr-personal", JSON.stringify(r));
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  }, RETURNING);
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:2:2"]').click();
  await expect(page.getByText("تعذّر الحفظ في هذا المتصفح")).toBeVisible();
  await expect(page.locator('.w[data-w="1:2:2"]')).toHaveClass(/is-selected/);
});
