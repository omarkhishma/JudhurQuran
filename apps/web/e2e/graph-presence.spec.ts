import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { drop, person, tag } from "./board";

/**
 * Presence and the soft lock (P8.6, D5; EDT-014, EDT-296, EDT-297): one window edits a map — between this browser's
 * tabs for any map — and another is told, shows it read-only, follows its saves and may take it; on a shared map,
 * who is there now, the signed-in by name, shown to the owner's editor and to its readers, and the owner's windows
 * locked across the server. Expectations read from the page, the browser's store and the API.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string } };
type Doc = { nodes: Card[]; pendingLayout?: boolean; shared?: { id: string; revision: number } };

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

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");

async function newMap(page: Page): Promise<string> {
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  return id;
}

async function addNote(page: Page, text: string) {
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  await page.locator(".zoom-pill-pct").click();
  const boxes = page.getByRole("textbox", { name: "ملاحظة" });
  const n = await boxes.count();
  await page.locator(".type-tile").filter({ hasText: "ملاحظة" }).click();
  await expect(boxes).toHaveCount(n + 1);
  await boxes.nth(n).fill(text);
  await boxes.nth(n).blur();
}

test("two tabs on one map: the second is told the first edits, shows it to read and follows its saves; it takes the map, and when it closes the first edits again (P8.6, D5)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the map editor is the desktop's (P8.6a)");
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
  });
  const id = await newMap(page);
  await expect(page.locator(".graph-lock")).toHaveCount(0);
  const two = await page.context().newPage();
  await two.goto(`/graph/edit/${id}`);
  const lock = two.locator(".graph-lock");
  await expect(lock).toContainText("هذه الخريطة مفتوحة للتحرير في نافذة أخرى");
  // read-only: no library to add from, no undo
  await expect(two.getByRole("complementary", { name: "المكتبة" })).toHaveCount(0);
  const axe = await new AxeBuilder({ page: two }).include(".graph-lock").include(".editor-header").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  // taken: the second edits, the first is told
  await two.getByRole("button", { name: "حرر هنا" }).click();
  await expect(lock).toHaveCount(0);
  await expect(page.locator(".graph-lock")).toBeVisible();
  // what the second saves, the first shows
  await addNote(two, "من النافذة الثانية");
  await expect.poll(async () => (await storedGraph(two, id))?.nodes.some((n) => n.data.text === "من النافذة الثانية"), { timeout: 10_000 }).toBe(true);
  await expect(page.locator(".react-flow__node").filter({ hasText: "من النافذة الثانية" })).toHaveCount(1, { timeout: 10_000 });
  // the second closes: the first edits again, from the latest copy
  await two.close();
  await expect(page.locator(".graph-lock")).toHaveCount(0, { timeout: 25_000 });
  await expect(page.getByRole("textbox", { name: "ملاحظة" }).first()).toHaveValue("من النافذة الثانية");
});

test("a shared map's presence: the owner's editor and a reader's page each show who is there, the signed-in by name; the owner's second window is locked across the server (P8.6, EDT-014, EDT-296, EDT-297)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(150_000);
  const t = tag();
  const o = await person(browser, `e2e-pres-o-${t}@example.org`);
  const r = await person(browser, `e2e-pres-r-${t}@example.org`);
  const oName = `صاحبة-${t.slice(-5)}`;
  const rName = `قارئ-${t.slice(-5)}`;
  await o.page.request.patch("/api/v1/me", { headers: o.h, data: { display_name: oName } });
  await r.page.request.patch("/api/v1/me", { headers: r.h, data: { display_name: rName } });
  try {
    const id = await newMap(o.page);
    await o.page.locator(".editor-header").getByRole("button", { name: "مشاركة" }).click();
    const dialog = o.page.getByRole("dialog", { name: "مشاركة الخريطة" });
    await dialog.getByRole("button", { name: "شارك للتعليق وانسخ الرابط" }).click();
    const gid = (await dialog.getByRole("textbox", { name: "رابط الخريطة المشتركة" }).inputValue()).split("/graph/shared/")[1];
    await dialog.getByRole("button", { name: "أغلق" }).click();
    // the owner alone, «مباشر»
    const mine = o.page.locator(".editor-header .presence");
    await expect(mine).toHaveAttribute("aria-label", /على الخريطة الآن: أنت \(يحررها\)/);
    await expect(mine).toContainText("مباشر");
    // a reader opens the link: each sees the other
    await r.page.goto(`/graph/shared/${gid}`);
    const theirs = r.page.locator(".editor-header .presence");
    await expect(theirs).toHaveAttribute("aria-label", new RegExp(`أنت.*${oName} \\(يحررها\\)`));
    await expect(mine).toHaveAttribute("aria-label", new RegExp(rName));
    await expect(o.page.locator(".editor-header .presence-avatar")).toHaveCount(2);
    const axe = await new AxeBuilder({ page: r.page }).include(".editor-header").analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    // the reader leaves: the owner is alone again
    await r.page.goto("/graph");
    await expect(mine).not.toHaveAttribute("aria-label", new RegExp(rName), { timeout: 15_000 });
    // the owner's second window, in another browser (another device): told, then takes it
    const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const second = await other.newPage();
    await second.addInitScript(([s]) => {
      localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
      localStorage.setItem("jadhr-auth", s);
    }, [await o.page.evaluate(() => localStorage.getItem("jadhr-auth") ?? "")]);
    // the map arrives in that browser as the owner's shared map (as sync or "open mine" would bring it)
    await second.goto(`/graph/shared/${gid}`);
    await second.getByRole("button", { name: "افتحها في المحرر" }).click();
    await expect(second).toHaveURL(new RegExp(`/graph/edit/${id}`), { timeout: 30_000 });
    await expect(second.locator(".graph-lock")).toContainText("مفتوحة للتحرير في نافذة أخرى");
    await second.getByRole("button", { name: "حرر هنا" }).click();
    await expect(second.locator(".graph-lock")).toHaveCount(0);
    await expect(o.page.locator(".graph-lock")).toBeVisible();
    await other.close();
    await expect(o.page.locator(".graph-lock")).toHaveCount(0, { timeout: 25_000 });
  } finally {
    await drop(o);
    await drop(r);
  }
});
