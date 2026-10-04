import { expect, type Page, test } from "@playwright/test";
import { compressToEncodedURIComponent } from "lz-string";
import { api, ar, arCount, followSignInLink } from "./helpers";

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
    v: 2,
    t: "خريطة",
    k: "free",
    n: [
      ["verse:2:255", 0, 0, { kind: "verse", ar: "نص مزور", verse: { key: "2:255", surahName: "سورة مزورة", left: "نص مزور", word: "مزور", right: "نص مزور" } }],
      ["verse:3:7", 420, 0, { kind: "verse", verse: { key: "3:7", left: "نص مزور" }, places: ["3:7:2", "2:255:1"] }],
      ["evil", 0, 600, { kind: "script", ar: "مزور" }],
    ],
    e: [["e1", "verse:2:255", "nowhere", { rel: "next" }]],
  };
  const v37 = await api<Verse>(page, "/verses/3:7");
  await page.goto(`/graph/view#${shareFragment(forged)}`);
  const cards = page.locator(".graph-card");
  await expect(cards).toHaveCount(2);
  await expect(page.locator(".react-flow")).not.toContainText("مزور");
  // the whole verse, word for word as the dataset holds it
  const whole = page.locator('.react-flow__node[data-id="verse:2:255"] p.quran');
  await expect(whole).toHaveText(v.tokens.map((x) => x.text).join(" "));
  await expect(page.locator('.react-flow__node[data-id="verse:2:255"]')).toContainText("البقرة: ٢٥٥");
  // one place, the verse cut around it and saying so; a place in another verse is not this verse's
  const one = v37.words[1];
  const occ = page.locator('.react-flow__node[data-id="verse:3:7"] p.quran');
  await expect(occ.locator("mark")).toHaveText(v37.tokens.slice(one.token_from - 1, one.token_to).map((x) => x.text).join(" "));
  await expect(occ).toContainText("…");

  // a link made before version 2 is read the same way: its words dropped, its verses drawn
  const v1 = {
    t: "قديمة",
    k: "free",
    n: [[`verse:${w.location}`, 0, 0, { kind: "verse", verse: { key: "2:255", location: w.location, left: "نص مزور", word: "مزور", right: "" } }]],
    e: [],
  };
  await page.goto(`/graph/view#${shareFragment(v1)}`);
  await expect(page.locator('.react-flow__node[data-id="verse:2:255"] mark')).toHaveText(v.tokens.slice(w.token_from - 1, w.token_to).map((x) => x.text).join(" "));
  await expect(page.locator(".react-flow")).not.toContainText("مزور");
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
  // at 100 %, so the note's field is not hidden by the map view
  await page.locator(".zoom-pill-pct").click();
  await expect(page.locator(".zoom-pill-pct")).toContainText("١٠٠");
  const boxes = page.getByRole("textbox", { name: "ملاحظة" });
  const n = await boxes.count();
  await page.locator(".type-tile").filter({ hasText: "ملاحظة" }).click();
  await expect(boxes).toHaveCount(n + 1);
  const box = boxes.nth(n);
  await box.fill(text);
  await box.blur();
  // brought into view if it was placed beyond it: wait for the view to settle
  await expect(box).toBeInViewport();
  await page.waitForTimeout(300);
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
  await page.locator(".editor-header").getByRole("link", { name: "خرائطي" }).click();
  await expect(page).toHaveURL(/\/graph$/);
  await page.getByRole("main").locator(`a[href="/graph/edit/${id}"]`).click();
  await expect(page.getByRole("textbox", { name: "ملاحظة" })).toHaveValue("ملاحظتي");
  await page.waitForTimeout(1500);
  expect((await storedGraph(page, id))!.updatedAt, "opening is not an edit").toBe(saved);

  // a hand-off into this map from the reader, reached without reloading the page (by My maps' search)
  await page.locator(".editor-header").getByRole("link", { name: "خرائطي" }).click();
  await expect(page).toHaveURL(/\/graph$/);
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
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });

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
  const verse = before.nodes.find((n) => n.id === "verse:1:2")!;
  await page.locator(`.react-flow__node[data-id="${verse.id}"]`).getByRole("button", { name: "طيّ البطاقة" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === verse.id)?.data.folded, { timeout: 10_000 }).toBe(true);
  await expect(undo).toBeDisabled();

  // a link that would loop back along the lexicon's spine is refused, and says why
  const card = page.locator(`.react-flow__node[data-id="${lemma.id}"]`);
  await drag(page, page.locator(`.react-flow__node[data-id="${verse.id}"] .react-flow__handle-left`), card.locator(".react-flow__handle-right"));
  await expect(page.locator(".graph-toast").filter({ hasText: "هذا الربط يصنع حلقة." })).toBeVisible();
  await expect(undo).toBeDisabled();
  // a link to a note is named by what it joins, and a move by how many cards
  await addNote(page, "عن العالمين");
  const note = page.locator('.react-flow__node[data-id^="note:"]');
  await drag(page, card.locator(".react-flow__handle-left"), note.locator(".react-flow__handle-right"));
  await expect(undo).toHaveAttribute("title", `تراجع: ربط ${lemma.data.ar} ← ملاحظة`);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.find((e) => e.source === lemma.id && e.target.startsWith("note:"))?.data, { timeout: 10_000 }).toEqual({ rel: "describes" });
  // the word in the middle of the canvas, clear of the panels, before it is moved
  await pickByFind(page, "العالمين", lemma.id);
  await page.waitForTimeout(300);
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 14);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(undo).toHaveAttribute("title", "تراجع: نقل بطاقة");
});

/** Drag a link from one handle to another; hover() waits until each is still and nothing covers it. */
async function drag(page: Page, from: ReturnType<Page["locator"]>, to: ReturnType<Page["locator"]>) {
  await from.hover();
  await page.mouse.down();
  await to.hover();
  await page.mouse.up();
}

test("a link takes a relation its map allows: chosen, changed and named, and the pairs it does not allow said in its words (P8.1a, D17, EDT-127, EDT-135, HWF-16)", async ({ page, isMobile }) => {
  test.skip(isMobile, "linking by dragging is the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await page.getByRole("button", { name: "حقل دلالي" }).click();
  const id = await editorId(page);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const palette = page.getByRole("complementary", { name: "المكتبة" }).locator("section").filter({ hasText: "أضف من المصحف والمعجم" });
  await palette.getByRole("textbox").fill("علم");
  const rows = palette.locator("li").filter({ has: page.locator(".text-root") }).filter({ hasNot: page.locator(".text-\\[18px\\].text-root") });
  await rows.nth(0).getByRole("button").click();
  await rows.nth(1).getByRole("button").click();
  const lemmas = page.locator('.react-flow__node[data-id^="lemma:"]');
  await expect(lemmas).toHaveCount(2);
  // both cards in view
  await page.getByRole("button", { name: "ملاءمة" }).click();
  await page.waitForTimeout(400);
  const [a, b] = [await lemmas.nth(0).getAttribute("data-id"), await lemmas.nth(1).getAttribute("data-id")];
  // in a semantic field two words are near in meaning until the reader says otherwise, and the relation is named
  await drag(page, lemmas.nth(0).locator(".react-flow__handle-left"), lemmas.nth(1).locator(".react-flow__handle-right"));
  await expect.poll(async () => (await storedGraph(page, id))?.edges.map((e) => [e.source, e.target, e.data?.rel])).toEqual([[a, b, "near-in-meaning"]]);
  await expect(page.locator(".wire-label")).toContainText("قريب المعنى");
  // the same pair the other way is the same link
  await drag(page, lemmas.nth(1).locator(".react-flow__handle-left"), lemmas.nth(0).locator(".react-flow__handle-right"));
  await expect(page.locator(".graph-toast").filter({ hasText: "هاتان البطاقتان مربوطتان من قبل." })).toBeVisible();
  // chosen in the link's panel, with its «فرق» and its source
  await page.locator(".react-flow__edge").first().focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(".link-panel");
  await panel.getByRole("combobox", { name: "الصلة" }).selectOption("opposite-of");
  await expect(page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true })).toHaveAttribute("title", "تراجع: جعل الصلة: ضدّ");
  await panel.getByRole("textbox", { name: "وصف الصلة (اختياري)" }).fill("الفرق بينهما");
  await panel.getByRole("textbox", { name: "المصدر" }).fill("الفروق اللغوية، ٨٨");
  await panel.getByRole("textbox", { name: "المصدر" }).blur();
  await expect
    .poll(async () => (await storedGraph(page, id))?.edges[0].data, { timeout: 10_000 })
    .toEqual({ rel: "opposite-of", label: "الفرق بينهما", source: "الفروق اللغوية، ٨٨" });

  // a root map allows no word-to-word link: said with the kinds and the map's type
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  await editorId(page);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  await palette.getByRole("textbox").fill("صبر");
  await palette.locator("li").filter({ has: page.locator(".text-root") }).filter({ hasNot: page.locator(".text-\\[18px\\].text-root") }).first().getByRole("button").click();
  const sabr = (await api<{ results: { lemmas: { slug: string }[] } }>(page, `/search?q=${encodeURIComponent("صبر")}&limit=6`)).results.lemmas[0].slug;
  const other = page.locator(`.react-flow__node[data-id="lemma:${sabr}"]`);
  await expect(other).toHaveCount(1);
  // a card placed beyond the view is brought into it: the pan settles before the drag
  await expect(other).toBeInViewport();
  await page.waitForTimeout(400);
  await drag(page, page.locator('.react-flow__node[data-id="lemma:alamin"] .react-flow__handle-left'), other.locator(".react-flow__handle-right"));
  await expect(page.locator(".graph-toast").filter({ hasText: "لا تُربط الكلمة بالكلمة في خريطة الجذر — جرّب ملاحظة." })).toBeVisible();
});

test("counts read as Arabic and English count them (F10, QAN-14)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  // a trail of two steps and one of three, titled in the reader's digits and number
  await page.goto(`/graph/seed?s=${seedParam({ seed: "trail", steps: [{ kind: "verse", id: "1:2" }, { kind: "root", id: "رحم" }] })}`);
  const two = await editorId(page);
  await expect(page.locator(".editor-title h1")).toHaveText("مسار قراءة (خطوتان)");
  await page.goto(`/graph/seed?s=${seedParam({ seed: "trail", steps: [{ kind: "word", id: "alamin" }, { kind: "verse", id: "1:2" }, { kind: "root", id: "رحم" }] })}`);
  await editorId(page);
  await expect(page.locator(".editor-title h1")).toHaveText("مسار قراءة (٣ خطوات)");
  // My maps counts each map's cards
  const n = (await storedGraph(page, two))!.nodes.length;
  await page.goto("/graph");
  await expect(page.locator(`a[href="/graph/edit/${two}"]`)).toContainText(arCount(n, { one: "بطاقة واحدة", two: "بطاقتان", few: "# بطاقات", many: "# بطاقة", other: "# بطاقة" }));
  await page.goto("/en/graph");
  await expect(page.locator(`a[href="/en/graph/edit/${two}"]`)).toContainText(n === 1 ? "1 card" : `${n} cards`);
  expect(ar(3)).toBe("٣");
});

