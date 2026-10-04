import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
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
  // a word opens its reading beside the text, as a word of a hadith or a book does (P11.3): the Quran's word, its root
  const panel = page.getByRole("complementary", { name: "الكلمة" });
  await page.locator(".user-passage button.pv-word.is-hit", { hasText: "العلم" }).click();
  await expect(panel.getByRole("link", { name: "الكلمة في القرآن" })).toHaveAttribute("href", /\/read\?w=ilm$/);
  await expect(panel.getByRole("link", { name: "الجذر في المعجم" })).toHaveAttribute("href", `/dictionary/${encodeURIComponent("علم")}`);
  // and its places in this text (P1.3 "In this text"): once, in the first passage
  await expect(panel.getByTestId("in-this-text")).toContainText("ترد مرة واحدة في نصك");
  await expect(panel.getByTestId("in-this-text").getByRole("link")).toHaveAttribute("href", "#p1");
  // and it is the reader's last lookup, its place this passage of this text (SHL-Q09)
  const textId = page.url().split("/library/text/")[1];
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.context?.place)).toEqual({ href: `/library/text/${textId}#p1`, label: "نص للتجربة" });
  // a word read by a rule is reviewed in the Analyser, from the panel
  await page.locator(".user-passage button.pv-word.is-review", { hasText: "بالتعلم" }).click();
  await expect(panel.getByRole("link", { name: "راجع قراءتها في المحلّل" })).toHaveAttribute("href", `/analyse?q=${encodeURIComponent("بالتعلم")}`);
  // Esc closes it and gives the focus back to the word
  await page.keyboard.press("Escape");
  await expect(page.locator(".user-passage button.pv-word.is-review", { hasText: "بالتعلم" })).toBeFocused();
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
  // kept under the text's identifier (P1.7a); the place seeded under the name used before identifiers moved there
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state.progress["user:tx1"]?.passage);
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

const SENTENCE = "قال الشافعي والبيان اسم جامع لمعان مجتمعة الأصول متشعبة الفروع";
const ARTICLE = `<html><head><title>الرسالة للشافعي</title></head><body><nav><a href="/">الرئيسية</a> <a href="/c">اتصل بنا</a></nav><article><h1>الرسالة للشافعي</h1>${Array.from({ length: 8 }, (_, i) => `<p>${SENTENCE} في الفقرة رقم ${i + 1} من الباب الأول.</p>`).join("")}</article><footer>جميع الحقوق محفوظة</footer></body></html>`;

test("a text from a web page and from a PDF: read on our server, handed back, saved with where it came from (P11.3c)", async ({ page }) => {
  // the page is served by the test itself; the e2e API fetches local addresses (JADHR_INTAKE_ALLOW_PRIVATE=1)
  const server = createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(ARTICLE);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  try {
    await page.addInitScript((v) => { if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v)); }, seed({}));
    await page.goto("/library?add=1");
    const sheet = page.getByRole("dialog", { name: "نص جديد" });
    const modes = sheet.getByRole("group", { name: "من أين النص" });
    await modes.getByRole("button", { name: "صفحة على الويب" }).click();
    await sheet.getByRole("textbox", { name: "عنوان الصفحة" }).fill(`http://127.0.0.1:${port}/article`);
    await sheet.getByRole("button", { name: "اجلب النص" }).click();
    const text = sheet.getByRole("textbox", { name: "نصّك" });
    await expect(text).toHaveValue(new RegExp(SENTENCE));
    await expect(text).not.toHaveValue(/اتصل بنا/);
    await expect(sheet.getByRole("textbox", { name: "عنوان النص" })).toHaveValue("الرسالة للشافعي");
    await expect(sheet.getByRole("status").filter({ hasText: "النص من 127.0.0.1" })).toBeVisible();
    await sheet.getByRole("button", { name: "احفظ في مكتبتي" }).click();
    await page.locator(".book-card", { hasText: "الرسالة للشافعي" }).click();
    await expect(page.getByText("من صفحة الويب:")).toBeVisible();
    await page.getByRole("button", { name: "احذف" }).click();
    await page.getByRole("button", { name: "احذف" }).click();
    await expect(page).toHaveURL(/\/library$/);
  } finally {
    server.close();
  }
  // a PDF: two sound pages, one in display order turned back, one blank waiting for OCR
  await page.goto("/library?add=1");
  const sheet = page.getByRole("dialog", { name: "نص جديد" });
  await sheet.getByRole("group", { name: "من أين النص" }).getByRole("button", { name: "ملف PDF" }).click();
  await sheet.getByLabel("ملف PDF").setInputFiles(path.join(__dirname, "fixtures/arabic-text.pdf"));
  await expect(sheet).toContainText(`صفحات فيها نص: ${ar(3)} (منها ${ar(1)}`);
  await expect(sheet).toContainText(`لم يُتح بعد: ${ar(4)}`);
  await expect(sheet.getByRole("checkbox")).toHaveCount(3);
  await sheet.getByRole("button", { name: "أضف ٣ صفحات" }).click();
  await expect(sheet.getByRole("textbox", { name: "نصّك" })).toHaveValue(new RegExp(`^${SENTENCE}`));
  await expect(sheet.getByRole("textbox", { name: "عنوان النص" })).toHaveValue("الرسالة للتجربة");
  await expect(sheet.getByRole("status").filter({ hasText: "arabic-text.pdf" })).toBeVisible();
});


