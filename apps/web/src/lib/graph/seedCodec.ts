/**
 * What the reader hands to the graph editor (design 03, RDR-361…370): a seed that names what to build,
 * never the cards themselves, so the editor always builds from the current dataset. It travels in the
 * editor's URL as base64url of UTF-8 JSON — plain btoa throws on Arabic (RDR-601). Shared by the server
 * (legacy-link redirect) and the client.
 */

export type TrailSeedStep = { kind: "word" | "verse" | "root"; id: string };

export type Seed =
  | { seed: "word"; slug: string; at?: string | null }
  | { seed: "root"; root: string }
  | { seed: "verse"; key: string }
  | { seed: "trail"; steps: TrailSeedStep[] };

const LOCATION = /^\d{1,3}:\d{1,3}:\d{1,3}$/;
const VERSE_KEY = /^\d{1,3}:\d{1,3}$/;
const MAX_STEPS = 40;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeSeed(seed: Seed): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(seed)));
}

const str = (x: unknown, max = 80): x is string => typeof x === "string" && x.length > 0 && x.length <= max;

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
      if (!Array.isArray(o.steps)) return null;
      const steps: TrailSeedStep[] = [];
      for (const s of o.steps.slice(0, MAX_STEPS)) {
        const st = s as Record<string, unknown>;
        if ((st?.kind === "word" || st?.kind === "root") && str(st.id)) steps.push({ kind: st.kind, id: st.id });
        else if (st?.kind === "verse" && str(st.id, 8) && VERSE_KEY.test(st.id)) steps.push({ kind: "verse", id: st.id });
      }
      return steps.length ? { seed: "trail", steps } : null;
    }
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
