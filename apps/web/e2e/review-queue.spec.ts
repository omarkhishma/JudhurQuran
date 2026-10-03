import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { followSignInLink } from "./helpers";

/**
 * The review queue's paths beyond journey D (P7.5, audit 12 F1, F2, F3, F4, F8, F17, F27, F29): a note belongs to its
 * proposal, a decision moves on and says so, a meaning sent back for a source is revised with one and approved,
 * withdraw and revert ask twice, a report reaches the board, the Notebook proposes, and a draft the queue refuses
 * keeps its reason. Real accounts through the development outbox; roles given by the command the runbook names.
 */

const ROOT = path.resolve(__dirname, "../../..");
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://jadhr:jadhr@127.0.0.1:5442/jadhr";
const tag = () => `${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const role = (email: string, r: string) => execFileSync("uv", ["run", "python", "-m", "jadhr_api.roles", email, r, "e2e review queue"], { cwd: ROOT, stdio: "pipe" });

function clean(t: string) {
  const psql = process.env.E2E_PSQL ?? (existsSync("/opt/homebrew/opt/postgresql@17/bin/psql") ? "/opt/homebrew/opt/postgresql@17/bin/psql" : "psql");
  const own = `select id from contributions.proposals where text like '%${t}'`;
  try {
    execFileSync(psql, [DB, "-q", "-c", `delete from contributions.changelog where merge_id in (select id from contributions.merges where proposal_id in (${own})); delete from contributions.merges where proposal_id in (${own}); delete from contributions.proposals where text like '%${t}';`], { stdio: "pipe" });
  } catch {
    /* psql not on the PATH: the rows stay in the development database */
  }
}

type Person = { page: Page; h: Record<string, string>; email: string };

async function person(browser: Browser, email: string, r?: string): Promise<Person> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
  });
  await page.request.post("/api/v1/auth/email", { data: { email, return_to: "/review", locale: "ar" } });
  let link = "";
  await expect
    .poll(async () => {
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      return (link = m.at(-1)?.link ?? "");
    })
    .not.toBe("");
  const u = new URL(link);
  await followSignInLink(page, u.pathname + u.search);
  await expect(page).toHaveURL(/\/review/);
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  if (r) role(email, r);
  return { page, h, email };
}

async function drop(p: Person) {
  const c = (await (await p.page.request.post("/api/v1/me/delete", { headers: p.h })).json().catch(() => ({}))) as { confirm?: string };
  if (c.confirm) await p.page.request.post("/api/v1/me/delete/confirm", { headers: p.h, data: { confirm: c.confirm } });
  await p.page.context().close();
}

const GLOSS_AT = "2:32:4";
const propose = async (p: Person, body: Record<string, unknown>) => {
  const r = await p.page.request.post("/api/v1/proposals", { headers: p.h, data: body });
  expect(r.status(), await r.text()).toBe(201);
  return ((await r.json()) as { id: string }).id;
};
const gloss = (text: string) => ({ kind: "gloss", lemma: "ilm", location: GLOSS_AT, text, why: "al-Rāghib", sources: [{ work: "mufradat", ref: "ع ل م" }] });
const decide = (p: Person, id: string, decision: string, note = "") => p.page.request.post(`/api/v1/proposals/${id}/decisions`, { headers: p.h, data: { decision, note } });

test("a note belongs to its proposal, and a decision moves on, says so and keeps focus (F1, F2, F27)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in desktop windows");
  test.setTimeout(120_000);
  const t = tag();
  const a = await person(browser, `e2e-q-a-${t}@example.org`);
  const r = await person(browser, `e2e-q-r-${t}@example.org`, "reviewer");
  try {
    const one = await propose(a, gloss(`first ${t}`));
    const two = await propose(a, gloss(`second ${t}`));
    await r.page.goto(`/review?id=${one}`);
    const note = r.page.getByRole("textbox", { name: "ملاحظتك لصاحب المقترح" });
    await note.fill("لهذا المقترح وحده");
    // another proposal: the note stays with the first
    await r.page.goto(`/review?id=${two}`);
    await r.page.goto(`/review?id=${one}`);
    await expect(note).toHaveValue("");
    await note.fill("لهذا المقترح وحده");
    await r.page.locator(".queue-row").filter({ hasNot: r.page.locator("[aria-current=true]") }).first().click();
    await expect(r.page.getByRole("textbox", { name: "ملاحظتك لصاحب المقترح" })).toHaveValue("");
    // approving: said, and focus on the proposal now shown
    await r.page.goto(`/review?id=${two}`);
    await r.page.getByRole("button", { name: /^وافق \(/ }).click();
    await expect(r.page.locator(".queue-screen [role=status]").first()).toContainText("وُوفق عليه");
    await expect.poll(() => r.page.evaluate(() => document.activeElement?.id)).toBe("proposal-title");
  } finally {
    clean(t);
    await drop(a);
    await drop(r);
  }
});

test("a meaning sent back for a source is revised with one and approved; withdraw and revert ask twice; a report reaches the board (F3, F4, F5, F8)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in desktop windows");
  test.setTimeout(150_000);
  const t = tag();
  const a = await person(browser, `e2e-q-a-${t}@example.org`);
  const r = await person(browser, `e2e-q-r-${t}@example.org`, "reviewer");
  const e = await person(browser, `e2e-q-e-${t}@example.org`, "editor");
  try {
    // a new sense with no source: sent back, revised with a lexicon and its entry, approved
    const sense = await propose(a, { kind: "sense", lemma: "ilm", text: `the knowing of a thing ${t}`, why: "Lisān", sources: [] });
    expect((await decide(e, sense, "changes", "اذكر المصدر")).status()).toBe(200);
    await a.page.goto(`/review?filter=mine&id=${sense}`);
    const form = a.page.locator("form").filter({ hasText: "طُلب تعديل مقترحك" });
    await form.getByRole("button", { name: "لسان العرب" }).click();
    await form.getByRole("textbox", { name: "المادة أو الصفحة في لسان العرب" }).fill("ع ل م");
    await form.getByRole("button", { name: "أعده إلى المراجعة" }).click();
    await expect(a.page.locator(".queue-screen [role=status]").first()).toContainText("أُعيد إلى المراجعة");
    expect((await decide(r, sense, "approve")).status()).toBe(200);
    expect(((await (await decide(e, sense, "approve")).json()) as { status: string }).status).toBe("merged");

    // revert asks twice, and the proposal leaves Merged for the settled ones
    await e.page.goto(`/review?filter=merged&id=${sense}`);
    await e.page.getByRole("button", { name: "ردّ الاعتماد", exact: true }).click();
    await e.page.getByRole("button", { name: "ردّ الاعتماد نهائيًا" }).click();
    await e.page.goto(`/review?filter=declined&id=${sense}`);
    await expect(e.page.locator(".settled-banner.is-merged")).toContainText("اعتُمد ثم ردّته هيئة التحرير");

    // a report: sent by a reviewer, read and dismissed by the board
    const reported = await propose(a, gloss(`reported ${t}`));
    await r.page.goto(`/review?id=${reported}`);
    await r.page.getByRole("button", { name: "أبلغ المحرّرين" }).click();
    await r.page.getByRole("textbox", { name: "ما المشكلة؟" }).fill("مكرر");
    await r.page.getByRole("button", { name: "أرسل", exact: true }).click();
    await expect(r.page.getByText("وصل البلاغ إلى هيئة التحرير، وهي تقرأ كل بلاغ.")).toBeVisible();
    await e.page.goto(`/review?id=${reported}`);
    const reports = e.page.getByRole("region", { name: "بلاغ واحد" });
    await reports.getByRole("button", { name: "اصرف النظر عن البلاغ «مكرر»" }).click();
    await expect(reports).toContainText("صُرف النظر عنه");

    // withdraw asks twice
    await a.page.goto(`/review?filter=mine&id=${reported}`);
    await a.page.getByRole("button", { name: "اسحب المقترح" }).click();
    await a.page.getByRole("button", { name: "اسحبه نهائيًا" }).click();
    await a.page.goto(`/review?filter=declined&id=${reported}`);
    await expect(a.page.locator(".settled-banner")).toContainText("سحبه صاحبه");
  } finally {
    clean(t);
    await drop(a);
    await drop(r);
    await drop(e);
  }
});

test("the Notebook proposes from a note, and a draft the queue refuses keeps its reason (NTB-22, RVQ-Q02; F17)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the note's propose dialog on desktop");
  test.setTimeout(120_000);
  const t = tag();
  const a = await person(browser, `e2e-q-a-${t}@example.org`);
  try {
    // a note that mentions a word, proposed as a new sense
    await a.page.evaluate((body) => {
      localStorage.setItem("jadhr-notebook", JSON.stringify({ state: { notes: [{ id: "n1", title: "عن العلم", body, tags: [], created: 1, updated: 1, links: { roots: [], verses: [], words: ["ilm"] } }] }, version: 1 }));
    }, `@عِلْم: the grasp of a thing ${t}`);
    await a.page.goto("/notebook#note=n1");
    await a.page.getByRole("button", { name: /^اقترح على/ }).first().click();
    const form = a.page.getByRole("dialog");
    await form.getByRole("textbox", { name: /السبب والمصدر/ }).fill("al-Rāghib");
    await form.getByRole("button", { name: "المفردات في غريب القرآن" }).click();
    await form.getByRole("textbox", { name: "المادة أو الصفحة في المفردات في غريب القرآن" }).fill("ع ل م");
    await form.getByRole("button", { name: "أرسل للمراجعة" }).click();
    await expect(form.getByRole("status")).toContainText("أُرسل إلى المراجعة");
    const mine = ((await (await a.page.request.get("/api/v1/me/proposals", { headers: a.h })).json()) as { data: { text: string; kind: string }[] }).data;
    expect(mine.some((p) => p.kind === "sense" && p.text.endsWith(t))).toBe(true);

    // a draft for a sense that is not there: refused, kept with the reason, sent again or dropped by the reader
    await a.page.evaluate((txt) => {
      const s = JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}");
      s.state.proposals = [{ id: "d1", kind: "edit", slug: "ilm", label: "عِلْم", ordinal: 99, current: "", text: txt, why: "x", sources: [], status: "pending", ts: Date.now() }];
      localStorage.setItem("jadhr-personal", JSON.stringify(s));
    }, `no such sense ${t}`);
    await a.page.goto(`/quran/2?w=ilm&at=${GLOSS_AT}`);
    const row = a.page.locator(".proposal-row").filter({ hasText: `no such sense ${t}` });
    await expect(row).toContainText("لم تقبل طلبات التعديل هذه المسودة");
    await expect(row).toContainText("لم يعد هذا المعنى موجودًا.");
    await row.getByRole("button", { name: "احذف المسودة" }).click();
    await expect(row).toHaveCount(0);
  } finally {
    clean(t);
    await drop(a);
  }
});
