"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { expandForms, type RootGraphPayload, verseId, edgeId } from "@/lib/graph/build";
import { layout } from "@/lib/graph/layout";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";
import { useTheme } from "@/lib/client";
import { CardNode, GraphActionsContext, type GraphActions } from "./CardNode";

type Snapshot = { label: string; nodes: GraphNode[]; edges: GraphEdge[] };

const nodeTypes = { card: CardNode };

export type GraphCanvasProps = {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  payload?: RootGraphPayload; // root-graph data for on-demand expansion
  editable?: boolean;
  autoLayout?: boolean;
  title: string;
  onTitleChange?: (t: string) => void;
  onChange?: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  toolbarExtra?: React.ReactNode;
  status?: React.ReactNode;
  fileName?: string;
  /** Lets an editor add cards from outside the canvas (palette). */
  registerAdd?: (add: (nodes: GraphNode[], edges: GraphEdge[], label: string) => void) => void;
};

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  initialNodes,
  initialEdges,
  payload,
  editable = false,
  autoLayout = false,
  title,
  onTitleChange,
  onChange,
  toolbarExtra,
  status,
  fileName = "judhur-map",
  registerAdd,
}: GraphCanvasProps) {
  const t = useTranslations("graph");
  const theme = useTheme();
  const rf = useReactFlow<GraphNode, GraphEdge>();
  const initialized = useNodesInitialized();
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const laidOut = useRef(!autoLayout);
  const wrapper = useRef<HTMLDivElement>(null);

  // Notify the owner (autosave) whenever the document changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(nodes, edges);
  }, [nodes, edges]);

  /** Every mutation goes through commit(label, …) so undo carries a human-readable label (handoff §4.3). */
  const commit = useCallback(
    (label: string, nextNodes: GraphNode[], nextEdges: GraphEdge[]) => {
      setPast((p) => [...p.slice(-80), { label, nodes, edges }]);
      setFuture([]);
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [nodes, edges],
  );

  const tidy = useCallback(
    async (label = t("tidy"), base?: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
      const src = base ?? { nodes: rf.getNodes(), edges: rf.getEdges() };
      const laid = await layout(src.nodes, src.edges);
      commit(label, laid, src.edges);
      requestAnimationFrame(() => rf.fitView({ padding: 0.12, duration: 250 }));
    },
    [rf, commit, t],
  );

  // First layout with measured card sizes.
  useEffect(() => {
    if (!laidOut.current && initialized) {
      laidOut.current = true;
      void layout(rf.getNodes(), rf.getEdges()).then((laid) => {
        setNodes(laid);
        // Readable first view: fit, but never below a zoom where Arabic on the cards stays legible.
        // Open on the root and its forms (the right edge), where the reading of the map begins.
        const anchor = laid.filter((n) => n.data.kind === "root" || n.data.kind === "lemma" || n.data.focus);
        requestAnimationFrame(() =>
          rf.fitView({ nodes: anchor.length ? anchor : undefined, padding: 0.25, minZoom: 0.6, maxZoom: 1 }),
        );
      });
    }
  }, [initialized, rf]);

  const undo = useCallback(() => {
    const last = past[past.length - 1];
    if (!last) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, { label: last.label, nodes, edges }]);
    setNodes(last.nodes);
    setEdges(last.edges);
  }, [past, nodes, edges]);

  const redo = useCallback(() => {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, { label: next.label, nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, nodes, edges]);

  const addCards = useCallback(
    (newNodes: GraphNode[], newEdges: GraphEdge[], label: string) => {
      const ids = new Set(nodes.map((n) => n.id));
      const center = rf.screenToFlowPosition({
        x: (wrapper.current?.clientWidth ?? 800) / 2,
        y: (wrapper.current?.clientHeight ?? 600) / 2,
      });
      const fresh = newNodes
        .filter((n) => !ids.has(n.id))
        .map((n, i) => ({ ...n, position: n.position.x || n.position.y ? n.position : { x: center.x - 120 + i * 30, y: center.y - 60 + i * 30 } }));
      const eids = new Set(edges.map((e) => e.id));
      commit(label, [...nodes, ...fresh], [...edges, ...newEdges.filter((e) => !eids.has(e.id))]);
    },
    [nodes, edges, commit, rf],
  );

  useEffect(() => {
    registerAdd?.(addCards);
  }, [registerAdd, addCards]);

  const actions: GraphActions = useMemo(
    () => ({
      editable,
      toggleFold: (id) =>
        commit(
          t("fold"),
          nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, folded: !n.data.folded } } : n)),
          edges,
        ),
      setText: (id, text) =>
        commit(
          t("kindNote"),
          nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)),
          edges,
        ),
      expand: (id) => {
        const node = nodes.find((n) => n.id === id);
        if (!node) return;
        if (node.data.kind === "lemma" && payload && node.data.lemmaId != null) {
          const present = new Set(nodes.map((n) => n.id));
          const add = expandForms(payload, node.data.lemmaId, present);
          const updated = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, more: undefined } } : n));
          void tidy(t("moreForms", { n: add.nodes.length }), { nodes: [...updated, ...add.nodes], edges: [...edges, ...add.edges] });
          return;
        }
        if (node.data.kind === "word" && node.data.rootKey && node.data.form) {
          const qs = new URLSearchParams({ form: node.data.form, limit: "8" });
          if (node.data.lemmaId != null) qs.set("lemma", String(node.data.lemmaId));
          if (node.data.cursor) qs.set("cursor", node.data.cursor);
          void fetch(`/api/v1/roots/${encodeURIComponent(node.data.rootKey)}/occurrences?${qs}`)
            .then((r) => r.json())
            .then((page: { total: number; next_cursor: string | null; data: { location: string; verse_key: string; left: string; keyword: string; right: string; surah_name_ar: string }[] }) => {
              const present = new Set(nodes.map((n) => n.id));
              const newNodes: GraphNode[] = [];
              const newEdges: GraphEdge[] = [];
              for (const o of page.data) {
                const vid = verseId(o.location);
                if (present.has(vid)) continue;
                newNodes.push({
                  id: vid,
                  type: "card",
                  position: { x: 0, y: 0 },
                  data: {
                    kind: "verse",
                    verse: {
                      key: o.verse_key,
                      surahName: o.surah_name_ar,
                      left: o.left.split(" ").slice(-5).join(" "),
                      word: o.keyword,
                      right: o.right.split(" ").slice(0, 5).join(" "),
                      location: o.location,
                    },
                  },
                });
                newEdges.push({ id: edgeId(id, vid), source: id, target: vid });
              }
              const shown = nodes.filter((n) => edges.some((e) => e.source === id && e.target === n.id)).length + newNodes.length;
              const updated = nodes.map((n) =>
                n.id === id
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        expanded: true,
                        cursor: page.next_cursor,
                        more: page.next_cursor ? { kind: "verses" as const, remaining: Math.max(0, page.total - shown) } : undefined,
                      },
                    }
                  : n,
              );
              void tidy(t("showVerses", { n: newNodes.length }), { nodes: [...updated, ...newNodes], edges: [...edges, ...newEdges] });
            });
        }
      },
    }),
    [editable, nodes, edges, payload, commit, tidy, t],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNode>[]) => {
      if (changes.some((c) => c.type === "remove")) {
        if (!editable) return;
        commit(t("deleteSelection"), applyNodeChanges(changes, nodes), edges);
        return;
      }
      setNodes((ns) => applyNodeChanges(changes, ns));
    },
    [editable, commit, nodes, edges, t],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<GraphEdge>[]) => {
      if (changes.some((c) => c.type === "remove")) {
        if (!editable) return;
        commit(t("deleteSelection"), nodes, applyEdgeChanges(changes, edges));
        return;
      }
      setEdges((es) => applyEdgeChanges(changes, es));
    },
    [editable, commit, nodes, edges, t],
  );
  const onConnect = useCallback(
    (c: Connection) => editable && commit(t("connectHint"), nodes, addEdge({ ...c, id: edgeId(c.source, c.target) }, edges)),
    [editable, commit, nodes, edges, t],
  );

  // Drag end is one undoable step.
  const dragStart = useRef<GraphNode[] | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!mod && e.key.toLowerCase() === "f") rf.fitView({ padding: 0.12, duration: 250 });
      else if (!mod && e.key.toLowerCase() === "t") void tidy();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, tidy, rf]);

  async function exportPng() {
    const viewport = wrapper.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport) return;
    const bounds = getNodesBounds(rf.getNodes());
    const width = Math.min(4000, Math.max(800, bounds.width + 160));
    const height = Math.min(4000, Math.max(600, bounds.height + 160));
    const vp = getViewportForBounds(bounds, width, height, 0.2, 2, 0.08);
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() || "#eeeef1";
    const url = await toPng(viewport, {
      backgroundColor: bg,
      width,
      height,
      pixelRatio: 2,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
    });
    download(url, `${fileName}.png`);
  }

  function exportJson() {
    const doc = { version: 1, title, nodes: nodes.map(({ id, position, data }) => ({ id, position, data })), edges: edges.map(({ id, source, target, data }) => ({ id, source, target, data })) };
    download(URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })), `${fileName}.json`);
  }

  const selectedEdge = editable ? edges.find((e) => e.selected) : undefined;

  return (
    <GraphActionsContext.Provider value={actions}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
          {onTitleChange ? (
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-label={t("rename")}
              className="h-8 min-w-0 max-w-[260px] flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[15px] font-semibold outline-none hover:border-line focus:border-ring"
            />
          ) : (
            <h1 className="min-w-0 truncate px-1 text-[15px] font-semibold">{title}</h1>
          )}
          {status}
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <div className="seg-group">
              <button type="button" className="seg" onClick={() => void tidy()} aria-keyshortcuts="T">{t("tidy")}</button>
              <button type="button" className="seg" onClick={() => rf.fitView({ padding: 0.12, duration: 250 })} aria-keyshortcuts="F">{t("fit")}</button>
            </div>
            <div className="seg-group">
              <button type="button" className="seg" onClick={undo} disabled={!past.length} title={past.length ? t("undoLabel", { label: past[past.length - 1].label }) : t("undo")} aria-keyshortcuts="Meta+Z">
                {t("undo")}
              </button>
              <button type="button" className="seg" onClick={redo} disabled={!future.length} title={future.length ? t("redoLabel", { label: future[future.length - 1].label }) : t("redo")} aria-keyshortcuts="Meta+Shift+Z">
                {t("redo")}
              </button>
            </div>
            <div className="seg-group">
              <button type="button" className="seg" onClick={() => void exportPng()}>{t("exportPng")}</button>
              <button type="button" className="seg" onClick={exportJson}>{t("exportJson")}</button>
            </div>
            {toolbarExtra}
          </div>
        </div>
        {selectedEdge && (
          <div className="flex items-center gap-2 border-b border-line bg-card px-3 py-2">
            <label className="text-[12.5px] text-t3" htmlFor="edge-label">{t("edgeLabel")}</label>
            <input
              id="edge-label"
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-card px-2 text-[14px] outline-none focus:border-ring"
              defaultValue={selectedEdge.data?.label ?? ""}
              key={selectedEdge.id}
              onBlur={(e) =>
                commit(
                  t("edgeLabel"),
                  nodes,
                  edges.map((x) => (x.id === selectedEdge.id ? { ...x, data: { label: e.target.value }, label: e.target.value || undefined } : x)),
                )
              }
            />
          </div>
        )}
        <div ref={wrapper} className="relative min-h-0 flex-1" dir="ltr" aria-label={t("canvasLabel")}>
          <ReactFlow<GraphNode, GraphEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={() => (dragStart.current = nodes)}
            onNodeDragStop={() => {
              if (dragStart.current) {
                const before = dragStart.current;
                dragStart.current = null;
                setPast((p) => [...p.slice(-80), { label: "↔", nodes: before, edges }]);
                setFuture([]);
              }
            }}
            nodesConnectable={editable}
            elementsSelectable
            deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
            minZoom={0.15}
            maxZoom={2}
            fitView={!autoLayout}
            proOptions={{ hideAttribution: false }}
            colorMode={theme === "dark" ? "dark" : "light"}
            defaultEdgeOptions={{ type: "default", style: { stroke: "var(--edge)", strokeWidth: 1.5 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--dot)" />
            <MiniMap pannable zoomable nodeColor={(n) => `var(--c-${n.data.kind === "lemma" ? "form" : n.data.kind === "verse" ? "sentence" : n.data.kind === "note" ? "desc" : n.data.kind})`} className="!hidden md:!block" />
          </ReactFlow>
          <div className="pointer-events-none absolute bottom-3 start-3 flex gap-1 rounded-lg bg-card/90 p-1 shadow-rest" dir="ltr">
            <button type="button" className="pointer-events-auto btn icon-btn" aria-label="−" onClick={() => rf.zoomOut({ duration: 150 })}>
              <Icon name="minus" />
            </button>
            <button type="button" className="pointer-events-auto btn icon-btn" aria-label="+" onClick={() => rf.zoomIn({ duration: 150 })}>
              <Icon name="plus" />
            </button>
          </div>
        </div>
      </div>
    </GraphActionsContext.Provider>
  );
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
