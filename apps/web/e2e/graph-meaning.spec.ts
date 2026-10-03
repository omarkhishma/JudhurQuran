import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { followSignInLink } from "./helpers";

/**
 * Meaning maps (P8.4b, research 15; QAN-10): a root's relations in the classical books — those the editorial board
 * reviewed drawn as the map's own links, each carrying its book; those only extracted shown as such and put on the
 * map only as the reader's own, dashed; a link's panel quoting the book from the dataset and adding the verses the two
 * roots share. Expectations read from the API and the map stored in this browser.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string } };
type Doc = { nodes: Card[]; edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[] };
type Relations = { data: { id: string; a: { root: string; word: string }; b: { root: string; word: string } | null }[]; waiting: number; extracted: { id: string; a: { root: string; word: string }; b: { root: string; word: string } }[] };

const ROOT = path.resolve(__dirname, "../../..");
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://jadhr:jadhr@127.0.0.1:5442/jadhr";
const tag = () => `${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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

/** A new meaning map with one root on it, from the library: the map's id. */
async function meaningMapWith(page: Page, root: string): Promise<string> {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 })));
  await page.goto("/graph");
  await page.getByRole("button", { name: "حقل دلالي" }).click();
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await page.addStyleTag({ content: ".react-flow__minimap, .react-flow__minimap * { visibility: hidden !important; pointer-events: none !important; }" });
  const library = page.getByRole("complementary", { name: "المكتبة" });
  await library.locator(".type-tile").filter({ hasText: "جذر" }).click();
  await library.getByRole("textbox", { name: /ابحث عن جذر أو كلمة/ }).fill(root);
  const adds = library.locator("section").filter({ hasText: "أضف من المصحف والمعجم" }).locator("li");
  await adds.filter({ hasText: [...root].join(" ") }).first().getByRole("button").click();
  await expect(page.locator(`.react-flow__node[data-id="root:${root}"]`)).toHaveCount(1);
  return id;
}

test("a root's relations in a meaning map: none reviewed yet is said, the extracted ones listed as such, one put on the map as the reader's own dashed link, its panel quoting the book, the shared verses added (P8.4b)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details are the desktop's (P8.6a)");
  test.setTimeout(90_000);
  const rel = (await (await page.request.get(`/api/v1/roots/${encodeURIComponent("علم")}/relations`)).json()) as Relations;
  test.skip(rel.data.length > 0, "a relation on this root is in force in this database");
  const id = await meaningMapWith(page, "علم");
  const card = page.locator('.react-flow__node[data-id="root:علم"]');
  // open, the card offers its related roots; none is in force, and the reader is told how many wait and where
  await card.getByRole("button", { name: "الجذور القريبة" }).click();
  await expect(page.locator(".graph-toast")).toContainText("لم تراجع هيئة التحرير بعدُ علاقة على هذا الجذر");
  // the Meaning panel: the extracted relations, said to be, each the reader's to add
  await card.click();
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await expect(details).toContainText("علاقاته في الكتب");
  await details.getByRole("button", { name: /مستخرجة لم تراجع/ }).click();
  await expect(details).toContainText("ولم تراجعها هيئة التحرير");
  const first = rel.extracted[0];
  const other = first.a.root === "علم" ? first.b.root : first.a.root;
  await details.locator(".meaning-quote.is-extracted").first().getByRole("button", { name: "أضفها رابطًا لي" }).click();
  await expect(page.locator(`.react-flow__node[data-id="root:${other}"]`)).toHaveCount(1);
  await expect
    .poll(async () => (await storedGraph(page, id))?.edges.map((e) => [e.data?.rel, e.data?.relation, e.data?.reviewed]), { timeout: 10_000 })
    .toEqual([["near-in-meaning", first.id, false]]);
  await expect(page.locator(".editor-header").getByRole("button", { name: "تراجع", exact: true })).toHaveAttribute("title", `تراجع: إضافة «${first.a.word}» و«${first.b.word}» رابطًا لي`);
  // the link's panel: the book's words from the dataset, said not reviewed; and the verses the roots share
  await page.getByRole("button", { name: "ملاءمة" }).click();
  // nothing selected, so Enter picks the link rather than folding a card
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
  await page.locator(".react-flow__edge").first().focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(".link-panel");
  await expect(panel).toContainText("مستخرجة آليًا ولم تراجعها هيئة التحرير");
  const quote = ((await (await page.request.get(`/api/v1/relations/${encodeURIComponent(first.id)}`)).json()) as { quote: string }).quote;
  await expect(panel.locator("blockquote")).toContainText(quote.slice(0, 30));
  const shared = (await (await page.request.get(`/api/v1/roots/${encodeURIComponent("علم")}/shared?with=${encodeURIComponent(other)}&limit=500`)).json()) as { count: number; verses: string[] };
  if (shared.count > 0) {
    await panel.getByRole("button", { name: /^أضف .* منها$/ }).click();
    const want = shared.verses.slice(0, 10).map((k) => `verse:${k}`);
    await expect.poll(async () => (await storedGraph(page, id))?.nodes.filter((n) => n.data.kind === "verse").map((n) => n.id).sort(), { timeout: 15_000 }).toEqual([...want].sort());
    const edges = (await storedGraph(page, id))!.edges;
    for (const v of want) for (const r of ["root:علم", `root:${other}`]) expect(edges.some((e) => e.source === r && e.target === v && e.data?.rel === "attests")).toBe(true);
  } else {
    await expect(panel).toContainText("لا آية يجتمع فيها الجذران.");
  }
  const axe = await new AxeBuilder({ page }).include(".graph-details").include(".link-panel").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

