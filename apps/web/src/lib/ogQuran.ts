import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as hb from "harfbuzzjs";

/**
 * Quranic text drawn exactly for share images (B7): shaped by HarfBuzz — the engine browsers shape it with — in the
 * KFGQPC Hafs font, the signed file read as it is (its licence forbids changing or converting it), every mark where
 * the font places it; each glyph's outline goes into an SVG the image renderer draws. Satori, which draws the rest of
 * the card, cannot place the marks (src/fonts/og/README.md).
 */

type Glyph = { d: string; x: number; y: number };
/** a shaped word: its glyphs, its advance, and how far its ink rises above and falls below the baseline */
type Word = { glyphs: Glyph[]; width: number; top: number; bottom: number };

const engine = (async () => {
  const data = await readFile(join(process.cwd(), "src/fonts/UthmanicHafs_V22.ttf"));
  const face = new hb.Face(new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  const font = new hb.Font(face);
  const shape = (text: string): Word => {
    const b = new hb.Buffer();
    b.addText(text);
    b.guessSegmentProperties();
    hb.shape(font, b);
    const pos = b.getGlyphPositions();
    let x = 0;
    let top = 0;
    let bottom = 0;
    const glyphs = b.getGlyphInfos().map((g, i) => {
      const out = { d: font.glyphToPath(g.codepoint), x: x + pos[i].xOffset, y: pos[i].yOffset };
      const e = font.glyphExtents(g.codepoint);
      if (e) {
        top = Math.max(top, pos[i].yOffset + e.yBearing);
        bottom = Math.min(bottom, pos[i].yOffset + e.yBearing + e.height);
      }
      x += pos[i].xAdvance;
      return out;
    });
    return { glyphs, width: x, top, bottom };
  };
  return { upem: face.upem, shape, space: shape(" ").width };
})();

/** Words in lines of at most `max` units, the first line first; each line's words in reading order. */
function lines(words: Word[], max: number, space: number): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  let w = 0;
  for (const word of words) {
    if (cur.length && w + space + word.width > max) {
      out.push(cur);
      cur = [];
      w = 0;
    }
    w += (cur.length ? space : 0) + word.width;
    cur.push(word);
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * The text as an image `width` pixels wide: at `size` pixels to the em, smaller down to `minSize` until it fits in
 * `maxLines` lines, centred, right to left; past that, the lines that fit and `cut` said, for the card to say the
 * verse goes on — the words are never squeezed or changed.
 */
export async function quranImage(
  text: string,
  { width, size, minSize, maxLines, color, lineHeight = 1.85 }: { width: number; size: number; minSize: number; maxLines: number; color: string; lineHeight?: number },
): Promise<{ src: string; width: number; height: number; cut: boolean }> {
  const { upem, shape, space } = await engine;
  const words = text.split(/\s+/).filter(Boolean).map(shape);
  let px = size;
  let rows = lines(words, (width / px) * upem, space);
  while (rows.length > maxLines && px > minSize) {
    px = Math.max(minSize, px - 4);
    rows = lines(words, (width / px) * upem, space);
  }
  const cut = rows.length > maxLines;
  rows = rows.slice(0, maxLines);
  const max = (width / px) * upem;
  const lh = upem * lineHeight;
  // the image is as tall as the ink: from the highest mark of any line to the lowest descent, a little air round it
  const pad = upem * 0.08;
  const above = Math.max(...rows.map((row, i) => Math.max(...row.map((w) => w.top)) - i * lh));
  const below = Math.max(...rows.map((row, i) => i * lh - Math.min(...row.map((w) => w.bottom))));
  const height = above + below + 2 * pad;
  let paths = "";
  rows.forEach((row, i) => {
    const used = row.reduce((a, w, k) => a + w.width + (k ? space : 0), 0);
    let right = max - (max - used) / 2;
    const baseline = pad + above + i * lh;
    for (const word of row) {
      const left = right - word.width;
      for (const g of word.glyphs) if (g.d) paths += `<path transform="translate(${left + g.x} ${baseline - g.y}) scale(1 -1)" d="${g.d}"/>`;
      right = left - space;
    }
  });
  const h = Math.round((height * px) / upem);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(max)} ${Math.round(height)}" width="${width}" height="${h}"><g fill="${color}">${paths}</g></svg>`;
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width, height: h, cut };
}
