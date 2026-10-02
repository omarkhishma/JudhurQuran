import { SITE } from "@/lib/site";

/** Structured data for search engines (schema.org), escaped so page text can never close the script. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const href = (locale: string, path: string) => `${SITE.url}${locale === "ar" ? "" : "/en"}${path === "/" && locale !== "ar" ? "" : path}`;

/** BreadcrumbList from [name, path] pairs (paths without the locale prefix). */
export function breadcrumbs(locale: string, items: [string, string][]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: href(locale, path) })),
  };
}

export function website(locale: string): Record<string, unknown> {
  const name = SITE.name[locale === "ar" ? "ar" : "en"];
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    alternateName: locale === "ar" ? SITE.name.en : SITE.name.ar,
    url: href(locale, "/"),
    inLanguage: locale,
    description: SITE.tagline[locale === "ar" ? "ar" : "en"],
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${href(locale, "/search")}?q={query}` },
      "query-input": "required name=query",
    },
  };
}
