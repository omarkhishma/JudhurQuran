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
import { link, verseId, type RootGraphPayload } from "@/lib/graph/build";
import { fromPattern, fromRoot, fromVerses, linkVerse, versePlan, versesOf, type Added, type ExtractOptions, type RootRow, type VersePage, type VerseWord } from "@/lib/graph/extract";
import { bundleFiles } from "@/lib/graph/files";
import { endsOf, fieldMember, fromRelations, fromShared, relationLink, rootCardOf, type RelationEdge, type RootRelations } from "@/lib/graph/meaning";
import { quoteId, useEntryTitles } from "@/lib/graph/quote";
import { sameRun, type Run } from "@/lib/graph/run";
import { entityCard, type EntityRow } from "@/lib/graph/entities";
import { headingVersesPath, sourceHeading, topicCard, topicVerses, type TopicCredit, type TopicRow } from "@/lib/graph/topics";
import { getJSON } from "@/lib/reader/api";
import { layout, radialLayout } from "@/lib/graph/layout";
import { allowedRels, checkLink, META, type Refusal } from "@/lib/graph/relations";
import { KIND_COLOR, KIND_SIZE, type Field, type FieldKind, type GraphEdge, type GraphKind, type GraphNode, type NodeKind, type QuoteKey, type Rel } from "@/lib/graph/types";
import { templateOf, templatesFor, type Template, type TemplateId } from "@/lib/graph/templates";
import { useTheme } from "@/lib/client";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { useGraphUi } from "@/lib/graph/uiPrefs";
import { CanvasMenu, type MenuItem } from "./CanvasMenu";
import { CardNode, FrameActionsContext, FrameNode, GraphActionsContext, type FrameActions, type GraphActions } from "./CardNode";
import { RelEdge, WireContextValue, type WireContext } from "./RelEdge";
import { RelationInfo } from "./Relations";

type Snapshot = { label: string; nodes: GraphNode[]; edges: GraphEdge[] };

const nodeTypes = { card: CardNode, frame: FrameNode };
const edgeTypes = { rel: RelEdge };

/** Below this zoom the canvas is a map (EDT-058, QAN-20): each card shows only its headline, large. */
export const MAP_ZOOM = 0.35;
const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;
/** A root's graph, read once a visit for every card that extracts from it. */
const graphs = new Map<string, Promise<RootGraphPayload>>();
function rootGraph(key: string): Promise<RootGraphPayload> {
  let p = graphs.get(key);
  if (!p) {
    p = getJSON<RootGraphPayload>(`/roots/${encodeURIComponent(key)}/graph`);
    graphs.set(key, p);
    p.catch(() => graphs.delete(key));
  }
  return p;
}

/** a frame stays behind every card, selected or not: xyflow lifts a selected node by 1000 */
const FRAME_Z = -1001;

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
  tidyRadial: () => void;
  fit: () => void;
  exportPng: () => void;
  exportJson: () => void | Promise<void>;
  /** a whole map read from a file, in place of this one's cards: one step, undone in one */
  importCards: (nodes: GraphNode[], edges: GraphEdge[], label: string) => void;
  /** cards added where the reader dropped them (a point in the page) or in the free space nearest the middle */
  addCards: (nodes: GraphNode[], edges: GraphEdge[], label: string, at?: { x: number; y: number }) => void;
  select: (id: string | null) => void;
  center: (id: string) => void;
  /** a step run once the cards just set are drawn (a card selected and centred after it is added) */
  whenDrawn: (fn: () => void) => void;
  toast: (text: string, undo?: boolean) => void;
  /** cards that match a search; the others are dimmed (EDT-039). Null: no search. */
  setMatches: (ids: string[] | null) => void;
  cardName: (id: string) => string;
  /** a frame's name, changed as it is typed: not an undo step, saved (EDT-149) */
  renameFrame: (id: string, title: string) => void;
  frameMembers: (id: string) => string[];
  selectIds: (ids: string[]) => void;
  ungroup: () => void;
  /** a field's label, renamed in the details (EDT-106) */
  renameField: (id: string, field: string, label: string) => void;
  editField: (id: string, field: string, value: Field["value"], fileName?: string) => void;
  removeField: (id: string, field: string) => void;
  addField: (id: string, kind: FieldKind) => void;
  /** the fields this map's type offers a card of a kind, and one added to several cards at once (B37) */
  templates: (card: NodeKind) => Template[];
  addTemplate: (ids: string[], tpl: TemplateId) => void;
  /** a choice's options, renamed, added or removed — alike on every card for a map type's field (B37) */
  editOptions: (id: string, field: string, options: string[]) => void;
  /** a note's text edited in the details (EDT-183, EDT-223) */
  editHeadword: (id: string, text: string) => void;
  /** every card given folded or unfolded at once (EDT-187) */
  foldTo: (ids: string[], folded: boolean) => void;
  /** cards deleted with their wires, one step (EDT-187) */
  remove: (ids: string[]) => void;
  unlink: (edgeId: string) => void;
  /** a dictionary's article quoted on a note beside a card and describing it; the quotation already on the map is
   * linked instead (EDT-180, QAN-18, D22) */
  attachQuote: (id: string, entry: QuoteKey, run?: Run) => void;
  /** a quoting note narrowed to a passage of its article, or widened to the whole of it (B36): one step */
  setQuoteRun: (id: string, run: Run | null) => void;
  /** a card of the dataset beside another and linked to it — a word's root, a verse's word — or, already on the map,
   * selected and linked (EDT-173, QAN-17) */
  addLinked: (card: GraphNode, edge: GraphEdge, beside: string, label: string, places?: { verse: string; place: string }) => void;
  /** whether this map's type takes a meaning relation between two roots (P8.4) */
  meaningLinks: boolean;
  /** a classical relation put on the map beside one of its roots: the other root and the link (P8.4) */
  addRelation: (e: RelationEdge, beside: string, reviewed: boolean) => void;
  /** the verses two linked roots share, ten at a time, as verse cards (P8.4) */
  addShared: (edgeId: string) => void;
  /** a root put in a field: the field's one card on the map, and the root's link to it (P8.4c) */
  addFieldMember: (e: RelationEdge, beside: string, reviewed: boolean) => void;
  /** a topic's heading card (P8.3), named as the taxonomy in force names it and credited, linked part-of-topic to a
   * card on the map when `link` names the two ends */
  addTopic: (t: Pick<TopicRow, "id" | "name" | "verses" | "source_id" | "board" | "after">, sources: Record<string, TopicCredit>, link?: { from: string; to: string }) => void;
  /** a proper name's heading card (P8.3b), linked like a topic's */
  addEntity: (e: Pick<EntityRow, "id" | "name" | "verses">, link?: { from: string; to: string }) => void;
  /** one of the reader's own topics as their note, its verses gathered under it — beside the sources' topics, never
   * one of them (P8.3b); with `verse`, only that verse linked under it */
  addMyTopic: (tp: { id: string; label: string }, keys: string[], verse?: string) => void;
  /** the next ten verses a topic or a proper name gathers, under its card (P8.3) */
  addTopicVerses: (cardId: string) => void;
  /** whether this map's type gathers cards under a topic (P8.3) */
  topicLinks: boolean;
  /** a card or link whose dataset is being read */
  expanding: string | null;
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
  /** inside a page (a root's map on its page, QAN-21): the wheel scrolls the page, a drag pans, ⌘ with the wheel zooms */
  embedded?: boolean;
  /** read-only: what an act the map refuses is told (a published copy, EDT-244, EDT-257) — said, never silent */
  guard?: string;
  /** whether a read-only map's cards may be moved on screen: no read-only view does so by default — it shows its
   * author's arrangement (EDT-282, F17) */
  draggable?: boolean;
};