// ─── with the board: a relation it reviewed is the map's own ───

const role = (email: string, r: string) => execFileSync("uv", ["run", "python", "-m", "jadhr_api.roles", email, r, "e2e meaning"], { cwd: ROOT, stdio: "pipe" });
function clean(emails: string[]) {
  const psql = process.env.E2E_PSQL ?? (existsSync("/opt/homebrew/opt/postgresql@17/bin/psql") ? "/opt/homebrew/opt/postgresql@17/bin/psql" : "psql");
  execFileSync(psql, [DB, "-q", "-c", `delete from editorial.entries where author_id in (select id from accounts.users where email in (${emails.map((e) => `'${e}'`).join(",")}));`], { stdio: "pipe" });
}
type Editor = { page: Page; h: Record<string, string>; email: string };
async function editor(browser: Browser, who: string): Promise<Editor> {
  const email = `e2e-mm-${who}-${tag()}@example.org`;
  const page = await (await browser.newContext()).newPage();
  await page.request.post("/api/v1/auth/email", { data: { email, return_to: "/workbench", locale: "ar" } });
  let link = "";
  await expect
    .poll(async () => {
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      return (link = m.at(-1)?.link ?? "");
    })
    .not.toBe("");
  const u = new URL(link);
  await followSignInLink(page, u.pathname + u.search);
  await expect(page).toHaveURL(/\/workbench/);
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  role(email, "editor");
  return { page, h, email };
}
async function drop(p: Editor) {
  const c = (await (await p.page.request.post("/api/v1/me/delete", { headers: p.h })).json().catch(() => ({}))) as { confirm?: string };
  if (c.confirm) await p.page.request.post("/api/v1/me/delete/confirm", { headers: p.h, data: { confirm: c.confirm } });
  await p.page.context().close();
}

test("a relation the board reviewed: Related roots adds the other root with the map's own link, its book in the link's panel (P8.4b)", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(120_000);
  const a = await editor(browser, "a");
  const b = await editor(browser, "b");
  try {
    const put = await a.page.request.put(`/api/v1/editorial/verdict/${encodeURIComponent("relation_candidates:askari-furuq:0006:r")}`, { headers: a.h, data: { value: { verdict: "reviewed" }, sources: [] } });
    const e = (await put.json()) as { id: string };
    await a.page.request.post(`/api/v1/editorial/entries/${e.id}/submit`, { headers: a.h });
    expect((await b.page.request.post(`/api/v1/editorial/entries/${e.id}/decide`, { headers: b.h, data: { decision: "approve" } })).status()).toBe(200);
    const id = await meaningMapWith(page, "سمو");
    await page.locator('.react-flow__node[data-id="root:سمو"]').getByRole("button", { name: "الجذور القريبة" }).click();
    await expect(page.locator('.react-flow__node[data-id="root:حدد"]')).toHaveCount(1);
    await expect.poll(async () => (await storedGraph(page, id))?.edges.map((x) => [x.source, x.target, x.data?.relation, x.data?.reviewed, x.data?.source])).toEqual([
      ["root:سمو", "root:حدد", "askari-furuq:0006:r", true, expect.stringContaining("الفروق اللغوية")],
    ]);
    await expect(page.locator(".graph-toast")).toContainText("أُضيف جذر قريب");
    await page.getByRole("button", { name: "ملاءمة" }).click();
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.locator(".react-flow__edge").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".link-panel")).toContainText("راجعتها هيئة التحرير");
    // again: every related root is already on the map
    await page.keyboard.press("Escape");
    await page.locator('.react-flow__node[data-id="root:سمو"]').getByRole("button", { name: "الجذور القريبة" }).click();
    await expect(page.locator(".graph-toast")).toContainText("الجذور القريبة كلها على الخريطة.");
  } finally {
    clean([a.email, b.email]);
    await drop(a);
    await drop(b);
  }
});

