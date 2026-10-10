import { expect, test } from "@playwright/test";

/**
 * A map arranged as a mind map (P16.4, PV-17): the root's card at the centre, the other cards on rings around it, no
 * card over another; one undo puts the map back. And a root's page and the concordance show it through the Quran (P16.3).
 */

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");

test("the editor arranges a root's map as a mind map, the root at the centre and no card over another (P16.4)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor's header tools are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "root", root: "رحم" })}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator(".save-pill")).toHaveText("حُفظت", { timeout: 15_000 });
  await page.getByRole("button", { name: "ذهنية", exact: true }).click();
  await page.waitForTimeout(800);
  const boxes = await page.locator(".react-flow__node").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute("data-id") ?? "", x: r.left, y: r.top, w: r.width, h: r.height };
    }),
  );
  expect(boxes.length).toBeGreaterThan(3);
  const overlap = (a: (typeof boxes)[number], b: (typeof boxes)[number]) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j]), `${boxes[i].id} over ${boxes[j].id}`).toBe(false);
  const root = boxes.find((b) => b.id.startsWith("root:"))!;
  const minX = Math.min(...boxes.map((b) => b.x)), maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y)), maxY = Math.max(...boxes.map((b) => b.y + b.h));
  expect(Math.abs(root.x + root.w / 2 - (minX + maxX) / 2)).toBeLessThan((maxX - minX) * 0.25);
  expect(Math.abs(root.y + root.h / 2 - (minY + maxY) / 2)).toBeLessThan((maxY - minY) * 0.25);
  // one undo, named, puts the map back
  await expect(page.getByRole("button", { name: "تراجع" })).toHaveAttribute("title", /ذهنية/);
});

test("a root's page shows it through the Quran: by sūra in revelation order and on the mushaf's pages, with its mind map (P16.3)", async ({ page }) => {
  const d = (await (await page.request.get(`/api/v1/stats/distribution?root=${encodeURIComponent("صبر")}`)).json()) as { total: number; pages: number[] };
  await page.goto(`/roots/${encodeURIComponent("صبر")}`);
  const fig = page.locator("#rpages-t").locator("xpath=ancestor::figure");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator("svg rect")).toHaveCount(604);
  await expect(page.locator("#rspread-t").locator("xpath=ancestor::figure")).toContainText(new Intl.NumberFormat("ar-EG").format(d.total));
  await fig.getByRole("link", { name: "خريطة ذهنية" }).click();
  await expect(page.getByRole("heading", { name: "خريطة الجذر ص ب ر" })).toBeVisible();
});

test("the concordance's distribution shows the whole root by revelation order and on the mushaf's pages (P16.3)", async ({ page }) => {
  const d = (await (await page.request.get(`/api/v1/stats/distribution?root=${encodeURIComponent("صبر")}`)).json()) as { total: number };
  await page.goto(`/concordance?root=${encodeURIComponent("صبر")}&view=dist`);
  await expect(page.locator("#rpages-t").locator("xpath=ancestor::figure").locator("svg rect")).toHaveCount(604);
  await expect(page.locator("#rspread-t").locator("xpath=ancestor::figure")).toContainText(new Intl.NumberFormat("ar-EG").format(d.total));
});
