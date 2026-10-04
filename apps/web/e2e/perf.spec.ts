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

/**
 * P12's interaction budget: each of the reader's commonest acts — tapping a word, tapping another, opening a section,
 * opening a verse's tools, opening the omnibox — answers within 50 ms, measured by the browser's Event Timing (the
 * time from the input to the next paint, as INP counts it), the median of three tries for each.
 */
test("the reader's interactions answer within 50 ms (P12)", async ({ page, isMobile }) => {
  test.skip(isMobile, "measured on the desktop; the phone's CPU is not emulated here");
  type W = Window & { __ev: { name: string; d: number }[] };
  await page.addInitScript(() => {
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
    (window as unknown as W).__ev = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) (window as unknown as W).__ev.push({ name: e.name, d: e.duration });
    }).observe({ type: "event", durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  await page.goto("/quran/2");
  await page.waitForLoadState("networkidle");
  // the first tap loads the panel's code; the budget is for the reader's acts after it
  await page.locator('.w[data-w="2:1:1"]').click();
  await page.locator(".reader-panel h2").first().waitFor();
  const acts: [string, (i: number) => Promise<void>][] = [
    ["tap a word", async (i) => void (await page.locator(`.w[data-w="2:${2 + i}:2"]`).click())],
    ["open a section", async () => void (await page.locator(".reader-panel .layer-head").nth(1).click())],
    ["open a verse's tools", async (i) => void (await page.locator(`[data-verse-btn="2:${5 + i}"]`).click())],
    ["open the omnibox", async () => { await page.keyboard.press("Control+k"); await page.waitForTimeout(150); await page.keyboard.press("Escape"); }],
  ];
  const worst: Record<string, number> = {};
  for (const [name, act] of acts) {
    const tries: number[] = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => ((window as unknown as W).__ev = []));
      await act(i);
      await page.waitForTimeout(350);
      const ev = await page.evaluate(() => (window as unknown as W).__ev.filter((e) => ["pointerdown", "pointerup", "click", "keydown", "keyup"].includes(e.name)).map((e) => e.d));
      // an act under the observer's threshold (16 ms) leaves no entry
      tries.push(ev.length ? Math.max(...ev) : 0);
    }
    worst[name] = [...tries].sort((a, b) => a - b)[1];
  }
  console.log("interactions (median of three, ms):", JSON.stringify(worst));
  expect(Object.entries(worst).filter(([, d]) => d > 50), JSON.stringify(worst)).toEqual([]);
});
