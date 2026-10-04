import { formatNumber } from "@/lib/format";
import { link, verseId } from "./build";
import type { Added } from "./extract";
import type { GraphEdge, GraphNode } from "./types";

/**
 * Topic maps (P8.3, QAN-09; research 06 Part 3, D29): topics as heading cards — one card per topic, named as the
 * taxonomy in force names it, whose it is on the card (Quranpedia's with the version of its data, or the editorial
 * board's) — verses gathered under a topic, and a sub-topic under its topic, each by a part-of-topic link. The verses
 * come ten at a time in the mushaf's order. A proper name of the Quran (P3.9's registry, P8.3b) is a heading too.
 */

/** What the editorial board did to a heading (P8.3b): named it, placed it under another, and when that came into force. */
export type BoardMark = { named: boolean; placed: boolean; approved_at: string | null };
export type TopicRow = {
  id: string;
  source_id: string;
  name: string;
  name_en?: string;
  parent_id: string | null;
  level: number;
  verses: number;
  children: number;
  board?: BoardMark;
  /** the source's own name, when the board renamed it */
  source_name?: string;
  /** a La Beaume chapter the board adopted: the chapter as the book prints it */
  after?: { source_id: string; ref: string; title_fr: string };
};
export type TopicCredit = { title_ar: string; title_en: string; publisher_ar: string; publisher_en: string; version: string; url: string; attribution_ar: string; attribution_en: string };
/** A verse under a topic: Quranpedia's link (with the board's verdict when it has one), or a verse the board placed
 * there from QSAC's suggestion (`source_id` "qsac", verdict "placed"). */
export type TopicLink = { verse_key: string; link: string; source_id: string; review?: { verdict: string; approved_at?: string | null } };
export type TopicPage = TopicRow & {
  chain: TopicRow[];
  subtopics: TopicRow[];
  total: number;
  data: TopicLink[];
  sources: Record<string, TopicCredit>;
};
export type VerseTopic = TopicRow & { parent_name: string | null; via: string; review?: { verdict: string; approved_at?: string | null } };
export type VerseTopics = { verse_key: string; data: VerseTopic[]; sources: Record<string, TopicCredit> };

export const QURANPEDIA = "quranpedia-topics";
export const topicCardId = (id: string) => `topic:${id}`;
/** A note that is a source's heading — a topic's (P8.3), a field's (P8.4c) or a proper name's (P8.3b) — not the
 * reader's own words. */
export const sourceHeading = (cardId: string): "topic" | "field" | "entity" | null =>
  cardId.startsWith("topic:") ? "topic" : cardId.startsWith("field:") ? "field" : cardId.startsWith("entity:") ? "entity" : null;
export const topicOf = (cardId: string) => (cardId.startsWith("topic:") ? cardId.slice(6) : null);
/** A topic of the board's taxonomy (an adopted La Beaume chapter, or the board's own), not Quranpedia's. */
export const isBoardTopic = (topicId: string) => topicId.startsWith("lb:") || topicId.startsWith("board:");

/** The source and the version of its data, as a line: what Quranpedia's terms ask of a republication. */
export function creditLine(c: TopicCredit | undefined, locale: string): string {
  if (!c) return "";
  return locale === "ar" ? `${c.publisher_ar} — إصدار ${c.version}` : `${c.publisher_en} — version ${c.version}`;
}

/** Whose a heading is, as a line on its card: Quranpedia's with its version — saying so when the board renamed it —
 * or the editorial board's, with the La Beaume chapter it adopted. */
export function headingCredit(t: Pick<TopicRow, "source_id" | "board" | "after">, sources: Record<string, TopicCredit>, locale: string): string {
  const ar = locale === "ar";
  if (t.source_id === QURANPEDIA) {
    const line = creditLine(sources[QURANPEDIA], locale);
    return t.board?.named ? `${line} · ${ar ? "سمّته هيئة التحرير" : "named by the editorial board"}` : line;
  }
  const ch = t.after?.ref.match(/chapitre (\d+)/)?.[1];
  if (t.source_id === "labeaume")
    return ar ? `هيئة التحرير، عن فصول لابوم${ch ? ` (الفصل ${formatNumber(Number(ch), locale)})` : ""}` : `The editorial board, after La Beaume${ch ? ` (chapter ${ch})` : ""}`;
  return ar ? "هيئة التحرير" : "The editorial board";
}

/** A topic's heading card: a note named as the taxonomy names the topic, with whose it is. */
export function topicCard(t: Pick<TopicRow, "id" | "name" | "verses" | "source_id" | "board" | "after">, sources: Record<string, TopicCredit>, locale: string): GraphNode {
  return {
    id: topicCardId(t.id),
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "note", text: [t.name, headingCredit(t, sources, locale)].filter(Boolean).join("\n"), totals: { verses: t.verses }, cursor: "t:0" },
  };
}

const linked = (edges: GraphEdge[], a: string, b: string) => edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** Verses gathered under a heading's card: one card per verse not yet on the map, each linked to the heading. */
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

/** Where a heading's verses are read, ten at a time: a topic's or a proper name's. */
export function headingVersesPath(cardId: string): string | null {
  if (cardId.startsWith("topic:")) return `/topics/${encodeURIComponent(cardId.slice(6))}`;
  if (cardId.startsWith("entity:")) return `/entities/${encodeURIComponent(cardId.slice(7))}`;
  return null;
}