test("a field from al-Thaʿālibī: put on the map from a root's Meaning, one card for the chapter that a second root's member joins; the field in the reader's word panel (P8.4c)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the details are the desktop's (P8.6a)");
  test.setTimeout(90_000);
  const id = await meaningMapWith(page, "سبع");
  const details = page.getByRole("complementary", { name: "التفاصيل" });
  await page.locator('.react-flow__node[data-id="root:سبع"]').click();
  await expect(details).toContainText("حقوله في الكتب");
  await details.getByRole("button", { name: /باب مستخرج يذكر كلمة منه|أبواب مستخرجة|بابًا مستخرجًا|بابان مستخرجان/ }).click();
  const item = details.locator(".meaning-quote.is-extracted").filter({ hasText: "في ذكر ضروب من الحيوان" });
  await expect(item).toContainText("فهو سبع");
  await item.getByRole("button", { name: "أضف الحقل رابطًا لي" }).click();
  await expect(page.locator('.react-flow__node[data-id="field:fiqh-lugha:0002"]')).toHaveCount(1);
  await expect
    .poll(async () => (await storedGraph(page, id))?.edges.map((e) => [e.source, e.target, e.data?.rel, e.data?.relation, e.data?.reviewed]))
    .toEqual([["root:سبع", "field:fiqh-lugha:0002", "field-member", "fiqh-lugha:0002:m005", false]]);
  // a second root whose word the same chapter names joins the same card: the field gathers its members
  const library = page.getByRole("complementary", { name: "المكتبة" });
  await library.getByRole("textbox", { name: /ابحث عن جذر أو كلمة/ }).fill("حمم");
  await library.locator("section").filter({ hasText: "أضف من المصحف والمعجم" }).locator("li").filter({ hasText: "ح م م" }).first().getByRole("button").click();
  await page.locator('.react-flow__node[data-id="root:حمم"]').click();
  await details.getByRole("button", { name: /مستخرج/ }).last().click();
  await details.locator(".meaning-quote.is-extracted").filter({ hasText: "في ذكر ضروب من الحيوان" }).getByRole("button", { name: "أضف الحقل رابطًا لي" }).click();
  await expect(page.locator('.react-flow__node[data-id^="field:"]')).toHaveCount(1);
  await expect
    .poll(async () => (await storedGraph(page, id))?.edges.filter((e) => e.target === "field:fiqh-lugha:0002").map((e) => e.source).sort())
    .toEqual(["root:حمم", "root:سبع"]);
  // the reader: the field under the word, with its chapter and the sentence
  const fam = (await (await page.request.get(`/api/v1/roots/${encodeURIComponent("سبع")}/family`)).json()) as { family: { members: { slug: string; ar: { bare: string } }[] }[] };
  const slug = fam.family.flatMap((g) => g.members).find((m) => m.ar.bare === "سبع")?.slug ?? fam.family[0].members[0].slug;
  const at = ((await (await page.request.get(`/api/v1/words/${slug}/verses?limit=1`)).json()) as { data: { locations: string[] }[] }).data[0].locations[0];
  await page.goto(`/word/${at}`);
  const field = page.locator(".wujuh-sense").filter({ hasText: "في ذكر ضروب من الحيوان" });
  await expect(field).toContainText("فهو سبع");
  await expect(page.getByText("الحقول الدلالية")).toBeVisible();
});
