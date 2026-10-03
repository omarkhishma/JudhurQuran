import { expect, type Page, test } from "@playwright/test";
import { compressToEncodedURIComponent } from "lz-string";
import { api } from "./helpers";

/**
 * The graph editor as built, after the P8.0 fixes (research 13 §2): what a map shows is read from the dataset,
 * what the reader does is what is stored, and nothing else is. Expectations come from the API and from the map
 * stored in this browser's IndexedDB.
 */

type Card = { id: string; position: { x: number; y: number }; data: Record<string, unknown> & { kind: string; verse?: Record<string, unknown> } };
type Doc = { id: string; title: string; kind: string; updatedAt: number; pendingLayout?: boolean; nodes: Card[]; edges: { id: string; source: string; target: string; label?: string; data?: Record<string, unknown> }[] };
type Verse = { key: string; tokens: { text: string }[]; words: { location: string; token_from: number; token_to: number }[] };

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

/** A share link's fragment, as the editor writes one (lib/graph/persist encodeShare) — here, written by anyone. */
const shareFragment = (slim: object) => compressToEncodedURIComponent(JSON.stringify(slim));

test("a shared map draws its verses from the dataset, never from the link (F3, law L1)", async ({ page }) => {
  const v = await api<Verse>(page, "/verses/2:255");
  const w = v.words[4];
  const forged = {
    t: "خريطة",
    k: "free",
    n: [
      ["verse:2:255", 0, 0, { kind: "verse", ar: "2:255", verse: { key: "2:255", surahName: "سورة مزورة", left: "نص مزور", word: "مزور", right: "نص مزور" } }],
      [`verse:${w.location}`, 420, 0, { kind: "verse", verse: { key: "2:255", location: w.location, left: "نص مزور", word: "مزور", right: "" } }],
      [`word:${w.location}`, 0, 300, { kind: "word", ar: "مزور", verse: { key: "2:255", location: w.location, left: "نص مزور", word: "مزور", right: "" } }],
      ["evil", 0, 600, { kind: "script", ar: "مزور" }],
    ],
    e: [["e1", "verse:2:255", "nowhere", ""]],
  };
  await page.goto(`/graph/view#${shareFragment(forged)}`);
  const cards = page.locator(".graph-card");
  await expect(cards).toHaveCount(3);
  await expect(page.locator(".react-flow")).not.toContainText("مزور");
  await expect(page.locator(".react-flow")).not.toContainText("سورة مزورة");
  // the whole verse, word for word as the dataset holds it
  const whole = cards.filter({ has: page.locator("p.quran") }).first();
  await expect(whole).toContainText(v.tokens.map((x) => x.text).join(" "));
  await expect(whole).toContainText("البقرة: ٢٥٥");
  // an occurrence is cut around its word, and says so on both sides
  const occ = page.locator(`.react-flow__node[data-id="verse:${w.location}"] p.quran`);
  const word = v.tokens.slice(w.token_from - 1, w.token_to).map((x) => x.text).join(" ");
  await expect(occ.locator("mark")).toHaveText(word);
  await expect(occ).toContainText("…");
  // a word card's headline is the word at its place
  await expect(page.locator(`.react-flow__node[data-id="word:${w.location}"] p.quran`).first()).toHaveText(word);
});

/** Write a stored map as another tab or a sync from another device would: newer, with a card of its own. */
async function writeElsewhere(page: Page, id: string, change: "newer" | "gone") {
  await page.evaluate(
    ([key, how]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction("keyval", "readwrite").objectStore("keyval");
          if (how === "gone") {
            const del = store.delete(key);
            del.onsuccess = () => resolve();
            return;
          }
          const get = store.get(key);
          get.onsuccess = () => {
            const doc = get.result;
            doc.nodes.push({ id: "note:elsewhere", type: "card", position: { x: 0, y: -400 }, data: { kind: "note", text: "كُتبت في مكان آخر" } });
            doc.updatedAt = Date.now() + 1000;
            const put = store.put(doc, key);
            put.onsuccess = () => resolve();
          };
        };
      }),
    [`jadhr-graph:${id}`, change] as const,
  );
}

async function editorId(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  return page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
}

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");