/** Sign in by the mail link, as a reader does (the API's development outbox holds the link). */
async function signIn(page: Page, email: string) {
  const outbox = async () => ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
  const before = (await outbox()).length;
  await page.goto("/signin");
  await page.locator("main").getByLabel("بريدك الإلكتروني").fill(email);
  await page.locator("main").getByRole("button", { name: "أرسل رابط الدخول" }).click();
  let link = "";
  await expect.poll(async () => ((link = (await outbox()).length > before ? (await outbox()).at(-1)!.link : ""), link)).not.toBe("");
  const u = new URL(link);
  await followSignInLink(page, u.pathname + u.search);
  await expect(page.getByRole("link", { name: /^حسابي:/ })).toBeVisible();
}

test("the editor says where maps are kept — this browser, or with the account once signed in — and announces each save (F7, EDT-015)", async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await expect(page.getByRole("main")).toContainText("تُحفظ الخرائط في هذا المتصفح فقط");
  await page.getByRole("button", { name: "خريطة حرة" }).click();
  const id = await editorId(page);
  const pill = page.locator(".save-pill");
  await expect(pill).toHaveAttribute("role", "status");
  await expect(pill).toHaveText("حُفظت");
  await addNote(page, "أين تُحفظ");
  await expect(pill).toHaveText("تغييرات غير محفوظة");
  await expect(pill).toHaveText("حُفظت", { timeout: 10_000 });
  if (!isMobile) await expect(page.getByText("محفوظة في هذا المتصفح فقط", { exact: true })).toBeVisible();

  await signIn(page, `e2e-maps-${test.info().project.name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.org`);
  await page.goto("/graph");
  await expect(page.getByRole("main")).toContainText("تُحفظ الخرائط في هذا المتصفح وتُزامَن مع حسابك");
  await expect(page.getByRole("main")).not.toContainText("في هذا المتصفح فقط");
  await page.goto(`/graph/edit/${id}`);
  await expect(pill).toHaveText("حُفظت");
  if (!isMobile) await expect(page.getByText("محفوظة في هذا المتصفح ومع حسابك", { exact: true })).toBeVisible();
  // the account goes, as it came
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  const { confirm } = (await (await page.request.post("/api/v1/me/delete", { headers: h })).json()) as { confirm: string };
  expect((await page.request.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm } })).ok()).toBeTruthy();
});

test("My maps and the hand-off's choices hold a map as soon as it is made or renamed (F8)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the header's links and search are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await expect(page.getByText("لا خرائط بعد", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "خريطة حرة" }).click();
  const id = await editorId(page);
  await page.locator(".editor-title").click();
  await page.getByRole("textbox", { name: "إعادة التسمية" }).fill("خريطتي الجديدة");
  await page.getByRole("textbox", { name: "إعادة التسمية" }).press("Enter");
  await expect(page.locator(".save-pill")).toHaveText("حُفظت", { timeout: 10_000 });
  // back by the app's own link: the list read when the page first opened would not have it
  await page.locator(".editor-header").getByRole("link", { name: "خرائطي" }).click();
  await expect(page.getByRole("main").locator(`a[href="/graph/edit/${id}"]`)).toContainText("خريطتي الجديدة");
  // and the reader's hand-off offers it
  await page.getByRole("banner").getByRole("button", { name: /بحث/ }).click();
  const box = page.getByRole("combobox", { name: /اكتب كلمة أو جذرًا/ });
  await box.fill("2:255");
  await expect(page.getByRole("option").first()).toContainText("آية");
  await box.press("Enter");
  await page.locator('.w[data-w="2:255:3"]').click();
  await page.locator(".reader-panel").getByRole("button", { name: "افتح في الخريطة" }).click();
  await expect(page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" }).getByRole("option", { name: "خريطتي الجديدة" })).toHaveCount(1);
});

test("a map not in this browser says why, and offers My maps and signing in (F11)", async ({ page }) => {
  await page.goto("/graph/edit/notamapid00");
  await expect(page.getByRole("heading", { name: "هذه الخريطة ليست في هذا المتصفح" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("ربما حُذفت، أو حُفظت في متصفح أو جهاز آخر");
  await expect(page.getByRole("main")).not.toContainText("لا خرائط بعد");
  await expect(page.getByRole("main").getByRole("link", { name: "خرائطي" })).toHaveAttribute("href", "/graph");
  await expect(page.getByRole("main").getByRole("link", { name: "ادخل إلى حسابك" })).toHaveAttribute("href", `/signin?next=${encodeURIComponent("/graph/edit/notamapid00")}`);
});

test("a map exported keeps its type and is named from its title; a file is imported only as a map, with a report (F16)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "root", root: "رحم" })}`);
  await editorId(page);
  await expect(page.locator(".save-pill")).toHaveText("حُفظت", { timeout: 15_000 });
  const title = await page.locator(".editor-title h1").innerText();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ملف JSON" }).click()]);
  expect(download.suggestedFilename()).toBe(`${title.trim().replace(/\s+/g, "-").toLowerCase()}.json`);
  const exported = JSON.parse(await (await download.createReadStream()).toArray().then((b) => Buffer.concat(b).toString("utf8"))) as { title: string; kind: string; nodes: Card[]; edges: Doc["edges"] };
  expect(exported.kind).toBe("root");
  expect(exported.title).toBe(title);

  await page.goto("/graph");
  const input = page.locator('input[type="file"]');
  const status = page.getByRole("main").getByRole("status");
  await input.setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(status).toHaveText("هذا الملف ليس JSON صالحًا.");
  await input.setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ title: "x", edges: [] })) });
  await expect(status).toHaveText("لا يحوي هذا الملف مصفوفة البطاقات (nodes).");
  // the exported map with a card of no known kind and a wire to nowhere: both left out, and counted
  const tampered = { ...exported, nodes: [...exported.nodes, { id: "x1", position: { x: 0, y: 0 }, data: { kind: "script", ar: "x" } }], edges: [...exported.edges, { id: "e-x", source: exported.nodes[0].id, target: "nowhere" }] };
  const file = { name: "map.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(tampered)) };
  await input.setInputFiles(file);
  await expect(status).toContainText(`استُوردت الخريطة: ${arCount(exported.nodes.length, { one: "بطاقة واحدة", two: "بطاقتان", few: "# بطاقات", many: "# بطاقة", other: "# بطاقة" })}`);
  await expect(status).toContainText("وتُرك ما لا يعرفه المحرر: ٢");
  const firstId = (await status.getByRole("link", { name: "افتحها" }).getAttribute("href"))!.split("/graph/edit/")[1];
  const imported = (await storedGraph(page, firstId))!;
  expect(imported.kind).toBe("root");
  expect(imported.nodes).toHaveLength(exported.nodes.length);
  expect(imported.edges).toHaveLength(exported.edges.length);
  // the picker is cleared after each pick, so the same file can be picked again (a browser fires no change otherwise)
  await expect(input).toHaveValue("");
  await input.setInputFiles(file);
  await expect.poll(async () => (await status.getByRole("link", { name: "افتحها" }).getAttribute("href"))!.split("/graph/edit/")[1]).not.toBe(firstId);
  await expect(page.getByRole("main").locator('a[href^="/graph/edit/"]').filter({ hasText: title })).toHaveCount(3);
});

test("a word's places open in the editor by its slug, marked in verses already on the map, and a failed read says so (F18, P8.1a)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  // its verses by verse, ten new ones a time (P8.2): the first page, with the verse already on the map among them
  const page1 = await api<{ total: number; data: { verse_key: string; locations: string[] }[] }>(page, "/words/alamin/verses?limit=11");
  const card = page.locator('.react-flow__node[data-id="lemma:alamin"]');
  const button = card.locator(".extract-btn");
  // when the read fails: said, and the button works again once it can
  await page.route("**/api/v1/words/*/verses*", (r) => r.fulfill({ status: 500, body: "{}" }));
  // the card may lie beyond the canvas's view, which panning is not what this test is about: the button is pressed
  await button.dispatchEvent("click");
  await expect(page.locator(".graph-toast").filter({ hasText: "تعذّر تحميل المواضع الآن" })).toBeVisible();
  await page.unroute("**/api/v1/words/*/verses*");
  await expect(button).toBeEnabled();
  await button.dispatchEvent("click");
  // each verse is one card marking every place of the word, linked from the word at its first place
  const taken = page1.data.filter((v) => v.verse_key !== "1:2").slice(0, 10);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.filter((e) => e.source === "lemma:alamin" && e.data?.rel === "attests").length, { timeout: 10_000 }).toBe(taken.length + 1);
  const doc = (await storedGraph(page, id))!;
  for (const v of taken) {
    expect(doc.nodes.find((n) => n.id === `verse:${v.verse_key}`)?.data.places, v.verse_key).toEqual(v.locations);
    expect(doc.edges.find((e) => e.source === "lemma:alamin" && e.target === `verse:${v.verse_key}`)?.data).toEqual({ rel: "attests", place: v.locations[0] });
  }
  // the verse the reader came from was already on the map: it is not there twice (F5)
  expect(doc.nodes.filter((n) => n.id === "verse:1:2")).toHaveLength(1);
  // and the verses still to extract are counted as Arabic counts them
  await expect(card.locator(".card-stats")).toContainText(`${ar(page1.total - taken.length - 1)}للاستخراج`);
});

test("Explore's set becomes a map of its words, titled by the set, with no numbered path (F12)", async ({ page }) => {
  const set = await api<{ title_ar: string; items: { slug: string; root: { key: string } | null }[] }>(page, "/collections/doers");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/explore?set=doers");
  await page.getByRole("link", { name: "اعرضها خريطة" }).click();
  const id = await editorId(page);
  await expect(page.locator(".editor-title h1")).toHaveText(`مجموعة: ${set.title_ar}`);
  const doc = (await storedGraph(page, id))!;
  expect(doc.edges.filter((e) => e.label || e.data?.label), "no numbered links").toEqual([]);
  expect(doc.nodes.filter((n) => n.data.kind === "lemma")).toHaveLength(new Set(set.items.map((x) => x.slug)).size);
  // each word with a root is joined to it, and nothing else is joined
  for (const e of doc.edges) expect(e.source.startsWith("root:") && e.target.startsWith("lemma:"), e.id).toBe(true);
});

