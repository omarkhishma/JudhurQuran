import { expect, type Page, test } from "@playwright/test";
import { api } from "./helpers";

/**
 * The reader's hand-off to the graph editor (RDR-028, 198, 221/222, 341, 361…370, 450, 528, 601): every
 * seed reaches the editor, the dialog counts the cards the editor really creates, and adding to an
 * existing graph replaces nothing. Expectations come from the API and from the stored graph.
 */

type Card = { id: string; position: { x: number; y: number }; data: { kind: string; rootKey?: string; lemmaId?: number; form?: string } };
type Doc = { id: string; title: string; nodes: Card[]; edges: { id: string; source: string; target: string; label?: string }[] };
type VerseWord = { location: string; root: string | null; lemma_id: number | null; text_imlaei: string };

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };

/** A stored graph, read from this browser's IndexedDB (idb-keyval's default store). */
async function storedGraph(page: Page, id: string): Promise<Doc> {
  return page.evaluate(
    (key) =>
      new Promise<Doc>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction("keyval").objectStore("keyval").get(key);
          req.onsuccess = () => resolve(req.result as Doc);
          req.onerror = () => reject(req.error);
        };
      }),
    `jadhr-graph:${id}`,
  );
}

/** base64url of UTF-8 JSON, as the reader encodes seeds (RDR-601). */
const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");

async function editorId(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  return page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
}

const countKinds = (d: Doc) => d.nodes.reduce<Record<string, number>>((m, n) => ({ ...m, [n.data.kind]: (m[n.data.kind] ?? 0) + 1 }), {});

test("graph hand-off: a word opens a dialog whose rows are exactly the cards the editor then holds (RDR-028, 361…364, 528)", async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), RETURNING);
  await page.goto("/quran/1?w=alamin&at=1:2:4");
  await page.locator(".reader-panel, .reader-sheet").getByRole("button", { name: "افتح في الخريطة" }).click();
  const dialog = page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" });
  await expect(dialog).toBeVisible();
  const rows = dialog.locator(".handoff-rows li");
  await expect(rows.first()).toBeVisible();
  const shown: Record<string, number> = {};
  for (const li of await rows.all()) {
    const label = (await li.locator(".font-medium").innerText()).trim();
    const n = Number((await li.locator(".mono").innerText()).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    shown[label] = n;
  }
  await dialog.getByRole("link", { name: "افتح محرر الخرائط" }).click();
  const doc = await storedGraph(page, await editorId(page));
  const kinds = countKinds(doc);
  expect(shown).toEqual({ "جذر": kinds.root, "صيغة": kinds.lemma, "كلمة": kinds.word, "آية": kinds.verse });
  // the root at the centre, the verse the reader came from linked to the word read there
  const root = await api<{ occurrences: number }>(page, `/roots/${encodeURIComponent("علم")}`);
  expect(doc.nodes.filter((n) => n.data.kind === "root").map((n) => n.data.rootKey)).toEqual(["علم"]);
  expect(doc.nodes.some((n) => n.id === "verse:1:2:4")).toBeTruthy();
  expect(doc.edges.some((e) => e.target === "verse:1:2:4" && e.source.startsWith("word:"))).toBeTruthy();
  expect(root.occurrences).toBeGreaterThan(0);
  await expect(page.locator(".graph-card").first()).toBeVisible();
});

test("graph hand-off: a verse becomes one card linked to each of its words with a root, their lemmas and roots (RDR-365)", async ({ page }) => {
  const v = await api<{ words: VerseWord[] }>(page, "/verses/2:255");
  const words = v.words.filter((w) => w.root && w.lemma_id != null);
  await page.goto(`/graph/seed?s=${seedParam({ seed: "verse", key: "2:255" })}`);
  const doc = await storedGraph(page, await editorId(page));
  const kinds = countKinds(doc);
  expect(kinds.verse).toBe(1);
  expect(kinds.root).toBe(new Set(words.map((w) => w.root)).size);
  expect(kinds.lemma).toBe(new Set(words.map((w) => w.lemma_id)).size);
  expect(kinds.word).toBe(new Set(words.map((w) => `${w.lemma_id}:${w.text_imlaei}`)).size);
  expect(doc.edges.filter((e) => e.target === "verse:2:255")).toHaveLength(kinds.word);
});

test("graph hand-off: adding to an existing graph keeps every card where it was and duplicates nothing (RDR-367)", async ({ page }) => {
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  const id = await editorId(page);
  const before = await storedGraph(page, id);
  const add = await api<{ words: VerseWord[] }>(page, "/verses/1:2");
  await page.goto(`/graph/seed?s=${seedParam({ seed: "verse", key: "1:2" })}&into=${id}`);
  expect(await editorId(page)).toBe(id);
  const after = await storedGraph(page, id);
  for (const n of before.nodes) {
    const m = after.nodes.find((x) => x.id === n.id);
    expect(m?.position, n.id).toEqual(n.position);
  }
  expect(new Set(after.nodes.map((n) => n.id)).size).toBe(after.nodes.length);
  expect(new Set(after.edges.map((e) => e.id)).size).toBe(after.edges.length);
  // the verse's words with a root are all on the graph now, linked to the new verse card
  for (const w of add.words.filter((x) => x.root && x.lemma_id != null)) {
    expect(after.nodes.some((n) => n.id === `word:${w.lemma_id}:${w.text_imlaei}`), w.location).toBeTruthy();
  }
  expect(after.nodes.some((n) => n.id === "verse:1:2")).toBeTruthy();
});

test("graph hand-off: a trail keeps its order as numbered links; old ?w= links and unreadable seeds are handled (RDR-341, 450, 601)", async ({ page }) => {
  const steps = [
    { kind: "word", id: "alamin" },
    { kind: "verse", id: "1:2" },
    { kind: "root", id: "رحم" },
  ];
  await page.goto(`/graph/seed?s=${seedParam({ seed: "trail", steps })}`);
  const trail = await storedGraph(page, await editorId(page));
  const numbered = trail.edges.filter((e) => e.label).sort((a, b) => Number(a.label) - Number(b.label));
  expect(numbered.map((e) => e.label)).toEqual(["1", "2"]);
  expect(numbered[0].target).toBe("verse:1:2");
  expect(numbered[1].target).toBe(`root:${"رحم"}`);

  await page.goto("/graph?w=alamin");
  const legacy = await storedGraph(page, await editorId(page));
  expect(legacy.nodes.some((n) => n.data.kind === "root" && n.data.rootKey === "علم")).toBeTruthy();

  await page.goto("/graph/seed?s=not-a-seed");
  await expect(page.getByRole("alert").filter({ hasText: "لا يحمل بذرة" })).toBeVisible();
});

test("graph hand-off: the seed JSON can be copied, and the root and verse tools offer the hand-off (RDR-221, 368, 370)", async ({ page, context, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "clipboard permissions are granted on desktop Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), RETURNING);
  await page.goto("/quran/1?w=alamin&at=1:2:4");
  const panel = page.locator(".reader-panel");
  await panel.getByRole("button", { name: "افتح في الخريطة" }).click();
  const dialog = page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" });
  await dialog.getByRole("button", { name: "نسخ البذرة (JSON)" }).click();
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied).toEqual({ seed: "word", slug: "alamin", at: "1:2:4" });
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "ارسم الجذر" }).first().click();
  await expect(page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" })).toContainText("عائلة الجذر كاملة");
});
