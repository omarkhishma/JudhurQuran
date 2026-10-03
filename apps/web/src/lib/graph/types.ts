import type { Edge, Node } from "@xyflow/react";

/** The five card kinds of the handoff, mapped to Quranic data. Colour is the type. */
export type NodeKind = "root" | "lemma" | "word" | "verse" | "note";

export type VerseExcerpt = { key: string; surahName: string; left: string; word: string; right: string; location?: string };

export type GraphNodeData = {
  kind: NodeKind;
  ar?: string; // the Arabic headline of the card
  sub?: string; // secondary line (transliteration, pattern, label)
  count?: number; // occurrences in the Quran
  rootKey?: string;
  lemmaId?: number;
  form?: string; // imlaei surface form (word cards)
  verse?: VerseExcerpt; // word cards: first occurrence · verse cards: the occurrence
  text?: string; // note cards: free text written by the user
  folded?: boolean;
  more?: { kind: "forms" | "verses"; remaining: number }; // expansion still available
  focus?: boolean; // on the path of the word the user came from
  expanded?: boolean; // word card: its verses have been opened
  cursor?: string | null; // word card: next page of verses
};

export type GraphNode = Node<GraphNodeData>;
export type GraphEdge = Edge<{ label?: string }>;

export type GraphKind = "root" | "topic" | "meaning" | "free";

export type GraphDoc = {
  version: 1;
  id: string;
  title: string;
  kind: GraphKind;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: number;
  updatedAt: number;
  /** Made from a seed and not yet opened: the editor lays it out once with the cards' measured sizes. */
  pendingLayout?: boolean;
};

export type GraphMeta = Pick<GraphDoc, "id" | "title" | "kind" | "createdAt" | "updatedAt"> & { nodeCount: number };

export const KIND_COLOR: Record<NodeKind, string> = {
  root: "var(--c-root)",
  lemma: "var(--c-form)",
  word: "var(--c-word)",
  verse: "var(--c-sentence)",
  note: "var(--c-desc)",
};

/** Estimated card sizes for the first layout pass (re-run with measured sizes after render). */
export const KIND_SIZE: Record<NodeKind, { width: number; height: number }> = {
  root: { width: 220, height: 150 },
  lemma: { width: 230, height: 120 },
  word: { width: 270, height: 178 },
  verse: { width: 320, height: 150 },
  note: { width: 250, height: 120 },
};
