import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { ar } from "./helpers";

/** The Notebook (P5.4, inventory NTB with the Quran notes NTB-Q01…Q10). Everything stays in the browser. */

const today = () => new Date().toLocaleDateString("en-CA");
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
};
const prime = (page: Page, extra: { personal?: Record<string, unknown>; saved?: Record<string, unknown> } = {}) =>
  page.addInitScript((x) => {
    if (localStorage.getItem("jadhr-personal")) return;
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, wordStates: {}, trail: [], progress: {}, proposals: [], savedTrails: [], sessions: [], ...x.personal }, version: 2 }));
    localStorage.setItem("jadhr-saved", JSON.stringify({ state: { bookmarks: [], notes: {}, history: [], ...x.saved }, version: 2 }));
  }, extra);
const editor = (page: Page) => page.locator(".notebook-editor");

test("a new note: title, tags without duplicates, and @-mentions that link a verse, a root, a word and a lexicon (NTB-03, 19…30, Q04)", async ({ page }) => {
  await prime(page);
  await page.goto("/notebook");
  await page.getByRole("button", { name: "+ ملاحظة جديدة" }).click();
  await expect(page).toHaveURL(/\/notebook\?note=n/);
  await editor(page).getByRole("textbox", { name: "عنوان الملاحظة" }).fill("عن العلم");
  const tag = editor(page).getByRole("textbox", { name: "أضف وسمًا" });
  for (const v of ["درس", "درس"]) {
    await tag.fill(v);
    await tag.press("Enter");
  }
  await expect(editor(page).locator(".tag-pill")).toHaveCount(1);
  await editor(page).getByRole("textbox", { name: "نص الملاحظة" }).fill("انظر @2:255 و@ع ل م، والكلمة @علم في @لسان");
  const linked = editor(page).getByRole("region", { name: "مرتبطة بـ" });
  await expect(linked.locator('a[href="/quran/2/255"]')).toContainText("البقرة");
  await expect(linked.locator(`a[href="/concordance?root=${encodeURIComponent("علم")}"]`)).toBeVisible();
  await expect(linked.locator('a[href^="/read?w="]')).toBeVisible();
  await expect(linked.locator('a[href="/sources"]')).toContainText("لسان العرب");
  // kept in the browser, and grouped under the root its mention names (NTB-Q06); the list on its own URL
  // (a phone shows the list or the note, and ?note= is the note)
  await page.goto("/notebook");
  await expect(page.locator(".notebook-row").first()).toContainText("عن العلم");
  await page.getByRole("button", { name: "بالجذر" }).click();
  await expect(page.locator(".notebook-section").filter({ hasText: "ع ل م" })).toBeVisible();
});

test("search folds Arabic: a vowelled note is found by its bare words, and no match says so (NTB-05, 06, 18, Q05)", async ({ page }) => {
  await prime(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-notebook")) localStorage.setItem("jadhr-notebook", JSON.stringify({ state: { notes: [{ id: "n1", title: "", body: "العِلْمُ نُورٌ وَالجَهْلُ ظَلامٌ", tags: [], created: 1, updated: 1, links: { roots: [], verses: [] } }] }, version: 1 }));
  });
  await page.goto("/notebook");
  const search = page.getByRole("textbox", { name: "ابحث في الملاحظات" });
  await search.fill("العلم نور");
  await expect(page.locator(".notebook-row")).toHaveCount(1);
  await search.fill("زززز");
  await expect(page.getByRole("status")).toHaveText("لا ملاحظات تطابق «زززز».");
});

test("a note on a verse shows the verse verbatim, whole on request, and edits where the reader keeps it (NTB-32, Q03)", async ({ page }) => {
  await prime(page, { saved: { notes: { "quran:2:255": { verse: "2:255", text: "آية الكرسي", at: 1 } } } });
  await page.goto("/notebook");
  await page.locator(".notebook-row").filter({ hasText: "على آية" }).click();
  const anchor = editor(page).locator(".notebook-anchor");
  await expect(anchor).toContainText("على البقرة: ٢٥٥");
  await expect(anchor.locator("p")).toContainText("…");
  await anchor.getByRole("button", { name: "اعرض الآية كاملة" }).click();
  await expect(anchor.locator("p")).not.toContainText("…");
  await editor(page).getByRole("textbox", { name: "نص الملاحظة" }).fill("آية الكرسي أعظم آية");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-saved")!).state.notes["quran:2:255"].text);
  expect(stored).toBe("آية الكرسي أعظم آية");
});

