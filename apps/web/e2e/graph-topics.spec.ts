import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Topic maps (P8.3, QAN-09; research 06 Part 3, D29): Quranpedia's topics, credited with the version of their data — a
 * verse's topics in the reader opened as a topic map; the topic's card gathering its verses ten at a time and its
 * sub-topics; a topic found by name in the library; a verse's topics in its Meaning, the verse gathered under one.
 * Expectations read from the API and the map stored in this browser.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string } };
type Doc = { kind: string; nodes: Card[]; edges: { source: string; target: string; data?: Record<string, unknown> }[] };
type TopicPage = { id: string; name: string; total: number; subtopics: { id: string }[]; data: { verse_key: string }[]; sources: Record<string, { version: string }> };

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

const returning = (page: Page) => page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));

test("a verse's topic opened from the reader as a topic map: its card with Quranpedia's credit and version, its first ten verses and its sub-topics, ten more on request (P8.3)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the map editor is the desktop's (P8.6a)");
  test.setTimeout(90_000);
  await returning(page);
  const vt = (await (await page.request.get("/api/v1/verses/2:3/topics")).json()) as { data: { id: string; name: string; verses: number }[] };
  const pick = vt.data.reduce((a, b) => (b.verses > a.verses ? b : a));
  const topic = (await (await page.request.get(`/api/v1/topics/${pick.id}?limit=20`)).json()) as TopicPage;
  // the reader: the verse's topics, credited, each a way to its map
  await page.goto("/quran/2/3");
  const layer = page.locator(".layer").filter({ hasText: "الموضوعات" });
  await layer.locator(".layer-head").click();
  await expect(layer).toContainText(pick.name);
  await expect(layer).toContainText(`إصدار ${topic.sources["quranpedia-topics"].version}`);
  await layer.locator("li").filter({ hasText: pick.name }).getByRole("link", { name: "خريطة الموضوع" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await expect.poll(async () => (await storedGraph(page, id))?.kind, { timeout: 15_000 }).toBe("topic");
  const doc = (await storedGraph(page, id))!;
  const head = doc.nodes.find((n) => n.id === `topic:${pick.id}`)!;
  expect(head.data.text).toBe(`${topic.name}\nالموسوعة القرآنية (quranpedia.net) — إصدار ${topic.sources["quranpedia-topics"].version}`);
  const firstTen = topic.data.slice(0, 10).map((v) => `verse:${v.verse_key}`);
  expect(doc.nodes.filter((n) => n.data.kind === "verse").map((n) => n.id).sort()).toEqual([...firstTen].sort());
  for (const v of firstTen) expect(doc.edges.some((e) => e.source === v && e.target === head.id && e.data?.rel === "part-of-topic")).toBe(true);
  for (const s of topic.subtopics.slice(0, 12)) expect(doc.edges.some((e) => e.source === `topic:${s.id}` && e.target === head.id)).toBe(true);
  // the card gathers ten more when it has more
  if (topic.total > 10) {
    await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
    await page.getByRole("button", { name: "ملاءمة" }).click();
    await page.locator(`.react-flow__node[data-id="topic:${pick.id}"] .extract-btn`).click();
    const more = topic.data.slice(10, 20).map((v) => `verse:${v.verse_key}`);
    await expect.poll(async () => (await storedGraph(page, id))?.nodes.filter((n) => more.includes(n.id)).length, { timeout: 15_000 }).toBe(more.length);
  }
});

test("a topic found by name in the library, and a verse gathered under one of its own topics from its Meaning (P8.3)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details are the desktop's (P8.6a)");
  test.setTimeout(90_000);
  await returning(page);
  await page.goto("/graph");
  await page.getByRole("button", { name: "خريطة موضوع" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const library = page.getByRole("complementary", { name: "المكتبة" });
  const found = (await (await page.request.get(`/api/v1/topics?q=${encodeURIComponent("الصلاة")}&limit=12`)).json()) as { data: { id: string; name: string }[] };
  await library.getByRole("textbox", { name: "ابحث عن موضوع…" }).fill("الصلاة");
  await library.getByRole("button", { name: `أضف موضوع «${found.data[0].name}»` }).click();
  await expect(page.locator(`.react-flow__node[data-id="topic:${found.data[0].id}"]`)).toHaveCount(1);
  // a verse from the library, then one of its topics from its Meaning: the verse gathered under it
  await library.locator(".type-tile").filter({ hasText: "آية" }).click();
  await library.getByRole("textbox", { name: /ابحث عن جذر أو كلمة/ }).fill("2:255");
  await library.locator("section").filter({ hasText: "أضف من المصحف والمعجم" }).locator("li").first().getByRole("button").click();
  await expect(page.locator('.react-flow__node[data-id="verse:2:255"]')).toHaveCount(1);
  await page.locator('.react-flow__node[data-id="verse:2:255"]').click();
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  const vt = (await (await page.request.get("/api/v1/verses/2:255/topics")).json()) as { data: { id: string; name: string }[] };
  const section = details.locator("section").filter({ hasText: "موضوعاتها" });
  await expect(section).toContainText(vt.data[0].name);
  await section.getByRole("button", { name: `أضف موضوع «${vt.data[0].name}»` }).click();
  await expect.poll(async () => (await storedGraph(page, id))?.edges.some((e) => e.source === "verse:2:255" && e.target === `topic:${vt.data[0].id}` && e.data?.rel === "part-of-topic"), { timeout: 10_000 }).toBe(true);
  // the topic's own Meaning
  await page.locator(`.react-flow__node[data-id="topic:${vt.data[0].id}"]`).click();
  await expect(details).toContainText("موضوع من فهرس الموسوعة القرآنية");
  await expect(details).toContainText("إصدار 2026-10-03");
  const axe = await new AxeBuilder({ page }).include(".graph-details").include(".library").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
