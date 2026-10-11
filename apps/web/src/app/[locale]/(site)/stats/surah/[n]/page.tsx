import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SurahStats } from "@/components/stats/SurahStats";
import { api } from "@/lib/api";
import { localized } from "@/lib/seo";
import type { Distribution, SurahDetail } from "@/lib/stats";
import { StatsTabs } from "@/components/stats/StatsTabs";

export const revalidate = 86400;

function number(n: string): number {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1 || v > 114) notFound();
  return v;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/stats/surah/[n]">): Promise<Metadata> {
  const { locale, n } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });
  const d = await api<SurahDetail>(`/stats/surahs/${number(n)}`);
  const name = locale === "ar" ? d.name_ar : d.name_translit;
  return { title: t("surahTitle", { name }), description: t("surahLead", { name }), alternates: localized(locale, `/stats/surah/${d.surah}`) };
}

/** One sūra in numbers (P16): its size, its most used roots, the roots only it holds, its once-only words, the sūras
 * nearest it in vocabulary — and where its most used root runs through the Quran. */
export default async function SurahStatsPage({ params }: PageProps<"/[locale]/stats/surah/[n]">) {
  const { locale, n } = await params;
  setRequestLocale(locale);
  const d = await api<SurahDetail>(`/stats/surahs/${number(n)}`);
  const dist = d.top_roots[0] ? await api<Distribution>(`/stats/distribution?root=${encodeURIComponent(d.top_roots[0].key)}`) : null;
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-10">
      <StatsTabs current={null} />
      <SurahStats d={d} dist={dist} />
    </div>
  );
}
