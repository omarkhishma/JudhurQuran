import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { drop, person, type Person, sql, tag } from "./board";
import { arCount, expectNoHorizontalScroll } from "./helpers";

/**
 * Published maps (P8.5; EDT-021, EDT-025…030, EDT-238…244, EDT-257, EDT-269…291, EDT-302, EDT-324…346, HWF-11,
 * HWF-24, HWF-32, HWF-42, HWF-56, QAN-23, HUB-25, PRF-20): published from the editor under an address that keeps its
 * Arabic letters, read on its page and in its frame — the real editor, read-only — copied by another reader, cited,
 * given a new version, reported and withdrawn by the board; framed by another site, told its theme and folding by its
 * parent only, telling its parent the card chosen. Real accounts through the development outbox; every expectation
 * read from the API.
 */

type Card = { id: string; data: Record<string, unknown> & { kind: string; ar?: string } };
type Published = { slug: string; version: number; latest: number; title: string; counts: { cards: number; roots: number; words: number }; fork_count: number; cite_count: number; doc: { nodes: Card[] }; author: { name: string | null } };

// an action that cannot happen fails in 20 s, not at the test's end
test.use({ actionTimeout: 20_000 });

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");
const enc = encodeURIComponent;
const vowelled = (letters: string) => [...letters].map((c) => c + String.fromCharCode(0x064e)).join("");
const AR = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
const CARDS = { one: "بطاقة واحدة", two: "بطاقتان", few: "# بطاقات", many: "# بطاقة", other: "# بطاقة" };
const published = async (page: Page, slug: string, v?: number) => (await (await page.request.get(`/api/v1/published/${enc(slug)}${v ? `?v=${v}` : ""}`)).json()) as Published;

async function storedGraph(page: Page, id: string): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(
    (key) =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction("keyval").objectStore("keyval").get(key);
          req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined);
          req.onerror = () => reject(req.error);
        };
      }),
    `jadhr-graph:${id}`,
  );
}

