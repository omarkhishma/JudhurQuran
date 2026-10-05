import { displayBare, isMark } from "@/lib/arabic/normalize";

/**
 * A passage of a dictionary's article quoted on a map (B36): where it runs in the article as the dataset serves it,
 * and a hash of its words — never the words. The card reads the article, takes the run and checks the hash; a release
 * that retyped the article (the run no longer holding the same words) is said, never drawn as if it still did.
 */
export type Run = { from: number; to: number; hash: string };

export const RUN_MIN = 2;
export const RUN_MAX = 4000;
const HASH = /^[0-9a-f]{8}$/;

/** FNV-1a, 32 bits, over the UTF-16 units: enough to tell the same words at the same place from others. */
export function runHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The run of the body between two offsets, its spaces at either end left out; too short or too long, none. */
export function makeRun(body: string, from: number, to: number): Run | null {
  from = Math.max(0, from);
  to = Math.min(body.length, to);
  while (from < to && /\s/.test(body[from])) from++;
  while (to > from && /\s/.test(body[to - 1])) to--;
  if (to - from < RUN_MIN || to - from > RUN_MAX) return null;
  return { from, to, hash: runHash(body.slice(from, to)) };
}

/** The run's words in this body, or null when the body no longer holds them there. */
export function readRun(body: string, run: Run): string | null {
  if (run.to > body.length) return null;
  const s = body.slice(run.from, run.to);
  return runHash(s) === run.hash ? s : null;
}

export const sameRun = (a?: Run, b?: Run) => (!a && !b) || (!!a && !!b && a.from === b.from && a.to === b.to && a.hash === b.hash);

/** A run as a map, a link or a file claims it: kept only in its own shape. */
export function cleanRun(x: unknown): Run | undefined {
  const r = (x && typeof x === "object" ? x : null) as Record<string, unknown> | null;
  if (!r) return undefined;
  const { from, to, hash } = r;
  if (typeof from !== "number" || typeof to !== "number" || !Number.isInteger(from) || !Number.isInteger(to)) return undefined;
  if (from < 0 || to - from < RUN_MIN || to - from > RUN_MAX || to > 2_000_000) return undefined;
  if (typeof hash !== "string" || !HASH.test(hash)) return undefined;
  return { from, to, hash };
}

/**
 * Offsets in the article as shown — whole, or its opening words — back to the article as served: shown with its marks
 * (the same text), or with them hidden (lib/arabic displayBare, which only takes marks out and writes ٱ as ا) — then
 * each shown letter is found in the body, and the run's last letter keeps the marks written on it.
 */
export function bodyOffsets(body: string, shown: string, from: number, to: number): [number, number] | null {
  if (from < 0 || from >= to || to > shown.length) return null;
  if (body.startsWith(shown)) return [from, to];
  const bare = displayBare(body);
  if (!bare.startsWith(shown)) return null;
  const at: number[] = [];
  for (let i = 0; i < body.length; i++) if (!isMark(body[i])) at.push(i);
  if (at.length !== bare.length) return null;
  let end = at[to - 1] + 1;
  while (end < body.length && isMark(body[end])) end++;
  return [at[from], end];
}
