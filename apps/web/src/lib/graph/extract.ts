import { lemmaCard, lemmaId, link, patternCard, patternId, POS_AR, rootId, verseId, type RootGraphPayload } from "./build";
import type { GraphEdge, GraphNode } from "./types";

/**
 * What a card extracts from the dataset (P8.2; EDT-111…123, QAN-04, QAN-06, QAN-07, QAN-08): a root its patterns, a
 * pattern its words in that root, a word its verses a page at a time, a verse the words it holds and their roots.
 * Pure: given the map and what the API returned, the cards and links to add — never a card already on the map, never
 * a link twice — and the places newly marked on verses already there.
 */

export type Added = { nodes: GraphNode[]; edges: GraphEdge[]; marks: Map<string, string[]>; count: number };

/** What a reader asks of an extraction: a word's verses within a sūra or a written form; a verse's words, roots or
 * both, with or without its particles. */
export type ExtractOptions = { surah?: number; form?: string; mode?: "words" | "roots" | "both"; particles?: boolean };

const has = (edges: GraphEdge[], a: string, b: string) => edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** A root's patterns not yet on the map, and any word of it on no pattern (EDT-111, EDT-123). */
export function fromRoot(g: RootGraphPayload, nodes: GraphNode[], edges: GraphEdge[]): Added {
  const on = new Set(nodes.map((n) => n.id));
  const rid = rootId(g.root.key);
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  for (const p of g.patterns ?? []) {
    const id = patternId(p.slug);
    if (on.has(id)) {
      if (!has(edges, rid, id)) out.edges.push(link(rid, id, "derives"));
      continue;
    }
    out.nodes.push(patternCard(p, false));
    out.edges.push(link(rid, id, "derives"));
    out.count++;
  }
  for (const l of g.lemmas.filter((x) => !x.pattern_slug)) {
    const id = lemmaId(l.slug);
    if (on.has(id)) continue;
    out.nodes.push(lemmaCard(l, g.root.key, false));
    out.edges.push(link(rid, id, "derives"));
    out.count++;
  }
  return out;
}

/** What a root has left to extract: its patterns, and its words on none, not yet on the map. */
export const leftInRoot = (g: RootGraphPayload, nodes: GraphNode[]) => {
  const on = new Set(nodes.map((n) => n.id));
  return (g.patterns ?? []).filter((p) => !on.has(patternId(p.slug))).length + g.lemmas.filter((l) => !l.pattern_slug && !on.has(lemmaId(l.slug))).length;
};

/** A pattern's words, in the roots it hangs from on this map, not yet on it (EDT-112). */
export function fromPattern(slug: string, roots: RootGraphPayload[], nodes: GraphNode[], edges: GraphEdge[]): Added {
  const on = new Set(nodes.map((n) => n.id));
  const pid = patternId(slug);
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  for (const g of roots)
    for (const l of g.lemmas.filter((x) => x.pattern_slug === slug)) {
      const id = lemmaId(l.slug);
      if (on.has(id)) {
        if (!has(edges, pid, id)) out.edges.push(link(pid, id, "realises"));
        continue;
      }
      on.add(id);
      out.nodes.push(lemmaCard(l, g.root.key, false));
      out.edges.push(link(pid, id, "realises"));
      out.count++;
    }
  return out;
}

export type VersePage = { total: number; next_cursor: string | null; data: { verse_key: string; locations: string[]; cursor?: string }[] };

/** A page of a word's verses: one card per verse, folded, every place of the word marked in it, linked at its first
 * place; a verse already on the map marks the places too (F5, EDT-113, QAN-06). */
export function fromVerses(wordId: string, page: VersePage, nodes: GraphNode[], edges: GraphEdge[]): Added {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  for (const v of page.data) {
    const id = verseId(v.verse_key);
    const had = byId.get(id);
    if (!had) {
      out.nodes.push({ id, type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: v.verse_key }, places: [...v.locations], folded: true } });
      out.count++;
    } else {
      const now = new Set(had.data.places ?? []);
      const more = v.locations.filter((l) => !now.has(l));
      if (more.length) out.marks.set(id, [...(had.data.places ?? []), ...more]);
    }
    if (!has([...edges, ...out.edges], wordId, id)) out.edges.push(link(wordId, id, "attests", { place: v.locations[0] }));
  }
  return out;
}

