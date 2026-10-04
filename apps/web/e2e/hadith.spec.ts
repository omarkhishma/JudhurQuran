import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ar, expectNoHorizontalScroll } from "./helpers";

/**
 * The hadith collections (P11.2): the seven books and their kitābs; a hadith told into isnād, matn and comment (by
 * rule, said so), its words open to their readings, its narrators linked to Ibn Ḥajar's entries, the graders' rulings
 * under their names, HadeethEnc's explanation where it cites the number; a narrator's page; the shelf and the search.
 */

const enc = encodeURIComponent;
const digits = (s: string) => s.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
type Shelf = { data: { slug: string; kind: string; passage_count: number }[] };
type Detail = { chapters: { ordinal: number; title_ar: string; total: number }[]; passage_count: number };
type Rec = { ar_full: string; parts: { isnad: [number, number]; matn: [number, number] }; segments: { t: string; w?: number; p?: string }[]; narrators: { ordinal: number; text: string }[] };
// letters only: a typed literal's marks need not come in the source's order (CLAUDE.md), so words are found by their letters
const bare = (s: string) => s.normalize("NFC").replace(/[\u064B-\u0652\u0670\u0640\u200f]/g, "").replace(/[أإآ]/g, "ا");
const record = async (page: import("@playwright/test").Page, slug: string, ref: string) => (await (await page.request.get(`/api/v1/texts/${slug}/passages/${ref}`)).json()) as Rec;

async function axe(page: import("@playwright/test").Page) {
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

test("the collections: seven books, each with its hadith and kitābs counted", async ({ page, isMobile }) => {
  const shelf = (await (await page.request.get("/api/v1/texts")).json()) as Shelf;
  const books = shelf.data.filter((t) => t.kind === "hadith");
  expect(books.map((b) => b.slug)).toEqual(["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik"]);
  await page.goto("/hadith");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("كتب الحديث");
  if (!isMobile) await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link", { name: "الحديث", exact: true })).toHaveAttribute("aria-current", "page");
  for (const b of books) {
    const detail = (await (await page.request.get(`/api/v1/texts/${b.slug}`)).json()) as Detail;
    const card = page.locator(`[data-collection="${b.slug}"]`);
    await expect(card).toContainText(ar(b.passage_count));
    await expect(card).toContainText(ar(detail.chapters.length));
  }
  await axe(page);
  await expectNoHorizontalScroll(page);
  await page.locator('[data-collection="bukhari"]').click();
  await expect(page).toHaveURL(/\/hadith\/bukhari$/);
  const bukhari = (await (await page.request.get("/api/v1/texts/bukhari")).json()) as Detail;
  await expect(page.getByRole("heading", { name: "الكتب" })).toBeVisible();
  await expect(page.locator("main ol > li")).toHaveCount(bukhari.chapters.length);
  await axe(page);
});

test("a bāb: its hadith in order, each isnād set apart from its matn", async ({ page }) => {
  await page.goto("/hadith/bukhari/kitab/2");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("باب كيف كان بدء الوحي");
  const r = await record(page, "bukhari", "1");
  const first = page.getByRole("article", { name: `الحديث ${digits("1")}` });
  // the parts as the API cuts them, the text untouched
  await expect(first.locator(".hp-isnad")).toHaveText(r.ar_full.slice(...r.parts.isnad).trim());
  await expect(first.locator(".hp-matn")).toHaveText(r.ar_full.slice(...r.parts.matn).trim());
  expect(bare(r.ar_full.slice(...r.parts.matn))).toContain("انما الاعمال بالنيات");
  await axe(page);
  await expectNoHorizontalScroll(page);
  await first.getByRole("link", { name: `افتح الحديث ${digits("1")}` }).click();
  await expect(page).toHaveURL(/\/hadith\/bukhari\/1$/);
});

test("a hadith: its words open their readings, its narrators their entries, HadeethEnc beside it", async ({ page, isMobile }) => {
  await page.goto("/hadith/bukhari/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`صحيح البخاري، الحديث ${digits("1")}`);
  await expect(page.getByText("تقسيم آلي")).toBeVisible();
  // a word of the matn: its root in the Quran and in the dictionary
  const r = await record(page, "bukhari", "1");
  const word = r.segments.find((x) => x.w !== undefined && x.p === "matn" && bare(x.t) === "الاعمال")!;
  await page.locator(".hadith-text .hp-matn").getByRole("button", { name: word.t, exact: true }).click();
  const panel = page.getByRole("complementary", { name: "الكلمة" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "الجذر في القرآن" })).toHaveAttribute("href", `/roots/${enc("عمل")}`);
  await expect(panel.getByRole("link", { name: "الجذر في المعجم" })).toHaveAttribute("href", `/dictionary/${enc("عمل")}`);
  await axe(page);
  await expectNoHorizontalScroll(page);
  await page.keyboard.press("Escape");
  if (isMobile) await expect(panel).toBeHidden();
  // the narrators: six, Sufyān linked to Ibn ʿUyayna by the chain
  const chain = page.getByRole("region", { name: "رجال الإسناد" }).or(page.locator("section[aria-labelledby=chain-h]"));
  await expect(chain.locator("li")).toHaveCount(6);
  await expect(chain.locator("li").nth(1)).toContainText("سفيان بن عيينة");
  // HadeethEnc's item citing this number, its version in the credit
  await expect(page.getByRole("heading", { name: "شرح موسوعة الأحاديث النبوية" })).toBeVisible();
  await expect(page.getByText(`تحيل الموسوعة إلى صحيح البخاري، الحديث ${digits("1")}`).first()).toBeVisible();
  await expect(page.getByText(/HadeethEnc\.com\)، الإصدار العربي 1\.7\.0/)).toBeVisible();
  // the first hadith has no previous one; the next is 2
  await expect(page.getByRole("link", { name: "الحديث السابق" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "الحديث التالي" })).toHaveAttribute("href", "/hadith/bukhari/2");
  // a narrator's name opens his page
  await page.locator(".hadith-text a.hp-name", { hasText: r.narrators[1].text }).first().click();
  await expect(page).toHaveURL(/\/hadith\/narrators\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("سفيان بن عيينة");
});

test("graders under their names, a sub-numbered record, the English page", async ({ page }) => {
  await page.goto("/hadith/abudawud/4607");
  const grades = page.locator("section[aria-labelledby=grades-h]");
  await expect(grades).toContainText("محمد ناصر الدين الألباني");
  await expect(grades).toContainText("صحيح");
  await axe(page);
  // Muslim's records under one ʿAbd al-Bāqī number: «1907.01», its point written «_» in the address
  await page.goto("/hadith/muslim/1907_01");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`صحيح مسلم، الحديث ${digits("1907.01")}`);
  await page.goto("/en/hadith/bukhari/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ṣaḥīḥ al-Bukhārī, hadith 1");
  await axe(page);
});

