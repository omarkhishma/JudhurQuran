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
  useStore,
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
import { allowedRels, checkLink, META, type Refusal } from "@/lib/graph/relations";
import { KIND_COLOR, KIND_SIZE, type GraphEdge, type GraphKind, type GraphNode, type Rel } from "@/lib/graph/types";
import { useTheme } from "@/lib/client";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { useGraphUi } from "@/lib/graph/uiPrefs";
import { CanvasMenu, type MenuItem } from "./CanvasMenu";
import { CardNode, FrameNode, GraphActionsContext, type GraphActions } from "./CardNode";
import { RelEdge, WireContextValue, type WireContext } from "./RelEdge";

type Snapshot = { label: string; nodes: GraphNode[]; edges: GraphEdge[] };

const nodeTypes = { card: CardNode, frame: FrameNode };
const edgeTypes = { rel: RelEdge };

/** Below this zoom the canvas is a map (EDT-058, QAN-20): each card shows only its headline, large. */
export const MAP_ZOOM = 0.35;
const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

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

type Rect = { x: number; y: number; w: number; h: number };
/** The free place nearest a point for a card of this size, on the 8 px grid, never on top of another card. */
function freeSpot(taken: Rect[], center: { x: number; y: number }, w: number, h: number, top = false): { x: number; y: number } {
  const free = (x: number, y: number) => !taken.some((r) => x < r.x + r.w + 24 && x + w + 24 > r.x && y < r.y + r.h + 24 && y + h + 24 > r.y);
  const steps = [0, 1, -1, 2, -2, 3, -3, 4, -4];
  const spots = steps
    .flatMap((i) => steps.map((j) => ({ x: center.x - w / 2 + i * (w + 40), y: center.y - (top ? 20 : h / 2) + j * (h + 40) })))
    .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
  const found = spots.find((p) => free(p.x, p.y)) ?? spots[0];
  return { x: snap(found.x), y: snap(found.y) };
}
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

  // the whole map, never above 100 % and never below 0.34, just under the map view's threshold (EDT-060, HWF-36)
  const fit = useCallback(() => rf.fitView({ padding: 0.1, duration: 250, maxZoom: 1, minZoom: 0.34 }), [rf]);

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
      const taken: Rect[] = nodes.map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) }));
      const fresh = newNodes
        .filter((n) => !ids.has(n.id))
        .map((n) => {
          if (n.position.x || n.position.y) return n;
          const { w, h } = sizeOf(n);
          const spot = freeSpot(taken, center, w, h, !!at);
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
  // one card toggles; several all take the opposite of the first's state (EDT-163); frames have no fold
  const fold = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setNodes((ns) => {
      const first = ns.find((n) => set.has(n.id) && n.data.kind !== "frame");
      if (!first) return ns;
      const to = !first.data.folded;
      return ns.map((n) => (set.has(n.id) && n.data.kind !== "frame" ? { ...n, data: { ...n.data, folded: to } } : n));
    });
  }, []);

  // the zoom, for the pill and the map view (EDT-056, EDT-058)
  const zoom = useStore((s) => s.transform[2]);
  const mapView = zoom < MAP_ZOOM;
  const actions: GraphActions = useMemo(
    () => ({
      editable,
      translit,
      mapView,
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
    [editable, translit, mapView, fold, nodes, edges, commit, t, expand, expanding],
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
      void rf.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: rf.getZoom(), duration: 250 });
    },
    [rf],
  );

  // Drag end is one undoable step.
  const dragStart = useRef<GraphNode[] | null>(null);

  // the cards selected, in the order they were picked: a keyboard link runs from the first to the second
  const picked = useRef<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; client: { x: number; y: number }; on: string | null; bounds: { width: number; height: number } } | null>(null);
  const menuOpen = useRef(false);
  useEffect(() => {
    menuOpen.current = !!menu;
  }, [menu]);

  // a zoom step from where the last step was going, not from the middle of its animation
  const aim = useRef<{ zoom: number; at: number } | null>(null);
  const zoomTo = useCallback(
    (z: number, duration = 150) => {
      const zoom = Math.min(2, Math.max(0.15, z));
      aim.current = { zoom, at: Date.now() + duration };
      void rf.zoomTo(zoom, { duration });
    },
    [rf],
  );
  const zoomBy = useCallback((f: number) => zoomTo((aim.current && aim.current.at > Date.now() ? aim.current.zoom : rf.getZoom()) * f), [rf, zoomTo]);
  /** Pan the least needed to keep a card at least 44 px inside the pane (EDT-062). */
  const ensureVisible = useCallback(
    (id: string) => {
      const n = live.current.nodes.find((x) => x.id === id);
      const box = wrapper.current?.getBoundingClientRect();
      if (!n || !box) return;
      const { x, y, zoom } = rf.getViewport();
      const { w, h } = sizeOf(n);
      const left = n.position.x * zoom + x;
      const top = n.position.y * zoom + y;
      const m = 44;
      let dx = 0;
      let dy = 0;
      if (left + w * zoom < m) dx = m - left;
      else if (left > box.width - m) dx = box.width - m - left - Math.min(w * zoom, box.width - 2 * m) + m;
      if (top + h * zoom < m) dy = m - top;
      else if (top > box.height - m) dy = box.height - m - top - Math.min(h * zoom, box.height - 2 * m) + m;
      if (dx || dy) void rf.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 150 });
    },
    [rf],
  );
  /** Link two cards by keyboard (F14): the first picked to the second, checked as a dragged link is. */
  const linkPicked = useCallback(() => {
    const sel = live.current.nodes.filter((n) => n.selected).map((n) => n.id);
    if (sel.length !== 2) return toast(t("linkTwo"));
    const order = picked.current.filter((id) => sel.includes(id));
    const [a, b] = order.length === 2 ? order : sel;
    onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
  }, [toast, t, onConnect]);
  /** A note beside a card, describing it (EDT-067's "Attach description"). */
  const attachNote = useCallback(
    (id: string) => {
      const n = live.current.nodes.find((x) => x.id === id);
      if (!n || n.data.kind === "note" || n.data.kind === "frame") return;
      // beside the card, to the left where the map grows, in the nearest free place
      const size = KIND_SIZE.note;
      const taken: Rect[] = live.current.nodes.map((x) => ({ x: x.position.x, y: x.position.y, ...sizeOf(x) }));
      const spot = freeSpot(taken, { x: n.position.x - size.width / 2 - 64, y: n.position.y + size.height / 2 }, size.width, size.height);
      const note: GraphNode = { id: `note:${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, type: "card", position: spot, data: { kind: "note", text: "" } };
      commit(t("doAttachNote"), [...live.current.nodes, note], [...live.current.edges, link(id, note.id, "describes")]);
    },
    [commit, t],
  );

  // the canvas's keys (EDT-158…163, EDT-253, EDT-254, EDT-256): undo and redo; select all; fit, 100 %, zoom steps;
  // tidy; fold; extract; link the two picked; step to a card's child, parent or sibling, pan, or nudge with the
  // arrows; clear; and the list of them. Arrow keys are taken before xyflow's own, which moved cards.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inField(e.target) || menuOpen.current) return;
      const at = e.target as HTMLElement;
      const onCanvas = at === document.body || !!at.closest?.(".react-flow");
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const sel = live.current.nodes.filter((n) => n.selected);
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "a" && onCanvas) {
        e.preventDefault();
        setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
        useGraphUi.getState().set({ detailsOpen: true });
      } else if (mod) return;
      else if (k.startsWith("arrow") && onCanvas) {
        e.preventDefault();
        e.stopPropagation();
        const dir = k.slice(5) as "left" | "right" | "up" | "down";
        if (e.altKey && sel.length && editable) {
          // nudge the selection 8 px, 32 with ⇧ — one undo step a press (EDT-161, EDT-233)
          const step = e.shiftKey ? 32 : GRID;
          const [dx, dy] = dir === "left" ? [-step, 0] : dir === "right" ? [step, 0] : dir === "up" ? [0, -step] : [0, step];
          const ids = new Set(sel.map((n) => n.id));
          commit(t("doNudge"), live.current.nodes.map((n) => (ids.has(n.id) ? { ...n, position: { x: snap(n.position.x + dx), y: snap(n.position.y + dy) } } : n)), live.current.edges);
        } else if (sel.length) {
          // a card's child (to the left, where the map grows), its parent, its siblings (EDT-159)
          const from = sel[sel.length - 1];
          const { nodes: ns, edges: es } = live.current;
          const byId = new Map(ns.map((n) => [n.id, n]));
          const byY = (a: GraphNode, b: GraphNode) => a.position.y - b.position.y;
          const children = es.filter((x) => x.source === from.id).map((x) => byId.get(x.target)!).filter(Boolean).sort(byY);
          const parents = es.filter((x) => x.target === from.id).map((x) => byId.get(x.source)!).filter(Boolean);
          let next: GraphNode | undefined;
          if (dir === "left") next = children.find((c) => c.data.kind !== "note") ?? children[0];
          else if (dir === "right") next = parents[0];
          else {
            const ring = parents[0]
              ? es.filter((x) => x.source === parents[0].id).map((x) => byId.get(x.target)!).filter(Boolean).sort(byY)
              : ns.filter((n) => n.data.kind === from.data.kind).sort(byY);
            const i = ring.findIndex((n) => n.id === from.id);
            if (ring.length > 1) next = ring[(i + (dir === "down" ? 1 : -1) + ring.length) % ring.length];
          }
          if (next) {
            select(next.id);
            useGraphUi.getState().set({ detailsOpen: true });
            ensureVisible(next.id);
          }
        } else {
          // nothing selected: the arrows pan, 56 px or 160 with ⇧ (EDT-160)
          const step = e.shiftKey ? 160 : 56;
          const vp = rf.getViewport();
          const [dx, dy] = dir === "left" ? [step, 0] : dir === "right" ? [-step, 0] : dir === "up" ? [0, step] : [0, -step];
          void rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 120 });
        }
      } else if (k === "f") fit();
      else if (k === "1") zoomTo(1, 200);
      else if (k === "+" || k === "=") zoomBy(1.25);
      else if (k === "-" || k === "_") zoomBy(1 / 1.25);
      else if (k === "t" && editable) void tidy();
      else if (k === "e" && editable && sel.length === 1) void expand(sel[0].id);
      else if (k === "l" && editable && onCanvas) linkPicked();
      else if (k === "?" || (e.shiftKey && k === "/")) onHelp?.();
      else if (k === "enter" && sel.length && onCanvas) {
        // a focused card not yet selected is selected by Enter, as xyflow does; a selection folds (EDT-163)
        const focused = at.closest?.(".react-flow__node")?.getAttribute("data-id");
        if (focused && !sel.some((n) => n.id === focused)) return;
        e.preventDefault();
        e.stopPropagation();
        fold(sel.map((n) => n.id));
      } else if (k === "escape") {
        // clears everything; xyflow's own Escape on a focused card would select it again
        if (onCanvas) e.stopPropagation();
        select(null);
        setMenu(null);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [undo, redo, tidy, fit, rf, onHelp, fold, select, editable, commit, t, ensureVisible, zoomBy, zoomTo, expand, linkPicked]);

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
  // every wire named for a screen reader by what it says and what it joins (F14); drawn by RelEdge
  const drawn = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: "rel",
        ariaLabel: t("wireLabel", { rel: t(`rel_${e.data?.rel ?? "next"}`), from: cardName(e.source), to: cardName(e.target) }),
        ...(e.data?.reading ? { className: "edge-reading" } : {}),
      })),
    [edges, t, cardName],
  );
  // every card named by its kind, its headline and its count (F14); a search dims what does not match and rings
  // what does (EDT-039); frames are left as they are
  const shown = useMemo(
    () =>
      nodes.map((n) => {
        const kindName = t(n.data.phrase ? "kindPhrase" : META[n.data.kind].label);
        const ariaLabel = n.data.count != null ? t("cardLabelCount", { kind: kindName, name: cardName(n.id), n: formatNumber(n.data.count, locale) }) : t("cardLabel", { kind: kindName, name: cardName(n.id) });
        const className = matchSet && n.data.kind !== "frame" ? (matchSet.has(n.id) ? "is-match" : "is-dim") : undefined;
        return { ...n, ariaLabel, ...(className ? { className } : {}) };
      }),
    [nodes, matchSet, t, cardName, locale],
  );
  const wire: WireContext = useMemo(
    () => ({
      selected: new Set(selected.map((n) => n.id)),
      kindOf: (id: string) => nodes.find((n) => n.id === id)?.data.kind,
      editable,
      unlink: (id: string) => {
        commit(t("doUnlink", cnt(1, locale)), live.current.nodes, live.current.edges.filter((e) => e.id !== id));
        toast(t("doUnlink", cnt(1, locale)), true);
      },
    }),
    [selected, nodes, editable, commit, t, locale, toast],
  );
  const menuItems = (): MenuItem[] => {
    if (!menu) return [];
    const at = menu.client;
    if (!menu.on)
      return [
        { label: t("menuNewNote"), run: () => addCards([{ id: `note:${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: "" } }], [], t("doAddNote"), at) },
        ...(["root", "pattern", "lemma", "verse"] as const).map((k) => ({
          label: t("menuNewKind", { kind: t(META[k].label) }),
          run: () => window.dispatchEvent(new CustomEvent("jadhr:library-drop", { detail: { payload: { pick: k }, at } })),
        })),
        { label: t("tidy"), keys: "T", run: () => void tidy() },
        { label: t("fit"), keys: "F", run: fit },
      ];
    const card = nodes.find((n) => n.id === menu.on);
    if (!card) return [];
    const sel = nodes.filter((n) => n.selected);
    const many = sel.length > 1 ? sel : [card];
    return [
      { label: t(card.data.folded ? "unfold" : "fold"), keys: "↵", run: () => fold(many.map((n) => n.id)) },
      ...(card.data.kind === "lemma" && card.data.slug && (!card.data.expanded || card.data.more?.remaining) ? [{ label: t("menuExtract"), keys: "E", run: () => void expand(card.id) }] : []),
      ...(card.data.kind !== "note" && card.data.kind !== "frame" ? [{ label: t("menuAttachNote"), run: () => attachNote(card.id) }] : []),
      ...(sel.length === 2 ? [{ label: t("menuLinkTwo"), keys: "L", run: linkPicked }] : []),
      {
        label: t("doDelete", cnt(many.length, locale)),
        keys: "⌫",
        danger: true,
        run: () => onDelete({ nodes: many, edges: edges.filter((e) => many.some((n) => n.id === e.source || n.id === e.target)) }),
      },
    ];
  };

  return (
    <ToolsContext.Provider value={tools}>
    <WireContextValue.Provider value={wire}>
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
              edgeTypes={edgeTypes}
              ariaLabelConfig={{
                "node.a11yDescription.default": t("a11yNode"),
                "node.a11yDescription.keyboardDisabled": t("a11yNode"),
                "node.a11yDescription.ariaLiveMessage": () => "",
                "edge.a11yDescription.default": t("a11yWire"),
                "minimap.ariaLabel": t("a11yMinimap"),
                "handle.ariaLabel": t("a11yHandle"),
              }}
              // a wheel or two fingers pan, ⌘ or Ctrl with them zooms (EDT-051); the 8 px grid (HWF-12)
              panOnScroll
              panOnScrollSpeed={1}
              // the left button on empty space and the middle button anywhere pan (EDT-254)
              panOnDrag={[0, 1]}
              zoomOnScroll={false}
              zoomActivationKeyCode={["Meta", "Control"]}
              snapToGrid
              snapGrid={[GRID, GRID]}
              // ⇧-click adds to the selection as the design has it, beside ⌘ and Ctrl (EDT-254)
              multiSelectionKeyCode={["Shift", "Meta", "Control"]}
              onSelectionChange={({ nodes: now }) => {
                const ids = now.map((n) => n.id);
                picked.current = [...picked.current.filter((id) => ids.includes(id)), ...ids.filter((id) => !picked.current.includes(id))];
              }}
              onPaneContextMenu={(e) => {
                e.preventDefault();
                if (!editable) return;
                const box = wrapper.current!.getBoundingClientRect();
                setMenu({ x: e.clientX - box.left, y: e.clientY - box.top, client: { x: e.clientX, y: e.clientY }, on: null, bounds: { width: box.width, height: box.height } });
              }}
              onNodeContextMenu={(e, n) => {
                e.preventDefault();
                if (!editable) return;
                // what is clicked is what the menu acts on (HWF-37)
                if (!n.selected) select(n.id);
                const box = wrapper.current!.getBoundingClientRect();
                setMenu({ x: e.clientX - box.left, y: e.clientY - box.top, client: { x: e.clientX, y: e.clientY }, on: n.id, bounds: { width: box.width, height: box.height } });
              }}
              onPaneClick={() => setMenu(null)}
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
              defaultEdgeOptions={{ type: "rel", markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge)", width: 14, height: 14 } }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--dot)" />
              <MiniMap position="top-right" pannable zoomable nodeColor={(n) => KIND_COLOR[(n as GraphNode).data.kind]} className="!hidden md:!block" />
            </ReactFlow>
            {menu && (
              <CanvasMenu
                x={menu.x}
                y={menu.y}
                bounds={menu.bounds}
                items={menuItems()}
                label={t(menu.on ? "menuCard" : "menuCanvas")}
                onClose={() => setMenu(null)}
              />
            )}
            {mapView && (
              // the map view says so, and how to leave it (EDT-059)
              <p className="map-badge" dir={locale === "ar" ? "rtl" : "ltr"}>
                <span className="dot" style={{ background: "var(--ring)" }} />
                {t("mapViewBadge")}
              </p>
            )}
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
            <div className="zoom-pill" dir="ltr">
              <button type="button" className="zoom-pill-btn" aria-label={t("zoomOut")} title={t("zoomOutTitle")} onClick={() => zoomBy(1 / 1.25)}>
                <Icon name="minus" />
              </button>
              <button type="button" className="zoom-pill-pct" aria-label={t("zoomReset")} title={t("zoomResetTitle")} onClick={() => zoomTo(1, 200)}>
                {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent" }).format(Math.round(zoom * 100) / 100)}
              </button>
              <button type="button" className="zoom-pill-btn" aria-label={t("zoomIn")} title={t("zoomInTitle")} onClick={() => zoomBy(1.25)}>
                <Icon name="plus" />
              </button>
            </div>
          </div>
          {end}
        </div>
      </div>
    </GraphActionsContext.Provider>
    </WireContextValue.Provider>
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
