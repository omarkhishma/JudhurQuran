import { expect, type Page, test } from "@playwright/test";
import { api, arKey } from "./helpers";

/**
 * The P3.10 exit, as the reader sees it: for words of the exit's sample (dataset 2026.10.0, `python -m
 * jadhr_api.packets`) every section of the panel holds something or says, in words, why it is empty — a word with no
 * root and so no family and no dictionary (أَيُّهَا), a word with no door onward (نَعْلَي), and a word with every
 * section filled (عِلْم). No word of the sample lacks a sourced line in Meanings (the corpus's gloss of the place among
 * them); were one to, the section's empty state is asserted below. Each word's condition is read from the API first, as
 * the panel opens it (at its first place), so the test says when the data has moved under it.
 */

type W = {
  root: unknown;
  pattern: unknown;
  family: { members: { slug: string }[] }[];
  dict_articles: unknown[];
  senses: unknown[];
  mufradat: unknown;
  core_meaning: unknown;
  gloss_en: unknown;
  particles: unknown[];
  loanwords: unknown[];
  occurrence: { meanings_here: unknown[]; glosses: unknown[]; gloss_en: string | null } | null;
  next_steps: unknown[];
  attestations: { total: number; items: { location: string }[] };
};
type Rel = { wujuh?: unknown[]; furuq?: unknown[]; addad?: unknown[]; fields?: unknown[] };
const ALL = { senses: true, family: true, patterns: true, lexica: true, timeline: true, usage: true };

async function condition(page: Page, slug: string) {
  const at = (await api<W>(page, `/words/${slug}?limit=1`)).attestations.items[0].location;
  const w = await api<W>(page, `/words/${slug}?limit=3&at=${at}`);
  const rel = await api<Rel>(page, `/words/${slug}/relations?at=${at}`);
  const sourced = !!(
    w.senses.length || w.mufradat || w.core_meaning || w.gloss_en || w.particles.length || w.loanwords.length ||
    w.occurrence?.meanings_here.length || w.occurrence?.glosses.length || w.occurrence?.gloss_en || rel.wujuh?.length || rel.furuq?.length || rel.addad?.length || rel.fields?.length
  ); // prettier-ignore
  return { root: !!w.root, meanings: sourced, doors: w.next_steps.length > 0 };
}

for (const [slug, expected] of [
  ["ayyuha", { root: false, meanings: true, doors: true }],
  ["nalay", { root: true, meanings: true, doors: false }],
  ["ilm", { root: true, meanings: true, doors: true }],
] as const)
  test(`every section of the panel is filled or says why it is empty: ${slug} (P3.10)`, async ({ page }) => {
    expect(await condition(page, slug), "the sample word's condition in this dataset").toEqual(expected);
    await page.addInitScript((open) => {
      localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
      localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: open, panelOpen: true }, version: 2 }));
    }, ALL);
    await page.goto(`/read?w=${slug}`);
    const panel = page.locator(".reader-panel, .reader-sheet");
    for (const id of ["senses", "family", "patterns", "lexica", "timeline", "usage"]) {
      const body = panel.locator(`[data-section="${id}"]:visible .layer-body`).first();
      await expect(body, id).toBeVisible();
      await expect.poll(async () => (await body.innerText()).trim().length, { message: `${id} holds words` }).toBeGreaterThan(10);
      await expect(body, id).not.toContainText(/تعذّر التحميل|تعذّر تحميل المدخل/);
    }
    if (!expected.meanings) await expect(panel.locator('[data-section="senses"]:visible')).toContainText("لم نجد بعدُ في مصادرنا سطرًا عن هذه الكلمة");
    if (!expected.root) {
      await expect(panel.locator('[data-section="family"]:visible')).toContainText("هذه الكلمة بلا جذر، فلا أسرة لها");
      await expect(panel.locator('[data-section="lexica"]:visible')).toContainText("المعاجم مرتبة على الجذور، وهذه الكلمة بلا جذر");
    }
    if (!expected.doors) await expect(panel.locator('section[aria-label="إلى أين بعد ذلك؟"]:visible')).toContainText("لا باب بعد هذه الكلمة");
  });

type K = { asbab: unknown[]; places: unknown[]; cites: unknown[]; cited_by: unknown[]; entities: { wikidata_id: string | null }[] };

test("every knowledge layer of a verse and of its sūra names its source and its licence on screen (P3.10, P3.9)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same panel on the phone sheet; the desktop's is checked");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 })));
  // occasions of revelation, cross-references, a named entity (2:115); a verse revealed elsewhere than its sūra (2:281)
  for (const key of ["2:115", "2:281"]) {
    const k = await api<K>(page, `/verses/${key}/knowledge`);
    // the entities the panel names are those tied to Wikidata; the others stay candidates for the registry
    const named = k.entities.filter((e) => e.wikidata_id);
    const filled = [k.asbab, k.places, [...k.cites, ...k.cited_by], named].filter((x) => x.length > 0).length;
    expect(filled, `${key} holds layers`).toBeGreaterThan(0);
    await page.goto(`/quran/${key.split(":")[0]}#v${key.split(":")[1]}`);
    await page.locator(`[data-verse-btn="${key}"]`).click();
    const entry = page.locator(".reader-panel").getByRole("article", { name: `الآية ${arKey(key)}` });
    // the knowledge layers, each opened (some start folded): every one that holds something names its source and
    // its licence; the API says which hold something
    const wanted: [string, number][] = [
      ["أسباب النزول", k.asbab.length],
      ["مكان النزول", k.places.length],
      ["آيات يستشهد بها تفسيرها", k.cites.length + k.cited_by.length],
      ["الأعلام فيها", named.length],
    ];
    let checked = 0;
    for (const [title, n] of wanted) {
      if (!n) continue;
      const layer = entry.locator("section.layer").filter({ has: page.locator(".layer-head", { hasText: title }) }).first();
      const head = layer.locator(".layer-head");
      if ((await head.getAttribute("aria-expanded")) === "false") await head.click();
      await expect(layer.locator('a[rel~="license"]').first(), `${key} ${title}`).toBeVisible();
      checked++;
    }
    expect(checked).toBe(filled);
  }
  // the sūra's card: Tanzil's and the Tafsir Center's, each with its licence
  await page.goto("/quran/2?mode=about");
  await expect(page.locator(".reader-panel a[rel~='license']").first()).toBeVisible();
  expect(await page.locator(".reader-panel a[rel~='license']").count()).toBeGreaterThanOrEqual(2);
});
