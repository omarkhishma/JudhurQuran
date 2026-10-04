import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { followSignInLink } from "./helpers";

/**
 * The editorial board in end-to-end tests (P3.0, P8.3b): real accounts through the development outbox, roles given
 * by the command the runbook names, the tests' own editorial work removed afterwards and the web's cached pages
 * expired, so the reader never shows it.
 */

export const ROOT = path.resolve(__dirname, "../../..");
export const DB = process.env.E2E_DATABASE_URL ?? "postgresql://jadhr:jadhr@127.0.0.1:5442/jadhr";
export const tag = () => `${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const role = (email: string, r: string) => execFileSync("uv", ["run", "python", "-m", "jadhr_api.roles", email, r, "e2e workbench"], { cwd: ROOT, stdio: "pipe" });

const PSQL = process.env.E2E_PSQL ?? (existsSync("/opt/homebrew/opt/postgresql@17/bin/psql") ? "/opt/homebrew/opt/postgresql@17/bin/psql" : "psql");

/** One query's rows as tab-separated lines: what the server kept, read where the API would not show it. */
export function sql(query: string): string[] {
  return execFileSync(PSQL, [DB, "-Atq", "-F", "\t", "-c", query], { stdio: "pipe" }).toString().trim().split("\n").filter(Boolean);
}

/** The test's own editorial work, removed so the reader never shows it. */
export function clean(emails: string[]) {
  const psql = PSQL;
  const list = emails.map((e) => `'${e}'`).join(",");
  execFileSync(psql, [DB, "-q", "-c", `delete from editorial.entries where author_id in (select id from accounts.users where email in (${list}));`], { stdio: "pipe" });
}

/**
 * An approval expires the cached pages of the web the API is configured to tell (JADHR_WEB_REVALIDATE_URL); the web
 * under test may be another, so a test that reads a page after an approval, or leaves one behind it, expires it too.
 */
export async function expire(page: Page) {
  const secret = process.env.E2E_REVALIDATE_SECRET;
  const r = await page.request.post("/api/revalidate", { headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
  expect(r.status(), "start the web under test with JADHR_REVALIDATE_SECRET and pass the same value as E2E_REVALIDATE_SECRET").toBe(200);
}

export type Person = { page: Page; h: Record<string, string>; email: string };

export async function person(browser: Browser, email: string, r?: string): Promise<Person> {
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

export async function drop(p: Person) {
  const c = (await (await p.page.request.post("/api/v1/me/delete", { headers: p.h })).json().catch(() => ({}))) as { confirm?: string };
  if (c.confirm) await p.page.request.post("/api/v1/me/delete/confirm", { headers: p.h, data: { confirm: c.confirm } });
  await p.page.context().close();
}
