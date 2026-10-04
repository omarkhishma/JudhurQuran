import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import { followSignInLink } from "./helpers";

/**
 * Maps shared for comments (P8.1-E; EDT-190…194, EDT-259, EDT-311, EDT-342, EDT-347, HWF-48): a private map stays
 * in the browser; shared, it is on the server under a link — read by anyone with it, saved by its owner as they work,
 * a save over a newer one stopped and the reader asked; comments on its cards and on the whole map, replies,
 * mentions, resolve; a marker on the card; the history; stopping the share. Real accounts through the development
 * outbox; expectations read from the API and the browser's own store.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string } };
type Doc = { id: string; updatedAt: number; pendingLayout?: boolean; nodes: Card[]; shared?: { id: string; revision: number } };
type Shared = { id: string; revision: number; title: string; doc: { nodes: Card[] }; owner: { name: string | null; mine: boolean } };

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");
const tag = () => `${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function storedGraph(page: Page, id: string): Promise<Doc | undefined> {
  return page.evaluate(
    (key) =>
      new Promise<Doc | undefined>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction("keyval").objectStore("keyval").get(key);
          req.onsuccess = () => resolve(req.result as Doc | undefined);
          req.onerror = () => reject(req.error);
        };
      }),
    `jadhr-graph:${id}`,
  );
}

type Person = { ctx: BrowserContext; page: Page; h: Record<string, string>; email: string; name: string };

/** A reader with an account and a name, signed in in a window of their own. */
async function person(browser: Browser, who: string, viewport = { width: 1440, height: 900 }): Promise<Person> {
  const t = tag();
  const email = `e2e-share-${who}-${t}@example.org`;
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
  });
  const page = await ctx.newPage();
  await page.request.post("/api/v1/auth/email", { data: { email, return_to: "/graph", locale: "ar" } });
  let link = "";
  await expect
    .poll(async () => {
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      return (link = m.at(-1)?.link ?? "");
    })
    .not.toBe("");
  const u = new URL(link);
  await followSignInLink(page, u.pathname + u.search);
  await expect(page).toHaveURL(/\/graph/);
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  const name = `${who === "o" ? "صاحبة" : "قارئ"}-${t.slice(-6)}`;
  await page.request.patch("/api/v1/me", { headers: h, data: { display_name: name } });
  return { ctx, page, h, email, name };
}

async function drop(p: Person) {
  const c = (await (await p.page.request.post("/api/v1/me/delete", { headers: p.h })).json().catch(() => ({}))) as { confirm?: string };
  if (c.confirm) await p.page.request.post("/api/v1/me/delete/confirm", { headers: p.h, data: { confirm: c.confirm } });
  await p.ctx.close();
}

/** A map from a word, laid out and saved: its id. */
async function newMap(page: Page): Promise<string> {
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  return id;
}

async function addNote(page: Page, text: string) {
  await page.locator(".zoom-pill-pct").click();
  const boxes = page.getByRole("textbox", { name: "ملاحظة" });
  const n = await boxes.count();
  await page.locator(".type-tile").filter({ hasText: "ملاحظة" }).click();
  await expect(boxes).toHaveCount(n + 1);
  await boxes.nth(n).fill(text);
  await boxes.nth(n).blur();
}

/** Shared for comments through the header's dialog: the link's id. */
async function shareFromEditor(page: Page): Promise<string> {
  await page.locator(".editor-header").getByRole("button", { name: "مشاركة" }).click();
  const dialog = page.getByRole("dialog", { name: "مشاركة الخريطة" });
  await dialog.getByRole("button", { name: "شارك للتعليق وانسخ الرابط" }).click();
  const box = dialog.getByRole("textbox", { name: "رابط الخريطة المشتركة" });
  await expect(box).toHaveValue(/\/graph\/shared\/[0-9a-f-]{36}$/);
  const gid = (await box.inputValue()).split("/graph/shared/")[1];
  await dialog.getByRole("button", { name: "أغلق" }).click();
  return gid;
}

