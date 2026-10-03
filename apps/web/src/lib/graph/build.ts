import type { PatternMethod } from "@/lib/types";
import type { EdgeData, GraphEdge, GraphNode, Rel } from "./types";

export type RootGraphPayload = {
  root: { key: string; letters: string[]; spaced: string; translit: string; occurrences: number; verse_count: number; surah_count: number; lemma_count: number; usul?: "one" | "several" | "unrelated" | null };
  lemmas: {
    id: number;
    slug: string;
    ar: string;
    pos: string;
    verb_form: number | null;
    derivation: string | null;
    occurrences: number;
    verse_count?: number;
    gloss_en: string | null;
    pattern: string | null;
    pattern_method: PatternMethod | null;
    /** the pattern it is on, one of `patterns` (P8.2) */
    pattern_slug?: string | null;
    forms: { form: string; occurrences: number; first: { location: string; verse_key: string; surah_name_ar: string; word: string; left: string; right: string } }[];
  }[];
  /** the patterns between the root and its words, each with the root's words on it, the most used first (P8.2) */
  patterns?: { slug: string; ar: { full: string; translit: string }; form_number: number | null; function_ar: string | null; function_en: string | null; lemmas: string[]; occurrences: number }[];
};
export type PatternRow = NonNullable<RootGraphPayload["patterns"]>[number];

export const rootId = (key: string) => `root:${key}`;
export const patternId = (slug: string) => `pattern:${slug}`;
export const lemmaId = (slug: string) => `lemma:${slug}`;
/** one card per verse, whatever brought it (F5): `verse:2:255` */
export const verseId = (key: string) => `verse:${key}`;
export const edgeId = (a: string, b: string) => `e:${a}->${b}`;
/** a link with what it says (P8.1a) */
export const link = (source: string, target: string, rel: Rel, extra: Omit<EdgeData, "rel"> = {}): GraphEdge => ({
  id: edgeId(source, target),
  source,
  target,
  data: { rel, ...extra },
  ...(extra.label ? { label: extra.label } : {}),
});

export const POS_AR: Record<string, string> = { V: "فعل", N: "اسم", ADJ: "صفة", PN: "علم", IMPN: "اسم فعل" };
const DER_AR: Record<string, string> = { ACT_PCPL: "اسم فاعل", PASS_PCPL: "اسم مفعول", VN: "مصدر" };

export function lemmaSub(l: RootGraphPayload["lemmas"][number]): string {
  const wazn = l.pattern ? `على وزن ${l.pattern}` : l.pattern_method === "verb-form-I" ? "ثلاثي مجرد" : null;
  return [POS_AR[l.pos] ?? l.pos, l.derivation ? DER_AR[l.derivation] : null, wazn]
    .filter(Boolean)
    .join(" • ");
}

/** The earlier of two places, in mushaf order. */
export function firstPlace(a: string | undefined, b: string | undefined): string | undefined {
  if (!a || !b) return a ?? b;
  const [p, q] = [a, b].map((x) => x.split(":").map(Number));
  return (p[0] - q[0] || p[1] - q[1] || p[2] - q[2]) <= 0 ? a : b;
}

/** A lemma's card: the word, its commonest written forms with their counts, and the place it first occurs. A word's
 * card in a root's family starts folded unless it is the word the reader came from (the design's startFolded,
 * EDT-004): the family reads at a glance, and a card opens to its forms and first verse. */
export function lemmaCard(l: RootGraphPayload["lemmas"][number], rootKey: string, focus: boolean): GraphNode {
  return {
    id: lemmaId(l.slug),
    type: "card",
    position: { x: 0, y: 0 },
    data: {
      kind: "lemma",
      slug: l.slug,
      ar: l.ar,
      sub: lemmaSub(l),
      count: l.occurrences,
      rootKey,
      forms: l.forms.slice(0, 3).map((f) => ({ form: f.form, count: f.occurrences })),
      first: l.forms.reduce<string | undefined>((m, f) => firstPlace(m, f.first.location), undefined),
      ...(l.verse_count != null ? { totals: { verses: l.verse_count } } : {}),
      focus,
      ...(focus ? {} : { folded: true as const }),
    },
  };
}

/** A pattern's card in a root's family: the pattern, its transliteration, its words in this root and their count. */
export function patternCard(p: PatternRow, focus: boolean): GraphNode {
  return {
    id: patternId(p.slug),
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "pattern", slug: p.slug, ar: p.ar.full, sub: p.ar.translit, count: p.occurrences, totals: { words: p.lemmas.length }, focus, ...(focus ? {} : { folded: true as const }) },
  };
}

/** A root's card, with what the dataset holds below it (EDT-091). */
export function rootCard(g: RootGraphPayload, focus: boolean): GraphNode {
  const r = g.root;
  return {
    id: rootId(r.key),
    type: "card",
    position: { x: 0, y: 0 },
    // what it extracts: its patterns and its words on none (EDT-091's "forms"), and all its words
    data: { kind: "root", ar: r.spaced, sub: r.translit, count: r.occurrences, rootKey: r.key, usul: r.usul ?? null, totals: { patterns: (g.patterns?.length ?? 0) + g.lemmas.filter((l) => !l.pattern_slug).length, words: g.lemmas.length }, focus },
  };
}

/**
 * The default root-family graph from the full data (P8.2, QAN-04): the root, the patterns its words are on, and
 * each word under its pattern — a word on no pattern straight under the root — every word card with its commonest
 * written forms and the verse it first occurs in. The cards on the path to the word the reader came from start open;
 * the rest folded. A word's verses open on demand.
 */
export function buildRootGraph(
  g: RootGraphPayload,
  { focusLocation, focus }: { focusLocation?: string; focus?: { lemmaSlug: string } } = {},
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const rid = rootId(g.root.key);
  nodes.push(rootCard(g, !!focusLocation || !!focus));
  // the word the reader came from: by a place it first occurs in (?focus=) or by its slug (a seed)
  const isFocus = (l: RootGraphPayload["lemmas"][number]) => focus?.lemmaSlug === l.slug || (!!focusLocation && l.forms.some((f) => f.first.location === focusLocation));
  const patterns = new Map((g.patterns ?? []).map((p) => [p.slug, p]));
  for (const p of g.patterns ?? []) {
    const on = g.lemmas.some((l) => l.pattern_slug === p.slug && isFocus(l));
    nodes.push(patternCard(p, on));
    edges.push(link(rid, patternId(p.slug), "derives"));
  }
  for (const l of g.lemmas) {
    const card = lemmaCard(l, g.root.key, isFocus(l));
    nodes.push(card);
    const p = l.pattern_slug && patterns.get(l.pattern_slug);
    edges.push(p ? link(patternId(p.slug), card.id, "realises") : link(rid, card.id, "derives"));
  }
  return { nodes, edges };
}
