import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * «كم مرة ذكر … في القرآن؟» answered per root (B8a): the count, what was counted, the release, and the same root counted
 * the other ways the web counts it — every number recomputed here from the API, none typed in.
 */

type Root = { key: string; spaced: string; occurrences: number; verse_count: number; surah_count: number; lemmas: { pos: string; occurrences: number; ar: string }[]; also_attributed: unknown[]; variants: unknown[] };

test("a root's count answered, with what was counted and the other ways of counting it (B8a)", async ({ page }) => {
  const r = await api<Root>(page, `/roots/${encodeURIComponent("علم")}`);
  const version = (await api<{ dataset: { version: string } }>(page, "/meta")).dataset.version;
  // from the root's page
  await page.goto(`/roots/${encodeURIComponent(r.key)}`);
  await page.getByRole("link", { name: "كم مرة ذُكر؟ وكيف عددنا" }).click();
  await expect(page).toHaveURL(/\/roots\/[^/]+\/count$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`كم مرة ذُكر الجذر (${r.spaced}) في القرآن الكريم؟`);
  const answer = page.locator("header .card");
  await expect(answer).toContainText(`${ar(r.occurrences)} مرة`);
  await expect(answer).toContainText(`${ar(r.verse_count)} آية`);
  await expect(answer).toContainText(`${ar(r.surah_count)} سورة`);
  await expect(answer).toContainText(version);
  // the other ways: by verses, by kind of word, by its commonest word — each as the data gives it
  const table = page.getByRole("table", { name: `الجذر (${r.spaced}) معدودًا بطرق مختلفة` });
  const row = (label: string | RegExp) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: label }) });
  await expect(row("كل كلمة فيها الجذر — ما عددناه")).toContainText(ar(r.occurrences));
  await expect(row("الآيات التي ورد فيها")).toContainText(ar(r.verse_count));
  const verbs = r.lemmas.filter((l) => l.pos === "V").reduce((s, l) => s + l.occurrences, 0);
  await expect(row("الأفعال وحدها")).toContainText(ar(verbs));
  const top = [...r.lemmas].sort((a, b) => b.occurrences - a.occurrences)[0];
  await expect(row(/أكثر صيغه ورودًا/)).toContainText(ar(top.occurrences));
  // every lemma, with its count
  await expect(page.getByRole("region", { name: "صيغه واحدة واحدة" }).getByRole("listitem")).toHaveCount(r.lemmas.length);
  // the answer for search engines says the same
  const ld = await page.evaluate(() => Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (s) => s.textContent ?? "").find((s) => s.includes("FAQPage")) ?? "{}");
  const faq = JSON.parse(ld) as { mainEntity: { acceptedAnswer: { text: string } }[] };
  expect(faq.mainEntity[0].acceptedAnswer.text).toContain(`${ar(r.occurrences)} مرة`);
  expect(faq.mainEntity[0].acceptedAnswer.text).toContain(version);
});
