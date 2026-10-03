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

/** The Arabic counted-noun form the UI must show for `n` (CLDR plural categories, Arabic-Indic digits). */
export function arCount(n: number, forms: { one: string; two: string; few: string; many: string; other: string }): string {
  const cat = new Intl.PluralRules("ar").select(n) as keyof typeof forms | "zero";
  const f = cat === "zero" ? forms.other : forms[cat];
  return f.replace("#", ar(n));
}

/** A persisted store's state as this browser keeps it: localStorage, or IndexedDB for the notebook (NTB-Q01). */
export async function stored<T = Record<string, unknown>>(page: Page, key: string): Promise<T | null> {
  return page.evaluate<T | null, string>(
    (k) =>
      new Promise((resolve) => {
        const ls = localStorage.getItem(k);
        const open = indexedDB.open("keyval-store");
        open.onerror = () => resolve(ls ? JSON.parse(ls).state : null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("keyval")) return resolve(ls ? JSON.parse(ls).state : null);
          const get = db.transaction("keyval", "readonly").objectStore("keyval").get(k);
          get.onsuccess = () => resolve(get.result?.state ?? (ls ? JSON.parse(ls).state : null));
          get.onerror = () => resolve(null);
        };
      }),
    key,
  );
}