test("the Analyser's readings of the reader's own text are reviewed before a map, and an unsure one kept is marked as a reading (F4, HWF-22, QAN-19)", async ({ page }) => {
  const a = await api<{ tokens: { surface: string; confidence: number; candidates: { lemma: { slug: string } | null }[] }[] }>(page, `/analyse?q=${encodeURIComponent("فالعلم نور")}`);
  const low = a.tokens.find((t) => t.confidence < 0.8 && t.candidates[0]?.lemma)!;
  const ilm = { slug: low.candidates[0].lemma!.slug, root: (await api<{ root: { key: string } }>(page, `/words/${low.candidates[0].lemma!.slug}?limit=0`)).root };
  const review = async () => {
    await page.goto(`/analyse?q=${encodeURIComponent("فالعلم نور")}`);
    await page.getByRole("link", { name: "ابنِ خريطة من هذا ←" }).click();
    await expect(page.getByRole("heading", { name: "راجع القراءات قبل أن تدخل الخريطة" })).toBeVisible();
  };
  await review();
  const rows = page.locator(".seed-review li");
  await expect(rows).toHaveCount(2);
  const unsure = rows.filter({ hasText: low.surface });
  await expect(unsure).toHaveClass(/is-unsure/);
  await expect(unsure).toContainText("غير مؤكدة");
  await expect(unsure.getByRole("checkbox")).not.toBeChecked();
  await expect(rows.filter({ hasText: "نور" }).getByRole("checkbox")).toBeChecked();
  // left as it was: the unsure reading does not enter the map
  await page.getByRole("button", { name: "ابنِ الخريطة بما اخترت" }).click();
  const left = (await storedGraph(page, await editorId(page)))!;
  expect(left.nodes.some((n) => n.id === `lemma:${ilm.slug}`)).toBe(false);
  expect(left.nodes.some((n) => n.data.reading), "nothing is marked when nothing unsure was kept").toBe(false);

  // kept: marked on its card, its root reached only through it, and their links
  await review();
  await unsure.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ابنِ الخريطة بما اخترت" }).click();
  const id = await editorId(page);
  const kept = (await storedGraph(page, id))!;
  const card = kept.nodes.find((n) => n.id === `lemma:${ilm.slug}`)!;
  expect(card.data.reading).toEqual({ conf: low.confidence });
  expect(kept.nodes.find((n) => n.id === `root:${ilm.root.key}`)?.data.reading).toEqual({ conf: low.confidence });
  expect(kept.edges.filter((e) => e.target === card.id).every((e) => e.data?.reading === true)).toBe(true);
  expect(kept.nodes.find((n) => n.data.kind === "lemma" && n.id !== card.id)?.data.reading).toBeUndefined();
  await expect(page.locator(`.react-flow__node[data-id="${card.id}"] .reading-chip`)).toHaveText(
    `قراءة غير مؤكدة · ${new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(low.confidence)}`,
  );
  await expect(page.locator(".react-flow__edge.edge-reading").first()).toBeAttached();
});

test("a map saved as version 1 opens as version 2 — words by slug, one card per verse with its places — and is written as version 2 at its next change (P8.1a, F5)", async ({ page }) => {
  const alamin = await api<{ lemma_id: number }>(page, "/words/alamin?limit=0");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  const T = Date.now() - 60_000;
  const v1 = {
    version: 1,
    id: "oldmap00001",
    title: "خريطة قديمة",
    kind: "root",
    createdAt: T,
    updatedAt: T,
    nodes: [
      { id: "root:علم", type: "card", position: { x: 600, y: 0 }, data: { kind: "root", ar: "ع ل م", rootKey: "علم" } },
      { id: `lemma:${alamin.lemma_id}`, type: "card", position: { x: 300, y: 0 }, data: { kind: "lemma", ar: "عَٰلَمِين", lemmaId: alamin.lemma_id, count: 73 } },
      { id: `word:${alamin.lemma_id}:العالمين`, type: "card", position: { x: 0, y: 0 }, data: { kind: "word", lemmaId: alamin.lemma_id, form: "العالمين", count: 61, verse: { key: "1:2", location: "1:2:4" } } },
      { id: "verse:1:2:4", type: "card", position: { x: -300, y: 0 }, data: { kind: "verse", verse: { key: "1:2", location: "1:2:4" } } },
      { id: "verse:1:2", type: "card", position: { x: -300, y: 300 }, data: { kind: "verse", verse: { key: "1:2" } } },
    ],
    edges: [
      { id: "a", source: "root:علم", target: `lemma:${alamin.lemma_id}` },
      { id: "b", source: `lemma:${alamin.lemma_id}`, target: `word:${alamin.lemma_id}:العالمين` },
      { id: "c", source: `word:${alamin.lemma_id}:العالمين`, target: "verse:1:2:4" },
    ],
  };
  await page.evaluate(
    (doc) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("keyval-store");
        open.onsuccess = () => {
          const tx = open.result.transaction("keyval", "readwrite");
          tx.objectStore("keyval").put(doc, `jadhr-graph:${doc.id}`);
          tx.objectStore("keyval").put([{ id: doc.id, title: doc.title, kind: doc.kind, createdAt: doc.createdAt, updatedAt: doc.updatedAt, nodeCount: doc.nodes.length }], "jadhr-graphs-index");
          tx.oncomplete = () => resolve();
        };
      }),
    v1,
  );
  await page.goto("/graph/edit/oldmap00001");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"]')).toContainText("العالمين");
  await expect(page.locator('.react-flow__node[data-id="verse:1:2"] mark')).toHaveCount(1);
  // nothing is written until the reader changes the map
  await page.waitForTimeout(1500);
  expect((await storedGraph(page, "oldmap00001"))!.updatedAt).toBe(T);
  await addNote(page, "بعد الترحيل");
  await expect.poll(async () => (await storedGraph(page, "oldmap00001")) as unknown as { version: number }, { timeout: 10_000 }).toMatchObject({ version: 2 });
  const doc = (await storedGraph(page, "oldmap00001"))!;
  expect(doc.nodes.map((n) => n.id).sort()).toEqual(["lemma:alamin", "root:علم", "verse:1:2", doc.nodes.find((n) => n.id.startsWith("note:"))!.id].sort());
  expect(doc.nodes.find((n) => n.id === "verse:1:2")?.data.places).toEqual(["1:2:4"]);
  expect(doc.edges.map((e) => [e.source, e.target, e.data])).toEqual([
    ["root:علم", "lemma:alamin", { rel: "derives" }],
    ["lemma:alamin", "verse:1:2", { rel: "attests", place: "1:2:4" }],
  ]);
});

test("the editor has its own header: the title edited in place, the way back to My maps and to the reader at the word, details, help (P8.1-A, EDT-001…024, EDT-249)", async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  const header = page.locator(".editor-header");
  // its own header, not the site's
  await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "خرائطي" })).toHaveAttribute("href", "/graph");
  await expect(header.getByRole("link", { name: /^المصحف · / })).toHaveAttribute("href", "/quran/1?w=alamin&at=1:2:4");
  // the title: Escape leaves it, an empty one keeps the old, Enter keeps the new
  const title = header.locator(".editor-title h1");
  const was = await title.innerText();
  await header.locator(".editor-title").click();
  const input = header.getByRole("textbox", { name: "إعادة التسمية" });
  await input.fill("لن يبقى");
  await input.press("Escape");
  await expect(title).toHaveText(was);
  await header.locator(".editor-title").click();
  await input.fill("   ");
  await input.press("Enter");
  await expect(title).toHaveText(was);
  await header.locator(".editor-title").click();
  await input.fill("  عالمون  ");
  await input.press("Enter");
  await expect(title).toHaveText("عالمون");
  await expect.poll(async () => (await storedGraph(page, id))?.title, { timeout: 10_000 }).toBe("عالمون");
  // the keys, from the header's ? and from the key itself
  await header.getByRole("button", { name: "اختصارات لوحة المفاتيح" }).click();
  const help = page.getByRole("dialog", { name: "لوحة المفاتيح والمؤشر" });
  await expect(help).toContainText("ترتيب الخريطة كلها");
  await help.getByRole("button", { name: "أغلق الاختصارات" }).click();
  await expect(help).toHaveCount(0);
  if (isMobile) return;
  await page.locator(".react-flow__pane").click();
  await page.keyboard.press("?");
  await expect(help).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  // the details: the map with nothing selected, a card when one is; hidden and shown, and remembered
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await expect(details).toContainText("هذه الخريطة");
  await page.locator('.react-flow__node[data-id="verse:1:2"]').click({ position: { x: 60, y: 14 } });
  await expect(details).toContainText("١:٢");
  await details.getByRole("tab", { name: "الإعدادات" }).click();
  await expect(details).toContainText("ترد في");
  // hidden, it folds to a rail (EDT-165), and stays so when the page is opened again
  await header.getByRole("button", { name: "التفاصيل" }).click();
  await expect(page.locator(".graph-details")).toHaveCount(0);
  await expect(page.locator(".details-rail")).toBeVisible();
  await expect(header.getByRole("button", { name: "التفاصيل" })).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.locator(".graph-card").first()).toBeVisible();
  await expect(page.locator(".graph-details")).toHaveCount(0);
});

test("the library finds a card on the map, says what each kind is, adds from the dataset by kind and by dropping, and knows the map's roots (P8.1-A, EDT-032…047, QAN-15)", async ({ page, isMobile }) => {
  test.skip(isMobile, "dragging onto the canvas is the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const library = page.getByRole("complementary", { name: "المكتبة" });
  const doc = (await storedGraph(page, id))!;

  // find: folded Arabic, counted, stepped, the rest dimmed; Escape clears
  const find = library.getByRole("searchbox", { name: "ابحث عن بطاقة في الخريطة" });
  await find.fill("العالمين");
  const hits = doc.nodes.filter((n) => n.id === "lemma:alamin" || n.id === "verse:1:2").length;
  await expect(library).toContainText(`${ar(hits)} من ${ar(doc.nodes.length)} بطاقة تطابق`);
  await expect(page.locator(".react-flow__node.is-dim")).toHaveCount(doc.nodes.length - hits);
  await find.press("Enter");
  await expect(page.locator(".graph-toast")).toHaveText(`المطابقة ١ من ${ar(hits)}`);
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
  await find.press("Escape");
  await expect(page.locator(".react-flow__node.is-dim")).toHaveCount(0);
  await find.fill("لا يوجد مثله");
  await find.press("Enter");
  await expect(page.locator(".graph-toast")).toHaveText("لا شيء يطابق هذا البحث");
  await find.fill("");

  // the map's roots: on the map already, said and shown
  const root = await api<{ data: { pattern_count: number; lemma_count: number }[] }>(page, `/roots?keys=${encodeURIComponent("علم")}`);
  const tile = library.locator(".root-tile").first();
  await expect(tile).toHaveAttribute("title", "على اللوحة");
  await expect(tile).toContainText(arCount(root.data[0].lemma_count, { one: "كلمة واحدة", two: "كلمتان", few: "# كلمات", many: "# كلمة", other: "# كلمة" }));
  await tile.click();
  await expect(page.locator(".graph-toast")).toHaveText("هذا الجذر على اللوحة من قبل");
  await expect(page.locator('.react-flow__node[data-id="root:علم"].selected')).toHaveCount(1);

  // a kind's tile narrows the search to its kind; the card chosen is added
  await library.locator(".type-tile").filter({ hasText: "جذر" }).click();
  await expect(library).toContainText("اختر جذر من البحث");
  await library.getByRole("textbox", { name: /ابحث عن جذر أو كلمة/ }).fill("صبر");
  const adds = library.locator("section").filter({ hasText: "أضف من المصحف والمعجم" }).locator("li");
  await expect(adds.first()).toBeVisible();
  for (const li of await adds.all()) await expect(li.locator(".dot")).toHaveAttribute("style", /--c-root/);
  await adds.first().getByRole("button").click();
  await expect(page.locator('.react-flow__node[data-id="root:صبر"]')).toHaveCount(1);
  await expect(library).not.toContainText("اختر جذر من البحث");

  // a row dragged onto the canvas lands where it is dropped
  const canvas = page.locator(".graph-canvas");
  const box = (await canvas.boundingBox())!;
  const drop = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 };
  const row = adds.filter({ hasText: "صَبْر" }).first();
  await library.getByRole("textbox", { name: /ابحث عن جذر أو كلمة/ }).fill("صبر");
  const lemmaRow = library.locator("section").filter({ hasText: "أضف من المصحف والمعجم" }).locator("li").filter({ has: page.locator('[style*="--c-word"]') }).first();
  await expect(lemmaRow).toBeVisible();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await lemmaRow.getByRole("button").dispatchEvent("dragstart", { dataTransfer });
  await canvas.dispatchEvent("drop", { dataTransfer, clientX: drop.x, clientY: drop.y });
  const added = page.locator('.react-flow__node[data-id^="lemma:"]').filter({ hasNot: page.locator(".ring-2") });
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.length, { timeout: 10_000 }).toBe(doc.nodes.length + 2);
  const dropped = (await storedGraph(page, id))!.nodes.find((n) => n.id.startsWith("lemma:") && !doc.nodes.some((m) => m.id === n.id))!;
  const at = await page.locator(`.react-flow__node[data-id="${dropped.id}"]`).boundingBox();
  expect(Math.abs(at!.x + at!.width / 2 - drop.x), "dropped where the pointer was").toBeLessThan(60);
  expect(row).toBeTruthy();
  expect(added).toBeTruthy();

  // a note's tile adds a note; the types fold away, and the library to its rail, remembered
  await library.locator(".type-tile").filter({ hasText: "ملاحظة" }).click();
  await expect(page.locator('.react-flow__node[data-id^="note:"]')).toHaveCount(1);
  await library.getByRole("button", { name: /^أنواع البطاقات/ }).click();
  await expect(library.locator(".type-tile")).toHaveCount(0);
  await library.getByRole("button", { name: "أخفِ هذه اللوحة" }).click();
  await expect(page.locator(".library-rail")).toBeVisible();
  await page.reload();
  await expect(page.locator(".library-rail")).toBeVisible();
  await page.locator(".library-rail").getByRole("button", { name: "أظهر المكتبة" }).click();
  await expect(page.getByRole("complementary", { name: "المكتبة" }).locator(".type-tile")).toHaveCount(0);
});

