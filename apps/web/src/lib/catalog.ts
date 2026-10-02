import "server-only";
import { api } from "@/lib/api";

export type Catalog = { loaded_at: string; verses: [number, number, number][]; roots: string[] };

/** Word pages per sitemap file: ~25k URLs with three alternates each stays well under the 50 MB limit. */
export const WORDS_PER_SITEMAP = 25_000;

export const getCatalog = () => api<Catalog>("/catalog");

/** Sitemap ids: "core" (static pages, surahs, verses, roots) then "words-0", "words-1", … */
export function sitemapIds(c: Catalog): string[] {
  const words = c.verses.reduce((n, v) => n + v[2], 0);
  return ["core", ...Array.from({ length: Math.ceil(words / WORDS_PER_SITEMAP) }, (_, i) => `words-${i}`)];
}
