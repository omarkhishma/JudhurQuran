import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ar, expectNoHorizontalScroll } from "./helpers";

/**
 * The books (P11.3): the shelf's classical books, a book's card and contents, a section read a page at a time with
 * every word opening its reading, the editor's brackets marked, the verses he referred to as links, each paragraph's
 * citation by printed page (or by the editor's numbers, or by section) and its own page; the library and the search
 * reach them. Expected values come from the API, never typed in.
 */

type Shelf = { data: { slug: string; kind: string; title_ar: string; passage_count: number; info: { pages_trusted: boolean; numbered_by_editor: boolean } }[] };
type Line = { ordinal: number; title_ar: string; total: number; children: number };
type Book = { slug: string; title_ar: string; author_ar: string; passage_count: number; chapters: Line[]; info: { pages_trusted: boolean; volumes: number | null; version: string } };
type Seg = { t: string; w?: number; e?: 1 };
type Para = { ref: string; ar_full: string; meta: { pages?: [number, number][]; editor?: [number, number][]; quran_refs?: [number, number, number][] }; cite: { key: string; ar: string; by: string }; segments: Seg[]; words: number[] };
type Chapter = { chapter: { ordinal: number; title_ar: string }; passages: Para[]; total: number; forms: Record<string, { readings: { dict_root: string | null; root: string | null }[] }> };

const enc = encodeURIComponent;
const json = async <T,>(page: import("@playwright/test").Page, path: string) => (await (await page.request.get(path)).json()) as T;

async function axe(page: import("@playwright/test").Page) {
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

test("the shelf: every book, filtered by subject, each with how it is cited", async ({ page, isMobile }) => {
  const shelf = await json<Shelf>(page, "/api/v1/texts");
  const books = shelf.data.filter((t) => t.kind === "book");
  expect(books.length).toBe(37);
  await page.goto("/books");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("كتب التراث");
  if (!isMobile) await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link", { name: "الكتب", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-book]")).toHaveCount(books.length);
  const tabari = page.locator('[data-book="tabari-jamicbayan"]');
  await expect(tabari).toContainText("الطبري");
  await expect(tabari).toContainText("يحال إلى صفحات المطبوع");
  await expect(page.locator('[data-book="hudhawwari-tafsir"]')).toContainText("يحال إلى القسم والفقرة");
  await axe(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("group", { name: "الموضوع" }).getByRole("button", { name: /^نحو وصرف/ }).click();
  await expect(page.locator('[data-book="sibawayhi-kitabsibawayhi"]')).toBeVisible();
  await expect(page.locator('[data-book="tabari-jamicbayan"]')).toHaveCount(0);
});

test("a book: its card from its own header, why its pages are or are not cited, its contents", async ({ page }) => {
  const b = await json<Book>(page, "/api/v1/texts/zaydibncali-musnad");
  await page.goto("/books/zaydibncali-musnad");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(b.title_ar);
  await expect(page.locator("bdi", { hasText: b.info.version })).toBeVisible();
  await expect(page.locator("section[aria-labelledby=contents-h] ol > li")).toHaveCount(b.chapters.length);
  await axe(page);
  await expectNoHorizontalScroll(page);
  // a book whose pages are not cited says why, in the page's language
  await page.goto("/books/hudhawwari-tafsir");
  await expect(page.getByText(/السبب: فيها ٠ من علامات الصفحات فقط/)).toBeVisible();
});

