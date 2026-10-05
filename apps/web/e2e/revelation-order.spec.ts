import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * Reading in the order of revelation (B6): the index in the traditional order with its source and its uncertainty
 * said, each sūra's verses said to have come down elsewhere counted; the reader's choice kept; the rail and the way
 * to the next sūra following it. Every expectation read from the API.
 */

type Surah = { number: number; name_ar: string; revelation_order: number; place_notes: number };

test("the sūras in the traditional order of revelation, said as such, followed by the reader (B6)", async ({ page, isMobile }) => {
  const surahs = (await api<{ data: Surah[] }>(page, "/surahs")).data;
  const byOrder = [...surahs].sort((a, b) => a.revelation_order - b.revelation_order);
  const [first, second] = byOrder;
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });
  await page.goto("/quran");
  const cards = page.locator("main ol > li");
  await expect(cards.first()).toContainText("الفاتحة");
  await page.getByRole("group", { name: "ترتيب السور" }).getByRole("button", { name: "ترتيب النزول" }).click();
  await expect(cards.first()).toContainText(first.name_ar);
  await expect(cards.first()).toContainText(`النزول ${ar(1)}`);
  await expect(page.getByText(/وهو اجتهادٌ من العلماء في ترتيب السور لا نصٌّ فيه/)).toBeVisible();
  // a sūra with verses said to have come down elsewhere says how many
  const noted = byOrder.find((s) => s.place_notes > 2)!;
  await expect(cards.filter({ hasText: noted.name_ar }).first()).toContainText(new RegExp(`${ar(noted.place_notes)} (آيات|آية) قيل إنها نزلت في غير مكان السورة`));
  // and its card lists them, each with its source
  const card = await api<{ places: { ayah_from: number; ayah_to: number }[] }>(page, `/surahs/${noted.number}/card`);
  expect(new Set(card.places.flatMap((x) => Array.from({ length: x.ayah_to - x.ayah_from + 1 }, (_, i) => x.ayah_from + i))).size).toBe(noted.place_notes);
  await page.goto(`/quran/${noted.number}?mode=about`);
  const layer = page.locator(".reader-panel, .reader-sheet").locator("section.layer").filter({ hasText: "آيات قيل إنها نزلت في غير مكان السورة" }).first();
  await layer.locator(".layer-head").click();
  const p0 = card.places[0];
  const range = p0.ayah_from === p0.ayah_to ? ar(p0.ayah_from) : `${ar(p0.ayah_from)}–${ar(p0.ayah_to)}`;
  await expect(layer.getByRole("link", { name: `الآيات ${range}` }).first()).toHaveAttribute("href", `/quran/${noted.number}/${p0.ayah_from}`);
  await page.goto("/quran");
  // the reader's choice is kept
  await page.reload();
  await expect(cards.first()).toContainText(first.name_ar);
  // the way on from the first sūra revealed leads to the second
  await page.goto(`/quran/${first.number}`);
  const steps = page.getByRole("navigation", { name: "السور بترتيب النزول" });
  await expect(steps.getByRole("link", { name: `بعدها نزولًا: ${second.name_ar}` })).toHaveAttribute("href", `/quran/${second.number}`);
  if (!isMobile) await expect(page.locator(".rail-list .rail-row").first()).toContainText(first.name_ar);
  // and back to the mushaf's order
  await page.goto("/quran");
  await page.getByRole("group", { name: "ترتيب السور" }).getByRole("button", { name: "ترتيب المصحف" }).click();
  await expect(cards.first()).toContainText("الفاتحة");
});
