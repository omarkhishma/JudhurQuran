import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { ar, expectNoHorizontalScroll } from "./helpers";

/**
 * The Profile (P6.3, inventory PRF; PRF-Q03; P6.4): who the reader is, what they have, their records in tabs that
 * link back, and their data — exported and deleted completely. The export is checked against every key this site
 * keeps in localStorage and IndexedDB, so a store added later is never left out (the prototype missed five, PRF-09).
 */

const NOW = 1759400000000;
const LS = {
  "jadhr-personal": { state: { visited: true, onboarded: true, wordStates: { ilm: "known" }, proposals: [{ id: "p1", kind: "edit", slug: "ilm", label: "عِلْم", ordinal: 1, current: "", text: "اقتراح لتعديل المعنى", why: "", sources: [], status: "pending", ts: NOW }], sessions: [{ day: "2026-10-02", text: "quran", words: ["ilm"], roots: ["علم"], verses: ["2:255"], lookups: 5 }] }, version: 2 },
  "jadhr-saved": { state: { bookmarks: [{ kind: "lemma", key: "ilm", label: "عِلْم", at: NOW }], notes: { "quran:2:255": { verse: "2:255", text: "آية الكرسي", at: NOW } }, history: [] }, version: 2 },
  "jadhr-review": { state: { cards: { علم: { root: "علم", ease: 2.5, interval: 1, due: NOW, reps: 1, lapses: 0, last: NOW, grade: "good" } } }, version: 1 },
  "jadhr-prefs": { state: { size: 1.1 }, version: 2 },
};
const IDB = {
  "jadhr-notebook": { state: { notes: [{ id: "n1", title: "عن العلم", body: "", tags: [], created: NOW, updated: NOW, links: { roots: [], verses: [], words: [] } }] }, version: 1 },
  "jadhr-graphs-index": [{ id: "g1", title: "خريطة العلم", kind: "root", createdAt: NOW, updatedAt: NOW, nodeCount: 3 }],
  "jadhr-graph:g1": { version: 1, id: "g1", title: "خريطة العلم", kind: "root", createdAt: NOW, updatedAt: NOW, nodes: [], edges: [] },
  "jadhr-texts-index": [{ id: "t1", title: "نصّي", words: 12, lemmas: ["ilm"], review: 0, unknown: 0, createdAt: NOW, updatedAt: NOW }],
  "jadhr-text:t1": { id: "t1", title: "نصّي", text: "العلم نور", passages: ["العلم نور"], words: 12, lemmas: ["ilm"], review: 0, unknown: 0, createdAt: NOW, updatedAt: NOW },
};

async function seed(page: Page) {
  await page.addInitScript(
    ([ls, idb]) => {
      if (sessionStorage.getItem("e2e-seeded")) return;
      sessionStorage.setItem("e2e-seeded", "1");
      for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, JSON.stringify(v));
      const open = indexedDB.open("keyval-store");
      open.onupgradeneeded = () => open.result.createObjectStore("keyval");
      open.onsuccess = () => {
        const tx = open.result.transaction("keyval", "readwrite");
        for (const [k, v] of Object.entries(idb)) tx.objectStore("keyval").put(v, k);
      };
    },
    [LS, IDB] as const,
  );
}

/** Every key this browser holds for the site: localStorage and the IndexedDB store the site uses. */
async function keys(page: Page): Promise<{ local: string[]; idb: string[] }> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const local = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!);
        const open = indexedDB.open("keyval-store");
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("keyval")) return resolve({ local, idb: [] });
          const r = db.transaction("keyval").objectStore("keyval").getAllKeys();
          r.onsuccess = () => resolve({ local, idb: r.result.map(String) });
        };
      }),
  );
}

