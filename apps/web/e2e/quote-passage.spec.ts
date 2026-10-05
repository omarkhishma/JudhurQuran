import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { displayBare } from "../src/lib/arabic/normalize";
import { api } from "./helpers";

/**
 * A passage of a dictionary's article on a map (B36): the reader selects the lines that bear on the word — with the
 * vowel marks hidden too — and puts them alone on a map; the map keeps where they run and a hash, never the words; the
 * card draws them from the article, marked in it in the details, where other lines narrow it or the whole article is
 * quoted again; an article retyped since is said, never drawn as if it still held the passage. Expectations from the
 * API and the stored map.
 */

type Run = { from: number; to: number; hash: string };
type Card = { id: string; data: { kind: string; entry?: string | number; run?: Run; focus?: boolean } };
type Doc = { pendingLayout?: boolean; nodes: Card[] };
type Entry = { uri: string; body: string; title_ar: string; author_ar: string };

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");

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

async function editorId(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  return id;
}

/** The characters [from, to) of an element's text selected, as a reader's drag selects them. */
async function select(box: Locator, from: number, to: number) {
  await box.evaluate(
    (el, [a, b]) => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let pos = 0;
      let start: [Node, number] | null = null;
      let end: [Node, number] | null = null;
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const len = n.textContent!.length;
        if (!start && a < pos + len) start = [n, a - pos];
        if (!end && b <= pos + len) {
          end = [n, b - pos];
          break;
        }
        pos += len;
      }
      const r = document.createRange();
      r.setStart(...start!);
      r.setEnd(...end!);
      const s = document.getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
    },
    [from, to],
  );
}

const quoteEntry = "dict:maqayis:علم";

test("a passage of an article goes alone onto a map, kept as where it runs and a hash, narrowed or widened in the details (B36)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the map's details are the desktop's; the reader's passage is read at 390 px in the screenshots");
  test.setTimeout(90_000);
  const e = await api<Entry>(page, `/lexicon/entries/${encodeURIComponent(quoteEntry)}`);
  // the dictionaries open, their vowel marks hidden: the passage is chosen in the text as shown
  await page.addInitScript(() => {
    localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
    localStorage.setItem("jadhr-prefs", JSON.stringify({ state: { marks: false, layerOpen: { senses: false, family: false, patterns: false, lexica: true, timeline: false, usage: false } }, version: 2 }));
  });
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const article = page.locator('[data-section="lexica"] .dict-article[data-dict="maqayis"]');
  const shownBox = article.locator(".dict-body").first();
  const shown = await shownBox.innerText();
  expect(displayBare(e.body).startsWith(shown.slice(0, 40))).toBe(true);
  const word = "يدل على";
  const at = shown.indexOf(word);
  expect(at).toBeGreaterThan(0);
  await select(shownBox, at, at + 60);
  const bar = article.getByRole("group", { name: "ضع هذا المقطع على خريطة" });
  await expect(bar).toContainText(shown.slice(at, at + 20));
  const axe = await new AxeBuilder({ page }).include(".passage-bar").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  await bar.getByRole("button", { name: "ضع هذا المقطع على خريطة" }).click();
  await page.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" }).getByRole("link", { name: "افتح محرر الخرائط" }).click();
  const id = await editorId(page);
  const doc = (await storedGraph(page, id))!;
  const note = doc.nodes.find((n) => n.data.kind === "note")!;
  const run = note.data.run!;
  // the article as served, its marks kept: the run ends on the marks of its last letter, and reads as the reader chose it
  expect(note.id).toBe(`quote:${e.uri}~${run.from}-${run.to}`);
  expect(note.data).toEqual({ kind: "note", entry: e.uri, run, focus: true });
  expect(displayBare(e.body.slice(run.from, run.to))).toBe(shown.slice(at, at + 60).trim());
  expect(JSON.stringify(doc)).not.toContain(e.body.slice(run.from, run.from + 16));
  // the card draws the passage, the article before and after it marked «…»
  const card = page.locator(`.react-flow__node[data-id="${note.id}"]`);
  await expect(card.locator("blockquote")).toContainText(e.body.slice(run.from, run.from + 20));
  await expect(card.locator("blockquote")).toContainText("«…");
  await expect(card.locator("figcaption")).toContainText(`${e.title_ar} — ${e.author_ar} · `);
  await expect(card.locator("figcaption")).toContainText("مقطع منها");
  // the details: the passage marked in the whole article
  await card.click({ position: { x: 40, y: 14 } });
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await expect(details.locator("mark.quote-run")).toHaveText(e.body.slice(run.from, run.to));
  // other lines narrow it, one step; then the whole article again
  await select(details.locator(".quote-full"), run.from + 2, run.to - 2);
  await details.getByRole("group", { name: "اقتبس هذا المقطع وحده" }).getByRole("button", { name: "اقتبس هذا المقطع وحده" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === note.id)!.data.run?.from).toBeGreaterThanOrEqual(run.from + 2);
  const narrowed = (await storedGraph(page, id))!.nodes.find((n) => n.id === note.id)!.data.run!;
  expect(narrowed.to).toBeLessThanOrEqual(run.to - 1);
  await expect(details.locator("mark.quote-run")).toHaveText(e.body.slice(narrowed.from, narrowed.to));
  await details.getByRole("button", { name: "اقتبس المادة كلها" }).click();
  await expect.poll(async () => (await storedGraph(page, id))!.nodes.find((n) => n.id === note.id)!.data.run).toBeUndefined();
  await expect(card.locator("figcaption")).not.toContainText("مقطع منها");
  await expect(details.locator("mark.quote-run")).toHaveCount(0);
});

test("a passage the article no longer holds is said, and the article shown from its start (B36)", async ({ page }) => {
  const e = await api<Entry>(page, `/lexicon/entries/${encodeURIComponent(quoteEntry)}`);
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 })));
  // a map made on a release that typed the article otherwise: the same place, another hash
  await page.goto(`/graph/seed?s=${seedParam({ seed: "quote", entry: e.uri, run: { from: 10, to: 60, hash: "00000000" } })}`);
  await editorId(page);
  const card = page.locator(".graph-card").filter({ has: page.locator("blockquote") }).first();
  await expect(card).toContainText("تغيّر نص المادة في هذا الإصدار");
  const quoted = (await card.locator("blockquote").innerText()).replace(/^«|»$/g, "").replace(/\s*…$/, "").trim();
  expect(e.body.replace(/\s+/g, " ").startsWith(quoted.replace(/\s+/g, " "))).toBe(true);
  await expect(card.locator("figcaption")).not.toContainText("مقطع منها");
});
