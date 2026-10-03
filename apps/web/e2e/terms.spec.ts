import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const RETURNING = () => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 1 }));

test("a dotted term opens a plain-language card; Esc closes it, returns focus and leaves the entry open", async ({ page }) => {
  await page.addInitScript(RETURNING);
  await page.goto("/word/2:255:23");
  const term = page.getByRole("button", { name: "الجذر", exact: true });
  await term.click();
  const card = page.getByRole("dialog", { name: "الجذر" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("الحروف الأصلية");
  const box = await card.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  const axe = await new AxeBuilder({ page }).include(".term-card").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(term).toBeFocused();
  await expect(term).toBeVisible(); // the entry behind the card stayed open
});

test("explain-terms off shows plain labels", async ({ page }) => {
  await page.addInitScript(RETURNING);
  await page.addInitScript(() =>
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { explainTerms: false }, version: 1 })),
  );
  await page.goto("/word/2:255:23");
  const entry = page.locator(".reader-panel, .reader-sheet");
  await expect(entry.getByText(/^الجذر • /).first()).toBeVisible();
  await expect(entry.locator(".term")).toHaveCount(0);
});

test("a derived verb form explains itself, with its source", async ({ page }) => {
  await page.addInitScript(RETURNING);
  await page.goto("/word/2:199:7"); // وَٱسْتَغْفِرُوا — Form X
  await page.getByRole("button", { name: "اسْتَفْعَلَ (X)", exact: true }).click();
  const card = page.getByRole("dialog", { name: /اسْتَفْعَلَ/ });
  await expect(card).toContainText("الطلب");
  await expect(card).toContainText("شذا العرف");
});

test("a term card jumps into the entry's section, and can stop explaining terms (RDR-278/279, P2.6)", async ({ page, isMobile }) => {
  await page.addInitScript(RETURNING);
  await page.addInitScript(() =>
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 })),
  );
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const entry = page.locator(".reader-panel, .reader-sheet");
  await entry.getByRole("button", { name: "الجذر", exact: true }).click();
  const card = page.getByRole("dialog", { name: "الجذر" });
  await card.getByRole("button", { name: "أرني الأسرة" }).click();
  await expect(card).toBeHidden();
  const family = entry.locator('[data-section="family"]');
  await expect(family.locator(".layer-head")).toHaveAttribute("aria-expanded", "true");
  await expect(family.locator(".layer-head")).toBeInViewport();
  await entry.getByRole("button", { name: "الجذر", exact: true }).click();
  await page.getByRole("dialog", { name: "الجذر" }).getByRole("button", { name: "أوقف شرح المصطلحات" }).click();
  await expect(entry.locator(".term")).toHaveCount(0);
  if (!isMobile) {
    const toggle = page.getByRole("button", { name: "شرح المصطلحات" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(entry.locator(".term").first()).toBeVisible();
  }
});