export const DRAG_TYPE = "application/x-jadhr-card";

/** A card as an undo label names it: its letters, word or verse, else its kind (handoff §4.3, EDT-230). */
function nameOf(n: GraphNode | undefined, t: (k: "kindNote" | "kindPhrase" | "kindQuote" | "kindFrame") => string, locale: string, works: Map<QuoteKey, string>): string {
  if (!n) return "";
  const d = n.data;
  // a topic's or a field's heading by its name, the first line of its card
  if (d.kind === "note" && sourceHeading(n.id)) return (d.text ?? "").split("\n")[0];
  // one of the reader's own topics by its name
  if (d.kind === "note" && n.id.startsWith("note:mytopic-")) return (d.text ?? "").split("\n")[0] || t("kindNote");
  // a quotation by the work it quotes, once that is read
  if (d.kind === "note" && d.entry) return works.get(d.entry) ?? t("kindQuote");
  if (d.kind === "note") return t(d.phrase ? "kindPhrase" : "kindNote");
  if (d.kind === "frame") return d.title || t("kindFrame");
  if (d.kind === "verse") return d.verse ? verseRef(d.verse.key, locale) : "";
  return d.ar ?? "";
}

/**
 * A card's stats (EDT-090, EDT-091): a root — its patterns and words on no pattern on the map, all its words under
 * them, and what it has left to extract; a pattern — its words, their verses, what is left; a word — its verses, its
 * parents, what is left; a verse — the cards linked to it; a note — what it is attached to and its fields. "Left" is
 * known only when the card carries what the dataset holds (`totals`). A link from a root to a verse is not a pattern
 * (HWF-51).
 */
export type CardStats = { a: number; b: number; left: number | null };
function cardStats(id: string, nodes: GraphNode[], edges: GraphEdge[]): CardStats {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const n = by.get(id);
  if (!n) return { a: 0, b: 0, left: null };
  const kidsOf = (x: string) => edges.filter((e) => e.source === x).map((e) => by.get(e.target)).filter((k): k is GraphNode => !!k);
  const kids = kidsOf(id);
  const t = n.data.totals;
  const left = (all: number | undefined, on: number) => (all == null ? null : Math.max(0, all - on));
  switch (n.data.kind) {
    case "root": {
      const forms = kids.filter((k) => k.data.kind === "pattern" || k.data.kind === "lemma");
      const words = new Set([...kids.filter((k) => k.data.kind === "lemma"), ...kids.filter((k) => k.data.kind === "pattern").flatMap((p) => kidsOf(p.id).filter((k) => k.data.kind === "lemma"))].map((k) => k.id));
      return { a: forms.length, b: words.size, left: left(t?.patterns, forms.length) };
    }
    case "pattern": {
      const words = kids.filter((k) => k.data.kind === "lemma");
      const verses = new Set(words.flatMap((w) => kidsOf(w.id).filter((k) => k.data.kind === "verse").map((k) => k.id)));
      return { a: words.length, b: verses.size, left: left(t?.words, words.length) };
    }
    case "lemma": {
      const verses = kids.filter((k) => k.data.kind === "verse").length;
      const parents = edges.filter((e) => e.target === id && ["root", "pattern"].includes(by.get(e.source)?.data.kind ?? "")).length;
      return { a: verses, b: parents, left: n.data.more ? n.data.more.remaining : left(t?.verses, verses) };
    }
    case "verse":
      return { a: edges.filter((e) => e.target === id && by.get(e.source)?.data.kind !== "note").length, b: 0, left: null };
    default:
      return { a: edges.filter((e) => e.source === id || e.target === id).length, b: n.data.fields?.length ?? 0, left: null };
  }
}

/** The cards a first view opens on: the word and verse the reader came from, else every focus card. */
function firstView(nodes: GraphNode[]): GraphNode[] {
  const focus = nodes.filter((n) => n.data.focus);
  const near = focus.filter((n) => n.data.kind === "lemma" || n.data.kind === "verse");
  return near.length ? near : focus;
}

const sizeOf = (n: GraphNode) => ({ w: n.measured?.width ?? KIND_SIZE[n.data.kind].width, h: n.measured?.height ?? KIND_SIZE[n.data.kind].height });

type Rect = { x: number; y: number; w: number; h: number };

