import { describe, expect, it } from "vitest";
import { foldLatin, parseMentions } from "./mentions";

describe("@-mentions in notes (NTB-27, NTB-Q04)", () => {
  it("reads verses with the colon, Arabic-Indic digits and ranges", () => {
    expect(parseMentions("see @2:32 and @٢:٢٥٥-٢٥٧.")).toEqual([
      { kind: "verse", raw: "2:32", surah: 2, ayah: 32, to: null },
      { kind: "verse", raw: "٢:٢٥٥-٢٥٧", surah: 2, ayah: 255, to: 257 },
    ]);
  });

  it("reads roots in Arabic letters, spaced, and in Latin", () => {
    // «و» joined to the next word is not a fourth letter
    expect(parseMentions("@ع ل م وقال")).toEqual([{ kind: "root", raw: "ع ل م", query: "ع ل م" }]);
    expect(parseMentions("عن @ع ل م، و @k-t-b هنا")).toEqual([
      { kind: "root", raw: "ع ل م", query: "ع ل م" },
      { kind: "root", raw: "k-t-b", query: "k-t-b" },
    ]);
  });

  it("takes one word and stops, so what follows is not swallowed", () => {
    expect(parseMentions("@ʿilm is great; @العلم، نور")).toEqual([
      { kind: "word", raw: "ʿilm", query: "ʿilm" },
      { kind: "word", raw: "العلم", query: "العلم" },
    ]);
  });

  it("reads a mention joined to «و» as Arabic is written", () => {
    expect(parseMentions("انظر @2:255 و@ع ل م، و@علم")).toHaveLength(3);
  });

  it("ignores e-mail addresses and repeats", () => {
    expect(parseMentions("write to a@b.org @2:255 @2:255")).toHaveLength(1);
  });

  it("matches a lexicon's name typed with or without its marks", () => {
    expect(foldLatin("Lisān")).toBe(foldLatin("Lisan"));
    expect(foldLatin("al-ʿAyn")).toBe("alayn");
  });
});
