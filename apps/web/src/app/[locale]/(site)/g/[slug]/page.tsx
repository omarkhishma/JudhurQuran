import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublishedGone, PublishedScreen } from "@/components/graph/PublishedPage";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { verseRef } from "@/lib/format";
import { publishedPath, type PublishedMap } from "@/lib/graph/publishedShared";
import { loadPublished, versionOf } from "@/lib/publishedServer";
import { localized } from "@/lib/seo";
import { SITE } from "@/lib/site";

// a map's counts and its latest version move, and a withdrawn map must stop showing at once
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/g/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const v = versionOf((await searchParams).v);
  const t = await getTranslations({ locale, namespace: "graph" });
  const got = await loadPublished(slug, v);
  if ("withdrawn" in got) return { title: t("publishedWithdrawn"), robots: { index: false } };
  const m = got.map;
  const description = m.description || t("publishedNoDescription");
  return {
    title: m.title,
    description,
    // one address per map: an earlier version is the same map's page
    alternates: localized(locale, publishedPath(m.slug)),
    openGraph: { title: m.title, description, type: "article", publishedTime: m.first_published_at, modifiedTime: m.updated_at, ...(m.author.name ? { authors: [m.author.name] } : {}) },
  };
}

/** The map as text, for those who do not read it as a picture and for search engines: its cards by kind. */
function asText(m: PublishedMap, locale: string) {
  const of = (kind: string) => m.doc.nodes.filter((n) => n.data?.kind === kind);
  return {
    roots: of("root").map((n) => n.data.ar ?? "").filter(Boolean),
    words: of("lemma").map((n) => n.data.ar ?? "").filter(Boolean),
    verses: of("verse").map((n) => (n.data.verse?.key ? verseRef(n.data.verse.key, locale) : "")).filter(Boolean),
    notes: of("note").map((n) => (n.data.text ?? "").split("\n")[0].slice(0, 160)).filter(Boolean),
  };
}

/** A published map's page (P8.5; EDT-324…341): what it is, the map itself framed from its embed, and what a reader
 * can do with it — copy it, open it in the editor, cite it, download it, embed it, report it. */
export default async function PublishedPageRoute({ params, searchParams }: PageProps<"/[locale]/g/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const v = versionOf((await searchParams).v);
  const got = await loadPublished(slug, v);
  const t = await getTranslations("graph");
  if ("withdrawn" in got) return <PublishedGone by={got.withdrawn} />;
  const m = got.map;
  const url = `${SITE.url}${locale === "ar" ? "" : "/en"}${publishedPath(m.slug)}`;
  return (
    <>
      <JsonLd data={breadcrumbs(locale, [[t("publishedGallery"), "/g"], [m.title, publishedPath(m.slug)]])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: m.title,
          ...(m.description ? { description: m.description } : {}),
          url,
          version: String(m.version),
          datePublished: m.first_published_at,
          dateModified: m.updated_at,
          inLanguage: "ar",
          ...(m.author.name ? { author: { "@type": "Person", name: m.author.name } } : {}),
          ...(m.forked_from ? { isBasedOn: `${SITE.url}${publishedPath(m.forked_from.slug, m.forked_from.version)}` } : {}),
          publisher: { "@type": "Organization", name: SITE.name[locale === "ar" ? "ar" : "en"], url: SITE.url },
        }}
      />
      <PublishedScreen initial={m} text={asText(m, locale)} />
    </>
  );
}
