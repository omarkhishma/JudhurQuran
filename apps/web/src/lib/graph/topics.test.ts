import { describe, expect, it } from "vitest";
import { entityCard, entityOf } from "./entities";
import { decodeSeed, encodeSeed } from "./seedCodec";
import { creditLine, headingCredit, headingVersesPath, isBoardTopic, sourceHeading, topicCard, topicOf, topicVerses } from "./topics";
import type { GraphNode } from "./types";

const credit = { title_ar: "الموضوعات القرآنية", title_en: "Quranic topics", publisher_ar: "الموسوعة القرآنية (quranpedia.net)", publisher_en: "Quranpedia.net", version: "2026-10-03", url: "https://quranpedia.net/topics", attribution_ar: "", attribution_en: "" };
const sources = { "quranpedia-topics": credit };

describe("topic maps (P8.3)", () => {
  it("names a topic's card as the source names it, with the source and the version of its data", () => {
    const c = topicCard({ id: "qp:29", name: "إقامتهم الصلاة", verses: 21, source_id: "quranpedia-topics" }, sources, "ar");
    expect([c.id, c.data.kind, c.data.text, c.data.totals, c.data.cursor]).toEqual(["topic:qp:29", "note", "إقامتهم الصلاة\nالموسوعة القرآنية (quranpedia.net) — إصدار 2026-10-03", { verses: 21 }, "t:0"]);
    expect(creditLine(credit, "en")).toBe("Quranpedia.net — version 2026-10-03");
    expect([topicOf("topic:qp:29"), topicOf("note:abc")]).toEqual(["qp:29", null]);
  });

  it("gathers verses under the topic once each, a verse already on the map linked rather than added again", () => {
    const had: GraphNode = { id: "verse:2:3", type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: "2:3" } } };
    const out = topicVerses("topic:qp:29", ["2:3", "2:43", "2:43"], [had], []);
    expect(out.nodes.map((n) => n.id)).toEqual(["verse:2:43"]);
    expect(out.edges.map((e) => [e.source, e.target, e.data?.rel])).toEqual([
      ["verse:2:3", "topic:qp:29", "part-of-topic"],
      ["verse:2:43", "topic:qp:29", "part-of-topic"],
    ]);
  });

  it("a topic seed travels by its id only, in the dataset's or the board's shape; a proper name's by its number", () => {
    for (const topic of ["qp:29", "lb:3", "board:t3st0001"]) expect(decodeSeed(encodeSeed({ seed: "topic", topic }))).toEqual({ seed: "topic", topic });
    expect(decodeSeed(encodeSeed({ seed: "topic", topic: "<b>" } as never))).toBeNull();
    expect(decodeSeed(encodeSeed({ seed: "topic", topic: "qsac:aqeedah" } as never))).toBeNull();
    expect(decodeSeed(encodeSeed({ seed: "entity", entity: 2 }))).toEqual({ seed: "entity", entity: 2 });
    expect(decodeSeed(encodeSeed({ seed: "entity", entity: "2" } as never))).toBeNull();
  });
});

describe("the taxonomy in force and proper names on a map (P8.3b)", () => {
  it("says whose a heading is: Quranpedia's with its version, renamed by the board, an adopted chapter, the board's own", () => {
    const qp = { source_id: "quranpedia-topics" };
    expect(headingCredit(qp, sources, "ar")).toBe("الموسوعة القرآنية (quranpedia.net) — إصدار 2026-10-03");
    expect(headingCredit({ ...qp, board: { named: true, placed: false, approved_at: null } }, sources, "en")).toBe("Quranpedia.net — version 2026-10-03 · named by the editorial board");
    const lb = { source_id: "labeaume", board: { named: true, placed: false, approved_at: null }, after: { source_id: "labeaume", ref: "chapitre 3, p. 62", title_fr: "Prédication" } };
    expect(headingCredit(lb, sources, "ar")).toBe("هيئة التحرير، عن فصول لابوم (الفصل ٣)");
    expect(headingCredit(lb, sources, "en")).toBe("The editorial board, after La Beaume (chapter 3)");
    expect(headingCredit({ source_id: "board" }, sources, "ar")).toBe("هيئة التحرير");
    expect([isBoardTopic("lb:3"), isBoardTopic("board:t3st0001"), isBoardTopic("qp:3")]).toEqual([true, true, false]);
  });

  it("a proper name is a heading whose verses are read like a topic's", () => {
    const c = entityCard({ id: 2, name: "مُوسَىٰ", verses: 131 }, "ar");
    expect([c.id, c.data.kind, c.data.text, c.data.totals, c.data.cursor]).toEqual(["entity:2", "note", "مُوسَىٰ\nعلم في المدونة القرآنية (corpus.quran.com)", { verses: 131 }, "t:0"]);
    expect([sourceHeading("entity:2"), sourceHeading("topic:lb:3"), sourceHeading("field:x"), sourceHeading("note:mytopic-t1")]).toEqual(["entity", "topic", "field", null]);
    expect([entityOf("entity:2"), entityOf("topic:qp:2")]).toEqual([2, null]);
    expect([headingVersesPath("entity:2"), headingVersesPath("topic:board:t3st0001"), headingVersesPath("note:x")]).toEqual(["/entities/2", "/topics/board%3At3st0001", null]);
  });
});