test("an empty map says how to begin; export and import say what they did, import undone in one step; transliteration is a preference (P8.1-A, EDT-063, EDT-071, EDT-237, QAN-22)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await page.getByRole("button", { name: "خريطة حرة" }).click();
  await editorId(page);
  await expect(page.locator(".graph-empty")).toContainText("لا شيء على اللوحة بعد");
  await addNote(page, "الأولى");
  await expect(page.locator(".graph-empty")).toHaveCount(0);
  // export says how many cards
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".editor-header").getByRole("button", { name: "ملف JSON" }).click()]);
  expect(download.suggestedFilename()).toBe("خريطة-حرة.json");
  await expect(page.locator(".graph-toast")).toHaveText("صُدّرت بطاقة واحدة");
  // import into this map: its cards in place of these, said, and undone in one step
  const file = { name: "m.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 2, title: "مستوردة", kind: "free", nodes: [{ id: "root:رحم", position: { x: 0, y: 0 }, data: { kind: "root", ar: "ر ح م", rootKey: "رحم", sub: "r-ḥ-m" } }, { id: "note:a", position: { x: 0, y: 0 }, data: { kind: "note", text: "ب" } }], edges: [{ source: "note:a", target: "root:رحم", data: { rel: "describes" } }] })) };
  await page.locator('.editor-header input[type="file"]').setInputFiles(file);
  await expect(page.locator(".graph-toast")).toContainText("استُوردت الخريطة: بطاقتان وصلة واحدة");
  await expect(page.locator(".editor-title h1")).toHaveText("مستوردة");
  await expect(page.locator('.react-flow__node[data-id="root:رحم"]')).toBeVisible();
  // transliteration: off in Arabic until the reader turns it on
  const rootCard = page.locator('.react-flow__node[data-id="root:رحم"]');
  await expect(rootCard).not.toContainText("r-ḥ-m");
  await page.getByRole("switch", { name: /النقل الحرفي/ }).click();
  await expect(rootCard).toContainText("r-ḥ-m");
  await page.locator(".graph-toast").getByRole("button", { name: "تراجع" }).click().catch(() => page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true }).click());
  await expect(page.locator('.react-flow__node[data-id="root:رحم"]')).toHaveCount(0);
  await expect(page.locator('.react-flow__node[data-id^="note:"]')).toHaveCount(1);
});

test("the canvas's keys: 1 is 100 %, Enter and a double-click fold, ⌘A selects every card, Escape clears (P8.1-A, EDT-253, EDT-254)", async ({ page, isMobile }) => {
  test.skip(isMobile, "keys are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.locator(".react-flow__pane").click();
  await page.keyboard.press("1");
  await expect.poll(async () => page.locator(".react-flow__viewport").evaluate((el) => getComputedStyle(el).transform)).toMatch(/^matrix\(1, 0, 0, 1,/);
  const verse = page.locator('.react-flow__node[data-id="verse:1:2"]');
  await pickByFind(page, "١:٢", "verse:1:2");
  await page.waitForTimeout(300);
  await verse.dblclick({ position: { x: 60, y: 14 } });
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === "verse:1:2")?.data.folded, { timeout: 10_000 }).toBe(true);
  await verse.click({ position: { x: 60, y: 14 } });
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === "verse:1:2")?.data.folded ?? false, { timeout: 10_000 }).toBe(false);
  await page.keyboard.press("Control+a");
  await expect(page.locator(".react-flow__node.selected")).toHaveCount((await storedGraph(page, id))!.nodes.length);
  await page.keyboard.press("Escape");
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(0);
});

/** The canvas's viewport as its transform says: where it is and how far it is zoomed. */
async function viewport(page: Page) {
  const m = await page.locator(".react-flow__viewport").evaluate((el) => getComputedStyle(el).transform);
  const [a, , , , e, f] = m.replace(/^matrix\(|\)$/g, "").split(",").map(Number);
  return { x: e, y: f, zoom: a };
}

test("the canvas: a wheel pans and ⌘ with it zooms, the zoom pill, fit within its bounds, and the map view below 35 % (P8.1-B, EDT-051, 056, 058, 059, 060, HWF-36, QAN-20)", async ({ page, isMobile }) => {
  test.skip(isMobile, "a wheel and keys are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  const pill = page.locator(".zoom-pill-pct");
  const pct = (x: number) => new Intl.NumberFormat("ar-EG", { style: "percent" }).format(x);
  await pill.click();
  await expect(pill).toHaveText(pct(1));
  const box = (await page.locator(".graph-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await viewport(page);
  await page.mouse.wheel(0, 200);
  await expect.poll(async () => (await viewport(page)).y).not.toBe(before.y);
  expect((await viewport(page)).zoom, "a wheel alone does not zoom").toBe(1);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(async () => (await viewport(page)).zoom).toBeGreaterThan(1);
  // the pill steps by a quarter and resets
  await pill.click();
  await page.getByRole("button", { name: "تكبير", exact: true }).click();
  await expect(pill).toHaveText(pct(1.25));
  await page.getByRole("button", { name: "تصغير", exact: true }).click();
  await expect(pill).toHaveText(pct(1));
  // fit never goes above 100 % nor below 34 %
  await page.locator(".react-flow__pane").click();
  await page.keyboard.press("f");
  await expect.poll(async () => (await viewport(page)).zoom).toBeLessThanOrEqual(1);
  expect((await viewport(page)).zoom).toBeGreaterThanOrEqual(0.34);
  // below 35 % the map view: each card's headline, large, and a badge that says so
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("-");
    await page.waitForTimeout(200);
  }
  await expect.poll(async () => (await viewport(page)).zoom).toBeLessThan(0.35);
  await expect(page.locator(".map-badge")).toHaveText("عرض الخريطة — قرّب لترى تفاصيل البطاقات");
  await expect(page.locator('.react-flow__node[data-id="root:علم"] .map-face')).toHaveText("ع ل م");
  await expect(page.locator('.react-flow__node[data-id="verse:1:2"] .map-face')).toHaveText("الفاتحة: ٢");
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"] .graph-card > div:not(.map-face)').first()).toHaveCSS("visibility", "hidden");
  await page.keyboard.press("1");
  await expect(page.locator(".map-badge")).toHaveCount(0);
});

test("menus on the canvas and on a card, a wire's pill, and the keyboard: steps between cards, nudges on the 8 px grid, panning, linking two cards (P8.1-B, EDT-062, 065–069, 132, 134, 158–163, 233, HWF-12, 37)", async ({ page, isMobile }) => {
  test.skip(isMobile, "menus and keys are the desktop's");
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  await page.locator(".zoom-pill-pct").click();
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  const lemma = page.locator('.react-flow__node[data-id="lemma:alamin"]');

  // the word brought to the middle of the canvas, by the library's find
  const find = page.getByRole("searchbox", { name: "ابحث عن بطاقة في الخريطة" });
  await find.fill("العالمين");
  await find.press("Enter");
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"].selected')).toHaveCount(1);
  await find.press("Escape");
  await page.waitForTimeout(300);
  // a card's menu acts on the card clicked: attach a note to it
  await lemma.click({ button: "right", position: { x: 40, y: 14 } });
  const menu = page.getByRole("menu", { name: "قائمة البطاقة" });
  await expect(menu.getByRole("menuitem")).toHaveText(["طيّ البطاقة↵", "استخراج المواضعE", "إرفاق ملاحظة", "حذف بطاقة⌫"]);
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"].selected')).toHaveCount(1);
  await menu.getByRole("menuitem", { name: "إرفاق ملاحظة" }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.find((e) => e.source === "lemma:alamin" && e.target.startsWith("note:"))?.data, { timeout: 10_000 }).toEqual({ rel: "describes" });
  // the canvas's menu: a note where it was opened; Escape and any other key close it
  const pane = page.locator(".react-flow__pane");
  const pb = (await pane.boundingBox())!;
  await page.mouse.click(pb.x + 120, pb.y + pb.height - 160, { button: "right" });
  const canvasMenu = page.getByRole("menu", { name: "قائمة اللوحة" });
  await expect(canvasMenu.getByRole("menuitem").first()).toHaveText("ملاحظة جديدة هنا");
  await page.keyboard.press("Escape");
  await expect(canvasMenu).toHaveCount(0);
  await page.mouse.click(pb.x + 120, pb.y + pb.height - 160, { button: "right" });
  await page.keyboard.press("x");
  await expect(canvasMenu).toHaveCount(0);

  // the keyboard: from the word to its verse (the next card, to the left) and back to its root (EDT-159)
  await lemma.click({ position: { x: 40, y: 14 } });
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".react-flow__node.selected")).toHaveAttribute("data-id", "verse:1:2");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".react-flow__node.selected")).toHaveAttribute("data-id", "lemma:alamin");
  // the word's parent is its pattern, and the pattern's the root (P8.2)
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".react-flow__node.selected")).toHaveAttribute("data-id", /^pattern:/);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".react-flow__node.selected")).toHaveAttribute("data-id", "root:علم");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
  // ⌥ + an arrow nudges 8 px on the grid, one named step a press (EDT-161, EDT-233, HWF-12)
  const sel = await page.locator(".react-flow__node.selected").getAttribute("data-id");
  const at = (await storedGraph(page, id))!.nodes.find((n) => n.id === sel)!.position;
  await page.keyboard.press("Alt+ArrowUp");
  await expect(undo).toHaveAttribute("title", "تراجع: تحريك المحدد");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === sel)!.position, { timeout: 10_000 }).toEqual({ x: at.x, y: at.y - 8 });
  for (const n of (await storedGraph(page, id))!.nodes) expect([n.position.x % 8, n.position.y % 8], n.id).toEqual([0, 0]);
  // nothing selected: the arrows pan; so does the middle button, over a card too
  await page.keyboard.press("Escape");
  const v0 = await viewport(page);
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => Math.round((await viewport(page)).y - v0.y)).toBe(-56);
  const v1 = await viewport(page);
  const pb2 = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.mouse.move(pb2.x + 60, pb2.y + 60);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(pb2.x + 100, pb2.y + 60, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  await expect.poll(async () => Math.round((await viewport(page)).x - v1.x)).toBe(40);

  // two cards linked by keyboard: the first picked to the second (F14)
  // a card picked by its kind label, at its top right, away from the fold button and the note's field
  const pickCard = async (sel: string) => {
    const card = page.locator(sel);
    const bb = (await card.boundingBox())!;
    await card.click({ position: { x: bb.width - 30, y: 12 } });
  };
  await pickCard('.react-flow__node[data-id^="note:"]');
  await expect(page.locator('.react-flow__node[data-id^="note:"].selected')).toHaveCount(1);
  // ⇧-click adds a card to the selection (EDT-254)
  const verseCard = page.locator('.react-flow__node[data-id="verse:1:2"]');
  const vb = (await verseCard.boundingBox())!;
  await verseCard.click({ position: { x: vb.width - 30, y: 12 }, modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await page.keyboard.press("l");
  await expect.poll(async () => (await storedGraph(page, id))!.edges.some((e) => e.source.startsWith("note:") && e.target === "verse:1:2"), { timeout: 10_000 }).toBe(true);

  // a picked wire carries its pill: its relation and Unlink, undone from the message (EDT-134)
  await page.keyboard.press("Escape");
  const wire = page.locator('.react-flow__edge[aria-label^="ترد في"]').first();
  await wire.focus();
  await page.keyboard.press("Enter");
  const pillLabel = page.locator(".wire-label.is-picked");
  await expect(pillLabel).toContainText("ترد في");
  const edges = (await storedGraph(page, id))!.edges.length;
  await pillLabel.getByRole("button", { name: /إزالة الصلة/ }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.edges.length, { timeout: 10_000 }).toBe(edges - 1);
  await page.locator(".graph-toast").getByRole("button", { name: "تراجع" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.edges.length, { timeout: 10_000 }).toBe(edges);
});

test("every card and wire is named for a screen reader, in the interface's language, and the dark canvas is the design's (F14, F15, EDT-307, EDT-308)", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
    localStorage.setItem("jadhr-theme", "dark");
  });
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  const doc = (await storedGraph(page, id))!;
  const ar_ = doc.nodes.find((n) => n.id === "lemma:alamin")!.data.ar as string;
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"]')).toHaveAttribute("aria-label", `كلمة: ${ar_}، ٧٣`);
  await expect(page.locator('.react-flow__node[data-id="verse:1:2"]')).toHaveAttribute("aria-label", "آية: ١:٢");
  await expect(page.locator(".react-flow__edge").first()).toHaveAttribute("aria-label", /^(يُشتقّ منه|ترد في): /);
  // xyflow's own English instructions are not left in the Arabic page
  const hidden = await page.locator('[id^="react-flow__node-desc"], [id^="react-flow__edge-desc"]').allTextContents();
  expect(hidden.join(" ")).not.toMatch(/Press enter/);
  expect(hidden.join(" ")).toContain("اضغط Enter");
  await expect(page.getByRole("region", { name: "لوحة الخريطة" })).toBeVisible();
  // the dark canvas is the design's --canvas, not xyflow's own #141414
  const bg = await page.locator(".react-flow").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(15, 15, 18)");
});

