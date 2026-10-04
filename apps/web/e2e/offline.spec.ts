import { expect, type Page, test } from "@playwright/test";

/**
 * Offline reading (P12): a sūra read while connected opens again without a connection, served by the worker from this
 * browser; a page never read says it needs a connection and lists what is kept; a saved word's entry is kept as it is
 * saved and opens offline. Nothing of the reader's account is kept.
 */

const SEED = { state: { visited: true, onboarded: true }, version: 3 };
test.use({ serviceWorkers: "allow" });

async function kept(page: Page, cache: string, part: string): Promise<boolean> {
  return page.evaluate(
    async ([c, p]) => {
      const names = (await caches.keys()).filter((n) => n.startsWith(c));
      for (const n of names) for (const r of await (await caches.open(n)).keys()) if (decodeURIComponent(r.url).includes(p)) return true;
      return false;
    },
    [cache, part] as const,
  );
}

test("a sūra read while connected opens without a connection; a page never read says so and lists what is kept (P12)", async ({ page, context }) => {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(s));
  }, SEED);
  await page.goto("/quran/1");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // the worker answers from the second visit, and keeps the page and its own files
  await page.goto("/quran/1");
  await expect.poll(() => kept(page, "jadhr-pages-", "/quran/1"), { timeout: 15_000 }).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('.w[data-w="1:1:1"]')).toBeVisible();
    // a sūra never read: the offline page, with the one kept
    await page.goto("/quran/50");
    await expect(page.getByRole("heading", { name: "أنت غير متصل" })).toBeVisible();
    await expect(page.getByRole("link", { name: /الفاتحة/ }).first()).toHaveAttribute("href", "/quran/1");
  } finally {
    await context.setOffline(false);
  }
});

test("a saved word's entry is kept as it is saved and opens offline; the account's data is never kept (P12)", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "the same worker on the phone; the desktop's panel is checked");
  await page.addInitScript((s) => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(s));
  }, SEED);
  await page.goto("/saved");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  // saved now: the worker keeps its entry
  await page.evaluate(() => {
    localStorage.setItem("jadhr-saved", JSON.stringify({ state: { bookmarks: [{ kind: "lemma", key: "ilm", label: "عِلْم", at: Date.now() }], notes: {}, history: [] }, version: 2 }));
  });
  await page.reload();
  await expect.poll(() => kept(page, "jadhr-data-", "/api/v1/words/ilm"), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => kept(page, "jadhr-pages-", "/read?w=ilm"), { timeout: 20_000 }).toBe(true);
  // the entry opens at the word's first place: its sūra's page is kept with it
  const first = ((await (await page.request.get("/api/v1/words/ilm?limit=1")).json()) as { attestations: { items: { location: string }[] } }).attestations.items[0].location;
  await expect.poll(() => kept(page, "jadhr-pages-", `/quran/${first.split(":")[0]}`), { timeout: 20_000 }).toBe(true);
  expect(await kept(page, "jadhr-", "/api/v1/me")).toBe(false);
  await context.setOffline(true);
  try {
    await page.goto("/read?w=ilm");
    await expect(page.locator(".reader-panel h2").first()).toContainText("عِلْم");
  } finally {
    await context.setOffline(false);
  }
});
