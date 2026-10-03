import ELK from "elkjs/lib/elk.bundled.js";
import { KIND_SIZE, type GraphEdge, type GraphNode } from "./types";

const elk = new ELK();

/**
 * Layered auto-layout. The flow runs right → left so the root sits at the right edge, as Arabic
 * reads; spacing is generous so cards never crowd (the brief asks for "clear space between elements").
 */
export async function layout(nodes: GraphNode[], edges: GraphEdge[]): Promise<GraphNode[]> {
  const visible = new Set(nodes.map((n) => n.id));
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "LEFT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      "elk.spacing.nodeNode": "36",
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
