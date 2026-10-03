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
  await expect(sheet).toContainText("الكلمات ٩ • بلا تشكيل");
  await sheet.getByRole("textbox", { name: "عنوان النص" }).fill("نص للتجربة");
  await sheet.getByRole("button", { name: "احفظ في مكتبتي" }).click();
  await expect(sheet).toHaveCount(0);
  const mine = page.locator(".book-card", { hasText: "نص للتجربة" });
  await expect(mine).toContainText("الكلمات ٩ • للمراجعة ٢");
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

const putText = async (page: import("@playwright/test").Page, doc: Record<string, unknown>) =>
  page.evaluate(async (d) => {
    await new Promise<void>((done) => {
      const req = indexedDB.open("keyval-store");
      req.onupgradeneeded = () => req.result.createObjectStore("keyval");
      req.onsuccess = () => {
        const tx = req.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(d, `jadhr-text:${d.id}`);
        const { passages, text: _t, ...meta } = d as { passages: string[]; text: string };
        void _t;
        tx.objectStore("keyval").put([{ ...meta, passageCount: passages.length }], "jadhr-texts-index");
        tx.oncomplete = () => done();
      };
    });
  }, doc);

test("a text of the reader's own keeps its place: the bar on the shelf, resuming, and scrolling moves it (LIB-13)", async ({ page }) => {
  const long = (n: number) => Array.from({ length: 40 }, () => `جملة ${n} في العلم والكتاب والنور`).join(" ");
  await page.addInitScript((v) => { if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v)); }, seed({ progress: { "text:tx1": { chapter: 1, passage: 2, at: 1 } } }));
  await page.goto("/library");
  await putText(page, { id: "tx1", title: "نصي الطويل", text: "", passages: [long(1), long(2), long(3)], words: 300, lemmas: [], review: 0, unknown: 0, createdAt: 1, updatedAt: 1 });
  await page.reload();
  const card = page.locator(".book-card", { hasText: "نصي الطويل" });
  await expect(card).toContainText(`المقطع ${ar(2)} من ${ar(3)}`);
  await expect(card).toHaveAttribute("href", "/library/text/tx1#p2");
  await page.goto("/library/text/tx1");
  // opening the text does not move the place; the resume link goes there
  await expect(page.getByRole("link", { name: `تابع من المقطع ${ar(2)} من ${ar(3)}` })).toHaveAttribute("href", "#p2");
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state.progress["text:tx1"].passage);
  expect(await stored()).toBe(2);
  // passage 3 at the top of the screen, or the foot of the page where it cannot rise that far
  await page.evaluate(() => window.scrollTo(0, document.querySelector("#p3")!.getBoundingClientRect().top + window.scrollY - 60));
  await expect.poll(stored).toBe(3);
  // and back up: passage 1
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.wheel(0, 1);
  await expect.poll(stored).toBe(1);
});

test("pending words each have their own key while the text is read (no duplicate-key warning)", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (m) => { if (/same key/i.test(m.text())) warnings.push(m.text()); });
  await page.route("**/api/v1/analyse/tokens", async (route) => { await new Promise((r) => setTimeout(r, 800)); await route.continue(); });
  await page.goto("/library");
  await putText(page, { id: "tx2", title: "نص", text: "", passages: ["العلم نور والجهل ظلام"], words: 4, lemmas: [], review: 0, unknown: 0, createdAt: 1, updatedAt: 1 });
  await page.goto("/library/text/tx2");
  await expect(page.locator(".pv-word").first()).toBeVisible();
  expect(warnings).toEqual([]);
});

test("known words are counted as the reader's texts count them: content words, particles left out (LIB-11)", async ({ page }) => {
  const texts = await api<{ data: { kind: string; lemma_count: number; function_lemmas: string[] }[] }>(page, "/texts");
  const quran = texts.data.find((x) => x.kind === "quran")!;
  expect(quran.function_lemmas.length).toBeGreaterThan(0);
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), seed({ wordStates: { ilm: "known", [quran.function_lemmas[0]]: "known" } }));
  await page.goto("/library");
  await expect(page.locator(".book-card").first()).toContainText(`تعرف ${ar(1)} من ${ar(quran.lemma_count)} كلمة`);
});

test("into the mushaf by juzʾ, ḥizb or page (LIB-Q01)", async ({ page }) => {
  const div = await api<{ juz: { number: number; surah: number; ayah: number }[] }>(page, "/divisions");
  const juz2 = div.juz[1];
  await page.goto("/library");
  const form = page.locator(".quran-entry");
  await form.getByRole("combobox", { name: "جزء" }).selectOption("2");
  await form.getByRole("button", { name: "اذهب" }).click();
  await expect(page).toHaveURL(new RegExp(`/quran/${juz2.surah}#v${juz2.ayah}$`));
  const p50 = await api<{ verses: { surah: number; ayah: number }[] }>(page, "/pages/50");
  await page.goto("/library");
  await form.getByRole("button", { name: "صفحة" }).click();
  await form.getByRole("spinbutton", { name: "رقم الصفحة (١–٦٠٤)" }).fill("50");
  await form.getByRole("button", { name: "اذهب" }).click();
  const v = p50.verses[0];
  await expect(page).toHaveURL(new RegExp(`/quran/${v.surah}${v.ayah > 1 ? `#v${v.ayah}` : ""}$`));
});

test("the sūra list says when it cannot load, and tries again (LIB-39)", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/surahs", (route) => (fail ? route.fulfill({ status: 503, body: "" }) : route.continue()));
  await page.goto("/library");
  const alert = page.getByRole("alert").filter({ hasText: "تعذّر تحميل السور الآن." });
  await expect(alert).toBeVisible({ timeout: 15_000 });
  fail = false;
  await alert.getByRole("button", { name: "أعد المحاولة" }).click();
  await expect(page.locator(".surah-cell")).toHaveCount(114);
});