// ─── P8.1-C: the cards' anatomy and fields, groups, duplicate, and the notes that reach a map ───

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const returning = (page: Page) => page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
const fieldsOf = async (page: Page, id: string, card: string) => ((await storedGraph(page, id))!.nodes.find((n) => n.id === card)!.data.fields ?? []) as { id: string; kind: string; label: string; value: unknown; fileName?: string; options?: string[] }[];

test("a card's fields: ten kinds from its menu, edited in place — kept on Enter, dropped by Escape — removed, renamed in the details, an image kept in this browser and carried by the map's file (P8.1-C, EDT-092…109, EDT-219…222, EDT-266, HWF-57)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the card's fields are edited the same way on a phone; the desktop's canvas is enough");
  await returning(page);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  await page.locator(".zoom-pill-pct").click();
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  const card = page.locator('.react-flow__node[data-id="lemma:alamin"]');
  const fields = card.locator(".card-fields");
  await expect(card.locator(".graph-card")).toHaveClass(/is-open/);
  await expect(fields).toContainText("لا حقول بعد.");

  // the menu holds the ten kinds, in the design's order (EDT-092, EDT-102)
  const add = async (kind: string) => {
    await fields.getByRole("button", { name: "+ إضافة" }).dispatchEvent("click");
    const menu = fields.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["نص قصير", "ملاحظات", "رقم", "اختيار", "وسوم", "صوت", "صورة", "ملف", "رابط", "تاريخ"]);
    await menu.getByRole("menuitem", { name: kind, exact: true }).dispatchEvent("click");
    await expect(menu).toHaveCount(0);
  };
  await add("نص قصير");
  await expect(undo).toHaveAttribute("title", "تراجع: إضافة حقل: نص قصير");
  const text = card.getByRole("textbox", { name: "نص قصير" });
  // Escape drops a draft, Enter keeps it (EDT-109)
  await text.fill("مسودة");
  await text.press("Escape");
  await expect(text).toHaveValue("");
  await text.fill("مطلع الفاتحة");
  await text.press("Enter");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin"))[0], { timeout: 10_000 }).toMatchObject({ kind: "text", label: "نص قصير", value: "مطلع الفاتحة" });
  await expect(undo).toHaveAttribute("title", "تراجع: تعديل حقل");
  // a double-click in a field edits the field, it does not fold the card (HWF-57)
  await text.dblclick();
  await expect(card.locator(".graph-card")).toHaveClass(/is-open/);

  // a number in the interface's digits, read back from either
  await add("رقم");
  const num = card.getByRole("textbox", { name: "رقم" });
  await expect(num).toHaveValue("٠");
  await num.fill("١٢٫٥");
  await num.press("Enter");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin"))[1], { timeout: 10_000 }).toMatchObject({ kind: "number", value: 12.5 });
  await expect(num).toHaveValue("١٢٫٥");
  // tags as chips: Enter adds one, a repeat is not added, × removes one
  await add("وسوم");
  const tag = card.getByRole("textbox", { name: "إضافة وسم إلى «وسوم»" });
  for (const x of ["حمد", "ربوبية", "حمد"]) {
    await tag.fill(x);
    await tag.press("Enter");
  }
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin")).find((f) => f.kind === "tags")?.value, { timeout: 10_000 }).toEqual(["حمد", "ربوبية"]);
  await card.getByRole("button", { name: "إزالة الوسم «حمد»" }).dispatchEvent("click");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin")).find((f) => f.kind === "tags")?.value, { timeout: 10_000 }).toEqual(["ربوبية"]);
  // a select starts on its first option; a link takes only a web address
  await add("اختيار");
  await expect(card.getByRole("combobox", { name: "اختيار" })).toHaveValue("الأول");
  await add("رابط");
  const url = card.getByRole("textbox", { name: "رابط" });
  await url.fill("javascript:alert(1)");
  await url.press("Enter");
  await expect(page.locator(".graph-toast")).toContainText("الرابط يبدأ بـ https:// أو http://");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin")).find((f) => f.kind === "link")?.value, { timeout: 10_000 }).toBe("");
  // an image, kept in this browser, its name beside it (EDT-105)
  await add("صورة");
  await card.locator('.card-fields input[type="file"]').setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
  await expect(card.locator(".card-fields img")).toHaveAttribute("alt", "dot.png");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin")).find((f) => f.kind === "image")?.fileName, { timeout: 10_000 }).toBe("dot.png");
  const image = (await fieldsOf(page, id, "lemma:alamin")).find((f) => f.kind === "image")!;
  expect(image).toMatchObject({ kind: "image", label: "صورة", fileName: "dot.png" });
  expect(image.value).toMatch(/^[a-f0-9]{32}$/);

  // removed with ×, one named step (EDT-107)
  await card.getByRole("button", { name: "إزالة الحقل «اختيار»" }).dispatchEvent("click");
  await expect(undo).toHaveAttribute("title", "تراجع: إزالة حقل");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin")).map((f) => f.kind)).toEqual(["text", "number", "tags", "link", "image"]);
  // a label is renamed in the details only (EDT-093, EDT-106)
  await expect(card.getByRole("textbox", { name: "اسم الحقل" })).toHaveCount(0);
  await card.click({ position: { x: 40, y: 14 } });
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  if (!(await details.isVisible())) await page.locator(".editor-header").getByRole("button", { name: "التفاصيل" }).click();
  await details.getByRole("tab", { name: "الإعدادات" }).click();
  const label = details.getByRole("textbox", { name: "اسم الحقل" }).first();
  await label.fill("مطلع");
  await label.press("Enter");
  await expect(undo).toHaveAttribute("title", "تراجع: تسمية حقل");
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:alamin"))[0]?.label, { timeout: 10_000 }).toBe("مطلع");

  // the map's file carries the image it holds, and an import restores it in another browser
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ملف JSON" }).click()]);
  const exported = JSON.parse(await (await download.createReadStream()).toArray().then((b) => Buffer.concat(b).toString("utf8"))) as { nodes: Card[]; files: Record<string, { name: string; url: string }> };
  expect(Object.keys(exported.files)).toEqual([image.value]);
  expect(exported.files[image.value as string]).toMatchObject({ name: "dot.png", url: `data:image/png;base64,${PNG.toString("base64")}` });
  await page.reload();
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"] .card-fields img')).toBeVisible();

  const other = await page.context().browser()!.newContext();
  const fresh = await other.newPage();
  await returning(fresh);
  await fresh.goto("/graph");
  await fresh.locator('input[type="file"]').setInputFiles({ name: "map.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await fresh.getByRole("main").getByRole("status").getByRole("link", { name: "افتحها" }).click();
  await expect(fresh.locator('.react-flow__node[data-id="lemma:alamin"] .card-fields img')).toHaveAttribute("src", /^data:image\/png;base64,/);
  // a map shared without its file says the file stayed behind
  await fresh.evaluate((key) => new Promise((res) => { const o = indexedDB.open("keyval-store"); o.onsuccess = () => { o.result.transaction("keyval", "readwrite").objectStore("keyval").delete(key).onsuccess = res; }; }), `jadhr-graph-file:${image.value}`);
  await fresh.reload();
  await expect(fresh.locator('.react-flow__node[data-id="lemma:alamin"] .card-fields')).toContainText("الملف «dot.png» ليس في هذا المتصفح");
  await other.close();
});

