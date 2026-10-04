/**
 * Pages asked for, counted by the reader's address (security review L4). A page rendered on the server reads the API
 * with the internal token, which the API's own per-address limits do not count; so the web counts them here, in its
 * proxy: every page a minute, and more tightly the pages that read the API afresh for each question (a search, the
 * concordance, a root in the texts). Counted by the address Caddy names (X-Forwarded-For), never this machine's
 * own; never written down, forgotten after a minute.
 */

const WINDOW = 60_000;
const counts = new Map<string, { start: number; n: number }>();
let calls = 0;

/** The key an address counts under: an IPv6 address by its /64, an IPv4 address inside IPv6 as itself (as the API). */
export function keyOf(address: string): string {
  const a = address.split("%")[0].trim().toLowerCase();
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  if (!a.includes(":")) return a;
  const [head, tail] = a.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail ? tail.split(":") : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return a;
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
}

/** This machine itself: Next names the socket's address when no proxy did (development, tests, the health check);
 * behind Caddy the address is the reader's. */
export const isLoopback = (address: string): boolean => /^(?:127\.|::1$|::ffff:127\.|0:0:0:0:0:0:0:1$)/.test(address.trim().toLowerCase());

/** Whether one more request fits the minute for this key and kind; when not, the seconds until it does. */
export function allow(key: string, limit: number, now = Date.now()): { ok: boolean; retry: number } {
  if (++calls % 1000 === 0) for (const [k, c] of counts) if (now - c.start >= WINDOW) counts.delete(k);
  const c = counts.get(key);
  if (!c || now - c.start >= WINDOW) {
    counts.set(key, { start: now, n: 1 });
    return { ok: true, retry: 0 };
  }
  if (c.n >= limit) return { ok: false, retry: Math.ceil((c.start + WINDOW - now) / 1000) };
  c.n++;
  return { ok: true, retry: 0 };
}

/** The pages that read the API afresh for each question asked of them. */
export const FRESH = /^(?:\/en)?\/(?:search|concordance|dictionary\/[^/]+\/texts)(?:\/|$)/;
