import { expect, type Page, test } from "@playwright/test";
import { api, ar, arCount, expectNoHorizontalScroll } from "./helpers";

/**
 * The concordance (design 05 §5.3, CON-01…39, CON-Q01…Q09). Every number is compared with the API the
 * page reads, never typed in.
 */

type Line = { location: string; surah: number; ayah: number; lemma_slug: string | null; left: string; keyword: string; right: string };
type Page_ = {
  filters: { near_ar: string | null };
  root: { key: string; occurrences: number };
  facets: {
    lemmas: { slug: string; ar: string; n: number }[];
    surahs: { surah: number; n: number }[];
    pos: { tag: string; ar: string; n: number }[];
    juz: { juz: number; n: number }[];
  };
  total: number;
  translation: { title_en: string } | null;
  data: (Line & { translation: string | null })[];
};
type Dist = {
  total: number;
  per_surah: { surah: number; hits: number; revelation_order: number }[];
  place: { meccan: number; medinan: number };
  forms: { form: string; n: number }[];
  collocates: { slug: string; ar: string; n: number }[];
};

const ILM = encodeURIComponent("علم");
const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const rows = (page: Page) => page.locator(".conc-lines .conc-row");
const hits = (n: number) => arCount(n, { one: "موضع واحد", two: "موضعان", few: "# مواضع", many: "# موضعًا", other: "# موضع" });
const more = (page: Page) => page.getByRole("button", { name: /^المزيد/ });

test("concordance: arriving with no root shows ع ل م, every hit counted by the server, paged (CON-05, CON-Q01)", async ({ page }) => {
  const c = await api<Page_>(page, `/concordance?root=${ILM}&limit=1`);
  expect(c.total).toBe(c.root.occurrences);
  await page.goto("/concordance");
  await expect(page.getByRole("button", { name: "ع ل م" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".conc-filters .mono")).toContainText(hits(c.total));
  await expect(rows(page)).toHaveCount(Math.min(60, c.total));
  await expect(more(page)).toContainText(`${ar(60)} من ${ar(c.total)}`);
  await more(page).click();
  await expect(rows(page)).toHaveCount(Math.min(120, c.total));
  // The first line is the first hit in mushaf order, split from the stored text.
  const first = rows(page).first();
  await expect(first.locator(".conc-key")).toHaveText(c.data[0].keyword);
  await expect(first).toHaveAttribute("data-loc", c.data[0].location);
});

test("concordance: the keywords stand on one axis and the preceding words sit on their right in Arabic (CON-10/11, CON-Q02)", async ({ page, isMobile }) => {
  await page.goto("/concordance");
  await expect(rows(page)).toHaveCount(60);
  const boxes = await rows(page).evaluateAll((els) =>
    els.slice(0, 15).map((el) => {
      const r = (s: string) => el.querySelector(s)!.getBoundingClientRect();
      const k = r(".conc-key");
      const pre = r(".conc-pre");
      const fol = r(".conc-fol");
      return { kl: k.left, kr: k.right, preL: pre.left, folR: fol.right };
    }),
  );
  for (const b of boxes) {
    expect(b.preL, "preceding starts right of the keyword").toBeGreaterThanOrEqual(b.kr - 1);
    expect(b.folR, "following ends left of the keyword").toBeLessThanOrEqual(b.kl + 1);
    // one column: every keyword cell has the same box
    expect(Math.abs(b.kl - boxes[0].kl)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.kr - boxes[0].kr)).toBeLessThanOrEqual(1);
  }
  if (isMobile) await expectNoHorizontalScroll(page);
});

test("concordance: word and Makki/Madani filters narrow the lines, survive a reload, and the total is the server's (CON-14…18)", async ({ page }) => {
  const c = await api<Page_>(page, `/concordance?root=${ILM}&limit=1`);
  const i = c.facets.lemmas.findIndex((l) => l.n > 2 && l.n < 60);
  const lemma = c.facets.lemmas[i];
  const word = page.getByRole("group", { name: "الكلمة", exact: true }).getByRole("button");
  await page.goto("/concordance");
  await word.nth(i + 1).click();
  await expect(page).toHaveURL(new RegExp(`lemma=${lemma.slug}`));
  await expect(rows(page)).toHaveCount(lemma.n);
  await expect(more(page)).toHaveCount(0);

  const meccan = await api<Page_>(page, `/concordance?root=${ILM}&lemma=${lemma.slug}&place=meccan&limit=1`);
  await page.getByRole("group", { name: "المكي والمدني" }).getByRole("button", { name: "المكي" }).click();
  await expect(page).toHaveURL(/place=meccan/);
  await expect(rows(page)).toHaveCount(meccan.total);
  await expect(page.locator(".conc-filters .mono")).toContainText(hits(meccan.total));

  await page.reload();
  await expect(word.nth(i + 1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "المكي والمدني" }).getByRole("button", { name: "المكي" })).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(meccan.total);
});

