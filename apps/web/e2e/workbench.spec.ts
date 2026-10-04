import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clean, drop, expire, person, tag } from "./board";

/**
 * The editorial workbench (P3.0, research 14): the board's only — a member is told what it is and who it is for;
 * an editor writes from the sources' own words, cites them, and sends the work to review; another editor approves
 * it and it is in force; the author can never approve their own; verdicts on a book's rows go in batches. Real
 * accounts through the development outbox; roles given by the command the runbook names.
 */

test("the workbench is the board's: signed out it asks for a sign-in, a member is told what it is and who it is for (P3.0)", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "the accounts are made in desktop windows");
  await page.goto("/workbench");
  await expect(page.getByRole("heading", { name: "منصة التحرير" })).toBeVisible();
  await expect(page.getByText("هذه المنصة لهيئة التحرير. ادخل بحسابك إن كنت منها.")).toBeVisible();
  const m = await person(browser, `e2e-wb-m-${tag()}@example.org`);
  try {
    await m.page.goto("/workbench");
    await expect(m.page.getByText(/هذه المنصة لهيئة التحرير المعيَّنة وحدها/)).toBeVisible();
    expect((await m.page.request.get("/api/v1/editorial/worklists", { headers: m.h })).status()).toBe(403);
  } finally {
    await drop(m);
  }
});