/** A map from a word, laid out and saved in the editor: its id. */
async function newMap(page: Page): Promise<string> {
  await page.goto(`/graph/seed?s=${seedParam({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
  await expect(page).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
  const id = page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
  await expect.poll(async () => (await storedGraph(page, id))?.pendingLayout ?? true, { timeout: 15_000 }).toBe(false);
  return id;
}

/** The test's addresses, reserved for good by design, freed once it ends. */
function free(prefix: string) {
  for (const t of ["published_reports", "withdrawn", "published"]) sql(`delete from graphs.${t} where slug like '%${prefix}%'`);
  sql(`delete from graphs.slugs where slug like '%${prefix}%'`);
}

/** A map published straight through the API (the editor's publishing has its own test). */
async function publishVia(p: Person, slug: string, title: string): Promise<Published> {
  const nodes = [
    { id: "root:علم", position: { x: 0, y: 0 }, data: { kind: "root", ar: "ع ل م", rootKey: "علم" } },
    { id: "note:a", position: { x: 420, y: 0 }, data: { kind: "note", text: "أول ما نزل في العلم" } },
    { id: "note:b", position: { x: 420, y: 320 }, data: { kind: "note", text: "والقلم" } },
  ];
  const edges = [{ id: "e1", source: "root:علم", target: "note:a", data: { rel: "describes" } }];
  const r = await p.page.request.post("/api/v1/published", { headers: p.h, data: { local_id: `m${Date.now().toString(36)}`, slug, title, kind: "free", doc: { version: 2, nodes, edges } } });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()) as Published;
}

test("published from the editor, read on its page and in its frame, copied, cited, given a new version, reported and withdrawn by the board", async ({ browser, isMobile }) => {
  test.skip(isMobile, "three accounts in desktop windows; the phone reads a published map in the next test");
  test.setTimeout(240_000);
  const t = tag();
  const o = await person(browser, `e2e-pub-o-${t}@example.org`);
  const r = await person(browser, `e2e-pub-r-${t}@example.org`);
  await o.page.request.patch("/api/v1/me", { headers: o.h, data: { display_name: `صاحبة-${t.slice(-5)}` } });
  try {
    // ── publish from the editor (EDT-021, EDT-269…274) ──
    const id = await newMap(o.page);
    await o.page.locator(".editor-header").getByRole("button", { name: /^انشر/ }).click();
    const dialog = o.page.getByRole("dialog", { name: "نشر الخريطة" });
    const title = `عائلة العالمين ${t}`;
    await dialog.getByRole("textbox", { name: "العنوان", exact: true }).fill(title);
    // typed vowelled, from code points (a typed mark is never trusted): «عائلة ٱلعالمين» with a fatha on every letter
    const typed = `عائلة ${String.fromCharCode(0x0671)}${vowelled("لعالمين")} ${t}`;
    await dialog.getByRole("textbox", { name: "رابط الخريطة" }).fill(typed);
    // the address the API will make, said as typed: the vowel marks gone, the letters kept
    const want = (await (await o.page.request.get(`/api/v1/published/check?slug=${enc(typed)}`)).json()) as { slug: string; available: boolean };
    expect(want.available).toBe(true);
    expect(want.slug).toBe(`عائلة-العالمين-${t}`);
    await expect(dialog.locator("#pub-slug-state")).toContainText("الرابط متاح");
    await expect(dialog.locator("#pub-slug-state bdi")).toHaveText(want.slug);
    await expect(dialog.getByRole("textbox", { name: "الوصف" })).toHaveValue(/كما رتّبها صاحبها في محرر الخرائط/);
    await dialog.getByRole("button", { name: "انشرها" }).click();
    await expect(o.page).toHaveURL(new RegExp(`/g/${enc(want.slug)}$`), { timeout: 15_000 });
    const m = await published(o.page, want.slug);
    expect(m.version).toBe(1);
    expect(m.title).toBe(title);

    // ── its page (EDT-324…341) ──
    await expect(o.page.getByRole("heading", { level: 1 })).toHaveText(title);
    const byline = o.page.locator("header p").first();
    await expect(byline).toContainText(`نشرها صاحبة-${t.slice(-5)}`);
    await expect(byline).toContainText(arCount(m.counts.cards, CARDS));
    await expect(byline).toContainText(`الإصدار ${AR(1)} من ${AR(1)}`);
    // the frame is the real editor, read-only, with every card the version holds
    const frame = o.page.frameLocator("iframe.pub-iframe");
    await expect(frame.locator(".react-flow__node")).toHaveCount(m.doc.nodes.length, { timeout: 20_000 });
    // a card chosen in the frame is told to the page (EDT-339)
    // one of the cards the map opens on (the word it was made from), in view in the frame
    const first = m.doc.nodes.find((n) => n.data.kind === "lemma" && n.data.focus) ?? m.doc.nodes.find((n) => n.data.focus) ?? m.doc.nodes[0];
    await frame.locator(`.react-flow__node[data-id="${first.id}"]`).click({ timeout: 15_000 });
    await expect(o.page.locator(".pub-card-strip")).toContainText(String(first.data.ar ?? ""));
    // an edit is refused, and said (EDT-244, EDT-257)
    await o.page.keyboard.press("Delete");
    await expect(frame.locator(".graph-toast")).toContainText("هذه نسخة منشورة");
    await expect(frame.locator(".react-flow__node")).toHaveCount(m.doc.nodes.length);
    // the display options: folded and dark told to the frame, the snippet saying them (EDT-334)
    await o.page.getByLabel("البطاقات مطوية إلى عناوينها").check();
    await expect(frame.locator(".graph-card.is-open")).toHaveCount(0);
    await o.page.getByLabel("السمة الداكنة").check();
    await expect(frame.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(o.page.getByRole("textbox", { name: "شيفرة التضمين" })).toHaveValue(/folded=1&theme=dark/);
    // nothing the owner keeps was written by reading it (EDT-288)
    expect(await o.page.evaluate(() => localStorage.getItem("jadhr-theme"))).not.toBe("dark");
    expect((await new AxeBuilder({ page: o.page }).include("main").analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);

    // ── another reader copies it (EDT-290, EDT-345) ──
    await r.page.goto(`/g/${enc(want.slug)}`);
    await r.page.getByRole("button", { name: "انسخها إلى خرائطي" }).click();
    await expect(r.page).toHaveURL(/\/graph\/edit\/[a-z0-9]+\?forked=1/, { timeout: 15_000 });
    await expect(r.page.locator(".save-pill")).toContainText("نُسخت");
    const fid = r.page.url().split("/graph/edit/")[1].split(/[?#]/)[0];
    expect((await storedGraph(r.page, fid))?.forkedFrom).toEqual({ slug: want.slug, version: 1, title });
    await expect(r.page.locator(".graph-details")).toContainText("نسخة من");
    await expect.poll(async () => (await published(r.page, want.slug)).fork_count).toBe(1);

    // ── and cites it: the version's own address, the copy counted (EDT-332, EDT-346) ──
    await r.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await r.page.goto(`/g/${enc(want.slug)}`);
    await expect(r.page.locator(".pub-actions")).toContainText("نُسخت مرة واحدة");
    await r.page.getByRole("button", { name: "استشهد بها" }).click();
    const cite = r.page.getByRole("dialog", { name: "استشهد بها" });
    await cite.getByRole("radio", { name: "BibTeX" }).click();
    await cite.getByRole("button", { name: "انسخ الاستشهاد" }).click();
    const bib = await r.page.evaluate(() => navigator.clipboard.readText());
    expect(bib).toMatch(/^@misc\{jadhr_map_[0-9a-z]+_v1,/);
    expect(bib).toContain(`url = {${new URL(r.page.url()).origin}/g/${enc(want.slug)}?v=1}`);
    await expect.poll(async () => (await published(r.page, want.slug)).cite_count).toBe(1);

    // ── a new version from the editor; the first stays at its address (EDT-274) ──
    await o.page.goto(`/graph/edit/${id}`);
    await o.page.locator(".editor-header").getByRole("button", { name: /^انشر/ }).click();
    const again = o.page.getByRole("dialog", { name: "نشر الخريطة" });
    await expect(again).toContainText("منشورة على");
    await again.getByRole("button", { name: `انشر الإصدار ${AR(2)}` }).click();
    await expect(again).toContainText(`نُشر الإصدار ${AR(2)}`);
    expect((await published(o.page, want.slug)).latest).toBe(2);
    await o.page.goto(`/g/${enc(want.slug)}?v=1`);
    await expect(o.page.locator(".pub-notice")).toContainText(`هذا الإصدار ${AR(1)}`);
    await expect(o.page.locator("section[aria-labelledby=pub-versions-h] li")).toHaveCount(2);

    // ── reported by a reader, withdrawn by the board (the map's address reserved for good) ──
    await r.page.goto(`/g/${enc(want.slug)}`);
    await r.page.getByRole("button", { name: "أبلغ عن هذه الخريطة" }).click();
    await r.page.getByLabel("ما الذي فيها؟").fill("روابط دعائية لا صلة لها بالقرآن");
    await r.page.getByRole("button", { name: "أرسل البلاغ" }).click();
    await expect(r.page.locator(".pub-actions")).toContainText("وصل بلاغك إلى هيئة التحرير");
    const b = await person(browser, `e2e-pub-b-${t}@example.org`, "editor");
    try {
      await b.page.goto(`/g/${enc(want.slug)}`);
      const reports = b.page.locator("section[aria-labelledby=pub-reports-h]");
      await expect(reports).toContainText("روابط دعائية");
      await reports.getByRole("button", { name: "اسحب الخريطة" }).click();
      await expect(b.page.getByRole("heading", { level: 1 })).toHaveText("سُحبت هذه الخريطة");
      await expect(b.page.locator("main")).toContainText("سحبتها هيئة التحرير");
      const gone = await b.page.request.get(`/api/v1/published/${enc(want.slug)}`);
      expect(gone.status()).toBe(410);
      const check = (await (await b.page.request.get(`/api/v1/published/check?slug=${enc(want.slug)}`)).json()) as { available: boolean };
      expect(check.available).toBe(false);
    } finally {
      await drop(b);
    }
  } finally {
    await drop(o);
    await drop(r);
    free(t);
  }
});

test("a map framed by another site: read-only, told its theme and folding by its parent only, telling its parent the card chosen; no other page may be framed", async ({ browser, page, isMobile }) => {
  test.setTimeout(120_000);
  const t = tag();
  const o = await person(browser, `e2e-pub-f-${t}@example.org`);
  try {
    const m = await publishVia(o, `framed-${t}`, `خريطة في إطار ${t}`);
    const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3210").origin;
    // another site: a page of another origin, served here (a loopback address, as the site under test is)
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0">
<script>window.got=[];addEventListener("message",function(e){window.got.push({origin:e.origin,data:e.data})})</script>
<iframe id="map" src="${origin}/embed/g/${enc(m.slug)}?entry=0&folded=0&theme=light" title="map" style="width:100%;height:560px;border:0"></iframe>
<iframe id="page" src="${origin}/g/${enc(m.slug)}" title="page" style="width:100%;height:200px;border:0"></iframe>
</body></html>`;
    const other = createServer((_, res) => res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html));
    await new Promise<void>((done) => other.listen(0, "127.0.0.1", done));
    const site = `http://127.0.0.1:${(other.address() as AddressInfo).port}`;
    test.info().attach("host page", { body: site });
    page.on("close", () => other.close());
    await page.goto(`${site}/`);
    const frame = page.frameLocator("#map");
    await expect(frame.locator(".react-flow__node")).toHaveCount(m.doc.nodes.length, { timeout: 20_000 });
    // no header in a frame: the actions are the page's (EDT-284)
    await expect(frame.locator(".editor-header")).toHaveCount(0);
    await expect(frame.locator("html")).toHaveAttribute("data-theme", "light");
    // listening, it says so to its parent, at the parent's origin only
    await expect.poll(() => page.evaluate(() => (window as unknown as { got: { origin: string; data: { type: string } }[] }).got.some((g) => g.data?.type === "jadhr-ready"))).toBe(true);
    // the parent tells it the theme and the folding (EDT-285)
    await page.evaluate(() => (document.getElementById("map") as HTMLIFrameElement).contentWindow!.postMessage({ type: "jadhr-theme", dark: true }, "*"));
    await expect(frame.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.evaluate(() => (document.getElementById("map") as HTMLIFrameElement).contentWindow!.postMessage({ type: "jadhr-fold", folded: true }, "*"));
    await expect(frame.locator(".graph-card.is-open")).toHaveCount(0);
    // a card chosen is told to the parent, from the site's origin, and to the parent's origin only (EDT-286, HWF-56)
    await frame.locator('.react-flow__node[data-id="root:علم"]').click({ timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => (window as unknown as { got: { origin: string; data: { type: string; id: string; type2: string } }[] }).got.find((g) => g.data?.type === "jadhr-card")?.data.id)).toBe("root:علم");
    const msg = await page.evaluate(() => (window as unknown as { got: { origin: string; data: { type: string; type2: string } }[] }).got.find((g) => g.data?.type === "jadhr-card"));
    expect(msg?.origin).toBe(origin);
    expect(msg?.data.type2).toBe("root");
    // a page of the site that is not an embed refuses the frame (frame-ancestors 'self', X-Frame-Options)
    await expect.poll(() => page.frames().some((f) => f.url().startsWith("chrome-error://"))).toBe(true);
    if (isMobile) await expectNoHorizontalScroll(page);
  } finally {
    await drop(o);
    free(t);
  }
});

