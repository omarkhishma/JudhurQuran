import { describe, expect, it } from "vitest";
import { hasTashkil, PASSAGE_TARGET, passages, words } from "./segment";

describe("a pasted text into passages and words (LIB-45)", () => {
  it("ends a passage at a blank line and joins a paragraph's lines", () => {
    expect(passages("قال الشاعر\nبيتًا\n\nثم قال")).toEqual(["قال الشاعر بيتًا", "ثم قال"]);
  });
  it("cuts a long paragraph after a sentence end, never inside a sentence", () => {
    const s = "كلمة ".repeat(80).trim() + ".";
    const out = passages(`${s} ${s} ${s}`);
    expect(out.length).toBeGreaterThan(1);
    for (const p of out) expect(p.endsWith(".")).toBe(true);
    expect(out.every((p) => p.length <= PASSAGE_TARGET + s.length)).toBe(true);
  });
  it("takes the punctuation off a word's edges and drops what holds no letter", () => {
    expect(words("«العلم»، نورٌ. 12 —").map((w) => w.word)).toEqual(["العلم", "نورٌ"]);
  });
  it("tells whether the text is vowelled", () => {
    expect(hasTashkil("العِلْم")).toBe(true);
    expect(hasTashkil("العلم")).toBe(false);
  });
});
