import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmbedGone, PublishedWindow } from "@/components/graph/PublishedEmbed";
import { loadPublished, versionOf } from "@/lib/publishedServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/g/[slug]/map">): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "graph" });
  const got = await loadPublished(slug, versionOf((await searchParams).v));
  // the map's page is the one to find; this window is its twin
  return { title: "map" in got ? t("publishedWindowTitle", { title: got.map.title }) : t("publishedWithdrawn"), robots: { index: false } };
}

/** A published map opened in the editor, read-only, filling the window (EDT-025, EDT-030, EDT-340). */
export default async function PublishedMapPage({ params, searchParams }: PageProps<"/[locale]/g/[slug]/map">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const got = await loadPublished(slug, versionOf((await searchParams).v));
  if ("withdrawn" in got) return <EmbedGone by={got.withdrawn} />;
  return <PublishedWindow m={got.map} />;
}
