import type { MetadataRoute } from "next";
import { CATALOG_PARTS, getCatalog, getCatalogPart, SITEMAP_IDS, WORD_SITEMAPS, WORDS_PER_SITEMAP } from "@/lib/catalog";
import { publishedPath } from "@/lib/graph/publishedShared";
import { loadGallery } from "@/lib/publishedServer";
import { SITE } from "@/lib/site";

// Built from the live catalog at request time (its fetch is cached until the next release), never at build.
export const dynamic = "force-dynamic";

// Pages that exist in both locales; Arabic is canonical at the bare path, English under /en.
const STATIC_PATHS = ["/", "/quran", "/mushaf", "/roots", "/graph", "/g", "/explore", "/data", "/about", "/sources", "/transparency", "/privacy", "/developers", "/stats", "/stats/relations"];
// the mushaf's pages (B1)
const MUSHAF_PAGES = 604;

/** The published maps (P8.5), the latest first, at most 5,000; none when the API cannot say (the rest still lists). */
async function publishedMaps(): Promise<{ slug: string; updated_at: string }[]> {
  const out: { slug: string; updated_at: string }[] = [];
  try {
    for (let page = 0; page < 50; page++) {
      const got = await loadGallery(page * 100, 100);
      out.push(...got.data);
      if (got.data.length < 100) break;
    }
  } catch {}
  return out;
}

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
  // the dictionary, the hadith and their chapters, the narrators, the books (P12: every surface)
  const part = CATALOG_PARTS.find((p) => p === id);
  if (part) {
    const got = await getCatalogPart(part);
    return got.paths.map((p) => entry(p, got.loaded_at, 0.6));
  }
  if (id === "maps") return (await publishedMaps()).map((m) => entry(publishedPath(m.slug), m.updated_at, 0.5));
  const c = await getCatalog();
  const at = c.loaded_at;
  if (id === "core") {
    const surahs = [...new Set(c.verses.map((v) => v[0]))];
    return [
      ...STATIC_PATHS.map((p) => entry(p, at, p === "/" ? 1 : 0.6)),
      ...surahs.map((s) => entry(`/quran/${s}`, at, 0.9)),
      ...Array.from({ length: MUSHAF_PAGES }, (_, i) => entry(`/mushaf/${i + 1}`, at, 0.6)),
      ...c.verses.map(([s, a]) => entry(`/quran/${s}/${a}`, at, 0.7)),
      ...c.roots.map((r) => entry(`/roots/${encodeURIComponent(r)}`, at, 0.8)),
      // each root's count answered (B8a)
      ...c.roots.map((r) => entry(`/roots/${encodeURIComponent(r)}/count`, at, 0.6)),
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
