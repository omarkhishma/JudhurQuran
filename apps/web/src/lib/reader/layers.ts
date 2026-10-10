import type { TermId } from "@/lib/terms";

/**
 * The layers of a word's meaning (PLAN P15, D30), in the order the panel shows them: the meaning in its context first,
 * then the dictionaries', the word's place among the Quran's meanings, what its form adds and its role in its
 * sentence; then the readers' difference and the spelling. Each layer is filled only from cited sources or the
 * administration's and the board's attributed work (L2). A later layer is one entry here and one component.
 */
export type LayerId = "contextual" | "lexical" | "semantic" | "morphological" | "grammatical" | "readings";

export const MEANING_LAYERS: { id: LayerId; label: string; term: TermId | null; open: boolean }[] = [
  { id: "contextual", label: "layerContextual", term: "layerContextual", open: true },
  { id: "lexical", label: "layerLexical", term: "layerLexical", open: true },
  { id: "semantic", label: "layerSemantic", term: "layerSemantic", open: true },
  { id: "morphological", label: "layerMorphological", term: "layerMorphological", open: false },
  { id: "grammatical", label: "layerGrammatical", term: "layerGrammatical", open: true },
  { id: "readings", label: "layerReadings", term: null, open: false },
];
