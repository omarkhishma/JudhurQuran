import { describe, expect, it } from "vitest";
import { buildRootGraph, type RootGraphPayload } from "./build";
import { fromPattern, fromRoot, fromVerses, leftInRoot, linkVerse, versePlan, type VerseWord } from "./extract";
import type { GraphEdge, GraphNode } from "./types";

const lemma = (slug: string, pattern: string | null, verse_count = 3): RootGraphPayload["lemmas"][number] => ({
  id: slug.length,
  slug,
  ar: slug,
  pos: "N",
  verb_form: null,
  derivation: null,
  occurrences: verse_count + 1,
  verse_count,
  gloss_en: null,
  pattern: null,
  pattern_method: null,
  pattern_slug: pattern,
  forms: [{ form: slug, occurrences: 1, first: { location: "1:2:4", verse_key: "1:2", surah_name_ar: "الفاتحة", word: "", left: "", right: "" } }],
});

const g: RootGraphPayload = {
  root: { key: "علم", letters: ["ع", "ل", "م"], spaced: "ع ل م", translit: "ʿ-l-m", occurrences: 10, verse_count: 9, surah_count: 3, lemma_count: 3 },
  lemmas: [lemma("ilm", "fil"), lemma("alim", "fail"), lemma("alamin", null)],
  patterns: [
    { slug: "fil", ar: { full: "فِعْل", translit: "fiʿl" }, form_number: null, function_ar: null, function_en: null, lemmas: ["ilm"], occurrences: 4 },
    { slug: "fail", ar: { full: "فَعِيل", translit: "faʿīl" }, form_number: null, function_ar: null, function_en: null, lemmas: ["alim"], occurrences: 4 },
  ],
};

describe("a root's graph from the full data (P8.2, QAN-04)", () => {
  it("puts the patterns between the root and its words, a word on none straight under the root, with what each holds", () => {
    const { nodes, edges } = buildRootGraph(g, { focus: { lemmaSlug: "ilm" } });
    expect(nodes.map((n) => n.id)).toEqual(["root:علم", "pattern:fil", "pattern:fail", "lemma:ilm", "lemma:alim", "lemma:alamin"]);
    expect(edges.map((e) => [e.source, e.target, e.data?.rel])).toEqual([
      ["root:علم", "pattern:fil", "derives"],
      ["root:علم", "pattern:fail", "derives"],
      ["pattern:fil", "lemma:ilm", "realises"],
      ["pattern:fail", "lemma:alim", "realises"],
      ["root:علم", "lemma:alamin", "derives"],
    ]);
    // its patterns and its word on none are what it extracts
    expect(nodes[0].data.totals).toEqual({ patterns: 3, words: 3 });
    expect(nodes[1].data).toMatchObject({ totals: { words: 1 }, focus: true });
    expect(nodes[2].data.folded).toBe(true);
    expect(nodes[3].data).toMatchObject({ totals: { verses: 3 }, focus: true });
  });
});

describe("extraction (EDT-111…123)", () => {
  it("a root extracts its patterns and its words on none, never one already there", () => {
    const nodes: GraphNode[] = [{ id: "root:علم", type: "card", position: { x: 0, y: 0 }, data: { kind: "root", rootKey: "علم" } }, { id: "pattern:fil", type: "card", position: { x: 0, y: 0 }, data: { kind: "pattern", slug: "fil" } }];
    expect(leftInRoot(g, nodes)).toBe(2);
    const out = fromRoot(g, nodes, []);
    expect(out.nodes.map((n) => n.id)).toEqual(["pattern:fail", "lemma:alamin"]);
    expect(out.count).toBe(2);
    // the pattern already there is linked, not added again
    expect(out.edges.map((e) => e.id)).toEqual(["e:root:علم->pattern:fil", "e:root:علم->pattern:fail", "e:root:علم->lemma:alamin"]);
  });

  it("a pattern extracts its words in its roots", () => {
    const out = fromPattern("fil", [g], [], []);
    expect(out.nodes.map((n) => n.id)).toEqual(["lemma:ilm"]);
    expect(out.edges[0].data).toEqual({ rel: "realises" });
  });

  it("a word's verses: one card per verse with every place, a verse already there marking the new places", () => {
    const there: GraphNode = { id: "verse:2:31", type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: "2:31" }, places: ["2:31:2"] } };
    const out = fromVerses("lemma:ilm", { total: 5, next_cursor: "9", data: [{ verse_key: "2:31", locations: ["2:31:2", "2:31:9"] }, { verse_key: "2:32", locations: ["2:32:4"] }] }, [there], []);
    expect(out.nodes.map((n) => [n.id, n.data.places, n.data.folded])).toEqual([["verse:2:32", ["2:32:4"], true]]);
    expect(out.marks.get("verse:2:31")).toEqual(["2:31:2", "2:31:9"]);
    expect(out.edges.map((e) => [e.target, e.data?.place])).toEqual([["verse:2:31", "2:31:2"], ["verse:2:32", "2:32:4"]]);
  });

  it("a verse links its words and roots, particles only when asked, each place marked (QAN-07, QAN-08)", () => {
    const words: VerseWord[] = [
      { location: "1:2:1", lemma_slug: "hamd", lemma: "حَمْد", root: "حمد", pos: "N", text_uthmani: "ٱلْحَمْدُ" },
      { location: "1:2:2", lemma_slug: "allah", lemma: "ٱللَّه", root: "أله", pos: "PN", text_uthmani: "لِلَّهِ" },
      { location: "1:2:3", lemma_slug: "li", lemma: "لِ", root: null, pos: "P", text_uthmani: "لِ" },
      { location: "1:2:4", lemma_slug: "hamd", lemma: "حَمْد", root: "حمد", pos: "N", text_uthmani: "x" },
    ];
    const verse: GraphNode = { id: "verse:1:2", type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: "1:2" } } };
    const linked: GraphEdge[] = [{ id: "e:lemma:allah->verse:1:2", source: "lemma:allah", target: "verse:1:2", data: { rel: "attests", place: "1:2:2" } }];
    const plan = versePlan("verse:1:2", words, linked, false);
    expect(plan.words.map((w) => w.lemma_slug)).toEqual(["hamd"]);
    expect(plan.roots).toEqual(["حمد", "أله"]);
    expect(versePlan("verse:1:2", words, linked, true).words.map((w) => w.lemma_slug)).toEqual(["hamd", "li"]);
    const both = linkVerse("verse:1:2", words, plan, "both", new Map([["حمد", { key: "حمد", spaced: "ح م د", translit: "ḥ-m-d", occurrences: 68 }]]), [verse], linked);
    expect(both.nodes.map((n) => n.id)).toEqual(["lemma:hamd", "root:حمد"]);
    expect(both.edges.map((e) => [e.source, e.target, e.data?.rel])).toEqual([["lemma:hamd", "verse:1:2", "attests"], ["root:حمد", "lemma:hamd", "derives"]]);
    expect(both.marks.get("verse:1:2")).toEqual(["1:2:1", "1:2:4"]);
    const roots = linkVerse("verse:1:2", words, plan, "roots", new Map(), [verse], linked);
    expect(roots.edges.map((e) => [e.source, e.data?.rel])).toEqual([["root:حمد", "attests"], ["root:أله", "attests"]]);
    expect(roots.nodes.find((n) => n.id === "root:أله")?.data.ar).toBe("أ ل ه");
  });
});
