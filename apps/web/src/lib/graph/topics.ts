import { link, verseId } from "./build";
import type { Added } from "./extract";
import type { GraphEdge, GraphNode } from "./types";

/**
 * Topic maps (P8.3, QAN-09; research 06 Part 3, D29): Quranpedia's topics as heading cards — one card per topic,
 * named as the source names it, its credit and the data's version on it — verses gathered under a topic, and a
 * sub-topic under its topic, each by a part-of-topic link. The verses come ten at a time in the mushaf's order.
 */

export type TopicRow = { id: string; source_id: string; name: string; parent_id: string | null; level: number; verses: number; children: number };
export type TopicCredit = { title_ar: string; title_en: string; publisher_ar: string; publisher_en: string; version: string; url: string; attribution_ar: string; attribution_en: string };
export type TopicPage = TopicRow & {
  chain: TopicRow[];
  subtopics: TopicRow[];
  total: number;
  data: { verse_key: string; link: string; review?: { verdict: string } }[];
  sources: Record<string, TopicCredit>;
};
export type VerseTopics = { verse_key: string; data: (TopicRow & { parent_name: string | null })[]; sources: Record<string, TopicCredit> };

export const topicCardId = (id: string) => `topic:${id}`;
/** A note that is a source's heading — a topic's (P8.3) or a field's (P8.4c) — not the reader's own words. */
export const sourceHeading = (cardId: string): "topic" | "field" | null => (cardId.startsWith("topic:") ? "topic" : cardId.startsWith("field:") ? "field" : null);
export const topicOf = (cardId: string) => (cardId.startsWith("topic:") ? cardId.slice(6) : null);

/** The source and the version of its data, as a line on the card: what Quranpedia's terms ask of a republication. */
export function creditLine(c: TopicCredit | undefined, locale: string): string {
  if (!c) return "";
  return locale === "ar" ? `${c.publisher_ar} — إصدار ${c.version}` : `${c.publisher_en} — version ${c.version}`;
}

/** A topic's heading card: a note named as the source names the topic, with its credit. */
export function topicCard(t: Pick<TopicRow, "id" | "name" | "verses">, credit: TopicCredit | undefined, locale: string): GraphNode {
  return {
    id: topicCardId(t.id),
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "note", text: [t.name, creditLine(credit, locale)].filter(Boolean).join("\n"), totals: { verses: t.verses }, cursor: "t:0" },
  };
}

const linked = (edges: GraphEdge[], a: string, b: string) => edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** Verses gathered under a topic's card: one card per verse not yet on the map, each linked to the topic. */
export function topicVerses(cardId: string, keys: string[], nodes: GraphNode[], edges: GraphEdge[]): Added {
  const on = new Set(nodes.map((n) => n.id));
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  for (const k of keys) {
    const id = verseId(k);
    if (!on.has(id)) {
      on.add(id);
      out.nodes.push({ id, type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: k }, folded: true } });
      out.count++;
    }
    if (!linked([...edges, ...out.edges], id, cardId)) out.edges.push(link(id, cardId, "part-of-topic"));
  }
  return out;
}

/** A sub-topic's card linked under its topic's. */
export function subtopicLink(childCard: string, parentCard: string): GraphEdge {
  return link(childCard, parentCard, "part-of-topic");
}
