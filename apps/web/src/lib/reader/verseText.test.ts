import { describe, expect, it } from "vitest";
import { SAJDA, splitFurniture } from "./verseText";

describe("splitFurniture (RDR-547)", () => {
  it("splits the sajda sign off the word it ends, and the two join back to the stored token", () => {
    const stored = "يَسۡتَكۡبِرُونَ" + SAJDA; // 32:15, as the KFGQPC text writes it
    const { word, sajda } = splitFurniture(stored);
    expect(sajda).toBe(true);
    expect(word.endsWith(SAJDA)).toBe(false);
    expect(word + SAJDA).toBe(stored);
  });

  it("leaves waqf signs on the word: they are marks on its last letter, not furniture of their own", () => {
    const stored = "رَيۡبَۛ"; // 2:2, small high three dots
    expect(splitFurniture(stored)).toEqual({ word: stored, sajda: false });
  });

  it("leaves a word without furniture as it is", () => {
    expect(splitFurniture("ٱللَّهِ")).toEqual({ word: "ٱللَّهِ", sajda: false });
  });
});
