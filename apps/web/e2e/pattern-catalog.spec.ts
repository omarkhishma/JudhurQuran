import { expect, test } from "@playwright/test";
import { api } from "./helpers";

/** What the grammarians said about a pattern (P3.3): verbatim rows with their book, page and commentary. */

type Classical = { rows: { text_ar: string; commentary: unknown[] }[]; sources: { attribution_ar: string }[] };
const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };

test("the pattern view quotes the sarf books on Form IV, with al-Raḍī's commentary and the sources' credit", async ({ page }) => {
  const p = await api<{ members: { slug: string }[]; classical: Classical }>(page, "/patterns/2af3ala");
  expect(p.classical.rows.length).toBeGreaterThan(0);
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), RETURNING);
  await page.goto(`/read?w=${p.members[0].slug}`);
  const shapes = page.locator('.reader-panel [data-section="patterns"], .reader-sheet [data-section="patterns"]').first();
  if ((await shapes.locator(".layer-head").getAttribute("aria-expanded")) === "false") await shapes.locator(".layer-head").click();
  await shapes.getByRole("button", { name: "هذا الوزن" }).click();
  const box = shapes.getByRole("region", { name: "ما قاله الصرفيون" });
  await expect(box.locator(".classical-row")).toHaveCount(p.classical.rows.length);
  await expect(box.locator(".classical-row").first()).toContainText(p.classical.rows[0].text_ar);
  await expect(box).toContainText("الشافية");
  await expect(box).toContainText("لم يراجعها محرر بعد");
  for (const s of p.classical.sources) await expect(box).toContainText(s.attribution_ar);
  const withComments = p.classical.rows.findIndex((r) => r.commentary.length > 0);
  const summary = box.locator(".classical-row").nth(withComments).locator("summary");
  await summary.click();
  await expect(box.locator(".classical-row").nth(withComments).locator("details > div")).toHaveCount(p.classical.rows[withComments].commentary.length);
});
