import { describe, expect, it } from "vitest";
import { decodeSeed, encodeSeed, validSeed } from "./seedCodec";

describe("seeds", () => {
  it("keep a word's confidence and spelling only for the reader's own text, in shape (F4)", () => {
    const s = validSeed({
      seed: "trail",
      phrase: "فالعلم نور",
      steps: [
        { kind: "word", id: "ilm", conf: 0.523, s: "فالعلم" },
        { kind: "word", id: "nur", conf: 7, s: "نور" },
        { kind: "word", id: "kitab", s: "كتاب" },
        { kind: "root", id: "علم", conf: 0.1 },
      ],
    });
    expect(s).toEqual({
      seed: "trail",
      phrase: "فالعلم نور",
      steps: [{ kind: "word", id: "ilm", conf: 0.52, s: "فالعلم" }, { kind: "word", id: "nur" }, { kind: "word", id: "kitab" }, { kind: "root", id: "علم" }],
    });
    expect(decodeSeed(encodeSeed(s!))).toEqual(s);
  });

  it("read a set only with its name and words (F12)", () => {
    expect(validSeed({ seed: "set", name: "الفاعلون", steps: [{ kind: "word", id: "alim" }] })).toEqual({ seed: "set", name: "الفاعلون", steps: [{ kind: "word", id: "alim" }] });
    expect(validSeed({ seed: "set", steps: [{ kind: "word", id: "alim" }] })).toBeNull();
    expect(validSeed({ seed: "set", name: "x", steps: [] })).toBeNull();
  });

  it("name a quoted article and a Notebook note by id, never by their words (RDR-239, NTB-22)", () => {
    // the article's identifier (P1.7a), or its row id on a link made before identifiers
    expect(validSeed({ seed: "quote", entry: "dict:lane:علم" })).toEqual({ seed: "quote", entry: "dict:lane:علم" });
    expect(validSeed({ seed: "quote", entry: "dict:tahdhib:علم-2" })).toEqual({ seed: "quote", entry: "dict:tahdhib:علم-2" });
    expect(validSeed({ seed: "quote", entry: "dict:lane:<b>" })).toBeNull();
    expect(validSeed({ seed: "quote", entry: "lane:علم" })).toBeNull();
    expect(decodeSeed(encodeSeed({ seed: "quote", entry: "dict:lane:علم" }))).toEqual({ seed: "quote", entry: "dict:lane:علم" });
    expect(validSeed({ seed: "quote", entry: 7000514, text: "علم: عَلِمَ" })).toEqual({ seed: "quote", entry: 7000514 });
    expect(validSeed({ seed: "quote", entry: "7000514" })).toBeNull();
    expect(validSeed({ seed: "quote", entry: 1.5 })).toBeNull();
    expect(validSeed({ seed: "note", note: "nmg2x1k0", text: "a private thought" })).toEqual({ seed: "note", note: "nmg2x1k0" });
    expect(validSeed({ seed: "note", note: "../graph" })).toBeNull();
    expect(decodeSeed(encodeSeed({ seed: "quote", entry: 42 }))).toEqual({ seed: "quote", entry: 42 });
  });

  it("name a passage of an article by where it runs and a hash of it, never its words (B36)", () => {
    const run = { from: 12, to: 80, hash: "0a1b2c3d" };
    expect(decodeSeed(encodeSeed({ seed: "quote", entry: "dict:lane:علم", run }))).toEqual({ seed: "quote", entry: "dict:lane:علم", run });
    expect(validSeed({ seed: "quote", entry: "dict:lane:علم", run: { ...run, text: "forged" } })).toEqual({ seed: "quote", entry: "dict:lane:علم", run });
    // a run in any other shape is left out, the article still quoted whole
    expect(validSeed({ seed: "quote", entry: "dict:lane:علم", run: { from: 12, to: 13, hash: "0a1b2c3d" } })).toEqual({ seed: "quote", entry: "dict:lane:علم" });
    expect(validSeed({ seed: "quote", entry: "dict:lane:علم", run: "12-80" })).toEqual({ seed: "quote", entry: "dict:lane:علم" });
  });
});