test("signed out: the local reader, what they have, their records in tabs linking back, and the empty copy that says what fills a tab (PRF-04…08, 15…28)", async ({ page, isMobile }) => {
  await seed(page);
  await page.goto("/me");
  await page.reload(); // the documents seeded into IndexedDB are written by now, whatever read first
  await expect(page.getByText("قارئ على هذا الجهاز")).toBeVisible();
  await expect(page.getByText("محفوظ على هذا الجهاز وحده")).toBeVisible();
  const counts = page.locator(".profile-counts");
  for (const [k, n] of [["مسودات مقترحات", 1], ["خرائط", 1], ["نصوص في مكتبتك", 1], ["ملاحظات", 2], ["محفوظات", 1], ["بطاقات مراجعة", 1]] as const)
    await expect(counts.locator("div").filter({ hasText: k })).toContainText(ar(n));
  // contributions: the draft, said to be one, linking to its word
  const rows = page.locator(".profile-row");
  await expect(rows.first()).toContainText("مسودة على هذا الجهاز");
  await expect(rows.first()).toHaveAttribute("href", "/read?w=ilm");
  for (const [tab, href] of [["محفوظاتي", "/read?w=ilm"], ["ملاحظاتي", "/notebook?note=n1"], ["خرائطي", "/graph/edit/g1"], ["مكتبتي", "/library/text/t1"], ["سجلّي", "/notebook?tab=journal"]] as const) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(rows.first()).toHaveAttribute("href", href);
  }
  // the tab is in the address, and a fresh visit opens it
  await expect(page).toHaveURL(/\/me\?tab=journal$/);
  await page.goto("/me?tab=journal");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("سجلّي");
  if (isMobile) await expectNoHorizontalScroll(page);
  await page.evaluate(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, proposals: [] }, version: 2 })));
  await page.goto("/me");
  await expect(page.locator(".profile-empty")).toHaveText("لا مقترحات بعد — استعمل «اقترح تعديلًا» على أي معنى في القارئ.");
});

test("your data: the export holds every key the site keeps, every key is the site's, and deleting leaves nothing of the reader (PRF-09…13, Q03, P6.4)", async ({ page }) => {
  await seed(page);
  await page.goto("/me");
  await page.reload(); // the documents seeded into IndexedDB are written by now, whatever read first
  await expect(page.locator(".profile-counts")).toContainText(ar(2));
  const held = await keys(page);
  // every key this site writes carries its prefix, so export and delete can find it
  expect([...held.local, ...held.idb].filter((k) => !k.startsWith("jadhr-") && k !== "e2e-seeded")).toEqual([]);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "صدّر كل ما على هذا الجهاز (JSON)" }).click()]);
  const out = JSON.parse(readFileSync((await dl.path())!, "utf8")) as { local: Record<string, unknown>; documents: Record<string, unknown> };
  const machinery = new Set(["jadhr-auth", "jadhr-sync", "jadhr-device"]);
  expect(Object.keys(out.local).sort()).toEqual(held.local.filter((k) => k.startsWith("jadhr-") && !machinery.has(k)).sort());
  expect(Object.keys(out.documents).sort()).toEqual(held.idb.filter((k) => k.startsWith("jadhr-")).sort());
  await expect(page.getByRole("status").filter({ hasText: "صُدّرت." })).toBeVisible();
  const [texts] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "نزّل نصوصي (JSON)" }).click()]);
  expect((JSON.parse(readFileSync((await texts.path())!, "utf8")) as { texts: { title: string }[] }).texts.map((x) => x.title)).toEqual(["نصّي"]);

  // two clicks, the second within three seconds (PRF-12); the first alone reverts
  await page.clock.install();
  const del = page.getByRole("button", { name: "احذف بيانات هذا الجهاز" });
  await del.click();
  await expect(page.getByRole("button", { name: "اضغط مرة أخرى لحذف كل بيانات هذا الجهاز" })).toBeVisible();
  await page.clock.runFor(3500);
  await expect(del).toBeVisible();
  await del.click();
  await page.getByRole("button", { name: "اضغط مرة أخرى لحذف كل بيانات هذا الجهاز" }).click();
  await expect(page.getByRole("status").filter({ hasText: "حُذفت بيانات هذا الجهاز." })).toBeVisible();
  const after = await keys(page);
  const dump = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  expect(dump).not.toContain("عِلْم");
  expect(after.idb.filter((k) => k.startsWith("jadhr-"))).toEqual([]);
  await expect(page.locator(".profile-counts")).not.toContainText(ar(2));
});

