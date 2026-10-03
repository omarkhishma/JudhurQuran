import { describe, expect, it } from "vitest";
import { bookOf, endsOf, fromRelations, fromShared, pairKey, relationLink, type RelationEdge, type RootRelations } from "./meaning";
import { cleanGraph } from "./sanitize";
import type { GraphEdge, GraphNode } from "./types";

const source = { id: "askari-furuq", title_ar: "الفروق اللغوية", title_en: "al-Furūq al-Lughawiyya", author_ar: "أبو هلال العسكري، الحسن بن عبد الله", author_en: "Abū Hilāl al-ʿAskarī", death_hijri: 395, death_ce: 1005, locator: "urn:x:1.6", page_vol: 1, page: 32 };
const edge = (id: string, a: string, b: string | null, sense: string | null = null): RelationEdge => ({
  id,
  type: b ? "furuq_contrast" : "wujuh_sense",
  rel: b ? "near-in-meaning" : "wujuh-sense",
  a: { root: a, word: "الاسم" },
  b: b ? { root: b, word: "الحد" } : null,
  sense,
  quote: "أن الحد يوجب المعرفة",
  verses: [],
  source,
  review: { verdict: "reviewed", note: null, correction: null, approved_at: null },
});
const root = (key: string): GraphNode => ({ id: `root:${key}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "root", rootKey: key, ar: [...key].join(" ") } });

describe("meaning maps (P8.4)", () => {
  it("draws a two-ended relation between its roots, with its book and id, and nothing for a one-ended one", () => {
    expect(endsOf(edge("x:1", "سمو", "حدد"))).toEqual(["سمو", "حدد"]);
    expect(endsOf(edge("x:2", "سمو", null))).toBeNull();
    expect(endsOf(edge("x:3", "علم", "علم"))).toBeNull();
    const l = relationLink(edge("askari-furuq:0006:r", "سمو", "حدد", "المعرفة"), true, "ar")!;
    expect([l.source, l.target, l.data]).toEqual(["root:سمو", "root:حدد", { rel: "near-in-meaning", label: "المعرفة", source: "أبو هلال العسكري (ت ٣٩٥هـ)، الفروق اللغوية، ج١ ص٣٢", relation: "askari-furuq:0006:r", reviewed: true }]);
    expect(bookOf(edge("x:1", "a", "b"), "en")).toBe("Abū Hilāl al-ʿAskarī (d. 1005), al-Furūq al-Lughawiyya, vol. 1, p. 32");
  });

  it("adds each related root once, links each pair once, and leaves a pair already linked as it is", () => {
    const rel: RootRelations = { root: "سمو", data: [edge("r:1", "سمو", "حدد"), edge("r:2", "عرف", "سمو"), edge("r:3", "سمو", "حدد"), edge("r:4", "سمو", null)], waiting: 0, extracted: [], extracted_total: 0, fields_extracted: [], fields_extracted_total: 0 };
    const on: GraphEdge[] = [{ id: "e:root:عرف->root:سمو", source: "root:عرف", target: "root:سمو", data: { rel: "near-in-meaning" } }];
    const out = fromRelations("سمو", rel, new Map([["حدد", { key: "حدد", spaced: "ح د د", translit: "ḥ-d-d", occurrences: 25 }]]), [root("سمو"), root("عرف")], on, "ar");
    expect(out.nodes.map((n) => [n.id, n.data.ar, n.data.count])).toEqual([["root:حدد", "ح د د", 25]]);
    expect(out.edges.map((e) => [e.source, e.target, e.data?.relation])).toEqual([["root:سمو", "root:حدد", "r:1"]]);
    expect(out.count).toBe(1);
  });

  it("brings a pair's shared verses linked from both roots, every place of either root marked; a verse on the map gets its places", () => {
    const words = [
      { location: "2:31:3", lemma: "اسم", root: "سمو", pos: "N", text_uthmani: "ٱلْأَسْمَآءَ" },
      { location: "2:31:9", lemma: "اسم", root: "سمو", pos: "N", text_uthmani: "بِأَسْمَآءِ" },
      { location: "2:31:5", lemma: "عرض", root: "عرض", pos: "V", text_uthmani: "عَرَضَهُمْ" },
    ];
    const had: GraphNode = { id: "verse:7:180", type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: "7:180" }, places: ["7:180:1"] } };
    const out = fromShared("سمو", "عرض", [{ key: "2:31", words }, { key: "7:180", words: [{ location: "7:180:4", lemma: "اسم", root: "سمو", pos: "N", text_uthmani: "ٱلْأَسْمَآءُ" }] }], [root("سمو"), root("عرض"), had], []);
    expect(out.nodes.map((n) => [n.id, n.data.places])).toEqual([["verse:2:31", ["2:31:3", "2:31:9", "2:31:5"]]]);
    expect(out.marks.get("verse:7:180")).toEqual(["7:180:1", "7:180:4"]);
    expect(out.edges.map((e) => [e.source, e.target, e.data?.place])).toEqual([
      ["root:سمو", "verse:2:31", "2:31:3"],
      ["root:عرض", "verse:2:31", "2:31:5"],
      ["root:سمو", "verse:7:180", "7:180:4"],
      ["root:عرض", "verse:7:180", undefined],
    ]);
    expect(pairKey("عرض", "سمو")).toBe(pairKey("سمو", "عرض"));
  });

  it("keeps a link's relation id only in the dataset's shape, and says whether it was reviewed", () => {
    const nodes = [root("سمو"), root("حدد")];
    const kept = cleanGraph(nodes, [{ id: "e1", source: "root:سمو", target: "root:حدد", data: { rel: "near-in-meaning", relation: "nuzha:0003:s01:n1", reviewed: "yes" } }]);
    expect(kept.edges[0].data).toEqual({ rel: "near-in-meaning", relation: "nuzha:0003:s01:n1", reviewed: false });
    const forged = cleanGraph(nodes, [{ id: "e1", source: "root:سمو", target: "root:حدد", data: { rel: "near-in-meaning", relation: "<img src=x>", reviewed: true } }]);
    expect(forged.edges[0].data).toEqual({ rel: "near-in-meaning" });
  });
});
