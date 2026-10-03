import { edgeId } from "./build";
import type { GraphDoc, GraphEdge, GraphKind, GraphNode, GraphNodeData, NodeKind } from "./types";

/**
 * A map as this app writes it, from anything that claims to be one: a share link, an imported file, a copy in
 * IndexedDB written by an older version (P8.0, research 13 F3 and F16). Every field is kept only in its own
 * shape and size; a card of an unknown kind and a wire whose ends are not both kept are dropped and counted. A
 * verse keeps its key and the word's place and nothing else — its words are always read from the dataset
 * (lib/graph/verseText), so no map can show text of its own as a verse (law L1). A field added to the card data
 * must be added here, or it is dropped on the next read.
 */

const KINDS: NodeKind[] = ["root", "lemma", "word", "verse", "note"];
const GRAPH_KINDS: GraphKind[] = ["root", "topic", "meaning", "free"];
const VERSE_KEY = /^\d{1,3}:\d{1,3}$/;
const LOCATION = /^\d{1,3}:\d{1,3}:\d{1,3}$/;
const MAX_NODES = 2000;
const MAX_EDGES = 6000;

const str = (x: unknown, max: number): string | undefined => (typeof x === "string" && x.length <= max ? x : undefined);
const int = (x: unknown, min: number, max: number): number | undefined => (typeof x === "number" && Number.isInteger(x) && x >= min && x <= max ? x : undefined);
const bool = (x: unknown): true | undefined => (x === true ? true : undefined);
const coord = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(-1e6, Math.min(1e6, x)) : 0);

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
  put("lemmaId", int(d.lemmaId, 0, 10_000_000));
  put("form", str(d.form, 80));
  const v = d.verse as Record<string, unknown> | undefined;
  if (v && typeof v === "object" && typeof v.key === "string" && VERSE_KEY.test(v.key)) {
    const location = typeof v.location === "string" && LOCATION.test(v.location) && v.location.startsWith(`${v.key}:`) ? v.location : undefined;
    out.verse = location ? { key: v.key, location } : { key: v.key };
  }
  put("text", str(d.text, 20_000));
  put("folded", bool(d.folded));
  put("focus", bool(d.focus));
  put("expanded", bool(d.expanded));
  const m = d.more as Record<string, unknown> | undefined;
  if (m && (m.kind === "forms" || m.kind === "verses")) {
    const remaining = int(m.remaining, 0, 10_000_000);
    if (remaining !== undefined) out.more = { kind: m.kind, remaining };
  }
  if (d.cursor === null) out.cursor = null;
  else put("cursor", str(d.cursor, 300));
  const r = d.reading as Record<string, unknown> | undefined;
  if (r && typeof r.conf === "number" && r.conf >= 0 && r.conf <= 1) out.reading = { conf: Math.round(r.conf * 100) / 100 };
  return out;
}

export type Cleaned = { nodes: GraphNode[]; edges: GraphEdge[]; skippedNodes: number; skippedEdges: number };

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
    nodes.push({ id, type: "card", position: { x: coord(p.x), y: coord(p.y) }, data });
  }
  const edges: GraphEdge[] = [];
  const eids = new Set<string>();
  let skippedEdges = 0;
  for (const raw of rawEdges) {
    const e = raw as Record<string, unknown> | null;
    const source = e ? str(e.source, 200) : undefined;
    const target = e ? str(e.target, 200) : undefined;
    if (!e || !source || !target || !ids.has(source) || !ids.has(target) || edges.length >= MAX_EDGES) {
      skippedEdges++;
      continue;
    }
    const id = str(e.id, 400) || edgeId(source, target);
    if (eids.has(id)) {
      skippedEdges++;
      continue;
    }
    eids.add(id);
    const data = (e.data ?? {}) as Record<string, unknown>;
    const label = str(data.label, 200) ?? str(e.label, 200);
    const reading = data.reading === true;
    edges.push({ id, source, target, ...(label || reading ? { data: { ...(label ? { label } : {}), ...(reading ? { reading } : {}) } } : {}), ...(label ? { label } : {}) });
  }
  return { nodes, edges, skippedNodes, skippedEdges };
}

export const cleanTitle = (x: unknown, fallback: string) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 200) : fallback);
export const cleanKind = (x: unknown): GraphKind => (GRAPH_KINDS.includes(x as GraphKind) ? (x as GraphKind) : "free");

/** A stored map, read through the same rules (an older version kept each verse's words in the map). */
export function cleanDoc(doc: GraphDoc): GraphDoc {
  const { nodes, edges } = cleanGraph(Array.isArray(doc.nodes) ? doc.nodes : [], Array.isArray(doc.edges) ? doc.edges : []);
  return { ...doc, kind: cleanKind(doc.kind), nodes, edges };
}
