"use client";

import { REVIEW_BELOW } from "@/lib/analyse";
import { getJSON } from "@/lib/reader/api";
import type { WordPayload } from "@/lib/reader/types";
import type { Verse } from "@/lib/types";
import { buildRootGraph, lemmaId, link, POS_AR, rootId, verseId, type RootGraphPayload } from "./build";
import { layout } from "./layout";
import { notebookLoaded, useNotebook } from "@/lib/store/notebook";
import { noteOn, useSaved } from "@/lib/store/saved";
import { createGraph, loadGraph, saveGraph } from "./persist";
import { loadEntry } from "./quote";
import type { Seed, TrailSeedStep } from "./seedCodec";
import type { GraphEdge, GraphKind, GraphNode, NodeKind } from "./types";

/** The cards a seed becomes, before they are laid out and stored. The title is a message key with values. */
export type SeedGraph = {
  kind: GraphKind;
  /** numbers stay numbers here, written in the reader's digits where the title is made (SeedImport) */
  title: { key: "rootTitle" | "wordTitle" | "verseTitle" | "trailTitle" | "phraseTitle" | "setTitle" | "quoteTitle" | "noteTitle"; values: Record<string, string | number> };
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

const card = (id: string, kind: NodeKind, data: Omit<GraphNode["data"], "kind">): GraphNode => ({ id, type: "card", position: { x: 0, y: 0 }, data: { kind, ...data } });
const spaced = (key: string) => key.split("").join(" ");
/** a verse card, with the words to mark in it */
const verseCard = (key: string, places: string[], extra: Omit<GraphNode["data"], "kind" | "verse" | "places"> = {}) =>
  card(verseId(key), "verse", { verse: { key }, ...(places.length ? { places } : {}), ...extra });

/** A word seed: its root at the centre with the words of its family, the word itself marked, and the verse it came from. */
async function wordSeed(slug: string, at: string | null | undefined): Promise<SeedGraph> {
  const w = await getJSON<WordPayload>(`/words/${encodeURIComponent(slug)}?limit=0${at ? `&at=${at}` : ""}`);
  const occ = w.occurrence;
  const title = { key: "wordTitle" as const, values: { word: occ?.surface.full ?? w.ar.full } };
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  const lid = lemmaId(w.slug);
  if (w.root) {
    const g = await getJSON<RootGraphPayload>(`/roots/${encodeURIComponent(w.root.key)}/graph`);
    ({ nodes, edges } = buildRootGraph(g, { focus: { lemmaSlug: w.slug } }));
  } else {
    // a particle or pronoun has no root (L2): its own card, never a pseudo-root
    nodes.push(card(lid, "lemma", { slug: w.slug, ar: w.ar.full, sub: POS_AR[w.pos.tag] ?? w.pos.ar ?? w.pos.tag, count: w.corpus_freq, focus: true }));
  }
  if (occ) {
    nodes.push(verseCard(occ.verse_key, [occ.location], { focus: true }));
    if (nodes.some((n) => n.id === lid)) edges.push(link(lid, verseId(occ.verse_key), "attests", { place: occ.location }));
  }
  return { kind: "root", title, nodes, edges };
}

async function rootSeed(root: string): Promise<SeedGraph> {
  const g = await getJSON<RootGraphPayload>(`/roots/${encodeURIComponent(root)}/graph`);
  return { kind: "root", title: { key: "rootTitle", values: { root: g.root.spaced } }, ...buildRootGraph(g) };
}

/** A verse seed: the verse as one card, each of its words with a root linked to it at its place, with its root. */
async function verseSeed(key: string): Promise<SeedGraph> {
  const [v, names] = await Promise.all([getJSON<Verse>(`/verses/${key}`), surahNames()]);
  const name = names.get(v.surah) ?? "";
  const words = v.words.filter((w) => w.root && w.lemma_slug);
  const roots = await rootSummaries([...new Set(words.map((w) => w.root!))]);
  const vid = verseId(v.key);
  const nodes = new Map<string, GraphNode>([[vid, verseCard(v.key, [], { focus: true })]]);
  const edges = new Map<string, GraphEdge>();
  const add = (n: GraphNode) => nodes.has(n.id) || nodes.set(n.id, n);
  const join = (e: GraphEdge) => edges.has(e.id) || edges.set(e.id, e);
  for (const w of words) {
    const r = roots.get(w.root!);
    const rid = rootId(w.root!);
    const lid = lemmaId(w.lemma_slug!);
    add(card(rid, "root", { ar: r?.spaced ?? spaced(w.root!), sub: r?.translit, count: r?.occurrences, rootKey: w.root! }));
    add(card(lid, "lemma", { slug: w.lemma_slug!, ar: w.lemma ?? w.text_imlaei, sub: POS_AR[w.pos] ?? w.pos, rootKey: w.root!, first: w.location }));
    join(link(rid, lid, "derives"));
    join(link(lid, vid, "attests", { place: w.location }));
  }
  return { kind: "free", title: { key: "verseTitle", values: { name, ayah: v.ayah, key: v.key } }, nodes: [...nodes.values()], edges: [...edges.values()] };
}

/**
 * A trail seed: each step as a card in the order it was taken, numbered along the way; words keep their roots.
 * With a phrase (the Analyser's, ANA-22), the phrase is the reader's note holding its words instead of a path.
 */
async function trailSeed(steps: TrailSeedStep[], phrase?: string, set?: string): Promise<SeedGraph> {
  // a word read from the reader's text with less than REVIEW_BELOW confidence, and kept by them, is a reading (F4);
  // the same word read surely elsewhere in the text, or from the corpus, is not
  const unsure = new Map<string, number>();
  const sure = new Set<string>();
  for (const s of steps.filter((x) => x.kind === "word")) {
    if (s.conf == null || s.conf >= REVIEW_BELOW) sure.add(s.id);
    else unsure.set(s.id, Math.max(unsure.get(s.id) ?? 0, s.conf));
  }
  const readingOf = (slug: string) => (sure.has(slug) ? undefined : unsure.get(slug));
  const seen = new Set<string>();
  const unique = steps.filter((s) => !seen.has(`${s.kind}:${s.id}`) && seen.add(`${s.kind}:${s.id}`));
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
  const readings = new Set<string>();
  const surelyRooted = new Set<string>();
  unique.forEach((s, i) => {
    if (s.kind === "root" && roots.has(s.id)) {
      path.push(rootCard(s.id));
      surelyRooted.add(rootId(s.id));
    }
    const w = words[i];
    if (w) {
      const id = lemmaId(w.slug);
      const conf = readingOf(s.id);
      nodes.set(id, card(id, "lemma", { slug: w.slug, ar: w.ar.full, sub: w.ar.translit, count: w.corpus_freq, rootKey: w.root?.key, ...(conf != null ? { reading: { conf } } : {}) }));
      if (conf != null) readings.add(id);
      if (w.root) {
        const rid = rootCard(w.root.key);
        const e = link(rid, id, "derives", conf != null ? { reading: true } : {});
        edges.set(e.id, e);
        if (conf == null) surelyRooted.add(rid);
      }
      path.push(id);
    }
    const v = verses[i];
    if (v) {
      const id = verseId(v.key);
      nodes.set(id, verseCard(v.key, []));
      path.push(id);
    }
  });
  if (phrase) {
    // the reader's own phrase is their text: a note, linked to each of its words; its id from its text, so the
    // same phrase is one card and two phrases on one map are two
    const pid = `phrase:${[...phrase].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7).toString(36)}`;
    nodes.set(pid, card(pid, "note", { text: phrase, phrase: true }));
    for (const id of new Set(path)) {
      const e = link(pid, id, "describes", readings.has(id) ? { reading: true } : {});
      edges.set(e.id, e);
    }
    // a root reached only through readings is a reading too, as sure as the surest of them
    for (const n of nodes.values())
      if (n.data.kind === "root" && !surelyRooted.has(n.id)) {
        const confs = [...edges.values()].filter((e) => e.source === n.id).map((e) => nodes.get(e.target)?.data.reading?.conf ?? 1);
        if (confs.length) n.data.reading = { conf: Math.max(...confs) };
      }
    const head = phrase.split(/\s+/).slice(0, 4).join(" ");
    return { kind: "free", title: { key: "phraseTitle", values: { phrase: phrase.split(/\s+/).length > 4 ? `${head}…` : head } }, nodes: [...nodes.values()], edges: [...edges.values()] };
  }
  // a set is not a path: its cards stand together, with no numbered links (F12)
  if (set) return { kind: "free", title: { key: "setTitle", values: { name: set } }, nodes: [...nodes.values()], edges: [...edges.values()] };
  for (let i = 1; i < path.length; i++) {
    const e = link(path[i - 1], path[i], "next", { label: String(i) });
    if (path[i - 1] !== path[i] && !edges.has(e.id)) edges.set(e.id, e);
  }
  return { kind: "free", title: { key: "trailTitle", values: { count: path.length } }, nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** A quoted article: the note that quotes it, by its id, describing its root (RDR-239). */
async function quoteSeed(entry: number): Promise<SeedGraph> {
  const e = await loadEntry(entry);
  const r = (await rootSummaries([e.root_key])).get(e.root_key);
  const rid = rootId(e.root_key);
  const qid = `quote:${entry}`;
  return {
    kind: "root",
    title: { key: "quoteTitle", values: { work: e.title_ar, workEn: e.title_en, root: r?.spaced ?? spaced(e.root_key) } },
    nodes: [card(qid, "note", { entry, focus: true }), card(rid, "root", { ar: r?.spaced ?? spaced(e.root_key), sub: r?.translit, count: r?.occurrences, rootKey: e.root_key })],
    edges: [link(qid, rid, "describes")],
  };
}

/** The Notebook note a seed names is not in this browser (another device, or deleted since). */
export class NoteMissing extends Error {}

/** The longest text a note card keeps (lib/graph/sanitize) */
const MAX_NOTE = 20_000;

/**
 * A Notebook note (NTB-22): its title and body as the reader's note, read from this browser, describing what its
 * @-mentions resolve to — its roots, words and verses as cards, each word with its root.
 */
async function noteSeed(id: string): Promise<SeedGraph> {
  if (id.startsWith("v:")) {
    // a verse's note: the note describing its verse
    const key = id.slice(2);
    const v = noteOn(useSaved.getState(), key);
    if (!v?.text.trim()) throw new NoteMissing();
    const nid = `note:nb-v-${key}`;
    const text = v.text.trim().length > MAX_NOTE ? `${v.text.trim().slice(0, MAX_NOTE - 2)} …` : v.text.trim();
    return {
      kind: "free",
      title: { key: "noteTitle", values: { title: text.split(/\s+/).slice(0, 4).join(" ") } },
      nodes: [card(nid, "note", { text, focus: true }), verseCard(key, [])],
      edges: [link(nid, verseId(key), "describes")],
    };
  }
  if (!(await notebookLoaded())) throw new NoteMissing();
  const n = useNotebook.getState().notes.find((x) => x.id === id);
  if (!n) throw new NoteMissing();
  const words = n.links.words ?? [];
  const steps: TrailSeedStep[] = [
    ...n.links.roots.map((k) => ({ kind: "root" as const, id: k })),
    ...words.map((w) => ({ kind: "word" as const, id: w })),
    ...n.links.verses.map((v) => ({ kind: "verse" as const, id: v })),
  ];
  const g = steps.length ? await trailSeed(steps, undefined, n.title || "note") : { nodes: [], edges: [] };
  const nid = `note:nb-${id}`;
  const whole = [n.title.trim(), n.body.trim()].filter(Boolean).join("\n\n");
  const text = whole.length > MAX_NOTE ? `${whole.slice(0, MAX_NOTE - 2)} …` : whole;
  const mentioned = new Set([...n.links.roots.map(rootId), ...words.map(lemmaId), ...n.links.verses.map(verseId)]);
  const head = n.title.trim() || n.body.trim().split(/\s+/).slice(0, 4).join(" ");
  return {
    kind: "free",
    title: { key: "noteTitle", values: { title: head.length > 60 ? `${head.slice(0, 60)}…` : head } },
    nodes: [card(nid, "note", { text, focus: true }), ...g.nodes],
    edges: [...g.nodes.filter((x) => mentioned.has(x.id)).map((x) => link(nid, x.id, "describes")), ...g.edges],
  };
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
    case "set":
      return trailSeed(seed.steps, undefined, seed.name);
    case "quote":
      return quoteSeed(seed.entry);
    case "note":
      return noteSeed(seed.note);
  }
}

/** Counts per card kind with a few names each — the hand-off's "cards that will be created" (RDR-364). */
export function seedRows(g: SeedGraph): { kind: NodeKind; n: number; detail: string }[] {
  const order: NodeKind[] = ["note", "root", "pattern", "lemma", "verse"];
  // a note shows its first words; a quotation, the work it quotes
  const noteName = (n: GraphNode) => (n.data.entry ? String(g.title.values.work ?? "") : (n.data.text ?? "").replace(/\s+/g, " ").slice(0, 48));
  return order
    .map((kind) => {
      const of = g.nodes.filter((n) => n.data.kind === kind);
      const detail = of.slice(0, 8).map((n) => (kind === "verse" ? n.data.verse?.key ?? n.data.ar : kind === "note" ? noteName(n) : n.data.ar)).join("  •  ");
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
  // a verse already on the map takes the places the seed marks in it, and stays where it is (F5)
  const marks = new Map(g.nodes.filter((n) => have.has(n.id) && n.data.places?.length).map((n) => [n.id, n.data.places!]));
  const kept = existing.nodes.map((n) => (marks.has(n.id) ? { ...n, data: { ...n.data, places: [...new Set([...(n.data.places ?? []), ...marks.get(n.id)!])] } } : n));
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
  await saveGraph({ ...existing, nodes: [...kept, ...laid], edges: [...existing.edges, ...newEdges] });
  return existing.id;
}
