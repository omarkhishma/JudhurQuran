import type { EdgeData, GraphDoc, GraphEdge, GraphKind, GraphNode, GraphNodeData, NodeKind, Rel } from "./types";

/**
 * A map as this app writes it (document version 2), from anything that claims to be one: a share link, an
 * imported file, a copy in IndexedDB (P8.0 F3 and F16, P8.1a). Every field is kept only in its own shape and size;
 * a card of an unknown kind and a link whose ends are not both kept are dropped and counted. A verse keeps its key
 * and the places marked in it and nothing else — its words are always read from the dataset (lib/graph/verseText),
 * so no map can show text of its own as a verse (law L1). A field added to the card or link data must be added
 * here, or it is dropped on the next read. Version-1 maps are read by lib/graph/migrate first.
 */

const KINDS: NodeKind[] = ["root", "pattern", "lemma", "verse", "note", "frame"];
const RELS: Rel[] = ["derives", "realises", "attests", "cites", "describes", "part-of-topic", "refers-to", "near-in-meaning", "opposite-of", "wujuh-sense", "didd", "field-member", "next"];
const GRAPH_KINDS: GraphKind[] = ["root", "topic", "meaning", "free"];
export const VERSE_KEY = /^\d{1,3}:\d{1,3}$/;
export const LOCATION = /^\d{1,3}:\d{1,3}:\d{1,3}$/;
const SLUG = /^[\p{L}\p{N}_.'-]{1,80}$/u;
const MAX_NODES = 2000;
const MAX_EDGES = 6000;

export const str = (x: unknown, max: number): string | undefined => (typeof x === "string" && x.length <= max ? x : undefined);
export const int = (x: unknown, min: number, max: number): number | undefined => (typeof x === "number" && Number.isInteger(x) && x >= min && x <= max ? x : undefined);
const bool = (x: unknown): true | undefined => (x === true ? true : undefined);
export const coord = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(-1e6, Math.min(1e6, x)) : 0);
export const conf = (x: unknown) => (typeof x === "number" && x >= 0 && x <= 1 ? Math.round(x * 100) / 100 : undefined);

function cleanData(raw: unknown): GraphNodeData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const kind = d.kind as NodeKind;
  if (!KINDS.includes(kind)) return null;
  const out: GraphNodeData = { kind };
  const put = <K extends keyof GraphNodeData>(k: K, v: GraphNodeData[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  put("ar", str(d.ar, 600));
  put("sub", str(d.sub, 200));
  put("count", int(d.count, 0, 10_000_000));
  put("rootKey", str(d.rootKey, 12));
  put("usul", d.usul === "one" || d.usul === "several" || d.usul === "unrelated" ? d.usul : undefined);
  put("slug", typeof d.slug === "string" && SLUG.test(d.slug) ? d.slug : undefined);
  if (Array.isArray(d.forms)) {
    const forms = d.forms
      .slice(0, 12)
      .map((f) => f as Record<string, unknown>)
      .filter((f) => str(f?.form, 60) && int(f?.count, 0, 10_000_000) !== undefined)
      .map((f) => ({ form: f.form as string, count: f.count as number }));
    if (forms.length) out.forms = forms;
  }
  put("first", typeof d.first === "string" && LOCATION.test(d.first) ? d.first : undefined);
  const v = d.verse as Record<string, unknown> | undefined;
  if (v && typeof v === "object" && typeof v.key === "string" && VERSE_KEY.test(v.key)) {
    out.verse = { key: v.key };
    // only places in this verse
    const places = Array.isArray(d.places) ? [...new Set(d.places.filter((p): p is string => typeof p === "string" && LOCATION.test(p) && p.startsWith(`${v.key}:`)))].slice(0, 60) : [];
    if (places.length) out.places = places;
  }
  put("text", str(d.text, 20_000));
  put("phrase", bool(d.phrase));
  put("title", str(d.title, 200));
  const size = d.size as Record<string, unknown> | undefined;
  if (size && int(size.w, 40, 20_000) !== undefined && int(size.h, 40, 20_000) !== undefined) out.size = { w: size.w as number, h: size.h as number };
  put("folded", bool(d.folded));
  put("focus", bool(d.focus));
  put("expanded", bool(d.expanded));
  const m = d.more as Record<string, unknown> | undefined;
  if (m && m.kind === "verses") {
    const remaining = int(m.remaining, 0, 10_000_000);
    if (remaining !== undefined) out.more = { kind: "verses", remaining };
  }
  if (d.cursor === null) out.cursor = null;
  else put("cursor", str(d.cursor, 300));
  const r = d.reading as Record<string, unknown> | undefined;
  const c = r ? conf(r.conf) : undefined;
  if (c !== undefined) out.reading = { conf: c };
  return out;
}

function cleanEdgeData(raw: unknown, legacyLabel: unknown): EdgeData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: EdgeData = { rel: RELS.includes(d.rel as Rel) ? (d.rel as Rel) : "next" };
  const label = str(d.label, 200) ?? str(legacyLabel, 200);
  if (label) out.label = label;
  const source = str(d.source, 300);
  if (source) out.source = source;
  if (typeof d.place === "string" && LOCATION.test(d.place)) out.place = d.place;
  if (d.reading === true) out.reading = true;
  return out;
}

