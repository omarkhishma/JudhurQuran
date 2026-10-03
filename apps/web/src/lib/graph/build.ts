import type { PatternMethod } from "@/lib/types";
import type { GraphEdge, GraphNode, VerseExcerpt } from "./types";

export type RootGraphPayload = {
  root: { key: string; letters: string[]; spaced: string; translit: string; occurrences: number; verse_count: number; surah_count: number; lemma_count: number };
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
export const lemmaId = (id: number) => `lemma:${id}`;
export const wordId = (lemma: number, form: string) => `word:${lemma}:${form}`;
export const verseId = (location: string) => `verse:${location}`;
export const edgeId = (a: string, b: string) => `e:${a}->${b}`;

export const POS_AR: Record<string, string> = { V: "فعل", N: "اسم", ADJ: "صفة", PN: "علم", IMPN: "اسم فعل" };
const DER_AR: Record<string, string> = { ACT_PCPL: "اسم فاعل", PASS_PCPL: "اسم مفعول", VN: "مصدر" };

export function lemmaSub(l: RootGraphPayload["lemmas"][number]): string {
  const wazn = l.pattern ? `على وزن ${l.pattern}` : l.pattern_method === "verb-form-I" ? "ثلاثي مجرد" : null;
  return [POS_AR[l.pos] ?? l.pos, l.derivation ? DER_AR[l.derivation] : null, wazn]
    .filter(Boolean)
    .join(" · ");
}

function wordNode(lemma: number, f: RootGraphPayload["lemmas"][number]["forms"][number], rootKey: string, focus: boolean): GraphNode {
  const verse: VerseExcerpt = {
    key: f.first.verse_key,
    surahName: f.first.surah_name_ar,
    left: f.first.left,
    word: f.first.word,
    right: f.first.right,
    location: f.first.location,
  };
  return {
    id: wordId(lemma, f.form),
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "word", ar: f.first.word, sub: f.form, count: f.occurrences, rootKey, lemmaId: lemma, form: f.form, verse, focus },
  };
}

/**
 * The default root-family graph: root → every lemma → its most frequent word forms (each card shows the
 * word, its root and the first verse it occurs in). Further forms and every verse open on demand, so the
 * canvas stays readable even for roots with hundreds of occurrences.
 */
export function buildRootGraph(
  g: RootGraphPayload,
  {
    formsPerLemma = 3,
    focusLocation,
    focus,
  }: { formsPerLemma?: number; focusLocation?: string; focus?: { lemmaSlug: string; form?: string | null } } = {},
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const r = g.root;
  const rid = rootId(r.key);
  nodes.push({
    id: rid,
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "root", ar: r.spaced, sub: r.translit, count: r.occurrences, rootKey: r.key, focus: !!focusLocation || !!focus },
  });
  for (const l of g.lemmas) {
    const lid = lemmaId(l.id);
    // the word the reader came from: by its first location (?focus=) or by its lemma and surface form (a seed)
    const onFocusLemma = focus?.lemmaSlug === l.slug;
    const focusForm = focusLocation
      ? l.forms.find((f) => f.first.location === focusLocation)?.form
      : onFocusLemma && focus?.form && l.forms.some((f) => f.form === focus.form)
        ? focus.form
        : undefined;
    const shown = l.forms.slice(0, formsPerLemma);
    if (focusForm && !shown.some((f) => f.form === focusForm)) shown.push(l.forms.find((f) => f.form === focusForm)!);
    nodes.push({
      id: lid,
      type: "card",
      position: { x: 0, y: 0 },
      data: {
        kind: "lemma",
        ar: l.ar,
        sub: lemmaSub(l),
        count: l.occurrences,
        rootKey: r.key,
        lemmaId: l.id,
        more: l.forms.length > shown.length ? { kind: "forms", remaining: l.forms.length - shown.length } : undefined,
        focus: !!focusForm || onFocusLemma,
      },
    });
    edges.push({ id: edgeId(rid, lid), source: rid, target: lid });
    for (const f of shown) {
      const w = wordNode(l.id, f, r.key, f.form === focusForm);
      nodes.push(w);
      edges.push({ id: edgeId(lid, w.id), source: lid, target: w.id });
    }
  }
  return { nodes, edges };
}

/** Remaining word forms of one lemma (expansion of a lemma card). */
export function expandForms(g: RootGraphPayload, lemma: number, present: Set<string>): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const l = g.lemmas.find((x) => x.id === lemma);
  if (!l) return { nodes: [], edges: [] };
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const f of l.forms) {
    const id = wordId(lemma, f.form);
    if (present.has(id)) continue;
    nodes.push(wordNode(lemma, f, g.root.key, false));
    edges.push({ id: edgeId(lemmaId(lemma), id), source: lemmaId(lemma), target: id });
  }
  return { nodes, edges };
}
