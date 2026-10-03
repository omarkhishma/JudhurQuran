import { type Browser, expect, type Page, test } from "@playwright/test";
import { ar, stored } from "./helpers";

/**
 * Accounts and sync (PLAN P6.1, P6.2, P6.4; PRF-33, PRF-Q02, NTB-Q02): sign-in by a link that works once; what a
 * device holds joins the account on sign-in; a second device gets all of it; an edit travels both ways, the newer
 * wins and the other is kept to restore; a deletion travels; clearing a device never clears the account; the
 * journal stays on the device unless the reader turns it on. Needs the API with the development mail outbox.
 */

type Rec = { store: string; key: string; value: unknown; deleted?: boolean };
type Nb = { notes: { title: string; body: string }[] };
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

/** Documents kept in IndexedDB (maps, the reader's texts), written as the site writes them. */
async function docs(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.addInitScript((e) => {
    if (sessionStorage.getItem("e2e-docs")) return;
    sessionStorage.setItem("e2e-docs", "1");
    const open = indexedDB.open("keyval-store");
    open.onupgradeneeded = () => open.result.createObjectStore("keyval");
    open.onsuccess = () => {
      const tx = open.result.transaction("keyval", "readwrite");
      for (const [k, v] of Object.entries(e)) tx.objectStore("keyval").put(v, k);
    };
  }, entries);
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

test("what a device holds joins the account on sign-in, and a second device gets all of it — the journal only once turned on (P6.2, P6.4, NTB-Q02)", async ({ browser, page }) => {
  const email = address();
  const T = 1759000000000;
  const a = await device(browser, page, {
    saved: { state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: T }], notes: { "quran:2:255": { verse: "2:255", text: "آية الكرسي", at: T } }, history: [] }, version: 2 },
    notebook: { state: { notes: [NOTE] }, version: 1 },
    review: { state: { cards: { علم: { root: "علم", ease: 2.6, interval: 3, due: 1759300000000, reps: 2, lapses: 0, last: T, grade: "good" } } }, version: 1 },
    prefs: { state: { size: 1.2 }, version: 2 },
    audio: { state: { reciter: "husary", follow: false, speed: 0.75, repeat: true }, version: 0 },
    "analyse-choices": { state: { choices: { "علم|0": 1 } }, version: 1 },
    personal: { wordStates: { Eilom: "known" }, sessions: [{ day: "2026-10-01", text: "quran", words: ["Eilom"], roots: ["علم"], verses: ["2:255"], lookups: 4 }] },
  });
  await docs(a, {
    "jadhr-notebook": { state: { notes: [NOTE] }, version: 1 },
    "jadhr-graphs-index": [{ id: "g1", title: "خريطة العلم", kind: "root", createdAt: T, updatedAt: T, nodeCount: 0 }],
    "jadhr-graph:g1": { version: 1, id: "g1", title: "خريطة العلم", kind: "root", createdAt: T, updatedAt: T, nodes: [], edges: [] },
    "jadhr-texts-index": [{ id: "t1", title: "نصّي", words: 2, lemmas: ["ilm"], review: 0, unknown: 0, createdAt: T, updatedAt: T }],
    "jadhr-text:t1": { id: "t1", title: "نصّي", text: "العلم نور", passages: ["العلم نور"], words: 2, lemmas: ["ilm"], review: 0, unknown: 0, createdAt: T, updatedAt: T },
  });
  await a.goto("/");
  await a.reload(); // the documents seeded into IndexedDB are written by now
  // the sheet says what this device holds (HUB-30), and the link brings the reader back where they were
  await a.getByRole("banner").getByRole("button", { name: "دخول" }).click();
  await expect(a.getByRole("dialog").locator("h2")).toHaveText("على هذا الجهاز: محفوظ واحد وملاحظتان");
  await a.getByRole("dialog").getByRole("button", { name: "ليس الآن" }).click();
  await signIn(a, email, "sheet");
  await expect(a).toHaveURL(/\/$/);

  const want = ["saved/b:lemma:Eilom", "saved/n:quran:2:255", "notebook/n:n1", "review/c:علم", "prefs/size", "audio/speed", "audio/reciter", "analyse/علم|0", "personal/w:Eilom", "graphs/g:g1", "texts/x:t1"];
  await expect.poll(async () => (await records(a)).map((r) => `${r.store}/${r.key}`)).toEqual(expect.arrayContaining(want));
  expect((await records(a)).filter((r) => r.store === "journal"), "the journal syncs only when turned on").toEqual([]);

  const b = await device(browser, null);
  await b.goto("/");
  await signIn(b, email);
  await expect.poll(async () => (await stored<Nb>(b, "jadhr-notebook"))?.notes?.[0]?.title).toBe("عن العلم");
  expect((await local(b, "jadhr-saved")).bookmarks.map((x: { label: string }) => x.label)).toEqual(["عِلْم"]);
  expect((await local(b, "jadhr-saved")).notes["quran:2:255"].text).toBe("آية الكرسي");
  expect(Object.keys((await local(b, "jadhr-review")).cards)).toEqual(["علم"]);
  expect((await local(b, "jadhr-prefs")).size).toBe(1.2);
  expect((await local(b, "jadhr-personal")).wordStates).toEqual({ Eilom: "known" });
  expect((await local(b, "jadhr-personal")).sessions ?? []).toEqual([]);
  expect((await local(b, "jadhr-audio")).speed).toBe(0.75);
  expect((await local(b, "jadhr-analyse-choices")).choices).toEqual({ "علم|0": 1 });
  // the maps and the reader's own texts, documents in IndexedDB
  await expect.poll(async () => (await stored<{ title: string }>(b, "jadhr-graph:g1"))?.title ?? null).toBe("خريطة العلم");
  expect((await stored<{ text: string }>(b, "jadhr-text:t1"))?.text).toBe("العلم نور");
  // the journal once the reader turns it on: A's day reaches B as A's
  await a.request.patch("/api/v1/me", { headers: await bearer(a), data: { settings: { sync_journal: true } } });
  await a.reload();
  await expect.poll(async () => (await records(a)).filter((r) => r.store === "journal").length).toBe(1);
  await b.reload();
  await expect.poll(async () => ((await local(b, "jadhr-personal")).sessions ?? []).map((x: { day: string; lookups: number; device?: string }) => [x.day, x.lookups, !!x.device])).toEqual([["2026-10-01", 4, true]]);
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
  await expect.poll(async () => (await stored<Nb>(b, "jadhr-notebook"))?.notes?.length).toBe(1);

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
  await expect.poll(async () => (await stored<Nb>(a, "jadhr-notebook"))?.notes?.[0]?.body).toBe("نسخة ب");
  const hist = (await (await a.request.get("/api/v1/me/history", { headers: await bearer(a) })).json()) as { data: Rec[] };
  expect(hist.data.filter((r) => r.key === "n:n1").map((r) => (r.value as { body: string } | null)?.body)).toContain("نسخة أ");

  // B deletes the note; A loses it on its next sync
  await b.goto("/notebook?note=n1");
  await b.locator(".notebook-editor").getByRole("button", { name: "احذف" }).click();
  await b.locator(".notebook-editor").getByRole("button", { name: "احذف" }).last().click();
  await expect.poll(async () => (await records(b)).filter((r) => r.key === "n:n1")).toEqual([]);
  await a.reload();
  await expect.poll(async () => (await stored<Nb>(a, "jadhr-notebook"))?.notes?.length).toBe(0);
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

