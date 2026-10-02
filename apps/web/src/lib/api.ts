import "server-only";
import { notFound } from "next/navigation";

const API_ORIGIN = process.env.JUDHUR_API_ORIGIN ?? "http://127.0.0.1:8000";

/**
 * Server-side fetch from the Judhur API. Content is immutable within a dataset release, so pages
 * cache for a day and are invalidated together through the "dataset" tag when a release loads.
 */
export async function api<T>(path: string, { revalidate = 86400 }: { revalidate?: number } = {}): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    next: { revalidate, tags: ["dataset"] },
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) notFound();
  if (!res.ok) {
    throw new Error(`API ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