/** What a page asks again when the reader comes back to it, asked now. */
const comeBack = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

const shared = async (page: Page, gid: string) => (await (await page.request.get(`/api/v1/graphs/${gid}`)).json()) as Shared;

test("a map shared for comments: its link, the owner's saves following it, comments with a reply, a mention and resolve, the card's marker, a newer save offered to the reader (P8.1-E)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows; the phone has its own test");
  test.setTimeout(180_000);
  const o = await person(browser, "o");
  const r = await person(browser, "r");
  try {
    // private until shared: the comments tab says so and offers the share
    const id = await newMap(o.page);
    const details = o.page.getByRole("complementary", { name: "التفاصيل" });
    await details.getByRole("tab", { name: "التعليقات" }).click();
    await expect(details).toContainText("التعليقات للخريطة المشتركة");
    await details.getByRole("button", { name: "مشاركة للتعليق" }).click();
    const dialog = o.page.getByRole("dialog", { name: "مشاركة الخريطة" });
    await dialog.getByRole("button", { name: "شارك للتعليق وانسخ الرابط" }).click();
    const linkBox = dialog.getByRole("textbox", { name: "رابط الخريطة المشتركة" });
    await expect(linkBox).toHaveValue(/\/graph\/shared\/[0-9a-f-]{36}$/);
    const gid = (await linkBox.inputValue()).split("/graph/shared/")[1];
    await dialog.getByRole("button", { name: "أغلق" }).click();
    // the server holds the map as saved; this browser's copy knows its link
    const first = await shared(o.page, gid);
    expect(first.doc.nodes.length).toBe((await storedGraph(o.page, id))!.nodes.length);
    await expect.poll(async () => (await storedGraph(o.page, id))?.shared?.id, { timeout: 10_000 }).toBe(gid);
    await expect(o.page.locator(".shared-pill")).toContainText("مشتركة للتعليق");

    // the owner's saves follow: a note, then the shared copy holds it under the next revision
    await addNote(o.page, "سؤال للنقاش");
    await expect.poll(async () => (await shared(o.page, gid)).doc.nodes.some((n) => n.data.text === "سؤال للنقاش"), { timeout: 15_000 }).toBe(true);
    const rev = (await shared(o.page, gid)).revision;
    expect(rev).toBeGreaterThan(first.revision);
    await expect.poll(async () => (await storedGraph(o.page, id))?.shared?.revision, { timeout: 10_000 }).toBe(rev);

    // the owner turns to the card's meaning: the comments are not in front of them while the reader writes
    await details.getByRole("tab", { name: "المعنى" }).click();

    // the reader: read-only, the owner named, Meaning and Comments only
    await r.page.goto(`/graph/shared/${gid}`);
    await expect(r.page.locator(".editor-header")).toContainText(`شاركها ${o.name}`);
    await expect(r.page.locator(".editor-header")).toContainText("للقراءة والتعليق");
    const rd = r.page.getByRole("complementary", { name: "التفاصيل" });
    await expect(rd.getByRole("tab")).toHaveText(["المعنى", "التعليقات"]);
    await expect(r.page.getByRole("textbox", { name: "ملاحظة" })).toHaveCount(0);
    // a comment on a card: selected on the canvas, written below, sent with Enter
    await r.page.getByRole("button", { name: "ملاءمة" }).click();
    await r.page.locator('.react-flow__node[data-id="lemma:alamin"]').click();
    await rd.getByRole("tab", { name: "التعليقات" }).click();
    await expect(rd).toContainText("لا تعليقات على هذه البطاقة بعد");
    const box = rd.getByRole("textbox", { name: "تعليقك" });
    await box.fill("ما المقصود بالعالمين هنا؟");
    await box.press("Enter");
    const thread = rd.locator(".comment-thread").first();
    await expect(thread).toContainText("ما المقصود بالعالمين هنا؟");
    // the card's Arabic, as the map has it, anchors the comment
    await expect(thread.locator(".comment-anchor")).toHaveText(String(first.doc.nodes.find((n) => n.id === "lemma:alamin")!.data.ar));
    // a comment on the whole map, mentioning the owner by choosing her from the list @ opens
    await r.page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(rd.getByText("حدّد بطاقة ليكون التعليق عليها، أو علّق على الخريطة كلها.")).toBeVisible();
    await box.fill(`شكرًا @${o.name.slice(0, 4)}`);
    await expect(rd.getByRole("option", { name: o.name })).toBeVisible();
    await box.press("Enter");
    await box.press("Enter");
    await expect(rd.locator(".comment-body .mention").first()).toHaveText(`@${o.name}`);
    const page1 = (await (await r.page.request.get(`/api/v1/graphs/${gid}/comments`, { headers: r.h })).json()) as { data: { node_id: string | null; mentions: { name: string }[]; body: string }[] };
    expect(page1.data.map((c) => c.node_id)).toEqual(["lemma:alamin", null]);
    expect(page1.data[1].mentions.map((m) => m.name)).toEqual([o.name]);

    // the owner: what is new on My maps, then the card's marker opens its comments; a reply, and the thread resolved
    await o.page.goto("/graph");
    const row = o.page.getByRole("main").locator(`a[href="/graph/edit/${id}"]`);
    await expect(row).toContainText("مشتركة للتعليق");
    await expect(row).toContainText("تعليقان جديدان");
    await expect(row).toContainText("يذكرك تعليق");
    await row.click();
    const marker = o.page.locator('.react-flow__node[data-id="lemma:alamin"] .comment-marker');
    await expect(marker).toHaveText("١");
    await marker.click();
    await expect(o.page.locator('.react-flow__node[data-id="lemma:alamin"].selected')).toHaveCount(1);
    await expect(details.getByRole("tab", { name: "التعليقات" })).toHaveAttribute("aria-selected", "true");
    const ot = details.locator(".comment-thread").first();
    await expect(ot).toContainText(r.name);
    await ot.getByRole("button", { name: "ردّ" }).click();
    const reply = details.getByRole("textbox", { name: "ردّك" });
    await reply.fill("في هذا الموضع: كل ما سوى الله");
    await reply.press("Enter");
    await expect(ot.locator(".comment-replies")).toContainText("كل ما سوى الله");
    await ot.getByRole("button", { name: "علّمه محلولًا" }).click();
    await expect(marker).toHaveCount(0);
    await expect(details.locator(".comment-thread")).toHaveCount(0);
    await details.getByRole("checkbox", { name: /أظهر ما حُلّ/ }).check();
    await expect(details.locator(".comment-thread.is-resolved")).toHaveCount(1);

    // the owner saves again: the reader is offered the newer save, not pushed into it
    await addNote(o.page, "ملاحظة ثانية");
    await expect.poll(async () => (await shared(o.page, gid)).doc.nodes.some((n) => n.data.text === "ملاحظة ثانية"), { timeout: 15_000 }).toBe(true);
    await expect(r.page.getByText("ملاحظة ثانية")).toHaveCount(0);
    await comeBack(r.page);
    await r.page.getByRole("button", { name: "اعرض الجديد" }).click({ timeout: 40_000 });
    await expect(r.page.getByText("ملاحظة ثانية")).toBeVisible();
    // the reader's own copy
    await r.page.getByRole("button", { name: "احفظ نسخة في خرائطي" }).click();
    await expect(r.page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/);
  } finally {
    await drop(r);
    await drop(o);
  }
});

