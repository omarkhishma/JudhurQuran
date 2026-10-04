import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * The split view (P8.6; EDT-313…323, HWF-41): the reader and a map side by side, each the real one in a frame of
 * this site; the word looked up in the text is the context, by the browser's storage events; sent to the open map
 * with its pattern, part of speech, root and place, as one step and without a reload; the panes never both hidden;
 * the theme followed by both; on a phone one pane at a time. Expectations read from the reader's own store and the
 * map stored in this browser.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string } };
type Doc = { nodes: Card[]; edges: { source: string; target: string; data?: Record<string, unknown> }[] };
type Ctx = { word: string | null; wordAr: string | null; wordTr?: string | null; root: string | null; rootAr?: string | null; verse: string | null; at?: string | null };

async function storedGraph(page: Page, id: string): Promise<Doc | undefined> {
  return page.evaluate(
    (key) =>
      new Promise<Doc | undefined>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction("keyval").objectStore("keyval").get(key);
          req.onsuccess = () => resolve(req.result as Doc | undefined);
          req.onerror = () => reject(req.error);
        };
      }),
    `jadhr-graph:${id}`,
  );
}

const context = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("jadhr-personal") ?? "null")?.state?.context ?? null) as Ctx | null);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
  });
});

test("the reader and a map side by side: a word looked up is the context, sent to the open map with its pattern, part of speech, root and place, without a reload; the panes never both hidden; the theme followed (P8.6, EDT-313…323, HWF-41)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone has its own test");
  test.setTimeout(90_000);
  await page.goto("/split?surah=1");
  const head = page.locator(".split-head");
  await expect(head).toContainText("العرض المزدوج");
  await expect(page.locator(".split-context")).toContainText("اختر كلمة في النص");
  const send = page.getByRole("button", { name: "أرسل الكلمة إلى الخريطة" });
  await expect(send).toBeDisabled();
  // the map the view keeps, open in its pane
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jadhr-split-map")), { timeout: 15_000 }).toMatch(/^[A-Za-z0-9_-]+$/);
  const mapId = (await page.evaluate(() => localStorage.getItem("jadhr-split-map")))!;
  await expect(page.locator('iframe[title="الخريطة"]')).toHaveAttribute("src", new RegExp(`/graph/edit/${mapId}$`));

  // a word in the reader's pane: the context strip follows it
  const reader = page.frameLocator('iframe[title="القراءة"]');
  await reader.locator('.w[data-w="1:2:3"]').click();
  await expect.poll(async () => (await context(page))?.at, { timeout: 15_000 }).toBe("1:2:3");
  const ctx = (await context(page))!;
  const strip = page.locator(".split-context");
  await expect(strip).toContainText(ctx.wordAr!);
  await expect(strip).toContainText(ctx.rootAr!);
  await expect(strip).toContainText("الفاتحة ١:٢");
  await expect(send).toBeEnabled();
  const axe = await new AxeBuilder({ page }).include(".split-head").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);

  // sent: the map gains the word, its pattern and root, and the verse at its place — in the same document
  const mapFrame = page.frame({ url: /\/graph\/edit\// })!;
  await expect(mapFrame.locator(".editor-header")).toBeVisible({ timeout: 30_000 });
  await mapFrame.evaluate(() => ((window as unknown as { before: number }).before = 1));
  await send.click();
  await expect(page.locator(".split-said")).toContainText("إلى الخريطة", { timeout: 15_000 });
  await expect.poll(async () => (await storedGraph(page, mapId))?.nodes.map((n) => n.id).sort(), { timeout: 15_000 }).toEqual(expect.arrayContaining([`lemma:${ctx.word}`, `root:${ctx.root}`, "verse:1:2"]));
  const doc = (await storedGraph(page, mapId))!;
  const word = doc.nodes.find((n) => n.id === `lemma:${ctx.word}`)!;
  expect(word.data.sub).toBeTruthy();
  expect(doc.nodes.some((n) => n.data.kind === "pattern")).toBe(true);
  expect(doc.edges.some((e) => e.source === `lemma:${ctx.word}` && e.target === "verse:1:2" && e.data?.rel === "attests" && e.data?.place === "1:2:3")).toBe(true);
  expect(await mapFrame.evaluate(() => (window as unknown as { before?: number }).before)).toBe(1);
  // one step: undo in the map takes the word back
  await mapFrame.locator(".editor-header").getByRole("button", { name: "تراجع" }).click();
  await expect.poll(async () => (await storedGraph(page, mapId))?.nodes.some((n) => n.id === `lemma:${ctx.word}`), { timeout: 15_000 }).toBe(false);

  // the panes: either alone, never neither
  const readerToggle = head.getByRole("button", { name: "النص والمعجم" });
  const mapToggle = head.getByRole("button", { name: "الخريطة", exact: true });
  await readerToggle.click();
  await expect(page.locator('iframe[title="القراءة"]')).toBeHidden();
  await mapToggle.click();
  await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('iframe[title="الخريطة"]')).toBeVisible();
  await readerToggle.click();
  await expect(page.locator('iframe[title="القراءة"]')).toBeVisible();

  // the theme: changed in the view's header, followed by both panes
  await head.getByRole("button", { name: /الوضع الداكن|الوضع الليلي|داكن/ }).click();
  await expect.poll(() => mapFrame.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  const readerFrame = page.frame({ url: /\/quran\/1/ })!;
  await expect.poll(() => readerFrame.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
});

test("on a phone the split view shows one pane at a time, and sending a word shows the map (P8.6, EDT-322)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone's layout");
  test.setTimeout(90_000);
  await page.goto("/split?surah=1");
  const head = page.locator(".split-head");
  await expect(page.locator('iframe[title="القراءة"]')).toBeVisible();
  await expect(page.locator('iframe[title="الخريطة"]')).toBeHidden();
  await head.getByRole("button", { name: "الخريطة", exact: true }).click();
  await expect(page.locator('iframe[title="القراءة"]')).toBeHidden();
  await expect(page.locator('iframe[title="الخريطة"]')).toBeVisible();
  await head.getByRole("button", { name: "النص والمعجم" }).click();
  await page.frameLocator('iframe[title="القراءة"]').locator('.w[data-w="1:2:3"]').click();
  await expect.poll(async () => (await context(page))?.at, { timeout: 15_000 }).toBe("1:2:3");
  await page.getByRole("button", { name: "أرسل الكلمة إلى الخريطة" }).click();
  await expect(page.locator('iframe[title="الخريطة"]')).toBeVisible();
  await expect(page.locator(".split-said")).toContainText("إلى الخريطة", { timeout: 30_000 });
  const axe = await new AxeBuilder({ page }).include(".split-head").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
});
