import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/**
 * Journey H, a scholar's (P19, Phase 2; PV-08…17): a question asked in Arabic from the hub, its word turned into a
 * statistic and opened as a chart, one column of it opened in the reader; a question in English; a search by meaning
 * and one of its verses; the roots over the sūras as a heatmap, a root opened from it, its mind map, and a word of the
 * map opened back in the reader. Every number checked is the API's.
 */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const answer = (page: Page) => page.locator("section[data-kind]");

test("journey H: questions in Arabic and English, a statistic as a chart, a search by meaning, a heatmap, a mind map, and back to the reader (P19)", async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  await page.addInitScript((r) => localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);

  // 1. a question in Arabic, typed in the hub's box
  const q = "كم مرة ذكرت كلمة الصبر؟";
  const counted = await api<{ answer: { count: number } }>(page, `/ask?q=${encodeURIComponent(q)}`);
  await page.goto("/");
  const box = page.getByRole("search", { name: "ابحث في القرآن" }).getByRole("textbox");
  await box.fill(q);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/ask\?q=/);
  await expect(answer(page).locator(".askq-big")).toHaveText(ar(counted.answer.count));

  // 2. the same word as a statistic: "understood as" changed to its spread over the sūras, drawn as columns
  const understood = page.locator("section").filter({ has: page.getByRole("heading", { name: "فهمنا سؤالك على أنه" }) });
  await understood.getByLabel("السؤال عن").selectOption("distribution");
  await understood.getByRole("button", { name: "أجب بهذا" }).click();
  const chart = answer(page).locator("#ask-dist-t").locator("xpath=ancestor::figure");
  await expect(chart.locator("svg path[fill]")).toHaveCount(114);
  const spread = await api<{ answer: { surahs: { surah: number; count: number }[] } }>(page, `/ask?intent=distribution&a=${encodeURIComponent("الصبر")}`);
  // its table holds the same numbers
  await chart.locator("summary").click();
  const firstRow = spread.answer.surahs.find((s) => s.count)!;
  await expect(chart.locator("tbody tr").first()).toContainText(ar(firstRow.count));

  // 3. a question in English
  const en = "What does the Quran say about orphans?";
  await page.goto(`/en/ask?q=${encodeURIComponent(en)}`);
  await expect(answer(page)).toHaveAttribute("data-kind", "theme");
  await expect(answer(page).locator("li").first()).toBeVisible();

  // 4. a search by meaning, and one of its verses opened in the reader
  const sq = "الصبر على البلاء";
  const s = await api<{ results: { semantic: { verse: { key: string; surah: number; ayah: number } }[] } }>(page, `/search?q=${encodeURIComponent(sq)}&limit=30`);
  await page.goto(`/search?q=${encodeURIComponent(sq)}`);
  const first = page.locator("li[data-semantic]").first();
  await expect(first).toHaveAttribute("data-semantic", s.results.semantic[0].verse.key);
  await first.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/quran/${s.results.semantic[0].verse.surah}/${s.results.semantic[0].verse.ayah}`));

  // 5. the roots over the sūras as a heatmap; a root opened from its row
  const matrix = await api<{ roots: { key: string }[] }>(page, "/stats/matrix?top=24");
  await page.goto("/stats");
  const heat = page.locator("#heat-t").locator("xpath=ancestor::figure");
  await heat.scrollIntoViewIfNeeded();
  const cells = heat.locator("svg rect");
  await expect(cells).toHaveCount(24 * 114);
  if (!isMobile) {
    await cells.nth(1).hover();
    await expect(heat.locator(".chart-tip")).toBeVisible();
  }
  await cells.nth(0).click();
  await expect(page).toHaveURL(new RegExp(`/roots/${encodeURIComponent(matrix.roots[0].key)}`));

  // 6. the root's mind map, from its page, and a word of it opened back in the reader
  await page.getByRole("link", { name: "خريطة ذهنية" }).first().click();
  await expect(page).toHaveURL(/\/mindmap\?root=/);
  const leaf = page.locator("svg a").filter({ has: page.locator(".mind-leaf") }).first();
  const label = (await leaf.getAttribute("aria-label"))!;
  await leaf.click();
  await expect(page).toHaveURL(/\/quran\/1\?w=/);
  const panel = page.locator(".reader-panel, .reader-sheet").first();
  await expect(panel.locator("h2").first()).toHaveText(label.split(" (")[0].split(" — ")[0]);
});
