"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
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
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { link, verseId } from "@/lib/graph/build";
import { getJSON } from "@/lib/reader/api";
import { layout } from "@/lib/graph/layout";
import { allowedRels, checkLink, META, NAMED_ON_CANVAS, type Refusal } from "@/lib/graph/relations";
import { KIND_COLOR, KIND_SIZE, type GraphEdge, type GraphKind, type GraphNode, type Rel } from "@/lib/graph/types";
import { useTheme } from "@/lib/client";
import { cnt, verseRef } from "@/lib/format";
import { CardNode, FrameNode, GraphActionsContext, type GraphActions } from "./CardNode";

type Snapshot = { label: string; nodes: GraphNode[]; edges: GraphEdge[] };

const nodeTypes = { card: CardNode, frame: FrameNode };

/** A message on the canvas (EDT-071): with Undo when what it reports can be undone, then gone. */
type Toast = { id: number; text: string; undo: boolean };

/**
 * What the canvas offers the frame around it — the editor's header, its library and its details (P8.1-A): the map
 * as it is, what is selected, and the acts the reader can take on it.
 */
export type CanvasTools = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  kind: GraphKind;
  editable: boolean;
  selected: GraphNode[];
  undoLabel: string | null;
  redoLabel: string | null;
  undo: () => void;
  redo: () => void;
  tidy: () => void;
  fit: () => void;
  exportPng: () => void;
  exportJson: () => void;
  /** a whole map read from a file, in place of this one's cards: one step, undone in one */
  importCards: (nodes: GraphNode[], edges: GraphEdge[], label: string) => void;
  /** cards added where the reader dropped them (a point in the page) or in the free space nearest the middle */
  addCards: (nodes: GraphNode[], edges: GraphEdge[], label: string, at?: { x: number; y: number }) => void;
  select: (id: string | null) => void;
  center: (id: string) => void;
  toast: (text: string, undo?: boolean) => void;
  /** cards that match a search; the others are dimmed (EDT-039). Null: no search. */
  setMatches: (ids: string[] | null) => void;
  cardName: (id: string) => string;
};

const ToolsContext = createContext<CanvasTools | null>(null);

/** The canvas's tools, for the editor's header, library and details rendered around it. */
export function useCanvasTools(): CanvasTools {
  const tools = useContext(ToolsContext);
  if (!tools) throw new Error("useCanvasTools outside GraphCanvas");
  return tools;
}

export type GraphCanvasProps = {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  editable?: boolean;
  autoLayout?: boolean;
  title: string;
  onChange?: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  /** for the built-in toolbar of a view that is not the editor */
  toolbarExtra?: React.ReactNode;
  status?: React.ReactNode;
  fileName?: string;
  /** the map's type: the relations a link may take, and written into its JSON export (F16, P8.1a) */
  kind?: GraphKind;
  /** the editor's own frame around the canvas — its header, its library at the start, its details at the end —
   * which read the canvas's tools with useCanvasTools */
  header?: React.ReactNode;
  start?: React.ReactNode;
  end?: React.ReactNode;
  /** something dragged from the library and dropped on the canvas: its payload and the point in the page */
  onDropPayload?: (payload: string, at: { x: number; y: number }) => void;
  onHelp?: () => void;
  /** transliteration on the cards (QAN-22) */
  translit?: boolean;
};

export const DRAG_TYPE = "application/x-jadhr-card";

/** A card as an undo label names it: its letters, word or verse, else its kind (handoff §4.3, EDT-230). */
function nameOf(n: GraphNode | undefined, t: (k: "kindNote" | "kindPhrase" | "kindFrame") => string, locale: string): string {
  if (!n) return "";
  const d = n.data;
  if (d.kind === "note") return t(d.phrase ? "kindPhrase" : "kindNote");
  if (d.kind === "frame") return d.title || t("kindFrame");
  if (d.kind === "verse") return d.verse ? verseRef(d.verse.key, locale) : "";
  return d.ar ?? "";
}

/** The cards a first view opens on: the word and verse the reader came from, else every focus card. */
function firstView(nodes: GraphNode[]): GraphNode[] {
  const focus = nodes.filter((n) => n.data.focus);
  const near = focus.filter((n) => n.data.kind === "lemma" || n.data.kind === "verse");
  return near.length ? near : focus;
}

