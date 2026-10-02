import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "@/lib/api";
import type { Surah } from "@/lib/types";
import { SurahIndex } from "@/components/quran/SurahIndex";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/quran">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "surah" });
  return { title: t("index"), description: t("indexLead"), alternates: localized(locale, "/quran") };
}

export default async function QuranIndexPage({ params }: PageProps<"/[locale]/quran">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("surah");
  const { data } = await api<{ data: Surah[] }>("/surahs");
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10">
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold text-t1">{t("index")}</h1>
        <p className="mt-1 text-t2">{t("indexLead")}</p>
      </header>
      <SurahIndex surahs={data} />
    </div>
  );
}
