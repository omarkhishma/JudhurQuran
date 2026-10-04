import "server-only";
import { notFound } from "next/navigation";
import type { PublishedMap, PublishedRow } from "@/lib/graph/publishedShared";

const API_ORIGIN = process.env.JADHR_API_ORIGIN ?? "http://127.0.0.1:8000";
const INTERNAL = process.env.JADHR_INTERNAL_TOKEN;
const HEADERS: Record<string, string> = INTERNAL ? { Accept: "application/json", "x-jadhr-internal": INTERNAL } : { Accept: "application/json" };

export type Loaded = { map: PublishedMap } | { withdrawn: "author" | "board" };

/**
 * A published map as the server renders its page (P8.5): never cached — its counts move and a withdrawn map stops
 * showing at once. An address no map ever had is a 404; one whose map was withdrawn says by whom.
 */
export async function loadPublished(rawSlug: string, version?: number): Promise<Loaded> {
  const slug = decodeURIComponent(rawSlug);
  if (slug.length > 240) notFound();
  const r = await fetch(`${API_ORIGIN}/api/v1/published/${encodeURIComponent(slug)}${version ? `?v=${version}` : ""}`, { cache: "no-store", headers: HEADERS });
  if (r.status === 404) notFound();
  if (r.status === 410) {
    const code = ((await r.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code;
    return { withdrawn: code === "withdrawn_board" ? "board" : "author" };
  }
  if (!r.ok) throw new Error(`API /published/${slug} → HTTP ${r.status}`);
  return { map: (await r.json()) as PublishedMap };
}

export async function loadGallery(offset: number, limit: number, by?: string): Promise<{ data: PublishedRow[]; total: number }> {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit), ...(by ? { by } : {}) });
  const r = await fetch(`${API_ORIGIN}/api/v1/published?${q}`, { cache: "no-store", headers: HEADERS });
  if (!r.ok) throw new Error(`API /published → HTTP ${r.status}`);
  return r.json();
}

/** `?v=` read as a version number, or nothing. */
export function versionOf(raw: string | string[] | undefined): number | undefined {
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(v) && v >= 1 && v <= 1000 ? v : undefined;
}
