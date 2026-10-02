import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "@/lib/api";
import type { SurahPayload, Verse } from "@/lib/types";
import { VerseList } from "@/components/reader/VerseList";
import { ReaderController } from "@/components/reader/ReaderController";
import { ReaderToolbar } from "@/components/reader/ReaderToolbar";
import { SidePanel } from "@/components/reader/SidePanel";
import { AudioBar } from "@/components/audio/AudioBar";
import { cnt, formatNumber } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/seo";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";

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
  const n = parseSurah(surah);
  const t = await getTranslations("reader");
  const ts = await getTranslations("surah");
  const tc = await getTranslations("common");
  const [payload, basmala] = await Promise.all([
    api<SurahPayload>(`/surahs/${n}${locale === "en" ? "?translation=saheeh" : ""}`),
    api<Verse>("/verses/1:1"),
  ]);
  const s = payload.surah;
  const showBasmala = n !== 1 && n !== 9;

  return (
    <div className="reader-layout">
      <JsonLd data={breadcrumbs(locale, [[(locale === "ar" ? "الرئيسية" : "Home"), "/"], [(locale === "ar" ? "القرآن الكريم" : "The Quran"), "/quran"], [(locale === "ar" ? `سورة ${s.name_ar}` : `Surah ${s.name_translit}`), `/quran/${n}`]])} />
      <div className="min-w-0 bg-paper">
        <ReaderToolbar surah={n} nameAr={s.name_ar} nameTranslit={s.name_translit} verseCount={s.verse_count} />
        <div className="mx-auto max-w-[860px] px-4 pb-24">
          <header className="surah-header my-8 text-center">
            <h1 className="ar-classical text-[34px] font-bold text-t1" lang="ar">{`سورة ${s.name_ar}`}</h1>
            <p className="mt-1 text-[13px] text-t3">
              {t("surahInfo", {
                place: s.revelation_place === "meccan" ? ts("meccan") : ts("medinan"),
                verses: tc("verses", cnt(s.verse_count, locale)),
                from: formatNumber(s.page_start, locale),
                to: formatNumber(s.page_end, locale),
              })}
            </p>
            {locale === "en" && <p className="mt-0.5 text-[13px] text-t2">{`${s.name_translit} — ${s.name_en}`}</p>}
            {showBasmala && (
              <p className="quran mt-6 text-[calc(30px*var(--reading-scale,1))] text-t1" dir="rtl" lang="ar" aria-label={t("basmala")}>
                {basmala.tokens.map((tk) => tk.text).join(" ")}
              </p>
            )}
            <p className="mx-auto mt-5 max-w-[60ch] text-[12.5px] text-t3">{t("tapWordHint")}</p>
          </header>
          <ReaderController surah={n} surahName={s.name_ar}>
            <VerseList
              verses={payload.verses}
              surahName={s.name_ar}
              locale={locale}
              ayahLabel={(num) => t("ayahLabel", { n: num })}
              verseActionsLabel={(ref) => t("verseActions", { ref })}
              translationTitle={payload.translation?.title_en}
            />
          </ReaderController>
          <nav className="mt-12 mb-4 flex justify-between gap-3 border-t border-line pt-6" aria-label={ts("index")}>
            {n > 1 ? <Link href={`/quran/${n - 1}`} className="btn min-h-[40px]">{ts("prev")}</Link> : <span />}
            {n < 114 ? <Link href={`/quran/${n + 1}`} className="btn min-h-[40px]">{ts("next")}</Link> : <span />}
          </nav>
        </div>
        <AudioBar surah={n} surahName={s.name_ar} />
      </div>
      <SidePanel surahName={s.name_ar} />
    </div>
  );
}
