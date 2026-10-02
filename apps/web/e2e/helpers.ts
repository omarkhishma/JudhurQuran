import { expect, type Page } from "@playwright/test";

/** The site's own API (same origin), to compare what the page shows with the data it came from. */
export async function api<T>(page: Page, path: string): Promise<T> {
  const r = await page.request.get(`/api/v1${path}`);
  expect(r.ok(), `${path} → ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

/** Arabic-Indic digits with the Arabic thousands separator, as the UI formats numbers in Arabic. */
export const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

/** No horizontal page scroll — the phone layout must fit its width. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}
