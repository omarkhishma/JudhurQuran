import { expect, test } from "@playwright/test";
import { api } from "./helpers";

test("a bookmarked word appears in Saved, and stays after a reload", async ({ page }) => {
  const w = await api<{ text_imlaei: string }>(page, "/words/2:255:23");
  await page.goto("/word/2:255:23");
  const save = page.getByRole("button", { name: "حفظ الكلمة" }).first();
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.locator("main")).toContainText(w.text_imlaei);
  await page.reload();
  await expect(page.locator("main")).toContainText(w.text_imlaei);
});

test("the root map draws the family", async ({ page }) => {
  await page.goto(`/graph/root/${encodeURIComponent("رحم")}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(10);
});