async function signIn(page: Page, email: string): Promise<void> {
  const outbox = async () => ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
  const before = (await outbox()).length;
  await page.goto("/signin?next=/me%3Ftab%3Daccount");
  await page.getByLabel("بريدك الإلكتروني").fill(email);
  await page.getByRole("button", { name: "أرسل رابط الدخول" }).click();
  await expect(page.getByText(`أُرسل إلى ${email}`)).toBeVisible();
  let link = "";
  await expect.poll(async () => ((link = (await outbox()).length > before ? (await outbox()).at(-1)!.link : ""), link)).not.toBe("");
  const u = new URL(link);
  await page.goto(u.pathname + u.search);
  await expect(page).toHaveURL(/\/me\?tab=account$/);
}

const bearer = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` });

test("signed in: the name credited, the journal synced only when turned on, this device listed, a replaced version restored, and the account deleted in two steps (PRF-14, 33, Q04; NTB-Q02)", async ({ page }) => {
  const email = `e2e-profile-${test.info().project.name}-${Date.now().toString(36)}@example.org`;
  await seed(page);
  await signIn(page, email);
  const h = await bearer(page);
  // the name contributions are credited to; nothing public by default
  await page.getByLabel("الاسم الذي تُنسب إليه مساهماتك").fill("قارئ الاختبار");
  await page.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "حُفظ." })).toBeVisible();
  await expect(page.locator(".profile-id")).toContainText("قارئ الاختبار");
  await expect(page.getByText(/^متزامن • جهاز واحد/)).toBeVisible();
  await expect(page.locator(".account-row").filter({ hasText: "هذا الجهاز" })).toBeVisible();
  // the journal stays on the device until the reader turns it on
  const journal = async () => ((await (await page.request.get("/api/v1/me/export", { headers: h })).json()) as { records: { store: string }[] }).records.filter((r) => r.store === "journal").length;
  await expect.poll(async () => ((await (await page.request.get("/api/v1/me/export", { headers: h })).json()) as { records: unknown[] }).records.length).toBeGreaterThan(0);
  expect(await journal()).toBe(0);
  await page.getByRole("checkbox", { name: /زامن سجلّ قراءتي/ }).check();
  await expect.poll(journal).toBe(1);
  await page.getByRole("checkbox", { name: /زامن سجلّ قراءتي/ }).uncheck();
  await expect.poll(journal).toBe(0);
  // a version replaced on the server is listed and restored, and comes back to this device
  const star = { store: "saved", key: "b:lemma:ilm", value: { kind: "lemma", key: "ilm", label: "عِلْم — بعد", at: NOW }, updated_at: Date.now() + 60_000 };
  await page.request.post("/api/v1/me/sync", { headers: h, data: { records: [star] } });
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}").state?.bookmarks?.[0]?.label)).toBe("عِلْم — بعد");
  const replaced = page.locator(".account-row").filter({ hasText: "المحفوظات • عِلْم" }).first();
  await replaced.getByRole("button", { name: "استرجعها" }).click();
  await expect(page.getByText("استُرجعت، وتصل إلى أجهزتك.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}").state?.bookmarks?.[0]?.label)).toBe("عِلْم");
  // two steps, then everything on the server is gone; this device keeps its own copy and is signed out
  await page.getByRole("button", { name: "احذف حسابي" }).click();
  await page.getByRole("button", { name: "اضغط مرة أخرى خلال عشر دقائق لحذف الحساب نهائيًا" }).click();
  await expect(page.getByRole("status").filter({ hasText: "حُذف الحساب وكل ما فيه على الخادم." })).toBeVisible();
  expect((await page.request.get("/api/v1/me", { headers: h })).status()).toBe(401);
  await expect(page.getByRole("banner").getByRole("button", { name: "دخول" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}").state?.bookmarks?.length)).toBe(1);
});
