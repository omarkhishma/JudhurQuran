import "server-only";
import { api } from "@/lib/api";

export type Catalog = { loaded_at: string; verses: [number, number, number][]; roots: string[] };

/**
 * Word pages per sitemap file (~40k URLs with three alternates each ≈ 16 MB, under the 50 MB limit).
 * The sitemap ids are fixed so a build never needs the data: two word files hold 80,000 words, and the
 * corpus has 77,429. A dataset that outgrows this fails loudly in `sitemap()` instead of dropping URLs.
 */
export const WORDS_PER_SITEMAP = 40_000;
export const WORD_SITEMAPS = 2;
/** The parts of the site beyond the Quran, each a sitemap of its own, listed by the API (`/catalog/{part}`). */
export const CATALOG_PARTS = ["dictionary", "hadith", "hadith-chapters", "narrators", "books"] as const;
export const SITEMAP_IDS = ["core", ...Array.from({ length: WORD_SITEMAPS }, (_, i) => `words-${i}`), ...CATALOG_PARTS, "maps"];
export const getCatalogPart = (part: (typeof CATALOG_PARTS)[number]) => api<{ loaded_at: string; paths: string[] }>(`/catalog/${part}`);

export const getCatalog = () => api<Catalog>("/catalog");
