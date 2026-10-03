import { expect, test } from "@playwright/test";
import { api, ar, expectNoHorizontalScroll } from "./helpers";

/** The Library (P4.4, inventory LIB with the Quran notes): the shelf, resuming, the sūras, and the reader's own texts. */

const seed = (extra: Record<string, unknown>) => ({ state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [], ...extra }, version: 2 });

test("the shelf: the Quran's card counts known words by unique lemma, resumes at the sūra and verse, and lists the sūras with progress", async ({ page, isMobile }) => {
  const texts = await api<{ data: { kind: string; lemma_count: number; chapter_count: number; passage_count: number }[] }>(page, "/texts");
  const quran = texts.data.find((x) => x.kind === "quran")!;
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), seed({ wordStates: { ilm: "known", kitab: "known", rahma: "learning" }, progress: { quran: { chapter: 18, passage: 10, at: Date.UTC(2026, 9, 1) } }, read: { "quran:18": 10, "quran:1": 7 } }));
  await page.goto("/library");
  const card = page.locator(".book-card").first();
  await expect(card).toContainText(`تعرف ${ar(2)} من ${ar(quran.lemma_count)} كلمة`);
  await expect(card).toContainText(`${ar(quran.chapter_count)} سورة`);
  const cont = page.getByRole("region", { name: "تابع" });
  await expect(cont).toContainText("سورة الكهف");
  await expect(cont.getByRole("link")).toHaveAttribute("href", /\/quran\/18#v10$/);
  const cells = page.locator(".surah-cell");
  await expect(cells).toHaveCount(114);
  await expect(cells.nth(0)).toHaveAttribute("aria-label", `سورة الفاتحة: قرأت ${ar(7)} من ${ar(7)} آية`);
  if (isMobile) await expectNoHorizontalScroll(page);
});

test("nothing measured is never '100% known': a reader who has marked nothing is told so", async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), seed({}));
  await page.goto("/library");
  await expect(page.locator(".book-card").first()).toContainText("لم تعلّم كلمات منه بعد");
  await expect(page.getByRole("region", { name: "تابع" })).toHaveCount(0);
});

test("adding a text: a live preview read against the Quran, saved privately, read word by word, renamed and deleted", async ({ page }) => {
  await page.addInitScript((v) => { if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v)); }, seed({}));
  await page.goto("/library?add=1");
  const sheet = page.getByRole("dialog", { name: "نص جديد" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("textbox", { name: "نصّك" }).fill("إن العلم لا يدرك إلا بالتعلم.\n\nوالكتاب نور مستكتبون");
  await expect(sheet.locator(".pv-word.is-hit").first()).toBeVisible();
  await expect(sheet.locator(".pv-word.is-review")).toHaveCount(2); // بالتعلم (clitic), مستكتبون (pattern)
  await expect(sheet.locator(".review-rows li").first().getByRole("link", { name: "حلّلها" })).toHaveAttribute("href", /\/analyse\?q=/);
  await expect(sheet).toContainText("الكلمات ٩ · بلا تشكيل");
  await sheet.getByRole("textbox", { name: "عنوان النص" }).fill("نص للتجربة");
  await sheet.getByRole("button", { name: "احفظ في مكتبتي" }).click();
  await expect(sheet).toHaveCount(0);
  const mine = page.locator(".book-card", { hasText: "نص للتجربة" });
  await expect(mine).toContainText("الكلمات ٩ · للمراجعة ٢");
  await mine.click();
  await expect(page.getByRole("heading", { name: "نص للتجربة" })).toBeVisible();
  await expect(page.locator(".user-passage")).toHaveCount(2);
  await expect(page.locator(".user-passage a.pv-word.is-hit", { hasText: "العلم" })).toHaveAttribute("href", /\/read\?w=ilm$/);
  await page.getByRole("button", { name: "غيّر العنوان" }).click();
  await page.getByRole("textbox", { name: "عنوان النص" }).fill("عنوان آخر");
  await page.getByRole("button", { name: "احفظ العنوان" }).click();
  await expect(page.getByRole("heading", { name: "عنوان آخر" })).toBeVisible();
  await page.getByRole("button", { name: "احذف" }).click();
  await page.getByRole("button", { name: "احذف" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.locator(".book-card", { hasText: "عنوان آخر" })).toHaveCount(0);
});
