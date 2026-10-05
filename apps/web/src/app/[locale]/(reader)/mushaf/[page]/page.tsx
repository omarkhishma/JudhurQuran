import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PAGES } from "@/components/reader5/pageCount";
import { PageText } from "@/components/reader5/PageText";
import { ReaderShell, type ChapterInfo } from "@/components/reader5/ReaderShell";
import { ReadingSurface } from "@/components/reader5/ReadingSurface";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import type { Surah, Verse } from "@/lib/types";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

function parsePage(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > PAGES) notFound();
  return n;
}

async function load(n: number) {
  const [d, surahs] = await Promise.all([api<{ page: number; verses: Verse[] }>(`/pages/${n}`), api<{ data: Surah[] }>("/surahs")]);
  return { verses: d.verses, surahs: surahs.data };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/mushaf/[page]">): Promise<Metadata> {
  const { locale, page } = await params;
  const n = parsePage(page);
  const { verses, surahs } = await load(n);
  const names = [...new Set(verses.map((v) => v.surah))].map((s) => surahs.find((x) => x.number === s));
  const ar = locale === "ar";
  const first = verses[0];
  const last = verses[verses.length - 1];
  return {
    title: ar ? `الصفحة ${formatNumber(n, locale)} من المصحف الشريف` : `Mushaf page ${n}`,
    description: ar
      ? `الصفحة ${formatNumber(n, locale)} من مصحف المدينة: ${names.map((s) => `سورة ${s?.name_ar}`).join("، ")}، من الآية ${formatNumber(first.ayah, locale)} إلى ${formatNumber(last.ayah, locale)}، بالرسم العثماني، وكل كلمة تفتح جذرها ومعناها.`
      : `Page ${n} of the Madinah mushaf: ${names.map((s) => s?.name_translit).join(", ")} ${first.key}–${last.key}, in the Uthmani script, every word opening its root and meaning.`,
    alternates: localized(locale, `/mushaf/${n}`),
  };
}

/** A page of the mushaf in the reader (B1, page mode): the reader's shell and surface, the page's verses. */
export default async function MushafPage({ params }: PageProps<"/[locale]/mushaf/[page]">) {
  const { locale, page } = await params;
  setRequestLocale(locale);
  const n = parsePage(page);
  const [{ verses, surahs }, basmala] = await Promise.all([load(n), api<Verse>("/verses/1:1")]);
  const s = surahs.find((x) => x.number === verses[0].surah)!;
  const chapter: ChapterInfo = { text: "quran", number: s.number, nameAr: s.name_ar, nameTranslit: s.name_translit, place: s.revelation_place as "meccan" | "medinan", verseCount: s.verse_count, juz: verses[0].juz };
  const ar = locale === "ar";
  return (
    <>
      <JsonLd
        data={breadcrumbs(locale, [
          [ar ? "الرئيسية" : "Home", "/"],
          [ar ? "المصحف" : "The mushaf", "/mushaf"],
          [ar ? `الصفحة ${formatNumber(n, locale)}` : `Page ${n}`, `/mushaf/${n}`],
        ])}
      />
      <ReaderShell chapter={chapter}>
        <ReadingSurface chapter={chapter} page={{ number: n, surahs: [...new Set(verses.map((v) => v.surah))].map((x) => ({ number: x, nameAr: surahs.find((y) => y.number === x)!.name_ar })) }}>
          <PageText page={n} verses={verses} surahs={new Map(surahs.map((x) => [x.number, x]))} basmala={basmala} locale={locale} />
        </ReadingSurface>
      </ReaderShell>
    </>
  );
}
