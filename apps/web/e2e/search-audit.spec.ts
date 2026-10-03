import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** Search after the research-screens audit (research 09): patterns, true counts, paging, ranges, the root
 * builder's hamza, dictionary entries, the reader's own texts, the URL, the simpler engine said aloud. */

type Totals = { totals: Record<string, number>; detected: { kind: string } };
const group = (page: Page, name: string | RegExp) => page.locator(".result-group", { has: page.getByRole("heading", { name }) });
const openFilters = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.getByRole("button", { name: "التصفية" }).click(); // facets fold away on phones
};

test("a pattern names itself and lists every word on it, counted and paged (SRC-09, 20, 21, 22)", async ({ page }) => {
  const pat = await api<{ lemma_count: number }>(page, "/patterns/maf3uul?limit=1");
  await page.goto(`/search?q=${encodeURIComponent("مَفْعُول")}`);
  await expect(page.locator(".detect-pill")).toContainText("وزن");
  const words = group(page, "كلمات على وزن مَفْعُول");
  await expect(words.locator(".mono").first()).toHaveText(ar(pat.lemma_count));
  await expect(words.locator(".result-row")).toHaveCount(12);
  await words.getByRole("button", { name: /اعرض المزيد/ }).click();
  await expect(words.locator(".result-row")).toHaveCount(24);
  // from a word query, the pattern row leads to the words on it
  await page.goto(`/search?q=${encodeURIComponent("فاعل")}`);
  await expect(group(page, "الأوزان").getByRole("link", { name: /فَاعِل/ }).first()).toHaveAttribute("href", `/search?q=${encodeURIComponent("فَاعِل")}`);
});

test("counts are the matches, not the rows fetched, and show more reaches past the first page (SRC-12, 23)", async ({ page }) => {
  const d = await api<Totals>(page, `/search?q=${encodeURIComponent("رحمة")}&limit=30`);
  expect(d.totals.verses).toBeGreaterThan(30);
  await page.goto(`/search?q=${encodeURIComponent("رحمة")}`);
  const verses = group(page, "الآيات");
  await expect(verses.locator(".mono").first()).toHaveText(ar(d.totals.verses));
  await expect(verses.locator(".result-row")).toHaveCount(20);
  await verses.getByRole("button", { name: /اعرض المزيد/ }).click();
  await expect(verses.locator(".result-row")).toHaveCount(40); // past the first page of 30
  // verse keys in the Arabic UI are Arabic-Indic (SHL-Q05)
  await expect(verses.locator(".result-row .mono").first()).toHaveText(/^[٠-٩]+:[٠-٩]+$/);
});

test("a range lists its verses and Enter opens the first (SRC-Q01)", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("2:255-257")}`);
  const rows = group(page, "الآيات").locator(".result-row .mono");
  await expect(rows).toHaveText(["٢:٢٥٥", "٢:٢٥٦", "٢:٢٥٧"]);
  await expect(page.getByRole("link", { name: "اذهب إلى ٢:٢٥٥–٢٥٧" })).toHaveAttribute("href", "/quran/2/255");
});

test("the root builder finds hamza roots typed on any seat, and the letters stay in the URL (SRC-15, 31)", async ({ page, isMobile }) => {
  await page.goto("/search");
  await openFilters(page, isMobile);
  await page.getByRole("textbox", { name: "الحرف ١" }).fill("أ");
  await page.keyboard.type("م");
  await page.keyboard.type("ن");
  const roots = group(page, "الجذور");
  await expect(roots.locator(".result-row").first()).toContainText("أ م ن");
  await expect(page).toHaveURL(/[?&]l=/);
  await page.reload();
  await openFilters(page, isMobile);
  await expect(page.getByRole("textbox", { name: "الحرف ١" })).toHaveValue("أ");
  await expect(group(page, "الجذور").locator(".result-row").first()).toContainText("أ م ن");
});

test("kinds turned off stay off across a reload (SRC-31, SHL-S04)", async ({ page, isMobile }) => {
  await page.goto(`/search?q=${encodeURIComponent("رحمة")}`);
  await openFilters(page, isMobile);
  await page.getByRole("checkbox", { name: /آيات/ }).first().uncheck();
  await expect(page).toHaveURL(/[?&]k=/);
  await page.reload();
  await expect(group(page, "الآيات")).toHaveCount(0);
  await expect(group(page, "الكلمات")).toBeVisible();
});

test("each root carries its meaning; dictionary entries are found with their work (SRC-18, SRC-Q03)", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("ع ل م")}`);
  await expect(group(page, "الجذور").locator(".result-row").first()).toContainText("العين واللام والميم");
  await page.goto(`/search?q=${encodeURIComponent("أمن")}`);
  const dict = group(page, "في المعاجم");
  await expect(dict.locator(".result-row").first()).toBeVisible();
  await expect(dict.locator(`a[href="/roots/${encodeURIComponent("أمن")}#lexicon"]`).first()).toBeVisible();
});

test("the reader's own texts are searched in the browser (SRC-Q03)", async ({ page }) => {
  await page.goto("/library");
  await page.evaluate(async () => {
    const doc = { id: "t1abc", title: "نصي في العلم", text: "", passages: ["إن العلم لا يدرك إلا بالتعلم.", "والكتاب نور"], words: 8, lemmas: [], review: 0, unknown: 0, createdAt: 1, updatedAt: 1 };
    await new Promise<void>((done) => {
      const req = indexedDB.open("keyval-store");
      req.onupgradeneeded = () => req.result.createObjectStore("keyval");
      req.onsuccess = () => {
        const tx = req.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(doc, "jadhr-text:t1abc");
        const { passages: _p, text: _t, ...meta } = doc;
        void _p;
        void _t;
        tx.objectStore("keyval").put([meta], "jadhr-texts-index");
        tx.oncomplete = () => done();
      };
    });
  });
  await page.goto(`/search?q=${encodeURIComponent("العلم")}`);
  const mine = group(page, "في نصوصي");
  await expect(mine.locator("mark")).toHaveText("العلم");
  await expect(mine.getByRole("link")).toHaveAttribute("href", "/library/text/t1abc#p1");
});

test("when the simpler engine answers, the screen says so (SRC-40)", async ({ page }) => {
  await page.route("**/api/v1/search?**", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ response: res, json: { ...json, engine: "postgres" } });
  });
  await page.goto("/search");
  await page.getByRole("textbox", { name: "البحث" }).fill("صبر");
  await expect(page.getByRole("note")).toContainText("محرك البحث الكامل غير متاح الآن");
});

test("English: a transliteration and an English gloss are told apart (SRC-41)", async ({ page }) => {
  await page.goto(`/en/search?q=${encodeURIComponent("kitab")}`);
  await expect(page.locator(".detect-pill")).toHaveText("transliteration");
  await page.goto(`/en/search?q=${encodeURIComponent("knowledge")}`);
  await expect(page.locator(".detect-pill")).toHaveText("English gloss");
});