test("a save over a newer shared copy stops and asks; the shared copy opens in its place; stopping the share ends the link, and deleting a shared map stops it (P8.1-E)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "desktop windows");
  test.setTimeout(120_000);
  const o = await person(browser, "o");
  try {
    const id = await newMap(o.page);
    await o.page.locator(".editor-header").getByRole("button", { name: "مشاركة" }).click();
    const dialog = o.page.getByRole("dialog", { name: "مشاركة الخريطة" });
    await dialog.getByRole("button", { name: "شارك للتعليق وانسخ الرابط" }).click();
    const gid = (await dialog.getByRole("textbox", { name: "رابط الخريطة المشتركة" }).inputValue()).split("/graph/shared/")[1];
    await dialog.getByRole("button", { name: "أغلق" }).click();
    await expect.poll(async () => (await storedGraph(o.page, id))?.shared?.revision, { timeout: 10_000 }).toBe(1);
    // the owner's other device saves the shared copy (a note there)
    const there = await shared(o.page, gid);
    const note = { id: "note:elsewhere", position: { x: 0, y: -400 }, data: { kind: "note", text: "من الجهاز الآخر" } };
    const put = await o.page.request.put(`/api/v1/graphs/${gid}`, { headers: o.h, data: { title: there.title, doc: { version: 2, nodes: [...there.doc.nodes, note], edges: [] }, base: there.revision } });
    expect(put.status()).toBe(200);
    // a change here is saved here, and stopped before the shared copy: the reader chooses
    await addNote(o.page, "من هنا");
    await expect(o.page.locator(".graph-conflict")).toContainText("حُفظت النسخة المشتركة من جهاز آخر");
    expect((await shared(o.page, gid)).doc.nodes.some((n) => n.data.text === "من هنا")).toBe(false);
    await o.page.getByRole("button", { name: "افتح النسخة المشتركة" }).click();
    await expect(o.page.getByText("من الجهاز الآخر")).toBeVisible();
    await expect.poll(async () => (await storedGraph(o.page, id))?.shared?.revision, { timeout: 10_000 }).toBe(2);
    // stopping the share: the link no longer opens; the map stays here, private
    await o.page.locator(".editor-header").getByRole("button", { name: "مشاركة" }).click();
    await dialog.getByRole("button", { name: "أوقف المشاركة" }).click();
    await dialog.getByRole("button", { name: "أوقف المشاركة" }).last().click();
    await expect(dialog.getByRole("status")).toHaveText("أُوقفت المشاركة.");
    expect((await o.page.request.get(`/api/v1/graphs/${gid}`)).status()).toBe(404);
    await expect.poll(async () => (await storedGraph(o.page, id))?.shared ?? null, { timeout: 10_000 }).toBeNull();
    const reader = await browser.newPage();
    await reader.goto(`/graph/shared/${gid}`);
    await expect(reader.getByRole("heading", { name: "لم تعد هذه الخريطة مشتركة" })).toBeVisible();
    await reader.close();
    // shared again and deleted from My maps: the shared copy goes with it
    await dialog.getByRole("button", { name: "شارك للتعليق وانسخ الرابط" }).click();
    const gid2 = (await dialog.getByRole("textbox", { name: "رابط الخريطة المشتركة" }).inputValue()).split("/graph/shared/")[1];
    await dialog.getByRole("button", { name: "أغلق" }).click();
    await expect.poll(async () => (await storedGraph(o.page, id))?.shared?.id, { timeout: 10_000 }).toBe(gid2);
    await o.page.goto("/graph");
    const li = o.page.getByRole("main").locator("li").filter({ has: o.page.locator(`a[href="/graph/edit/${id}"]`) });
    await li.getByRole("button", { name: "حذف" }).click();
    await li.getByRole("button", { name: "انقر مرة أخرى للحذف وإيقاف المشاركة" }).click();
    await expect.poll(async () => (await o.page.request.get(`/api/v1/graphs/${gid2}`)).status(), { timeout: 10_000 }).toBe(404);
  } finally {
    await drop(o);
  }
});

