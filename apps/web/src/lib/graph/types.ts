import type { Edge, Node } from "@xyflow/react";

/**
 * The graph document, version 2 (P8.1a; research 13 §3). Card kinds are the design's, read as Quranic objects
 * (QAN-01): root = جذر, pattern = وزن (the design's "form"), lemma = كلمة (the design's "word"), verse = آية (its
 * "sentence"), note = ملاحظة (its "description": the reader's note, a topic heading, the reader's own phrase), and
 * frame = مجموعة, a group with no meaning of its own. A word as it is written in one place is not a card: its place
 * is data on the verse card and on the link from its lemma.
 */
export type NodeKind = "root" | "pattern" | "lemma" | "verse" | "note" | "frame";

/** A verse on a card: its key only — its words are read from the dataset when the card is drawn (lib/graph/verseText;
 * law L1). The words to mark in it are the card's `places`. */
export type VerseExcerpt = { key: string };

export type GraphNodeData = {
  kind: NodeKind;
  ar?: string; // the Arabic headline: root letters, a pattern, a lemma (never a verse's words)
  sub?: string; // secondary line (transliteration, part of speech, pattern)
  count?: number; // occurrences in the Quran
  rootKey?: string;
  /** how many uṣūl Ibn Fāris gives the root: its words share the letters, not always one meaning (P3.7a) */
  usul?: "one" | "several" | "unrelated" | null;
  /** a lemma's or a pattern's stable slug (P1.3b), the key its id is made from */
  slug?: string;
  /** a lemma: its commonest written forms with their counts, and the place of its first occurrence */
  forms?: { form: string; count: number }[];
  first?: string;
  verse?: VerseExcerpt; // a verse card
  places?: string[]; // a verse card: the words marked in it (`s:a:w`)
  text?: string; // a note: the reader's own text
  phrase?: boolean; // a note that is a phrase the reader analysed (ANA-22)
  title?: string; // a frame
  size?: { w: number; h: number }; // a frame
  folded?: boolean;
  more?: { kind: "verses"; remaining: number }; // places still to extract
  focus?: boolean; // on the path of the word the reader came from
  expanded?: boolean; // a lemma: its places have been opened
  cursor?: string | null; // a lemma: the next page of its places
  /** a reading of the reader's own text the Analyser was unsure of, kept by the reader: shown as such (F4) */
  reading?: { conf: number };
};

/**
 * What a link says (P8.1a, EDT-135, D17). The spine of the lexicon — a root derives patterns and words, a pattern is
 * realised in words, a word is attested in a verse, a verse cites a word — and the relations of topic and meaning
 * maps, each a fact with its own direction or, for meaning, symmetric. `next` is a step of a reading trail.
 */
export type Rel =
  | "derives"
  | "realises"
  | "attests"
  | "cites"
  | "describes"
  | "part-of-topic"
  | "refers-to"
  | "near-in-meaning"
  | "opposite-of"
  | "wujuh-sense"
  | "didd"
  | "field-member"
  | "next";

export type EdgeData = {
  rel: Rel;
  label?: string; // the reader's words on the link: a «فرق», a sense, a step number
  source?: string; // where the relation is stated (a work and its place)
  place?: string; // `attests`: the word's place in the verse
  reading?: boolean; // rests on an uncertain reading (F4)
};

export type GraphNode = Node<GraphNodeData>;
export type GraphEdge = Edge<EdgeData>;

/** A map's type (QAN-11): it chooses the relations a link may take and the palette. A free map takes them all. */
export type GraphKind = "root" | "topic" | "meaning" | "free";

export type GraphDoc = {
  /** the document's version (`doc_version`): 2; version 1 maps are read through lib/graph/migrate */
  version: 2;
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
  pattern: "var(--c-form)",
  lemma: "var(--c-word)",
  verse: "var(--c-sentence)",
  note: "var(--c-desc)",
  frame: "var(--t3)",
};

/** Estimated card sizes for the first layout pass (re-run with measured sizes after render). */
export const KIND_SIZE: Record<NodeKind, { width: number; height: number }> = {
  root: { width: 220, height: 150 },
  pattern: { width: 220, height: 120 },
  lemma: { width: 270, height: 200 },
  verse: { width: 320, height: 150 },
  note: { width: 250, height: 120 },
  frame: { width: 420, height: 280 },
};