test("a narrator: Ibn Ḥajar's entry, his own definitions beside what is read from it, his teachers and hadith", async ({ page }) => {
  const found = (await (await page.request.get(`/api/v1/narrators?q=${enc("الزهري")}`)).json()) as { data: { id: number; links: number }[] };
  const zuhri = found.data.sort((a, b) => b.links - a.links)[0];
  await page.goto(`/hadith/narrators/${zuhri.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("محمد بن مسلم بن عبيد الله");
  await expect(page.getByText(`الطبقة ${ar(4)}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/كالزهري وقتادة/)).toBeVisible();
  await expect(page.getByText(`توفي سنة ${ar(125)}هـ`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "يروي عن" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^عروة بن الزبير/ })).toBeVisible();
  await axe(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: "الصفحة التالية" }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  // found by the name a chain gives him
  await page.goto(`/hadith/narrators?q=${enc("سفيان")}`);
  await expect(page.getByRole("link", { name: /^سفيان بن عيينة/ })).toBeVisible();
  await axe(page);
});

test("the shelf and the search reach the hadith", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("group", { name: "ما تعرضه" }).getByRole("button", { name: "الحديث" }).click();
  const cards = page.locator('a.book-card[href^="/hadith/"]');
  await expect(cards).toHaveCount(7);
  await expect(page.locator('a.book-card[href="/read"]')).toHaveCount(0);
  await page.goto(`/search?q=${enc("إنما الأعمال بالنيات")}`);
  const group = page.locator(".result-group", { has: page.getByRole("heading", { name: "في كتب الحديث" }) });
  await expect(group.locator('a[href="/hadith/bukhari/1"]')).toBeVisible();
  await expect(group.locator("mark").first()).toBeVisible();
});

test("a word looked up in a hadith is the reader's last lookup: the hub carries its root (SHL-Q09)", async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })); });
  const r = await record(page, "bukhari", "1");
  const word = r.segments.find((x) => x.w !== undefined && x.p === "matn" && bare(x.t) === "الاعمال")!;
  await page.goto("/hadith/bukhari/1");
  await page.locator(".hadith-text .hp-matn").getByRole("button", { name: word.t, exact: true }).click();
  await expect(page.getByRole("complementary", { name: "الكلمة" }).getByRole("link", { name: "الجذر في القرآن" })).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".hub-context").getByRole("link", { name: "ع م ل" })).toHaveAttribute("href", `/concordance?root=${enc("عمل")}`);
  // and the way back is to the hadith the word was read in, newer than any verse read
  await expect(page.locator(".hub-context").getByRole("link", { name: "صحيح البخاري ١" })).toHaveAttribute("href", "/hadith/bukhari/1");
});
