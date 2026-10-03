import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Accounts and sync (PLAN P6.1, P6.2, P6.4; PRF-33, PRF-Q02, NTB-Q02): sign-in by a link that works once; what a
 * device holds joins the account on sign-in; a second device gets all of it; an edit travels both ways, the newer
 * wins and the other is kept to restore; a deletion travels; clearing a device never clears the account; the
 * journal stays on the device unless the reader turns it on. Needs the API with the development mail outbox.
 */

type Rec = { store: string; key: string; value: unknown; deleted?: boolean };
const NOTE = { id: "n1", title: "عن العلم", body: "أصل", tags: [], created: 1759000000000, updated: 1759000000000, links: { roots: [], verses: [] } };

const address = () => `e2e-${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@example.org`;

/** A device that has used the site before: onboarded, with whatever else the test gives it. */
async function device(browser: Browser, page: Page | null, seed: Record<string, unknown> = {}): Promise<Page> {
  const p = page ?? (await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage());
  await p.addInitScript((s) => {
    // once per tab: a device whose data was deleted must not be refilled by the test
    if (sessionStorage.getItem("e2e-seeded") || localStorage.getItem("jadhr-personal")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, wordStates: {}, ...((s["personal"] as object) ?? {}) }, version: 2 }));
    for (const [k, v] of Object.entries(s)) if (k !== "personal") localStorage.setItem(`jadhr-${k}`, JSON.stringify(v));
  }, seed);
  return p;
}

async function outbox(page: Page, email: string): Promise<string[]> {
  const r = await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`);
  expect(r.ok(), "the API must run with the development mail outbox").toBeTruthy();
  return ((await r.json()) as { messages: { link: string }[] }).messages.map((m) => m.link);
}

/** Ask for a link, and return the new one as a path on this site. */
async function askLink(page: Page, email: string, from: "page" | "sheet" = "page"): Promise<string> {
  const before = (await outbox(page, email)).length;
  if (from === "page") await page.goto("/signin");
  else await page.getByRole("banner").getByRole("button", { name: "دخول" }).click();
  const scope = from === "page" ? page.locator("main") : page.getByRole("dialog");
  await scope.getByLabel("بريدك الإلكتروني").fill(email);
  await scope.getByRole("button", { name: "أرسل رابط الدخول" }).click();
  await expect(scope.getByText(`أُرسل إلى ${email}`)).toBeVisible();
  let link = "";
  await expect
    .poll(async () => {
      const all = await outbox(page, email);
      link = all.length > before ? all[all.length - 1] : "";
      return link;
    })
    .not.toBe("");
  const u = new URL(link);
  return u.pathname + u.search;
}

async function signIn(page: Page, email: string, from: "page" | "sheet" = "page"): Promise<void> {
  await page.goto(await askLink(page, email, from));
  await expect(page.getByRole("link", { name: /^حسابي:/ })).toBeVisible();
}

const bearer = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` });

async function records(page: Page, headers?: Record<string, string>): Promise<Rec[]> {
  const r = await page.request.get("/api/v1/me/export", { headers: headers ?? (await bearer(page)) });
  return ((await r.json()) as { records: Rec[] }).records;
}

const local = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null")?.state, key);

async function dropAccount(page: Page): Promise<void> {
  const h = await bearer(page);
  const { confirm } = (await (await page.request.post("/api/v1/me/delete", { headers: h })).json()) as { confirm: string };
  expect((await page.request.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm } })).ok()).toBeTruthy();
}

test("what a device holds joins the account on sign-in, and a second device gets all of it — the journal stays (P6.2, P6.4, NTB-Q02)", async ({ browser, page }) => {
  const email = address();
  const a = await device(browser, page, {
    saved: { state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: 1759000000000 }], notes: { "quran:2:255": { verse: "2:255", text: "آية الكرسي", at: 1759000000000 } }, history: [] }, version: 2 },
    notebook: { state: { notes: [NOTE] }, version: 1 },
    review: { state: { cards: { علم: { root: "علم", ease: 2.6, interval: 3, due: 1759300000000, reps: 2, lapses: 0, last: 1759000000000, grade: "good" } } }, version: 1 },
    prefs: { state: { size: 1.2 }, version: 2 },
    personal: { wordStates: { Eilom: "known" }, sessions: [{ day: "2026-10-01", text: "quran", words: ["Eilom"], roots: ["علم"], verses: ["2:255"], lookups: 4 }] },
  });
  await a.goto("/");
  // the sheet says what this device holds (HUB-30), and the link brings the reader back where they were
  await a.getByRole("banner").getByRole("button", { name: "دخول" }).click();
  await expect(a.getByRole("dialog").locator("h2")).toHaveText("على هذا الجهاز: محفوظ واحد وملاحظتان");
  await a.getByRole("dialog").getByRole("button", { name: "ليس الآن" }).click();
  await signIn(a, email, "sheet");
  await expect(a).toHaveURL(/\/$/);

  const want = ["saved/b:lemma:Eilom", "saved/n:quran:2:255", "notebook/n:n1", "review/c:علم", "prefs/size", "personal/w:Eilom"];
  await expect.poll(async () => (await records(a)).map((r) => `${r.store}/${r.key}`)).toEqual(expect.arrayContaining(want));
  expect((await records(a)).filter((r) => r.store === "journal"), "the journal syncs only when turned on").toEqual([]);

  const b = await device(browser, null);
  await b.goto("/");
  await signIn(b, email);
  await expect.poll(async () => (await local(b, "jadhr-notebook"))?.notes?.[0]?.title).toBe("عن العلم");
  expect((await local(b, "jadhr-saved")).bookmarks.map((x: { label: string }) => x.label)).toEqual(["عِلْم"]);
  expect((await local(b, "jadhr-saved")).notes["quran:2:255"].text).toBe("آية الكرسي");
  expect(Object.keys((await local(b, "jadhr-review")).cards)).toEqual(["علم"]);
  expect((await local(b, "jadhr-prefs")).size).toBe(1.2);
  expect((await local(b, "jadhr-personal")).wordStates).toEqual({ Eilom: "known" });
  expect((await local(b, "jadhr-personal")).sessions ?? []).toEqual([]);
  // and the second device shows it where the reader looks
  await b.goto("/notebook");
  await expect(b.locator(".notebook-row").first()).toContainText("عن العلم");

  const h = await bearer(a);
  await dropAccount(b);
  expect((await a.request.get("/api/v1/me", { headers: h })).status(), "deleted: every device is signed out").toBe(401);
  await b.context().close();
});

