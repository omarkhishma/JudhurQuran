import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { api } from "@/lib/api";
import type { SurahPayload } from "@/lib/types";
import { ReaderPage } from "@/components/reader5/ReaderPage";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

// Rendered on first request and cached (ISR); see the locale layout.
export function generateStaticParams() {
  return [];
}

function parseSurah(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  return n;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/quran/[surah]">): Promise<Metadata> {
  const { locale, surah } = await params;
  const n = parseSurah(surah);
  const { surah: s } = await api<SurahPayload>(`/surahs/${n}?end=1`);
  const title = locale === "ar" ? `سورة ${s.name_ar}` : `Surah ${s.name_translit} (${s.name_en})`;
  const description =
    locale === "ar"
      ? `اقرأ سورة ${s.name_ar} (${s.revelation_place === "meccan" ? "مكية" : "مدنية"}، ${s.verse_count} آية) بالرسم العثماني، وانقر أي كلمة لترى جذرها ومعناها وصيغها في القرآن الكريم.`
      : `Read Surah ${s.name_translit} (${s.verse_count} verses) in the Uthmani script and tap any word to see its root, meaning and forms across the Quran.`;
  return {
    title,
    description,
    alternates: localized(locale, `/quran/${n}`),
  };
}

export default async function SurahPage({ params }: PageProps<"/[locale]/quran/[surah]">) {
  const { locale, surah } = await params;
  setRequestLocale(locale);
  return <ReaderPage locale={locale} surah={parseSurah(surah)} />;
}