test("groups: ⌘G frames the selection with room for its bar, named in the details in one step; its bar carries the cards inside, its handles resize it on the grid; ⇧⌘G releases it and undo brings it back (P8.1-C, EDT-140…149, EDT-154, EDT-189, EDT-228, EDT-231, EDT-232, EDT-246, HWF-29)", async ({ page, isMobile }) => {
  test.skip(isMobile, "groups are made with the desktop's keys and pointer");
  await returning(page);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "verse", key: "1:2" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  const toast = page.locator(".graph-toast").last();
  const cards = (await storedGraph(page, id))!.nodes.length;

  // one card is not a group
  await page.locator('.react-flow__node[data-id="verse:1:2"]').click({ position: { x: 40, y: 14 } });
  await page.keyboard.press("Meta+g");
  await expect(toast).toContainText("حدّد بطاقتين أو أكثر لتجمعهما.");
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Meta+g");
  await expect(toast).toContainText(`${arCount(cards, { one: "جُمعت بطاقة", two: "جُمعت بطاقتان", few: "جُمعت # بطاقات", many: "جُمعت # بطاقة", other: "جُمعت # بطاقة" })} — سمّ المجموعة في التفاصيل`);
  await expect(undo).toHaveAttribute("title", `تراجع: ${arCount(cards, { one: "تجميع بطاقة", two: "تجميع بطاقتين", few: "تجميع # بطاقات", many: "تجميع # بطاقة", other: "تجميع # بطاقة" })}`);
  const frame = page.locator(".react-flow__node-frame");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveClass(/selected/);
  await expect(frame.locator(".frame-bar")).toContainText("مجموعة بلا اسم");
  await expect(frame).toHaveAttribute("aria-label", "مجموعة: مجموعة بلا اسم");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.some((n) => n.data.kind === "frame"), { timeout: 10_000 }).toBe(true);
  const f = (await storedGraph(page, id))!.nodes.find((n) => n.data.kind === "frame")!;
  expect(f.id).toMatch(/^frame:/);
  expect([Math.abs(f.position.x % 8), Math.abs(f.position.y % 8)]).toEqual([0, 0]);
  // every card lies inside it, with room for the bar above them
  const fb = (await frame.boundingBox())!;
  for (const box of await page.locator(".react-flow__node-card").evaluateAll((xs) => xs.map((x) => x.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.left).toBeGreaterThan(fb.x);
    expect(box.right).toBeLessThan(fb.x + fb.width);
    expect(box.top).toBeGreaterThan(fb.y + 26);
    expect(box.bottom).toBeLessThan(fb.y + fb.height);
  }

  // named in the details: Escape leaves it, Enter keeps it as one step (EDT-149)
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await expect(details.getByText(arCount(cards, { one: "بطاقة واحدة داخلها", two: "بطاقتان داخلها", few: "# بطاقات داخلها", many: "# بطاقة داخلها", other: "# بطاقة داخلها" }))).toBeVisible();
  const name = details.getByRole("textbox", { name: "اسم المجموعة" });
  await name.fill("مسودة");
  await name.press("Escape");
  await expect(name).toHaveValue("");
  await name.fill("كلمات الآية");
  await name.press("Enter");
  await expect(undo).toHaveAttribute("title", "تراجع: تسمية المجموعة");
  await expect(frame.locator(".frame-bar")).toContainText("كلمات الآية");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === f.id)!.data.title).toBe("كلمات الآية");
  // a group is not a card: the library's find does not find it (EDT-147)
  const find = page.getByRole("searchbox", { name: "ابحث عن بطاقة في الخريطة" });
  await find.fill("كلمات الآية");
  await expect(page.locator(".react-flow__node.is-match")).toHaveCount(0);
  await find.fill("");

  // its bar carries every card inside by the same distance (EDT-144, HWF-29)
  await page.getByRole("button", { name: "ملاءمة" }).click();
  await page.waitForTimeout(400);
  const before = (await storedGraph(page, id))!.nodes;
  const bar = (await frame.locator(".frame-bar").boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2 - 100, bar.y + bar.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === f.id)!.position).not.toEqual(f.position);
  const after = (await storedGraph(page, id))!.nodes;
  const moved = (n: Card) => {
    const was = before.find((b) => b.id === n.id)!.position;
    return [n.position.x - was.x, n.position.y - was.y];
  };
  const by = moved(after.find((n) => n.id === f.id)!);
  expect(by[0]).toBeLessThan(0);
  for (const n of after) expect(moved(n), n.id).toEqual(by);

  // its handles resize it on the 8 px grid, one named step (EDT-145, EDT-228); the whole group in view first
  await page.getByRole("button", { name: "ملاءمة" }).click();
  await page.waitForTimeout(400);
  await frame.locator(".frame-bar").click();
  // the top corner on the library's side: the zoom pill sits over the bottom one, the details over the other side
  const handle = page.locator(".frame-resize-handle.top.right");
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  // outward, so the bar stays above the cards it holds
  await page.mouse.move(hb.x + 48, hb.y - 32, { steps: 5 });
  await page.mouse.up();
  await expect(undo).toHaveAttribute("title", "تراجع: تغيير حجم المجموعة");
  const sizeOf = async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === f.id)!.data.size as { w: number; h: number };
  await expect.poll(async () => (await sizeOf()).w, { timeout: 10_000 }).toBeGreaterThan((f.data.size as { w: number }).w);
  const size = await sizeOf();
  expect([size.w % 8, size.h % 8]).toEqual([0, 0]);

  // released with ⇧⌘G — the cards stay — and brought back whole by undo (EDT-142, EDT-232)
  await page.keyboard.press("Meta+Shift+g");
  await expect(toast).toContainText("فُكّت المجموعة");
  await expect(frame).toHaveCount(0);
  await expect(page.locator(".react-flow__node-card")).toHaveCount(cards);
  await page.keyboard.press("Meta+z");
  await expect(frame).toHaveCount(1);
  await expect(frame.locator(".frame-bar")).toContainText("كلمات الآية");
  // a group deleted alone is a group, not a card (EDT-189)
  await frame.locator(".frame-bar").click();
  await page.keyboard.press("Backspace");
  await expect(undo).toHaveAttribute("title", "تراجع: حذف مجموعة");
  await expect(page.locator(".react-flow__node-card")).toHaveCount(cards);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+Shift+g");
  await expect(toast).toContainText("حدّد مجموعة لتفكّها.");
});

test("duplicate copies notes, never a card of the data; a card's actions attach a note and select its branch; its stats count what it holds (P8.1-C, EDT-096, EDT-101, EDT-122, EDT-186, EDT-188, EDT-226, HWF-46)", async ({ page, isMobile }) => {
  test.skip(isMobile, "⌘D is the desktop's");
  await returning(page);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  await page.locator(".zoom-pill-pct").click();
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  const lemma = page.locator('.react-flow__node[data-id="lemma:alamin"]');
  // its place in the map: its verses on it, and its links (EDT-101)
  const doc = (await storedGraph(page, id))!;
  const verses = doc.edges.filter((e) => e.source === "lemma:alamin" && e.target.startsWith("verse:")).length;
  const parents = doc.edges.filter((e) => e.target === "lemma:alamin" && /^(root|pattern):/.test(e.source)).length;
  const total = (doc.nodes.find((n) => n.id === "lemma:alamin")!.data.totals as { verses: number }).verses;
  await expect(lemma.locator(".card-stats")).toHaveText(`${ar(verses)}آيات${ar(parents)}أصول${ar(total - verses)}للاستخراج`);

  // "+ Note" attaches a note to it, linked as describing it (EDT-096, EDT-122)
  await lemma.getByRole("button", { name: "+ ملاحظة" }).dispatchEvent("click");
  await expect(undo).toHaveAttribute("title", "تراجع: إرفاق ملاحظة");
  await expect.poll(async () => (await storedGraph(page, id))!.edges.find((e) => e.source === "lemma:alamin" && e.target.startsWith("note:"))?.data, { timeout: 10_000 }).toEqual({ rel: "describes" });
  const noteId = (await storedGraph(page, id))!.edges.find((e) => e.source === "lemma:alamin" && e.target.startsWith("note:"))!.target;
  const note = page.locator(`.react-flow__node[data-id="${noteId}"]`);
  await note.getByRole("textbox", { name: "ملاحظة" }).fill("مطلع السورة");
  await note.getByRole("textbox", { name: "ملاحظة" }).blur();
  // "Focus" selects the card and what branches from it, not its notes (EDT-096)
  await lemma.getByRole("button", { name: "تركيز" }).dispatchEvent("click");
  const branch = doc.edges.filter((e) => e.source === "lemma:alamin").map((e) => e.target);
  await expect.poll(async () => (await page.locator(".react-flow__node.selected").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-id")))).sort()).toEqual(["lemma:alamin", ...branch].sort());

  // ⌘D copies the note beside itself, a new card with its words, one named step (EDT-188, EDT-226)
  await page.keyboard.press("Escape");
  await note.click({ position: { x: 40, y: 14 } });
  await page.keyboard.press("Meta+d");
  await expect(undo).toHaveAttribute("title", "تراجع: نسخ بطاقة");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.filter((n) => n.data.kind === "note").length).toBe(2);
  const notes = (await storedGraph(page, id))!.nodes.filter((n) => n.data.kind === "note");
  const copy = notes.find((n) => n.id !== noteId)!;
  const orig = notes.find((n) => n.id === noteId)!;
  expect(copy.data.text).toBe("مطلع السورة");
  expect([copy.position.x - orig.position.x, copy.position.y - orig.position.y]).toEqual([24, 24]);
  // a note's menu offers Duplicate (a word's does not: the P8.1-B test reads its whole menu)
  await page.locator(`.react-flow__node[data-id="${copy.id}"]`).click({ button: "right", position: { x: 40, y: 14 } });
  await expect(page.getByRole("menu", { name: "قائمة البطاقة" }).getByRole("menuitem")).toHaveText(["طيّ البطاقة↵", "نسخ⌘D", "حذف بطاقة⌫"]);
  await page.keyboard.press("Escape");
  // a card of the data is on a map once: it is not copied, and the reader is told (HWF-46)
  await page.keyboard.press("Escape");
  // the copy may lie over the word: it is picked by the library's find
  const find = page.getByRole("searchbox", { name: "ابحث عن بطاقة في الخريطة" });
  await find.fill("العالمين");
  await find.press("Enter");
  await expect(page.locator('.react-flow__node[data-id="lemma:alamin"].selected')).toHaveCount(1);
  await find.press("Escape");
  await page.locator('.react-flow__node[data-id="lemma:alamin"]').focus();
  await page.keyboard.press("Meta+d");
  await expect(page.locator(".graph-toast").last()).toContainText("بطاقة البيانات واحدة في الخريطة؛ تُنسخ الملاحظات والمجموعات وحدها.");
  expect((await storedGraph(page, id))!.nodes.filter((n) => n.id.startsWith("lemma:")).length).toBe(doc.nodes.filter((n) => n.id.startsWith("lemma:")).length);
});

test("a Notebook note reaches a map by its id, describing what it mentions; a dictionary's article is quoted by its id with its credit, its words read from the dataset and never stored (P8.1-C, NTB-22, RDR-239, EDT-292, HWF-52, D22)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the hand-off is the same dialog on a phone");
  await returning(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "jadhr-notebook",
      JSON.stringify({ state: { notes: [{ id: "n1", title: "عن آية الكرسي", body: "١٠٠٪ من @2:255 نور", tags: [], created: 1, updated: 2, links: { roots: [], verses: ["2:255"], words: [] } }] }, version: 1 }),
    ),
  );
  await page.goto("/notebook?note=n1");
  await page.locator(".notebook-editor").waitFor();
  await page.getByRole("button", { name: "← بطاقة وصف" }).click();
  const dialog = page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" });
  await expect(dialog).toContainText("تصير ملاحظتك بطاقة وصف");
  await expect(dialog.locator(".handoff-rows li").first()).toContainText("ملاحظة");
  // the note travels by its id: its words never enter the address (HWF-52's "%" is no longer a hazard)
  const href = (await dialog.getByRole("link", { name: "افتح محرر الخرائط" }).getAttribute("href"))!;
  expect(JSON.parse(Buffer.from(new URL(href, "http://x").searchParams.get("s")!, "base64url").toString("utf8"))).toEqual({ seed: "note", note: "n1" });
  await dialog.getByRole("link", { name: "افتح محرر الخرائط" }).click();
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  const doc = (await storedGraph(page, id))!;
  expect(doc.title).toBe("ملاحظة: عن آية الكرسي");
  expect(doc.nodes.find((n) => n.id === "note:nb-n1")!.data).toEqual({ kind: "note", text: "عن آية الكرسي\n\n١٠٠٪ من @2:255 نور", focus: true });
  expect(doc.edges.map((e) => [e.source, e.target, e.data?.rel])).toContainEqual(["note:nb-n1", "verse:2:255", "describes"]);
  // a note not in this browser says so
  await page.goto(`/graph/seed?s=${seedParam({ seed: "note", note: "nmissing" })}`);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("هذه الملاحظة ليست في هذا المتصفح: الملاحظات تبقى في المتصفح الذي كُتبت فيه، وفي حسابك إن كنت قد دخلت إليه.");

  // the reader's dictionary: «+» on an article (RDR-239)
  await page.addInitScript(() =>
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { layerOpen: { senses: false, family: false, patterns: false, lexica: true, timeline: false, usage: false } }, version: 2 })),
  );
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const article = page.locator('[data-section="lexica"] .dict-article').first();
  const work = await article.getAttribute("data-dict");
  const w = await api<{ dict_articles: { id: string; entries: { id: number; uri: string }[] }[] }>(page, "/words/ilm?limit=0&at=20:114:17");
  // quoted by its identifier, which no release changes (P1.7a)
  const entry = w.dict_articles.find((d) => d.id === work)!.entries[0].uri;
  expect(entry).toMatch(new RegExp(`^dict:${work}:`));
  const e = await api<{ body: string; title_ar: string; author_ar: string; root_key: string }>(page, `/lexicon/entries/${encodeURIComponent(entry)}`);
  await article.getByRole("button", { name: "أضف إلى خريطة" }).first().click();
  const handoff = page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" });
  await expect(handoff).toContainText("لا يُحفظ نصها في الخريطة");
  await expect(handoff.locator(".handoff-rows")).toContainText(e.title_ar);
  await handoff.getByRole("link", { name: "افتح محرر الخرائط" }).click();
  const qid = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, qid))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  const q = (await storedGraph(page, qid))!;
  expect(q.nodes.find((n) => n.id === `quote:${entry}`)!.data).toEqual({ kind: "note", entry, focus: true });
  expect(q.edges.map((x) => [x.source, x.target, x.data?.rel])).toEqual([[`quote:${entry}`, `root:${e.root_key}`, "describes"]]);
  expect(JSON.stringify(q)).not.toContain(e.body.slice(0, 24));
  // drawn from the dataset: the article's opening words in «», and its credit
  const card = page.locator(`.react-flow__node[data-id="quote:${entry}"]`);
  await expect(card).toHaveAttribute("aria-label", `اقتباس: ${e.title_ar}`);
  const quoted = (await card.locator("blockquote").innerText()).replace(/^«|»$/g, "").replace(/\s*…$/, "").trim();
  expect(e.body.replace(/\s+/g, " ").startsWith(quoted.replace(/\s+/g, " "))).toBe(true);
  await expect(card.locator("figcaption")).toContainText(`${e.title_ar} — ${e.author_ar}`);
  // the whole article in the details, with the work's credit
  await card.click({ position: { x: 40, y: 14 } });
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  if (!(await details.isVisible())) await page.locator(".editor-header").getByRole("button", { name: "التفاصيل" }).click();
  await expect(details.locator(".quote-full")).toHaveText(e.body);
  await expect(details).toContainText("للعرض فقط");
});

