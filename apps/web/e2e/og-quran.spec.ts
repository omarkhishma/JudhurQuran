import { expect, type Page, test } from "@playwright/test";

/**
 * Share images with the Quran's own words (B7): a verse's card and a word's card draw the mushaf's script — shaped by
 * HarfBuzz in the KFGQPC font — and a verse too long for the card says it goes on. Each image is the page's own
 * og:image, a 1200×630 PNG; the ink it holds is measured in a canvas.
 */

const ogOf = async (page: Page, path: string) => {
  await page.goto(path);
  const url = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(url).toBeTruthy();
  const u = new URL(url!);
  return u.pathname + u.search;
};

/** The image's size from its header, and the share of dark pixels in its middle band (where the Quran's text is). */
async function read(page: Page, src: string) {
  const r = await page.request.get(src);
  expect(r.status(), src).toBe(200);
  expect(r.headers()["content-type"]).toBe("image/png");
  const png = await r.body();
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const ink = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 130, img.width, 200).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 200) dark++;
    return dark / (d.length / 4);
  }, png.toString("base64"));
  return { w, h, ink };
}

test("a verse's and a word's share images draw the Quran's script, and a long verse says it goes on (B7)", async ({ page }) => {
  const short = await read(page, await ogOf(page, "/quran/112/1"));
  const long = await read(page, await ogOf(page, "/quran/2/282"));
  const word = await read(page, await ogOf(page, "/en/word/1:2:2"));
  for (const x of [short, long, word]) expect([x.w, x.h]).toEqual([1200, 630]);
  // the verse is drawn: a long verse fills the band with far more ink than a short one, and both hold some
  expect(short.ink).toBeGreaterThan(0.005);
  expect(long.ink).toBeGreaterThan(short.ink * 2);
  expect(word.ink).toBeGreaterThan(0.005);
});