test("concordance: sorting by the following context reorders the lines as the server does (CON-12, CON-Q03)", async ({ page }) => {
  const sorted = await api<Page_>(page, `/concordance?root=${ILM}&sort=following&limit=3`);
  await page.goto("/concordance");
  await page.getByRole("group", { name: "الترتيب" }).getByRole("button", { name: "بالسياق اللاحق" }).click();
  await expect(page).toHaveURL(/sort=following/);
  for (let i = 0; i < 3; i++) await expect(rows(page).nth(i)).toHaveAttribute("data-loc", sorted.data[i].location);
});

test("concordance: a line opens the reader with that hit selected (CON-19)", async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), RETURNING);
  const c = await api<Page_>(page, `/concordance?root=${ILM}&limit=3`);
  const hit = c.data[2];
  await page.goto("/concordance");
  await rows(page).nth(2).click();
  await expect(page).toHaveURL(new RegExp(`/quran/${hit.surah}\\?w=${hit.lemma_slug}&at=${hit.location.replace(/:/g, "(:|%3A)")}`));
  await expect(page.locator(`.w[data-w="${hit.location}"]`)).toHaveClass(/is-selected/);
});

test("concordance: the CSV export carries the filters, a BOM, a header and one row per hit (CON-26/27, CON-Q08)", async ({ page }) => {
  await page.goto(`/concordance?place=medinan`);
  const href = await page.getByRole("link", { name: "تصدير CSV" }).getAttribute("href");
  expect(href).toContain("place=medinan");
  expect(href).not.toContain("limit=");
  const r = await page.request.get(href!);
  expect(r.ok()).toBeTruthy();
  expect(r.headers()["content-disposition"]).toMatch(/filename="concordance-[\x20-\x7e]+\.csv"/);
  const body = await r.text();
  expect(body.charCodeAt(0)).toBe(0xfeff);
  const c = await api<Page_>(page, `/concordance?root=${ILM}&place=medinan&limit=1`);
  const lines = body.trim().split("\r\n");
  expect(lines[0]).toContain('"surah"');
  expect(lines.length - 1).toBe(c.total);
});

test("concordance: the distribution per sūra adds up, and a sūra opens its lines (CON-21…24, CON-Q04)", async ({ page }) => {
  const d = await api<Dist>(page, `/concordance/distribution?root=${ILM}`);
  expect(d.place.meccan + d.place.medinan).toBe(d.total);
  expect(d.per_surah.reduce((a, s) => a + s.hits, 0)).toBe(d.total);
  await page.goto("/concordance");
  await page.getByRole("group", { name: "طريقة العرض" }).getByRole("button", { name: "التوزيع" }).click();
  await expect(page).toHaveURL(/view=dist/);
  const surahRows = page.locator(".conc-pane").first().locator("button.dist-row");
  await expect(surahRows).toHaveCount(d.per_surah.length);
  await expect(page.locator(".conc-pane").first()).toContainText(`المكي: ${ar(d.place.meccan)}`);
  await expect(page.locator(".conc-pane").first()).toContainText(`المدني: ${ar(d.place.medinan)}`);
  const s = d.per_surah[1];
  await surahRows.nth(1).click();
  await expect(page).toHaveURL(new RegExp(`surah=${s.surah}`));
  await expect(page).not.toHaveURL(/view=dist/);
  await expect(rows(page)).toHaveCount(Math.min(60, s.hits));
});

test("concordance: arriving from a word opens its root; another root can be typed; an unknown one says so", async ({ page }) => {
  await page.goto("/concordance?w=rahma");
  await expect(page.getByRole("button", { name: "ر ح م" })).toHaveAttribute("aria-pressed", "true");
  const box = page.getByRole("textbox", { name: "جذر آخر…" });
  await box.fill("ص ب ر");
  await box.press("Enter");
  await expect(page).toHaveURL(/root=%D8%B5%D8%A8%D8%B1/);
  await expect(page.getByRole("button", { name: "ص ب ر" })).toHaveAttribute("aria-pressed", "true");
  await box.fill("ظظظ");
  await box.press("Enter");
  await expect(page.locator(".conc-screen").getByRole("alert")).toContainText("لا جذر بهذه الحروف");
});

test("concordance (English): same lines, English controls, no horizontal scroll", async ({ page }) => {
  const c = await api<Page_>(page, `/concordance?root=${ILM}&limit=1`);
  await page.goto("/en/concordance");
  await expect(page.locator(".conc-filters .mono")).toContainText(`${c.total.toLocaleString("en-US")} hits`);
  await expect(page.getByRole("group", { name: "Sort" }).getByRole("button", { name: "Mushaf order" })).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(60);
  await expectNoHorizontalScroll(page);
});