export type Cleaned = { nodes: GraphNode[]; edges: GraphEdge[]; skippedNodes: number; skippedEdges: number };

export const edgeKey = (a: string, b: string) => `e:${a}->${b}`;

export function cleanGraph(rawNodes: unknown[], rawEdges: unknown[]): Cleaned {
  const nodes: GraphNode[] = [];
  const ids = new Set<string>();
  let skippedNodes = 0;
  for (const raw of rawNodes) {
    const n = raw as Record<string, unknown> | null;
    const id = n ? str(n.id, 200) : undefined;
    const data = n ? cleanData(n.data) : null;
    if (!n || !id || ids.has(id) || !data || nodes.length >= MAX_NODES) {
      skippedNodes++;
      continue;
    }
    const p = (n.position ?? {}) as Record<string, unknown>;
    ids.add(id);
    nodes.push({ id, type: data.kind === "frame" ? "frame" : "card", position: { x: coord(p.x), y: coord(p.y) }, data });
  }
  const frames = new Set(nodes.filter((n) => n.data.kind === "frame").map((n) => n.id));
  const edges: GraphEdge[] = [];
  const eids = new Set<string>();
  let skippedEdges = 0;
  for (const raw of rawEdges) {
    const e = raw as Record<string, unknown> | null;
    const source = e ? str(e.source, 200) : undefined;
    const target = e ? str(e.target, 200) : undefined;
    // a frame is a group, never the end of a link
    if (!e || !source || !target || source === target || !ids.has(source) || !ids.has(target) || frames.has(source) || frames.has(target) || edges.length >= MAX_EDGES) {
      skippedEdges++;
      continue;
    }
    const id = str(e.id, 400) || edgeKey(source, target);
    if (eids.has(id)) {
      skippedEdges++;
      continue;
    }
    eids.add(id);
    const data = cleanEdgeData(e.data, e.label);
    edges.push({ id, source, target, data, ...(data.label ? { label: data.label } : {}) });
  }
  return { nodes, edges, skippedNodes, skippedEdges };
}

export const cleanTitle = (x: unknown, fallback: string) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 200) : fallback);
export const cleanKind = (x: unknown): GraphKind => (GRAPH_KINDS.includes(x as GraphKind) ? (x as GraphKind) : "free");

/** A stored version-2 map, read through the same rules. */
export function cleanDoc(doc: GraphDoc): GraphDoc {
  const { nodes, edges } = cleanGraph(Array.isArray(doc.nodes) ? doc.nodes : [], Array.isArray(doc.edges) ? doc.edges : []);
  return { ...doc, version: 2, kind: cleanKind(doc.kind), nodes, edges };
}