// ─── P8.1-D: the details — Meaning and Settings ───

/** A card brought to the middle and selected by the library's find (EDT-039), as a reader reaches one off-screen. */
async function pickByFind(page: Page, query: string, id: string) {
  const find = page.getByRole("searchbox", { name: "ابحث عن بطاقة في الخريطة" });
  await find.fill(query);
  for (let i = 0; i < 12 && (await page.locator(`.react-flow__node[data-id="${id}"].selected`).count()) === 0; i++) await find.press("Enter");
  await expect(page.locator(`.react-flow__node[data-id="${id}"].selected`)).toHaveCount(1);
  await find.fill("");
}

test("the details' Meaning: a root's core idea in Ibn Fāris's words and its dictionaries by death date, quoted onto the map by id; a word's own meanings and its root; a verse's place, its plain explanation and its words, added at their places (P8.1-D, EDT-166–181, EDT-248, HWF-50, QAN-17, QAN-18)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details panel is the desktop's; the phone editor is P8.6a's");
  await returning(page);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  await expect(details.locator(".details-head")).toContainText("لا شيء محدد");

  // a word: its header and badge, the chain it comes from, its own meanings (al-Mufradāt on it), its count
  const w = await api<{ ar: { full: string }; corpus_freq: number; mufradat: { work: { title_ar: string }; subentries: { headword_ar: string }[] } | null }>(page, "/words/alamin?limit=0");
  await pickByFind(page, "العالمين", "lemma:alamin");
  await expect(details.locator(".details-head")).toContainText(`كلمة · ${w.ar.full}`);
  await expect(details.locator(".kind-badge")).toHaveText("كلمة");
  await expect(details.getByRole("tab", { name: "المعنى" })).toHaveAttribute("aria-selected", "true");
  const body = details.locator(".details-body");
  await expect(body).toContainText("معاني الكلمة");
  if (w.mufradat) await expect(body).toContainText(w.mufradat.work.title_ar);
  await expect(body).toContainText(`ورد ${ar(w.corpus_freq)} مرة في القرآن`);
  await expect(body).toContainText("اسم · من الجذر ع ل م");
  // its root, by the breadcrumb (EDT-167): Ibn Fāris's words with his page, a three-letter root counted as letters
  const root = await api<{ occurrences: number; lexicon: { core_meaning: { text: string; page_ref: string }; works: { id: string; death_ce: number | null; entries: { id: number; uri: string }[] }[] } }>(page, `/roots/${encodeURIComponent("علم")}`);
  await details.locator(".crumb").first().click();
  await expect(page.locator('.react-flow__node[data-id="root:علم"].selected')).toHaveCount(1);
  await expect(details.locator(".details-head")).toContainText("جذر · ع ل م");
  await expect(body).toContainText(`«${root.lexicon.core_meaning.text}»`);
  await expect(body).toContainText(root.lexicon.core_meaning.page_ref);
  await expect(body).toContainText("جذر ثلاثي");
  // the dictionaries: opened from the pill, in the order their compilers died, the first two open (EDT-176…179)
  await body.getByRole("button", { name: "في المعاجم" }).click();
  const byDeath = [...root.lexicon.works].sort((a, b) => (a.death_ce ?? 9999) - (b.death_ce ?? 9999)).map((d) => d.id);
  await expect(body.locator(".dict-row")).toHaveCount(byDeath.length);
  expect(await body.locator(".dict-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-dict")))).toEqual(byDeath);
  await expect(body.locator(".dict-entry")).toHaveCount(Math.min(2, byDeath.length));
  await body.getByRole("button", { name: "عن هذه الوسوم" }).click();
  await expect(body).toContainText("وليست ترتيبًا لمرجعيته");
  // an entry quoted beside the root, by its identifier (EDT-180, QAN-18, D22, P1.7a)
  const first = root.lexicon.works.find((d) => d.id === byDeath[0])!.entries[0].uri;
  await body.locator(".dict-entry").first().getByRole("button", { name: "اقتبس هذه المادة في ملاحظة بجانب البطاقة" }).click();
  await expect(undo).toHaveAttribute("title", "تراجع: اقتباس مادة");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === `quote:${first}`)?.data, { timeout: 10_000 }).toEqual({ kind: "note", entry: first });
  expect((await storedGraph(page, id))!.edges.some((e) => e.source === "root:علم" && e.target === `quote:${first}` && e.data?.rel === "describes")).toBe(true);
  await details.locator(".crumb").first().waitFor({ state: "detached" }).catch(() => {});
  await pickByFind(page, "ع ل م", "root:علم");
  await body.locator(".dict-entry").first().getByRole("button", { name: "هذه المادة على الخريطة: اربطها بهذه البطاقة" }).click();
  await expect(page.locator(".graph-toast").last()).toContainText("هذه المادة مقتبسة على الخريطة من قبل");

  // a verse: its place, al-Muyassar's plain explanation with its credit, and its words with their roots
  const muyassar = await api<{ passages: { from_ayah: number; text: string }[] }>(page, "/works/muyassar/surahs/1");
  const verse = await api<{ words: { location: string; lemma_slug: string | null; lemma: string | null }[] }>(page, "/verses/1:2");
  await pickByFind(page, "١:٢", "verse:1:2");
  await expect(body).toContainText("الفاتحة: ٢");
  await expect(body).toContainText("مكية · ٧ آيات");
  await expect(body).toContainText(muyassar.passages.find((p) => p.from_ayah === 2)!.text.slice(0, 40));
  await expect(body.locator(".verse-word-row")).toHaveCount(verse.words.length);
  // a word of the verse onto the map beside it, linked at its place, the verse marking it (QAN-17)
  const rabb = verse.words.find((x) => x.location === "1:2:3")!;
  await body.locator(".verse-word-row").nth(2).getByRole("button", { name: /أضف الكلمة إلى اللوحة/ }).click();
  await expect(undo).toHaveAttribute("title", `تراجع: إضافة الكلمة ${rabb.lemma}`);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.find((e) => e.source === `lemma:${rabb.lemma_slug}` && e.target === "verse:1:2")?.data, { timeout: 10_000 }).toEqual({ rel: "attests", place: "1:2:3" });
  expect((await storedGraph(page, id))!.nodes.find((n) => n.id === "verse:1:2")!.data.places).toContain("1:2:3");
  await expect(page.locator(`.react-flow__node[data-id="lemma:${rabb.lemma_slug}"].selected`)).toHaveCount(1);
  // a word with a root has a way to its root's card (EDT-173)
  await expect(details.locator(".details-head")).toContainText("كلمة ·");
  await expect(body.getByRole("button", { name: "أضف هذا الجذر إلى اللوحة" })).toBeVisible();
});

