import ELK from "elkjs/lib/elk.bundled.js";
import { stratify, tree as d3tree } from "d3-hierarchy";
import { KIND_SIZE, type GraphEdge, type GraphNode } from "./types";

const elk = new ELK();

/**
 * Layered auto-layout. The flow runs right → left so the root sits at the right edge, as Arabic
 * reads; the design's spacing — 156 px between columns, 56 between cards (QAN-24) — so cards never crowd (the brief
 * asks for "clear space between elements"); measured heights, so a long verse never overlaps the next.
 */
export async function layout(nodes: GraphNode[], edges: GraphEdge[]): Promise<GraphNode[]> {
  const visible = new Set(nodes.map((n) => n.id));
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "LEFT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "156",
      "elk.spacing.nodeNode": "56",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.measured?.width ?? KIND_SIZE[n.data.kind].width,
      height: n.measured?.height ?? KIND_SIZE[n.data.kind].height,
    })),
    edges: edges
      .filter((e) => visible.has(e.source) && visible.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const out = await elk.layout(graph);
  // on the 8 px grid, as every move is (HWF-12)
  const pos = new Map((out.children ?? []).map((c) => [c.id, { x: Math.round((c.x ?? 0) / 8) * 8, y: Math.round((c.y ?? 0) / 8) * 8 }]));
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }));
}

/**
 * A mind map's layout (P16.4, PV-17): the map's root card — or, without one, its most linked card — at the centre,
 * every other card on rings around it by its distance in links (the shortest), the cards of one branch side by side;
 * cards no link reaches go on the outer ring. Rings are far enough apart for the widest card, and the outer one long
 * enough for every card on it, so cards never overlap. Laid out with d3-hierarchy's tree in polar coordinates.
 */
export function radialLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  if (nodes.length < 2) return nodes;
  const ids = new Set(nodes.map((n) => n.id));
  const nbr = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    nbr.get(e.source)!.push(e.target);
    nbr.get(e.target)!.push(e.source);
  }
  const degree = (id: string) => nbr.get(id)!.length;
  const center = nodes.find((n) => n.data.kind === "root")?.id ?? [...nodes].sort((a, b) => degree(b.id) - degree(a.id))[0].id;
  // a spanning tree by breadth: each card under the first card that reaches it, in the map's own order
  const parent = new Map<string, string | null>([[center, null]]);
  const queue = [center];
  while (queue.length) {
    const id = queue.shift()!;
    for (const m of nbr.get(id)!) {
      if (parent.has(m)) continue;
      parent.set(m, id);
      queue.push(m);
    }
  }
  for (const n of nodes) if (!parent.has(n.id)) parent.set(n.id, center);
  const tree = stratify<GraphNode>()
    .id((n) => n.id)
    .parentId((n) => parent.get(n.id) ?? undefined)(nodes);
  const size = (n: GraphNode) => ({ w: n.measured?.width ?? KIND_SIZE[n.data.kind].width, h: n.measured?.height ?? KIND_SIZE[n.data.kind].height });
  // a card is kept clear of its neighbours by its diagonal: whatever angle it stands at on its ring
  const clear = Math.max(...nodes.map((n) => Math.hypot(size(n).w, size(n).h))) + 32;
  const laid = d3tree<GraphNode>().size([2 * Math.PI, 1]).separation((a, b) => (a.parent === b.parent ? 1 : 1.4))(tree);
  const byDepth = new Map<number, number[]>();
  for (const d of laid.descendants()) if (d.depth) byDepth.set(d.depth, [...(byDepth.get(d.depth) ?? []), d.x]);
  // each ring far enough out that the two closest cards on it are a diagonal apart (their chord), and a diagonal
  // beyond the ring inside it
  const radius = new Map<number, number>([[0, 0]]);
  for (let k = 1; k <= tree.height; k++) {
    const angles = (byDepth.get(k) ?? []).sort((a, b) => a - b);
    let gap = 2 * Math.PI;
    for (let i = 0; i < angles.length; i++) gap = Math.min(gap, ((angles[(i + 1) % angles.length] - angles[i] + 2 * Math.PI) % (2 * Math.PI)) || 2 * Math.PI);
    const chord = angles.length > 1 ? clear / (2 * Math.sin(Math.min(Math.PI / 2, gap / 2))) : 0;
    radius.set(k, Math.max(radius.get(k - 1)! + clear, chord));
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const d of laid.descendants()) {
    const s = size(d.data);
    const r = radius.get(d.depth)!;
    const x = r * Math.cos(d.x - Math.PI / 2) - s.w / 2;
    const y = r * Math.sin(d.x - Math.PI / 2) - s.h / 2;
    pos.set(d.data.id, { x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8 });
  }
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }));
}
