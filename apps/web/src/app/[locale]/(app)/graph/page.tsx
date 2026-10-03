import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GraphHome } from "@/components/graph/GraphHome";
import { redirect } from "@/i18n/navigation";
import { encodeSeed, legacySeed } from "@/lib/graph/seedCodec";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/graph">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "graph" });
  return { title: t("editorTitle"), description: t("editorLead"), alternates: localized(locale, "/graph") };
}

// Old links carry their word in the query string (?w=, ?verse=, ?trail=): rendered per request.
export const dynamic = "force-dynamic";

export default async function GraphHomePage({ params, searchParams }: PageProps<"/[locale]/graph">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Links written before seeds existed (?w=, ?verse=, ?trail=) still reach the editor with their word (RDR-028, 341, 450).
  const seed = legacySeed(await searchParams);
  if (seed) redirect({ href: `/graph/seed?s=${encodeSeed(seed)}`, locale });
  return <GraphHome />;
}
