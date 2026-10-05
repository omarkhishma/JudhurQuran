import { describe, expect, it } from "vitest";
import { cleanGraph, cleanKind, cleanTitle } from "./sanitize";
import { excerptOf, wordAt, type VerseText } from "./verseText";

describe("cleanGraph", () => {
  it("keeps a verse's key and the places in it, and drops any words a map carries (F3)", () => {
    const { nodes } = cleanGraph(
      [
        { id: "verse:2:255", position: { x: 1, y: 2 }, data: { kind: "verse", verse: { key: "2:255", surahName: "x", left: "forged", word: "forged", right: "forged" }, places: ["2:255:1", "2:1:1", "x"] } },
        { id: "verse:bad", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: "<b>2:255</b>" } } },
      ],
      [],
    );
    expect(nodes[0].data).toEqual({ kind: "verse", verse: { key: "2:255" }, places: ["2:255:1"] });
    expect(nodes[1].data.verse).toBeUndefined();
  });

  it("drops unknown kinds, duplicate ids, links without both ends and links to a frame, and counts them (F16)", () => {
    const out = cleanGraph(
      [
        { id: "a", position: { x: 0, y: 0 }, data: { kind: "root", ar: "ع ل م" } },
        { id: "a", position: { x: 0, y: 0 }, data: { kind: "root" } },
        { id: "b", position: { x: "x", y: Infinity }, data: { kind: "note", text: "mine", onclick: "alert(1)" } },
        { id: "c", data: { kind: "widget" } },
        { id: "f", data: { kind: "frame", title: "group", size: { w: 400, h: 300 } } },
        null,
      ],
      [
        { id: "e1", source: "a", target: "b", data: { rel: "describes", label: "near", source: "al-ʿAskarī, 12" } },
        { id: "e1", source: "b", target: "a" },
        { source: "a", target: "c" },
        { source: "b", target: "a", data: { rel: "nonsense" } },
        { source: "a", target: "f", data: { rel: "describes" } },
      ],
    );
    expect(out.nodes.map((n) => n.id)).toEqual(["a", "b", "f"]);
    expect(out.nodes[1].position).toEqual({ x: 0, y: 0 });
    expect(out.nodes[1].data).toEqual({ kind: "note", text: "mine" });
    expect(out.nodes[2]).toMatchObject({ type: "frame", data: { kind: "frame", title: "group", size: { w: 400, h: 300 } } });
    expect(out.skippedNodes).toBe(3);
    expect(out.edges.map((e) => e.id)).toEqual(["e1", "e:b->a"]);
    expect(out.edges[0].data).toEqual({ rel: "describes", label: "near", source: "al-ʿAskarī, 12" });
    // a relation this app does not know is read as a plain step
    expect(out.edges[1].data).toEqual({ rel: "next" });
    expect(out.skippedEdges).toBe(3);
  });

  it("keeps a map type's field as the reader's own, named by its template, a choice not yet made left unmade (B37)", () => {
    const { nodes } = cleanGraph(
      [
        {
          id: "lemma:x",
          position: { x: 0, y: 0 },
          data: {
            kind: "lemma",
            fields: [
              { id: "a", kind: "select", label: "المحور", value: "", options: ["الإيمان", "العمل"], tpl: "axis" },
              { id: "b", kind: "tags", label: "حقل دلالي", value: ["الإدراك"], tpl: "<script>" },
              { id: "c", kind: "select", label: "x", value: "z", options: ["p", "q"] },
            ],
          },
        },
      ],
      [],
    );
    expect(nodes[0].data.fields).toEqual([
      { id: "a", kind: "select", label: "المحور", value: "", options: ["الإيمان", "العمل"], tpl: "axis" },
      { id: "b", kind: "tags", label: "حقل دلالي", value: ["الإدراك"] },
      { id: "c", kind: "select", label: "x", value: "p", options: ["p", "q"] },
    ]);
  });

  it("keeps a quoted passage only as where it runs and its hash, and only on a note that quotes (B36)", () => {
    const run = { from: 5, to: 60, hash: "deadbeef" };
    const { nodes } = cleanGraph(
      [
        { id: "quote:dict:lane:علم~5-60", position: { x: 0, y: 0 }, data: { kind: "note", entry: "dict:lane:علم", run: { ...run, text: "forged" } } },
        { id: "n", position: { x: 0, y: 0 }, data: { kind: "note", text: "mine", run } },
        { id: "q", position: { x: 0, y: 0 }, data: { kind: "note", entry: 7, run: { from: 60, to: 5, hash: "deadbeef" } } },
      ],
      [],
    );
    expect(nodes.map((n) => n.data)).toEqual([{ kind: "note", entry: "dict:lane:علم", run }, { kind: "note", text: "mine" }, { kind: "note", entry: 7 }]);
  });

  it("keeps a quotation only as its article's id, with no words of the map's own, and fields only in their kind's shape", () => {
    const { nodes } = cleanGraph(
      [
        { id: "quote:7", position: { x: 0, y: 0 }, data: { kind: "note", entry: 7, text: "a forged quotation", phrase: true } },
        { id: "root:x", position: { x: 0, y: 0 }, data: { kind: "root", entry: 7 } },
        { id: "n", position: { x: 0, y: 0 }, data: { kind: "note", entry: "7", text: "mine" } },
        { id: "quote:dict:lane:علم", position: { x: 0, y: 0 }, data: { kind: "note", entry: "dict:lane:علم", text: "forged" } },
        { id: "m", position: { x: 0, y: 0 }, data: { kind: "note", entry: "dict:lane:علم<script>", text: "mine too" } },
        {
          id: "f",
          position: { x: 0, y: 0 },
          data: {
            kind: "lemma",
            fields: [
              { id: "a", kind: "link", label: "l", value: "javascript:alert(1)" },
              { id: "b", kind: "select", label: "s", value: "z", options: ["x", "y", "x"] },
              { id: "c", kind: "tags", label: "t", value: [" a ", "a", 3, ""] },
              { id: "d", kind: "image", label: "i", value: "../../secret", fileName: "x.png" },
              { id: "e", kind: "date", label: "d", value: "2026-10-03" },
              { id: "g", kind: "widget", label: "w", value: 1 },
            ],
          },
        },
      ],
      [],
    );
    expect(nodes[0].data).toEqual({ kind: "note", entry: 7 });
    expect(nodes[1].data).toEqual({ kind: "root" });
    expect(nodes[2].data).toEqual({ kind: "note", text: "mine" });
    // by its identifier (P1.7a): kept, the words still not the map's
    expect(nodes[3].data).toEqual({ kind: "note", entry: "dict:lane:علم" });
    expect(nodes[4].data).toEqual({ kind: "note", text: "mine too" });
    expect(nodes[5].data.fields).toEqual([
      { id: "a", kind: "link", label: "l", value: "" },
      { id: "b", kind: "select", label: "s", value: "x", options: ["x", "y"] },
      { id: "c", kind: "tags", label: "t", value: ["a"] },
      { id: "d", kind: "image", label: "i", value: "" },
      { id: "e", kind: "date", label: "d", value: "2026-10-03" },
    ]);
  });

  it("reads a title and a map type only in their own shape", () => {
    expect(cleanTitle("  My map ", "x")).toBe("My map");
    expect(cleanTitle(42, "x")).toBe("x");
    expect(cleanKind("root")).toBe("root");
    expect(cleanKind("evil")).toBe("free");
  });
});

const v: VerseText = {
  key: "1:1",
  surah: 1,
  ayah: 1,
  surah_name_ar: "الفاتحة",
  surah_name_translit: "al-Fātiḥah",
  tokens: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map((text) => ({ text })),
  words: [
    { location: "1:1:1", position: 1, token_from: 1, token_to: 1, text_uthmani: "a" },
    { location: "1:1:7", position: 7, token_from: 7, token_to: 8, text_uthmani: "gh" },
  ],
};

describe("excerptOf", () => {
  it("marks every cut so a fragment never reads as the whole verse", () => {
    expect(excerptOf(v, "1:1:7", 2)).toEqual({ left: "e f", word: "g h", right: "i j", cutLeft: true, cutRight: true });
    expect(excerptOf(v, "1:1:1", 2)).toEqual({ left: "", word: "a", right: "b c", cutLeft: false, cutRight: true });
    expect(excerptOf(v)).toEqual({ left: "a b c d e f g h i j k l", word: "", right: "", cutLeft: false, cutRight: false });
  });

  it("reads a word at its place, as the mushaf writes it", () => {
    expect(wordAt(v, "1:1:7")).toBe("g h");
    expect(wordAt(v, "1:1:99")).toBeNull();
  });
});
