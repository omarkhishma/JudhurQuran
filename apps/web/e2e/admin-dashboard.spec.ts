import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { clean, drop, expire, person, tag } from "./board";

/**
 * The administration's dashboard and tools (P14, D31, D32): an administrator divides a sūra into passages against the
 * sources' boundaries and publishes it at once; sets one word's own context and its meaning there with a source;
 * links a word to a near and an opposite word — each in force for readers at once, credited to the administration;
 * an editor of the board writes the same kinds but sends them to review; roles are the administrators' page. Real
 * accounts through the development outbox; roles given by the command the runbook names. `SHOTS=<dir>` also saves
 * the screens at desktop and phone width in both themes.
 */

const shots = process.env.SHOTS;
async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/${name}-${theme}.png`, fullPage: false });
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

async function context(page: Page, loc: string) {
  return (await (await page.request.get(`/api/v1/words/${loc}/context`)).json()) as { context: { level: string; from: string; to: string; by: string; reviewed: boolean } | null };
}

test("an administrator divides a sūra, sets a word's own context and links its words, each in force at once (P14)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the accounts are made in desktop windows");
  test.setTimeout(180_000);
  const t = tag();
  const a = await person(browser, `e2e-adm-${t}@example.org`, "admin");
  try {
    await a.page.goto("/workbench");
    await expect(a.page.getByRole("heading", { name: "لوحة الإدارة", level: 2 })).toBeVisible();
    await expect(a.page.locator(".dash-tile")).toHaveCount(5);
    await expect(a.page.locator(".topic-coverage .topic-cell")).toHaveCount(114);
    await shoot(a.page, "dashboard-1440");

    // a sūra's passages: sūra 112 from its coverage cell, a boundary before verse 3, published
    await a.page.locator(".topic-coverage .topic-cell").nth(111).click();
    await expect(a.page.getByRole("heading", { name: /سورة الإخلاص/ })).toBeVisible();
    await expect(a.page.locator(".passage-verse")).toHaveCount(4);
    await a.page.getByRole("button", { name: "ابدأ مقطعًا عند الآية ٣" }).click();
    await expect(a.page.getByRole("button", { name: "ألغِ بداية المقطع عند الآية ٣" })).toHaveAttribute("aria-pressed", "true");
    await a.page.getByRole("textbox", { name: "عنوان المقطع (اختياري)" }).first().fill("التوحيد");
    await shoot(a.page, "passages-1440");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();
    await expect(a.page.getByText("نافذ: نشرته إدارة جذر")).toBeVisible();
    const c3 = await context(a.page, "112:3:1");
    expect(c3.context).toMatchObject({ level: "passage", from: "112:3", to: "112:4", by: "administration", reviewed: false });
    expect((await context(a.page, "112:1:1")).context).toMatchObject({ from: "112:1", to: "112:2" });

    // a word's own context, opened by its place from the dashboard, with its meaning there resting on a source
    await a.page.goto("/workbench");
    await a.page.getByRole("textbox", { name: "موضع الكلمة أو الآية" }).fill("112:2:1");
    await a.page.getByRole("button", { name: "افتح" }).nth(1).click();
    await expect(a.page.locator("#ctxw-h")).toBeVisible();
    await expect(a.page.getByText("سياقها الآن مقطع سورتها")).toBeVisible();
    const to = a.page.getByRole("textbox", { name: "إلى" });
    await a.page.getByRole("button", { name: "إلى — آية بعدها" }).click();
    await expect(to).toHaveValue("112:3");
    await a.page.getByRole("textbox", { name: "معناها في هذا السياق (عربي، اختياري)" }).fill("نص تجريبي للاختبار");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    // a meaning written here rests on a source: refused, said in Arabic, until one is named
    await expect(a.page.getByRole("status").filter({ hasText: "اذكر المصدر الذي يستند إليه المعنى." })).toBeVisible();
    await a.page.getByRole("button", { name: "+ مصدر" }).click();
    await a.page.getByRole("combobox", { name: "العمل" }).fill("muyassar");
    await a.page.getByRole("textbox", { name: "الموضع" }).fill("112:2");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();
    await expect(a.page.locator(".ctx-word")).toHaveCount(1);
    await shoot(a.page, "word-context-1440");
    expect((await context(a.page, "112:2:1")).context).toMatchObject({ level: "word", from: "112:1", to: "112:3" });

    // a word's near and opposite words, found by search and picked from the books' candidates
    await a.page.goto("/workbench?kind=word_relations&target=ilm");
    await expect(a.page.locator("#rel-h")).toBeVisible();
    await a.page.getByRole("searchbox", { name: "ابحث عن كلمة في القرآن" }).fill("جهل");
    await a.page.getByRole("button", { name: "ابحث", exact: true }).click();
    const found = a.page.locator('[aria-live="polite"] li').first();
    await expect(found).toBeVisible();
    await found.getByRole("button", { name: "مقابلة" }).click();
    await expect(a.page.getByRole("group", { name: "نوع الربط" })).toHaveCount(1);
    await a.page.getByRole("textbox", { name: "الفرق أو وجه الصلة (اختياري)" }).fill("العلم ضد الجهل");
    await shoot(a.page, "relations-1440");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();
    const rel = (await (await a.page.request.get("/api/v1/words/ilm/relations")).json()) as { defined: { opposite: { slug: string; note_ar: string; by: string }[] } };
    expect(rel.defined.opposite).toHaveLength(1);
    expect(rel.defined.opposite[0]).toMatchObject({ note_ar: "العلم ضد الجهل", by: "administration" });
    const other = rel.defined.opposite[0].slug;
    const back = (await (await a.page.request.get(`/api/v1/words/${other}/relations`)).json()) as { defined: { opposite: { slug: string; defined_on: string }[] } };
    expect(back.defined.opposite).toEqual([expect.objectContaining({ slug: "ilm", defined_on: "there" })]);

    // the dashboard counts what was done
    await a.page.goto("/workbench");
    const ov = (await (await a.page.request.get("/api/v1/editorial/overview", { headers: a.h })).json()) as { by_surah: { surah: number; words: number; words_with_context: number }[] };
    const s112 = ov.by_surah.find((s) => s.surah === 112)!;
    expect(s112.words_with_context).toBe(s112.words);
    await expect(a.page.locator(".topic-coverage .topic-cell").nth(111)).toHaveAttribute("aria-label", /١١٢\. الإخلاص: (\S+) من \1 كلمة/);
  } finally {
    clean([a.email]);
    await expire(a.page);
    await drop(a);
  }
});

test("an editor of the board writes the administration's kinds but sends them to review; another editor reviews what the administration published (P14, D31)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the accounts are made in desktop windows");
  test.setTimeout(150_000);
  const t = tag();
  const a = await person(browser, `e2e-adm-b-${t}@example.org`, "admin");
  const e = await person(browser, `e2e-ed-b-${t}@example.org`, "editor");
  try {
    await e.page.goto("/workbench?kind=context_passages&target=113");
    await expect(e.page.locator(".passage-verse")).toHaveCount(5);
    await expect(e.page.getByRole("button", { name: "احفظ وانشر" })).toHaveCount(0);
    await e.page.getByRole("button", { name: "ابدأ مقطعًا عند الآية ٣" }).click();
    await e.page.getByRole("button", { name: "احفظ وأرسل للمراجعة" }).click();
    await expect(e.page.getByText("تنتظر محررًا آخر: لا يعتمد المؤلف عمله.")).toBeVisible();
    expect((await context(e.page, "113:3:1")).context).toBeNull();
    // the roles page is the administrators'
    await e.page.goto("/workbench?view=people");
    await expect(e.page.getByText("هذا للمشرفين وحدهم.")).toBeVisible();

    // the administration publishes sūra 114; the editor reviews it, and the reader is told so
    await a.page.goto("/workbench?kind=context_passages&target=114");
    await a.page.getByRole("button", { name: "ابدأ مقطعًا عند الآية ٤" }).click();
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();
    await e.page.goto("/workbench?kind=context_passages&target=114");
    await e.page.getByRole("button", { name: "راجعتُه" }).click();
    await expect(e.page.getByRole("status").filter({ hasText: "سُجّلت مراجعتك." })).toBeVisible();
    await expect.poll(async () => (await context(e.page, "114:5:1")).context?.reviewed, { timeout: 40_000 }).toBe(true);

    // the administrator's roles page lists the editor
    await a.page.goto("/workbench?view=people");
    await expect(a.page.getByRole("heading", { name: "الأدوار" })).toBeVisible();
    await a.page.getByRole("searchbox", { name: "ابحث بعنوان البريد" }).fill(e.email);
    await a.page.getByRole("button", { name: "ابحث", exact: true }).click();
    await expect(a.page.getByRole("combobox", { name: `دور ${e.email}` })).toHaveValue("editor");
    await shoot(a.page, "people-1440");
  } finally {
    clean([a.email, e.email]);
    await expire(a.page);
    await drop(a);
    await drop(e);
  }
});

test("the dashboard and the tools pass axe in both themes and fit a phone (P14)", async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await person(browser, `e2e-adm-x-${tag()}@example.org`, "admin");
  const phone = await person(browser, `e2e-adm-p-${tag()}@example.org`, "admin", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    for (const theme of ["light", "dark"]) {
      await a.page.evaluate((th) => localStorage.setItem("jadhr-theme", th), theme);
      for (const [path, ready] of [
        ["/workbench", ".dash-tile"],
        ["/workbench?kind=context_passages&target=103", ".passage-verse"],
        ["/workbench?kind=context_word&target=2:255:3", "#ctxw-h"],
        ["/workbench?kind=word_relations&target=ilm", "#rel-h"],
        ["/workbench?view=people", ".workbench-rows"],
      ] as const) {
        await a.page.goto(path);
        await a.page.locator(ready).first().waitFor();
        await a.page.waitForTimeout(400);
        const results = await new AxeBuilder({ page: a.page }).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${theme} ${path} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      }
    }
    for (const [path, ready, name] of [
      ["/workbench", ".dash-tile", "dashboard-390"],
      ["/workbench?kind=context_passages&target=103", ".passage-verse", "passages-390"],
      ["/workbench?kind=context_word&target=2:255:3", "#ctxw-h", "word-context-390"],
      ["/workbench?kind=word_relations&target=ilm", "#rel-h", "relations-390"],
    ] as const) {
      await phone.page.goto(path);
      await phone.page.locator(ready).first().waitFor();
      await shoot(phone.page, name);
      const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  } finally {
    await drop(a);
    await drop(phone);
  }
});
