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
    gloss_en: string | null;
    pattern: string | null;
    pattern_method: PatternMethod | null;
    forms: { form: string; occurrences: number; first: { location: string; verse_key: string; surah_name_ar: string; word: string; left: string; right: string } }[];
  }[];
};

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

/** A lemma's card: the word, its commonest written forms with their counts, and the place it first occurs. */
function lemmaCard(l: RootGraphPayload["lemmas"][number], rootKey: string, focus: boolean): GraphNode {
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
      focus,
    },
  };
}

/**
 * The default root-family graph: the root and each of its words (lemmas), every word card with its commonest
 * written forms and the verse it first occurs in. Its places open on demand. Patterns between them come with the
 * root graph from the full data (P8.2).
 */
export function buildRootGraph(
  g: RootGraphPayload,
  { focusLocation, focus }: { focusLocation?: string; focus?: { lemmaSlug: string } } = {},
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const r = g.root;
  const rid = rootId(r.key);
  nodes.push({
    id: rid,
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "root", ar: r.spaced, sub: r.translit, count: r.occurrences, rootKey: r.key, usul: r.usul ?? null, focus: !!focusLocation || !!focus },
  });
  for (const l of g.lemmas) {
    // the word the reader came from: by a place it first occurs in (?focus=) or by its slug (a seed)
    const on = focus?.lemmaSlug === l.slug || (!!focusLocation && l.forms.some((f) => f.first.location === focusLocation));
    const card = lemmaCard(l, r.key, on);
    nodes.push(card);
    edges.push(link(rid, card.id, "derives"));
  }
  return { nodes, edges };
}
