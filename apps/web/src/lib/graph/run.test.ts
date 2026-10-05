import { describe, expect, it } from "vitest";
import { displayBare } from "@/lib/arabic/normalize";
import { bodyOffsets, cleanRun, makeRun, readRun, runHash } from "./run";

const body = "العِلْمُ: نقيضُ الجَهْل. وعَلِمْتُ الشيءَ أَعْلَمُه عِلْماً: عَرَفْتُه.";

describe("a quoted passage (B36)", () => {
  it("is kept as offsets and a hash, and read back only while the article holds the same words there", () => {
    const at = body.indexOf("نقيض");
    const run = makeRun(body, at - 1, at + "نقيضُ الجَهْل".length + 1)!;
    expect(run.from).toBe(at); // the space before it is left out
    expect(readRun(body, run)).toBe("نقيضُ الجَهْل.");
    expect(readRun(`${body.slice(0, at)}X${body.slice(at + 1)}`, run)).toBeNull();
    expect(readRun(body.slice(0, run.to - 1), run)).toBeNull();
    expect(runHash("abc")).toMatch(/^[0-9a-f]{8}$/);
  });
  it("is too short or too long to be a passage", () => {
    expect(makeRun(body, 3, 4)).toBeNull();
    expect(makeRun("x".repeat(5000), 0, 4500)).toBeNull();
  });
  it("is found in the article when it was chosen with the marks hidden, its last letter keeping its marks", () => {
    const shown = displayBare(body);
    const word = "الجهل";
    const from = shown.indexOf(word);
    const [a, b] = bodyOffsets(body, shown, from, from + word.length)!;
    expect(body.slice(a, b)).toBe("الجَهْل");
    // a hamza's seat is kept when the marks are hidden
    const f2 = shown.indexOf("أعلمه");
    expect(f2).toBeGreaterThan(0);
    expect(body.slice(...bodyOffsets(body, shown, f2, f2 + 5)!)).toBe("أَعْلَمُه");
    expect(bodyOffsets(body, body, 3, 8)).toEqual([3, 8]);
    expect(bodyOffsets(body, "something else", 0, 3)).toBeNull();
    // an article's opening words, shown before the whole of it is asked for
    const opening = shown.slice(0, 30);
    expect(body.slice(...bodyOffsets(body, opening, from, from + word.length)!)).toBe("الجَهْل");
    expect(bodyOffsets(body, body.slice(0, 20), 3, 8)).toEqual([3, 8]);
    expect(bodyOffsets(body, opening, 25, 40)).toBeNull();
  });
  it("is kept from a map or a link only in its own shape", () => {
    expect(cleanRun({ from: 3, to: 20, hash: "0a1b2c3d", text: "x" })).toEqual({ from: 3, to: 20, hash: "0a1b2c3d" });
    expect(cleanRun({ from: 3, to: 4, hash: "0a1b2c3d" })).toBeUndefined();
    expect(cleanRun({ from: 3, to: 20, hash: "zz" })).toBeUndefined();
    expect(cleanRun({ from: -1, to: 20, hash: "0a1b2c3d" })).toBeUndefined();
    expect(cleanRun("3-20")).toBeUndefined();
  });
});
