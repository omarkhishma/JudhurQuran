import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { ar, followSignInLink } from "./helpers";

/**
 * Journey D (P7.4 exit, 06 §6.3): a reader proposes a gloss from the Reader → the queue → a reviewer approves →
 * the editorial board approves and merges → the Reader shows it beside the corpus gloss with its credit line → the
 * changelog → the contributor's Profile. Real accounts, roles given as the runbook gives them (the roles command),
 * and the rules the server and the database keep: no self-approve, the board's approval to merge. Then a proposal
 * written signed out reaches the queue once the reader signs in (RVQ-Q02).
 */

const ROOT = path.resolve(__dirname, "../../..");
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://jadhr:jadhr@127.0.0.1:5442/jadhr";
const PLACE = "2:32:4"; // عِلْمَ in al-Baqara 2:32, with a corpus gloss
const tag = () => `${test.info().project.name}-${Date.now().toString(36)}`;

function role(email: string, r: string) {
  execFileSync("uv", ["run", "python", "-m", "jadhr_api.roles", email, r, "e2e journey D"], { cwd: ROOT, stdio: "pipe" });
}

/** The test's own proposals, merges and changelog entries, removed from the development database. */
function clean(t: string) {
  const psql = process.env.E2E_PSQL ?? (existsSync("/opt/homebrew/opt/postgresql@17/bin/psql") ? "/opt/homebrew/opt/postgresql@17/bin/psql" : "psql");
  try {
    execFileSync(psql, [DB, "-q", "-c", `delete from contributions.changelog where merge_id in (select m.id from contributions.merges m join contributions.proposals p on p.id = m.proposal_id where p.text like '%${t}'); delete from contributions.merges where proposal_id in (select id from contributions.proposals where text like '%${t}'); delete from contributions.proposals where text like '%${t}';`], { stdio: "pipe" });
  } catch {
    /* psql not on the PATH: the rows stay in the development database */
  }
}

async function reader(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 }));
  });
  return page;
}

async function link(page: Page, email: string, before: number): Promise<string> {
  let out = "";
  await expect
    .poll(async () => {
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      out = m.length > before ? m[m.length - 1].link : "";
      return out;
    })
    .not.toBe("");
  const u = new URL(out);
  return u.pathname + u.search;
}

async function signIn(page: Page, email: string, name: string): Promise<Record<string, string>> {
  await page.goto("/signin?next=/review");
  await page.getByLabel("بريدك الإلكتروني").fill(email);
  await page.getByRole("button", { name: "أرسل رابط الدخول" }).click();
  await expect(page.getByText(`أُرسل إلى ${email}`)).toBeVisible();
  await followSignInLink(page, await link(page, email, 0));
  await expect(page).toHaveURL(/\/review/);
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  await page.request.patch("/api/v1/me", { headers: h, data: { display_name: name } });
  return h;
}

async function propose(page: Page, text: string) {
  await page.goto(`/quran/2?w=ilm&at=${PLACE}`);
  await page.getByRole("button", { name: "اقترح معنى حرفيًا أدق" }).first().click();
  const form = page.getByRole("dialog", { name: "اقترح معنى حرفيًا أدق" });
  await form.getByRole("textbox", { name: "صياغتك" }).fill(text);
  await form.getByRole("textbox", { name: /السبب والمصدر/ }).fill("al-Rāghib, al-Mufradāt, s.v. ع ل م");
  await form.getByRole("button", { name: "المفردات في غريب القرآن" }).click();
  await form.getByRole("textbox", { name: "المادة أو الصفحة" }).fill("ع ل م");
  await form.getByRole("button", { name: "أرسل للمراجعة" }).click();
  return form;
}

