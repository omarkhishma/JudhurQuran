import type { MetadataRoute } from "next";
import { getCatalog, SITEMAP_IDS, WORD_SITEMAPS, WORDS_PER_SITEMAP } from "@/lib/catalog";
import { SITE } from "@/lib/site";

// Built from the live catalog at request time (its fetch is cached until the next release), never at build.
export const dynamic = "force-dynamic";

// Pages that exist in both locales; Arabic is canonical at the bare path, English under /en.
const STATIC_PATHS = ["/", "/quran", "/roots", "/graph", "/about", "/sources", "/privacy", "/developers"];

function entry(path: string, lastModified: string, priority: number): MetadataRoute.Sitemap[number] {
  const ar = `${SITE.url}${path === "/" ? "" : path}`;
  const en = `${SITE.url}/en${path === "/" ? "" : path}`;
  return { url: ar, lastModified, priority, alternates: { languages: { ar, en, "x-default": ar } } };
}

export function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const c = await getCatalog();
  const at = c.loaded_at;
  if (id === "core") {
    const surahs = [...new Set(c.verses.map((v) => v[0]))];
    return [
      ...STATIC_PATHS.map((p) => entry(p, at, p === "/" ? 1 : 0.6)),
      ...surahs.map((s) => entry(`/quran/${s}`, at, 0.9)),
      ...c.verses.map(([s, a]) => entry(`/quran/${s}/${a}`, at, 0.7)),
      ...c.roots.map((r) => entry(`/roots/${encodeURIComponent(r)}`, at, 0.8)),
    ];
  }
  const chunk = Number(id.replace("words-", ""));
  const locations = c.verses.flatMap(([s, a, n]) => Array.from({ length: n }, (_, i) => `${s}:${a}:${i + 1}`));
  if (locations.length > WORD_SITEMAPS * WORDS_PER_SITEMAP) {
    throw new Error(`${locations.length} words exceed the sitemap capacity; raise WORD_SITEMAPS in lib/catalog.ts`);
  }
  return locations
    .slice(chunk * WORDS_PER_SITEMAP, (chunk + 1) * WORDS_PER_SITEMAP)
    .map((loc) => entry(`/word/${loc}`, at, 0.5));
}
