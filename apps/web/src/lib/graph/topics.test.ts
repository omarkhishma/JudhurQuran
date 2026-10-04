import { describe, expect, it } from "vitest";
import { decodeSeed, encodeSeed } from "./seedCodec";
import { creditLine, topicCard, topicOf, topicVerses } from "./topics";
import type { GraphNode } from "./types";

const credit = { title_ar: "الموضوعات القرآنية", title_en: "Quranic topics", publisher_ar: "الموسوعة القرآنية (quranpedia.net)", publisher_en: "Quranpedia.net", version: "2026-10-03", url: "https://quranpedia.net/topics", attribution_ar: "", attribution_en: "" };

describe("topic maps (P8.3)", () => {
  it("names a topic's card as the source names it, with the source and the version of its data", () => {
    const c = topicCard({ id: "qp:29", name: "إقامتهم الصلاة", verses: 21 }, credit, "ar");
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

  it("a topic seed travels by its id only, in the dataset's shape", () => {
    expect(decodeSeed(encodeSeed({ seed: "topic", topic: "qp:29" }))).toEqual({ seed: "topic", topic: "qp:29" });
    expect(decodeSeed(encodeSeed({ seed: "topic", topic: "<b>" } as never))).toBeNull();
  });
});
