import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatsScreen } from "@/components/stats/StatsScreen";
import { api } from "@/lib/api";
import { localized } from "@/lib/seo";
import type { Frequency, MatrixData, Overview, RankFrequency, SurahProfiles } from "@/lib/stats";

export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps<"/[locale]/stats">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });
  return { title: t("title"), description: t("lead"), alternates: localized(locale, "/stats") };
}

/** The Quran in numbers (P16): the API's counts drawn as charts, each with its table and what it counted. */
export default async function StatsPage({ params }: PageProps<"/[locale]/stats">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("stats");
  const [overview, frequency, surahs, matrix, rank] = await Promise.all([
    api<Overview>("/stats/overview"),
    api<Frequency>("/stats/frequency?kind=root&limit=30&content=true"),
    api<SurahProfiles>("/stats/surahs"),
    api<MatrixData>("/stats/matrix?top=24"),
    api<RankFrequency>("/stats/rank-frequency"),
  ]);
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold">{t("title")}</h1>
        <p className="max-w-[760px] text-[13.5px] leading-relaxed text-t2">{t("lead")}</p>
        <p className="max-w-[760px] text-[12px] leading-relaxed text-t3">{t("descriptiveOnly")}</p>
      </header>
      <StatsScreen overview={overview} frequency={frequency} surahs={surahs.data} matrix={matrix} rank={rank} />
    </div>
  );
}