test("the gallery, the hub's tile, the read-only window and the Profile list the published maps", async ({ browser, page, isMobile }) => {
  test.setTimeout(120_000);
  const t = tag();
  const o = await person(browser, `e2e-pub-g-${t}@example.org`);
  try {
    const m = await publishVia(o, `gallery-${t}`, `خريطة المعرض ${t}`);
    // the hub's tile leads to the gallery, which lists it first (HUB-25)
    await page.goto("/");
    await page.locator('a.hub-tile[href="/g"]').click();
    await expect(page).toHaveURL(/\/g$/);
    // other tests publish beside this one: its row among the latest
    const listed = page.locator(".pub-row", { hasText: m.title });
    await expect(listed).toBeVisible();
    await listed.click();
    await expect(page).toHaveURL(new RegExp(`/g/${enc(m.slug)}$`));
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    if (isMobile) await expectNoHorizontalScroll(page);
    // a reader in the dark theme keeps it once the page hydrates, and its frame follows it once it listens
    await page.evaluate(() => localStorage.setItem("jadhr-theme", "dark"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.frameLocator("iframe.pub-iframe").locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByLabel("السمة الداكنة")).toBeChecked();
    await page.evaluate(() => localStorage.setItem("jadhr-theme", "light"));
    // the map as text, for those who do not read it as a picture
    await page.getByText("ما في الخريطة نصًّا").click();
    await expect(page.locator(".pub-text")).toContainText("ع ل م");
    // the editor read-only in a window of its own (EDT-025, EDT-340): its pill, fold and unfold, Fork, the guard
    await page.getByRole("button", { name: "افتحها في المحرر" }).click();
    await expect(page).toHaveURL(new RegExp(`/g/${enc(m.slug)}/map$`));
    const header = page.locator(".editor-header.is-published");
    await expect(header).toContainText("منشورة · للقراءة فقط");
    await expect(page.locator(".react-flow__node")).toHaveCount(m.doc.nodes.length, { timeout: 20_000 });
    if (!isMobile) {
      await header.getByRole("button", { name: "اطوِ الكل" }).click();
      await expect(page.locator(".graph-card.is-open")).toHaveCount(0);
      await page.locator('.react-flow__node[data-id="note:a"]').click();
      await page.keyboard.press("Delete");
      await expect(page.locator(".graph-toast")).toContainText("هذه نسخة منشورة");
      await expect(page.locator(".react-flow__node")).toHaveCount(m.doc.nodes.length);
    }
    await expect(header.getByRole("button", { name: "انسخها إلى خرائطي" })).toBeVisible();
    // the owner's Profile lists it by its first root, opening its page (PRF-20)
    await o.page.goto("/me?tab=graphs");
    const row = o.page.locator(`a[href="/g/${enc(m.slug)}"]`);
    await expect(row).toContainText(m.title);
    await expect(row).toContainText("ع ل م");
    // and My maps, with its page
    await o.page.goto("/graph");
    await expect(o.page.getByRole("heading", { name: "خرائطي المنشورة" })).toBeVisible();
    await expect(o.page.locator(`a[href="/g/${enc(m.slug)}"]`)).toContainText(m.title);
    // an address no map ever had is a 404; a withdrawn one says so
    expect((await page.request.get(`/g/no-such-map-${t}`)).status()).toBe(404);
    await o.page.request.delete(`/api/v1/published/${enc(m.slug)}`, { headers: o.h });
    await page.goto(`/g/${enc(m.slug)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("سُحبت هذه الخريطة");
    await expect(page.locator("main")).toContainText("سحبها صاحبها");
  } finally {
    await drop(o);
    free(t);
  }
});