test("journey D: proposed in the Reader, approved by a reviewer and the board, credited beside its source, in the changelog and on the Profile (P7.4)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in three desktop windows; the queue's phone layout is checked below");
  test.setTimeout(150_000); // three accounts, signed in one after another
  const t = tag();
  const text = `knowledge, the grasp of a thing as it is ${t}`;
  const [a, r, e] = [await reader(browser), await reader(browser), await reader(browser)];
  const mails = { a: `e2e-d-a-${t}@example.org`, r: `e2e-d-r-${t}@example.org`, e: `e2e-d-e-${t}@example.org` };
  try {
    const ha = await test.step("sign in a", () => signIn(a, mails.a, `أمل ${t}`));
    const hr = await test.step("sign in r", () => signIn(r, mails.r, `حسن ${t}`));
    const he = await test.step("sign in e", () => signIn(e, mails.e, `سلمى ${t}`));
    role(mails.r, "reviewer");
    role(mails.e, "editor");

    // the proposal, from the Reader's gloss
    const form = await test.step("propose", () => propose(a, text));
    await expect(form.getByRole("status")).toContainText("أُرسل إلى المراجعة");
    const mine = ((await (await a.request.get("/api/v1/me/proposals", { headers: ha })).json()) as { data: { id: string; text: string }[] }).data;
    const id = mine.find((p) => p.text === text)!.id;
    // the proposer sees it in the queue and cannot approve it
    await a.goto(`/review?filter=mine&id=${id}`);
    await expect(a.getByText("لا يقرّر صاحب المقترح فيه")).toBeVisible();
    await expect(a.locator(".queue-detail").getByRole("button", { name: /^وافق/ })).toHaveCount(0);
    expect((await a.request.post(`/api/v1/proposals/${id}/decisions`, { headers: ha, data: { decision: "approve" } })).status()).toBe(403);

    // a reviewer approves: one of two, still open
    await test.step("reviewer opens", () => r.goto(`/review?id=${id}`));
    await r.getByRole("textbox", { name: "ملاحظتك لصاحب المقترح" }).fill("يوافق المفردات");
    await r.getByRole("button", { name: `وافق (${ar(1)} من ٢)` }).click();
    await expect(r.getByText("وافقت • تنتظر موافقة أخرى")).toBeVisible();
    await expect(r.locator(".approval-slot.is-filled")).toHaveCount(1);
    expect((await r.request.post(`/api/v1/proposals/${id}/decisions`, { headers: hr, data: { decision: "approve" } })).status()).toBe(409);

    // the board approves and merges
    await test.step("editor opens", () => e.goto(`/review?id=${id}`));
    await e.getByRole("button", { name: "وافق واعتمد" }).click();
    // the outcome is said, and the queue moves on from the settled proposal (RVQ-44; audit 12 F27, F29)
    await expect(e.locator(".queue-screen [role=status]").first()).toContainText("وُوفق عليه واعتُمد");
    await expect
      .poll(() => {
        const u = new URL(e.url());
        return u.searchParams.get("id") !== id || u.searchParams.get("filter") === "merged";
      })
      .toBe(true);
    // under Merged, credited
    await e.goto(`/review?filter=merged&id=${id}`);
    await expect(e.getByRole("button", { name: /^اعتُمدت/ })).toHaveAttribute("aria-pressed", "true");
    await expect(e.locator(".settled-banner.is-merged")).toContainText(`يُنسب إلى أمل ${t}`);

    // the Reader: beside the corpus gloss, never over it, with its credit line
    await test.step("reader", () => a.goto(`/quran/2?w=ilm&at=${PLACE}`));
    const merged = a.locator(".merged-line").filter({ hasText: text });
    await expect(merged).toContainText("معنى راجعه المحرّرون");
    await expect(merged).toContainText(`اقترحه أمل ${t} • راجعه حسن ${t} وسلمى ${t} (هيئة التحرير)`);
    await expect(merged).toContainText("المفردات في غريب القرآن");
    await expect(a.getByText("knowledge", { exact: true })).toBeVisible();

    // the changelog, and the contributor's Profile
    await a.goto("/data");
    await expect(a.locator(".changelog-row").filter({ hasText: text })).toContainText("اعتُمد");
    await a.goto("/me");
    await expect(a.locator(".profile-counts div").filter({ hasText: "مساهمات مدموجة" })).toContainText(ar(1));
    await expect(a.locator(".profile-row").filter({ hasText: text })).toContainText("اعتُمدت");
    void he;
  } finally {
    for (const [k, p] of [["a", a], ["r", r], ["e", e]] as const) {
      const h = { Authorization: `Bearer ${await p.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session).catch(() => "")}` };
      const c = (await (await p.request.post("/api/v1/me/delete", { headers: h })).json().catch(() => ({}))) as { confirm?: string };
      if (c.confirm) await p.request.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm: c.confirm } });
      void k;
    }
    clean(t);
    for (const p of [a, r, e]) await p.context().close();
  }
});

test("a proposal written signed out is kept, sign-in is asked for after it, and it reaches the queue once signed in (RVQ-Q02, 10 §4.4)", async ({ browser, page, isMobile }) => {
  const t = tag();
  const text = `knowledge ${t}`;
  const email = `e2e-d-draft-${t}@example.org`;
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } }, version: 2 }));
  });
  try {
    const form = await propose(page, text);
    await expect(form.getByRole("status")).toContainText("حُفظ اقتراحك على هذا الجهاز");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.proposals?.length)).toBe(1);
    // the sign-in in the same place, after the writing
    await form.getByLabel("بريدك الإلكتروني").fill(email);
    await form.getByRole("button", { name: "أرسل رابط الدخول" }).click();
    await expect(form.getByText(`أُرسل إلى ${email}`)).toBeVisible();
    await followSignInLink(page, await link(page, email, 0));
    await expect(page).toHaveURL(/\/quran\/2/);
    const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
    await expect.poll(async () => ((await (await page.request.get("/api/v1/me/proposals", { headers: h })).json()) as { data: { text: string }[] }).data.map((p) => p.text)).toContain(text);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.proposals?.length)).toBe(0);
    // on a phone the queue shows the list, then the proposal, with a way back (RVQ-81)
    await page.goto("/review?filter=mine");
    if (isMobile) {
      await page.locator(".queue-row").first().click();
      await expect(page.getByRole("button", { name: "→ القائمة" })).toBeVisible();
      await page.getByRole("button", { name: "→ القائمة" }).click();
      await expect(page.locator(".queue-row").first()).toBeVisible();
    } else await expect(page.locator(".queue-detail")).toContainText(text);
    const c = (await (await page.request.post("/api/v1/me/delete", { headers: h })).json()) as { confirm: string };
    await page.request.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm: c.confirm } });
  } finally {
    clean(t);
    void browser;
  }
});
