import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RelationsScreen } from "@/components/stats/RelationsScreen";
import { StatsTabs } from "@/components/stats/StatsTabs";
import { api } from "@/lib/api";
import { localized } from "@/lib/seo";
import type { Collocations, NetworkData, Similarity } from "@/lib/stats";

export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps<"/[locale]/stats/relations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });
  return { title: t("relTitle"), description: t("relLead"), alternates: localized(locale, "/stats/relations") };
}

/** Patterns and relations (P16, PV-14): the roots that share verses, the sūras alike in vocabulary, a root's
 * companions — each a statistic of the text, named as one. */
export default async function RelationsPage({ params }: PageProps<"/[locale]/stats/relations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("stats");
  const [network, similarity, colloc] = await Promise.all([
    api<NetworkData>("/stats/network?top=60&per_node=3"),
    api<Similarity>("/stats/similarity"),
    api<Collocations>(`/stats/collocations?root=${encodeURIComponent("رحم")}&limit=20`),
  ]);
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-10">
      <header className="flex flex-col gap-2">
        <StatsTabs current="relations" />
        <h1 className="text-[24px] font-semibold">{t("relTitle")}</h1>
        <p className="max-w-[760px] text-[13.5px] leading-relaxed text-t2">{t("relLead")}</p>
        <p className="max-w-[760px] text-[12px] leading-relaxed text-t3">{t("descriptiveOnly")}</p>
      </header>
      <RelationsScreen network={network} similarity={similarity} colloc={colloc} />
    </div>
  );
}
