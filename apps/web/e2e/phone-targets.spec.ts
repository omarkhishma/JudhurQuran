import { expect, type Page, test } from "@playwright/test";

/**
 * Touch targets on a phone (P2.9; RDR-415, RDR-586): the header's tools at least 40 px, every control of the
 * dictionary sheet — back and forward, close, star, cite, the graph, the tabs, the section heads — at least 44 px
 * in its smaller dimension. Text links inside a sentence are excused: they are words, not controls.
 */

/** Controls under their size. The spec's own exceptions: "Suggest an edit" and passage tools 40 px, section heads
 * 48; a glossary term inside a sentence is a word of it, and the sheet's grabber is a bar across the whole sheet. */
async function small(page: Page, scope: string, min: number): Promise<string[]> {
  return page.locator(scope).evaluate((root, m) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>("button, [role=tab], a.btn, a.chip, summary, input:not([type=hidden]), select")) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height || style.visibility === "hidden" || el.closest("[aria-hidden=true]") || el.classList.contains("sr-only")) continue;
      if ((el.closest("p, li > span") && el.tagName === "A") || el.classList.contains("term")) continue;
      if (el.classList.contains("sheet-grabber") && r.width >= 200 && r.height >= 24) continue;
      const need = el.classList.contains("layer-head") ? 48 : el.classList.contains("suggest-link") || el.classList.contains("more-toggle") || el.closest(".passage-tools") ? 40 : m;
      if (Math.min(r.width, r.height) + 0.5 < need) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  }, min);
}

test("on a phone the header's tools are at least 40 px and the sheet's controls at least 44 px (RDR-415, 586)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:2:2"]').click();
  const sheet = page.locator(".reader-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  expect(await small(page, "header.reader-header", 40), "header tools").toEqual([]);
  expect(await small(page, ".reader-sheet", 44), "sheet controls, a word").toEqual([]);
  // the sheet at full height, and a verse's sheet
  await page.getByRole("button", { name: "وسّع لوحة المعجم" }).click();
  await page.waitForTimeout(300);
  expect(await small(page, ".reader-sheet", 44), "sheet controls, full").toEqual([]);
  await page.goto("/quran/2/255");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  expect(await small(page, ".reader-sheet", 44), "sheet controls, a verse").toEqual([]);
});
