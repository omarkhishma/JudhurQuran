import { getJSON } from "@/lib/reader/api";
import { firstPlace } from "./build";
import { inferRel } from "./relations";
import { cleanGraph, conf, coord, edgeKey, int, LOCATION, str, VERSE_KEY, type Cleaned } from "./sanitize";
import type { GraphEdge, GraphKind, GraphNode, GraphNodeData, NodeKind } from "./types";

/**
 * Version-1 maps, read as version 2 (P8.1a): in this browser, from another device through sync, from a file and
 * from a share link. Version 1 keyed a lemma by its database id, which a later release may change, had a card for
 * each written form of a word, and keyed a verse by a word's place or by its key, so one word or verse could sit
 * on a map twice (F5). Here a lemma is keyed by its slug (`GET /lemmas?ids=`), a written form's card folds into its
 * lemma's, and a verse is one card `verse:{s}:{a}` that marks the places its cards stood for; each link gets the
 * relation its kinds imply in the map's type. Nothing is written back until the reader changes the map.
 */

type V1Kind = "root" | "lemma" | "word" | "verse" | "note";
type V1Data = {
  kind: V1Kind;
  ar?: string;
  sub?: string;
  count?: number;
  rootKey?: string;
  usul?: GraphNodeData["usul"];
  lemmaId?: number;
  form?: string;
  verse?: { key: string; location?: string };
  text?: string;
  folded?: true;
  focus?: true;
  reading?: { conf: number };
};
type V1Node = { id: string; position: { x: number; y: number }; data: V1Data };

function v1Data(raw: unknown): V1Data | null {
  const d = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!d || !["root", "lemma", "word", "verse", "note"].includes(d.kind as string)) return null;
  const v = d.verse as Record<string, unknown> | undefined;
  const key = v && typeof v.key === "string" && VERSE_KEY.test(v.key) ? v.key : undefined;
  const location = key && typeof v?.location === "string" && LOCATION.test(v.location) && v.location.startsWith(`${key}:`) ? v.location : undefined;
  const c = conf((d.reading as Record<string, unknown> | undefined)?.conf);
  return {
    kind: d.kind as V1Kind,
    ar: str(d.ar, 600),
    sub: str(d.sub, 200),
    count: int(d.count, 0, 10_000_000),
    rootKey: str(d.rootKey, 12),
    usul: d.usul === "one" || d.usul === "several" || d.usul === "unrelated" ? d.usul : undefined,
    lemmaId: int(d.lemmaId, 0, 100_000_000),
    form: str(d.form, 60),
    verse: key ? { key, ...(location ? { location } : {}) } : undefined,
    text: str(d.text, 20_000),
    folded: d.folded === true ? true : undefined,
    focus: d.focus === true ? true : undefined,
    reading: c !== undefined ? { conf: c } : undefined,
  };
}

type LemmaRef = { id: number; slug: string; ar: string; root: string | null; pos: string };

/** Lemma slugs by database id, as many per request as the API takes. */
export async function lemmaSlugs(ids: number[]): Promise<Map<number, LemmaRef>> {
  const out = new Map<number, LemmaRef>();
  for (let i = 0; i < ids.length; i += 200) {
    const d = await getJSON<{ data: LemmaRef[] }>(`/lemmas?ids=${ids.slice(i, i + 200).join(",")}`);
    for (const l of d.data) out.set(l.id, l);
  }
  return out;
}

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;


