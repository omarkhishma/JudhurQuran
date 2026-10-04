import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmbedFrame, EmbedGone } from "@/components/graph/PublishedEmbed";
import { loadPublished, versionOf } from "@/lib/publishedServer";

// a map's counts and its latest version move, and a withdrawn map must stop showing at once
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/embed/g/[slug]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "graph" });
  // the frame's page is the map's page's twin: never indexed apart from it
  return { title: t("publishedEmbedTitle"), robots: { index: false } };
}

/** A published map framed by any site (P8.5; EDT-275, EDT-279, EDT-280, EDT-284): read-only, its display from the
 * address — the details open or closed, the cards folded or open, the theme — and nothing kept. */
export default async function EmbedPage({ params, searchParams }: PageProps<"/[locale]/embed/g/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const q = await searchParams;
  const one = (k: string) => (Array.isArray(q[k]) ? q[k][0] : q[k]);
  const got = await loadPublished(slug, versionOf(q.v));
  if ("withdrawn" in got) return <EmbedGone by={got.withdrawn} />;
  return <EmbedFrame m={got.map} entry={one("entry") !== "0"} folded={one("folded") === "1"} />;
}
