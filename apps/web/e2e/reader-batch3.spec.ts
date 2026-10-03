import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/** Cite scope and JSON, the reader's proposals, dotted terms, the Concordance tool, tool icons, long lists
 * (RDR-147, 150, 274, 306, 309, 322, 385, 398, 505, 573). */

const BASE = { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [] as unknown[], savedTrails: [] };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
const seed = (page: Page, extra: Record<string, unknown> = {}, prefs?: Record<string, unknown>) =>
  page.addInitScript(
    ([s, p]) => {
      if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: s, version: 1 }));
      if (p) localStorage.setItem("jadhr-prefs", JSON.stringify({ state: p, version: 2 }));
    },
    [{ ...BASE, ...extra }, prefs ?? null] as const,
  );

test("cite: a word, its root or its verse, and the entry as JSON (RDR-385, 398)", async ({ page, context, isMobile }) => {
  if (!isMobile) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page);
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  await panel(page).getByRole("button", { name: "استشهد" }).first().click();
  const dlg = page.getByRole("dialog", { name: "استشهد بهذا" });
  const link = dlg.locator("code").first();
  await expect(link).toContainText("/word/20:114:17");
  await dlg.getByRole("button", { name: "جذرها" }).click();
  await expect(link).toContainText(`/roots/${encodeURIComponent("علم")}`);
  await dlg.getByRole("button", { name: "آيتها" }).click();
  await expect(link).toContainText("/quran/20/114");
  await dlg.getByRole("button", { name: "هذه الكلمة" }).click();
  await expect(dlg.getByRole("link", { name: "المصادر والتراخيص" })).toBeVisible();
  if (isMobile) return;
  await dlg.getByRole("button", { name: "صدّر بصيغة JSON" }).click();
  const json = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(json).toMatchObject({ kind: "word", slug: "ilm", root: { key: "علم" }, occurrence: { location: "20:114:17" } });
  expect(json.licences).toMatch(/\/sources$/);
});

test("the reader's own proposals show in the entry, pending (RDR-322)", async ({ page }) => {
  await seed(page, { proposals: [{ id: "p1", kind: "sense", slug: "ilm", label: "عِلْم", ordinal: null, current: "", text: "معنى أقترحه", why: "", sources: [], status: "pending", ts: Date.now() }] }, { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } });
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const box = panel(page).getByRole("region", { name: "ما اقترحته" });
  await expect(box).toContainText("معنى أقترحه");
  await expect(box).toContainText("قيد المراجعة");
});

test("dotted terms in the grammar band and the dictionaries; the corpus and sense terms exist (RDR-274, 306, 309, 505)", async ({ page, isMobile }) => {
  const g = await api<{ terms: { key: string }[] }>(page, "/glossary");
  expect(g.terms.map((x) => x.key)).toEqual(expect.arrayContaining(["sense", "corpus"]));
  await seed(page, {}, { grammarBand: true, layerOpen: { senses: true, family: false, patterns: false, lexica: true, timeline: false, usage: false } });
  await page.goto("/quran/2?w=amana&at=2:3:2#v3");
  if (!isMobile) await expect(page.locator('[data-band="2:3"] .term').first()).toBeVisible();
  const p = panel(page);
  await expect(p.locator('[data-section="lexica"] .term').first()).toBeVisible();
  await expect(p.locator('[data-section="senses"] .term', { hasText: "المدونة القرآنية" }).first()).toBeAttached();
  await expect(p.locator('[data-section="senses"] .term', { hasText: "المعاني" }).first()).toBeAttached();
});

test("the Concordance tool opens each root of the verse in the concordance (RDR-150, 496); tools carry icons (RDR-147)", async ({ page }) => {
  await seed(page);
  await page.goto("/quran/1");
  const icon = await page.locator('[data-verse="1:2"] .ptool[data-tool="audio"]').evaluate((el) => getComputedStyle(el, "::before").maskImage || getComputedStyle(el, "::before").webkitMaskImage);
  expect(icon).toContain("data:image/svg+xml");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] .ptool[data-tool="concordance"]').click();
  const drawer = page.locator('[data-verse="1:2"] .drawer');
  const v = await api<{ words: { root: string | null }[] }>(page, "/verses/1:2");
  const keys = [...new Set(v.words.map((w) => w.root).filter(Boolean))] as string[];
  await expect(drawer.locator(".link-row")).toHaveCount(keys.length);
  await drawer.locator(".link-row").first().getByRole("link", { name: "في هذه السورة" }).click();
  await expect(page).toHaveURL(new RegExp(`/concordance\\?root=${encodeURIComponent(keys[0])}&surah=1`));
});

test("long lists skip rows off screen (RDR-573)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail is an overlay on phones");
  await seed(page);
  await page.goto("/quran/2");
  const li = page.locator(".reader-rail .long-list > li").first();
  await expect(li).toBeVisible();
  expect(await li.evaluate((el) => getComputedStyle(el).contentVisibility)).toBe("auto");
});