/** A version-1 map's cards and links as version 2. */
export async function migrateV1(type: GraphKind, rawNodes: unknown[], rawEdges: unknown[], lookup = lemmaSlugs): Promise<Cleaned> {
  const v1: V1Node[] = [];
  for (const raw of rawNodes.slice(0, 2000)) {
    const n = raw as Record<string, unknown> | null;
    const data = n ? v1Data(n.data) : null;
    const id = n ? str(n.id, 200) : undefined;
    if (!n || !id || !data) continue;
    const p = (n.position ?? {}) as Record<string, unknown>;
    v1.push({ id, position: { x: coord(p.x), y: coord(p.y) }, data });
  }
  const ids = [...new Set(v1.flatMap((n) => (n.data.kind === "lemma" || n.data.kind === "word") && n.data.lemmaId != null ? [n.data.lemmaId] : []))];
  const lemmas = ids.length ? await lookup(ids) : new Map<number, LemmaRef>();

  const out = new Map<string, GraphNode>();
  const idMap = new Map<string, string>(); // a version-1 id → its card now
  const placeOf = new Map<string, string>(); // a version-1 word or occurrence card → the place it stood for
  const put = (id: string, kind: NodeKind, at: V1Node, data: Omit<GraphNodeData, "kind">) => {
    const had = out.get(id);
    if (!had) out.set(id, { id, type: "card", position: at.position, data: clean({ kind, ...data }) });
    else {
      // the same thing twice in version 1 (F5): one card, its marks joined
      const d = had.data;
      if (data.places) d.places = [...new Set([...(d.places ?? []), ...data.places])];
      if (data.focus) d.focus = true;
      if (data.first) d.first = firstPlace(d.first, data.first);
      if (data.forms) d.forms = [...(d.forms ?? []), ...data.forms.filter((f) => !d.forms?.some((g) => g.form === f.form))];
      for (const k of ["ar", "sub", "count", "rootKey"] as const) if (d[k] === undefined && data[k] !== undefined) (d as Record<string, unknown>)[k] = data[k];
    }
    idMap.set(at.id, id);
  };

  for (const n of v1) {
    const d = n.data;
    if (d.kind === "root") {
      const key = d.rootKey ?? (n.id.startsWith("root:") ? n.id.slice(5) : undefined);
      if (key) put(`root:${key}`, "root", n, { ar: d.ar, sub: d.sub, count: d.count, rootKey: key, usul: d.usul, folded: d.folded, focus: d.focus, reading: d.reading });
    } else if (d.kind === "lemma" || d.kind === "word") {
      const ref = d.lemmaId != null ? lemmas.get(d.lemmaId) : undefined;
      if (!ref) continue; // a lemma this release does not hold: its card cannot be read as one
      const word = d.kind === "word";
      put(`lemma:${ref.slug}`, "lemma", n, {
        slug: ref.slug,
        ar: word ? ref.ar : (d.ar ?? ref.ar),
        sub: word ? undefined : d.sub,
        count: word ? undefined : d.count,
        rootKey: d.rootKey ?? ref.root ?? undefined,
        forms: word && d.form ? [{ form: d.form, count: d.count ?? 0 }] : undefined,
        first: word ? d.verse?.location : undefined,
        folded: d.folded,
        focus: d.focus,
        reading: d.reading,
      });
      if (word && d.verse?.location) placeOf.set(n.id, d.verse.location);
    } else if (d.kind === "verse" && d.verse) {
      put(`verse:${d.verse.key}`, "verse", n, { verse: { key: d.verse.key }, places: d.verse.location ? [d.verse.location] : undefined, folded: d.folded, focus: d.focus });
      if (d.verse.location) placeOf.set(n.id, d.verse.location);
    } else if (d.kind === "verse") {
      // the reader's own phrase was a verse card with no verse: it is their text, a note
      put(n.id, "note", n, { text: d.ar, phrase: true, folded: d.folded, focus: d.focus });
    } else {
      put(n.id, "note", n, { text: d.text, folded: d.folded });
    }
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  // what could not be read as a card or a link, counted for the import's report (a word folded into its lemma
  // and a link folded with it are not lost)
  let unread = rawNodes.length - idMap.size;
  let unlinked = 0;
  for (const raw of rawEdges.slice(0, 6000)) {
    const e = raw as Record<string, unknown> | null;
    const s = e && typeof e.source === "string" ? idMap.get(e.source) : undefined;
    const t = e && typeof e.target === "string" ? idMap.get(e.target) : undefined;
    if (!e || !s || !t) {
      unlinked++;
      continue;
    }
    if (s === t) continue;
    const id = edgeKey(s, t);
    if (seen.has(id)) continue;
    seen.add(id);
    const old = (e.data && typeof e.data === "object" ? e.data : {}) as Record<string, unknown>;
    const label = str(old.label, 200) ?? str(e.label, 200);
    const a = out.get(s)!.data.kind;
    const b = out.get(t)!.data.kind;
    // a trail's numbered step stays a step; anything else is read as its kinds imply
    const rel = label && /^\d+$/.test(label) ? "next" : inferRel(type, a, b);
    const place = rel === "attests" ? (placeOf.get(e.source as string) ?? placeOf.get(e.target as string)) : undefined;
    edges.push({ id, source: s, target: t, data: clean({ rel, label, place: place && place.startsWith(`${out.get(t)!.data.verse?.key}:`) ? place : undefined, reading: old.reading === true ? true : undefined }), ...(label ? { label } : {}) });
  }
  const got = cleanGraph([...out.values()], edges);
  unread = Math.max(0, unread);
  return { ...got, skippedNodes: got.skippedNodes + unread, skippedEdges: got.skippedEdges + unlinked + Math.max(0, rawEdges.length - 6000) };
}

/** Any map's cards and links, as version 2: read through the sanitiser, a version-1 map migrated first. */
export async function upgrade(version: unknown, type: GraphKind, nodes: unknown, edges: unknown): Promise<Cleaned> {
  const n = Array.isArray(nodes) ? nodes : [];
  // a link as an object or, in older records, as a [source, target] pair (EDT-277, EDT-291, HWF-53)
  const e = (Array.isArray(edges) ? edges : []).map((x) => (Array.isArray(x) ? { source: x[0], target: x[1] } : x));
  return version === 2 ? cleanGraph(n, e) : migrateV1(type, n, e);
}
