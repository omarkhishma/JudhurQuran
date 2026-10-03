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
  const boxes = page.getByRole("textbox", { name: "ملاحظة" });
  const n = await boxes.count();
  await page.locator(".type-tile").filter({ hasText: "ملاحظة" }).click();
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
  const att = await api<{ total: number; data: { location: string; verse_key: string }[] }>(page, "/words/alamin/attestations?limit=8");
  const card = page.locator('.react-flow__node[data-id="lemma:alamin"]');
  const button = card.getByRole("button", { name: /^المواضع/ });
  // when the read fails: said, and the button works again once it can
  await page.route("**/api/v1/words/*/attestations*", (r) => r.fulfill({ status: 500, body: "{}" }));
  // the card may lie beyond the canvas's view, which panning is not what this test is about: the button is pressed
  await button.dispatchEvent("click");
  await expect(page.locator(".graph-toast").filter({ hasText: "تعذّر تحميل المواضع الآن" })).toBeVisible();
  await page.unroute("**/api/v1/words/*/attestations*");
  await expect(button).toBeEnabled();
  await button.dispatchEvent("click");
  // each place is a verse card marking it, one card per verse, linked from the word at its place
  const keys = new Set(att.data.map((o) => o.verse_key));
  await expect.poll(async () => (await storedGraph(page, id))!.edges.filter((e) => e.source === "lemma:alamin" && e.data?.rel === "attests").length, { timeout: 10_000 }).toBe(keys.size);
  const doc = (await storedGraph(page, id))!;
  for (const o of att.data) {
    expect(doc.nodes.find((n) => n.id === `verse:${o.verse_key}`)?.data.places, o.location).toContain(o.location);
    expect(doc.edges.find((e) => e.source === "lemma:alamin" && e.target === `verse:${o.verse_key}`)?.data?.rel).toBe("attests");
  }
  // the verse the reader came from was already on the map: it is not there twice (F5)
  expect(doc.nodes.filter((n) => n.id === "verse:1:2")).toHaveLength(1);
  // and the places still to open are counted as Arabic counts them
  const rest = att.total - att.data.length;
  await expect(card).toContainText(arCount(rest, { one: "+موضع آخر", two: "+موضعان آخران", few: "+# مواضع أخرى", many: "+# موضعًا آخر", other: "+# موضع آخر" }));
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
  await expect(details).toContainText("ترد في");
  await header.getByRole("button", { name: "التفاصيل" }).click();
  await expect(details).toHaveCount(0);
  await expect(header.getByRole("button", { name: "التفاصيل" })).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.locator(".graph-card").first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "التفاصيل" })).toHaveCount(0);
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
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".react-flow__node.selected")).toHaveAttribute("data-id", "root:علم");
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
  await expect.poll(async () => (await viewport(page)).y).toBe(v0.y - 56);
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
