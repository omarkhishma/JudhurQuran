import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, type FrameLocator, type Page, test } from "@playwright/test";
import { drop, person, sql, tag } from "./board";
import { expectNoHorizontalScroll } from "./helpers";

/**
 * Journey E (design 01 §1.5, PLAN P8.7 ◆): editor → build a root family → Publish → the read-only `/g/<slug>` page,
 * which embeds the real editor read-only (not a picture) → another reader forks it, which seeds a new editable map →
 * the fork count rises on the original. The handoff's exit (11 §P8): a published map renders identically to what its
 * author built, in an iframe on a third-party page — every card at the place its author left it.
 */

test.use({ actionTimeout: 20_000 });

const seedParam = (seed: object) => Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");
const enc = encodeURIComponent;
type Doc = { title: string; pendingLayout?: boolean; nodes: { id: string; position: { x: number; y: number }; data: { kind: string } }[] };

async function stored(page: Page, id: string): Promise<Doc | undefined> {
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

/** Where each card is drawn on the canvas: xyflow places a node by a translate in the map's own coordinates. */
async function drawnAt(where: Page | FrameLocator, ids: string[]): Promise<Record<string, [number, number]>> {
  const out: Record<string, [number, number]> = {};
  for (const id of ids) {
    const style = (await where.locator(`.react-flow__node[data-id="${id}"]`).getAttribute("style")) ?? "";
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style);
    out[id] = m ? [Math.round(Number(m[1])), Math.round(Number(m[2]))] : [NaN, NaN];
  }
  return out;
}

test("journey E: a root family built, published, read on its page and on another site as its author left it, forked by another reader, counted on the original", async ({ browser, isMobile }) => {
  test.setTimeout(180_000);
  const t = tag();
  const window = isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 } : { viewport: { width: 1440, height: 900 } };
  const author = await person(browser, `e2e-je-a-${t}@example.org`, undefined, window);
  const reader = await person(browser, `e2e-je-r-${t}@example.org`, undefined, window);
  await author.page.request.patch("/api/v1/me", { headers: author.h, data: { display_name: `مؤلفة-${t.slice(-5)}` } });
  const other = createServer();
  try {
    // ── the editor: a root family from the dataset, laid out and saved ──
    const a = author.page;
    await a.goto(`/graph/seed?s=${seedParam({ seed: "root", root: "علم" })}`);
    await expect(a).toHaveURL(/\/graph\/edit\/[a-z0-9]+/, { timeout: 30_000 });
    const id = a.url().split("/graph/edit/")[1].split(/[?#]/)[0];
    await expect.poll(async () => (await stored(a, id))?.pendingLayout ?? true, { timeout: 20_000 }).toBe(false);
    const built = (await stored(a, id))!;
    expect(built.nodes.some((n) => n.data.kind === "root")).toBe(true);
    expect(built.nodes.filter((n) => n.data.kind === "lemma").length).toBeGreaterThan(1);

    // ── Publish ──
    await a.locator(".editor-header").getByRole("button", { name: /^انشر/ }).click();
    const dialog = a.getByRole("dialog", { name: "نشر الخريطة" });
    await dialog.getByRole("textbox", { name: "رابط الخريطة" }).fill(`جذر علم ${t}`);
    await expect(dialog.locator("#pub-slug-state")).toContainText("الرابط متاح");
    await dialog.getByRole("button", { name: "انشرها" }).click();
    await expect(a).toHaveURL(/\/g\/[^/]+$/, { timeout: 15_000 });
    const slug = decodeURIComponent(a.url().split("/g/")[1]);
    const m = (await (await a.request.get(`/api/v1/published/${enc(slug)}`)).json()) as { fork_count: number; doc: { nodes: { id: string; position: { x: number; y: number } }[] } };
    // what was published is what the author built: every card, at its place
    const placed = Object.fromEntries(built.nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)] as [number, number]]));
    expect(Object.fromEntries(m.doc.nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)]]))).toEqual(placed);

    // ── its page embeds the real editor, read-only (not a picture) ──
    const frame = a.frameLocator("iframe.pub-iframe");
    await expect(frame.locator(".react-flow__node")).toHaveCount(built.nodes.length, { timeout: 20_000 });
    await expect(frame.locator("img")).toHaveCount(0);
    expect(await drawnAt(frame, Object.keys(placed))).toEqual(placed);
    if (isMobile) await expectNoHorizontalScroll(a);

    // ── on a third-party page, framed as its snippet frames it: the same cards at the same places ──
    const snippet = await a.getByRole("textbox", { name: "شيفرة التضمين" }).inputValue();
    expect(snippet).toContain(`/embed/g/${enc(slug)}?`);
    other.on("request", (_, res) => res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0"><h1>A teacher's page</h1>${snippet}</body></html>`));
    await new Promise<void>((done) => other.listen(0, "127.0.0.1", done));
    const site = `http://127.0.0.1:${(other.address() as AddressInfo).port}`;
    const third = await a.context().newPage();
    await third.goto(`${site}/`);
    const there = third.frameLocator("iframe");
    await expect(there.locator(".react-flow__node")).toHaveCount(built.nodes.length, { timeout: 20_000 });
    expect(await drawnAt(there, Object.keys(placed))).toEqual(placed);
    await third.close();

    // ── another reader forks it: a new map of theirs, editable, seeded with the same cards ──
    const r = reader.page;
    await r.goto(`/g/${enc(slug)}`);
    await r.getByRole("button", { name: "انسخها إلى خرائطي" }).click();
    await expect(r).toHaveURL(/\/graph\/edit\/[a-z0-9]+\?forked=1/, { timeout: 20_000 });
    const fid = r.url().split("/graph/edit/")[1].split(/[?#]/)[0];
    expect(fid).not.toBe(id);
    const fork = (await stored(r, fid))!;
    expect(fork.nodes.map((n) => n.id).sort()).toEqual(built.nodes.map((n) => n.id).sort());
    // editable: its own header with Undo, Tidy and Publish, not the read-only one
    await expect(r.locator(".editor-header")).not.toHaveClass(/is-published/);
    await expect(r.locator(".editor-header").getByRole("button", { name: /^انشر/ })).toBeVisible();
    // ── the original counts the fork ──
    await expect.poll(async () => ((await (await r.request.get(`/api/v1/published/${enc(slug)}`)).json()) as { fork_count: number }).fork_count).toBe(m.fork_count + 1);
    await a.goto(`/g/${enc(slug)}`);
    await expect(a.locator(".pub-actions")).toContainText("نُسخت مرة واحدة");
  } finally {
    other.close();
    await drop(author);
    await drop(reader);
    for (const tb of ["published_reports", "withdrawn", "published"]) sql(`delete from graphs.${tb} where slug like '%${t}%'`);
    sql(`delete from graphs.slugs where slug like '%${t}%'`);
  }
});
