import { SITE } from "@/lib/site";

/** Structured data for search engines (schema.org), escaped so page text can never close the script. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

const href = (locale: string, path: string) =>
  `${SITE.url}${locale === "ar" ? "" : "/en"}${path === "/" && locale !== "ar" ? "" : path}`;

/** BreadcrumbList from [name, path] pairs (paths without the locale prefix). */
export function breadcrumbs(
  locale: string,
  items: [string, string][],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: href(locale, path),
    })),
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
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${href(locale, "/search")}?q={query}`,
      },
      "query-input": "required name=query",
    },
  };
}

/** A release as `/data` describes it to search engines (B52). */
export type LdRelease = {
  version: string;
  built_at: string | null;
  published_at: string | null;
  doi: string | null;
  files: {
    path: string;
    format: string | null;
    bytes: number;
    available: boolean;
    url: string;
  }[];
  sources: { title_en: string; url: string; license: string }[];
};

const MEDIA: Record<string, string> = {
  jsonl: "application/x-ndjson",
  csv: "text/csv",
  tei: "application/tei+xml",
  lmf: "application/xml",
};

/** The dataset as a schema.org Dataset (B52): every licence in it — ours and each source's — and, once a release is
 * published, the files that can be downloaded; its DOI once minted, else the release's own address. */
export function datasetLd(
  locale: string,
  r: LdRelease | null,
  description: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name:
      locale === "ar"
        ? "جذر — بيانات جذور القرآن"
        : "Jadhr — Quranic Roots Dataset",
    alternateName: "jadhr-quran",
    description,
    url: href(locale, "/data"),
    inLanguage: ["ar", "en"],
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE.name.en, url: SITE.url },
    keywords: [
      "Quran",
      "Quranic Arabic",
      "Arabic roots",
      "morphology",
      "lexicon",
      "TEI Lex-0",
      "LMF",
      "Lane's Lexicon",
    ],
    license: [
      {
        "@type": "CreativeWork",
        name: "CC BY-SA 4.0 — this project's derived layers",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
      ...(r?.sources ?? []).map((s) => ({
        "@type": "CreativeWork",
        name: `${s.title_en}: ${s.license}`,
        url: s.url,
      })),
    ],
    ...(r && {
      version: r.version,
      isBasedOn: r.sources.map((s) => s.url),
      identifier: r.doi
        ? `https://doi.org/${r.doi}`
        : `${SITE.url}/api/v1/releases/${r.version}`,
      ...(r.built_at && { dateCreated: r.built_at.slice(0, 10) }),
      ...(r.published_at && { datePublished: r.published_at.slice(0, 10) }),
      distribution: r.files
        .filter((f) => f.available)
        .map((f) => ({
          "@type": "DataDownload",
          name: f.path,
          encodingFormat: MEDIA[f.format ?? ""] ?? "application/octet-stream",
          contentUrl: `${SITE.url}${f.url}`,
          contentSize: `${f.bytes} B`,
        })),
    }),
  };
}
