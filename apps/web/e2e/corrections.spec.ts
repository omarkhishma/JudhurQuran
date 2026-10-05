import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { drop, person, sql, tag } from "./board";
import { api, ar } from "./helpers";

/**
 * The library's automatic layers in the edit requests, and in the notebook (B58, RVQ-Q11, NTB-Q04): a name in a
 * hadith's isnād and a dictionary article's root corrected by a reader, approved by a reviewer and an editor, then shown
 * beside what the build made — which stays as it was — and credited; a dictionary page asking for its articles'
 * corrections once; a note that mentions a hadith and a book's paragraph, linked both ways. Every expectation is read
 * from the API.
 */

type Hadith = { uri: string; narrators: { ordinal: number; text: string; narrator: { name: string } | null }[] };
type DictRoot = { key: string; works: { title_ar: string; articles: { uri: string; headword: string }[] }[] };
type Paragraph = { uri: string; ref: string; cite: { ar: string } };

const clean = (t: string) => {
  const own = `select id from contributions.proposals where text like '%${t}'`;
  sql(`delete from contributions.changelog where merge_id in (select id from contributions.merges where proposal_id in (${own}))`);
  sql(`delete from contributions.merges where proposal_id in (${own})`);
  sql(`delete from contributions.proposals where text like '%${t}'`);
};
const approve = async (p: { page: Page; h: Record<string, string> }, id: string) => {
  const r = await p.page.request.post(`/api/v1/proposals/${id}/decisions`, { headers: p.h, data: { decision: "approve", note: "" } });
  expect(r.status(), await r.text()).toBe(200);
  return ((await r.json()) as { status: string }).status;
};
const proposalOf = (t: string) => sql(`select id from contributions.proposals where text like '%${t}'`)[0];

test("a name in a hadith's isnād corrected through the edit requests, shown beside the build's link and credited (B58)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in desktop windows; the phone is read in the signed-out test below");
  test.setTimeout(180_000);
  const t = tag();
  const a = await person(browser, `e2e-corr-a-${t}@example.org`);
  const r = await person(browser, `e2e-corr-r-${t}@example.org`, "reviewer");
  const e = await person(browser, `e2e-corr-e-${t}@example.org`, "editor");
  try {
    const h = await api<Hadith>(a.page, "/texts/bukhari/passages/1");
    const second = h.narrators.find((n) => n.ordinal === 2)!;
    await a.page.goto("/hadith/bukhari/1");
    const chain = a.page.locator('section[aria-labelledby="chain-h"]');
    const before = await chain.innerText();
    await a.page.getByRole("button", { name: "اقترح تصحيحًا" }).click();
    const box = a.page.getByRole("region", { name: "تصحيحات القرّاء" });
    await box.getByRole("combobox", { name: "ما الذي تصحّحه" }).selectOption({ label: "راوٍ في الإسناد" });
    await box.getByRole("combobox", { name: "أيّ اسم في الإسناد" }).selectOption({ label: `${ar(2)}. ${second.text}` });
    await box.getByRole("textbox", { name: "التصحيح" }).fill(`سفيان بن عيينة ${t}`);
    await box.getByRole("textbox", { name: "لماذا" }).fill("الحميدي يروي عن ابن عيينة");
    await box.getByRole("textbox", { name: "المصدر (اختياري)" }).fill("تهذيب الكمال");
    await box.getByRole("button", { name: "أرسل إلى طلبات التعديل" }).click();
    await expect(box.getByRole("status")).toContainText("أُرسل تصحيحك إلى طلبات التعديل.");
    await expect(box).toContainText(`تصحيحات تنتظر المراجعة: ${ar(1)}`);

    // in the queue: the hadith named and linked, what the build made read by the server, the name's place
    const id = proposalOf(t);
    const row = sql(`select kind, field, location, lemma, current_text from contributions.proposals where id = '${id}'`)[0].split("\t");
    expect(row.slice(0, 4)).toEqual(["correction", "narrator", "2", h.uri]);
    expect(row[4]).toBe(`${second.text} ← ${second.narrator?.name ?? "—"}`);
    await r.page.goto(`/review?id=${id}`);
    await expect(r.page.getByRole("link", { name: `صحيح البخاري، الحديث ${ar(1)}` }).first()).toHaveAttribute("href", "/hadith/bukhari/1");
    await expect(r.page.locator(".queue-screen")).toContainText(`الاسم ${ar(2)} في الإسناد`);
    expect(await approve(r, id)).not.toBe("merged");
    expect(await approve(e, id)).toBe("merged");

    // on the hadith: the correction in force beside the build's links, which stay as they were
    await a.page.reload();
    const shown = a.page.getByRole("region", { name: "تصحيحات القرّاء" });
    await expect(shown).toContainText(`راوٍ في الإسناد • الاسم ${ar(2)} في الإسناد`);
    await expect(shown).toContainText(`سفيان بن عيينة ${t}`);
    await expect(shown).toContainText(`وافق عليه ${ar(2)}`);
    // the name corrected is marked in the chain, leading to the correction; nothing else in the chain changed
    const marks = chain.getByRole("link", { name: "صحّحه القرّاء" });
    await expect(marks).toHaveCount(1);
    await expect(chain.getByRole("listitem").nth(1).getByRole("link", { name: "صحّحه القرّاء" })).toHaveAttribute("href", "#corrections");
    const flat = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(flat((await chain.innerText()).replace("صحّحه القرّاء", ""))).toBe(flat(before));
    await marks.click();
    await expect(shown).toBeInViewport();
    // and in the changelog, linked to the hadith
    await a.page.goto("/data");
    await expect(a.page.getByRole("link", { name: `صحيح البخاري، الحديث ${ar(1)}` }).first()).toHaveAttribute("href", "/hadith/bukhari/1");
  } finally {
    clean(t);
    await drop(a);
    await drop(r);
    await drop(e);
  }
});

