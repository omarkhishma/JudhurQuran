import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { displayBare, hasMarks, isUthmani, normalize, stripMarks } from "./normalize";

type Case = { name: string; input: string; strip_marks: string; display_bare: string; normalize: string };
const { cases } = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../../packages/arabic-spec/vectors.json"), "utf8"),
) as { cases: Case[] };

describe("shared normalisation vectors", () => {
  it("are all present", () => expect(cases.length).toBeGreaterThanOrEqual(30));
  for (const c of cases) {
    it(c.name, () => {
      expect(stripMarks(c.input)).toBe(c.strip_marks);
      expect(displayBare(c.input)).toBe(c.display_bare);
      expect(normalize(c.input)).toBe(c.normalize);
    });
  }
});

describe("detectors", () => {
  it("tells mushaf text from everyday spelling", () => {
    expect(isUthmani("ٱللَّهِ")).toBe(true);
    expect(isUthmani("الله")).toBe(false);
  });
  it("sees diacritics", () => {
    expect(hasMarks("كِتَاب")).toBe(true);
    expect(hasMarks("كتاب")).toBe(false);
    expect(hasMarks("كتـاب")).toBe(false);
  });
});