test("many deletions at once are held for the reader's word: brought back, or sent everywhere (F11)", async ({ browser, page }) => {
  const email = address();
  const marks = Array.from({ length: 12 }, (_, i) => ({ kind: "root", key: `ر${i}`, label: `ر${i}`, at: 1759000000000 + i }));
  const a = await device(browser, page, { saved: { state: { bookmarks: marks, notes: {}, history: [] }, version: 2 } });
  await a.goto("/");
  await signIn(a, email);
  await expect.poll(async () => (await records(a)).filter((r) => r.store === "saved").length).toBe(12);
  const emptied = () => a.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}");
    s.state.bookmarks = [];
    localStorage.setItem("jadhr-saved", JSON.stringify(s));
  });
  // every star gone on this device at once, as a store read empty by mistake would look: nothing is sent
  await emptied();
  await a.reload();
  const prompt = a.locator(".storage-warning").filter({ hasText: "من «المحفوظات»" });
  await expect(prompt).toContainText(`حُذف على هذا الجهاز ${ar(12)} عنصرًا من «المحفوظات»`);
  await expect(a.getByRole("link", { name: /^حسابي: .* — المزامنة تنتظر جوابك$/ })).toBeVisible();
  expect((await records(a)).filter((r) => r.store === "saved").length).toBe(12);
  // brought back from the account
  await prompt.getByRole("button", { name: "أعدها" }).click();
  await expect.poll(async () => (await local(a, "jadhr-saved"))?.bookmarks?.length).toBe(12);
  await expect(prompt).toHaveCount(0);
  // gone again, and this time the reader says so: the account and the other devices follow
  await emptied();
  await a.reload();
  await prompt.getByRole("button", { name: "احذفها من كل مكان" }).click();
  await expect.poll(async () => (await records(a)).filter((r) => r.store === "saved").length).toBe(0);
  await expect(prompt).toHaveCount(0);
  expect((await local(a, "jadhr-saved"))?.bookmarks).toEqual([]);
  await dropAccount(a);
});

