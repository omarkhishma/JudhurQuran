import { expect, test } from "@playwright/test";
import { api, ar, expectNoHorizontalScroll } from "./helpers";

/** The Analyser (P4.3, inventory ANA): Quranic text from the corpus, other text with ranked candidates. */

type A = { source: { kind: string; verse_key: string | null }; counts: { tokens: number; roots: number; to_review: number }; tokens: { surface: string; kind: string; confidence: number; candidates: { root: { spaced: string } | null }[] }[] };

test("the design's sample: particles, a word from the Quran, a clitic reading marked for review, and the counts", async ({ page, isMobile }) => {
  const sample = "إِنَّ العِلْمَ لَا يُدْرَكُ إِلَّا بِالتَّعَلُّمِ";
  const a = await api<A>(page, `/analyse?q=${encodeURIComponent(sample)}`);
  await page.goto("/analyse");
  await expect(page.getByRole("textbox", { name: "العبارة المراد تحليلها" })).toHaveValue(sample);
  const rows = page.locator(".analyse-row:not(.analyse-head)");
  await expect(rows).toHaveCount(a.tokens.length);
  await expect(page.locator(".analyse-meta")).toHaveText(`الكلمات ${ar(a.counts.tokens)} · الجذور ${ar(a.counts.roots)} · للمراجعة ${ar(a.counts.to_review)}`);
  // the unsure row is tinted and offers nothing it cannot back: its root is a Quranic root
  const unsure = page.locator(".analyse-row.is-unsure");
  await expect(unsure).toHaveCount(a.counts.to_review);
  await expect(unsure.first()).toContainText("بعد فصل «بال»");
  if (isMobile) await expectNoHorizontalScroll(page);
});

test("a verse reference is read from the corpus, every word at confidence 1, linked to its place", async ({ page }) => {
  await page.goto(`/analyse?q=${encodeURIComponent("20:114")}`);
  await expect(page.locator(".analyse-source")).toContainText("الآية 20:114");
  const rows = page.locator(".analyse-row:not(.analyse-head)");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator(".analyse-row.is-unsure")).toHaveCount(0);
  await expect(rows.filter({ hasText: "عِلۡمٗا" }).getByRole("link", { name: "20:114:17" })).toBeVisible();
});

test("choosing among candidates is remembered, the view and phrase live in the address bar, and CoNLL-U is copied", async ({ page, context, browserName, isMobile }) => {
  const clip = browserName === "chromium" && !isMobile;
  if (clip) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // «اليم»: أليم (painful, أ ل م) and اليمّ (the sea, ي م م) are written alike
  await page.goto(`/analyse?q=${encodeURIComponent("اليم")}`);
  const row = page.locator(".analyse-row:not(.analyse-head)").first();
  await row.getByRole("button", { name: /اختر بين/ }).click();
  const options = row.getByRole("option");
  expect(await options.count()).toBeGreaterThan(1);
  const second = (await options.nth(1).locator(".text-root").innerText()).trim();
  await options.nth(1).click();
  await expect(row.locator("a.text-root")).toHaveText(second);
  await page.reload();
  await expect(page.locator(".analyse-row:not(.analyse-head)").first().locator("a.text-root")).toHaveText(second);
  await page.getByRole("button", { name: "بين السطور" }).click();
  await expect(page).toHaveURL(/view=interlinear/);
  await expect(page.locator(".interlinear-card")).toHaveCount(1);
  if (!clip) return;
  await page.getByRole("button", { name: "انسخ بصيغة CoNLL-U" }).click();
  await expect(page.getByRole("status")).toHaveText("نُسخ التحليل بصيغة CoNLL-U");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith("# sent_id = jadhr-analyse-1\n# text = اليم\n1\tاليم\t")).toBe(true);
  expect(text).toContain(`Root=${second.replace(/ /g, ".")}`); // the chosen reading is the one exported
  expect(text.endsWith("\n\n")).toBe(true);
});

test("the phrase seeds the graph editor", async ({ page }) => {
  await page.goto(`/analyse?q=${encodeURIComponent("وَقُل رَّبِّ زِدۡنِي عِلۡمٗا")}`);
  await page.getByRole("link", { name: "ابنِ خريطة من هذا ←" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\//, { timeout: 30_000 });
  await expect(page.locator(".graph-card").first()).toBeVisible();
});
