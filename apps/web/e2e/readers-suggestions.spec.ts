import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clean, drop, expire, person, sql, tag } from "./board";
import { ar } from "./helpers";

/**
 * Readers' suggestions as the board's candidates (B38): a sense a reader proposed and two reviewers, one of the board,
 * merged reaches the workbench — the word listed among those whose suggestions wait, the suggestion beside the word's
 * sense list with its words, sources and credit — and the editor takes it into the list in their own words; once
 * another editor approves, the word's page credits the reader on the board's sense and does not show the suggestion
 * again. Real accounts through the development outbox; the test's proposals and work are removed afterwards.
 */

test("a reader's merged suggestion reaches the board, is taken into the sense list, and the reader is credited (B38)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in desktop windows; the word's page is read at 390 px in the screenshots");
  test.setTimeout(150_000);
  const t = tag();
  const m = await person(browser, `e2e-b38-m-${t}@example.org`);
  const a = await person(browser, `e2e-b38-a-${t}@example.org`, "editor");
  const b = await person(browser, `e2e-b38-b-${t}@example.org`, "editor");
  const name = `قارئ ${t.slice(-4)}`;
  let pid = "";
  try {
    await m.page.request.patch("/api/v1/me", { headers: m.h, data: { display_name: name } });
    // a word with no list yet, little used, so no other test's word
    const list = (await (await a.page.request.get("/api/v1/editorial/sense_list?state=todo&offset=2700&limit=1", { headers: a.h })).json()) as { data: { key: string; label: string }[] };
    const word = list.data[0];
    const said = "معنى اقترحه قارئ في الاختبار";
    const p = await m.page.request.post("/api/v1/proposals", { headers: m.h, data: { kind: "sense", lemma: word.key, text: said, why: "من سياق الآيات", sources: [{ work: "mufradat", ref: "123" }] } });
    expect(p.status()).toBe(201);
    pid = ((await p.json()) as { id: string }).id;
    for (const who of [a, b]) await who.page.request.post(`/api/v1/proposals/${pid}/decisions`, { headers: who.h, data: { decision: "approve" } });

    // the board: the word among those whose readers' suggestions wait, the suggestion beside its list
    await a.page.goto("/workbench?kind=sense_list&readers=1");
    await expect(a.page.getByRole("button", { name: /ما ينتظر من اقتراحات القراء/ })).toHaveAttribute("aria-pressed", "true");
    const row = a.page.locator(".workbench-row").filter({ hasText: word.label });
    await expect(row).toContainText(`اقتراحات القراء: ${ar(1)}`);
    await row.click();
    const cands = a.page.getByRole("region", { name: "اقتراحات القراء التي قبلها المراجعون" });
    await expect(cands).toContainText(said);
    await expect(cands).toContainText("ينتظر الهيئة");
    await expect(cands).toContainText(name);
    await expect(cands).toContainText("سببه: من سياق الآيات");
    await expect(cands).toContainText("المفردات");
    const results = await new AxeBuilder({ page: a.page }).include(".workbench-main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    // taken into the list, then written in the board's words
    await cands.getByRole("button", { name: "خذه معنى في القائمة" }).click();
    const sense = a.page.locator("fieldset").filter({ hasText: "مأخوذ من اقتراح قارئ" });
    await expect(sense.getByRole("textbox", { name: "بالعربية" })).toHaveValue(said);
    const board = "معنى كتبته الهيئة من اقتراح القارئ";
    await sense.getByRole("textbox", { name: "بالعربية" }).fill(board);
    await a.page.getByRole("button", { name: "احفظ المسودة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "حُفظت المسودة." })).toBeVisible();
    await a.page.getByRole("button", { name: "أرسل إلى المراجعة" }).click();
    const open = ((await (await b.page.request.get(`/api/v1/editorial/sense_list/${encodeURIComponent(word.key)}`, { headers: b.h })).json()) as { open: { id: string } }).open;
    const r = await b.page.request.post(`/api/v1/editorial/entries/${open.id}/decide`, { headers: b.h, data: { decision: "approve" } });
    expect(((await r.json()) as { status: string }).status).toBe("approved");
    await a.page.reload();
    await expect(cands).toContainText("أخذته القائمة السارية");

    // the reader: the board's sense, credited to the reader; the suggestion not shown again beside it
    await expire(b.page);
    const at = ((await (await b.page.request.get(`/api/v1/words/${word.key}/verses?limit=1`)).json()) as { data: { locations: string[] }[] }).data[0].locations[0];
    const reader = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await reader.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
    await reader.goto(`/word/${at}`);
    const senses = reader.locator('[data-section="senses"]');
    await expect(senses).toContainText(board);
    await expect(senses).toContainText(`من اقتراح ${name}`);
    await expect(senses.getByRole("link", { name: "القرارات" }).first()).toHaveAttribute("href", `/review?filter=merged&id=${pid}`);
    await expect(reader.getByText(said)).toHaveCount(0);
    await reader.context().close();
  } finally {
    if (pid) {
      for (const q of [
        `delete from contributions.changelog where merge_id in (select id from contributions.merges where proposal_id = '${pid}')`,
        `delete from contributions.merges where proposal_id = '${pid}'`,
        `delete from contributions.decisions where proposal_id = '${pid}'`,
        `delete from contributions.proposals where id = '${pid}'`,
      ])
        sql(q);
    }
    clean([a.email, b.email]);
    await expire(a.page);
    await drop(m);
    await drop(a);
    await drop(b);
  }
});
