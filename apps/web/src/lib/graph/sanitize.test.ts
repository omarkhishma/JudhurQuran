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
