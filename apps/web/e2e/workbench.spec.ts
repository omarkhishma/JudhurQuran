import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { followSignInLink } from "./helpers";

/**
 * The editorial workbench (P3.0, research 14): the board's only — a member is told what it is and who it is for;
 * an editor writes from the sources' own words, cites them, and sends the work to review; another editor approves
 * it and it is in force; the author can never approve their own; verdicts on a book's rows go in batches. Real
 * accounts through the development outbox; roles given by the command the runbook names.
 */

const ROOT = path.resolve(__dirname, "../../..");
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://jadhr:jadhr@127.0.0.1:5442/jadhr";
const tag = () => `${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const role = (email: string, r: string) => execFileSync("uv", ["run", "python", "-m", "jadhr_api.roles", email, r, "e2e workbench"], { cwd: ROOT, stdio: "pipe" });

/** The test's own editorial work, removed so the reader never shows it. */
function clean(emails: string[]) {
  const psql = process.env.E2E_PSQL ?? (existsSync("/opt/homebrew/opt/postgresql@17/bin/psql") ? "/opt/homebrew/opt/postgresql@17/bin/psql" : "psql");
  const list = emails.map((e) => `'${e}'`).join(",");
  execFileSync(psql, [DB, "-q", "-c", `delete from editorial.entries where author_id in (select id from accounts.users where email in (${list}));`], { stdio: "pipe" });
}

type Person = { page: Page; h: Record<string, string>; email: string };

async function person(browser: Browser, email: string, r?: string): Promise<Person> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
  });
  await page.request.post("/api/v1/auth/email", { data: { email, return_to: "/workbench", locale: "ar" } });
  let link = "";
  await expect
    .poll(async () => {
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      return (link = m.at(-1)?.link ?? "");
    })
    .not.toBe("");
  const u = new URL(link);
  await followSignInLink(page, u.pathname + u.search);
  await expect(page).toHaveURL(/\/workbench/);
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  if (r) role(email, r);
  return { page, h, email };
}

async function drop(p: Person) {
  const c = (await (await p.page.request.post("/api/v1/me/delete", { headers: p.h })).json().catch(() => ({}))) as { confirm?: string };
  if (c.confirm) await p.page.request.post("/api/v1/me/delete/confirm", { headers: p.h, data: { confirm: c.confirm } });
  await p.page.context().close();
}

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
    expect(page.in_force.sources.map((s) => s.work)).toEqual(["corpus"]);
  } finally {
    clean([a.email, b.email]);
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
