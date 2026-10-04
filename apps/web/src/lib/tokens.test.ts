import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The accessibility floor of the design system (P1.5, docs/DESIGN-SYSTEM.md): every text colour token reads at 4.5:1
 * or more on every surface and tinted well, in both themes — computed from globals.css itself, so a token changed there
 * is checked here.
 */

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(at, css.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}

const channel = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
function luminance(h: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => {
    const x = channel(h, i) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** color-mix(in srgb, a p, b) as the washes are made */
const mix = (a: string, b: string, p: number) => `#${[0, 1, 2].map((i) => Math.round(channel(a, i) * p + channel(b, i) * (1 - p)).toString(16).padStart(2, "0")).join("")}`;

const TEXT = ["t1", "t2", "t3", "c-root", "c-form", "c-word", "c-sentence", "c-desc", "ring", "good", "bad", "amber"];
const SURFACES = ["canvas", "card", "card-2", "card-3", "panel", "paper"];

describe("the design system's colour tokens (P1.5)", () => {
  const light = block(":root");
  const dark = { ...light, ...block(':root[data-theme="dark"]') };
  for (const [name, t] of [["light", light], ["dark", dark]] as const) {
    it(`reads every text token at 4.5:1 or more on every surface and well, ${name}`, () => {
      const wells = {
        "root-wash": mix(t["c-root"], t.card, 0.12),
        "word-wash": mix(t["c-word"], t.card, 0.1),
        "form-wash": mix(t["c-form"], t.card, 0.1),
        "sentence-wash": mix(t["c-sentence"], t.card, 0.1),
      };
      const below: string[] = [];
      for (const x of TEXT) {
        expect(t[x], x).toMatch(/^#[0-9a-f]{6}$/);
        for (const s of SURFACES) if (ratio(t[x], t[s]) < 4.5) below.push(`${x} on ${s}: ${ratio(t[x], t[s]).toFixed(2)}`);
        for (const [w, c] of Object.entries(wells)) if (ratio(t[x], c) < 4.5) below.push(`${x} on ${w}: ${ratio(t[x], c).toFixed(2)}`);
      }
      expect(below).toEqual([]);
    });
  }

  it("fails a colour the handoff gave and the build darkened (a check that can fail)", () => {
    // the handoff's --t3 #71717c on the light canvas
    expect(ratio("#71717c", light.canvas)).toBeLessThan(4.5);
  });
});