test("the details' Settings: the headword (a note's words, edited in one step; a card of the data shown, not edited), fields added there, links cut there; several cards folded and unfolded together; a group opens on its settings; hidden to a rail that a selection opens again (P8.1-D, EDT-138, EDT-164, EDT-165, EDT-168, EDT-169, EDT-182–185, EDT-187, EDT-223, HWF-31, HWF-38)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details panel is the desktop's; the phone editor is P8.6a's");
  await returning(page);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  const body = details.locator(".details-body");
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  // nothing selected: how to begin, and the map by kind (EDT-182)
  await expect(body).toContainText("اختر بطاقة لتقرأ مادتها");
  await expect(body).toContainText("هذه الخريطة");

  // a verse: its text is the mushaf's (L1); a field added here; a link cut here, in one named step (EDT-183…185)
  await pickByFind(page, "١:٢", "verse:1:2");
  await details.getByRole("tab", { name: "الإعدادات" }).click();
  await expect(details.getByRole("tab", { name: "الإعدادات" })).toHaveAttribute("aria-selected", "true");
  await expect(body).toContainText("نص الآية من المصحف، ولا يُحرَّر.");
  await body.getByRole("button", { name: "+ إضافة" }).click();
  await body.getByRole("menuitem", { name: "نص قصير" }).click();
  await expect.poll(async () => ((await storedGraph(page, id))!.nodes.find((n) => n.id === "verse:1:2")!.data.fields as unknown[] | undefined)?.length, { timeout: 10_000 }).toBe(1);
  const before = (await storedGraph(page, id))!.edges.filter((e) => e.source === "verse:1:2" || e.target === "verse:1:2");
  await expect(body.locator(".link-row")).toHaveCount(before.length);
  await expect(body.locator(".link-row").first()).toContainText("من");
  await body.locator(".link-row").first().getByRole("button", { name: /أزل هذه الصلة/ }).click();
  await expect(undo).toHaveAttribute("title", "تراجع: إزالة صلة");
  await expect.poll(async () => (await storedGraph(page, id))!.edges.filter((e) => e.source === "verse:1:2" || e.target === "verse:1:2").length, { timeout: 10_000 }).toBe(before.length - 1);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await storedGraph(page, id))!.edges.filter((e) => e.source === "verse:1:2" || e.target === "verse:1:2").length, { timeout: 10_000 }).toBe(before.length);

  // a note: its words are its headword, edited here as one step (EDT-183, EDT-223)
  await addNote(page, "مسودة");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.some((n) => n.data.kind === "note" && n.data.text === "مسودة"), { timeout: 10_000 }).toBe(true);
  const noteId = (await storedGraph(page, id))!.nodes.find((n) => n.data.kind === "note")!.id;
  await page.locator(`.react-flow__node[data-id="${noteId}"]`).click({ position: { x: 40, y: 14 } });
  await details.getByRole("tab", { name: "الإعدادات" }).click();
  const headword = body.getByRole("textbox", { name: "نص الملاحظة" });
  await headword.fill("الحمد لله");
  await headword.blur();
  await expect(undo).toHaveAttribute("title", "تراجع: تعديل العنوان");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === noteId)!.data.text, { timeout: 10_000 }).toBe("الحمد لله");

  // several cards: by kind, folded and unfolded together (EDT-187)
  await page.locator(`.react-flow__node[data-id="${noteId}"]`).focus();
  await page.keyboard.press("Meta+a");
  const cards = (await storedGraph(page, id))!.nodes.length;
  await expect(details.locator(".details-head")).toContainText(arCount(cards, { one: "بطاقة واحدة محددة", two: "بطاقتان محددتان", few: "# بطاقات محددة", many: "# بطاقة محددة", other: "# بطاقة محددة" }));
  await body.getByRole("button", { name: "اطوِ الكل" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.every((n) => n.data.folded), { timeout: 10_000 }).toBe(true);
  await body.getByRole("button", { name: "افتح الكل" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.some((n) => n.data.folded), { timeout: 10_000 }).toBe(false);
  // a group has settings only (HWF-31)
  await page.keyboard.press("Meta+g");
  await expect(details.getByRole("tab", { name: "المعنى" })).toBeDisabled();
  await expect(details.getByRole("tab", { name: "الإعدادات" })).toHaveAttribute("aria-selected", "true");
  await expect(body.getByRole("textbox", { name: "اسم المجموعة" })).toBeVisible();

  // hidden, a rail; a card selected opens it again (EDT-165, HWF-38)
  await details.getByRole("button", { name: "أخفِ هذه اللوحة" }).click();
  await expect(page.locator(".graph-details")).toHaveCount(0);
  await expect(page.locator(".details-rail")).toBeVisible();
  await pickByFind(page, "العالمين", "lemma:alamin");
  await expect(page.locator(".graph-details")).toBeVisible();
});

// ─── P8.2: root graphs from the full data ───

test("a root's map from the full data: patterns between the root and its words; each kind extracts what the corpus holds below it — patterns, words, ten verses at a time within a sūra, a verse's words — one named step each (P8.2, EDT-086, EDT-090, EDT-091, EDT-110–118, EDT-121, EDT-123, EDT-215, EDT-240, HWF-51, QAN-02–08, QAN-24)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the extraction is exercised on the desktop's canvas");
  await returning(page);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const undo = page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true });
  const toast = page.locator(".graph-toast").last();

  // the map: the root, every pattern of its words, each word under its pattern (QAN-04)
  const g = await api<{ patterns: { slug: string; lemmas: string[] }[]; lemmas: { slug: string; pattern_slug: string | null }[] }>(page, `/roots/${encodeURIComponent("علم")}/graph`);
  const doc = (await storedGraph(page, id))!;
  expect(doc.nodes.filter((n) => n.id.startsWith("pattern:")).map((n) => n.id).sort()).toEqual(g.patterns.map((p) => `pattern:${p.slug}`).sort());
  for (const l of g.lemmas)
    expect(doc.edges.some((e) => e.target === `lemma:${l.slug}` && e.source === (l.pattern_slug ? `pattern:${l.pattern_slug}` : "root:علم")), l.slug).toBe(true);

  // a word: ten of its verses, counted from the corpus (QAN-06, EDT-091)
  const w = await api<{ verse_count: number }>(page, "/words/alamin?limit=0");
  const lemma = page.locator('.react-flow__node[data-id="lemma:alamin"]');
  await pickByFind(page, "العالمين", "lemma:alamin");
  await expect(lemma.locator(".extract-btn")).toHaveText(`استخراج ١٠ من ${ar(w.verse_count)} آية`);
  await expect(lemma.locator(".card-stats")).toContainText(`${ar(w.verse_count - 1)}للاستخراج`);
  await lemma.locator(".extract-btn").click();
  await expect(toast).toContainText("استُخرجت ١٠ آيات");
  await expect(undo).toHaveAttribute("title", "تراجع: استخراج ١٠ آيات");
  const versesOf = async () => (await storedGraph(page, id))!.edges.filter((e) => e.source === "lemma:alamin" && e.target.startsWith("verse:")).map((e) => e.target);
  await expect.poll(async () => (await versesOf()).length, { timeout: 10_000 }).toBe(11);
  // within one sūra: the sūra's verses only
  await pickByFind(page, "العالمين", "lemma:alamin");
  await lemma.locator(".extract-caret").click();
  const facets = await api<{ surahs: { surah: number; verses: number }[] }>(page, "/words/alamin/verses?limit=1");
  const s = facets.surahs.find((x) => x.surah === 26)!;
  await lemma.getByRole("combobox", { name: "السورة" }).selectOption(String(s.surah));
  await lemma.locator(".extract-menu").getByRole("button", { name: "استخرج", exact: true }).click();
  await expect(toast).toContainText(/استُخرجت/);
  await expect.poll(async () => (await versesOf()).filter((v) => v.startsWith("verse:26:")).length, { timeout: 10_000 }).toBe(Math.min(10, s.verses));

  // a verse: its words with roots linked at their places, particles left out (QAN-07, QAN-08)
  const verse = await api<{ words: { location: string; lemma_slug: string | null; root: string | null }[] }>(page, "/verses/1:2");
  const toLink = [...new Set(verse.words.filter((x) => x.root && x.lemma_slug && x.lemma_slug !== "alamin").map((x) => x.lemma_slug!))];
  await pickByFind(page, "١:٢", "verse:1:2");
  const card = page.locator('.react-flow__node[data-id="verse:1:2"]');
  await expect(card.locator(".extract-btn")).toHaveText(arCount(toLink.length, { one: "ربط كلمة واحدة", two: "ربط كلمتين", few: "ربط # كلمات", many: "ربط # كلمة", other: "ربط # كلمة" }));
  await card.locator(".extract-caret").click();
  await expect(card.locator(".extract-option")).toHaveCount(3);
  await card.locator(".extract-option").first().click();
  await expect(undo).toHaveAttribute("title", `تراجع: ربط ${arCount(toLink.length, { one: "كلمة واحدة", two: "كلمتين", few: "# كلمات", many: "# كلمة", other: "# كلمة" })}`);
  await expect.poll(async () => (await storedGraph(page, id))!.edges.filter((e) => e.target === "verse:1:2" && e.data?.rel === "attests").map((e) => e.source).sort(), { timeout: 10_000 }).toEqual(["lemma:alamin", ...toLink.map((x) => `lemma:${x}`)].sort());
  for (const x of verse.words.filter((v) => v.lemma_slug && toLink.includes(v.lemma_slug))) expect((await storedGraph(page, id))!.nodes.find((n) => n.id === "verse:1:2")!.data.places).toContain(x.location);
  // undo takes the linking back whole
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await storedGraph(page, id))!.edges.filter((e) => e.target === "verse:1:2" && e.data?.rel === "attests").length, { timeout: 10_000 }).toBe(1);

  // a root extracts a pattern no longer on the map, and E does the same (EDT-111, EDT-121)
  const one = g.patterns[g.patterns.length - 1];
  await pickByFind(page, one.slug, `pattern:${one.slug}`);
  await page.locator(`.react-flow__node[data-id="pattern:${one.slug}"]`).focus();
  await page.keyboard.press("Backspace");
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.some((n) => n.id === `pattern:${one.slug}`), { timeout: 10_000 }).toBe(false);
  await pickByFind(page, "ع ل م", "root:علم");
  await expect(page.locator('.react-flow__node[data-id="root:علم"] .extract-btn')).toHaveText("استخراج وزن واحد");
  await page.locator('.react-flow__node[data-id="root:علم"]').focus();
  await page.keyboard.press("e");
  await expect(toast).toContainText("استُخرج وزن واحد");
  await expect(undo).toHaveAttribute("title", "تراجع: استخراج وزن");
  await expect.poll(async () => (await storedGraph(page, id))!.edges.some((e) => e.source === "root:علم" && e.target === `pattern:${one.slug}` && e.data?.rel === "derives"), { timeout: 10_000 }).toBe(true);
  await expect(page.locator('.react-flow__node[data-id="root:علم"] .extract-btn')).toHaveText("كل الأوزان على اللوحة");
  await expect(page.locator('.react-flow__node[data-id="root:علم"] .extract-btn')).toBeDisabled();
});

test("a root's map on its own page: generated from the data, read-only, loaded when it comes into view, the page still scrolling over it, and saved as the reader's own (P8.2, QAN-21)", async ({ page }) => {
  await returning(page);
  const graphCalls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/v1/roots/") && r.url().endsWith("/graph") && graphCalls.push(r.url()));
  await page.goto(`/roots/${encodeURIComponent("رحم")}`);
  await page.waitForLoadState("networkidle");
  expect(graphCalls, "nothing of the map is loaded before it is reached").toEqual([]);
  const map = page.locator("#map");
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });
  const g = await api<{ patterns: unknown[]; lemmas: unknown[] }>(page, `/roots/${encodeURIComponent("رحم")}/graph`);
  await expect(map.locator(".react-flow__node")).toHaveCount(1 + g.patterns.length + g.lemmas.length);
  // the wheel over it scrolls the page
  const y0 = await page.evaluate(() => window.scrollY);
  const box = (await map.locator(".root-map").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
  // saved as the reader's own map
  await map.getByRole("button", { name: "احفظ نسخة في خرائطي" }).click();
  const id = await editorId(page);
  await expect.poll(async () => (await storedGraph(page, id))?.nodes.filter((n) => n.id.startsWith("pattern:")).length ?? 0, { timeout: 15_000 }).toBe(g.patterns.length);
});
