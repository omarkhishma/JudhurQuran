import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The Arabic dictionary (P11.1): every root the classical lexica file an article under, the Quran's and the others;
 * a root with each lexicon's articles in the order their authors died and the Quran as one layer; what a reader types
 * reaching its root; what the evidence could not settle said so.
 */

const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const enc = encodeURIComponent;

test("the index: every letter with its roots, the lexica in their order, and a root found as typed", async ({ page, isMobile }) => {
  const letters = (await (await page.request.get("/api/v1/dictionary/letters")).json()) as { data: { letter: string; roots: number }[] };
  await page.goto("/dictionary");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("المعجم");
  // the shared nav names it (on the phone it sits in the menu)
  if (!isMobile) await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link", { name: "المعجم", exact: true })).toHaveAttribute("aria-current", "page");
  const grid = page.getByRole("navigation", { name: "الحروف" });
  await expect(grid.getByRole("link")).toHaveCount(28);
  const ain = letters.data.find((l) => l.letter === "ع")!;
  await expect(grid.getByRole("link", { name: new RegExp(`^ع\\s*${ar(ain.roots)}$`) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "المعاجم" })).toBeVisible();
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
  // a heading as Lisān prints it reaches its root
  await page.getByLabel("ابحث عن جذر").fill("سما");
  await page.getByRole("button", { name: "اذهب" }).click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${enc("سمو")}$`));
  await page.goto("/dictionary");
  await page.getByLabel("ابحث عن جذر").fill("xyz");
  await page.getByRole("button", { name: "اذهب" }).click();
  await expect(page.getByText("لا جذر بهذه الحروف في المعاجم.")).toBeVisible();
});

test("a letter: its roots by size, the Quran's marked (P11.1)", async ({ page }) => {
  await page.goto(`/dictionary/letter/${enc("ع")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("جذور حرف ع");
  const ilm = page.getByRole("link", { name: /^علم\s/ });
  await expect(ilm).toBeVisible();
  await expect(ilm.getByRole("img", { name: "ورد في القرآن" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^الخماسية/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
  await ilm.click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${enc("علم")}$`));
});

test("a root outside the Quran: every lexicon's article, read whole, and leafing on (P11.1)", async ({ page }) => {
  const api = (await (await page.request.get(`/api/v1/dictionary/roots/${enc("قبعثر")}`)).json()) as { works: { id: string; title_ar: string; articles: { id: number; length: number }[] }[] };
  await page.goto(`/dictionary/${enc("قبعثر")}`);
  await expect(page.getByText("لم يرد هذا الجذر في القرآن الكريم.")).toBeVisible();
  await expect(page.getByText("خماسي", { exact: true })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "المعاجم" }).getByRole("tab");
  await expect(tabs).toHaveCount(api.works.length);
  // the longest article read whole from the dictionary's own address
  const long = api.works.flatMap((w) => w.articles.map((a) => ({ w, a }))).sort((x, y) => y.a.length - x.a.length)[0];
  await tabs.filter({ hasText: long.w.title_ar }).click();
  const answer = page.waitForResponse((r) => r.url().includes(`/api/v1/dictionary/entries/${long.a.id}`) && r.ok());
  const more = page.getByRole("tabpanel").getByRole("button", { name: "اقرأ المادة كاملة" }).first();
  if (await more.isVisible()) {
    await more.click();
    await answer;
  }
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("link", { name: /الجذر التالي/ }).click();
  await expect(page).not.toHaveURL(new RegExp(`/dictionary/${enc("قبعثر")}$`));
});

test("a Quranic root: the Quran as one layer, and one the lexica file elsewhere says where (P11.1)", async ({ page }) => {
  const quran = (await (await page.request.get(`/api/v1/roots/${enc("علم")}`)).json()) as { occurrences: number };
  await page.goto(`/dictionary/${enc("علم")}`);
  await expect(page.getByText(`ورد في القرآن ${ar(quran.occurrences)} مرة`, { exact: false })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "المعاجم" }).getByRole("tab")).toHaveCount(9);
  await expect(page.getByRole("link", { name: "صفحة الجذر في القرآن" })).toHaveAttribute("href", `/roots/${enc("علم")}`);
  await page.goto(`/dictionary/${enc("زلزل")}`);
  await expect(page.getByText("لا يفرد أصحاب المعاجم لهذا الجذر مادة", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "زلل" }).click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${enc("زلل")}$`));
  // a spelling a reader typed goes to its root's one address
  await page.goto(`/dictionary/${enc("سما")}`);
  await expect(page).toHaveURL(new RegExp(`/dictionary/${enc("سمو")}$`));
});

test("a heading the evidence could not settle says so and names what it may be (P11.1)", async ({ page }) => {
  await page.goto(`/dictionary/${enc("سار")}`);
  const note = page.getByText("ولم يحسم ما في المعاجم الأخرى أصلها", { exact: false }).first();
  await expect(note).toBeVisible();
  await expect(page.getByRole("link", { name: "سير" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "سور" }).first()).toBeVisible();
});

test("the Quran's pages lead to the dictionary: a root's page and a word's dictionaries (P11.1)", async ({ page }) => {
  await page.goto(`/roots/${enc("أخذ")}`);
  const link = page.getByRole("link", { name: "كل مواد هذا الجذر في المعجم" });
  await expect(link).toHaveAttribute("href", `/dictionary/${enc("ءخذ")}`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/dictionary/${enc("ءخذ")}$`));
  await expect(page.getByRole("tablist", { name: "المعاجم" }).getByRole("tab").first()).toBeVisible();
  // the reader's word panel, its dictionaries section open
  await page.addInitScript(() => {
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: false, family: false, patterns: false, lexica: true, timeline: false, usage: false } }, version: 2 }));
  });
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const lex = page.locator('[data-section="lexica"]').first();
  await expect(lex.getByRole("link", { name: "افتحه في المعجم" })).toHaveAttribute("href", `/dictionary/${enc("علم")}`);
});