test("a private map's history: kept in this browser, restored as one step that undoes (P8.1-E, EDT-259)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details are the desktop's (P8.6a)");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  const id = await newMap(page);
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await addNote(page, "ملاحظة بعد النسخة");
  await expect.poll(async () => (await storedGraph(page, id))?.nodes.some((n) => n.data.text === "ملاحظة بعد النسخة"), { timeout: 10_000 }).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
  await details.getByRole("tab", { name: "الإعدادات" }).click();
  await expect(details).toContainText("سجل النسخ");
  await expect(details).toContainText("محفوظة في هذا المتصفح وحده");
  const versions = details.getByRole("button", { name: "استعد" });
  await expect(versions).toHaveCount(1);
  await versions.click();
  await expect.poll(async () => (await storedGraph(page, id))?.nodes.some((n) => n.data.text === "ملاحظة بعد النسخة"), { timeout: 10_000 }).toBe(false);
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  await expect(undo).toHaveAttribute("title", /^تراجع: استعادة نسخة /);
  await undo.click();
  await expect.poll(async () => (await storedGraph(page, id))?.nodes.some((n) => n.data.text === "ملاحظة بعد النسخة"), { timeout: 10_000 }).toBe(true);
  // the map's settings say it is private
  await expect(details).toContainText("خاصة: لا يراها غيرك.");
});

