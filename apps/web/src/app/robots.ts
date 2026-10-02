import type { MetadataRoute } from "next";
import { SITEMAP_IDS } from "@/lib/catalog";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Search results are an unbounded URL space and the JSON API is for programs; both have their own entry points.
    rules: { userAgent: "*", allow: "/", disallow: ["/search", "/en/search", "/api/"] },
    sitemap: SITEMAP_IDS.map((id) => `${SITE.url}/sitemap/${id}.xml`),
  };
}
