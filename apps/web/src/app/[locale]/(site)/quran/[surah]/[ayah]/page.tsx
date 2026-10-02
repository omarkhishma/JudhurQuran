import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { Commentary, Surah, Verse, Work } from "@/lib/types";
import { VerseList } from "@/components/reader/VerseList";
import { ReaderController } from "@/components/reader/ReaderController";
import { SidePanel } from "@/components/reader/SidePanel";
import { TafsirSection } from "@/components/reader/TafsirSection";
import { citeVerse, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";

export const revalidate = 86400;

async function load(surah: string, ayah: string) {
  const s = Number(surah);
  const a = Number(ayah);
  if (!Number.isInteger(s) || !Number.isInteger(a) || s < 1 || s > 114 || a < 1) notFound();
  const [verse, surahPayload] = await Promise.all([
    api<Verse>(`/verses/${s}:${a}`),
    api<{ surah: Surah }>(`/surahs/${s}?end=1`),
  ]);
  return { verse, surah: surahPayload.surah };
}

// Rendered on first request and then cached until the next release (ISR); none are built ahead.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/quran/[surah]/[ayah]">): Promise<Metadata> {
  const { locale, surah, ayah } = await params;
  const { verse, surah: s } = await load(surah, ayah);
  const cite = citeVerse(s.name_ar, s.number, verse.ayah, locale, s.name_translit);
  const text = verse.tokens.map((t) => t.text).join(" ");
  const tafsir = await api<Commentary>(`/verses/${verse.key}/commentary?works=muyassar`);
  const gist = tafsir.data[0]?.passage?.text.slice(0, 150) ?? "";
  const title = locale === "ar" ? `${cite} — ${verse.text_imlaei.split(" ").slice(0, 8).join(" ")}` : `Quran ${cite}`;
  const description = locale === "ar" ? `﴿${verse.text_imlaei}﴾ — التفسير الميسر: ${gist}…` : `${text.slice(0, 80)} — tafsir, translation, and the root of every word.`;
  const path = `/quran/${s.number}/${verse.ayah}`;
  return { title, description, alternates: localized(locale, path) };
}

export default async function VersePage({ params }: PageProps<"/[locale]/quran/[surah]/[ayah]">) {
  const { locale, surah, ayah } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reader");
  const tp = await getTranslations("panel");
  const { verse, surah: s } = await load(surah, ayah);
  const [works, commentary] = await Promise.all([
    api<{ data: Work[] }>("/works"),
    api<Commentary>(`/verses/${verse.key}/commentary?works=muyassar,saheeh`),
  ]);
  const byPos = new Map(verse.words.map((w) => [w.position, w]));

  return (
    <div className="reader-layout">
      <JsonLd
        data={breadcrumbs(locale, [
          [(locale === "ar" ? "الرئيسية" : "Home"), "/"],
          [(locale === "ar" ? "القرآن الكريم" : "The Quran"), "/quran"],
          [(locale === "ar" ? `سورة ${s.name_ar}` : `Surah ${s.name_translit}`), `/quran/${s.number}`],
          [locale === "ar" ? `الآية ${verse.ayah}` : `Verse ${verse.ayah}`, `/quran/${s.number}/${verse.ayah}`],
        ])}
      />
      <div className="min-w-0 bg-paper">
        <div className="mx-auto max-w-[860px] px-4 pb-20">
          <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-[13px]" aria-label="breadcrumb">
            <span className="flex items-center gap-2 text-t3">
              <Link href="/quran" className="hover:text-t1">{tp("verseWords") && (locale === "ar" ? "المصحف" : "Quran")}</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/quran/${s.number}`} className="hover:text-t1">{`سورة ${s.name_ar}`}</Link>
            </span>
            <span className="flex gap-1.5">
              {verse.prev && <Link href={`/quran/${verse.prev.replace(":", "/")}`} className="btn" rel="prev">{locale === "ar" ? "الآية السابقة" : "Previous verse"}</Link>}
              {verse.next && <Link href={`/quran/${verse.next.replace(":", "/")}`} className="btn" rel="next">{locale === "ar" ? "الآية التالية" : "Next verse"}</Link>}
            </span>
          </nav>
          <header className="my-6 text-center">
            <h1 className="ar-classical text-[26px] font-bold" lang="ar">{citeVerse(s.name_ar, s.number, verse.ayah, "ar")}</h1>
            <p className="mt-1 text-[13px] text-t3">
              {locale === "ar"
                ? `الجزء ${formatNumber(verse.juz, locale)} · الصفحة ${formatNumber(verse.page, locale)}`
                : `Juz ${verse.juz} · page ${verse.page}`}
            </p>
          </header>
          <ReaderController surah={s.number} surahName={s.name_ar}>
            <VerseList
              verses={[verse]}
              surahName={s.name_ar}
              locale={locale}
              ayahLabel={(n) => t("ayahLabel", { n })}
              verseActionsLabel={(ref) => t("verseActions", { ref })}
            />
          </ReaderController>
          <p className="mt-2 text-center text-[12.5px] text-t3">{t("tapWordHint")}</p>

          <section className="mt-8" aria-labelledby="words">
            <h2 id="words" className="mb-3 text-[18px] font-semibold">{tp("verseWords")}</h2>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" dir="rtl">
              {verse.tokens.map((tk) => {
                const w = byPos.get(tk.word_from);
                return (
                  <li key={tk.position}>
                    <Link href={`/word/${verse.key}:${tk.word_from}`} className="card flex h-full flex-col items-center gap-1 p-3 text-center hover:border-ring">
                      <span className="quran text-[24px] leading-[1.9]" lang="ar">{tk.text}</span>
                      {w?.root ? (
                        <span className="ar-classical text-[15px] text-root" lang="ar">{w.root.split("").join(" ")}</span>
                      ) : (
                        <span className="text-[12px] text-t3">{tp("noRoot")}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card mt-8 overflow-hidden p-0" aria-label={tp("tafsirTab")}>
            <TafsirSection verseKey={verse.key} initialWorks={works.data} initialCommentary={commentary} />
          </section>
        </div>
      </div>
      <SidePanel surahName={s.name_ar} />
    </div>
  );
}