test("on the phone, a shared map's comments open in a sheet; signed out, the reader is asked to sign in (P8.1-E)", async ({ browser, page, isMobile }) => {
  test.skip(!isMobile, "the phone's sheet");
  test.setTimeout(120_000);
  const o = await person(browser, "o");
  try {
    const id = await newMap(o.page);
    const made = await storedGraph(o.page, id);
    const s = (await (await o.page.request.post("/api/v1/graphs", { headers: o.h, data: { local_id: id, title: "خريطة", kind: "free", doc: { version: 2, nodes: made!.nodes, edges: [] } } })).json()) as { id: string };
    await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
    await page.goto(`/graph/shared/${s.id}`);
    await page.locator(".editor-header").getByRole("button", { name: "التعليقات" }).click();
    const sheet = page.getByRole("dialog", { name: "التعليقات" });
    await expect(sheet).toContainText("ادخل بحسابك لتقرأ التعليقات وتكتب تعليقك.");
    await expect(sheet.getByRole("link", { name: "ادخل لتعلّق" })).toHaveAttribute("href", new RegExp(`/signin\\?next=.*graph%2Fshared%2F${s.id}`));
    const axe = await new AxeBuilder({ page }).include(".comments-sheet").analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await sheet.getByRole("button", { name: "أغلق" }).click();
    await expect(sheet).toHaveCount(0);
  } finally {
    await drop(o);
  }
});

test("the shared map's page and its comments pass axe in both themes (P8.1-E)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the desktop's details");
  test.setTimeout(120_000);
  const o = await person(browser, "o");
  try {
    const id = await newMap(o.page);
    const s = { id: await shareFromEditor(o.page) };
    await o.page.request.post(`/api/v1/graphs/${s.id}/comments`, { headers: o.h, data: { body: "تعليق للفحص", node_id: "lemma:alamin", anchor: "العالمين" } });
    for (const theme of ["light", "dark"]) {
      // the owner is sent to their own copy: the page is read in a window of a reader's, signed out
      const viewer = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const v = await viewer.newPage();
      await v.addInitScript((th) => {
        localStorage.setItem("jadhr-theme", th);
        localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
      }, theme);
      await v.goto(`/graph/shared/${s.id}`);
      await v.getByRole("complementary", { name: "التفاصيل" }).getByRole("tab", { name: "التعليقات" }).click();
      await expect(v.getByRole("link", { name: "ادخل لتعلّق" })).toBeVisible();
      await v.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: v }).analyze();
      expect(axe.violations.map((x) => `${theme}: ${x.id}`)).toEqual([]);
      await viewer.close();
    }
    // the owner's own Comments, with a thread
    await o.page.goto(`/graph/edit/${id}`);
    const details = o.page.getByRole("complementary", { name: "التفاصيل" });
    await details.getByRole("tab", { name: "التعليقات" }).click();
    await expect(details.locator(".comment-thread")).toHaveCount(1);
    const axe = await new AxeBuilder({ page: o.page }).include(".graph-details").analyze();
    expect(axe.violations.map((x) => x.id)).toEqual([]);
  } finally {
    await drop(o);
  }
});
