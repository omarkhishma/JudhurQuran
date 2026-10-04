import { expect, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * "In this text" for a word read beyond the Quran (P1.3 ?in_text=, RDR-268…271): in a hadith's panel, how many places
 * the collection holds the same Quranic word, the first of them with the word marked, each leading to its hadith.
 * Expectations read from the API.
 */

type Hit = { uri: string; ref: string; kwic: { word: string } | null };
type InText = { total: number; data: Hit[]; lemma: { ar: string } };

test("a word chosen in a hadith says how often the collection holds it, and where (P1.3)", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });
  // the panel shows the first three
  const d = await api<InText>(page, "/texts/bukhari/words/ilm?limit=3");
  const first = d.data[0];
  await page.goto(`/hadith/bukhari/${first.ref}`);
  await page.locator(".hadith-text button.w", { hasText: first.kwic!.word }).first().click();
  const box = page.getByRole("complementary", { name: "الكلمة" }).getByTestId("in-this-text");
  await expect(box).toContainText(`${ar(d.total)} موضعًا لـ«${d.lemma.ar}» في صحيح البخاري`);
  const links = box.getByRole("listitem");
  await expect(links).toHaveCount(d.data.length);
  await expect(links.nth(1).getByRole("link")).toHaveAttribute("href", `/hadith/bukhari/${d.data[1].ref.replace(".", "_")}`);
  await expect(box.getByRole("link", { name: "كل مواضع الجذر في هذا الكتاب" })).toHaveAttribute("href", `/dictionary/${encodeURIComponent("علم")}/texts?text=bukhari`);
});