test("another account's data on a device is taken into a new account only on the reader's word (F8)", async ({ browser, page }) => {
  const [first, second, third] = [address(), address(), address()];
  const a = await device(browser, page, { saved: { state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: 1759000000000 }], notes: {}, history: [] }, version: 2 } });
  await a.goto("/");
  await signIn(a, first);
  await expect.poll(async () => (await records(a)).map((r) => r.key)).toContain("b:lemma:Eilom");
  const h1 = await bearer(a);
  // signed out as a sign-out leaves it (the session kept on the server here, to check and clean up after)
  const leave = () => a.evaluate(() => ["jadhr-auth", "jadhr-sync"].forEach((k) => localStorage.removeItem(k)));
  await leave();
  await a.reload();
  await signIn(a, second);
  const ask = a.getByRole("dialog", { name: "على هذا الجهاز بيانات حساب آخر" });
  await expect(ask).toBeVisible();
  expect(await records(a), "nothing goes up before the reader answers").toEqual([]);
  await ask.getByRole("button", { name: "أضفه إلى هذا الحساب" }).click();
  await expect.poll(async () => (await records(a)).map((r) => r.key)).toContain("b:lemma:Eilom");
  const h2 = await bearer(a);

  // and a third account, this time starting the device with its own data alone
  await leave();
  await a.reload();
  await signIn(a, third);
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "ابدأ ببيانات هذا الحساب" }).click();
  await expect.poll(async () => (await local(a, "jadhr-saved"))?.bookmarks?.length ?? 0).toBe(0);
  await expect(a.getByRole("link", { name: /^حسابي:/ })).toBeVisible();
  await a.reload();
  await expect(ask).toHaveCount(0);
  expect(await records(a)).toEqual([]);
  expect((await records(a, h1)).map((r) => r.key), "the first account keeps its own").toContain("b:lemma:Eilom");
  await dropAccount(a);
  for (const h of [h1, h2]) {
    const { confirm } = (await (await a.request.post("/api/v1/me/delete", { headers: h })).json()) as { confirm: string };
    await a.request.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm } });
  }
});

test("notes this browser cannot read are never shown as empty, written over or synced away (F11)", async ({ browser, page }) => {
  const email = address();
  const a = await device(browser, page);
  await docs(a, { "jadhr-notebook": { state: { notes: [NOTE] }, version: 1 } });
  await a.goto("/");
  await a.reload(); // the notes seeded into IndexedDB are written by now
  await signIn(a, email);
  await expect.poll(async () => (await records(a)).map((r) => r.key)).toContain("n:n1");
  // from here this browser fails to read them
  await a.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      if (key === "jadhr-notebook") throw new DOMException("unreadable", "UnknownError");
      return get.call(this, key);
    };
  });
  await a.goto("/notebook");
  await expect(a.getByRole("alert").filter({ hasText: "تعذّرت قراءة ملاحظاتك في هذا المتصفح الآن" })).toBeVisible();
  await expect(a.getByRole("button", { name: "+ ملاحظة جديدة" })).toBeDisabled();
  await a.goto("/me?tab=account");
  await a.getByRole("button", { name: "زامن الآن" }).click();
  await expect(a.locator(".profile-status")).toContainText("لم يُزامَن هذه المرة لأن هذا المتصفح تعذّرت عليه قراءته: الدفتر.");
  expect((await records(a)).map((r) => r.key), "the note stays in the account").toContain("n:n1");
  await dropAccount(a);
});

test("deleting this browser's data in one tab starts the other tabs afresh, so none writes it back (F15)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    // once per tab, and never into a browser already holding data (the second tab opens on the first one's)
    const seeded = sessionStorage.getItem("e2e-seeded");
    sessionStorage.setItem("e2e-seeded", "1");
    if (seeded || localStorage.getItem("jadhr-personal")) return;
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
    localStorage.setItem("jadhr-saved", JSON.stringify({ state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: 1759000000000 }], notes: {}, history: [] }, version: 2 }));
  });
  const one = await ctx.newPage();
  await one.goto("/saved");
  const two = await ctx.newPage();
  await two.goto("/saved");
  await expect(two.getByText("عِلْم").first()).toBeVisible();
  await two.evaluate(() => ((window as unknown as { before: number }).before = 1));
  await one.getByRole("button", { name: "حذف كل بياناتي من هذا المتصفح" }).click();
  await one.getByRole("button", { name: "انقر مرة أخرى لتأكيد الحذف النهائي" }).click();
  await expect(one.getByRole("status")).toHaveText("حُذفت بياناتك المحلية.");
  // the other tab reloaded, holding nothing of what was deleted
  await expect.poll(() => two.evaluate(() => (window as unknown as { before?: number }).before ?? 0)).toBe(0);
  await expect(two.getByText("عِلْم")).toHaveCount(0);
  expect(await two.evaluate(() => JSON.parse(localStorage.getItem("jadhr-saved") ?? "null")?.state?.bookmarks ?? [])).toEqual([]);
  await ctx.close();
});
