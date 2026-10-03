import { formatNumber } from "@/lib/format";
import { link, rootId, verseId } from "./build";
import type { Added, RootRow, VerseWord } from "./extract";
import type { GraphEdge, GraphNode } from "./types";

/**
 * Meaning maps (P8.4, research 15): the classical books' own relations between roots — al-ʿAskarī's «الفرق بين…», a
 * wujūh book naming a sense by another word — drawn as near-in-meaning links that carry the relation's id and its
 * book, so a link's panel quotes the book from the dataset (never a copy kept in the map). A relation the editorial
 * board has reviewed is the map's own; one only extracted can be put on the map by the reader as their link, and
 * stays marked as not reviewed. A pair's shared verses come in as verse cards, each of both roots' places marked.
 */

export type RelationSourceRow = {
  id: string;
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  death_hijri: number | null;
  death_ce: number | null;
  locator: string;
  page_vol: number | null;
  page: number | null;
};
export type RelationEdge = {
  id: string;
  type: "furuq_contrast" | "near_synonym_candidate" | "wujuh_sense" | "didd" | "field_member";
  rel: "near-in-meaning" | "wujuh-sense" | "didd" | "field-member";
  a: { root: string | null; word: string };
  b: { root: string | null; word: string | null } | null;
  sense: string | null;
  quote: string;
  verses: string[];
  source: RelationSourceRow;
  review: { verdict: "reviewed" | "corrected"; note: string | null; correction: string | null; approved_at: string | null } | null;
  status?: "in_force" | "extracted";
  /** a field's member (P8.4c): the chapter that names the word */
  field?: { id: string; title: string; section: string | null };
};
export type RootRelations = { root: string; data: RelationEdge[]; waiting: number; extracted: RelationEdge[]; extracted_total: number; fields_extracted: RelationEdge[]; fields_extracted_total: number };
export type Among = { data: RelationEdge[]; shared: Record<string, { count: number; verses: string[] }> };

/** A pair of roots as the API keys their shared verses: the two keys in order, joined. */
export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** The roots of a relation's two ends, when it has two and they differ. */
export const endsOf = (e: RelationEdge): [string, string] | null => (e.b?.root && e.a.root && e.a.root !== e.b.root ? [e.a.root, e.b.root] : null);

/** The book a relation comes from, in a line, as the reader's word panel cites these books: its author with his death
 * year, its title, and its volume and page. */
export function bookOf(e: RelationEdge, locale: string): string {
  const s = e.source;
  const died = s.death_hijri ? (locale === "ar" ? ` (ت ${formatNumber(s.death_hijri, locale)}هـ)` : ` (d. ${s.death_ce ?? ""})`) : "";
  const at = s.page ? (locale === "ar" ? `، ج${formatNumber(s.page_vol ?? 1, locale)} ص${formatNumber(s.page, locale)}` : `, vol. ${s.page_vol ?? 1}, p. ${s.page}`) : "";
  return locale === "ar" ? `${s.author_ar.split("،")[0]}${died}، ${s.title_ar}${at}` : `${s.author_en}${died}, ${s.title_en}${at}`;
}

const linked = (edges: GraphEdge[], a: string, b: string) => edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** A relation as a link between its two roots' cards: the sense it names, its book, its id, and whether the board
 * reviewed it. */
export function relationLink(e: RelationEdge, reviewed: boolean, locale: string): GraphEdge | null {
  const ends = endsOf(e);
  if (!ends) return null;
  return link(rootId(ends[0]), rootId(ends[1]), "near-in-meaning", { ...(e.sense ? { label: e.sense } : {}), source: bookOf(e, locale), relation: e.id, reviewed });
}

/** A root card as a meaning map adds it: folded, its letters, its count. */
export function rootCardOf(key: string, r: RootRow | undefined): GraphNode {
  return { id: rootId(key), type: "card", position: { x: 0, y: 0 }, data: { kind: "root", ar: r?.spaced ?? [...key].join(" "), sub: r?.translit, count: r?.occurrences, rootKey: key, folded: true } };
}

/** The roots a root is related to by relations in force: each other root's card, and one link per pair (EDT-112's
 * extraction, for meaning). A pair already linked on the map is left as it is. */
export function fromRelations(root: string, rel: RootRelations, rows: Map<string, RootRow>, nodes: GraphNode[], edges: GraphEdge[], locale: string): Added {
  const on = new Set(nodes.map((n) => n.id));
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  for (const e of rel.data) {
    const ends = endsOf(e);
    if (!ends || !ends.includes(root)) continue;
    const other = ends[0] === root ? ends[1] : ends[0];
    const id = rootId(other);
    if (!on.has(id)) {
      on.add(id);
      out.nodes.push(rootCardOf(other, rows.get(other)));
      out.count++;
    }
    if (!linked([...edges, ...out.edges], rootId(root), id)) {
      const l = relationLink(e, true, locale);
      if (l) out.edges.push(l);
    }
  }
  return out;
}

/** A pair's shared verses as verse cards linked from both roots, every place of either root marked in each. */
export function fromShared(a: string, b: string, verses: { key: string; words: VerseWord[] }[], nodes: GraphNode[], edges: GraphEdge[]): Added {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Added = { nodes: [], edges: [], marks: new Map(), count: 0 };
  for (const v of verses) {
    const id = verseId(v.key);
    const places = v.words.filter((w) => w.root === a || w.root === b).map((w) => w.location);
    const had = byId.get(id);
    if (!had) {
      out.nodes.push({ id, type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: v.key }, places, folded: true } });
      out.count++;
    } else {
      const now = new Set(had.data.places ?? []);
      const more = places.filter((p) => !now.has(p));
      if (more.length) out.marks.set(id, [...(had.data.places ?? []), ...more]);
    }
    for (const r of [a, b]) {
      const first = v.words.find((w) => w.root === r)?.location;
      if (!linked([...edges, ...out.edges], rootId(r), id)) out.edges.push(link(rootId(r), id, "attests", first ? { place: first } : {}));
    }
  }
  return out;
}

/** A field as a map card: one note per chapter, shared by every member put on the map, so the field gathers them. */
export const fieldCardId = (e: RelationEdge) => (e.field ? `field:${e.field.id}` : null);

/** The field's card and the member's link to it (P8.4c): the field named as its chapter names it, with its book. */
export function fieldMember(e: RelationEdge, from: string, reviewed: boolean, locale: string): { card: GraphNode; edge: GraphEdge } | null {
  const id = fieldCardId(e);
  if (!id || !e.field) return null;
  const card: GraphNode = { id, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: `${e.sense ?? e.field.title}\n${bookOf(e, locale)}` } };
  return { card, edge: link(from, id, "field-member", { source: bookOf(e, locale), relation: e.id, reviewed }) };
}
