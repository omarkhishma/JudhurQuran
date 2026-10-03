import { describe, expect, it } from "vitest";
import { type Analysis, toConllu } from "./analyse";

const a: Analysis = {
  text: "العلم   نور",
  source: { kind: "free", verse_key: null, whole_verse: false },
  counts: { tokens: 2, roots: 1, to_review: 0 },
  truncated: false,
  tokens: [
    {
      surface: "العلم",
      key: "العلم",
      kind: "form",
      confidence: 1,
      clitics: [],
      location: null,
      candidates: [
        {
          lemma: { slug: "ilm", ar: "عِلْم", pos: "N" },
          root: { key: "علم", spaced: "ع ل م", translit: "ʿ-l-m" },
          pattern: { slug: "fil", ar: "فِعْل" },
          pos: "N",
          features: { pos: { ar: "اسم", en: "noun", tag: "N" }, case: { ar: "مرفوع", en: "nominative", tag: "NOM" }, gender: { ar: "مذكر", en: "masculine", tag: "M" } },
          segments: null,
          gloss_en: "knowledge",
          count: 3,
          share: 1,
          confidence: 1,
          location: "2:145:21",
        },
      ],
    },
    { surface: "إنّ", key: "ان", kind: "particle", confidence: 1, clitics: [], candidates: [], particle: { lemma: { slug: "inna", ar: "إِنَّ", pos: "ACC" }, root: null, pattern: null, pos: "ACC", features: null, segments: null, gloss_en: null, count: 1, share: 1, confidence: 1, location: null } },
  ],
};

describe("toConllu (ANA-28, ANA-Q06)", () => {
  const out = toConllu(a, (t) => t.candidates[0]);
  const lines = out.split("\n");

  it("opens with sent_id and text and ends the sentence with a blank line", () => {
    expect(lines[0]).toBe("# sent_id = jadhr-analyse-1");
    expect(lines[1]).toBe("# text = العلم نور");
    expect(out.endsWith("\n\n")).toBe(true);
  });

  it("writes ten columns, UD features in FEATS and root and pattern in MISC", () => {
    const cols = lines[2].split("\t");
    expect(cols).toHaveLength(10);
    // the reader's own sentence: no inflection is borrowed from a Quranic occurrence
    expect(cols.slice(0, 6)).toEqual(["1", "العلم", "عِلْم", "NOUN", "N", "_"]);
    expect(cols[9]).toBe("Root=ع.ل.م|Pattern=فِعْل|Source=Jadhr-form|Confidence=1.00");
  });

  it("writes the features of a Quranic word read at its place", () => {
    const gold = toConllu({ ...a, tokens: [{ ...a.tokens[0], kind: "gold", location: "2:145:21" }] }, (t) => t.candidates[0]).split("\n")[2].split("\t");
    expect(gold[5]).toBe("Case=Nom|Gender=Masc");
    expect(gold[9]).toContain("Source=QAC");
  });

  it("writes one sentence per verse for Quranic text, the verse as its sent_id", () => {
    const two = toConllu({ ...a, tokens: [{ ...a.tokens[0], kind: "gold", verse_key: "1:1" }, { ...a.tokens[1], verse_key: "1:2" }] }, (t) => t.candidates[0]);
    const blocks = two.trim().split("\n\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].split("\n")[0]).toBe("# sent_id = quran-1:1");
    expect(blocks[1].split("\n").slice(0, 3)).toEqual(["# sent_id = quran-1:2", "# text = إنّ", expect.stringMatching(/^1\t/)]);
  });

  it("gives a particle no root and no pattern (ANA-30)", () => {
    const cols = lines[3].split("\t");
    expect(cols[3]).toBe("PART");
    expect(cols[9]).not.toMatch(/Root=|Pattern=/);
  });
});