test("a dictionary article's root corrected, its page asking for every article's corrections at once (B58)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in desktop windows; the phone is read in the signed-out test below");
  test.setTimeout(180_000);
  const t = tag();
  const a = await person(browser, `e2e-corr-d-${t}@example.org`);
  const r = await person(browser, `e2e-corr-dr-${t}@example.org`, "reviewer");
  const e = await person(browser, `e2e-corr-de-${t}@example.org`, "editor");
  try {
    const root = await api<DictRoot>(a.page, `/dictionary/roots/${encodeURIComponent("علم")}`);
    const work = root.works[0];
    const article = work.articles[0];
    const asked: string[] = [];
    a.page.on("request", (q) => q.url().includes("/api/v1/corrections") && asked.push(q.url()));
    await a.page.goto(`/dictionary/${encodeURIComponent(root.key)}`);
    await expect.poll(() => asked.filter((u) => u.includes("/corrections/in-force")).length).toBe(1);
    const inForce = new URL(asked.find((u) => u.includes("/corrections/in-force"))!).searchParams.getAll("targets");
    expect(new Set(inForce)).toEqual(new Set(root.works.flatMap((w) => w.articles.map((x) => x.uri))));
    expect(asked.filter((u) => u.includes("/corrections?"))).toEqual([]);

    const anchor = a.page.locator(`[id="${article.uri}"]`);
    await anchor.getByRole("button", { name: "اقترح تصحيحًا" }).click();
    await anchor.getByRole("textbox", { name: "التصحيح" }).fill(`ع ل م — لا غير ${t}`);
    await anchor.getByRole("textbox", { name: "لماذا" }).fill("المادة في موضعها");
    await anchor.getByRole("button", { name: "أرسل إلى طلبات التعديل" }).click();
    await expect(anchor.getByRole("status")).toContainText("أُرسل تصحيحك إلى طلبات التعديل.");
    const id = proposalOf(t);
    expect(sql(`select field, lemma from contributions.proposals where id = '${id}'`)[0].split("\t")).toEqual(["filing", article.uri]);
    expect(await approve(r, id)).not.toBe("merged");
    expect(await approve(e, id)).toBe("merged");
    await a.page.reload();
    await expect(a.page.locator(`[id="${article.uri}"]`)).toContainText(`ع ل م — لا غير ${t}`);
    await expect(a.page.locator(`[id="${article.uri}"]`)).toContainText("جذر المادة");
    // the article's text is the lexicon's, untouched
    await expect(a.page.locator(`[id="${article.uri}"] article`).first()).not.toContainText(t);
  } finally {
    clean(t);
    await drop(a);
    await drop(r);
    await drop(e);
  }
});

test("signed out, a correction is written first, kept on this device, and sign-in asked for after (B58, RVQ-Q02)", async ({ page }) => {
  const p = await api<Paragraph>(page, "/texts/ibnkathir-tafsirquran/passages/100");
  const path = `/books/ibnkathir-tafsirquran/p/${p.ref}`;
  await page.goto(path);
  // one line naming what it corrects until opened, then the section with its form
  await expect(page.getByText("اقترح تصحيحًا — الصفحة المطبوعة")).toBeVisible();
  await page.getByRole("button", { name: "اقترح تصحيحًا" }).click();
  const box = page.getByRole("region", { name: "تصحيحات القرّاء" });
  await box.getByRole("textbox", { name: "التصحيح" }).fill("تبدأ الفقرة في الصفحة التالية");
  await box.getByRole("textbox", { name: "لماذا" }).fill("علامة الصفحة في الطبعة بعد أول سطر");
  await box.getByRole("button", { name: "أرسل إلى طلبات التعديل" }).click();
  await expect(box.getByRole("status")).toContainText("حُفظ اقتراحك على هذا الجهاز");
  await expect(box.getByRole("textbox", { name: "بريدك الإلكتروني" })).toBeVisible();
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.proposals ?? []);
  expect(kept).toEqual([expect.objectContaining({ kind: "correction", slug: p.uri, label: p.cite.ar, field: "page", href: path, text: "تبدأ الفقرة في الصفحة التالية" })]);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a failure to read the corrections leaves the page as the build made it, never broken (B58)", async ({ page }) => {
  await page.route("**/api/v1/corrections**", (r) => r.fulfill({ status: 500, body: "{}" }));
  await page.goto("/hadith/bukhari/1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("صحيح البخاري");
  await expect(page.locator('section[aria-labelledby="chain-h"]')).toBeVisible();
  await page.goto(`/dictionary/${encodeURIComponent("علم")}`);
  await expect(page.getByRole("tablist")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "حدث خطأ غير متوقع" })).toHaveCount(0);
});