const sizeOf = (n: GraphNode) => ({ w: n.measured?.width ?? KIND_SIZE[n.data.kind].width, h: n.measured?.height ?? KIND_SIZE[n.data.kind].height });
const inField = (el: EventTarget | null) => {
  const h = el as HTMLElement | null;
  return !!h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.tagName === "SELECT" || h.isContentEditable);
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
  editable = false,
  autoLayout = false,
  title,
  onChange,
  toolbarExtra,
  status,
  fileName = "jadhr-map",
  kind = "free",
  header,
  start,
  end,
  onDropPayload,
  onHelp,
  translit = false,
}: GraphCanvasProps) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const theme = useTheme();
  const rf = useReactFlow<GraphNode, GraphEdge>();
  const initialized = useNodesInitialized();
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const laidOut = useRef(!autoLayout);
  // a stored graph opens on its focus cards (a seed's path) at a legible zoom, not shrunk to fit everything
  const [focusIds] = useState(() => firstView(initialNodes).map((n) => ({ id: n.id })));
  const wrapper = useRef<HTMLDivElement>(null);
  const [gliding, setGliding] = useState(false);

  // Notify the owner (autosave) whenever the document changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(nodes, edges);
  }, [nodes, edges]);

  // the map as it is now, for steps that end after the render that began them (an expansion, a layout)
  const live = useRef({ nodes: initialNodes, edges: initialEdges });
  useEffect(() => {
    live.current = { nodes, edges };
  });

  // a message on the canvas: one at a time, with Undo for 5.2 s when it can be undone, else for 2.6 s (HWF-26)
  const [toastNow, setToastNow] = useState<Toast | null>(null);
  const toast = useCallback((text: string, undo = false) => setToastNow({ id: Date.now() + Math.random(), text, undo }), []);
  useEffect(() => {
    if (!toastNow) return;
    const id = setTimeout(() => setToastNow(null), toastNow.undo ? 5200 : 2600);
    return () => clearTimeout(id);
  }, [toastNow]);

  /** Every mutation goes through commit(label, …) so undo carries a human-readable label (handoff §4.3). */
  const commit = useCallback((label: string, nextNodes: GraphNode[], nextEdges: GraphEdge[]) => {
    setPast((p) => [...p.slice(-80), { label, nodes: live.current.nodes, edges: live.current.edges }]);
    setFuture([]);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, []);

  const fit = useCallback(() => rf.fitView({ padding: 0.12, duration: 250, maxZoom: 1 }), [rf]);

  const tidy = useCallback(
    async (label = t("tidy"), base?: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
      const src = base ?? { nodes: rf.getNodes(), edges: rf.getEdges() };
      const laid = await layout(src.nodes, src.edges);
      // the cards glide to their places (EDT-009)
      setGliding(true);
      setTimeout(() => setGliding(false), 420);
      commit(label, laid, src.edges);
      requestAnimationFrame(() => fit());
    },
    [rf, commit, t, fit],
  );

  // First layout with measured card sizes.
  useEffect(() => {
    if (!laidOut.current && initialized) {
      laidOut.current = true;
      void layout(rf.getNodes(), rf.getEdges()).then((laid) => {
        setNodes(laid);
        // Readable first view: fit, but never below a zoom where Arabic on the cards stays legible.
        // Open on the path the reader came by (root → word → verse) when there is one, else on the
        // root and its words (the right edge), where the reading of the map begins.
        const focus = firstView(laid);
        const anchor = focus.length ? focus : laid.filter((n) => n.data.kind === "root" || n.data.kind === "lemma");
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
    (newNodes: GraphNode[], newEdges: GraphEdge[], label: string, at?: { x: number; y: number }) => {
      const ids = new Set(nodes.map((n) => n.id));
      // the point dropped on, or the middle of the canvas as the reader sees it, in the map's coordinates
      const box = wrapper.current?.getBoundingClientRect();
      const center = rf.screenToFlowPosition(at ?? { x: (box?.left ?? 0) + (box?.width ?? 800) / 2, y: (box?.top ?? 0) + (box?.height ?? 600) / 2 });
      // each new card in the free place nearest that point, never on top of another card
      const taken = nodes.map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) }));
      const free = (x: number, y: number, w: number, h: number) => !taken.some((r) => x < r.x + r.w + 24 && x + w + 24 > r.x && y < r.y + r.h + 24 && y + h + 24 > r.y);
      const steps = [0, 1, -1, 2, -2, 3, -3];
      const fresh = newNodes
        .filter((n) => !ids.has(n.id))
        .map((n) => {
          if (n.position.x || n.position.y) return n;
          const { w, h } = sizeOf(n);
          const spots = steps.flatMap((i) => steps.map((j) => ({ x: center.x - w / 2 + i * (w + 40), y: center.y - (at ? 20 : h / 2) + j * (h + 40) }))).sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
          const spot = spots.find((p) => free(p.x, p.y, w, h)) ?? spots[0];
          taken.push({ ...spot, w, h });
          return { ...n, position: spot };
        });
      if (!fresh.length) return;
      const eids = new Set(edges.map((e) => e.id));
      commit(label, [...nodes, ...fresh], [...edges, ...newEdges.filter((e) => !eids.has(e.id))]);
    },
    [nodes, edges, commit, rf],
  );

  // A card's places, read when asked (F18: a failed read is said, never silent). The cards are added to the map as
  // it is when they arrive.
  const [expanding, setExpanding] = useState<string | null>(null);
  const expand = useCallback(
    async (id: string) => {
      const node = live.current.nodes.find((n) => n.id === id);
      if (!node || expanding) return;
      const { kind: k, slug, cursor } = node.data;
      if (k !== "lemma" || !slug) return;
      setExpanding(id);
      try {
        const qs = new URLSearchParams({ limit: "8" });
        if (cursor) qs.set("cursor", cursor);
        const page = await getJSON<{ total: number; next_cursor: string | null; data: { location: string; verse_key: string }[] }>(`/words/${encodeURIComponent(slug)}/attestations?${qs}`);
        const { nodes: now, edges: wires } = live.current;
        const byId = new Map(now.map((n) => [n.id, n]));
        const newNodes: GraphNode[] = [];
        const newEdges: GraphEdge[] = [];
        const marked = new Map<string, string[]>(); // a verse already on the map: the places it now marks too
        for (const o of page.data) {
          const vid = verseId(o.verse_key);
          const had = byId.get(vid) ?? newNodes.find((n) => n.id === vid);
          if (!had) newNodes.push({ id: vid, type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: o.verse_key }, places: [o.location] } });
          else if (!had.data.places?.includes(o.location)) {
            if (newNodes.includes(had)) had.data.places = [...(had.data.places ?? []), o.location];
            else marked.set(vid, [...(marked.get(vid) ?? had.data.places ?? []), o.location]);
          }
          if (![...wires, ...newEdges].some((e) => e.source === id && e.target === vid)) newEdges.push(link(id, vid, "attests", { place: o.location }));
        }
        const shown = new Set([...wires, ...newEdges].filter((e) => e.source === id && e.data?.rel === "attests").map((e) => e.data?.place)).size;
        const updated = now.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, expanded: true, cursor: page.next_cursor, more: page.next_cursor ? { kind: "verses" as const, remaining: Math.max(0, page.total - shown) } : undefined } }
            : marked.has(n.id)
              ? { ...n, data: { ...n.data, places: marked.get(n.id) } }
              : n,
        );
        await tidy(t("doExtractVerses", cnt(newNodes.length, locale)), { nodes: [...updated, ...newNodes], edges: [...wires, ...newEdges] });
      } catch {
        toast(t("versesFailed"));
      } finally {
        setExpanding(null);
      }
    },
    [expanding, tidy, t, locale, toast],
  );

  // folding is a view of the card, not an edit: saved, never an undo step (EDT-099, EDT-210)
  const fold = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setNodes((ns) => ns.map((n) => (set.has(n.id) && n.data.kind !== "frame" ? { ...n, data: { ...n.data, folded: !n.data.folded } } : n)));
  }, []);

  const actions: GraphActions = useMemo(
    () => ({
      editable,
      translit,
      toggleFold: (id) => fold([id]),
      setText: (id, text) =>
        commit(
          t("doEditNote"),
          nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)),
          edges,
        ),
      expand: (id) => void expand(id),
      expanding,
    }),
    [editable, translit, fold, nodes, edges, commit, t, expand, expanding],
  );

  // A deletion is one step: xyflow removes the wires and then the cards in two changes, which would each commit
  // from the same render and the last would bring the wires back (F2). Both are left to onDelete, which has them all.
  const onNodesChange = useCallback((changes: NodeChange<GraphNode>[]) => {
    const kept = changes.filter((c) => c.type !== "remove");
    if (kept.length) setNodes((ns) => applyNodeChanges(kept, ns));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange<GraphEdge>[]) => {
    const kept = changes.filter((c) => c.type !== "remove");
    if (kept.length) setEdges((es) => applyEdgeChanges(kept, es));
  }, []);
  const onDelete = useCallback(
    ({ nodes: gone, edges: cut }: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
      if (!editable) return;
      const ids = new Set(gone.map((n) => n.id));
      const eids = new Set(cut.map((e) => e.id));
      const label = gone.length ? t("doDelete", cnt(gone.length, locale)) : t("doUnlink", cnt(cut.length, locale));
      commit(
        label,
        nodes.filter((n) => !ids.has(n.id)),
        edges.filter((e) => !eids.has(e.id) && !ids.has(e.source) && !ids.has(e.target)),
      );
      toast(label, true);
    },
    [editable, commit, nodes, edges, t, locale, toast],
  );
  /** A refused link, said in the product's words (EDT-127, EDT-243, HWF-16): which kinds, and what to try. */
  const refuse = useCallback(
    (why: Refusal, source: string, target: string) => {
      if (why === "same") return;
      if (why === "dup") return toast(t("linkDup"));
      if (why === "loop") return toast(t("linkLoop"));
      const a = nodes.find((n) => n.id === source)?.data.kind;
      const b = nodes.find((n) => n.id === target)?.data.kind;
      if (!a || !b) return;
      toast(t("linkPair", { fem: META[a].fem ? "f" : "m", a: t(META[a].def), b: t(META[b].def), type: t(`mapType_${kind}`) }));
    },
    [nodes, t, kind, toast],
  );
  const cardName = useCallback((id: string) => nameOf(nodes.find((n) => n.id === id), t, locale), [nodes, t, locale]);
  const onConnect = useCallback(
    (c: Connection) => {
      if (!editable) return;
      const ok = checkLink(kind, nodes, edges, c.source, c.target);
      if ("refused" in ok) return refuse(ok.refused, c.source, c.target);
      commit(t("doLink", { a: cardName(c.source), b: cardName(c.target) }), nodes, [...edges, link(c.source, c.target, ok.rel)]);
    },
    [editable, kind, commit, refuse, nodes, edges, t, cardName],
  );
  /** A link's relation changed in its panel, checked as a new link would be. */
  const setRel = (e: GraphEdge, rel: Rel) => {
    const ok = checkLink(kind, nodes, edges, e.source, e.target, rel, e.id);
    if ("refused" in ok) return refuse(ok.refused, e.source, e.target);
    commit(t("doRelation", { rel: t(`rel_${rel}`) }), nodes, edges.map((x) => (x.id === e.id ? { ...x, data: { ...x.data!, rel } } : x)));
  };
  const setEdgeField = (e: GraphEdge, field: "label" | "source", value: string) => {
    const v = value.trim();
    if (v === (e.data?.[field] ?? "")) return;
    const data = { ...e.data!, [field]: v || undefined };
    commit(t(field === "label" ? "doLabelLink" : "doSourceLink"), nodes, edges.map((x) => (x.id === e.id ? { ...x, data, label: field === "label" ? v || undefined : x.label } : x)));
  };

  const select = useCallback((id: string | null) => {
    setNodes((ns) => ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })));
    setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)));
  }, []);
  const center = useCallback(
    (id: string) => {
      const n = live.current.nodes.find((x) => x.id === id);
      if (!n) return;
      const { w, h } = sizeOf(n);
      void rf.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: Math.max(rf.getZoom(), 0.6), duration: 250 });
    },
    [rf],
  );

  // Drag end is one undoable step.
  const dragStart = useRef<GraphNode[] | null>(null);

  // the canvas's keys (EDT-253, EDT-254): undo and redo, fit, 100 %, zoom steps, tidy, fold the selection, select all,
  // clear, and the list of them
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inField(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "a") {
        e.preventDefault();
        setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
      } else if (mod) return;
      else if (k === "f") fit();
      else if (k === "1") void rf.zoomTo(1, { duration: 200 });
      else if (k === "+" || k === "=") void rf.zoomIn({ duration: 150 });
      else if (k === "-") void rf.zoomOut({ duration: 150 });
      else if (k === "t" && editable) void tidy();
      else if (k === "?" || (e.shiftKey && k === "/")) onHelp?.();
      else if (k === "enter") {
        const ids = live.current.nodes.filter((n) => n.selected).map((n) => n.id);
        const at = e.target as HTMLElement;
        if (ids.length && (at === document.body || at.closest(".react-flow"))) {
          e.preventDefault();
          fold(ids);
        }
      } else if (k === "escape") select(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, tidy, fit, rf, onHelp, fold, select, editable]);

  const exportPng = useCallback(async () => {
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
    toast(t("exportedCards", cnt(nodes.length, locale)));
  }, [rf, fileName, toast, t, nodes.length, locale]);

  const exportJson = useCallback(() => {
    const doc = { version: 2, title, kind, nodes: nodes.map(({ id, position, data }) => ({ id, position, data })), edges: edges.map(({ id, source, target, data }) => ({ id, source, target, data })) };
    download(URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })), `${fileName}.json`);
    toast(t("exportedCards", cnt(nodes.length, locale)));
  }, [title, kind, nodes, edges, fileName, toast, t, locale]);

  const importCards = useCallback(
    (next: GraphNode[], nextEdges: GraphEdge[], label: string) => {
      commit(label, next, nextEdges);
      // laid out afresh once the cards are measured, then fitted (EDT-260); the import stays one undo step
      setTimeout(
        () =>
          void layout(rf.getNodes(), rf.getEdges()).then((laid) => {
            setNodes(laid);
            requestAnimationFrame(() => fit());
          }),
        250,
      );
    },
    [commit, rf, fit],
  );

  const [matches, setMatchList] = useState<string[] | null>(null);
  const setMatches = useCallback((ids: string[] | null) => setMatchList(ids), []);
  const matchSet = useMemo(() => (matches ? new Set(matches) : null), [matches]);

  const selected = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const tools: CanvasTools = {
    nodes,
    edges,
    kind,
    editable,
    selected,
    undoLabel: past.length ? past[past.length - 1].label : null,
    redoLabel: future.length ? future[future.length - 1].label : null,
    undo,
    redo,
    tidy: () => void tidy(),
    fit,
    exportPng: () => void exportPng(),
    exportJson,
    importCards,
    addCards,
    select,
    center,
    toast,
    setMatches,
    cardName,
  };

  const selectedEdge = editable ? edges.find((e) => e.selected) : undefined;
  const kindOf = (id: string) => nodes.find((n) => n.id === id)?.data.kind;
  // a relation the kinds do not say is named on its link; one resting on an uncertain reading is dashed amber (F4)
  const drawn = useMemo(
    () =>
      edges.map((e) => {
        const rel = e.data?.rel;
        const named = !e.data?.label && rel && NAMED_ON_CANVAS.includes(rel) ? t(`rel_${rel}`) : undefined;
        return { ...e, ...(named ? { label: named } : {}), ...(e.data?.reading ? { className: "edge-reading" } : {}) };
      }),
    [edges, t],
  );
  // a search dims what does not match and rings what does (EDT-039); frames are left as they are
  const shown = useMemo(
    () => (matchSet ? nodes.map((n) => (n.data.kind === "frame" ? n : { ...n, className: matchSet.has(n.id) ? "is-match" : "is-dim" })) : nodes),
    [nodes, matchSet],
  );

  return (
    <ToolsContext.Provider value={tools}>
    <GraphActionsContext.Provider value={actions}>
      <div className="flex h-full min-h-0 flex-col">
        {header ?? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
            <h1 className="min-w-0 truncate px-1 text-[15px] font-semibold">{title}</h1>
            {status}
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              <div className="seg-group">
                <button type="button" className="seg" onClick={() => void tidy()} aria-keyshortcuts="T">{t("tidy")}</button>
                <button type="button" className="seg" onClick={fit} aria-keyshortcuts="F">{t("fit")}</button>
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
        )}
        {selectedEdge && (
          <div className="link-panel flex flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-2" key={selectedEdge.id}>
            <label className="flex items-center gap-1.5 text-[12.5px] text-t3">
              {t("linkRelation")}
              <select
                className="h-8 rounded-lg border border-line bg-card px-2 text-[13.5px] text-t1"
                value={selectedEdge.data?.rel ?? "next"}
                onChange={(e) => setRel(selectedEdge, e.target.value as Rel)}
              >
                {[...new Set([selectedEdge.data?.rel ?? "next", ...allowedRels(kind, kindOf(selectedEdge.source) ?? "note", kindOf(selectedEdge.target) ?? "note")])].map((r) => (
                  <option key={r} value={r}>{t(`rel_${r}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[200px] flex-1 items-center gap-1.5 text-[12.5px] text-t3">
              {t("edgeLabel")}
              <input
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-card px-2 text-[14px] text-t1 outline-none focus:border-ring"
                defaultValue={selectedEdge.data?.label ?? ""}
                onBlur={(e) => setEdgeField(selectedEdge, "label", e.target.value)}
              />
            </label>
            <label className="flex min-w-[200px] flex-1 items-center gap-1.5 text-[12.5px] text-t3">
              {t("linkSource")}
              <input
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-card px-2 text-[14px] text-t1 outline-none focus:border-ring"
                defaultValue={selectedEdge.data?.source ?? ""}
                placeholder={t("linkSourceHint")}
                onBlur={(e) => setEdgeField(selectedEdge, "source", e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {start}
          <div
            ref={wrapper}
            className={"graph-canvas relative min-h-0 flex-1" + (gliding ? " is-gliding" : "")}
            dir="ltr"
            role="region"
            aria-label={t("canvasLabel")}
            onDragOver={(e) => {
              if (editable && onDropPayload && e.dataTransfer.types.includes(DRAG_TYPE)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => {
              const payload = e.dataTransfer.getData(DRAG_TYPE);
              if (!editable || !payload || !onDropPayload) return;
              e.preventDefault();
              onDropPayload(payload, { x: e.clientX, y: e.clientY });
            }}
          >
            <ReactFlow<GraphNode, GraphEdge>
              nodes={shown}
              edges={drawn}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDelete={onDelete}
              onNodeDoubleClick={(e, n) => {
                if (inField(e.target) || (e.target as HTMLElement).closest("button, a")) return;
                fold([n.id]);
              }}
              onNodeDragStart={() => (dragStart.current = nodes)}
              onNodeDragStop={(_, __, dragged) => {
                const before = dragStart.current;
                dragStart.current = null;
                if (!before) return;
                const was = new Map(before.map((n) => [n.id, n.position]));
                const moved = dragged.filter((n) => {
                  const p = was.get(n.id);
                  return p && (Math.round(p.x) !== Math.round(n.position.x) || Math.round(p.y) !== Math.round(n.position.y));
                });
                if (!moved.length) return;
                setPast((p) => [...p.slice(-80), { label: t("doMove", cnt(moved.length, locale)), nodes: before, edges }]);
                setFuture([]);
              }}
              nodesConnectable={editable}
              elementsSelectable
              deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
              zoomOnDoubleClick={false}
              minZoom={0.15}
              maxZoom={2}
              fitView={!autoLayout}
              fitViewOptions={focusIds.length ? { nodes: focusIds, padding: 0.25, minZoom: 0.6, maxZoom: 1 } : { maxZoom: 1 }}
              proOptions={{ hideAttribution: false }}
              colorMode={theme === "dark" ? "dark" : "light"}
              defaultEdgeOptions={{ type: "default", style: { stroke: "var(--edge)", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge)", width: 14, height: 14 } }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--dot)" />
              <MiniMap pannable zoomable nodeColor={(n) => KIND_COLOR[(n as GraphNode).data.kind]} className="!hidden md:!block" />
            </ReactFlow>
            {nodes.length === 0 && (
              // an empty map says how to begin (EDT-063)
              <div className="graph-empty" dir={locale === "ar" ? "rtl" : "ltr"}>
                <p className="text-[14px] font-semibold text-t1">{t(editable ? "emptyTitle" : "emptyReadTitle")}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-t2">{t(editable ? "emptyBody" : "emptyReadBody")}</p>
              </div>
            )}
            {toastNow && (
              <div key={toastNow.id} className="graph-toast" role="status" aria-live="polite" dir={locale === "ar" ? "rtl" : "ltr"}>
                <span>{toastNow.text}</span>
                {toastNow.undo && past.length > 0 && (
                  <button
                    type="button"
                    className="graph-toast-undo"
                    onClick={() => {
                      undo();
                      setToastNow(null);
                    }}
                  >
                    {t("undo")}
                  </button>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 start-3 flex gap-1 rounded-lg bg-card/90 p-1 shadow-rest" dir="ltr">
              <button type="button" className="pointer-events-auto btn icon-btn" aria-label={t("zoomOut")} title={t("zoomOut")} onClick={() => rf.zoomOut({ duration: 150 })}>
                <Icon name="minus" />
              </button>
              <button type="button" className="pointer-events-auto btn icon-btn" aria-label={t("zoomIn")} title={t("zoomIn")} onClick={() => rf.zoomIn({ duration: 150 })}>
                <Icon name="plus" />
              </button>
            </div>
          </div>
          {end}
        </div>
      </div>
    </GraphActionsContext.Provider>
    </ToolsContext.Provider>
  );
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
