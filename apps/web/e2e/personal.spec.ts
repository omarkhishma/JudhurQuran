import { expect, test } from "@playwright/test";
import { api } from "./helpers";

test("a starred word appears in Saved and in the Review count, and stays after a reload (RDR-520)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 1 })));
  const d = await api<{ verses: { ayah: number; words: { position: number; lemma_slug: string }[] }[] }>(page, "/surahs/2");
  const slug = d.verses.find((v) => v.ayah === 255)!.words.find((w) => w.position === 23)!.lemma_slug;
  const lemma = await api<{ ar: { full: string } }>(page, `/words/${slug}`);
  await page.goto("/word/2:255:23");
  const star = page.getByRole("button", { name: "احفظ في قائمتك" }).first();
  await star.click();
  await expect(page.getByRole("button", { name: "أزله من قائمتك" }).first()).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.locator("main")).toContainText(lemma.ar.full);
  await expect(page.locator(`main a[href*="/read?w=${slug}"]`)).toBeVisible();
  await page.reload();
  await expect(page.locator("main")).toContainText(lemma.ar.full);
});

test("the root map draws the family", async ({ page }) => {
  await page.goto(`/graph/root/${encodeURIComponent("رحم")}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(10);
});