test("deleting asks first; a saved trail lists its steps (NTB-25, 36)", async ({ page }) => {
  await prime(page, { personal: { savedTrails: [{ id: "t1", ts: 1, steps: [{ kind: "word", id: "ilm", ts: 1 }, { kind: "verse", id: "20:114", ts: 2 }, { kind: "root", id: "علم", ts: 3 }] }] } });
  await page.goto("/notebook");
  await page.locator(".notebook-row").filter({ hasText: "مسار" }).click();
  await expect(editor(page).locator("ol li")).toHaveCount(3);
  await expect(editor(page).locator('a[href="/quran/20/114"]')).toHaveText("٢٠:١١٤");
  await editor(page).getByRole("button", { name: "احذف" }).click();
  await expect(editor(page)).toContainText("تُحذف هذه الملاحظة");
  await editor(page).getByRole("button", { name: "احذف" }).click();
  await expect(page.locator(".notebook-row")).toHaveCount(0);
});

test("a note exports as Markdown (NTB-Q10)", async ({ page, isMobile }) => {
  test.skip(isMobile, "downloads are checked once");
  await prime(page);
  await page.goto("/notebook");
  await page.getByRole("button", { name: "+ ملاحظة جديدة" }).click();
  await editor(page).getByRole("textbox", { name: "عنوان الملاحظة" }).fill("خلاصة");
  await editor(page).getByRole("textbox", { name: "نص الملاحظة" }).fill("نص الملاحظة @2:255");
  await expect(editor(page).locator('a[href="/quran/2/255"]')).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), editor(page).getByRole("button", { name: "صدّرها (Markdown)" }).click()]);
  const md = readFileSync((await dl.path())!, "utf8");
  expect(md).toContain("# خلاصة");
  expect(md).toContain("verses: 2:255");
});

test("the journal: this week by day, sessions with their roots, all-time counts and what the scheduler says is due — no streak (NTB-39…49, Q08)", async ({ page }) => {
  await prime(page, {
    personal: {
      wordStates: { ilm: "known", qala: "learning" },
      sessions: [
        { day: daysAgo(1), text: "quran", words: ["ilm"], roots: ["علم"], verses: ["2:32"], lookups: 3 },
        { day: today(), text: "quran", words: ["ilm", "kitab"], roots: ["علم", "كتب"], verses: [], lookups: 5 },
      ],
    },
    saved: { bookmarks: [{ kind: "lemma", key: "kitab", label: "كتاب", at: 1 }] },
  });
  await page.goto("/notebook?tab=journal");
  const chart = page.getByRole("list", { name: "عمليات البحث في الأيام السبعة الأخيرة" });
  await expect(chart.locator(".week-bar:not(.is-empty)")).toHaveCount(2);
  await expect(page.locator(".session-card")).toHaveCount(2);
  await expect(page.locator(".session-card").first().locator(".root-chip")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "منذ البداية" })).toContainText("جذران لقيتهما");
  await expect(page.getByRole("region", { name: "منذ البداية" })).toContainText(`تعرف ${ar(1)} • تتعلّم ${ar(1)}`);
  // the starred كتاب and the known عِلْم: two families, both due (never reviewed)
  await expect(page.getByRole("region", { name: "حان موعد مراجعتها" })).toContainText("عائلتان");
  await expect(page.locator("main")).toContainText("لا شيء يطلب منك أن تحافظ على سلسلة أيام");
});

test("on a phone the list and the note take turns (NTB-54)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await prime(page, { saved: { notes: { "quran:1:1": { verse: "1:1", text: "البسملة", at: 1 } } } });
  await page.goto("/notebook");
  await expect(page.locator(".notebook-editor")).toBeHidden();
  await page.locator(".notebook-row").first().click();
  await expect(page.locator(".notebook-list")).toBeHidden();
  await page.getByRole("button", { name: "→ كل الملاحظات" }).click();
  await expect(page.locator(".notebook-list")).toBeVisible();
});
