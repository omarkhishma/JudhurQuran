import type { FieldKind, GraphKind, NodeKind } from "./types";

/**
 * The fields a map's type offers its cards (B37, from the design's per-type seeds, EDT-080): a meaning map's words and
 * roots a «حقل دلالي» to tag and a «فرق» to write, a topic map's cards an «المحور» to choose. Each is the reader's own
 * — labelled, empty, never filled from the sources — and alike across the map: the same label on every card, a
 * choice's options shared, so cards can be compared and found by it.
 */
export type TemplateId = "semanticField" | "difference" | "axis";
export type Template = { id: TemplateId; kind: FieldKind; cards: NodeKind[] };

const BY_MAP: Partial<Record<GraphKind, Template[]>> = {
  meaning: [
    { id: "semanticField", kind: "tags", cards: ["lemma", "root"] },
    { id: "difference", kind: "notes", cards: ["lemma", "root"] },
  ],
  topic: [{ id: "axis", kind: "select", cards: ["verse", "lemma", "note"] }],
};

export const TEMPLATE_IDS: TemplateId[] = ["semanticField", "difference", "axis"];

export const templatesFor = (map: GraphKind, card: NodeKind): Template[] => (BY_MAP[map] ?? []).filter((t) => t.cards.includes(card));

export const templateOf = (id: TemplateId): Template => Object.values(BY_MAP).flatMap((x) => x ?? []).find((t) => t.id === id)!;
