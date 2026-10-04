import type { GraphNode } from "./types";

/**
 * Proper names on a topic map (P8.3b; P3.9's registry; research 13, QAN-09 "people and places"): a name the Quranic
 * Arabic Corpus tags as a proper noun is a heading card, the verses it is named in gathered under it ten at a time.
 * The name and its verses are the corpus's tagging; the Wikidata item matched to it is a candidate until the board
 * reviews it.
 */

export type EntityRow = {
  id: number;
  name: string;
  lemma_slug: string;
  occurrences: number;
  verses: number;
  status: "candidate" | "reviewed";
  wikidata: { id: string; label_ar: string | null; label_en: string | null; description: string | null } | null;
  review?: { verdict: string; note?: string | null; approved_at?: string | null };
};
export type KnowledgeCredit = { id: string; title_ar: string; title_en: string; url: string; attribution_ar: string; attribution_en: string };
export type EntityList = { total: number; data: EntityRow[]; sources: Record<string, KnowledgeCredit> };
export type EntityPage = EntityRow & { total: number; data: { verse_key: string }[]; sources: Record<string, KnowledgeCredit> };

export const entityCardId = (id: number | string) => `entity:${id}`;
export const entityOf = (cardId: string) => (cardId.startsWith("entity:") ? Number(cardId.slice(7)) || null : null);

/** The corpus's credit, as its terms ask: the source indicated, with a link to corpus.quran.com. */
export function entityCredit(locale: string): string {
  return locale === "ar" ? "علم في المدونة القرآنية (corpus.quran.com)" : "A proper noun in the Quranic Arabic Corpus (corpus.quran.com)";
}

/** A proper name's heading card: the name as the Quran writes it, with whose tagging it is. */
export function entityCard(e: Pick<EntityRow, "id" | "name" | "verses">, locale: string): GraphNode {
  return {
    id: entityCardId(e.id),
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "note", text: `${e.name}\n${entityCredit(locale)}`, totals: { verses: e.verses }, cursor: "t:0" },
  };
}
