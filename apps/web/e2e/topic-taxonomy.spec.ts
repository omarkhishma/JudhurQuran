import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { clean, drop, expire, person, tag } from "./board";

/**
 * The topic taxonomy and its headings (P8.3b; research 06 Part 3, D29; research 13, QAN-09): the editorial board
 * adopts one of La Beaume's chapters under an Arabic name with its source, places a verse QSAC suggested under it,
 * another editor approves, and the reader sees both, each said to be the board's; the Quran's proper names as
 * headings on a topic map; the reader's own topics on a map beside the sources', never among them. Expectations read
 * from the API and the map stored in this browser.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string } };
type Doc = { kind: string; nodes: Card[]; edges: { source: string; target: string; data?: Record<string, unknown> }[] };

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

const returning = (page: Page, personal: Record<string, unknown> = {}) =>
  page.addInitScript((extra) => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true, ...extra }, version: 2 })), personal);

async function newTopicMap(page: Page): Promise<string> {
  await page.goto("/graph");
  await page.getByRole("button", { name: "خريطة موضوع" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  return page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
}

test("the board adopts a La Beaume chapter under an Arabic name and places a verse QSAC suggested under it; another editor approves; the reader sees both as the board's (P8.3b)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(150_000);
  const t = tag();
  const name = `الدعوة والتبليغ ${t.slice(-6)}`;
  const a = await person(browser, `e2e-tx-a-${t}@example.org`, "editor");
  const b = await person(browser, `e2e-tx-b-${t}@example.org`, "editor");
  try {
    // the worklist: La Beaume's chapters before Quranpedia's topics; a chapter's page cites it as printed
    await a.page.goto("/workbench?kind=topic");
    await expect(a.page.getByRole("heading", { name: "تصنيف الموضوعات" })).toBeVisible();
    await a.page.locator(".workbench-row").filter({ hasText: "Prédication" }).click();
    await expect(a.page.getByRole("heading", { name: "Prédication" })).toBeVisible();
    const cand = a.page.locator(".cand").filter({ hasText: "فصل لابوم كما طبع" });
    await expect(cand).toContainText("Prédication — chapitre 3, p. 62");
    await cand.getByRole("button", { name: "استشهد" }).click();
    await a.page.getByRole("textbox", { name: "الاسم العربي" }).fill(name);
    await a.page.getByRole("button", { name: "احفظ المسودة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "حُفظت" })).toBeVisible();
    await a.page.getByRole("button", { name: "أرسل إلى المراجعة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "أُرسلت إلى المراجعة." })).toBeVisible();
    const axe = await new AxeBuilder({ page: a.page }).include(".workbench").analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    // another editor approves it
    await b.page.goto("/workbench?kind=topic&target=lb:3");
    await b.page.getByRole("button", { name: "اعتمد", exact: true }).click();
    await expect(b.page.getByRole("status").filter({ hasText: "اعتُمدت وصارت سارية." })).toBeVisible();
    const lb = (await (await b.page.request.get("/api/v1/topics/lb:3")).json()) as { name: string; after: { title_fr: string } };
    expect([lb.name, lb.after.title_fr]).toEqual([name, "Prédication"]);

    // a verse QSAC suggested, beyond Quranpedia's index: shown in the mushaf's text, placed under the chapter
    await a.page.goto(`/workbench?kind=verdict&layer=topic_candidates&q=${encodeURIComponent("40:1")}`);
    const rows = a.page.locator(".workbench-box").filter({ has: a.page.locator(".quran") });
    await expect(rows.first()).toBeVisible();
    const row = rows.first();
    await row.getByRole("radio", { name: "ضعها تحت موضوع" }).click();
    await row.getByRole("searchbox", { name: "ابحث عن الموضوع الذي توضع تحته…" }).fill(name.split(" ").slice(0, 2).join(" "));
    await row.getByRole("button", { name: new RegExp(name) }).click();
    await expect(row).toContainText(`تحت: ${name}`);
    await expect(a.page.getByText("حكم واحد جاهز")).toBeVisible();
    const axeLayer = await new AxeBuilder({ page: a.page }).include(".workbench").analyze();
    expect(axeLayer.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    await a.page.getByRole("button", { name: "أرسلها إلى المراجعة" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "أُرسل حكم واحد إلى المراجعة" })).toBeVisible();
    await b.page.goto("/workbench?kind=verdict&layer=topic_candidates");
    await b.page.getByRole("button", { name: "اعتمدها كلها" }).click();
    await expect(b.page.getByRole("status").filter({ hasText: "اعتُمد حكم واحد" })).toBeVisible();
    const v = (await (await b.page.request.get("/api/v1/verses/40:1/topics")).json()) as { data: { id: string; via: string }[]; sources: Record<string, unknown> };
    expect(v.data.filter((x) => x.id === "lb:3").map((x) => x.via)).toEqual(["qsac"]);
    expect(Object.keys(v.sources)).toContain("qsac");

    // the reader: the verse's topic, the board's placement said, QSAC credited; the chapter a map's heading
    await expire(b.page);
    const reader = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await returning(reader);
    await reader.goto("/quran/40/1");
    const layer = reader.locator(".layer").filter({ hasText: "الموضوعات" });
    await layer.locator(".layer-head").click();
    await expect(layer).toContainText(name);
    await expect(layer).toContainText("وضعتها هيئة التحرير بعد اقتراح من مدونة QSAC الآلية");
    await expect(layer).toContainText("CC BY 4.0");
    await layer.locator("li").filter({ hasText: name }).getByRole("link", { name: "خريطة الموضوع" }).click();
    await expect(reader).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
    const id = reader.url().split("/graph/edit/")[1].split(/[?#]/)[0];
    await expect.poll(async () => (await storedGraph(reader, id))?.nodes.find((n) => n.id === "topic:lb:3")?.data.text, { timeout: 15_000 }).toBe(`${name}\nهيئة التحرير، عن فصول لابوم (الفصل ٣)`);
    const doc = (await storedGraph(reader, id))!;
    expect(doc.edges.some((e) => e.source === "verse:40:1" && e.target === "topic:lb:3")).toBe(true);
    const card = reader.locator('.react-flow__node[data-id="topic:lb:3"]');
    await expect(card).toContainText("من تصنيف هيئة التحرير");
    await card.click();
    const details = reader.getByRole("complementary", { name: "التفاصيل" });
    await expect(details).toContainText("موضوع من تصنيف هيئة التحرير");
    await expect(details).toContainText("عن الفصل ٣ من فهرس لابوم: «Prédication»، ص ٦٢");
    await expect(details).toContainText("منها آية وضعتها هيئة التحرير بعد اقتراح من مدونة QSAC الآلية");
    await reader.context().close();
  } finally {
    clean([a.email, b.email]);
    await expire(a.page);
    await drop(a);
    await drop(b);
  }
});

test("a proper name of the Quran as a topic map's heading: found in the library, its verses gathered ten at a time, a verse's names in its Meaning, a map opened from the reader (P8.3b)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the map editor is the desktop's (P8.6a)");
  test.setTimeout(90_000);
  await returning(page);
  const musa = ((await (await page.request.get(`/api/v1/entities?q=${encodeURIComponent("موسى")}`)).json()) as { data: { id: number; name: string; verses: number }[] }).data[0];
  const id = await newTopicMap(page);
  const library = page.getByRole("complementary", { name: "المكتبة" });
  await library.getByRole("textbox", { name: "ابحث عن علم…" }).fill("موسى");
  await library.getByRole("button", { name: `أضف العلم «${musa.name}»` }).click();
  const card = page.locator(`.react-flow__node[data-id="entity:${musa.id}"]`);
  await expect(card).toContainText("علم");
  await expect(card).toContainText("من أعلام المدونة القرآنية");
  await page.getByRole("button", { name: "ملاءمة" }).click();
  await card.locator(".extract-btn").click();
  await expect.poll(async () => (await storedGraph(page, id))?.edges.filter((e) => e.target === `entity:${musa.id}` && e.data?.rel === "part-of-topic").length, { timeout: 15_000 }).toBe(10);
  const first = ((await (await page.request.get(`/api/v1/entities/${musa.id}?limit=10`)).json()) as { data: { verse_key: string }[] }).data.map((v) => `verse:${v.verse_key}`);
  expect((await storedGraph(page, id))!.nodes.filter((n) => n.data.kind === "verse").map((n) => n.id).sort()).toEqual([...first].sort());
  await card.click();
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await expect(details).toContainText("اسم علم كما وسمته المدونة القرآنية");
  await expect(details).toContainText("مطابقة مرشحة لم تراجعها هيئة التحرير بعد");
  const axe = await new AxeBuilder({ page }).include(".graph-details").include(".library").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  // a verse's proper names in its Meaning, the verse gathered under one
  const other = await newTopicMap(page);
  const lib = page.getByRole("complementary", { name: "المكتبة" });
  await lib.locator(".type-tile").filter({ hasText: "آية" }).click();
  await lib.getByRole("textbox", { name: /ابحث عن جذر أو كلمة/ }).fill("2:51");
  await lib.locator("section").filter({ hasText: "أضف من المصحف والمعجم" }).locator("li").first().getByRole("button").click();
  await page.locator('.react-flow__node[data-id="verse:2:51"]').click();
  const names = page.getByRole("complementary", { name: "التفاصيل" }).locator("section").filter({ hasText: "أعلامها" });
  await expect(names).toContainText(musa.name);
  await names.getByRole("button", { name: `أضف العلم «${musa.name}»` }).click();
  await expect.poll(async () => (await storedGraph(page, other))?.edges.some((e) => e.source === "verse:2:51" && e.target === `entity:${musa.id}` && e.data?.rel === "part-of-topic"), { timeout: 10_000 }).toBe(true);
  // from the reader: a proper name opens as a map
  await page.goto("/quran/2/51");
  const layer = page.locator(".layer").filter({ hasText: "الأعلام" });
  await layer.locator(".layer-head").click();
  await layer.locator("li").filter({ hasText: musa.name }).getByRole("link", { name: "خريطة العلم" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const fresh = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await expect.poll(async () => (await storedGraph(page, fresh))?.nodes.some((n) => n.id === `entity:${musa.id}`), { timeout: 15_000 }).toBe(true);
});

test("the reader's own topics on a map: their own notes with their verses, beside the sources' topics, never among them (P8.3b)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the map editor is the desktop's (P8.6a)");
  test.setTimeout(90_000);
  await returning(page, { topics: [{ id: "tpatience", label: "الصبر في القرآن", ts: 1 }], verseTopics: { "quran:2:153": ["tpatience"], "quran:3:200": ["tpatience"] } });
  const id = await newTopicMap(page);
  const library = page.getByRole("complementary", { name: "المكتبة" });
  const mine = library.locator("section").filter({ hasText: "موضوعاتك" });
  await expect(mine).toContainText("الصبر في القرآن");
  await mine.getByRole("button", { name: "أضف موضوعك «الصبر في القرآن» بآياته" }).click();
  await expect.poll(async () => (await storedGraph(page, id))?.edges.filter((e) => e.target === "note:mytopic-tpatience").map((e) => e.source).sort(), { timeout: 15_000 }).toEqual(["verse:2:153", "verse:3:200"]);
  const card = page.locator('.react-flow__node[data-id="note:mytopic-tpatience"]');
  // the reader's own note: written by them, not a source's heading
  await expect(card).toContainText("ملاحظة شخصية — ليست من المصادر");
  await expect(card.getByRole("textbox", { name: "ملاحظة" })).toHaveValue("الصبر في القرآن");
  // the verse's Meaning lists it apart from the sources' topics
  await page.locator('.react-flow__node[data-id="verse:2:153"]').click();
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await expect(details.locator("section").filter({ hasText: "موضوعاتك" })).toContainText("الصبر في القرآن");
  const axe = await new AxeBuilder({ page }).include(".graph-details").include(".library").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
});
