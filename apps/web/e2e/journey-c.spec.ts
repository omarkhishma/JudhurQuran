import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, expectNoHorizontalScroll } from "./helpers";

/**
 * Journey C (design 01 §1.5): scholarship → citation. Look up a word → the layered panel → its old dictionaries, one
 * by one, side by side and the critical comparison → the Cite dialog in BibTeX, RIS and plain text → or the whole
 * dataset, cited by its release on Data & API. Every expectation read from the API.
 */

test.use({ actionTimeout: 20_000 });

const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
type Article = { id: string; title_ar: string; entries: unknown[] };
type Word = { slug: string; root: { key: string } | null; dict_articles: Article[] };
type Release = { version: string; doi: string | null };

test("journey C: a word looked up, its old dictionaries read one by one and side by side, the entry cited, then the whole dataset", async ({ page, context, isMobile }) => {
  test.setTimeout(120_000);
  if (!isMobile) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: false, family: false, patterns: false, lexica: true, timeline: false, usage: false }, lexMode: "list" }, version: 2 }));
  });
  const w = await api<Word>(page, "/words/ilm?limit=0");
  const works = w.dict_articles;
  expect(works.length).toBeGreaterThanOrEqual(5);

  // ── look up: Ask, then deeper into the layered panel ──
  await page.goto("/quran/1?mode=ask");
  await page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" }).fill("علم");
  await expect(page.locator(".ask-card, .ask-deck").first()).toContainText("عِلْم");
  // deeper: the desktop card's «تعمّق», the phone deck's way into the entry
  if (isMobile) await page.locator(".ask-deck").getByRole("button", { name: "أرني الأسرة كلها" }).first().click();
  else await page.getByRole("button", { name: "تعمّق — المصادر والأوزان والتاريخ" }).first().click();
  const p = panel(page);
  const lex = p.locator('[data-section="lexica"]');
  // the phone's entry is in tabs: the dictionaries' tab
  if (isMobile && !(await lex.isVisible())) await p.locator("#tab-lexica").click();
  await expect(lex).toBeVisible();

  // ── one by one: every dictionary's article with its book and the year its compiler died ──
  await lex.getByRole("button", { name: "واحدًا واحدًا" }).click();
  await expect(lex.locator(".dict-article")).toHaveCount(works.length);
  expect(await lex.locator(".dict-article").evaluateAll((els) => els.map((e) => e.getAttribute("data-dict")))).toEqual(works.map((d) => d.id));
  await expect(lex.locator(".dict-article").first()).toContainText(works[0].title_ar);

  // ── side by side: the dictionaries chosen as columns, three at most, a fourth dropping the oldest chosen ──
  await lex.getByRole("button", { name: "جنبًا إلى جنب" }).click();
  const chips = lex.getByRole("group", { name: "جنبًا إلى جنب" }).getByRole("button");
  await expect(chips).toHaveCount(works.length);
  const grid = lex.locator(".compare-grid > div");
  const chosen = async () => (await chips.evaluateAll((bs) => bs.map((b, i) => (b.getAttribute("aria-pressed") === "true" ? i : -1)))).filter((i) => i >= 0);
  await expect.poll(async () => (await chosen()).length).toBeGreaterThan(0);
  await expect(grid).toHaveCount((await chosen()).length);
  for (let i = 0; (await chosen()).length < 3 && i < works.length; i++) if (!(await chosen()).includes(i)) await chips.nth(i).click();
  await expect(grid).toHaveCount(3);
  const before = await chosen();
  const extra = works.findIndex((_, i) => !before.includes(i));
  await chips.nth(extra).click();
  await expect(grid).toHaveCount(3);
  await expect(lex.locator(".compare-grid")).toContainText(works[extra].title_ar);

  // ── the critical comparison: it says why it shows no agreement yet, rather than inventing one (L2, L3) ──
  await lex.getByRole("button", { name: "المقارنة النقدية" }).click();
  await expect(lex).toContainText("لن نعرض اتفاقًا لم يُتحقق منه");

  // ── cite an article by the Arabic convention ──
  await lex.getByRole("button", { name: "واحدًا واحدًا" }).click();
  const article = lex.locator(".dict-article").first();
  await article.getByRole("button", { name: "استشهد" }).click();
  const dlg = page.getByRole("dialog", { name: "استشهد بهذا" });
  await expect(dlg).toContainText(`${works[0].title_ar}، مادة (${[...w.root!.key].join(" ")})`);
  await page.keyboard.press("Escape");

  // ── cite the entry: BibTeX, RIS and plain text, each with the dataset's version ──
  const version = (await api<{ dataset: { version: string } }>(page, "/meta")).dataset.version;
  await p.getByRole("button", { name: "استشهد" }).first().click();
  await expect(dlg).toBeVisible();
  const formats = dlg.getByRole("group", { name: "صيغة الاستشهاد" });
  const pre = dlg.locator("pre");
  await formats.getByRole("button", { name: "BibTeX" }).click();
  await expect(pre).toContainText("@misc{");
  await expect(pre).toContainText(version);
  await formats.getByRole("button", { name: "RIS" }).click();
  await expect(pre).toContainText("TY  - ELEC");
  await expect(pre).toContainText(`ET  - ${version}`);
  await formats.getByRole("button", { name: "نص عادي" }).click();
  await expect(pre).toContainText("/word/");
  if (!isMobile) {
    await dlg.getByRole("button", { name: "انسخ الاستشهاد" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await pre.innerText());
  }
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);

  // ── or the whole dataset, cited by its release ──
  await dlg.getByRole("link", { name: "استشهد بالبيانات كلها" }).click();
  await expect(page).toHaveURL(/\/data#cite$/);
  const cite = page.locator("#cite");
  await expect(cite).toBeInViewport();
  const releases = await api<{ data: Release[] }>(page, "/releases");
  if (releases.data.length) {
    const r = releases.data[0];
    await expect(cite).toContainText(r.version);
    await expect(cite).toContainText(r.doi ? `https://doi.org/${r.doi}` : `/api/v1/releases/${r.version}`);
  } else await expect(cite).toContainText("لا إصدار");
  if (isMobile) await expectNoHorizontalScroll(page);
});