test("an edit travels both ways: the newer wins, the older is kept to restore, and a deletion travels too (PRF-33)", async ({ browser, page }) => {
  const email = address();
  const a = await device(browser, page, { notebook: { state: { notes: [NOTE] }, version: 1 } });
  await a.goto("/");
  await signIn(a, email);
  await expect.poll(async () => (await records(a)).map((r) => r.key)).toContain("n:n1");
  const b = await device(browser, null);
  await b.goto("/");
  await signIn(b, email);
  await expect.poll(async () => (await local(b, "jadhr-notebook"))?.notes?.length).toBe(1);

  // A edits while offline: the change waits, stamped when it was made
  await a.goto("/notebook?note=n1");
  await a.context().setOffline(true);
  await a.locator(".notebook-editor").getByRole("textbox", { name: "نص الملاحظة" }).fill("نسخة أ");
  await expect.poll(async () => a.evaluate(() => !!JSON.parse(localStorage.getItem("jadhr-sync") ?? "{}").dirty?.notebook?.["n:n1"]), { timeout: 20_000 }).toBe(true);
  // B edits the same note later, online
  await b.goto("/notebook?note=n1");
  await b.locator(".notebook-editor").getByRole("textbox", { name: "نص الملاحظة" }).fill("نسخة ب");
  await expect.poll(async () => ((await records(b)).find((r) => r.key === "n:n1")?.value as { body: string })?.body).toBe("نسخة ب");
  // A comes back: its older edit loses, is kept with the replaced versions, and A takes B's
  await a.context().setOffline(false);
  await a.reload();
  await expect.poll(async () => (await local(a, "jadhr-notebook"))?.notes?.[0]?.body).toBe("نسخة ب");
  const hist = (await (await a.request.get("/api/v1/me/history", { headers: await bearer(a) })).json()) as { data: Rec[] };
  expect(hist.data.filter((r) => r.key === "n:n1").map((r) => (r.value as { body: string } | null)?.body)).toContain("نسخة أ");

  // B deletes the note; A loses it on its next sync
  await b.goto("/notebook?note=n1");
  await b.locator(".notebook-editor").getByRole("button", { name: "احذف" }).click();
  await b.locator(".notebook-editor").getByRole("button", { name: "احذف" }).last().click();
  await expect.poll(async () => (await records(b)).filter((r) => r.key === "n:n1")).toEqual([]);
  await a.reload();
  await expect.poll(async () => (await local(a, "jadhr-notebook"))?.notes?.length).toBe(0);
  await dropAccount(a);
  await b.context().close();
});

test("clearing this device signs it out first and never clears the account; a link works only once (P6.1, PRF-12)", async ({ browser, page }) => {
  const email = address();
  const a = await device(browser, page, { saved: { state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: 1759000000000 }], notes: {}, history: [] }, version: 2 } });
  await a.goto("/");
  const link = await askLink(a, email);
  await a.goto(link);
  await expect(a.getByRole("link", { name: /^حسابي:/ })).toBeVisible();
  await expect.poll(async () => (await records(a)).map((r) => r.key)).toContain("b:lemma:Eilom");

  // the same link, again: refused, with a way to ask for another
  const other = await (await browser.newContext()).newPage();
  await other.goto(new URL(link, a.url()).toString());
  await expect(other.locator(".auth-card[role=alert]")).toContainText("انتهت صلاحية هذا الرابط أو استُعمل من قبل.");
  await expect(other.getByRole("link", { name: "اطلب رابطًا جديدًا" })).toHaveAttribute("href", "/signin");

  await a.goto("/saved");
  await a.getByRole("button", { name: "حذف كل بياناتي من هذا المتصفح" }).click();
  await a.getByRole("button", { name: "انقر مرة أخرى لتأكيد الحذف النهائي" }).click();
  await expect(a.getByRole("status")).toHaveText("حُذفت بياناتك المحلية.");
  await expect(a.getByRole("banner").getByRole("button", { name: "دخول" })).toBeVisible();
  expect((await local(a, "jadhr-saved"))?.bookmarks ?? []).toEqual([]);

  // the account still holds the star: a device that signs in gets it
  await signIn(other, email);
  await expect.poll(async () => (await local(other, "jadhr-saved"))?.bookmarks?.length).toBe(1);
  await dropAccount(other);
  await other.context().close();
});