test("a section: its words open their readings, its paragraphs come cited by printed page", async ({ page, isMobile }) => {
  const b = await json<Book>(page, "/api/v1/texts/zaydibncali-musnad");
  const first = b.chapters.find((c) => c.total > 0)!;
  const ch = await json<Chapter>(page, `/api/v1/texts/zaydibncali-musnad/chapters/${first.ordinal}?limit=40&words=true`);
  await page.goto(`/books/zaydibncali-musnad/${first.ordinal}`);
  const paras = page.locator(".bk-para");
  await expect(paras).toHaveCount(Math.min(40, ch.total));
  const p0 = ch.passages[0];
  // the text as the API cuts it, every piece joined back
  expect(p0.segments.map((s) => s.t).join("")).toBe(p0.ar_full);
  await expect(paras.first().locator(".bk-body")).toHaveText(p0.ar_full);
  // the citation by printed page, its page in the margin
  expect(p0.cite.by).toBe("page");
  await expect(paras.first().locator(".bk-cite-text")).toHaveText(p0.cite.ar);
  await expect(paras.first().locator(".bk-page")).toHaveText(`ص ${ar(p0.meta.pages![0][1])}`);
  // a word: its root in the dictionary
  const i = p0.segments.findIndex((s) => s.w !== undefined && ch.forms[String(p0.words[s.w])]?.readings[0]?.dict_root);
  const w = p0.segments[i];
  await paras.first().getByRole("button", { name: w.t, exact: true }).first().click();
  const panel = page.getByRole("complementary", { name: "الكلمة" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "الجذر في المعجم" })).toHaveAttribute("href", `/dictionary/${enc(ch.forms[String(p0.words[w.w!])].readings[0].dict_root!)}`);
  await axe(page);
  await expectNoHorizontalScroll(page);
  await page.keyboard.press("Escape");
  if (isMobile) await expect(panel).toBeHidden();
  // the paragraph's own page: the citation and its stable key
  await paras.first().getByRole("link", { name: `رابط الفقرة: ${p0.cite.ar}` }).click();
  await expect(page).toHaveURL(new RegExp(`/books/zaydibncali-musnad/p/${p0.ref}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(p0.cite.ar);
  await expect(page.getByText(p0.cite.key)).toBeVisible();
  await axe(page);
});

test("the editor's apparatus: his brackets marked, his verse references as links", async ({ page }) => {
  // a paragraph of al-Ṭabarī with both, found through the API
  const ch = await json<Chapter>(page, "/api/v1/texts/tabari-jamicbayan/chapters/2?limit=60&words=true");
  const p = ch.passages.find((x) => x.meta.quran_refs?.length && x.meta.editor?.length) ?? ch.passages.find((x) => x.meta.quran_refs?.length)!;
  await page.goto(`/books/tabari-jamicbayan/p/${p.ref}`);
  const [s, a] = p.meta.quran_refs![0];
  await expect(page.locator(`.bk-refs a[href="/quran/${s}/${a}"]`).first()).toBeVisible();
  if (p.meta.editor?.length) {
    const [x, y] = p.meta.editor[0];
    // the bracket kept as printed, marked as his
    await expect(page.locator(".bk-editor").first()).toHaveText(p.ar_full.slice(x, y));
  }
  // the referred verse's text is not in the paragraph: «[البقرة: 2]» left the text
  expect(p.ar_full).not.toMatch(/\[[^\]]{1,20}:\s*\d+\]/);
});

test("a book cited by its editor's numbers: al-Shāfiʿī's Risāla", async ({ page }) => {
  const b = await json<Book>(page, "/api/v1/texts/shafici-risala");
  const top = b.chapters.find((c) => c.total > 0)!;
  const ch = await json<Chapter>(page, `/api/v1/texts/shafici-risala/chapters/${top.ordinal}?limit=5`);
  expect(ch.passages[0].cite.by).toBe("number");
  expect(ch.passages[0].cite.key).toMatch(/:n\d+$/);
  await page.goto("/books/shafici-risala");
  await expect(page.getByText("يحال إلى أرقام فقرات المحقق").first()).toBeVisible();
});

test("the library and the search reach the books; the English page", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("group", { name: "ما تعرضه" }).getByRole("button", { name: "الكتب" }).click();
  await expect(page.locator('a.book-card[href^="/books/"]')).toHaveCount(37);
  await expect(page.locator('a.book-card[href^="/hadith/"]')).toHaveCount(0);
  const q = "إنما الأعمال بالنيات";
  const found = await json<{ results: { books: { uri: string; ref: string; text: { slug: string } }[] } }>(page, `/api/v1/search?q=${enc(q)}`);
  const hit = found.results.books[0];
  await page.goto(`/search?q=${enc(q)}`);
  const group = page.locator(".result-group", { has: page.getByRole("heading", { name: "في كتب التراث" }) });
  await expect(group.locator(`a[href="/books/${hit.text.slug}/p/${hit.ref}"]`)).toBeVisible();
  await page.goto("/en/books");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classical books");
  await axe(page);
});

test("the catalogue: every work the gate lets in, by title, author and century, linked to where it is read", async ({ page }) => {
  const all = await json<{ all: number; total: number; centuries: { century: number; n: number }[] }>(page, "/api/v1/catalogue?limit=1");
  await page.goto("/books");
  await page.getByRole("link", { name: "فهرس الكتب كلها" }).click();
  await expect(page).toHaveURL(/\/books\/catalogue$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("فهرس الكتب");
  await expect(page.locator("p[aria-live=polite]")).toContainText(ar(all.total));
  await axe(page);
  await expectNoHorizontalScroll(page);
  // a century: the works of authors who died in it
  const fourth = all.centuries.find((c) => c.century === 4)!;
  await page.getByRole("navigation", { name: "قرن الوفاة" }).getByRole("link", { name: /^القرن ٤/ }).click();
  await expect(page).toHaveURL(/century=4/);
  await expect(page.locator("[data-work]")).toHaveCount(Math.min(40, fourth.n));
  // a search: al-Ṭabarī's Jāmiʿ, read here, on Shamela and on turath
  await page.goto(`/books/catalogue?q=${enc("جامع البيان")}`);
  const tabari = page.locator('[data-work="0310Tabari.JamicBayan.Shamela0007798-ara1"]');
  await expect(tabari.getByRole("link", { name: "اقرأه هنا" })).toHaveAttribute("href", "/books/tabari-jamicbayan");
  await expect(tabari.getByRole("link", { name: "في المكتبة الشاملة" })).toHaveAttribute("href", "https://shamela.ws/book/7798");
  await axe(page);
});

