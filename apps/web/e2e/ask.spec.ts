import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { api, expectNoHorizontalScroll } from "./helpers";

/**
 * «اسأل القرآن» (P18, PV-11, PV-12): a question read and answered from the data — every number on the page is the
 * API's, read here from the API and looked for on the page; "understood as" is changed field by field and answers
 * again; a question nothing names falls back to search by meaning and says so; English too; the hub, the search,
 * the omnibox and the reader's ask mode hand a question to it; axe in both themes and a phone's width.
 * `SHOTS=<dir>` saves the pages.
 */

type Ask = { understood: { intent: string; surah: number | null }; answer: Record<string, unknown> & { kind: string }; fallback: unknown };
const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const ask = (page: Page, qs: string) => api<Ask>(page, `/ask?${qs}`);
const shots = process.env.SHOTS;
async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/${name}-${test.info().project.name}-${theme}.png`, fullPage: true });
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}
const answer = (page: Page) => page.locator("section[data-kind]");

test("a count: the API's number with its scope and its root, read as understood; a field changed answers again (P18)", async ({ page }) => {
  const q = "كم مرة ذكرت كلمة الرحمة في سورة البقرة؟";
  const d = await ask(page, `q=${encodeURIComponent(q)}`);
  expect(d.understood).toMatchObject({ intent: "count", surah: 2 });
  await page.goto(`/ask?q=${encodeURIComponent(q)}`);
  await expect(page.getByRole("heading", { name: "اسأل القرآن", level: 1 })).toBeVisible();
  const understood = page.locator("section").filter({ has: page.getByRole("heading", { name: "فهمنا سؤالك على أنه" }) });
  await expect(understood.getByLabel("السؤال عن")).toHaveValue("count");
  await expect(understood.getByLabel("الكلمة أو الجذر")).toHaveValue("الرحمة");
  await expect(understood.getByLabel("في سورة")).toHaveValue("2");
  await expect(understood).toContainText("قرأناه بقاعدة");
  const a = answer(page);
  await expect(a).toHaveAttribute("data-kind", "count");
  await expect(a.locator(".askq-big")).toHaveText(ar(d.answer.count as number));
  const root = d.answer.root as { count: number };
  await expect(a).toContainText(ar(root.count));
  await shoot(page, "ask-count");
  // the sūra changed in the reading: the API's count for Maryam, and the address carries the reading
  const d19 = await ask(page, `q=${encodeURIComponent(q)}&intent=count&a=${encodeURIComponent("الرحمة")}&surah=19`);
  await understood.getByLabel("في سورة").selectOption("19");
  await understood.getByRole("button", { name: "أجب بهذا" }).click();
  await expect(a.locator(".askq-big")).toHaveText(ar(d19.answer.count as number));
  await expect(page).toHaveURL(/intent=count/);
  await expect(page).toHaveURL(/surah=19/);
  await expect(understood).toContainText("كما ضبطته أنت");
});

test("two words compared: each one's figures and its root's, their shared verses, from the API (P18)", async ({ page }) => {
  const q = "ما الفرق بين الصبر والشكر";
  const d = await ask(page, `q=${encodeURIComponent(q)}`);
  const c = d.answer.counts as { a: { n: number; root: { n: number } }; b: { n: number; root: { n: number } } };
  await page.goto(`/ask?q=${encodeURIComponent(q)}`);
  const table = answer(page).locator("table");
  await expect(table.locator("tr").filter({ hasText: "مرات الورود" })).toContainText(ar(c.a.n));
  await expect(table.locator("tr").filter({ hasText: "مرات ورود جذرها" })).toContainText(ar(c.a.root.n));
  await expect(table.locator("tr").filter({ hasText: "مرات ورود جذرها" })).toContainText(ar(c.b.root.n));
  await shoot(page, "ask-compare");
});

test("where, distribution, meaning, a sūra and a superlative answer from their tables (P18)", async ({ page }) => {
  const where = await ask(page, `q=${encodeURIComponent("أين ذكر موسى")}`);
  await page.goto(`/ask?q=${encodeURIComponent("أين ذكر موسى")}`);
  await expect(answer(page)).toHaveAttribute("data-kind", "where");
  const surahs = where.answer.surahs as { surah: number; count: number }[];
  await expect(answer(page).locator(".bar-row").first()).toContainText(ar(surahs[0].count));
  await page.goto(`/ask?q=${encodeURIComponent("توزيع كلمة الجنة")}`);
  await expect(answer(page).locator("#ask-dist-t").locator("xpath=ancestor::figure").locator("svg path[fill]")).toHaveCount(114);
  const meaning = await ask(page, `q=${encodeURIComponent("ما معنى الصمد")}`);
  await page.goto(`/ask?q=${encodeURIComponent("ما معنى الصمد")}`);
  const g = (meaning.answer.gharib as { meaning_ar: string; title_ar: string }[])[0];
  await expect(answer(page)).toContainText(g.meaning_ar.slice(0, 30));
  await expect(answer(page)).toContainText(g.title_ar);
  const surah = await ask(page, `q=${encodeURIComponent("كم آية في سورة الكهف")}`);
  await page.goto(`/ask?q=${encodeURIComponent("كم آية في سورة الكهف")}`);
  await expect(answer(page).locator(".askq-big")).toHaveText(ar((surah.answer.surah as { verses: number }).verses));
  await page.goto(`/ask?q=${encodeURIComponent("ما أطول سورة")}`);
  await expect(answer(page)).toContainText("سورة البقرة");
});

test("a theme is searched by meaning, credited as computed; a word nothing names falls back to it (P18)", async ({ page }) => {
  const d = await ask(page, `q=${encodeURIComponent("ماذا قال القرآن عن اليتيم")}`);
  const first = (d.answer.semantic as { items: { verse: { key: string } }[] }).items[0].verse.key;
  await page.goto(`/ask?q=${encodeURIComponent("ماذا قال القرآن عن اليتيم")}`);
  await expect(answer(page)).toHaveAttribute("data-kind", "theme");
  await expect(answer(page)).toContainText("ترتيب يحسبه نموذج لغوي مفتوح على خادمنا");
  await expect(answer(page).locator("li").first()).toContainText(ar(Number(first.split(":")[1])));
  await page.goto(`/ask?q=${encodeURIComponent("كم مرة ذكرت كلمة زقزقة")}`);
  await expect(answer(page)).toHaveAttribute("data-kind", "unresolved");
  await expect(answer(page)).toContainText("لم نجد في القرآن كلمة أو جذرًا باسم «زقزقة»");
  await expect(page.getByRole("heading", { name: "وهذا ما وجده البحث بالمعنى في سؤالك" })).toBeVisible();
});

test("in English: the question read and the API's count, the page in English (P18)", async ({ page }) => {
  const q = "How many times is Moses mentioned?";
  const d = await ask(page, `q=${encodeURIComponent(q)}`);
  await page.goto(`/en/ask?q=${encodeURIComponent(q)}`);
  await expect(page.getByRole("heading", { name: "Ask the Quran", level: 1 })).toBeVisible();
  await expect(answer(page).locator(".askq-big")).toHaveText(String(d.answer.count));
  await expect(answer(page)).toContainText("in the Quran");
});

test("an example asks itself; the hub, the search page and the reader hand a question to the page (P18)", async ({ page, isMobile }) => {
  await page.goto("/ask");
  await page.getByRole("button", { name: "ما معنى الصمد؟" }).click();
  await expect(answer(page)).toHaveAttribute("data-kind", "meaning");
  await expect(page).toHaveURL(/\/ask\?q=/);
  // the hub's box: a question goes here, a word to the search
  await page.goto("/");
  const box = page.getByRole("search", { name: "ابحث في القرآن" }).getByRole("textbox");
  await box.fill("كم مرة ذكرت كلمة الجنة؟");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/ask\?q=/);
  await expect(answer(page)).toHaveAttribute("data-kind", "count");
  // the search page says a question is one, and leads here
  await page.goto(`/search?q=${encodeURIComponent("كم مرة ذكرت كلمة الجنة")}`);
  await page.getByRole("note").getByRole("link", { name: "اسأل القرآن" }).click();
  await expect(page).toHaveURL(/\/ask\?q=/);
  // the reader's ask mode: a question rather than a word
  await page.goto(`/read?mode=ask&q=${encodeURIComponent("ما الفرق بين الصبر والشكر")}`);
  // the address's question is in the box (it was lost to the reader's own address before)
  await expect(page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" })).toHaveValue("ما الفرق بين الصبر والشكر");
  await page.getByRole("link", { name: "اسأل القرآن سؤالك كله" }).click();
  await expect(answer(page)).toHaveAttribute("data-kind", "compare");
  if (!isMobile) {
    await page.goto("/hadith");
    await page.locator("header").getByRole("button", { name: "بحث", exact: true }).click();
    await page.getByRole("combobox", { name: /اكتب كلمة أو جذرًا/ }).fill("ما معنى الصمد؟");
    await page.getByRole("option").filter({ hasText: "اسأل القرآن" }).first().click();
    await expect(page).toHaveURL(/\/ask\?q=/);
  }
});

test("the page passes axe in both themes and fits a phone (P18)", async ({ page, isMobile }) => {
  for (const q of ["", "كم مرة ذكرت كلمة الرحمة في سورة البقرة", "ما الفرق بين الصبر والشكر", "توزيع كلمة الجنة"]) {
    await page.goto(`/ask${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    await page.getByRole("heading", { name: "اسأل القرآن", level: 1 }).waitFor();
    if (q) await answer(page).waitFor();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
      await page.waitForTimeout(200);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${theme} ${q} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    }
    if (isMobile) await expectNoHorizontalScroll(page);
  }
});
