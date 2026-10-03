"use client";

import { getJSON } from "@/lib/reader/api";
import type { WordPayload } from "@/lib/reader/types";
import type { Verse } from "@/lib/types";
import { buildRootGraph, edgeId, lemmaId, POS_AR, rootId, verseId, wordId, type RootGraphPayload } from "./build";
import { layout } from "./layout";
import { createGraph, loadGraph, saveGraph } from "./persist";
import type { Seed } from "./seedCodec";
import type { GraphEdge, GraphKind, GraphNode, NodeKind, VerseExcerpt } from "./types";

/** The cards a seed becomes, before they are laid out and stored. The title is a message key with values. */
export type SeedGraph = {
  kind: GraphKind;
  title: { key: "rootTitle" | "wordTitle" | "verseTitle" | "trailTitle" | "phraseTitle"; values: Record<string, string> };
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type RootSummary = { key: string; spaced: string; translit: string; occurrences: number };

let surahNamesP: Promise<Map<number, string>> | null = null;
function surahNames(): Promise<Map<number, string>> {
  surahNamesP ??= getJSON<{ data: { number: number; name_ar: string }[] }>("/surahs").then((d) => new Map(d.data.map((s) => [s.number, s.name_ar])));
  return surahNamesP;
}

async function rootSummaries(keys: string[]): Promise<Map<string, RootSummary>> {
  if (!keys.length) return new Map();
  const d = await getJSON<{ data: RootSummary[] }>(`/roots?keys=${encodeURIComponent(keys.join(","))}&limit=${keys.length}`);
  return new Map(d.data.map((r) => [r.key, r]));
}

function excerpt(v: Verse, surahName: string, from?: number, to?: number, location?: string): VerseExcerpt {
  const toks = v.tokens.map((t) => t.text);
  if (from == null || to == null) return { key: v.key, surahName, left: toks.join(" "), word: "", right: "" };
  return { key: v.key, surahName, left: toks.slice(0, from - 1).join(" "), word: toks.slice(from - 1, to).join(" "), right: toks.slice(to).join(" "), location };
}

const card = (id: string, kind: NodeKind, data: Omit<GraphNode["data"], "kind">): GraphNode => ({ id, type: "card", position: { x: 0, y: 0 }, data: { kind, ...data } });
const link = (source: string, target: string, label?: string): GraphEdge => ({ id: edgeId(source, target), source, target, ...(label ? { data: { label }, label } : {}) });
const spaced = (key: string) => key.split("").join(" ");

/** A word seed: its root at the centre, the patterns built on it, the family words, and the verse it came from. */
async function wordSeed(slug: string, at: string | null | undefined): Promise<SeedGraph> {
  const w = await getJSON<WordPayload>(`/words/${encodeURIComponent(slug)}?limit=0${at ? `&at=${at}` : ""}`);
  const occ = w.occurrence;
  const title = { key: "wordTitle" as const, values: { word: occ?.surface.full ?? w.ar.full } };
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  let wordCard: string;
  if (w.root) {
    const g = await getJSON<RootGraphPayload>(`/roots/${encodeURIComponent(w.root.key)}/graph`);
    ({ nodes, edges } = buildRootGraph(g, { focus: { lemmaSlug: w.slug, form: occ?.surface_imlaei ?? null } }));
    wordCard = occ?.surface_imlaei ? wordId(w.lemma_id, occ.surface_imlaei) : lemmaId(w.lemma_id);
  } else {
    // a particle or pronoun has no root (L2): its own card, never a pseudo-root
    wordCard = lemmaId(w.lemma_id);
    nodes.push(card(wordCard, "lemma", { ar: w.ar.full, sub: POS_AR[w.pos.tag] ?? w.pos.ar ?? w.pos.tag, count: w.corpus_freq, lemmaId: w.lemma_id, focus: true }));
  }
  if (occ) {
    const [v, names] = await Promise.all([getJSON<Verse>(`/verses/${occ.verse_key}`), surahNames()]);
    const vid = verseId(occ.location);
    nodes.push(card(vid, "verse", { ar: occ.verse_key, verse: excerpt(v, names.get(v.surah) ?? "", occ.token_from, occ.token_to, occ.location), focus: true }));
    if (nodes.some((n) => n.id === wordCard)) edges.push(link(wordCard, vid));
  }
  return { kind: "root", title, nodes, edges };
}

async function rootSeed(root: string): Promise<SeedGraph> {
  const g = await getJSON<RootGraphPayload>(`/roots/${encodeURIComponent(root)}/graph`);
  return { kind: "root", title: { key: "rootTitle", values: { root: g.root.spaced } }, ...buildRootGraph(g) };
}

/** A verse seed: the verse as one card, linked to every word with a root, its lemma and its root. */
async function verseSeed(key: string): Promise<SeedGraph> {
  const [v, names] = await Promise.all([getJSON<Verse>(`/verses/${key}`), surahNames()]);
  const name = names.get(v.surah) ?? "";
  const words = v.words.filter((w) => w.root && w.lemma_id != null);
  const roots = await rootSummaries([...new Set(words.map((w) => w.root!))]);
  const vid = `verse:${v.key}`;
  const nodes = new Map<string, GraphNode>([[vid, card(vid, "verse", { ar: v.key, verse: excerpt(v, name), focus: true })]]);
  const edges = new Map<string, GraphEdge>();
  const add = (n: GraphNode) => nodes.has(n.id) || nodes.set(n.id, n);
  const join = (e: GraphEdge) => edges.has(e.id) || edges.set(e.id, e);
  for (const w of words) {
    const r = roots.get(w.root!);
    const rid = rootId(w.root!);
    const lid = lemmaId(w.lemma_id!);
    const wid = wordId(w.lemma_id!, w.text_imlaei);
    add(card(rid, "root", { ar: r?.spaced ?? spaced(w.root!), sub: r?.translit, count: r?.occurrences, rootKey: w.root! }));
    add(card(lid, "lemma", { ar: w.lemma ?? w.text_imlaei, sub: POS_AR[w.pos] ?? w.pos, rootKey: w.root!, lemmaId: w.lemma_id! }));
    add(card(wid, "word", { ar: w.text_uthmani, sub: w.text_imlaei, rootKey: w.root!, lemmaId: w.lemma_id!, form: w.text_imlaei, verse: excerpt(v, name, w.token_from, w.token_to, w.location) }));
    join(link(rid, lid));
    join(link(lid, wid));
    join(link(wid, vid));
  }
  return { kind: "free", title: { key: "verseTitle", values: { name, ayah: String(v.ayah), key: v.key } }, nodes: [...nodes.values()], edges: [...edges.values()] };
}

/**
 * A trail seed: each step as a card in the order it was taken, numbered along the way; words keep their roots.
 * With a phrase (the Analyser's, ANA-22), the phrase is a sentence card holding its words instead of a path.
 */
async function trailSeed(steps: { kind: "word" | "verse" | "root"; id: string }[], phrase?: string): Promise<SeedGraph> {
  const seen = new Set<string>();
  const unique = steps.filter((s) => !seen.has(`${s.kind}:${s.id}`) && seen.add(`${s.kind}:${s.id}`));
  const names = await surahNames();
  const words = await Promise.all(unique.map((s) => (s.kind === "word" ? getJSON<WordPayload>(`/words/${encodeURIComponent(s.id)}?limit=0`).catch(() => null) : null)));
  const verses = await Promise.all(unique.map((s) => (s.kind === "verse" ? getJSON<Verse>(`/verses/${s.id}`).catch(() => null) : null)));
  const rootKeys = [...new Set([...unique.filter((s) => s.kind === "root").map((s) => s.id), ...words.flatMap((w) => (w?.root ? [w.root.key] : []))])];
  const roots = await rootSummaries(rootKeys);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const rootCard = (key: string) => {
    const r = roots.get(key);
    const id = rootId(key);
    if (!nodes.has(id)) nodes.set(id, card(id, "root", { ar: r?.spaced ?? spaced(key), sub: r?.translit, count: r?.occurrences, rootKey: key }));
    return id;
  };
  const path: string[] = [];
  unique.forEach((s, i) => {
    if (s.kind === "root" && roots.has(s.id)) path.push(rootCard(s.id));
    const w = words[i];
    if (w) {
      const id = lemmaId(w.lemma_id);
      nodes.set(id, card(id, "lemma", { ar: w.ar.full, sub: w.ar.translit, count: w.corpus_freq, rootKey: w.root?.key, lemmaId: w.lemma_id }));
      if (w.root) {
        const rid = rootCard(w.root.key);
        edges.set(edgeId(rid, id), link(rid, id));
      }
      path.push(id);
    }
    const v = verses[i];
    if (v) {
      const id = `verse:${v.key}`;
      nodes.set(id, card(id, "verse", { ar: v.key, verse: excerpt(v, names.get(v.surah) ?? "") }));
      path.push(id);
    }
  });
  if (phrase) {
    // a sentence card without a verse: the reader's own phrase, linked to each of its words
    // its id from its text: the same phrase is one card, two phrases on one map are two
    const pid = `phrase:${[...phrase].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7).toString(36)}`;
    nodes.set(pid, card(pid, "verse", { ar: phrase }));
    for (const id of new Set(path)) edges.set(edgeId(pid, id), link(pid, id));
    const head = phrase.split(/\s+/).slice(0, 4).join(" ");
    return { kind: "free", title: { key: "phraseTitle", values: { phrase: phrase.split(/\s+/).length > 4 ? `${head}…` : head } }, nodes: [...nodes.values()], edges: [...edges.values()] };
  }
  for (let i = 1; i < path.length; i++) {
    const e = link(path[i - 1], path[i], String(i));
    if (path[i - 1] !== path[i] && !edges.has(e.id)) edges.set(e.id, e);
  }
  return { kind: "free", title: { key: "trailTitle", values: { n: String(path.length) } }, nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function buildSeedGraph(seed: Seed): Promise<SeedGraph> {
  switch (seed.seed) {
    case "word":
      return wordSeed(seed.slug, seed.at);
    case "root":
      return rootSeed(seed.root);
    case "verse":
      return verseSeed(seed.key);
    case "trail":
      return trailSeed(seed.steps, seed.phrase);
  }
}

/** Counts per card kind with a few names each — the hand-off's "cards that will be created" (RDR-364). */
export function seedRows(g: SeedGraph): { kind: NodeKind; n: number; detail: string }[] {
  const order: NodeKind[] = ["root", "lemma", "word", "verse"];
  return order
    .map((kind) => {
      const of = g.nodes.filter((n) => n.data.kind === kind);
      const detail = of.slice(0, 8).map((n) => (kind === "verse" ? n.data.verse?.key ?? n.data.ar : n.data.ar)).join("  •  ");
      return { kind, n: of.length, detail };
    })
    .filter((r) => r.n > 0);
}

/**
 * Lay the cards out and store them: as a new graph, or added to an existing one without moving or
 * replacing anything already on it (RDR-367) — new cards go below the existing ones, right-aligned, as
 * the canvas reads right to left. Returns the graph's id.
 */
export async function saveSeedGraph(g: SeedGraph, title: string, into: string | null): Promise<string> {
  const existing = into ? await loadGraph(into) : undefined;
  if (!existing) {
    const laid = await layout(g.nodes, g.edges);
    return createGraph({ title, kind: g.kind, nodes: laid, edges: g.edges, pendingLayout: true });
  }
  const have = new Set(existing.nodes.map((n) => n.id));
  const fresh = g.nodes.filter((n) => !have.has(n.id));
  const all = new Set([...have, ...fresh.map((n) => n.id)]);
  const haveEdges = new Set(existing.edges.map((e) => e.id));
  const newEdges = g.edges.filter((e) => !haveEdges.has(e.id) && all.has(e.source) && all.has(e.target));
  const laid = await layout(fresh, newEdges.filter((e) => !have.has(e.source) && !have.has(e.target)));
  if (laid.length && existing.nodes.length) {
    const bottom = Math.max(...existing.nodes.map((n) => n.position.y + (n.measured?.height ?? 180)));
    const right = Math.max(...existing.nodes.map((n) => n.position.x + (n.measured?.width ?? 260)));
    const top = Math.min(...laid.map((n) => n.position.y));
    const newRight = Math.max(...laid.map((n) => n.position.x + 260));
    for (const n of laid) n.position = { x: n.position.x + (right - newRight), y: n.position.y - top + bottom + 160 };
  }
  await saveGraph({ ...existing, nodes: [...existing.nodes, ...laid], edges: [...existing.edges, ...newEdges] });
  return existing.id;
}
