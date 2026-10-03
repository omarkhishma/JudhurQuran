import { describe, expect, it } from "vitest";
import { type AnalysedToken, type Analysis, type Candidate, type Segment, toConllu } from "./analyse";

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

describe("UD tokenisation of clitics (ANA-Q06) and participles (ANA-30)", () => {
  const L = (tag: string, en = "") => ({ ar: "", en, tag });
  const gold = (surface: string, segments: Segment[], pos: string, features: Candidate["features"] = null): AnalysedToken => ({
    surface,
    key: surface,
    kind: "gold",
    confidence: 1,
    clitics: [],
    location: "1:1:1",
    candidates: [{ lemma: { slug: "x", ar: "x", pos }, root: { key: "علم", spaced: "ع ل م", translit: "" }, pattern: null, pos, features, segments, gloss_en: null, count: 1, share: 1, confidence: 1, location: "1:1:1" }],
  });
  const conll = (t: AnalysedToken) => toConllu({ ...a, tokens: [t] }, (x) => x.candidates[0]).trim().split("\n").slice(2).map((l) => l.split("\t"));

  it("splits a proclitic and a possessive pronoun under a multiword-token range", () => {
    // بِحَمْدِكَ (2:30): بِ + حَمْدِ + كَ
    const rows = conll(gold("بِحَمۡدِكَ", [{ kind: "prefix", text: "بِ", index: 1, label: L("bi+") }, { kind: "stem", text: "حَمْدِ", index: 2, features: { pos: L("N"), case: L("GEN") } }, { kind: "suffix", text: "كَ", index: 3, label: L("PRON:2MS") }], "N", { pos: L("N"), case: L("GEN") }));
    expect(rows.map((r) => r.slice(0, 4))).toEqual([["1-3", "بِحَمۡدِكَ", "_", "_"], ["1", "بِ", "بِ", "ADP"], ["2", "حَمْدِ", "x", "NOUN"], ["3", "كَ", "كَ", "PRON"]]);
    expect(rows[3][5]).toBe("Gender=Masc|Number=Sing|Person=2");
    expect(rows[2][5]).toBe("Case=Gen");
    expect(rows[2][9]).toContain("Source=QAC"); // MISC stays on the word that carries the analysis
    expect(rows[0].slice(4).every((c) => c === "_")).toBe(true);
  });

  it("keeps the article on its word with Definite=Def and splits the conjunction", () => {
    const rows = conll(gold("وَٱلۡعِلۡمِ", [{ kind: "prefix", text: "وَ", index: 1, label: L("w:CONJ+") }, { kind: "prefix", text: "ٱلْ", index: 2, label: L("Al+") }, { kind: "stem", text: "عِلْمِ", index: 3, features: { pos: L("N") } }], "N", { pos: L("N"), case: L("GEN") }));
    expect(rows.map((r) => [r[0], r[1], r[3]])).toEqual([["1-2", "وَٱلۡعِلۡمِ", "_"], ["1", "وَ", "CCONJ"], ["2", "ٱلْعِلْمِ", "NOUN"]]);
    expect(rows[2][5]).toBe("Case=Gen|Definite=Def");
  });

  it("leaves a verb's agreeing subject suffix on the verb and splits its object", () => {
    const verb = { pos: L("V"), person: L("3"), gender: L("M"), number: L("P") };
    // قَالُواْ (2:32): the suffix agrees — one word
    expect(conll(gold("قَالُواْ", [{ kind: "stem", text: "قَالُ", index: 1, features: verb }, { kind: "suffix", text: "وا۟", index: 2, label: L("PRON:3MP") }], "V", verb))).toHaveLength(1);
    // رَزَقۡنَٰهُمۡ (2:3): نا agrees with the verb (1P), هم is its object
    const v1p = { pos: L("V"), person: L("1"), number: L("P") };
    const rows = conll(gold("رَزَقۡنَٰهُمۡ", [{ kind: "stem", text: "رَزَقْ", index: 1, features: v1p }, { kind: "suffix", text: "نَٰ", index: 2, label: L("PRON:1P") }, { kind: "suffix", text: "هُمْ", index: 3, label: L("PRON:3MP") }], "V", v1p));
    expect(rows.map((r) => [r[0], r[1], r[3]])).toEqual([["1-2", "رَزَقۡنَٰهُمۡ", "_"], ["1", "رَزَقْنَٰ", "VERB"], ["2", "هُمْ", "PRON"]]);
  });

  it("splits a free-text word by the clitics it was read with, the article staying", () => {
    const t: AnalysedToken = { surface: "بالتعلم", key: "بالتعلم", kind: "clitic", confidence: 0.5, clitics: ["بال"], stem: "تعلم", candidates: [{ ...a.tokens[0].candidates[0], pos: "N" }] };
    const rows = conll(t);
    expect(rows.map((r) => [r[0], r[1], r[3]])).toEqual([["1-2", "بالتعلم", "_"], ["1", "ب", "ADP"], ["2", "التعلم", "NOUN"]]);
    const l: AnalysedToken = { ...t, surface: "للعلم", key: "للعلم", clitics: ["لل"], stem: "علم" };
    expect(conll(l).map((r) => r[1])).toEqual(["للعلم", "ل", "العلم"]);
  });

  it("writes participles with VerbForm=Part and their voice", () => {
    const f = { pos: L("N"), derivation: L("ACT_PCPL"), case: L("NOM") };
    const rows = conll(gold("عَالِمٌ", [{ kind: "stem", text: "عَالِمٌ", index: 1, features: f }], "N", f));
    expect(rows[0][5]).toBe("Case=Nom|VerbForm=Part|Voice=Act");
  });
});
