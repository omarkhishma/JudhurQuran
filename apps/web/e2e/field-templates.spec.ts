import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * A map type's own fields (B37): a meaning map offers its words a «حقل دلالي» to tag and a «فرق» to write, on one card
 * or on every card of its kind at once; a topic map offers «المحور», whose options the reader names once and every
 * card shares; a free map offers none. Empty, the reader's own. Expectations read from the stored map.
 */

type Field = { id: string; kind: string; label: string; value: unknown; options?: string[]; tpl?: string };
type Card = { id: string; data: { kind: string; fields?: Field[] } };
type Doc = { nodes: Card[] };

const node = (id: string, kind: string, data: object, x: number) => ({ id, type: "card", position: { x, y: 0 }, data: { kind, ...data } });

/** A map put in this browser's store as the editor keeps one, and opened. */
async function openMap(page: Page, kind: string, nodes: object[]): Promise<string> {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 })));
  await page.goto("/graph");
  const id = `b37${Date.now().toString(36)}`;
  const now = Date.now();
  const doc = { version: 2, id, title: "خريطة الاختبار", kind, createdAt: now, updatedAt: now, nodes, edges: [] };
  await page.evaluate(
    ([key, d]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onupgradeneeded = () => open.result.createObjectStore("keyval");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("keyval", "readwrite");
          tx.objectStore("keyval").put(d, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    [`jadhr-graph:${id}`, doc] as const,
  );
  await page.goto(`/graph/edit/${id}`);
  await expect(page.locator(".graph-card").first()).toBeVisible({ timeout: 30_000 });
  return id;
}

async function stored(page: Page, id: string): Promise<Doc> {
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

const fieldsOf = async (page: Page, id: string, card: string) => (await stored(page, id)).nodes.find((n) => n.id === card)!.data.fields ?? [];

async function settingsOf(page: Page, card: string) {
  await page.getByRole("button", { name: "ملاءمة" }).click();
  await page.locator(`.react-flow__node[data-id="${card}"]`).click({ position: { x: 40, y: 14 } });
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await details.getByRole("tab", { name: "الإعدادات" }).click();
  return details;
}

test("a meaning map offers its words a semantic field and a difference, on one card or on every card of its kind (B37)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details panel is the desktop's; the phone editor is P8.6a's");
  const id = await openMap(page, "meaning", [
    node("lemma:ilm", "lemma", { slug: "ilm", ar: "عِلْم" }, 0),
    node("lemma:alim", "lemma", { slug: "alim", ar: "عَلِيم" }, 360),
    node("root:علم", "root", { rootKey: "علم", ar: "ع ل م" }, 720),
  ]);
  const details = await settingsOf(page, "lemma:ilm");
  await details.getByRole("button", { name: "+ إضافة" }).click();
  const menu = details.getByRole("menu");
  await expect(menu).toContainText("فارغة، تملؤها أنت، ولا تأتي من المصادر");
  const axe = await new AxeBuilder({ page }).include(".field-menu").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  await menu.getByRole("menuitem", { name: "حقل دلالي على كل البطاقات من نوعها (٢)" }).click();
  for (const card of ["lemma:ilm", "lemma:alim"]) {
    await expect.poll(async () => (await fieldsOf(page, id, card)).map((f) => [f.label, f.kind, f.tpl, f.value])).toEqual([["حقل دلالي", "tags", "semanticField", []]]);
  }
  expect(await fieldsOf(page, id, "root:علم")).toEqual([]);
  // on this card only, once: the difference here, and the semantic field no longer offered to it
  await details.getByRole("button", { name: "+ إضافة" }).click();
  await expect(menu.getByRole("menuitem", { name: "حقل دلالي", exact: true })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "فرق", exact: true }).click();
  await expect.poll(async () => (await fieldsOf(page, id, "lemma:ilm")).map((f) => f.tpl)).toEqual(["semanticField", "difference"]);
  expect((await fieldsOf(page, id, "lemma:alim")).map((f) => f.tpl)).toEqual(["semanticField"]);
  // the root's own: offered to it as well, a kind of its own
  const rootDetails = await settingsOf(page, "root:علم");
  await rootDetails.getByRole("button", { name: "+ إضافة" }).click();
  await expect(rootDetails.getByRole("menuitem", { name: "حقل دلالي", exact: true })).toBeVisible();
});

test("a topic map's axis: its options named once and shared by every card, each card's choice its own; a free map offers none (B37)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details panel is the desktop's; the phone editor is P8.6a's");
  const id = await openMap(page, "topic", [node("verse:2:255", "verse", { verse: { key: "2:255" } }, 0), node("verse:2:256", "verse", { verse: { key: "2:256" } }, 520)]);
  let details = await settingsOf(page, "verse:2:255");
  await details.getByRole("button", { name: "+ إضافة" }).click();
  await details.getByRole("menu").getByRole("menuitem", { name: "المحور على كل البطاقات من نوعها (٢)" }).click();
  await expect.poll(async () => (await fieldsOf(page, id, "verse:2:256")).map((f) => [f.label, f.kind, f.tpl, f.value, f.options])).toEqual([["المحور", "select", "axis", "", []]]);
  // the options, named on one card, are every card's
  await expect(details).toContainText("الخيارات، وهي نفسها على كل بطاقات الخريطة");
  const add = details.getByRole("textbox", { name: "إضافة خيار إلى «المحور»" });
  await add.fill("الإيمان");
  await add.press("Enter");
  await add.fill("العمل");
  await add.press("Enter");
  await expect.poll(async () => (await fieldsOf(page, id, "verse:2:256"))[0].options).toEqual(["الإيمان", "العمل"]);
  await details.getByRole("combobox", { name: "المحور" }).selectOption("العمل");
  await expect.poll(async () => (await fieldsOf(page, id, "verse:2:255"))[0].value).toBe("العمل");
  expect((await fieldsOf(page, id, "verse:2:256"))[0].value).toBe("");
  // an option taken away unsets the choice that named it
  await details.getByRole("button", { name: "إزالة الخيار «العمل»" }).click();
  await expect.poll(async () => (await fieldsOf(page, id, "verse:2:255"))[0]).toMatchObject({ options: ["الإيمان"], value: "" });

  // a free map: the ten kinds, no type's own
  await openMap(page, "free", [node("lemma:ilm", "lemma", { slug: "ilm", ar: "عِلْم" }, 0)]);
  details = await settingsOf(page, "lemma:ilm");
  await details.getByRole("button", { name: "+ إضافة" }).click();
  await expect(details.getByRole("menu")).not.toContainText("حقل دلالي");
  await expect(details.getByRole("menu")).not.toContainText("تملؤها أنت");
});