test("the last book read resumes from the shelf, and each hadith collection and book says how many of its words the reader knows (LIB-Q03, Q08)", async ({ page }) => {
  const known = ["ilm", "kitab", "rahma", "qawl"];
  // seeded once: the pages read during the test record their places over it
  await page.addInitScript((v) => { if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v)); }, seed({
    wordStates: Object.fromEntries(known.map((k) => [k, "known"])),
    progress: { quran: { chapter: 18, passage: 10, at: Date.UTC(2026, 9, 1) }, "book:tabari-jamicbayan": { chapter: 2, passage: 0, ref: "40", label: "باب للتجربة", at: Date.UTC(2026, 9, 3) } },
  }));
  const counts = (await (await page.request.post("/api/v1/texts/known", { data: { lemmas: known } })).json()) as { data: { slug: string; known: number; total: number }[] };
  const tabari = counts.data.find((x) => x.slug === "tabari-jamicbayan")!;
  await page.goto("/library");
  // the book read after the Quran is the one to resume
  const cont = page.getByRole("region", { name: "تابع" });
  await expect(cont.getByRole("link")).toHaveAttribute("href", "/books/tabari-jamicbayan/p/40");
  await expect(cont).toContainText("باب للتجربة");
  await page.getByRole("group", { name: "ما تعرضه" }).getByRole("button", { name: "الكتب" }).click();
  await expect(page.locator('a.book-card[href="/books/tabari-jamicbayan"]')).toContainText(`تعرف ${ar(tabari.known)} من ${ar(tabari.total)} كلمة`);
  // reading a hadith makes it the place to resume
  await page.goto("/hadith/bukhari/7");
  await page.goto("/library");
  await expect(page.getByRole("region", { name: "تابع" }).getByRole("link")).toHaveAttribute("href", "/hadith/bukhari/7");
});

test("a root in the reader's own texts: found in this browser beside the hadith and the books, the sure apart from the possible, each place leading to its passage (P4.4)", async ({ page }) => {
  const passages = ["إن العلم نور والعالم يعلم ما لا يعلمه الجاهل", "والكتاب مفتوح لمن طلب العلم بالتعلم"];
  // what the shared rules read in it, asked as the page asks
  const tokens = passages.flatMap((p) => p.split(" "));
  const read = (await (await page.request.post("/api/v1/analyse/tokens", { data: { tokens } })).json()) as { token_keys: string[]; forms: Record<string, { kind: string; dict_root: string | null }> };
  const rs = read.token_keys.map((k) => read.forms[k]).filter((r) => r && r.kind !== "particle" && r.dict_root === "علم");
  const sure = rs.filter((r) => r.kind === "form" || r.kind === "clitic").length;
  expect(sure).toBeGreaterThan(1);
  await page.goto("/library");
  await putText(page, { id: "rt1", title: "نص الجذر", text: "", passages, words: tokens.length, lemmas: [], review: 0, unknown: 0, createdAt: 1, updatedAt: 1 });
  await page.goto(`/dictionary/${encodeURIComponent("علم")}/texts`);
  const mine = page.getByTestId("root-in-my-texts");
  await expect(mine.getByRole("heading", { name: "في نصوصك" })).toBeVisible();
  await expect(mine.getByRole("listitem")).toHaveCount(rs.length);
  await expect(mine.locator(".state-chip")).toHaveCount(rs.length - sure);
  await expect(mine.getByRole("link").first()).toHaveAttribute("href", "/library/text/rt1#p1");
  // the root's page shows the first three and the way to all of them
  await page.goto(`/roots/${encodeURIComponent("علم")}`);
  const summary = page.getByTestId("root-in-my-texts");
  await expect(summary.getByRole("listitem")).toHaveCount(Math.min(3, rs.length));
  if (rs.length > 3) await expect(summary.getByRole("link", { name: /كل مواضعه في نصوصك/ })).toHaveAttribute("href", `/dictionary/${encodeURIComponent("علم")}/texts#mine-h`);
});
