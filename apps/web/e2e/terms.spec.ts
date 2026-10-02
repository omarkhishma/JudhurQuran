import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a dotted term opens a plain-language card; Esc closes it and returns focus", async ({ page }) => {
  await page.goto("/word/2:255:23");
  const term = page.getByRole("button", { name: "الصيغة المعجمية" });
  await term.click();
  const card = page.getByRole("dialog", { name: "الصيغة المعجمية" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("كما تُذكر في المعجم");
  const box = await card.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  const axe = await new AxeBuilder({ page }).include(".term-card").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(term).toBeFocused();
});

test("explain-terms off shows plain labels", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("judhur-prefs", JSON.stringify({ state: { explainTerms: false }, version: 1 })),
  );
  await page.goto("/word/2:255:23");
  await expect(page.getByText("الصيغة المعجمية").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "الصيغة المعجمية" })).toHaveCount(0);
});