async function addNote(page: Page, text: string) {
  const boxes = page.getByRole("textbox", { name: "ملاحظة" });
  const n = await boxes.count();
  await page.getByRole("complementary", { name: "أضف بطاقة" }).getByRole("button", { name: "ملاحظة" }).click();
  await expect(boxes).toHaveCount(n + 1);
  const box = boxes.nth(n);
  await box.fill(text);
  await box.blur();
}

test("a map reopened by a link in the same tab shows the work done since, and opening it writes nothing (F1)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the header's links and ⌘K are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await addNote(page, "ملاحظتي");
  await expect.poll(async () => (await storedGraph(page, id))?.nodes.some((n) => n.data.text === "ملاحظتي"), { timeout: 10_000 }).toBe(true);
  const saved = (await storedGraph(page, id))!.updatedAt;

  // away and back by the app's own links: My maps, then the map
  await page.getByRole("banner").getByRole("link", { name: "الخريطة", exact: true }).click();
  await expect(page).toHaveURL(/\/graph$/);
  await page.getByRole("main").locator(`a[href="/graph/edit/${id}"]`).click();
  await expect(page.getByRole("textbox", { name: "ملاحظة" })).toHaveValue("ملاحظتي");
  await page.waitForTimeout(1500);
  expect((await storedGraph(page, id))!.updatedAt, "opening is not an edit").toBe(saved);

  // a hand-off into this map from the reader, reached without reloading the page
  await page.getByRole("banner").getByRole("button", { name: /بحث/ }).click();
  const box = page.getByRole("combobox", { name: /اكتب كلمة أو جذرًا/ });
  await box.fill("2:255");
  await expect(page.getByRole("option").first()).toContainText("آية");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/quran\/2\/255$/);
  await page.locator('.w[data-w="2:255:3"]').click();
  await page.locator(".reader-panel").getByRole("button", { name: "افتح في الخريطة" }).click();
  const dialog = page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" });
  await dialog.getByRole("combobox").selectOption(id);
  await dialog.getByRole("link", { name: "افتح محرر الخرائط" }).click();
  expect(await editorId(page)).toBe(id);
  await expect(page.locator('.react-flow__node[data-id="root:أله"]')).toBeVisible();
  await expect(page.getByRole("textbox", { name: "ملاحظة" })).toHaveValue("ملاحظتي");
  await page.waitForTimeout(1500);
  const after = (await storedGraph(page, id))!;
  expect(after.nodes.some((n) => n.id === "root:أله"), "the hand-off's cards stay stored").toBe(true);
  expect(after.nodes.some((n) => n.data.text === "ملاحظتي")).toBe(true);
});

test("a map changed elsewhere is never written over: opened afresh when nothing is unsaved, else the reader chooses (F1)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await page.getByRole("button", { name: "خريطة حرة" }).click();
  const id = await editorId(page);
  await addNote(page, "الأولى");
  await expect.poll(async () => (await storedGraph(page, id))?.nodes.length, { timeout: 10_000 }).toBe(1);

  // nothing unsaved here: the newer copy opens, and says so
  await writeElsewhere(page, id, "newer");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator('.react-flow__node[data-id="note:elsewhere"]')).toBeVisible();
  await expect(page.getByText("فُتحت أحدث نسخة من هذه الخريطة")).toBeVisible();

  // a change here while another copy is written: the reader is asked, and their work becomes a map of its own
  await addNote(page, "الثانية");
  await writeElsewhere(page, id, "newer");
  await expect(page.getByRole("alert").filter({ hasText: "تغيّرت هذه الخريطة" })).toBeVisible({ timeout: 10_000 });
  const stored = (await storedGraph(page, id))!;
  expect(stored.nodes.some((n) => n.data.text === "الثانية"), "not written over the newer copy").toBe(false);
  await page.getByRole("button", { name: "احفظ عملي خريطةً جديدة" }).click();
  await expect(page).not.toHaveURL(new RegExp(`/graph/edit/${id}$`));
  const copy = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, copy))?.nodes.some((n) => n.data.text === "الثانية")).toBe(true);
  expect((await storedGraph(page, copy))!.title).toContain("(نسختي)");

  // deleted elsewhere: nothing is written back
  await addNote(page, "الثالثة");
  await writeElsewhere(page, copy, "gone");
  await expect(page.getByRole("alert").filter({ hasText: "حُذفت هذه الخريطة" })).toBeVisible({ timeout: 10_000 });
  expect(await storedGraph(page, copy)).toBeUndefined();
});