test("an editor writes from the sources and sends it to review; another approves and it is in force; the author never approves their own (P3.0)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(120_000);
  const t = tag();
  const a = await person(browser, `e2e-wb-a-${t}@example.org`, "editor");
  const b = await person(browser, `e2e-wb-b-${t}@example.org`, "editor");
  try {
    // a little-used root whose words the corpus glosses, so the test's gloss is never the one a reader meets
    const list = (await (await a.page.request.get("/api/v1/editorial/root_gloss?state=todo&offset=1000&limit=40", { headers: a.h })).json()) as { data: { key: string; label: string }[] };
    let root = list.data[0];
    for (const r of list.data) {
      const e = (await (await a.page.request.get(`/api/v1/editorial/root_gloss/${encodeURIComponent(r.key)}`, { headers: a.h })).json()) as { candidates: { word_glosses: unknown[] } };
      if (e.candidates.word_glosses.length) {
        root = r;
        break;
      }
    }
    await a.page.goto(`/workbench?kind=root_gloss&target=${encodeURIComponent(root.key)}`);
    await expect(a.page.getByRole("heading", { name: root.label })).toBeVisible();
    // the sources' candidates: the corpus's glosses of the root's words, each with its count, used in one click
    const used = a.page.locator(".cand").filter({ hasText: "معاني كلمات الجذر في المدونة القرآنية" });
    await expect(used).toBeVisible();
    const first = used.locator("li").first();
    const gloss = (await first.locator('[lang="en"]').innerText()).trim();
    await first.getByRole("button", { name: "استعمل" }).click();
    await expect(a.page.getByRole("textbox", { name: "المعنى بالإنجليزية" })).toHaveValue(gloss);
    await a.page.getByRole("button", { name: "احفظ المسودة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "حُفظت المسودة." })).toBeVisible();
    await a.page.getByRole("button", { name: "أرسل إلى المراجعة" }).click();
    await expect(a.page.getByText("تنتظر محررًا آخر: لا يعتمد المؤلف عمله.")).toBeVisible();
    await expect(a.page.getByRole("button", { name: "اعتمد", exact: true })).toHaveCount(0);

    // the other editor: it waits on them, they approve, and it is in force
    await b.page.goto("/workbench?kind=verdict");
    await b.page.locator(".workbench-row").filter({ hasText: root.key }).click();
    await b.page.getByRole("button", { name: "اعتمد", exact: true }).click();
    await expect(b.page.getByRole("status").filter({ hasText: "اعتُمدت وصارت سارية." })).toBeVisible();
    await expect(b.page.getByRole("region", { name: "السّاري" })).toContainText(gloss);
    const page = (await (await b.page.request.get(`/api/v1/editorial/root_gloss/${encodeURIComponent(root.key)}`, { headers: b.h })).json()) as { in_force: { value: { en: string }; sources: { work: string }[] } };
    expect(page.in_force.value.en).toBe(gloss);
    expect(page.in_force.sources.map((s) => s.work)).toEqual(["qac-wbw"]);
  } finally {
    clean([a.email, b.email]);
    await expire(a.page);
    await drop(a);
    await drop(b);
  }
});

test("verdicts on a book's rows go to review in a batch, and another editor approves the batch (P3.0)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(120_000);
  const t = tag();
  const a = await person(browser, `e2e-wb-c-${t}@example.org`, "editor");
  const b = await person(browser, `e2e-wb-d-${t}@example.org`, "editor");
  try {
    await a.page.goto("/workbench?kind=verdict&layer=loanword_links&state=todo");
    const rows = a.page.locator(".workbench-box").filter({ has: a.page.getByRole("radiogroup") });
    await expect(rows.first()).toBeVisible();
    await rows.nth(0).getByRole("radio", { name: "رُوجع" }).click();
    await rows.nth(1).getByRole("radio", { name: "رُفض" }).click();
    await expect(a.page.getByText("حكم واحد جاهز")).toBeVisible();
    await rows.nth(1).getByRole("textbox", { name: "لماذا؟" }).fill("الربط بصيغة لا ترد في الموضع");
    await expect(a.page.getByText("حكمان جاهزان")).toBeVisible();
    await a.page.getByRole("button", { name: "أرسلها إلى المراجعة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "أُرسل حكمان إلى المراجعة" })).toBeVisible();

    await b.page.goto("/workbench?kind=verdict&layer=loanword_links");
    await expect(b.page.getByText("حكمان من محرر آخر ينتظران قرارك")).toBeVisible();
    await b.page.getByRole("button", { name: "اعتمدها كلها" }).click();
    await expect(b.page.getByRole("status").filter({ hasText: "اعتُمد حكمان" })).toBeVisible();
    const done = (await (await b.page.request.get("/api/v1/editorial/verdict?layer=loanword_links&state=approved&limit=200", { headers: b.h })).json()) as { total: number };
    expect(done.total).toBeGreaterThanOrEqual(2);
  } finally {
    clean([a.email, b.email]);
    await expire(a.page);
    await drop(a);
    await drop(b);
  }
});

test("the workbench's pages pass axe in both themes: a worklist, a target with its sources, a book's rows (P3.0)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "an account made in a desktop window");
  test.setTimeout(120_000);
  const e = await person(browser, `e2e-wb-x-${tag()}@example.org`, "editor");
  try {
    for (const theme of ["light", "dark"]) {
      await e.page.evaluate((th) => localStorage.setItem("jadhr-theme", th), theme);
      for (const [path, ready] of [
        ["/workbench?kind=root_gloss", ".workbench-row"],
        ["/workbench?kind=sense_list&target=ilm", ".cand"],
        ["/workbench?kind=verdict&layer=particle_entries", ".workbench-box"],
      ] as const) {
        await e.page.goto(path);
        await e.page.locator(ready).first().waitFor();
        await e.page.waitForTimeout(300);
        const results = await new AxeBuilder({ page: e.page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${theme} ${path} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      }
    }
  } finally {
    await drop(e);
  }
});

test("what the board approves is shown beside the sources: a root's English gloss on its page, credited to the board, and a book's row marked reviewed (P3.0c)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(120_000);
  const t = tag();
  const a = await person(browser, `e2e-wb-e-${t}@example.org`, "editor");
  const b = await person(browser, `e2e-wb-f-${t}@example.org`, "editor");
  const approve = async (kind: string, target: string, value: unknown, sources: unknown[] = []) => {
    const e = (await (await a.page.request.put(`/api/v1/editorial/${kind}/${encodeURIComponent(target)}`, { headers: a.h, data: { value, sources } })).json()) as { id: string };
    await a.page.request.post(`/api/v1/editorial/entries/${e.id}/submit`, { headers: a.h });
    const r = await b.page.request.post(`/api/v1/editorial/entries/${e.id}/decide`, { headers: b.h, data: { decision: "approve" } });
    expect(r.status()).toBe(200);
  };
  try {
    // a little-used root no other test opens, so its page is rendered afresh
    const list = (await (await a.page.request.get("/api/v1/editorial/root_gloss?state=todo&offset=1300&limit=1", { headers: a.h })).json()) as { data: { key: string }[] };
    const root = list.data[0].key;
    await approve("root_gloss", root, { en: `a board gloss ${t}` }, [{ work: "lane", ref: "1:1" }]);
    await expire(a.page);
    const page = await (await browser.newContext()).newPage();
    await page.goto(`/roots/${encodeURIComponent(root)}`);
    await expect(page.getByText(`a board gloss ${t}`)).toBeVisible();
    // credited to the board, and the cited work named by its title, not its id
    await expect(page.getByText("المعنى بالإنجليزية من هيئة التحرير، عن معجم لين العربي الإنجليزي 1:1")).toBeVisible();
    await page.context().close();
    // a verdict on a sarf book's row reaches the pattern's page: the row marked, the source's words kept
    const pat = (await (await a.page.request.get("/api/v1/patterns/fa3ala")).json()) as { classical: { rows: { id: string; text_ar: string }[] } };
    if (pat.classical.rows.length) {
      const row = pat.classical.rows[0];
      await approve("verdict", `pattern_functions:${row.id}`, { verdict: "reviewed" });
      const after = (await (await a.page.request.get("/api/v1/patterns/fa3ala")).json()) as { classical: { rows: { id: string; text_ar: string; review?: { verdict: string } }[] } };
      const same = after.classical.rows.find((r) => r.id === row.id)!;
      expect(same.review?.verdict).toBe("reviewed");
      expect(same.text_ar).toBe(row.text_ar);
    }
  } finally {
    clean([a.email, b.email]);
    await expire(a.page);
    await drop(a);
    await drop(b);
  }
});

test("a relation from al-Furūq: its two words and their roots shown, one mapped anew as the board's correction, approved by another editor, in force on the new root and marked in the reader (P8.4a)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(120_000);
  const t = tag();
  const a = await person(browser, `e2e-wb-g-${t}@example.org`, "editor");
  const b = await person(browser, `e2e-wb-h-${t}@example.org`, "editor");
  try {
    await a.page.goto(`/workbench?kind=verdict&layer=relation_candidates&state=todo&q=${encodeURIComponent("يوجب المعرفة بالمحدود")}`);
    const row = a.page.locator(".workbench-box").filter({ hasText: "askari-furuq:0006:r" });
    await expect(row).toContainText("فرق");
    await expect(row).toContainText("س م و");
    await expect(row).toContainText("ح د د");
    await row.getByRole("radio", { name: "صُحّح" }).click();
    await row.getByRole("textbox", { name: "لماذا؟" }).fill("الحد هنا من المعرفة، لا من المنع");
    await row.getByRole("textbox", { name: "جذر «الحد»" }).fill("ع ر ف");
    await expect(a.page.getByText("حكم واحد جاهز")).toBeVisible();
    await a.page.getByRole("button", { name: "أرسلها إلى المراجعة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "أُرسل حكم واحد إلى المراجعة" })).toBeVisible();
    // another editor approves; the relation is in force between the first word's root and the root it was mapped to
    await b.page.goto("/workbench?kind=verdict&layer=relation_candidates");
    await b.page.getByRole("button", { name: "اعتمدها كلها" }).click();
    await expect(b.page.getByRole("status").filter({ hasText: "اعتُمد حكم واحد" })).toBeVisible();
    const on = (await (await b.page.request.get(`/api/v1/roots/${encodeURIComponent("عرف")}/relations`)).json()) as { data: { id: string; a: { root: string }; b: { root: string } }[] };
    expect(on.data.map((e) => [e.id, e.a.root, e.b.root])).toEqual([["askari-furuq:0006:r", "سمو", "عرف"]]);
    // the reader: the passage under al-Furūq on a word of the new root, marked as the board's correction
    const fam = (await (await b.page.request.get(`/api/v1/roots/${encodeURIComponent("عرف")}/family`)).json()) as { family: { members: { slug: string }[] }[] };
    const slug = fam.family.flatMap((g) => g.members)[0].slug;
    const at = ((await (await b.page.request.get(`/api/v1/words/${slug}/verses?limit=1`)).json()) as { data: { locations: string[] }[] }).data[0].locations[0];
    await expire(b.page);
    const reader = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await reader.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
    await reader.goto(`/word/${at}`);
    const passage = reader.locator(".wujuh-sense").filter({ hasText: "يوجب المعرفة بالمحدود" });
    await expect(passage.locator(".board-mark")).toContainText("صحّحته هيئة التحرير");
    await expect(passage.locator(".board-mark")).toContainText("الحد هنا من المعرفة");
    await reader.context().close();
  } finally {
    clean([a.email, b.email]);
    await expire(a.page);
    await drop(a);
    await drop(b);
  }
});
