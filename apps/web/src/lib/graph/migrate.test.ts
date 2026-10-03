import { describe, expect, it } from "vitest";
import { migrateV1 } from "./migrate";
import { checkLink } from "./relations";
import type { GraphEdge, GraphNode } from "./types";

const lookup = async (ids: number[]) =>
  new Map(
    [
      { id: 7, slug: "alamin", ar: "عَٰلَمِين", root: "علم", pos: "N" },
      { id: 9, slug: "ilm", ar: "عِلْم", root: "علم", pos: "N" },
    ]
      .filter((l) => ids.includes(l.id))
      .map((l) => [l.id, l]),
  );

describe("version-1 maps read as version 2 (P8.1a)", () => {
  it("keys words by slug, folds written forms into their word, and keeps one card per verse with its places (F5)", async () => {
    const out = await migrateV1(
      "root",
      [
        { id: "root:علم", position: { x: 0, y: 0 }, data: { kind: "root", ar: "ع ل م", rootKey: "علم" } },
        { id: "lemma:7", position: { x: 1, y: 1 }, data: { kind: "lemma", ar: "عَٰلَمِين", lemmaId: 7, count: 73 } },
        { id: "word:7:العالمين", position: { x: 2, y: 2 }, data: { kind: "word", lemmaId: 7, form: "العالمين", count: 61, verse: { key: "1:2", location: "1:2:4", left: "x", word: "x" } } },
        { id: "word:1:2:4", position: { x: 3, y: 3 }, data: { kind: "word", lemmaId: 7, form: "العالمين", verse: { key: "1:2", location: "1:2:4" } } },
        { id: "verse:1:2:4", position: { x: 4, y: 4 }, data: { kind: "verse", verse: { key: "1:2", location: "1:2:4" }, focus: true } },
        { id: "verse:1:2", position: { x: 5, y: 5 }, data: { kind: "verse", verse: { key: "1:2" } } },
        { id: "lemma:404", position: { x: 6, y: 6 }, data: { kind: "lemma", lemmaId: 404 } },
        { id: "phrase:x", position: { x: 7, y: 7 }, data: { kind: "verse", ar: "العلم نور" } },
      ],
      [
        { id: "a", source: "root:علم", target: "lemma:7" },
        { id: "b", source: "lemma:7", target: "word:7:العالمين" },
        { id: "c", source: "word:7:العالمين", target: "verse:1:2:4" },
        { id: "d", source: "phrase:x", target: "lemma:7", data: { reading: true } },
        { id: "e", source: "lemma:404", target: "verse:1:2" },
      ],
      lookup,
    );
    expect(out.nodes.map((n) => n.id)).toEqual(["root:علم", "lemma:alamin", "verse:1:2", "phrase:x"]);
    const lemma = out.nodes[1].data;
    expect(lemma).toMatchObject({ kind: "lemma", slug: "alamin", count: 73, first: "1:2:4", forms: [{ form: "العالمين", count: 61 }] });
    expect(out.nodes[2].data).toEqual({ kind: "verse", verse: { key: "1:2" }, places: ["1:2:4"], focus: true });
    expect(out.nodes[3].data).toEqual({ kind: "note", text: "العلم نور", phrase: true });
    expect(out.edges.map((e) => [e.source, e.target, e.data])).toEqual([
      ["root:علم", "lemma:alamin", { rel: "derives" }],
      ["lemma:alamin", "verse:1:2", { rel: "attests", place: "1:2:4" }],
      ["phrase:x", "lemma:alamin", { rel: "describes", reading: true }],
    ]);
    // a lemma the dataset no longer holds, and the link to it, are counted as unread
    expect(out.skippedNodes).toBe(1);
    expect(out.skippedEdges).toBe(1);
  });

  it("keeps a trail's numbered steps as steps", async () => {
    const out = await migrateV1(
      "free",
      [
        { id: "verse:1:2", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: "1:2" } } },
        { id: "root:رحم", position: { x: 0, y: 0 }, data: { kind: "root", rootKey: "رحم" } },
      ],
      [{ id: "s", source: "verse:1:2", target: "root:رحم", label: "1", data: { label: "1" } }],
      lookup,
    );
    expect(out.edges[0].data).toEqual({ rel: "next", label: "1" });
  });
});

const card = (id: string, kind: GraphNode["data"]["kind"]): GraphNode => ({ id, type: "card", position: { x: 0, y: 0 }, data: { kind } });
const wire = (s: string, t: string, rel: NonNullable<GraphEdge["data"]>["rel"]): GraphEdge => ({ id: `e:${s}->${t}`, source: s, target: t, data: { rel } });

describe("links (P8.1a, D17, EDT-127, HWF-15, HWF-16)", () => {
  const nodes = [card("r", "root"), card("r2", "root"), card("p", "pattern"), card("l", "lemma"), card("l2", "lemma"), card("v", "verse"), card("v2", "verse"), card("n", "note"), card("n2", "note")];
  it("takes the spine's relation by kinds, and refuses the same card, a link twice and a pair the map does not allow", () => {
    expect(checkLink("root", nodes, [], "r", "l")).toEqual({ rel: "derives" });
    expect(checkLink("root", nodes, [], "p", "l")).toEqual({ rel: "realises" });
    expect(checkLink("root", nodes, [], "l", "v")).toEqual({ rel: "attests" });
    expect(checkLink("root", nodes, [], "l", "l")).toEqual({ refused: "same" });
    expect(checkLink("root", nodes, [wire("r", "l", "derives")], "r", "l")).toEqual({ refused: "dup" });
    expect(checkLink("root", nodes, [], "r", "r2")).toEqual({ refused: "pair" });
    expect(checkLink("root", nodes, [], "v", "v2")).toEqual({ refused: "pair" });
  });
  it("relaxes root → root and verse → verse through typed relations in the maps they belong to (D17)", () => {
    expect(checkLink("meaning", nodes, [], "r", "r2")).toEqual({ rel: "near-in-meaning" });
    expect(checkLink("meaning", nodes, [], "l", "l2", "opposite-of")).toEqual({ rel: "opposite-of" });
    expect(checkLink("topic", nodes, [], "v", "v2")).toEqual({ rel: "refers-to" });
    expect(checkLink("topic", nodes, [], "v", "n")).toEqual({ rel: "part-of-topic" });
    expect(checkLink("root", nodes, [], "v", "n")).toEqual({ rel: "describes" });
    // a meaning relation holds both ways: the reverse is the same link
    expect(checkLink("meaning", nodes, [wire("l", "l2", "near-in-meaning")], "l2", "l")).toEqual({ refused: "dup" });
  });
  it("refuses a loop in the lexicon's spine and in a topic's parts, and allows one among meanings", () => {
    const spine = [wire("r", "l", "derives"), wire("l", "v", "attests")];
    // root → word → verse: the verse citing the root again closes the loop
    expect(checkLink("free", nodes, spine, "v", "r", "cites")).toEqual({ refused: "loop" });
    expect(checkLink("free", nodes, spine, "v", "r2", "cites")).toEqual({ rel: "cites" });
    expect(checkLink("free", nodes, [wire("l", "v", "attests")], "v", "l", "cites")).toEqual({ refused: "loop" });
    expect(checkLink("topic", nodes, [wire("n", "n2", "part-of-topic")], "n2", "n")).toEqual({ refused: "loop" });
    const ring = [wire("l", "l2", "near-in-meaning"), wire("r", "r2", "near-in-meaning")];
    expect(checkLink("meaning", nodes, ring, "r2", "r", "opposite-of")).toEqual({ rel: "opposite-of" });
  });
});
