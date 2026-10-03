import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** The entry's Shapes, doors, occurrence rows and verse drawers (RDR-154, 158, 220, 227…231, 269, 329, 332, 377). */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const PREFS = (open: string[]) => ({ state: { layerOpen: Object.fromEntries(["senses", "family", "patterns", "lexica", "timeline", "usage"].map((k) => [k, open.includes(k)])) }, version: 2 });
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
async function seed(page: Page, open: string[]) {
  await page.addInitScript(([r, p]) => {
    localStorage.setItem("jadhr-personal", JSON.stringify(r));
    localStorage.setItem("jadhr-prefs", JSON.stringify(p));
  }, [RETURNING, PREFS(open)] as const);
}

type Pattern = { slug: string; form_number: number | null; ar: { full: string } };
type W = { slug: string; pattern: Pattern | null; family: { pattern: Pattern | null; members: { slug: string }[] }[]; shapes: { same_pattern_other_roots: { ar: { full: string } }[] }; next_steps: ({ kind: string; slug: string; pattern?: { slug: string; ar: { full: string } } | null })[] };

test("Shapes: the root's verb forms out of ten, the unattested ones on request, and a pattern's words in this sūra (RDR-227…231)", async ({ page }) => {
  await seed(page, ["patterns"]);
  const w = await api<W>(page, "/words/ilm?limit=0&at=20:114:17");
  const forms = new Set(w.family.map((g) => g.pattern?.form_number).filter((n) => n != null));
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const shapes = panel(page).locator('[data-section="patterns"]').first();
  await expect(shapes).toContainText(`${ar(forms.size)} من ${ar(10)} من أبنية الفعل`);
  const rows = shapes.locator(".shapes-table tr");
  const before = await rows.count();
  await shapes.getByRole("button", { name: "أظهر أبنية الفعل العشرة" }).click();
  await expect(shapes.locator(".shapes-table tr.is-unattested")).toHaveCount(10 - forms.size);
  await expect(rows).toHaveCount(before + 10 - forms.size);
  // a pattern's words in this sūra only
  await shapes.getByRole("button", { name: "هذا الوزن" }).click();
  const sets = await api<{ data: Record<string, string[]> }>(page, "/surahs/lemma-sets");
  const p = await api<{ members: { slug: string }[] }>(page, `/patterns/${w.pattern!.slug}?limit=5000`);
  await shapes.getByRole("button", { name: "في هذه السورة" }).click();
  const inSurah = p.members.filter((m) => sets.data["20"].includes(m.slug));
  await expect(shapes.locator("ul.divide-y > li")).toHaveCount(Math.min(60, inSurah.length));
  await expect(shapes.locator('li[aria-current="true"]')).toHaveCount(inSurah.some((m) => m.slug === "ilm") ? 1 : 0);
});

test("the doors: the cousin says whether it shares the shape; the shape opens Shapes on its pattern (RDR-329, 332)", async ({ page }) => {
  await seed(page, ["senses"]);
  const w = await api<W>(page, "/words/ilm?limit=0");
  const cousin = w.next_steps.find((s) => s.kind === "cousin")!;
  const shape = w.next_steps.find((s) => s.kind === "pattern")!;
  await page.goto("/read?w=ilm");
  const doors = panel(page).locator(".doors");
  const same = cousin.pattern && w.pattern && cousin.pattern.slug === w.pattern.slug;
  await expect(doors.locator(".door").first()).toContainText(same ? "على الوزن نفسه" : `على وزن ${cousin.pattern!.ar.full}`);
  await doors.getByRole("button", { name: new RegExp("الوزن") }).click();
  const shapes = panel(page).locator('[data-section="patterns"]').first();
  await expect(shapes.getByRole("button", { name: "هذا الوزن" })).toHaveAttribute("aria-pressed", "true");
  await expect(shapes).toContainText((await api<{ ar: { full: string } }>(page, `/patterns/${shape.slug}`)).ar.full);
});

test("an occurrence row shows its inflection and seeds the graph from that place (RDR-269); Grammar here asks for a place (RDR-220)", async ({ page }) => {
  await seed(page, ["usage", "senses"]);
  const att = await api<{ data: { location: string; features: { pos: { ar: string } } }[] }>(page, "/words/ilm/attestations?limit=1");
  // opened from a link with no place in the text
  await page.goto("/quran/20?w=ilm");
  const p = panel(page);
  await expect(p).toContainText("اختر هذه الكلمة في النص لترى إعرابها");
  const row = p.locator(".kwic-row").first();
  await expect(row).toContainText(att.data[0].features.pos.ar);
  await row.getByRole("button", { name: "الخريطة" }).click();
  await expect(page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" })).toBeVisible();
});

test("the verse drawers: roots with their transliteration and Quran count; the graph preview in three columns (RDR-154, 158)", async ({ page }) => {
  await seed(page, []);
  const v = await api<{ words: { root: string | null }[] }>(page, "/verses/1:2");
  const keys = [...new Set(v.words.map((x) => x.root).filter(Boolean))] as string[];
  const roots = await api<{ data: { key: string; translit: string; occurrences: number }[] }>(page, `/roots?keys=${encodeURIComponent(keys.join(","))}&limit=10`);
  await page.goto("/quran/1");
  await page.locator('[data-verse="1:2"] .ptool[data-tool="roots"]').click();
  const drawer = page.locator('[data-verse="1:2"] .drawer');
  for (const r of roots.data) {
    await expect(drawer).toContainText(r.translit);
    await expect(drawer).toContainText(`${ar(r.occurrences)} في القرآن`);
  }
  await page.keyboard.press("Escape");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] .ptool[data-tool="graph"]').click();
  const g = page.locator('[data-verse="1:2"] .drawer .graph-cols');
  await expect(g.locator(".label-caps").first()).toContainText(`جذر • ${ar(keys.length)}`);
  await expect(page.locator('[data-verse="1:2"] .drawer')).toContainText("وبطاقة للآية نفسها");
});

test("the omnibox's pattern rows open Shapes on that pattern (RDR-377)", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await seed(page, []);
  await page.goto("/quran/1");
  await page.locator('.w[data-w="1:1:1"]').waitFor();
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "ابحث في كل شيء" });
  await box.fill("فاعل");
  await page.getByRole("option", { name: /^الأوزان: فَاعِل / }).click();
  const shapes = panel(page).locator('[data-section="patterns"]').first();
  await expect(shapes.getByRole("button", { name: "هذا الوزن" })).toHaveAttribute("aria-pressed", "true");
  await expect(shapes).toContainText("فَاعِل");
});