/** The verses of a word on the map: those it is linked to. */
export const versesOf = (wordId: string, edges: GraphEdge[]) => new Set(edges.filter((e) => e.source === wordId && e.data?.rel === "attests").map((e) => e.target));

/** A verse's word as `/verses/{key}` gives it. */
export type VerseWord = { location: string; lemma_slug?: string | null; lemma: string | null; root: string | null; pos: string; text_uthmani: string };

/**
 * What a verse can still link (EDT-115…118, EDT-123, QAN-07, QAN-08): its words not on the map or not linked to it —
 * one per word, at its first place — and the distinct roots of its words not tied to it either way. A particle has no
 * root: left out unless asked for, and then a word card with no root, never a pseudo-root.
 */
export function versePlan(verseCardId: string, words: VerseWord[], edges: GraphEdge[], particles: boolean): { words: VerseWord[]; roots: string[] } {
  const seen = new Set<string>();
  const cited = words.filter((w) => w.lemma_slug && (particles || w.root) && !seen.has(w.lemma_slug) && seen.add(w.lemma_slug));
  const linkedWords = cited.filter((w) => !has(edges, lemmaId(w.lemma_slug!), verseCardId));
  const roots = [...new Set(cited.flatMap((w) => (w.root ? [w.root] : [])))].filter((r) => !has(edges, rootId(r), verseCardId));
  return { words: linkedWords, roots };
}

export type RootRow = { key: string; spaced: string; translit: string; occurrences: number };

/** The verse's words and/or roots on the map and linked to it, the words' places marked on it (EDT-117). */
export function linkVerse(verseCardId: string, verse: VerseWord[], plan: { words: VerseWord[]; roots: string[] }, mode: "words" | "roots" | "both", roots: Map<string, RootRow>, nodes: GraphNode[], edges: GraphEdge[]): Added {
  const on = new Set(nodes.map((n) => n.id));
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  const all = () => [...edges, ...out.edges];
  const addRoot = (key: string) => {
    const id = rootId(key);
    if (on.has(id)) return id;
    const r = roots.get(key);
    on.add(id);
    out.nodes.push({ id, type: "card", position: { x: 0, y: 0 }, data: { kind: "root", ar: r?.spaced ?? key.split("").join(" "), sub: r?.translit, count: r?.occurrences, rootKey: key, folded: true } });
    return id;
  };
  const places: string[] = [];
  if (mode !== "roots")
    for (const w of plan.words) {
      const id = lemmaId(w.lemma_slug!);
      if (!on.has(id)) {
        on.add(id);
        out.nodes.push({ id, type: "card", position: { x: 0, y: 0 }, data: { kind: "lemma", slug: w.lemma_slug!, ar: w.lemma ?? w.text_uthmani, sub: POS_AR[w.pos] ?? w.pos, ...(w.root ? { rootKey: w.root } : {}), first: w.location, folded: true } });
      }
      if (!has(all(), id, verseCardId)) {
        out.edges.push(link(id, verseCardId, "attests", { place: w.location }));
        out.count++;
      }
      // every place the word takes in the verse is marked, not only the first
      places.push(...verse.filter((x) => x.lemma_slug === w.lemma_slug).map((x) => x.location));
      if (mode === "both" && w.root) {
        const rid = addRoot(w.root);
        if (!has(all(), rid, id)) out.edges.push(link(rid, id, "derives"));
      }
    }
  if (mode === "roots")
    for (const key of plan.roots) {
      const rid = addRoot(key);
      if (!has(all(), rid, verseCardId)) {
        out.edges.push(link(rid, verseCardId, "attests"));
        out.count++;
      }
    }
  if (places.length) {
    const v = nodes.find((n) => n.id === verseCardId);
    const now = v?.data.places ?? [];
    const next = [...now, ...places.filter((p) => !now.includes(p))];
    if (next.length !== now.length) out.marks.set(verseCardId, next);
  }
  return out;
}
