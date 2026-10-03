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
