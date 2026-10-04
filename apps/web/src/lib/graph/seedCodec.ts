/**
 * What the reader hands to the graph editor (design 03, RDR-361…370): a seed that names what to build,
 * never the cards themselves, so the editor always builds from the current dataset. It travels in the
 * editor's URL as base64url of UTF-8 JSON — plain btoa throws on Arabic (RDR-601). Shared by the server
 * (legacy-link redirect) and the client.
 */

/** A word read from the reader's own text carries the Analyser's confidence and the word as written (`conf`, `s`):
 * it is reviewed before it enters a map, and marked there as a reading when it was unsure (F4, QAN-19). A word
 * from the corpus carries neither — its analysis is the corpus's. */
export type TrailSeedStep = { kind: "word" | "verse" | "root"; id: string; conf?: number; s?: string };

export type Seed =
  | { seed: "word"; slug: string; at?: string | null }
  | { seed: "root"; root: string }
  | { seed: "verse"; key: string }
  | { seed: "trail"; steps: TrailSeedStep[]; phrase?: string }
  /** a curated set (Explore): its words as cards, in no order (F12) — a trail is a path, a set is not */
  | { seed: "set"; name: string; steps: TrailSeedStep[] }
  /** a dictionary's article, quoted on a note linked to its root (RDR-239): named by its id, never carried */
  | { seed: "quote"; entry: number }
  /** a note of the reader's Notebook (NTB-22) — a free note, or a verse's (`v:{key}`) — named by its id: its words
   * stay in this browser, which builds it */
  | { seed: "note"; note: string }
  /** a topic (P8.3): its heading card, its first verses and its sub-topics, read from the dataset by its id */
  | { seed: "topic"; topic: string }
  /** a proper name of the Quran (P8.3b): its heading card and the first verses it is named in, by its id */
  | { seed: "entity"; entity: number };

const LOCATION = /^\d{1,3}:\d{1,3}:\d{1,3}$/;
const VERSE_KEY = /^\d{1,3}:\d{1,3}$/;
/** a topic's id as the dataset or the editorial board makes it: Quranpedia's `qp:{n}`, an adopted La Beaume chapter
 * `lb:{n}`, a topic of the board's own `board:{id}` (P8.3b) */
const TOPIC_ID = /^(qp:\d{1,7}|lb:\d{1,2}|board:[a-z0-9]{6,16})$/;
const MAX_STEPS = 40;
/** a Notebook note's id (lib/store/notebook) */
const NOTE_ID = /^(n[a-z0-9]{1,20}|v:\d{1,3}:\d{1,3})$/;
/** a phrase from the Analyser travels with its words as a sentence card (ANA-22) */
const MAX_PHRASE = 600;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeSeed(seed: Seed): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(seed)));
}

const str = (x: unknown, max = 80): x is string => typeof x === "string" && x.length > 0 && x.length <= max;

function validSteps(x: unknown): TrailSeedStep[] {
  if (!Array.isArray(x)) return [];
  const steps: TrailSeedStep[] = [];
  for (const s of x.slice(0, MAX_STEPS)) {
    const st = s as Record<string, unknown>;
    if (st?.kind === "word" && str(st.id)) {
      const conf = typeof st.conf === "number" && st.conf >= 0 && st.conf <= 1 ? Math.round(st.conf * 100) / 100 : undefined;
      steps.push({ kind: "word", id: st.id, ...(conf !== undefined ? { conf } : {}), ...(conf !== undefined && str(st.s, 40) ? { s: st.s } : {}) });
    } else if (st?.kind === "root" && str(st.id)) steps.push({ kind: "root", id: st.id });
    else if (st?.kind === "verse" && str(st.id, 8) && VERSE_KEY.test(st.id)) steps.push({ kind: "verse", id: st.id });
  }
  return steps;
}

/** A seed only if every field has the expected shape; anything else is ignored, never trusted. */
export function validSeed(x: unknown): Seed | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  switch (o.seed) {
    case "word":
      if (!str(o.slug)) return null;
      return { seed: "word", slug: o.slug, at: str(o.at, 12) && LOCATION.test(o.at) ? o.at : null };
    case "root":
      return str(o.root, 12) ? { seed: "root", root: o.root } : null;
    case "verse":
      return str(o.key, 8) && VERSE_KEY.test(o.key) ? { seed: "verse", key: o.key } : null;
    case "trail": {
      const steps = validSteps(o.steps);
      const phrase = str(o.phrase, MAX_PHRASE) ? o.phrase.trim() : "";
      return steps.length ? { seed: "trail", steps, ...(phrase ? { phrase } : {}) } : null;
    }
    case "set": {
      const steps = validSteps(o.steps);
      return steps.length && str(o.name, 120) ? { seed: "set", name: o.name.trim(), steps } : null;
    }
    case "quote":
      return typeof o.entry === "number" && Number.isInteger(o.entry) && o.entry > 0 && o.entry < 2_000_000_000 ? { seed: "quote", entry: o.entry } : null;
    case "note":
      return str(o.note, 24) && NOTE_ID.test(o.note) ? { seed: "note", note: o.note } : null;
    case "topic":
      return str(o.topic, 24) && TOPIC_ID.test(o.topic) ? { seed: "topic", topic: o.topic } : null;
    case "entity":
      return typeof o.entity === "number" && Number.isInteger(o.entity) && o.entity > 0 && o.entity < 1_000_000 ? { seed: "entity", entity: o.entity } : null;
    default:
      return null;
  }
}

export function decodeSeed(encoded: string): Seed | null {
  try {
    const bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    return validSeed(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))));
  } catch {
    return null;
  }
}

/** Links written before seeds existed: /graph?w=slug, ?verse=2:255, ?trail=slug,slug (RDR-028, 341, 450). */
export function legacySeed(params: Record<string, string | string[] | undefined>): Seed | null {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  if (one("seed")) return decodeSeed(one("seed"));
  if (one("w")) return validSeed({ seed: "word", slug: one("w"), at: one("at") || null });
  if (one("verse")) return validSeed({ seed: "verse", key: one("verse") });
  if (one("root")) return validSeed({ seed: "root", root: one("root") });
  if (one("trail")) return validSeed({ seed: "trail", steps: one("trail").split(",").map((id) => ({ kind: "word", id })) });
  return null;
}
