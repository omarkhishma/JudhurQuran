import { expect, type Page, test } from "@playwright/test";
import { compressToEncodedURIComponent } from "lz-string";
import { api, ar, arCount } from "./helpers";

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

test("deleting a card takes its wires in one step that undo brings back whole, and every step is named (F2, F9)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the Delete key and the mouse are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  // the minimap sits over whichever card the layout puts beneath it; it is not what this test is about
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const before = (await storedGraph(page, id))!;
  const lemma = before.nodes.find((n) => n.data.kind === "lemma" && n.data.focus)!;
  const wires = before.edges.filter((e) => e.source === lemma.id || e.target === lemma.id);
  expect(wires.length, "the lemma card has wires").toBeGreaterThan(1);
  const undo = page.getByRole("button", { name: "تراجع", exact: true });

  await page.locator(`.react-flow__node[data-id="${lemma.id}"]`).click({ position: { x: 40, y: 14 } });
  await page.keyboard.press("Delete");
  await expect(page.locator(`.react-flow__node[data-id="${lemma.id}"]`)).toHaveCount(0);
  await expect(undo).toHaveAttribute("title", "تراجع: حذف بطاقة");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.some((n) => n.id === lemma.id), { timeout: 10_000 }).toBe(false);
  const deleted = (await storedGraph(page, id))!;
  expect(deleted.edges.filter((e) => e.source === lemma.id || e.target === lemma.id), "no wire is left to a deleted card").toEqual([]);
  expect(deleted.edges).toHaveLength(before.edges.length - wires.length);

  // one undo brings the card and every wire back
  await page.keyboard.press("Control+z");
  await expect(page.locator(`.react-flow__node[data-id="${lemma.id}"]`)).toHaveCount(1);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.length, { timeout: 10_000 }).toBe(before.edges.length);
  await expect(undo).toBeDisabled();

  // folding is saved and is not an undo step (the cards of the first view: the word read and its verse)
  const verse = before.nodes.find((n) => n.id === "verse:1:2:4")!;
  const word = before.nodes.find((n) => n.data.kind === "word" && n.data.focus)!;
  await page.locator(`.react-flow__node[data-id="${verse.id}"]`).getByRole("button", { name: "طيّ البطاقة" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === verse.id)?.data.folded, { timeout: 10_000 }).toBe(true);
  await expect(undo).toBeDisabled();

  // a link and a move are named by what they did
  const card = page.locator(`.react-flow__node[data-id="${word.id}"]`);
  // hover() waits until each handle is still and nothing covers it
  await page.locator(`.react-flow__node[data-id="${verse.id}"] .react-flow__handle-left`).hover();
  await page.mouse.down();
  await card.locator(".react-flow__handle-right").hover();
  await page.mouse.up();
  await expect(undo).toHaveAttribute("title", `تراجع: ربط ١:٢ ← ${word.data.form}`);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.some((e) => e.source === verse.id && e.target === word.id), { timeout: 10_000 }).toBe(true);
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 14);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(undo).toHaveAttribute("title", "تراجع: نقل بطاقة");
});

test("counts read as Arabic and English count them (F10, QAN-14)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  // a trail of two steps and one of three, titled in the reader's digits and number
  await page.goto(`/graph/seed?s=${seedParam({ seed: "trail", steps: [{ kind: "verse", id: "1:2" }, { kind: "root", id: "رحم" }] })}`);
  const two = await editorId(page);
  await expect(page.getByRole("textbox", { name: "إعادة التسمية" })).toHaveValue("مسار قراءة (خطوتان)");
  await page.goto(`/graph/seed?s=${seedParam({ seed: "trail", steps: [{ kind: "word", id: "alamin" }, { kind: "verse", id: "1:2" }, { kind: "root", id: "رحم" }] })}`);
  await editorId(page);
  await expect(page.getByRole("textbox", { name: "إعادة التسمية" })).toHaveValue("مسار قراءة (٣ خطوات)");
  // My maps counts each map's cards
  const n = (await storedGraph(page, two))!.nodes.length;
  await page.goto("/graph");
  await expect(page.locator(`a[href="/graph/edit/${two}"]`)).toContainText(arCount(n, { one: "بطاقة واحدة", two: "بطاقتان", few: "# بطاقات", many: "# بطاقة", other: "# بطاقة" }));
  // a lemma card's further forms
  const g = await api<{ lemmas: { id: number; forms: unknown[] }[] }>(page, `/roots/${encodeURIComponent("علم")}/graph`);
  const many = g.lemmas.find((l) => l.forms.length > 4)!;
  await page.goto(`/graph/root/${encodeURIComponent("علم")}`);
  await expect(page.locator(`.react-flow__node[data-id="lemma:${many.id}"]`)).toContainText(
    arCount(many.forms.length - 3, { one: "+صيغة أخرى", two: "+صيغتان أخريان", few: "+# صيغ أخرى", many: "+# صيغة أخرى", other: "+# صيغة أخرى" }),
  );
  await page.goto(`/en/graph/root/${encodeURIComponent("علم")}`);
  await expect(page.locator(`.react-flow__node[data-id="lemma:${many.id}"]`)).toContainText(`+${many.forms.length - 3} more forms`);
  await page.goto("/en/graph");
  await expect(page.locator(`a[href="/en/graph/edit/${two}"]`)).toContainText(n === 1 ? "1 card" : `${n} cards`);
  expect(ar(3)).toBe("٣");
});
