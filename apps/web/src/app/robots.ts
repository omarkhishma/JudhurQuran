import type { MetadataRoute } from "next";
import { getCatalog, sitemapIds } from "@/lib/catalog";
import { SITE } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const ids = sitemapIds(await getCatalog());
  return {
    // Search results are an unbounded URL space and the JSON API is for programs; both have their own entry points.
    rules: { userAgent: "*", allow: "/", disallow: ["/search", "/en/search", "/api/"] },
    sitemap: ids.map((id) => `${SITE.url}/sitemap/${id}.xml`),
  };
}