test("concordance: part of speech chips and the juzʾ list filter the lines with the server's counts (CON-Q03)", async ({ page }) => {
  const c = await api<Page_>(page, `/concordance?root=${ILM}&limit=1`);
  await page.goto("/concordance");
  const pos = page.getByRole("group", { name: "نوع الكلمة" }).getByRole("button");
  await expect(pos).toHaveCount(c.facets.pos.length + 1);
  const p = c.facets.pos[c.facets.pos.length - 1];
  await pos.nth(c.facets.pos.length).click();
  await expect(page).toHaveURL(new RegExp(`pos=${p.tag}`));
  await expect(page.locator(".conc-filters .mono")).toContainText(hits(p.n));
  await pos.first().click();
  const j = c.facets.juz[2];
  await page.locator(".conc-subbar select").nth(1).selectOption(String(j.juz));
  await expect(page).toHaveURL(new RegExp(`juz=${j.juz}`));
  await expect(page.locator(".conc-filters .mono")).toContainText(hits(j.n));
});

test("concordance: a form in the distribution and a collocate each filter the lines, and can be removed (CON-23/24, CON-Q05)", async ({ page }) => {
  const d = await api<Dist>(page, `/concordance/distribution?root=${ILM}`);
  const f = d.forms[1];
  await page.goto("/concordance?view=dist");
  await page.locator(".conc-pane").nth(1).locator("button.dist-row").nth(1).click();
  await expect(page).not.toHaveURL(/view=dist/);
  await expect(page).toHaveURL(new RegExp(`form=${encodeURIComponent(f.form)}`));
  await expect(rows(page)).toHaveCount(Math.min(60, f.n));
  await page.getByRole("button", { name: /^الصيغة: .* — إزالة$/ }).click();
  await expect(page).not.toHaveURL(/form=/);

  const col = d.collocates[0];
  const near = await api<Page_>(page, `/concordance?root=${ILM}&near=${col.slug}&limit=1`);
  await page.getByRole("group", { name: "طريقة العرض" }).getByRole("button", { name: "التوزيع" }).click();
  await page.locator(".conc-pane").nth(1).getByRole("button", { name: col.ar, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`near=${col.slug}`));
  await expect(rows(page)).toHaveCount(Math.min(60, near.total));
  // a shared link names the nearby word too
  await page.reload();
  await expect(page.getByRole("button", { name: `بجوار: ${near.filters.near_ar} — إزالة` })).toBeVisible();
});

test("concordance: the root index lists a letter's roots with their counts and opens one (P4.2)", async ({ page }) => {
  const sad = await api<{ data: { key: string; spaced: string; occurrences: number }[] }>(page, `/roots?l1=${encodeURIComponent("ص")}&order=alphabetical&limit=500`);
  await page.goto("/concordance");
  await page.getByRole("button", { name: "فهرس الجذور" }).click();
  await page.getByRole("group", { name: "الحرف الأول" }).getByRole("button", { name: "ص", exact: true }).click();
  const list = page.locator(".conc-index-list button");
  await expect(list).toHaveCount(sad.data.length);
  const r = sad.data[3];
  await expect(list.nth(3)).toContainText(ar(r.occurrences));
  await list.nth(3).click();
  await expect(page.locator(".conc-index")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`root=${encodeURIComponent(r.key)}`));
  await expect(page.locator(".conc-filters .mono")).toContainText(hits(r.occurrences));
});

test("concordance: with no root in the address, the root the reader was last on opens (CON-05)", async ({ page }) => {
  const trail = [{ kind: "verse", id: "1:1", ts: 1 }, { kind: "word", id: "rahma", ts: 2 }];
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), { ...RETURNING, state: { ...RETURNING.state, trail } });
  await page.goto("/concordance");
  await expect(page.getByRole("button", { name: "ر ح م" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/root=%D8%B1%D8%AD%D9%85/);
});

test("concordance: the distribution can follow the order of revelation (CON-Q04)", async ({ page }) => {
  const d = await api<Dist>(page, `/concordance/distribution?root=${ILM}`);
  const byRev = [...d.per_surah].sort((a, b) => a.revelation_order - b.revelation_order);
  await page.goto("/concordance?view=dist");
  await page.getByRole("group", { name: "ترتيب السور" }).getByRole("button", { name: "النزول" }).click();
  await expect(page.locator(".conc-pane").first().locator("button.dist-row").first()).toContainText(`${ar(byRev[0].surah)}.`);
  await expect(page.locator(".conc-pane").first()).toContainText(`من ١١٤`);
});

test("concordance (English): each line's tooltip is its verse in the reader's translation, with the work credited (CON-08)", async ({ page }) => {
  const c = await api<Page_>(page, `/concordance?root=${ILM}&limit=2&tr=saheeh`);
  await page.goto("/en/concordance");
  await expect(rows(page).first()).toHaveAttribute("title", c.data[0].translation!);
  await expect(page.locator(".conc-kwic")).toContainText(`Line tooltips from ${c.translation!.title_en}`);
});

