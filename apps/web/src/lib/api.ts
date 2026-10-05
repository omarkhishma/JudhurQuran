import "server-only";
import { notFound } from "next/navigation";

const API_ORIGIN = process.env.JADHR_API_ORIGIN ?? "http://127.0.0.1:8000";
// Server renders all come from this one host; the token keeps them out of the API's per-IP limit.
const INTERNAL = process.env.JADHR_INTERNAL_TOKEN;

/**
 * Server-side fetch from our API. Content is immutable within a dataset release, so pages
 * cache for a day and are invalidated together through the "dataset" tag when a release loads.
 */
export async function api<T>(path: string, { revalidate = 86400 }: { revalidate?: number } = {}): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    next: { revalidate, tags: ["dataset"] },
    headers: INTERNAL ? { Accept: "application/json", "x-jadhr-internal": INTERNAL } : { Accept: "application/json" },
  });
  if (res.status === 404) notFound();
  if (!res.ok) {
    throw new Error(`API ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Verses of a sūra asked for at once: a part this size stays well under the 2 MB the data cache keeps. */
const SURAH_PART = 100;

/**
 * A whole sūra for a server render, asked for 100 verses at a time and joined. The data cache keeps an answer of up
 * to 2 MB, stored as base64 (a third larger), so al-Baqara whole (2.2 MB) was never kept and every render that drew
 * it fetched it again; each part is kept on its own. The parts join to exactly the whole (checked for all 114).
 */
export async function surahWhole<T extends { surah: { verse_count: number }; verses: unknown[] }>(n: number): Promise<T> {
  const first = await api<T>(`/surahs/${n}?start=1&end=${SURAH_PART}`);
  const count = first.surah.verse_count;
  if (count <= SURAH_PART) return first;
  const starts: number[] = [];
  for (let a = SURAH_PART + 1; a <= count; a += SURAH_PART) starts.push(a);
  const rest = await Promise.all(starts.map((a) => api<T>(`/surahs/${n}?start=${a}&end=${Math.min(count, a + SURAH_PART - 1)}`)));
  return { ...first, verses: [...first.verses, ...rest.flatMap((p) => p.verses)] };
}
