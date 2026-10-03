import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/**
 * The performance budget for the largest sūra (PLAN P2.10a, RDR-573): al-Baqara's page weight and
 * element count, and how fast a tapped word opens its entry. Measured against the production build;
 * time limits leave room for a loaded machine, sizes are exact.
 */
const BUDGET = { htmlGzipKB: 300, domNodes: 18_500, loadMs: 1500, tapToEntryMs: 1000 };

test("al-Baqara stays inside its budget", async ({ page, isMobile, request }) => {
  test.skip(isMobile, "measured once, on desktop");
  const html = await (await request.get("/quran/2")).body();
  const gz = gzipSync(html).length / 1024;
  expect(gz, "HTML gzip KB").toBeLessThanOrEqual(BUDGET.htmlGzipKB);

  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 1 })));
  const t0 = Date.now();
  await page.goto("/quran/2", { waitUntil: "load" });
  expect(Date.now() - t0, "load ms").toBeLessThanOrEqual(BUDGET.loadMs);
  await page.waitForLoadState("networkidle");
  const nodes = await page.evaluate(() => document.getElementsByTagName("*").length);
  expect(nodes, "elements").toBeLessThanOrEqual(BUDGET.domNodes);

  const word = page.locator('.w[data-w="2:255:1"]');
  await word.scrollIntoViewIfNeeded();
  const t1 = Date.now();
  await word.click();
  await page.locator(".reader-panel h2").first().waitFor();
  expect(Date.now() - t1, "tap → entry ms").toBeLessThanOrEqual(BUDGET.tapToEntryMs);
});