/** The cards lying wholly inside a frame, where they are now (EDT-146: membership is geometric, never stored). */
function frameMembers(frameId: string, ns: GraphNode[]): string[] {
  const f = ns.find((n) => n.id === frameId);
  if (!f) return [];
  const w = f.width ?? f.data.size?.w ?? 0;
  const h = f.height ?? f.data.size?.h ?? 0;
  return ns
    .filter((n) => n.data.kind !== "frame" && n.id !== frameId)
    .filter((n) => {
      const s = sizeOf(n);
      return n.position.x >= f.position.x && n.position.y >= f.position.y && n.position.x + s.w <= f.position.x + w && n.position.y + s.h <= f.position.y + h;
    })
    .map((n) => n.id);
}
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
  embedded = false,
  guard,
  draggable = false,
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

  // what waits for the cards just set to be drawn (a fit, a card centred): a frame after setNodes can come before React
  // commits them, and a fit then frames where the cards were — a new map opened off its own focus, by its places before
  // the layout. It runs after the commit that holds them, when xyflow's store has them too (taken in a child's effect).
  const [drawTick, setDrawTick] = useState(0);
  const afterDraw = useRef<(() => void)[]>([]);
  const whenDrawn = useCallback((fn: () => void) => {
    afterDraw.current.push(fn);
    setDrawTick((n) => n + 1);
  }, []);
  useEffect(() => {
    for (const fn of afterDraw.current.splice(0)) fn();
  }, [nodes, drawTick]);

  // a message on the canvas: one at a time, with Undo for 5.2 s when it can be undone, else for 2.6 s (HWF-26)
  const [toastNow, setToastNow] = useState<Toast | null>(null);
  const toast = useCallback((text: string, undo = false) => setToastNow({ id: Date.now() + Math.random(), text, undo }), []);
  useEffect(() => {
    if (!toastNow) return;
    const id = setTimeout(() => setToastNow(null), toastNow.undo ? 5200 : 2600);
    return () => clearTimeout(id);
  }, [toastNow]);

  // every step the reader takes — a change, an undo, a redo — counted, so work that ends later (an import's layout)
  // can tell whether the map is still the one it began on
  const steps = useRef(0);

  /** Every mutation goes through commit(label, …) so undo carries a human-readable label (handoff §4.3). */
  const commit = useCallback((label: string, nextNodes: GraphNode[], nextEdges: GraphEdge[]) => {
    steps.current++;
    setPast((p) => [...p.slice(-80), { label, nodes: live.current.nodes, edges: live.current.edges }]);
    setFuture([]);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, []);

  // the whole map, never above 100 % and never below 0.34, just under the map view's threshold (EDT-060, HWF-36)
  const fit = useCallback(() => rf.fitView({ padding: 0.1, duration: 250, maxZoom: 1, minZoom: 0.34 }), [rf]);

  const tidy = useCallback(
    async (label = t("tidy"), base?: { nodes: GraphNode[]; edges: GraphEdge[] }, look?: string[], mode: "layered" | "radial" = "layered") => {
      const src = base ?? { nodes: rf.getNodes(), edges: rf.getEdges() };
      // frames are laid out by their cards: each wraps, after the layout, the cards it held before (EDT-154)
      const frames = src.nodes.filter((n) => n.data.kind === "frame");
      const held = new Map(frames.map((f) => [f.id, frameMembers(f.id, src.nodes)]));
      const free = src.nodes.filter((n) => n.data.kind !== "frame");
      // a mind map (P16.4): the root at the centre, the rest on rings by their distance in links
      const cards = mode === "radial" ? radialLayout(free, src.edges) : await layout(free, src.edges);
      const at = new Map(cards.map((n) => [n.id, n]));
      const laid = [
        ...frames.map((f) => {
          const ms = (held.get(f.id) ?? []).map((id) => at.get(id)!).filter(Boolean);
          if (!ms.length) return f;
          const x = snap(Math.min(...ms.map((n) => n.position.x)) - 24);
          const y = snap(Math.min(...ms.map((n) => n.position.y)) - 40);
          const w = snap(Math.max(...ms.map((n) => n.position.x + sizeOf(n).w)) + 24 - x);
          const h = snap(Math.max(...ms.map((n) => n.position.y + sizeOf(n).h)) + 24 - y);
          return { ...f, position: { x, y }, width: w, height: h, data: { ...f.data, size: { w, h } } };
        }),
        ...cards,
      ];
      // the cards glide to their places (EDT-009)
      setGliding(true);
      setTimeout(() => setGliding(false), 420);
      commit(label, laid, src.edges);
      // a whole tidy shows the whole map; an extraction shows the card and what it brought, still readable
      whenDrawn(() => (look?.length ? void rf.fitView({ nodes: look.map((id) => ({ id })), padding: 0.2, minZoom: 0.5, maxZoom: 1, duration: 250 }) : fit()));
    },
    [rf, commit, t, fit, whenDrawn],
  );

  // First layout with measured card sizes.
  useEffect(() => {
    if (!laidOut.current && initialized) {
      laidOut.current = true;
      void layout(rf.getNodes(), rf.getEdges()).then((laid) => {
        setNodes(laid);
        // Readable first view: fit, but never below a zoom where Arabic on the cards stays legible.
        // Open on the path the reader came by (root → word → verse) when there is one, else on the
        // root and what comes out of it (the right edge), where the reading of the map begins.
        const focus = firstView(laid);
        const roots = laid.filter((n) => n.data.kind === "root");
        const near = roots.length ? laid.filter((n) => n.data.kind === "root" || rf.getEdges().some((e) => roots.some((r) => r.id === e.source) && e.target === n.id)) : laid.filter((n) => n.data.kind === "lemma");
        const anchor = focus.length ? focus : near;
        whenDrawn(() => void rf.fitView({ nodes: anchor.length ? anchor : undefined, padding: 0.25, minZoom: 0.6, maxZoom: 1 }));
      });
    }
  }, [initialized, rf, whenDrawn]);

  const undo = useCallback(() => {
    const last = past[past.length - 1];
    if (!last) return;
    steps.current++;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, { label: last.label, nodes, edges }]);
    setNodes(last.nodes);
    setEdges(last.edges);
  }, [past, nodes, edges]);

  const redo = useCallback(() => {
    const next = future[future.length - 1];
    if (!next) return;
    steps.current++;
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, { label: next.label, nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, nodes, edges]);

  // where a zoom step in flight is going (zoomTo below), so a step or a pan does not start from its middle
  const aim = useRef<{ zoom: number; at: number } | null>(null);
  /** A card placed where the view does not reach, brought into it by the least pan, at the same zoom: what the
   * reader was looking at moves as little as it can. A zoom in flight finishes first. */
  const reveal = useCallback(
    function reveal(p: { x: number; y: number }, w: number, h: number) {
      const wait = aim.current ? aim.current.at - Date.now() : 0;
      if (wait > 0) return void setTimeout(() => reveal(p, w, h), wait + 20);
      const box = wrapper.current?.getBoundingClientRect();
      if (!box) return;
      const { x, y, zoom } = rf.getViewport();
      const m = 24 / zoom;
      const tl = rf.screenToFlowPosition({ x: box.left, y: box.top });
      const br = rf.screenToFlowPosition({ x: box.right, y: box.bottom });
      const shift = (lo: number, hi: number, a: number, b: number) => (a < lo ? a - lo - m : b > hi ? Math.min(b - hi + m, a - lo - m) : 0);
      const dx = shift(tl.x, br.x, p.x, p.x + w);
      const dy = shift(tl.y, br.y, p.y, p.y + h);
      if (dx || dy) void rf.setViewport({ x: x - dx * zoom, y: y - dy * zoom, zoom }, { duration: 250 });
    },
    [rf],
  );

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
      const eids = new Set(edges.map((e) => e.id));
      // links alone (a proposal linking two cards already here) are a step too
      const wires = newEdges.filter((e) => !eids.has(e.id));
      if (!fresh.length && !wires.length) return;
      commit(label, [...nodes, ...fresh], [...edges, ...wires]);
      // a card dropped stays where it was put; one placed by the editor is brought into view
      if (!at && fresh[0]) reveal(fresh[0].position, sizeOf(fresh[0]).w, sizeOf(fresh[0]).h);
    },
    [nodes, edges, commit, rf, reveal],
  );

  // What a card extracts from the dataset (P8.2; EDT-111…123, F18: a failed read is said, never silent): a root its
  // patterns, a pattern its words, a word its verses ten at a time — within a sūra or a written form when asked —
  // and a verse its words and their roots. The cards are added to the map as it is when they arrive, laid out, in
  // one named step that undo takes back whole.
  const [expanding, setExpanding] = useState<string | null>(null);
  const expand = useCallback(
    async (id: string, opts: ExtractOptions = {}) => {
      const node = live.current.nodes.find((n) => n.id === id);
      if (!node || expanding) return;
      const d = node.data;
      setExpanding(id);
      try {
        const { nodes: now, edges: wires } = live.current;
        let out: Added | null = null;
        let label = "";
        let said = "";
        const update = new Map<string, Partial<GraphNode["data"]>>();
        if (d.kind === "root" && d.rootKey) {
          out = fromRoot(await rootGraph(d.rootKey), now, wires);
          label = t("doExtractPatterns", cnt(out.count, locale));
          said = t("extractedPatterns", cnt(out.count, locale));
        } else if (d.kind === "pattern" && d.slug) {
          // its words in the roots it hangs from on this map
          const roots = wires.filter((e) => e.target === id).map((e) => now.find((n) => n.id === e.source)?.data.rootKey).filter((k): k is string => !!k);
          out = fromPattern(d.slug, await Promise.all([...new Set(roots)].map(rootGraph)), now, wires);
          label = t("doExtractWords", cnt(out.count, locale));
          said = t("extractedWords", cnt(out.count, locale));
        } else if (d.kind === "lemma" && d.slug) {
          // ten new verses; a filter starts from the first verse, the plain sequence from where it stopped
          const filtered = !!(opts.surah || opts.form);
          const have = versesOf(id, wires);
          const fresh: VersePage["data"] = [];
          let cursor = !filtered && d.cursor?.startsWith("v:") ? d.cursor.slice(2) : null;
          let total = 0;
          let stop: string | null = cursor;
          for (let i = 0; i < 40 && fresh.length < 10; i++) {
            const qs = new URLSearchParams({ limit: "20" });
            if (cursor) qs.set("cursor", cursor);
            if (opts.surah) qs.set("surah", String(opts.surah));
            if (opts.form) qs.set("form", opts.form);
            const page = await getJSON<VersePage>(`/words/${encodeURIComponent(d.slug)}/verses?${qs}`);
            total = page.total;
            for (const v of page.data) {
              if (fresh.length >= 10) break;
              stop = v.cursor ?? stop;
              if (!have.has(verseId(v.verse_key))) fresh.push(v);
            }
            cursor = page.next_cursor;
            if (!cursor) break;
          }
          out = fromVerses(id, { total, next_cursor: null, data: fresh }, now, wires);
          const linked = new Set([...have, ...out.edges.filter((e) => e.source === id).map((e) => e.target)]).size;
          const all = filtered ? (d.totals?.verses ?? linked) : total;
          update.set(id, {
            expanded: true,
            // the plain sequence goes on from the verse after the last one taken
            ...(filtered ? {} : { cursor: stop ? `v:${stop}` : null, totals: { ...d.totals, verses: total } }),
            more: linked < all ? { kind: "verses", remaining: all - linked } : undefined,
          });
          label = t("doExtractVerses", cnt(out.count, locale));
          said = t("extractedVerses", cnt(out.count, locale));
        } else if (d.kind === "verse" && d.verse) {
          const v = await getJSON<{ words: VerseWord[] }>(`/verses/${d.verse.key}`);
          const plan = versePlan(id, v.words, wires, !!opts.particles);
          const mode = opts.mode ?? (plan.words.length ? "words" : "roots");
          const keys = mode === "words" ? [] : mode === "roots" ? plan.roots : plan.words.flatMap((w) => (w.root ? [w.root] : []));
          const rows = keys.length ? (await getJSON<{ data: RootRow[] }>(`/roots?keys=${encodeURIComponent(keys.join(","))}&limit=${keys.length}`)).data : [];
          out = linkVerse(id, v.words, plan, mode, new Map(rows.map((r) => [r.key, r])), now, wires);
          const words = mode === "roots" ? 0 : plan.words.length;
          const roots = mode === "words" ? 0 : mode === "roots" ? plan.roots.length : new Set(plan.words.flatMap((w) => (w.root ? [w.root] : []))).size;
          const phrase = words && roots ? t("phraseWordsRoots", { words: t("phraseWords", cnt(words, locale)), roots: t("phraseRoots", cnt(roots, locale)) }) : words ? t("phraseWords", cnt(words, locale)) : t("phraseRoots", cnt(roots, locale));
          label = t("doLinkPhrase", { phrase });
          said = t("linkedPhrase", { phrase });
        }
        if (!out || (!out.nodes.length && !out.edges.length && !out.marks.size)) {
          if (update.size) setNodes((ns) => ns.map((n) => (update.has(n.id) ? { ...n, data: { ...n.data, ...update.get(n.id) } } : n)));
          toast(t("nothingLeft"));
          return;
        }
        const added = out;
        const updated = now.map((n) => {
          const u = update.get(n.id);
          const m = added.marks.get(n.id);
          return u || m ? { ...n, data: { ...n.data, ...u, ...(m ? { places: m } : {}) } } : n;
        });
        await tidy(label, { nodes: [...updated, ...added.nodes], edges: [...wires, ...added.edges] }, [id, ...added.nodes.map((n) => n.id)]);
        toast(said, true);
      } catch {
        toast(t(d.kind === "lemma" ? "versesFailed" : "extractFailed"));
      } finally {
        setExpanding(null);
      }
    },
    [expanding, tidy, t, locale, toast],
  );

  // Meaning maps (P8.4, research 15): the roots a root is related to by relations the board has reviewed, each pair
  // linked with its book; one named step that undo takes back whole. None in force is said, with how many wait.
  const relate = useCallback(
    async (id: string) => {
      const key = live.current.nodes.find((n) => n.id === id)?.data.rootKey;
      if (!key || expanding) return;
      setExpanding(id);
      try {
        const rel = await getJSON<RootRelations>(`/roots/${encodeURIComponent(key)}/relations`);
        const others = [...new Set(rel.data.flatMap((e) => endsOf(e) ?? []))].filter((k) => k !== key);
        const rows = others.length ? (await getJSON<{ data: RootRow[] }>(`/roots?keys=${encodeURIComponent(others.join(","))}&limit=${others.length}`)).data : [];
        const { nodes: now, edges: wires } = live.current;
        const out = fromRelations(key, rel, new Map(rows.map((r) => [r.key, r])), now, wires, locale);
        if (!out.nodes.length && !out.edges.length) {
          toast(others.length ? t("relatedAll") : t("relatedNone", cnt(rel.waiting, locale)));
          return;
        }
        await tidy(t("doRelate", cnt(out.count, locale)), { nodes: [...now, ...out.nodes], edges: [...wires, ...out.edges] }, [id, ...out.nodes.map((n) => n.id)]);
        toast(t("related", cnt(out.count, locale)), true);
      } catch {
        toast(t("relateFailed"));
      } finally {
        setExpanding(null);
      }
    },
    [expanding, tidy, t, locale, toast],
  );
  const addShared = useCallback(
    async (edgeId: string) => {
      const { nodes: now, edges: wires } = live.current;
      const e = wires.find((x) => x.id === edgeId);
      const a = now.find((n) => n.id === e?.source)?.data.rootKey;
      const b = now.find((n) => n.id === e?.target)?.data.rootKey;
      if (!e || !a || !b || expanding) return;
      setExpanding(edgeId);
      try {
        const all = await getJSON<{ count: number; verses: string[] }>(`/roots/${encodeURIComponent(a)}/shared?with=${encodeURIComponent(b)}&limit=500`);
        const keys = all.verses.filter((k) => !(wires.some((w) => w.target === verseId(k) && (w.source === e.source || w.source === e.target)))).slice(0, 10);
        if (!keys.length) {
          toast(t(all.count ? "sharedAllOn" : "sharedNone"));
          return;
        }
        const got = await getJSON<{ data: { key: string; words: VerseWord[] }[] }>(`/verses?keys=${encodeURIComponent(keys.join(","))}`);
        const out = fromShared(a, b, got.data, now, wires);
        const updated = now.map((n) => (out.marks.has(n.id) ? { ...n, data: { ...n.data, places: out.marks.get(n.id) } } : n));
        await tidy(t("doShared", cnt(out.count, locale)), { nodes: [...updated, ...out.nodes], edges: [...wires, ...out.edges] }, [e.source, e.target, ...out.nodes.map((n) => n.id)]);
        toast(t("sharedAdded", { ...cnt(keys.length, locale), all: formatNumber(all.count, locale) }), true);
      } catch {
        toast(t("versesFailed"));
      } finally {
        setExpanding(null);
      }
    },
    [expanding, tidy, t, locale, toast],
  );
  // Topic maps (P8.3, QAN-09): a topic's or a proper name's verses ten at a time in the mushaf's order, gathered under
  // its card; the card keeps where the next page starts
  const addTopicVerses = useCallback(
    async (cardId: string) => {
      const node = live.current.nodes.find((n) => n.id === cardId);
      const path = headingVersesPath(cardId);
      if (!node || !path || expanding) return;
      setExpanding(cardId);
      try {
        const offset = Number((node.data.cursor ?? "t:0").replace(/^t:/, "")) || 0;
        const page = await getJSON<{ total: number; data: { verse_key: string }[] }>(`${path}?limit=10&offset=${offset}`);
        const { nodes: now, edges: wires } = live.current;
        const out = topicVerses(cardId, page.data.map((v) => v.verse_key), now, wires);
        const next = offset + page.data.length;
        const updated = now.map((n) => (n.id === cardId ? { ...n, data: { ...n.data, cursor: `t:${next}`, totals: { ...n.data.totals, verses: page.total }, expanded: true } } : n));
        if (!out.nodes.length && !out.edges.length) {
          setNodes(updated);
          toast(t(next >= page.total ? "topicAllVerses" : "nothingLeft"));
          return;
        }
        await tidy(t("doTopicVerses", cnt(out.count, locale)), { nodes: [...updated, ...out.nodes], edges: [...wires, ...out.edges] }, [cardId, ...out.nodes.map((n) => n.id)]);
        toast(t("topicVersesAdded", { ...cnt(out.count, locale), all: formatNumber(page.total, locale) }), true);
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
      const cards = gone.filter((n) => n.data.kind !== "frame").length;
      const label = cards ? t("doDelete", cnt(cards, locale)) : gone.length ? t("doDeleteGroups", cnt(gone.length, locale)) : t("doUnlink", cnt(cut.length, locale));
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
  const entries = useMemo(() => [...new Set(nodes.flatMap((n) => (n.data.entry ? [n.data.entry] : [])))], [nodes]);
  const works = useEntryTitles(entries, locale);
  const cardName = useCallback((id: string) => nameOf(nodes.find((n) => n.id === id), t, locale, works), [nodes, t, locale, works]);
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
  const carried = useRef(new Map<string, { from: { x: number; y: number }; frame: string; start: { x: number; y: number } }>());

  // the cards selected, in the order they were picked: a keyboard link runs from the first to the second
  const picked = useRef<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; client: { x: number; y: number }; on: string | null; bounds: { width: number; height: number } } | null>(null);
  const menuOpen = useRef(false);
  useEffect(() => {
    menuOpen.current = !!menu;
  }, [menu]);

  // a zoom step from where the last step was going, not from the middle of its animation
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
  /** A wire cut, one step, said with Undo. */
  const unlinkEdge = useCallback(
    (id: string) => {
      commit(t("doUnlink", cnt(1, locale)), live.current.nodes, live.current.edges.filter((e) => e.id !== id));
      toast(t("doUnlink", cnt(1, locale)), true);
    },
    [commit, t, locale, toast],
  );
  /** A dictionary's article — or a passage of it (B36) — quoted on a note beside a card, describing it; the same
   * quotation already on the map is linked. */
  const attachQuote = useCallback(
    (id: string, entry: QuoteKey, run?: Run) => {
      const ns = live.current.nodes;
      const n = ns.find((x) => x.id === id);
      if (!n) return;
      const same = ns.find((x) => x.data.kind === "note" && x.data.entry === entry && sameRun(x.data.run, run));
      // a note narrowed or widened since keeps its id; a new one takes the next free
      let qid = same?.id ?? quoteId(entry, run);
      for (let i = 2; !same && ns.some((x) => x.id === qid); i++) qid = `${quoteId(entry, run)}~${i}`;
      const have = same;
      const edge = link(id, qid, "describes");
      if (have) {
        if (!live.current.edges.some((e) => (e.source === id && e.target === qid) || (e.source === qid && e.target === id))) commit(t("doQuoteLink"), ns, [...live.current.edges, edge]);
        select(qid);
        center(qid);
        return toast(t("quoteOnMap"));
      }
      const size = KIND_SIZE.note;
      const taken: Rect[] = ns.map((x) => ({ x: x.position.x, y: x.position.y, ...sizeOf(x) }));
      const spot = freeSpot(taken, { x: n.position.x - size.width / 2 - 64, y: n.position.y + size.height / 2 }, size.width, size.height);
      const note: GraphNode = { id: qid, type: "card", position: spot, data: { kind: "note", entry, ...(run ? { run } : {}) } };
      commit(t("doQuote"), [...ns, note], [...live.current.edges, edge]);
      reveal(spot, size.width, size.height);
      toast(t("quoted"), true);
    },
    [commit, t, select, center, toast, reveal],
  );
  /** A card of the dataset beside another, linked to it; on the map already, linked if it was not and selected. */
  const addLinked = useCallback(
    (card: GraphNode, edge: GraphEdge, beside: string, label: string, places?: { verse: string; place: string }) => {
      const ns = live.current.nodes;
      const es = live.current.edges;
      const by = ns.find((x) => x.id === beside);
      if (!by) return;
      // a verse marks the word's place in it, as a seed does (F5)
      const mark = (list: GraphNode[]) =>
        places ? list.map((x) => (x.id === places.verse && !(x.data.places ?? []).includes(places.place) ? { ...x, data: { ...x.data, places: [...(x.data.places ?? []), places.place] } } : x)) : list;
      const linked = es.some((e) => (e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source));
      if (ns.some((x) => x.id === card.id)) {
        if (!linked) commit(label, mark(ns), [...es, edge]);
        select(card.id);
        center(card.id);
        return;
      }
      const size = KIND_SIZE[card.data.kind];
      const taken: Rect[] = ns.map((x) => ({ x: x.position.x, y: x.position.y, ...sizeOf(x) }));
      // a parent to the right of the card, a child to its left: the map reads right to left
      const parent = edge.target === beside;
      const at = { x: by.position.x + (parent ? sizeOf(by).w + 64 + size.width / 2 : -size.width / 2 - 64), y: by.position.y + size.height / 2 };
      const spot = freeSpot(taken, at, size.width, size.height);
      commit(label, [...mark(ns).map((x) => (x.selected ? { ...x, selected: false } : x)), { ...card, position: spot, selected: true }], [...es, edge]);
      reveal(spot, size.width, size.height);
    },
    [commit, select, center, reveal],
  );
  const addRelation = useCallback(
    async (e: RelationEdge, beside: string, reviewed: boolean) => {
      const here = live.current.nodes.find((n) => n.id === beside)?.data.rootKey;
      const ends = endsOf(e);
      const l = relationLink(e, reviewed, locale);
      if (!here || !ends || !l) return;
      const other = ends[0] === here ? ends[1] : ends[0];
      try {
        const rows = (await getJSON<{ data: RootRow[] }>(`/roots?keys=${encodeURIComponent(other)}&limit=1`)).data;
        addLinked(rootCardOf(other, rows[0]), l, beside, t(reviewed ? "doAddRelation" : "doAddOwnRelation", { a: e.a.word, b: e.b?.word ?? "" }));
      } catch {
        toast(t("relateFailed"));
      }
    },
    [addLinked, locale, t, toast],
  );

  /** A note beside a card, describing it (EDT-067's "Attach description"). */
  const attachNote = useCallback(
    (id: string) => {
      const n = live.current.nodes.find((x) => x.id === id);
      if (!n || n.data.kind === "note" || n.data.kind === "frame") return;
      // beside the card, to the left where the map grows, in the nearest free place
      const size = KIND_SIZE.note;
      const taken: Rect[] = live.current.nodes.map((x) => ({ x: x.position.x, y: x.position.y, ...sizeOf(x) }));
      const spot = freeSpot(taken, { x: n.position.x - size.width / 2 - 64, y: n.position.y + size.height / 2 }, size.width, size.height);
      // open and selected, as the design adds it (EDT-122)
      const note: GraphNode = { id: `note:${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, type: "card", position: spot, data: { kind: "note", text: "" }, selected: true };
      commit(t("doAttachNote"), [...live.current.nodes.map((x) => (x.selected ? { ...x, selected: false } : x)), note], [...live.current.edges, link(id, note.id, "describes")]);
      reveal(spot, size.width, size.height);
    },
    [commit, t, reveal],
  );

  const membersOf = useCallback((frameId: string, ns: GraphNode[] = live.current.nodes) => frameMembers(frameId, ns), []);
  /** A frame around the selected cards (EDT-141): their box with room for the bar, on the grid, then named in the
   * details. */
  const group = useCallback(() => {
    const sel = live.current.nodes.filter((n) => n.selected && n.data.kind !== "frame");
    if (sel.length < 2) return toast(t("groupNeedTwo"));
    const xs = sel.map((n) => n.position.x);
    const ys = sel.map((n) => n.position.y);
    const x2 = sel.map((n) => n.position.x + sizeOf(n).w);
    const y2 = sel.map((n) => n.position.y + sizeOf(n).h);
    const x = snap(Math.min(...xs) - 24);
    const y = snap(Math.min(...ys) - 44);
    const box = { w: snap(Math.max(...x2) + 24 - x), h: snap(Math.max(...y2) + 24 - y) };
    const frame: GraphNode = { id: `frame:${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, type: "frame", position: { x, y }, data: { kind: "frame", title: "", size: box }, selected: true };
    const label = t("doGroup", cnt(sel.length, locale));
    commit(label, [frame, ...live.current.nodes.map((n) => (n.selected ? { ...n, selected: false } : n))], live.current.edges);
    useGraphUi.getState().set({ detailsOpen: true });
    toast(t("grouped", cnt(sel.length, locale)), true);
  }, [commit, t, locale, toast]);
  /** The selected frames released, their cards left where they are (EDT-142). */
  const ungroup = useCallback(() => {
    const frames = live.current.nodes.filter((n) => n.selected && n.data.kind === "frame");
    if (!frames.length) return toast(t("ungroupNeedOne"));
    const ids = new Set(frames.map((n) => n.id));
    commit(t("doUngroup"), live.current.nodes.filter((n) => !ids.has(n.id)), live.current.edges);
    toast(t("ungrouped"), true);
  }, [commit, t, toast]);
  /**
   * Copies of the selected notes and frames, 24 px on, selected (EDT-188, HWF-46). A card of the dataset is one card
   * of its key on a map (P8.1a), so it is not copied: the reader is told how many were left as they were.
   */
  const duplicate = useCallback(() => {
    const sel = live.current.nodes.filter((n) => n.selected);
    if (!sel.length) return;
    const copyable = sel.filter((n) => n.data.kind === "note" || n.data.kind === "frame");
    const kept = sel.length - copyable.length;
    if (!copyable.length) return toast(t("duplicateNone"));
    const copies: GraphNode[] = copyable.map((n) => {
      const prefix = n.data.kind === "frame" ? "frame" : "note";
      const data = { ...n.data, fields: n.data.fields?.map((f) => ({ ...f, id: crypto.randomUUID().replace(/-/g, "").slice(0, 12) })), focus: undefined };
      return { id: `${prefix}:${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, type: n.type, position: { x: snap(n.position.x + 24), y: snap(n.position.y + 24) }, data, selected: true };
    });
    commit(t("doDuplicate", cnt(copies.length, locale)), [...live.current.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...copies], live.current.edges);
    if (kept) toast(t("duplicateKept", cnt(kept, locale)));
  }, [commit, t, locale, toast]);
  const resizeFrame = useCallback(
    (id: string, b: { x: number; y: number; w: number; h: number }) => {
      const box = { x: snap(b.x), y: snap(b.y), w: Math.max(64, snap(b.w)), h: Math.max(64, snap(b.h)) };
      commit(
        t("doResizeGroup"),
        live.current.nodes.map((n) => (n.id === id ? { ...n, position: { x: box.x, y: box.y }, width: box.w, height: box.h, data: { ...n.data, size: { w: box.w, h: box.h } } } : n)),
        live.current.edges,
      );
    },
    [commit, t],
  );
  const selectIds = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setNodes((ns) => ns.map((n) => (n.selected === set.has(n.id) ? n : { ...n, selected: set.has(n.id) })));
  }, []);
  /** A card and its children that are not notes, selected (EDT-096's Focus). */
  const focusCard = useCallback(
    (id: string) => {
      const ns = live.current.nodes;
      const kids = live.current.edges.filter((e) => e.source === id).map((e) => e.target).filter((k) => ns.find((n) => n.id === k)?.data.kind !== "note");
      selectIds([id, ...kids]);
    },
    [selectIds],
  );
  const updateFields = useCallback(
    (id: string, label: string, change: (fields: Field[]) => Field[]) =>
      commit(label, live.current.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, fields: change(n.data.fields ?? []) } } : n)), live.current.edges),
    [commit],
  );
  const actions: GraphActions = useMemo(
    () => ({
      editable,
      publishedCopy: !editable && !!guard,
      translit,
      mapView,
      toggleFold: (id) => fold([id]),
      setText: (id, text) =>
        commit(
          t("doEditNote"),
          nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)),
          edges,
        ),
      expand: (id, opts) => void expand(id, opts),
      expanding,
      // fields (EDT-104…107): a new one named for its kind, edited, renamed and removed, each a named step
      templates: (card) => templatesFor(kind, card),
      // a map type's field (B37): empty, once on each card, and a choice's options as the map already has them
      addTemplate: (ids, tplId) => {
        const tpl = templateOf(tplId);
        const label = t(`tpl_${tplId}`);
        const ns = live.current.nodes;
        const shared = ns.flatMap((n) => n.data.fields ?? []).find((f) => f.tpl === tplId)?.options ?? [];
        const to = new Set(ids.filter((id) => ns.some((n) => n.id === id && !(n.data.fields ?? []).some((f) => f.tpl === tplId))));
        if (!to.size) return;
        const field = (): Field => ({ id: crypto.randomUUID().replace(/-/g, "").slice(0, 12), kind: tpl.kind, label, value: tpl.kind === "tags" ? [] : "", tpl: tplId, ...(tpl.kind === "select" ? { options: shared } : {}) });
        commit(
          t("doAddTemplate", { label, ...cnt(to.size, locale) }),
          ns.map((n) => (to.has(n.id) ? { ...n, data: { ...n.data, fields: [...(n.data.fields ?? []), field()] } } : n)),
          live.current.edges,
        );
      },
      addField: (id, kind) => {
        const label = t(`field_${kind}`);
        const field: Field = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 12), kind, label, value: kind === "tags" ? [] : kind === "number" ? 0 : kind === "select" ? t("selectOne") : "", ...(kind === "select" ? { options: [t("selectOne"), t("selectTwo"), t("selectThree")] } : {}) };
        updateFields(id, t("doAddField", { kind: label }), (fs) => [...fs, field]);
      },
      editField: (id, fid, value, fileName) => updateFields(id, t("doEditField"), (fs) => fs.map((f) => (f.id === fid ? { ...f, value, ...(fileName ? { fileName } : {}) } : f))),
      removeField: (id, fid) => updateFields(id, t("doRemoveField"), (fs) => fs.filter((f) => f.id !== fid)),
      attach: (id) => attachNote(id),
      focusCard,
      // a card's place in the map and what it has left to extract (EDT-090, EDT-091, HWF-51)
      stats: (id) => cardStats(id, nodes, edges),
      versePlan: (id, words, particles) => versePlan(id, words, edges, particles),
      toast: (text) => toast(text),
      relations: allowedRels(kind, "root", "root").includes("near-in-meaning"),
      relate: (id) => void relate(id),
      topicVerses: (id) => void addTopicVerses(id),
    }),
    [editable, guard, translit, mapView, fold, nodes, edges, commit, t, expand, expanding, updateFields, attachNote, focusCard, toast, kind, relate, addTopicVerses, locale],
  );
  const frameActions: FrameActions = useMemo(
    () => ({ members: (id) => membersOf(id, nodes), resize: resizeFrame, selectInside: (id) => selectIds(membersOf(id)) }),
    [membersOf, nodes, resizeFrame, selectIds],
  );

  // the canvas's keys (EDT-158…163, EDT-253, EDT-254, EDT-256): undo and redo; select all; fit, 100 %, zoom steps;
  // tidy; fold; extract; link the two picked; step to a card's child, parent or sibling, pan, or nudge with the
  // arrows; clear; and the list of them. Arrow keys are taken before xyflow's own, which moved cards.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inField(e.target) || menuOpen.current) return;
      const at = e.target as HTMLElement;
      const onCanvas = at === document.body || !!at.closest?.(".react-flow");
      // the editor's own keys (⌘A, ⌘D, ⌘G) answer anywhere in the editor outside a field, as the design's do
      const inEditor = onCanvas || !!at.closest?.(".graph-details, .library, .editor-header");
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const sel = live.current.nodes.filter((n) => n.selected);
      // a published copy refuses every edit in one place, and says so (HWF-11): deleting, undoing, duplicating,
      // grouping, cutting and pasting, tidying, extracting and linking; reading, folding and moving about still work
      if (!editable && guard && inEditor && ((mod && "zdxvg".includes(k) && k.length === 1) || (!mod && ["delete", "backspace", "t", "e", "l"].includes(k)))) {
        e.preventDefault();
        toast(guard);
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "d" && editable && inEditor) {
        e.preventDefault();
        duplicate();
      } else if (mod && k === "g" && editable && inEditor) {
        e.preventDefault();
        if (e.shiftKey) ungroup();
        else group();
      } else if (mod && k === "a" && inEditor) {
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
  }, [undo, redo, tidy, fit, rf, onHelp, fold, select, editable, commit, t, ensureVisible, zoomBy, zoomTo, expand, linkPicked, duplicate, group, ungroup, guard, toast]);

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

  const exportJson = useCallback(async () => {
    const doc = {
      version: 2,
      title,
      kind,
      nodes: nodes.map(({ id, position, data }) => ({ id, position, data })),
      edges: edges.map(({ id, source, target, data }) => ({ id, source, target, data })),
      // the files its fields hold, as this browser keeps them: they come back with the import (lib/graph/files)
      files: await bundleFiles(nodes),
    };
    download(URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })), `${fileName}.json`);
    toast(t("exportedCards", cnt(nodes.length, locale)));
  }, [title, kind, nodes, edges, fileName, toast, t, locale]);

  const importCards = useCallback(
    (next: GraphNode[], nextEdges: GraphEdge[], label: string) => {
      commit(label, next, nextEdges);
      const at = steps.current;
      // laid out afresh once the cards are measured, then fitted (EDT-260); the import stays one undo step — and a
      // layout that ends after the reader has undone it, or changed the map, is dropped, never drawn over their step
      setTimeout(() => {
        if (steps.current !== at) return;
        void layout(rf.getNodes(), rf.getEdges()).then((laid) => {
          if (steps.current !== at) return;
          setNodes(laid);
          whenDrawn(fit);
        });
      }, 250);
    },
    [commit, rf, fit, whenDrawn],
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
    tidyRadial: () => void tidy(t("tidyRadial"), undefined, undefined, "radial"),
    fit,
    exportPng: () => void exportPng(),
    exportJson,
    importCards,
    addCards,
    select,
    center,
    whenDrawn,
    toast,
    setMatches,
    cardName,
    renameFrame: (id, title) => commit(t("doRenameGroup"), nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, title: title.slice(0, 200) } } : n)), edges),
    frameMembers: (id) => frameMembers(id, nodes),
    selectIds,
    ungroup,
    renameField: (id, fid, label) => updateFields(id, t("doRenameField"), (fs) => fs.map((f) => (f.id === fid ? { ...f, label } : f))),
    editField: actions.editField,
    removeField: actions.removeField,
    addField: actions.addField,
    templates: actions.templates,
    addTemplate: actions.addTemplate,
    // a choice's options (B37): a map type's field has the same ones on every card; a choice no longer offered is unset
    editOptions: (id, fid, options) => {
      const ns = live.current.nodes;
      const f = ns.find((n) => n.id === id)?.data.fields?.find((x) => x.id === fid);
      if (!f) return;
      const clean = [...new Set(options.map((o) => o.trim()).filter((o) => o && o.length <= 60))].slice(0, 20);
      const same = (n: GraphNode, x: Field) => (f.tpl ? x.tpl === f.tpl : n.id === id && x.id === fid);
      commit(
        t("doEditOptions", { label: f.label }),
        ns.map((n) => ((n.data.fields ?? []).some((x) => same(n, x)) ? { ...n, data: { ...n.data, fields: n.data.fields!.map((x) => (same(n, x) ? { ...x, options: clean, value: clean.includes(String(x.value)) ? x.value : "" } : x)) } } : n)),
        live.current.edges,
      );
    },
    editHeadword: (id, text) => commit(t("doEditHeadword"), nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)), edges),
    setQuoteRun: (id, run) =>
      commit(
        t(run ? "doQuotePassage" : "doQuoteWhole"),
        nodes.map((n) => {
          if (n.id !== id) return n;
          const { run: _old, ...rest } = n.data;
          void _old;
          return { ...n, data: run ? { ...rest, run } : rest };
        }),
        edges,
      ),
    foldTo: (ids, to) => {
      const set = new Set(ids);
      setNodes((ns) => ns.map((n) => (set.has(n.id) && n.data.kind !== "frame" && !!n.data.folded !== to ? { ...n, data: { ...n.data, folded: to } } : n)));
    },
    remove: (ids) => {
      const set = new Set(ids);
      onDelete({ nodes: nodes.filter((n) => set.has(n.id)), edges: edges.filter((e) => set.has(e.source) || set.has(e.target)) });
    },
    unlink: unlinkEdge,
    attachQuote,
    addLinked,
    meaningLinks: allowedRels(kind, "root", "root").includes("near-in-meaning"),
    addRelation: (e, beside, reviewed) => void addRelation(e, beside, reviewed),
    addShared: (id) => void addShared(id),
    addTopic: (tp, sources, ends) => {
      const c = topicCard(tp, sources, locale);
      const label = t("doAddTopic", { name: tp.name });
      if (!ends) return addCards([c], [], label);
      const beside = ends.from === c.id ? ends.to : ends.from;
      addLinked(c, link(ends.from, ends.to, "part-of-topic"), beside, label);
    },
    addEntity: (e, ends) => {
      const c = entityCard(e, locale);
      const label = t("doAddEntity", { name: e.name });
      if (!ends) return addCards([c], [], label);
      const beside = ends.from === c.id ? ends.to : ends.from;
      addLinked(c, link(ends.from, ends.to, "part-of-topic"), beside, label);
    },
    addMyTopic: (tp, keys, verse) => {
      const id = `note:mytopic-${tp.id}`;
      const on = nodes.find((n) => n.id === id);
      const card: GraphNode = on ?? { id, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: tp.label } };
      if (verse) return addLinked(card, link(verseId(verse), id, "part-of-topic"), verseId(verse), t("doAddMyTopic", { name: tp.label }));
      const out = topicVerses(id, keys, on ? nodes : [...nodes, card], edges);
      void tidy(t("doAddMyTopic", { name: tp.label }), { nodes: [...nodes, ...(on ? [] : [card]), ...out.nodes], edges: [...edges, ...out.edges] }, [id, ...out.nodes.map((n) => n.id)]);
    },
    addTopicVerses: (id) => void addTopicVerses(id),
    topicLinks: allowedRels(kind, "verse", "note").includes("part-of-topic"),
    addFieldMember: (e, beside, reviewed) => {
      const fm = fieldMember(e, beside, reviewed, locale);
      if (fm) addLinked(fm.card, fm.edge, beside, t(reviewed ? "doAddFieldMember" : "doAddOwnFieldMember", { word: e.a.word, field: e.sense ?? e.field?.title ?? "" }));
    },
    expanding,
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
        const h = n.data.kind === "note" ? sourceHeading(n.id) : null;
        const kindName = t(h === "topic" ? "kindTopic" : h === "field" ? "kindField" : h === "entity" ? "kindEntity" : n.data.phrase ? "kindPhrase" : n.data.entry ? "kindQuote" : META[n.data.kind].label);
        const ariaLabel = n.data.count != null ? t("cardLabelCount", { kind: kindName, name: cardName(n.id), n: formatNumber(n.data.count, locale) }) : t("cardLabel", { kind: kindName, name: cardName(n.id) });
        if (n.data.kind === "frame") {
          // a frame: its size, behind the cards, moved by its bar (EDT-143, EDT-144)
          const w = n.width ?? n.data.size?.w ?? 420;
          const h = n.height ?? n.data.size?.h ?? 280;
          return { ...n, type: "frame", ariaLabel: t("frameLabel", { name: n.data.title || t("groupUntitled") }), width: w, height: h, zIndex: FRAME_Z, dragHandle: ".frame-bar" };
        }
        const className = matchSet ? (matchSet.has(n.id) ? "is-match" : "is-dim") : undefined;
        return { ...n, ariaLabel, ...(className ? { className } : {}) };
      }),
    [nodes, matchSet, t, cardName, locale],
  );
  const wire: WireContext = useMemo(
    () => ({
      selected: new Set(selected.map((n) => n.id)),
      kindOf: (id: string) => nodes.find((n) => n.id === id)?.data.kind,
      editable,
      unlink: unlinkEdge,
    }),
    [selected, nodes, editable, unlinkEdge],
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
        { label: t("tidyRadialLong"), run: () => void tidy(t("tidyRadial"), undefined, undefined, "radial") },
        { label: t("fit"), keys: "F", run: fit },
      ];
    const card = nodes.find((n) => n.id === menu.on);
    if (!card) return [];
    const sel = nodes.filter((n) => n.selected);
    const many = sel.length > 1 ? sel : [card];
    if (card.data.kind === "frame")
      return [
        { label: t("frameSelectInside"), run: () => selectIds(frameMembers(card.id, nodes)) },
        { label: t("frameUngroup"), keys: "⇧⌘G", run: ungroup },
        { label: t("doDeleteGroups", cnt(1, locale)), keys: "⌫", danger: true, run: () => onDelete({ nodes: [card], edges: [] }) },
      ];
    const cardsSel = many.filter((n) => n.data.kind !== "frame");
    // the design's order (EDT-067): fold, extract, attach, duplicate, group, then the link and the deletion
    return [
      { label: t(card.data.folded ? "unfold" : "fold"), keys: "↵", run: () => fold(many.map((n) => n.id)) },
      ...(card.data.kind !== "note" && cardStats(card.id, nodes, edges).left !== 0 ? [{ label: t(card.data.kind === "verse" ? "menuLink" : card.data.kind === "root" ? "menuExtractPatterns" : card.data.kind === "pattern" ? "menuExtractWords" : "menuExtract"), keys: "E", run: () => void expand(card.id) }] : []),
      ...(card.data.kind !== "note" ? [{ label: t("menuAttachNote"), run: () => attachNote(card.id) }] : []),
      ...(cardsSel.some((n) => n.data.kind === "note") ? [{ label: t("menuDuplicate"), keys: "⌘D", run: duplicate }] : []),
      ...(cardsSel.length > 1 ? [{ label: t("doGroup", cnt(cardsSel.length, locale)), keys: "⌘G", run: group }] : []),
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
    <FrameActionsContext.Provider value={frameActions}>
    <GraphActionsContext.Provider value={actions}>
      <div className="flex h-full w-full min-h-0 min-w-0 flex-col">
        {header ?? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
            {/* inside a page the section's heading names it */}
            {!embedded && <h1 className="min-w-0 truncate px-1 text-[15px] font-semibold">{title}</h1>}
            {status}
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              {editable ? (
                <div className="seg-group">
                  <button type="button" className="seg" onClick={() => void tidy()} aria-keyshortcuts="T">{t("tidy")}</button>
                  <button type="button" className="seg" onClick={fit} aria-keyshortcuts="F">{t("fit")}</button>
                </div>
              ) : (
                // a read-only map is read, not rearranged: its cards folded or opened, and the whole of it in view (F17)
                <div className="seg-group">
                  <button type="button" className="seg" onClick={() => tools.foldTo(nodes.filter((n) => n.data.kind !== "frame").map((n) => n.id), true)} title={t("foldEveryHint")}>{t("foldAll")}</button>
                  <button type="button" className="seg" onClick={() => tools.foldTo(nodes.filter((n) => n.data.kind !== "frame").map((n) => n.id), false)} title={t("unfoldEveryHint")}>{t("unfoldAll")}</button>
                  <button type="button" className="seg" onClick={fit} aria-keyshortcuts="F">{t("fit")}</button>
                </div>
              )}
              {/* a map inside a page keeps to what explores it; the full map has the rest; a read-only one has no undo */}
              {!embedded && editable && (
                <>
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
                </>
              )}
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
            <RelationInfo edge={selectedEdge} tools={tools} />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {start}
          <div
            ref={wrapper}
            className={"graph-canvas relative min-h-0 flex-1" + (gliding ? " is-gliding" : "") + (editable ? "" : " is-readonly")}
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
              panOnScroll={!embedded}
              preventScrolling={!embedded}
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
              onNodeDragStart={(_, __, dragged) => {
                dragStart.current = nodes;
                // a frame carries the cards wholly inside it when the drag began (HWF-29), measured from where it was
                // before the first step (xyflow reports the drag once it has already moved)
                const before = new Map(nodes.map((n) => [n.id, n.position]));
                carried.current = new Map(
                  dragged
                    .filter((n) => n.data.kind === "frame")
                    .flatMap((f) => frameMembers(f.id, nodes).map((id) => [id, { from: before.get(id)!, frame: f.id, start: before.get(f.id) ?? f.position }] as const)),
                );
              }}
              onNodeDrag={(_, __, dragged) => {
                if (!carried.current.size) return;
                const at = new Map(dragged.map((n) => [n.id, n.position]));
                setNodes((ns) =>
                  ns.map((n) => {
                    const c = carried.current.get(n.id);
                    const f = c && at.get(c.frame);
                    return c && f ? { ...n, position: { x: c.from.x + f.x - c.start.x, y: c.from.y + f.y - c.start.y } } : n;
                  }),
                );
              }}
              onNodeDragStop={(_, __, dragged) => {
                const before = dragStart.current;
                dragStart.current = null;
                carried.current = new Map();
                if (!before) return;
                const was = new Map(before.map((n) => [n.id, n.position]));
                const moved = dragged.filter((n) => {
                  const p = was.get(n.id);
                  return p && (Math.round(p.x) !== Math.round(n.position.x) || Math.round(p.y) !== Math.round(n.position.y));
                });
                if (!moved.length) return;
                steps.current++;
                setPast((p) => [...p.slice(-80), { label: t("doMove", cnt(moved.length, locale)), nodes: before, edges }]);
                setFuture([]);
              }}
              nodesConnectable={editable}
              nodesDraggable={editable || draggable}
              elementsSelectable
              deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
              zoomOnDoubleClick={false}
              minZoom={0.15}
              maxZoom={2}
              fitView={!autoLayout}
              fitViewOptions={focusIds.length ? { nodes: focusIds, padding: 0.25, minZoom: 0.6, maxZoom: 1 } : { maxZoom: 1 }}
              proOptions={{ hideAttribution: false }}
              // the credit at the corner the zoom pill leaves free
              attributionPosition="bottom-left"
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
    </FrameActionsContext.Provider>
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
