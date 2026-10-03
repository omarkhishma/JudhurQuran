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
